import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { externalSupabase as supabase } from '@/integrations/supabase/externalClient';

export type Permission =
  | 'capas'
  | 'regiones_comunas'
  | 'medioambiente'
  | 'plan_regulador'
  | 'proyectos'
  | 'busqueda_general'
  | 'consulta_ia'
  | 'modulo_creacion_usuarios'
  | 'analizador_proyectos'
  | 'analisis_radial'
  | 'corredor_bioceanico'
  | 'innovation_dashboard';

export const ALL_PERMISSIONS: Permission[] = [
  'capas',
  'regiones_comunas',
  'medioambiente',
  'plan_regulador',
  'proyectos',
  'busqueda_general',
  'consulta_ia',
  'modulo_creacion_usuarios',
  'analizador_proyectos',
  'analisis_radial',
  'corredor_bioceanico',
  'innovation_dashboard',
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  capas: 'Capas',
  regiones_comunas: 'Regiones y Comunas',
  medioambiente: 'Medioambiente',
  plan_regulador: 'Plan Regulador',
  proyectos: 'Proyectos',
  busqueda_general: 'Búsqueda General',
  consulta_ia: 'Consulta a la IA',
  modulo_creacion_usuarios: 'Módulo de Creación de Usuarios',
  analizador_proyectos: 'Analizador de Proyectos',
  analisis_radial: 'Análisis Radial',
  corredor_bioceanico: 'Corredor Bioceánico',
  innovation_dashboard: 'Innovation Dashboard',
};

/**
 * Permissions excluded from non-admin plans.
 * Free users (and any non-admin plan) get everything EXCEPT these.
 */
const ADMIN_ONLY_PERMISSIONS: Permission[] = ['modulo_creacion_usuarios', 'innovation_dashboard'];

/**
 * Regions allowed for free plan users. Empty array = all regions.
 */
const FREE_PLAN_REGIONS = ['Tarapacá'];

/**
 * Derive permissions and allowed regions purely from the user's `plan` column.
 * - 'admin': full access to every permission and every region.
 * - anything else (default 'free'): all permissions except admin-only ones,
 *   restricted to the Tarapacá region.
 */
export function getPlanAccess(plan: string | null | undefined): {
  permissions: Permission[];
  regiones: string[];
} {
  const normalized = (plan || 'free').toString().toLowerCase();
  if (normalized === 'admin') {
    return { permissions: [...ALL_PERMISSIONS], regiones: [] };
  }
  return {
    permissions: ALL_PERMISSIONS.filter(p => !ADMIN_ONLY_PERMISSIONS.includes(p)),
    regiones: [...FREE_PLAN_REGIONS],
  };
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  permissions: Permission[];
  regionesPermitidas: string[];
  plan: string | null;
  isFreePlan: boolean;
  loading: boolean;
  hasPermission: (permission: Permission) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshPermissions: (userId?: string) => Promise<void>;
  setLocalPermissions: (permissions: Permission[], regiones: string[], userId?: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [regionesPermitidas, setRegionesPermitidas] = useState<string[]>([]);
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const permissionRequestRef = useRef(0);
  const optimisticPermissionsRef = useRef<{
    userId?: string;
    permissions: Permission[];
    regiones: string[];
    expiresAt: number;
  } | null>(null);

  const applyOptimisticPermissions = (userId: string) => {
    const optimistic = optimisticPermissionsRef.current;
    if (!optimistic || optimistic.expiresAt <= Date.now() || (optimistic.userId && optimistic.userId !== userId)) {
      return false;
    }
    setPermissions(optimistic.permissions);
    setRegionesPermitidas(optimistic.regiones);
    return true;
  };

  const fetchPermissions = async (userId: string) => {
    if (!supabase) return;
    const requestId = permissionRequestRef.current + 1;
    permissionRequestRef.current = requestId;
    try {
      const { data, error } = await supabase
        .from('usuarios_perfiles')
        .select('plan, activo')
        .eq('id', userId)
        .single();

      if (requestId !== permissionRequestRef.current) return;

      if (error || !data || !data.activo) {
        if (applyOptimisticPermissions(userId)) return;
        setPermissions([]);
        setRegionesPermitidas([]);
        setPlan(null);
        return;
      }

      // Derive permissions and allowed regions from the user's `plan`.
      const normalizedPlan = (data.plan || 'free').toString().toLowerCase();
      const { permissions: derivedPerms, regiones: derivedRegiones } = getPlanAccess(normalizedPlan);

      setPermissions(derivedPerms);
      setRegionesPermitidas(derivedRegiones);
      setPlan(normalizedPlan);
      optimisticPermissionsRef.current = null;

      // Update ultima_conexion
      await supabase
        .from('usuarios_perfiles')
        .update({ ultima_conexion: new Date().toISOString() })
        .eq('id', userId);
    } catch (err) {
      console.error('Error fetching permissions:', err);
      if (requestId !== permissionRequestRef.current) return;
      if (applyOptimisticPermissions(userId)) return;
      setPermissions([]);
      setRegionesPermitidas([]);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            if (isMounted) fetchPermissions(session.user.id);
          }, 0);
        } else {
          optimisticPermissionsRef.current = null;
          setPermissions([]);
          setRegionesPermitidas([]);
        }
      }
    );

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchPermissions(session.user.id);
        }
      } catch (error) {
        console.error('Error during initial auth load:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase not configured') };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.session?.user) {
      setSession(data.session);
      setUser(data.session.user);
      await fetchPermissions(data.session.user.id);
    }
    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    // Clear responsible-use notice session flag so it shows again on next login
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('gdudex:responsible-use-accepted'))
      .forEach(k => sessionStorage.removeItem(k));
  };

  const hasPermission = (permission: Permission) => permissions.includes(permission);

  const refreshPermissions = async (userId?: string) => {
    if (!supabase) return;
    const targetUserId = userId ?? user?.id ?? (await supabase.auth.getSession()).data.session?.user?.id;
    if (targetUserId) await fetchPermissions(targetUserId);
  };

  const setLocalPermissions = (nextPermissions: Permission[], nextRegiones: string[], userId?: string) => {
    permissionRequestRef.current += 1;
    const sanitizedPermissions = nextPermissions.filter((p): p is Permission => ALL_PERMISSIONS.includes(p));
    optimisticPermissionsRef.current = {
      userId: userId ?? user?.id,
      permissions: sanitizedPermissions,
      regiones: nextRegiones,
      expiresAt: Date.now() + 30000,
    };
    setPermissions(sanitizedPermissions);
    setRegionesPermitidas(nextRegiones);
  };

  return (
    <AuthContext.Provider value={{ user, session, permissions, regionesPermitidas, loading, hasPermission, signIn, signOut, refreshPermissions, setLocalPermissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
