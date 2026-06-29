import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { type Permission, useAuth } from '@/contexts/AuthContext';
import { externalSupabase as supabase } from '@/integrations/supabase/externalClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import loginBg from '@/assets/login-bg.jpg';
import logoAsset from '@/assets/LogoFull.svg';
import geodudexLogo from '@/assets/LogoFull.svg';

// Free account permissions per product requirement
const FREE_PERMISSIONS: Permission[] = ['capas', 'regiones_comunas', 'medioambiente', 'plan_regulador', 'proyectos', 'busqueda_general'];
const FREE_REGIONES = ['Tarapacá'];

const COUNTRY_CODES: { code: string; label: string; flag: string }[] = [
  { code: '+56', label: 'Chile', flag: '🇨🇱' },
  { code: '+54', label: 'Argentina', flag: '🇦🇷' },
  { code: '+591', label: 'Bolivia', flag: '🇧🇴' },
  { code: '+55', label: 'Brasil', flag: '🇧🇷' },
  { code: '+57', label: 'Colombia', flag: '🇨🇴' },
  { code: '+506', label: 'Costa Rica', flag: '🇨🇷' },
  { code: '+593', label: 'Ecuador', flag: '🇪🇨' },
  { code: '+503', label: 'El Salvador', flag: '🇸🇻' },
  { code: '+34', label: 'España', flag: '🇪🇸' },
  { code: '+1', label: 'Estados Unidos', flag: '🇺🇸' },
  { code: '+502', label: 'Guatemala', flag: '🇬🇹' },
  { code: '+504', label: 'Honduras', flag: '🇭🇳' },
  { code: '+52', label: 'México', flag: '🇲🇽' },
  { code: '+505', label: 'Nicaragua', flag: '🇳🇮' },
  { code: '+507', label: 'Panamá', flag: '🇵🇦' },
  { code: '+595', label: 'Paraguay', flag: '🇵🇾' },
  { code: '+51', label: 'Perú', flag: '🇵🇪' },
  { code: '+1', label: 'República Dominicana', flag: '🇩🇴' },
  { code: '+598', label: 'Uruguay', flag: '🇺🇾' },
  { code: '+58', label: 'Venezuela', flag: '🇻🇪' },
];

const waitForProfileRow = async (userId: string) => {
  if (!supabase) return false;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data } = await supabase
      .from('usuarios_perfiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (data) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
};

