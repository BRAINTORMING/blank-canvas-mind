import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ALL_PERMISSIONS, PERMISSION_LABELS, Permission } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Map, LogOut, UserPlus, Users, Shield, Eye, EyeOff,
  ChevronRight, AlertCircle, CheckCircle2, X, Check, Pencil, MapPin, Search
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import logoAsset from '@/assets/LogoFull.svg';
import geodudexLogo from '@/assets/LogoFull.svg';
import { externalSupabase as supabase } from '@/integrations/supabase/externalClient';
import { useRegionComunas } from '@/hooks/useRegionComunas';

interface UserProfile {
  id: string;
  email: string;
  permisos: string[];
  regiones_permitidas: string[];
  activo: boolean;
  ultima_conexion: string | null;
}

export default function Admin() {
  const { user, signOut, hasPermission, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Authorization guard: only users with admin-creation permission may view this page.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (!hasPermission('modulo_creacion_usuarios')) {
      navigate('/', { replace: true });
    }
  }, [authLoading, user, hasPermission, navigate]);

  const isAuthorized = !!user && hasPermission('modulo_creacion_usuarios');
  const { regionsWithComunas } = useRegionComunas();
  const allRegionNames = regionsWithComunas.map(r => r.region);

  // Users list
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create user form state
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

  // Edit dialog
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editPerms, setEditPerms] = useState<Permission[]>([]);
  const [editAllPerms, setEditAllPerms] = useState(false);
  const [editRegiones, setEditRegiones] = useState<string[]>([]);
  const [editAllRegiones, setEditAllRegiones] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  useEffect(() => {
    if (isAuthorized) loadUsers();
  }, [isAuthorized]);

  async function loadUsers() {
    if (!supabase) return;
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('usuarios_perfiles')
        .select('id, email, permisos, regiones_permitidas, activo, ultima_conexion')
        .order('email');
      if (error) throw error;
      setUsers((data || []).map((u: any) => ({
        ...u,
        permisos: u.permisos || [],
        regiones_permitidas: u.regiones_permitidas || [],
      })));
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }

  const togglePermission = (perm: Permission) => {
    setSelectedPermissions(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
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
    if (!email.trim() || !password) { setError('El correo y la contraseña son obligatorios.'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (selectedPermissions.length === 0 && !allPerms) { setError('Debes seleccionar al menos un permiso.'); return; }

    setIsLoading(true);
    try {
      const permsToSave = allPerms ? ['all'] : selectedPermissions;
      const regionesToSave = allRegiones ? [] : selectedRegiones; // empty = all
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
      setEmail(''); setPassword(''); setSelectedPermissions([]); setAllPerms(false);
      setSelectedRegiones([]); setAllRegiones(false);
      loadUsers();
    } catch {
      setError('Error inesperado al crear el usuario.');
    } finally {
      setIsLoading(false);
    }
  };

  // Edit user handlers
  const openEditUser = (u: UserProfile) => {
    setEditUser(u);
    const hasAll = u.permisos.includes('all');
    setEditAllPerms(hasAll);
    setEditPerms(hasAll ? [...ALL_PERMISSIONS] : u.permisos.filter((p): p is Permission => ALL_PERMISSIONS.includes(p as Permission)));
    const hasAllRegions = u.regiones_permitidas.length === 0;
    setEditAllRegiones(hasAllRegions);
    setEditRegiones(hasAllRegions ? [...allRegionNames] : u.regiones_permitidas);
    setEditError('');
    setEditSuccess('');
  };

  const handleSaveEdit = async () => {
    if (!editUser || !supabase) return;
    setEditLoading(true);
    setEditError('');
    setEditSuccess('');
    try {
      const permsToSave = editAllPerms ? ['all'] : editPerms;
      const regionesToSave = editAllRegiones ? [] : editRegiones;
      const { error } = await supabase.from('usuarios_perfiles').update({
        permisos: permsToSave,
        regiones_permitidas: regionesToSave,
      }).eq('id', editUser.id);
      if (error) throw error;
      setEditSuccess('Permisos actualizados correctamente.');
      loadUsers();
    } catch (err: any) {
      setEditError(err.message || 'Error al guardar.');
    } finally {
      setEditLoading(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const RegionChecklist = ({
    regions, selected, onToggle, allChecked, onAllChange, disabled = false
  }: {
    regions: string[];
    selected: string[];
    onToggle: (r: string) => void;
    allChecked: boolean;
    onAllChange: (c: boolean) => void;
    disabled?: boolean;
  }) => (
    <div className="space-y-2">
      <div
        onClick={() => !disabled && onAllChange(!allChecked)}
        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${allChecked ? 'border-amber-500 bg-amber-500/5' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${allChecked ? 'bg-amber-500 border-amber-500' : 'border-gray-300'}`}>
          {allChecked && <Check className="h-3 w-3 text-white" />}
        </div>
        <span className="text-sm font-semibold text-gray-800">Todas las regiones</span>
        <MapPin className="h-4 w-4 text-amber-500 opacity-60 ml-auto" />
      </div>
      <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
        {regions.map(region => {
          const checked = allChecked || selected.includes(region);
          return (
            <div key={region} onClick={() => !allChecked && !disabled && onToggle(region)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all text-sm ${checked ? 'border-amber-500/30 bg-amber-500/5' : 'border-gray-100 hover:border-gray-200'} ${allChecked ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-amber-500 border-amber-500' : 'border-gray-300'}`}>
                {checked && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              <span className="text-gray-700 text-xs">{region}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (authLoading || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-graphik" style={{ background: 'hsl(0 0% 100%)' }}>
      {/* Topbar */}
      <header className="border-b border-border sticky top-0 z-10" style={{ background: 'hsl(0 0% 98%)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={geodudexLogo} alt="Geodude X" className="h-9 w-auto object-contain" />
            <div className="flex items-center">
              <span className="text-muted-foreground mx-2">·</span>
              <span className="text-sm text-muted-foreground">Panel de Administrador</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-gray-700">{user?.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 text-xs gap-1.5">
              <Map className="h-3.5 w-3.5" /> Ir al mapa
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-gray-500 hover:text-red-600 text-xs gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left column - Create user */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-7 py-6 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl"><UserPlus className="h-5 w-5 text-primary" /></div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Crear nuevo usuario</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Asigna permisos y regiones de acceso</p>
                  </div>
                </div>
              </div>
              <form onSubmit={handleCreateUser} className="px-7 py-6 space-y-5">
                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="user-email" className="text-sm font-medium text-gray-700">Correo electrónico</Label>
                  <Input id="user-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" required className="h-11 rounded-xl border-gray-200 bg-gray-50/50 text-sm" />
                </div>
                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="user-password" className="text-sm font-medium text-gray-700">Contraseña inicial</Label>
                  <div className="relative">
                    <Input id="user-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required className="h-11 rounded-xl border-gray-200 bg-gray-50/50 text-sm pr-11" />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {/* Permissions */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">Permisos de acceso</Label>
                  <div onClick={() => handleAllPerms(!allPerms)} className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${allPerms ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${allPerms ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                      {allPerms && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">Acceso completo</p>
                      <p className="text-xs text-gray-400">Todos los permisos disponibles</p>
                    </div>
                    <Shield className="h-4 w-4 text-primary opacity-60" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400">o selecciona individualmente</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {ALL_PERMISSIONS.map(perm => {
                      const checked = allPerms || selectedPermissions.includes(perm);
                      return (
                        <div key={perm} onClick={() => !allPerms && togglePermission(perm)} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${checked ? 'border-primary/30 bg-primary/5' : 'border-gray-100 hover:border-gray-200 bg-gray-50/20'} ${allPerms ? 'opacity-60 cursor-not-allowed' : ''}`}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-primary border-primary' : 'border-gray-300'} ${allPerms ? 'opacity-60' : ''}`}>
                            {checked && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <span className="text-sm text-gray-700">{PERMISSION_LABELS[perm]}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-gray-300 ml-auto" />
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Regions */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">Regiones autorizadas</Label>
                  <RegionChecklist
                    regions={allRegionNames}
                    selected={selectedRegiones}
                    onToggle={toggleRegion}
                    allChecked={allRegiones}
                    onAllChange={handleAllRegiones}
                  />
                </div>

                {/* Feedback */}
                {error && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-600">{error}</p>
                    <button type="button" onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
                {success && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-green-50 border border-green-100 rounded-xl">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-green-700">{success}</p>
                    <button type="button" onClick={() => setSuccess('')} className="ml-auto text-green-400 hover:text-green-600"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}

                <Button type="submit" disabled={isLoading} className="w-full h-11 rounded-xl font-semibold text-sm bg-primary hover:bg-primary/90">
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Creando usuario...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Crear usuario</div>
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Right column - user list */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm text-gray-900">Usuarios registrados</h3>
                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-auto">{users.length}</span>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Buscar por email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 rounded-xl border-gray-200 bg-gray-50/50 text-xs"
                />
              </div>

              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {filteredUsers.map(u => (
                    <div key={u.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-800 truncate">{u.email}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {u.ultima_conexion ? `Última conexión: ${new Date(u.ultima_conexion).toLocaleString('es-CL')}` : 'Sin conexión'}
                          </p>
                        </div>
                        <button
                          onClick={() => openEditUser(u)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                          title="Editar permisos"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {u.permisos.slice(0, 3).map(p => (
                          <span key={p} className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-md font-medium">
                            {p === 'all' ? 'Acceso completo' : PERMISSION_LABELS[p as Permission] || p}
                          </span>
                        ))}
                        {u.permisos.length > 3 && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md">+{u.permisos.length - 3}</span>
                        )}
                      </div>
                      {u.regiones_permitidas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {u.regiones_permitidas.slice(0, 2).map(r => (
                            <span key={r} className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md font-medium">
                              {r}
                            </span>
                          ))}
                          {u.regiones_permitidas.length > 2 && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md">+{u.regiones_permitidas.length - 2} regiones</span>
                          )}
                        </div>
                      )}
                      {u.regiones_permitidas.length === 0 && (
                        <span className="text-[9px] text-amber-600 mt-1 inline-block">Todas las regiones</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Pencil className="h-5 w-5 text-primary" />
              Editar permisos
            </DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-5">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm font-medium text-gray-800">{editUser.email}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">ID: {editUser.id.slice(0, 8)}...</p>
              </div>

              {/* Permissions */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Permisos</Label>
                <div onClick={() => { setEditAllPerms(!editAllPerms); if (!editAllPerms) setEditPerms([...ALL_PERMISSIONS]); else setEditPerms([]); }}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${editAllPerms ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${editAllPerms ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                    {editAllPerms && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-sm font-semibold text-gray-800">Acceso completo</span>
                  <Shield className="h-4 w-4 text-primary opacity-60 ml-auto" />
                </div>
                <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
                  {ALL_PERMISSIONS.map(perm => {
                    const checked = editAllPerms || editPerms.includes(perm);
                    return (
                      <div key={perm} onClick={() => !editAllPerms && setEditPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm])}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all text-sm ${checked ? 'border-primary/30 bg-primary/5' : 'border-gray-100 hover:border-gray-200'} ${editAllPerms ? 'opacity-60 cursor-not-allowed' : ''}`}>
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
                <RegionChecklist
                  regions={allRegionNames}
                  selected={editRegiones}
                  onToggle={(r) => setEditRegiones(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                  allChecked={editAllRegiones}
                  onAllChange={(c) => { setEditAllRegiones(c); if (c) setEditRegiones([...allRegionNames]); else setEditRegiones([]); }}
                />
              </div>

              {editError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600">{editError}</p>
                </div>
              )}
              {editSuccess && (
                <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-xl">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-green-700">{editSuccess}</p>
                </div>
              )}

              <Button onClick={handleSaveEdit} disabled={editLoading} className="w-full h-10 rounded-xl font-semibold text-sm">
                {editLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </div>
                ) : 'Guardar cambios'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
