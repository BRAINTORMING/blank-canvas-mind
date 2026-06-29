import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import loginBg from '@/assets/login-bg.jpg';
import logoAsset from '@/assets/LogoFull.svg';
import geodudexLogo from '@/assets/LogoFull.svg';

export default function Login() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (forgotMode) {
      const { externalSupabase } = await import('@/integrations/supabase/externalClient');
      if (!externalSupabase) {
        setError('Servicio no disponible.');
        setIsLoading(false);
        return;
      }

      // Verify the email belongs to a registered account
      const { data: profile, error: profileError } = await externalSupabase
        .from('usuarios_perfiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (profileError || !profile) {
        setError('No existe una cuenta registrada con este correo electrónico.');
        setIsLoading(false);
        return;
      }

      const { error } = await externalSupabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(error.message || 'Error al enviar el correo.');
      } else {
        setForgotSent(true);
      }
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(email.trim(), password);

    if (error) {
      setError('Correo o contraseña incorrectos. Verifica tus credenciales.');
    } else {
      navigate('/', { replace: true });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex font-graphik bg-background">
      {/* Left panel - image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden border-r border-border">
        <img
          src={loginBg}
          alt="Gdudex"
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex justify-center pt-4">
            <img
              src={geodudexLogo}
              alt="Gdudex"
              className="h-24 w-auto object-contain select-none drop-shadow-lg"
              draggable={false}
            />
          </div>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight leading-tight mb-4 text-white drop-shadow-md">
              Inteligencia territorial<br />para decisiones estratégicas
            </h1>
            <p className="text-white/90 text-base leading-relaxed max-w-md drop-shadow">
              Explora proyectos de inversión, capas de infraestructura y análisis medioambiental con el poder de la IA.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 py-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden justify-center mb-10">
            <img
              src={geodudexLogo}
              alt="Gdudex"
              className="h-20 w-auto object-contain select-none"
              draggable={false}
            />
          </div>


          <div className="mb-10 text-center">
            <p className="text-sm text-muted-foreground mb-1">Encontrando el camino <span className="font-semibold text-primary">de menor costo regulatorio</span></p>
            <h2 className="text-3xl font-display font-bold text-foreground mb-2">Bienvenido</h2>
            <p className="text-muted-foreground">Ingresa tus credenciales para acceder a la plataforma</p>
          </div>

          {forgotSent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-gray-700 font-medium">Correo enviado</p>
              <p className="text-gray-500 text-sm">Revisa tu bandeja de entrada para restablecer tu contraseña.</p>
              <button onClick={() => { setForgotMode(false); setForgotSent(false); setError(''); }} className="text-sm text-primary hover:underline">
                Volver al login
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                autoComplete="email"
                className="h-12 rounded-xl border-border bg-input focus:border-primary hover:border-muted-foreground text-foreground placeholder:text-muted-foreground text-sm transition-colors"
              />
            </div>

            {!forgotMode && (
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="h-12 rounded-xl border-border bg-input focus:border-primary hover:border-muted-foreground text-foreground placeholder:text-muted-foreground text-sm pr-12 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            )}

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || !email || (!forgotMode && !password)}
              className="w-full h-12 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-2"
            >

              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>{forgotMode ? 'Enviando...' : 'Ingresando...'}</span>
                </div>
              ) : (
                forgotMode ? 'Enviar correo de recuperación' : 'Ingresar'
              )}
            </Button>

            <div className="text-center">
              {forgotMode ? (
                <button type="button" onClick={() => { setForgotMode(false); setError(''); }} className="text-sm text-primary hover:underline">
                  Volver al login
                </button>
              ) : (
                <button type="button" onClick={() => { setForgotMode(true); setError(''); }} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>
          </form>
          )}

          <p className="mt-8 text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Crea una cuenta gratis
            </Link>
          </p>
          <p className="mt-4 text-center text-xs text-muted-foreground/50">
            © {new Date().getFullYear()} XMETA. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