export default function Register() {
  const { user, loading, refreshPermissions, setLocalPermissions } = useAuth();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [movilCountry, setMovilCountry] = useState('+56');
  const [movil, setMovil] = useState('9');
  const [cargo, setCargo] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && user && !isLoading) navigate('/', { replace: true });
  }, [user, loading, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nombre.trim() || !email.trim() || !movil.trim() || !empresa.trim() || !password) {
      setError('Nombres, correo, móvil, organización y contraseña son obligatorios.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!supabase) {
      setError('Servicio no disponible.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            nombre: nombre.trim(),
            movil: `${movilCountry} ${movil.trim()}`,
            cargo: cargo.trim(),
            empresa: empresa.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message || 'Error al crear la cuenta.');
        setIsLoading(false);
        return;
      }

      const newUserId = data.user?.id;
      if (newUserId) {
        // Wait for the profile row and apply free-tier access before navigating.
        await waitForProfileRow(newUserId);
        const { error: profileError } = await supabase
          .from('usuarios_perfiles')
          .update({
            permisos: FREE_PERMISSIONS,
            regiones_permitidas: FREE_REGIONES,
            activo: true,
          })
          .eq('id', newUserId);

        if (profileError) {
          setError('La cuenta se creó, pero no fue posible activar sus permisos. Intenta ingresar nuevamente.');
          setIsLoading(false);
          return;
        }

        // Refresh AuthContext using the new user id immediately; React state from
        // SIGNED_IN may not be committed yet during automatic login.
        setLocalPermissions(FREE_PERMISSIONS, FREE_REGIONES, newUserId);
        await refreshPermissions(newUserId);
      }

      setSuccess(true);
      navigate('/', { replace: true });
    } catch {
      setError('Error inesperado al crear la cuenta.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-graphik bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden border-r border-border">
        <img src={loginBg} alt="Gdudex" className="absolute inset-0 w-full h-full object-cover" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex justify-center pt-4">
            <img src={geodudexLogo} alt="Gdudex" className="h-24 w-auto object-contain select-none drop-shadow-lg" draggable={false} />
          </div>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight leading-tight mb-4 text-white drop-shadow-md">
              Crea tu cuenta gratis<br />y comienza a explorar
            </h1>
            <p className="text-white/90 text-base leading-relaxed max-w-md drop-shadow">
              Acceso libre a Capas, Región de Tarapacá, Medioambiente y Buscador.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel - register form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 py-12 bg-background">
        <div className="w-full max-w-md">
          <div className="flex lg:hidden justify-center mb-8">
            <img src={geodudexLogo} alt="Gdudex" className="h-20 w-auto object-contain select-none" draggable={false} />
          </div>

          <div className="mb-8 text-center">
            <p className="text-sm text-muted-foreground mb-1">Plan <span className="font-semibold text-primary">Free</span></p>
            <h2 className="text-3xl font-display font-bold text-foreground mb-2">Crear cuenta</h2>
            <p className="text-muted-foreground text-sm">Completa tus datos para registrarte</p>
          </div>

          {success ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-foreground font-medium">¡Cuenta creada!</p>
              <p className="text-muted-foreground text-sm">
                Revisa tu correo para confirmar tu cuenta. Luego podrás ingresar con tu email y contraseña.
              </p>
              <Link to="/login" className="inline-block text-sm text-primary hover:underline">
                Ir al login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nombre" className="text-sm font-medium text-muted-foreground">Nombres y apellidos</Label>
                <Input id="nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan Pérez" required maxLength={120}
                  className="h-11 rounded-xl border-border bg-input focus:border-primary text-sm" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">Correo electrónico</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" required autoComplete="email" maxLength={200}
                  className="h-11 rounded-xl border-border bg-input focus:border-primary text-sm" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="movil" className="text-sm font-medium text-muted-foreground">Móvil</Label>
                <div className="flex gap-2">
                  <select
                    aria-label="País"
                    value={movilCountry}
                    onChange={e => setMovilCountry(e.target.value)}
                    className="h-11 rounded-xl border border-border bg-input px-2 text-sm focus:border-primary focus:outline-none w-[130px] shrink-0"
                  >
                    {COUNTRY_CODES.map((c, idx) => (
                      <option key={`${c.code}-${idx}`} value={c.code}>{c.flag} {c.label} {c.code}</option>
                    ))}
                  </select>
                  <Input id="movil" type="tel" value={movil} onChange={e => setMovil(e.target.value.replace(/[^\d\s]/g, ''))} placeholder="9 1234 5678" required maxLength={20}
                    className="h-11 rounded-xl border-border bg-input focus:border-primary text-sm flex-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cargo" className="text-sm font-medium text-muted-foreground">Cargo <span className="text-xs text-muted-foreground/60">(opcional)</span></Label>
                  <Input id="cargo" value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Gerente" maxLength={80}
                    className="h-11 rounded-xl border-border bg-input focus:border-primary text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="empresa" className="text-sm font-medium text-muted-foreground">Organización</Label>
                  <Input id="empresa" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Tu organización" required maxLength={120}
                    className="h-11 rounded-xl border-border bg-input focus:border-primary text-sm" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">Contraseña</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required autoComplete="new-password" minLength={8}
                    className="h-11 rounded-xl border-border bg-input focus:border-primary text-sm pr-11" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={isLoading} className="w-full h-11 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Creando cuenta...
                  </div>
                ) : 'Crear cuenta gratis'}
              </Button>

              <p className="text-center text-xs text-muted-foreground pt-1">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">Inicia sesión</Link>
              </p>
            </form>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} XMETA. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
