import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import logoAsset from '@/assets/LogoFull.svg';
import geodudexLogo from '@/assets/LogoFull.svg';

// Dedicated client for password recovery with persistSession enabled
// so it can pick up the recovery token from the URL hash.
const EXTERNAL_URL = import.meta.env.VITE_EXTERNAL_SUPABASE_URL;
const EXTERNAL_ANON = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY;

const recoveryClient = createClient(EXTERNAL_URL, EXTERNAL_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'sb-recovery-auth',
  },
});

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const hasResolved = useRef(false);

  useEffect(() => {
    const resolve = () => {
      if (hasResolved.current) return;
      hasResolved.current = true;
      setChecking(false);
    };

    const { data: { subscription } } = recoveryClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setIsValidSession(true);
      }
      resolve();
    });

    // Fallback: after checking getSession
    recoveryClient.auth.getSession().then(({ data: { session } }) => {
      if (session) setIsValidSession(true);
      // Give onAuthStateChange a moment to fire PASSWORD_RECOVERY
      setTimeout(resolve, 500);
    });

    // Safety timeout so we never hang
    const timer = setTimeout(resolve, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await recoveryClient.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message || 'Error al actualizar la contraseña.');
        setIsLoading(false);
        return;
      }

      // Sign out from recovery client to clean up
      await recoveryClient.auth.signOut().catch(() => {});

      setSuccess(true);
      setIsLoading(false);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err) {
      console.error('Reset password error:', err);
      setError('Error inesperado al actualizar la contraseña.');
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-8 py-12 font-graphik" style={{ background: 'hsl(0 0% 100%)' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-10">
          <img src={geodudexLogo} alt="Geodude X" className="h-12 w-auto object-contain" />
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Contraseña actualizada</h2>
            <p className="text-gray-500">Serás redirigido al inicio de sesión...</p>
          </div>
        ) : !isValidSession ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Enlace inválido</h2>
            <p className="text-gray-500">Este enlace ha expirado o no es válido. Solicita uno nuevo desde el login.</p>
            <Button onClick={() => navigate('/login')} variant="outline" className="rounded-xl">
              Volver al login
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Nueva contraseña</h2>
              <p className="text-gray-500">Ingresa tu nueva contraseña</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-12 rounded-xl border-gray-200 focus:border-primary bg-gray-50/50 text-gray-900 placeholder:text-gray-400 text-sm pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-sm font-medium text-gray-700">Confirmar contraseña</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-12 rounded-xl border-gray-200 focus:border-primary bg-gray-50/50 text-gray-900 placeholder:text-gray-400 text-sm"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || !password || !confirmPassword}
                className="w-full h-12 rounded-xl font-semibold text-sm bg-primary hover:bg-primary/90 transition-all duration-200 shadow-sm"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Actualizando...</span>
                  </div>
                ) : 'Actualizar contraseña'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
