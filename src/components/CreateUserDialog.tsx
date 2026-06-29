import { useState } from 'react';
import { UserPlus, Eye, EyeOff, AlertCircle, CheckCircle2, X, Check, Shield, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ALL_PERMISSIONS, PERMISSION_LABELS, Permission } from '@/contexts/AuthContext';
import { externalSupabase as supabase } from '@/integrations/supabase/externalClient';
import { useRegionComunas } from '@/hooks/useRegionComunas';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [allPerms, setAllPerms] = useState(false);
  const [selectedRegiones, setSelectedRegiones] = useState<string[]>([]);
  const [allRegiones, setAllRegiones] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { regionsWithComunas } = useRegionComunas();
  const allRegionNames = regionsWithComunas.map(r => r.region);

  const togglePermission = (perm: Permission) => {
    setSelectedPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleAllPerms = (checked: boolean) => {
    setAllPerms(checked);
    if (checked) setSelectedPermissions([...ALL_PERMISSIONS]);
    else setSelectedPermissions([]);
  };

  const toggleRegion = (region: string) => {
    setSelectedRegiones(prev => prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]);
  };

  const handleAllRegiones = (checked: boolean) => {
    setAllRegiones(checked);
    if (checked) setSelectedRegiones([...allRegionNames]);
    else setSelectedRegiones([]);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password) {
      setError('El correo y la contraseña son obligatorios.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (selectedPermissions.length === 0 && !allPerms) {
      setError('Debes seleccionar al menos un permiso.');
      return;
    }

    setIsLoading(true);
    try {
      const permsToSave = allPerms ? ['all'] : selectedPermissions;
      const regionesToSave = allRegiones ? [] : selectedRegiones;
      if (!supabase) { setError('Supabase no está configurado.'); setIsLoading(false); return; }

      const { data: currentSession } = await supabase.auth.getSession();
      const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });

      if (signUpError) { setError(signUpError.message); setIsLoading(false); return; }

      const newUserId = data.user?.id;
      if (currentSession.session) {
        await supabase.auth.setSession({
          access_token: currentSession.session.access_token,
          refresh_token: currentSession.session.refresh_token,
        });
      }

      if (newUserId) {
        await new Promise(r => setTimeout(r, 800));
        await supabase.from('usuarios_perfiles').update({
          permisos: permsToSave,
          regiones_permitidas: regionesToSave,
        }).eq('id', newUserId);
      }

      setSuccess(`Usuario ${email.trim()} creado exitosamente.`);
      setEmail('');
      setPassword('');
      setSelectedPermissions([]);
      setAllPerms(false);
      setSelectedRegiones([]);
      setAllRegiones(false);
    } catch {
      setError('Error inesperado al crear el usuario.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <UserPlus className="h-5 w-5 text-primary" />
            Crear nuevo usuario
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dialog-email" className="text-sm font-medium text-gray-700">Correo electrónico</Label>
            <Input id="dialog-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" required className="h-10 rounded-xl border-gray-200 bg-gray-50/50 text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dialog-password" className="text-sm font-medium text-gray-700">Contraseña inicial</Label>
            <div className="relative">
              <Input id="dialog-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required className="h-10 rounded-xl border-gray-200 bg-gray-50/50 text-sm pr-11" />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Permisos</Label>
            <div onClick={() => handleAllPerms(!allPerms)} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${allPerms ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${allPerms ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                {allPerms && <Check className="h-3 w-3 text-white" />}
              </div>
              <span className="text-sm font-semibold text-gray-800">Acceso completo</span>
              <Shield className="h-4 w-4 text-primary opacity-60 ml-auto" />
            </div>
            <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
              {ALL_PERMISSIONS.map(perm => {
                const checked = allPerms || selectedPermissions.includes(perm);
                return (
                  <div key={perm} onClick={() => !allPerms && togglePermission(perm)} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all text-sm ${checked ? 'border-primary/30 bg-primary/5' : 'border-gray-100 hover:border-gray-200'} ${allPerms ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                      {checked && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <span className="text-gray-700 text-xs">{PERMISSION_LABELS[perm]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Regions */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Regiones autorizadas</Label>
            <div onClick={() => handleAllRegiones(!allRegiones)} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${allRegiones ? 'border-amber-500 bg-amber-500/5' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${allRegiones ? 'bg-amber-500 border-amber-500' : 'border-gray-300'}`}>
                {allRegiones && <Check className="h-3 w-3 text-white" />}
              </div>
              <span className="text-sm font-semibold text-gray-800">Todas las regiones</span>
              <MapPin className="h-4 w-4 text-amber-500 opacity-60 ml-auto" />
            </div>
            <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
              {allRegionNames.map(region => {
                const checked = allRegiones || selectedRegiones.includes(region);
                return (
                  <div key={region} onClick={() => !allRegiones && toggleRegion(region)} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all text-sm ${checked ? 'border-amber-500/30 bg-amber-500/5' : 'border-gray-100 hover:border-gray-200'} ${allRegiones ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-amber-500 border-amber-500' : 'border-gray-300'}`}>
                      {checked && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <span className="text-gray-700 text-xs">{region}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
              <button type="button" onClick={() => setError('')} className="ml-auto text-red-400"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-xl">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <p className="text-sm text-green-700">{success}</p>
              <button type="button" onClick={() => setSuccess('')} className="ml-auto text-green-400"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full h-10 rounded-xl font-semibold text-sm">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Creando...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Crear usuario
              </div>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
