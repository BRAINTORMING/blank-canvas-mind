import { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON } from '@/integrations/supabase/externalClient';

const LOG_PREFIX = '[SessionTracking]';

// Map UI capa names to DB column names
const CAPA_COLUMN_MAP: Record<string, string> = {
  'Desalinizadora': 'capa_desalinizadora',
  'Estación de Carga': 'capa_estacion_de_carga',
  'Estacion de Carga': 'capa_estacion_de_carga',
  'Minería': 'capa_mineria',
  'Mineria': 'capa_mineria',
  'Terminales': 'capa_terminales',
  'Monumentos Nacionales': 'capa_monumentos_nacionales',
};

const ALL_CAPA_COLS = [...new Set(Object.values(CAPA_COLUMN_MAP))];

const MODULE_COLUMNS = ['proyectos', 'medioambiente', 'plan_regulador'] as const;
type ModuleName = typeof MODULE_COLUMNS[number];

interface SessionData {
  loginTime: Date | null;
  activeCapas: Set<string>;
  activeModules: Set<ModuleName>;
  capaStartTimes: Record<string, number>;
  moduleStartTimes: Record<string, number>;
  capaAccumulatedMs: Record<string, number>;
  moduleAccumulatedMs: Record<string, number>;
  capaUsed: Set<string>;
  moduleUsed: Set<ModuleName>;
  recomiendaApp: boolean | null;
  recomendationDate: string | null;
}

interface SessionTrackingContextType {
  trackCapas: (capaNames: string[]) => void;
  trackModule: (module: ModuleName, active: boolean) => void;
  setVote: (like: boolean | null) => void;
  getVote: () => boolean | null;
}

const SessionTrackingContext = createContext<SessionTrackingContextType | null>(null);

function createEmptySession(): SessionData {
  return {
    loginTime: null,
    activeCapas: new Set(),
    activeModules: new Set(),
    capaStartTimes: {},
    moduleStartTimes: {},
    capaAccumulatedMs: {},
    moduleAccumulatedMs: {},
    capaUsed: new Set(),
    moduleUsed: new Set(),
    recomiendaApp: null,
    recomendationDate: null,
  };
}

function msToInterval(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function buildRow(session: SessionData, userEmail: string, now: number): Record<string, any> {
  session.activeCapas.forEach(col => {
    if (session.capaStartTimes[col]) {
      session.capaAccumulatedMs[col] = (session.capaAccumulatedMs[col] || 0) + (now - session.capaStartTimes[col]);
      delete session.capaStartTimes[col];
    }
  });
  session.activeModules.forEach(mod => {
    if (session.moduleStartTimes[mod]) {
      session.moduleAccumulatedMs[mod] = (session.moduleAccumulatedMs[mod] || 0) + (now - session.moduleStartTimes[mod]);
      delete session.moduleStartTimes[mod];
    }
  });

  const sessionDurationMs = now - (session.loginTime?.getTime() || now);

  const row: Record<string, any> = {
    user_id: userEmail,
    login_time: session.loginTime?.toISOString(),
    logout_time: new Date(now).toISOString(),
    sesion_duration: msToInterval(sessionDurationMs),
  };

  for (const col of ALL_CAPA_COLS) {
    row[col] = session.capaUsed.has(col);
    row[`${col}_time`] = msToInterval(session.capaAccumulatedMs[col] || 0);
  }

  for (const mod of MODULE_COLUMNS) {
    row[mod] = session.moduleUsed.has(mod);
    row[`${mod}_time`] = msToInterval(session.moduleAccumulatedMs[mod] || 0);
  }

  if (session.recomiendaApp !== null) {
    row.recomienda_app = session.recomiendaApp;
    row.recomendation_date = session.recomendationDate;
  }

  return row;
}

// Async send
async function sendToSupabase(row: Record<string, any>): Promise<boolean> {
  const url = `${EXTERNAL_SUPABASE_URL}/rest/v1/usuarios_sesiones`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': EXTERNAL_SUPABASE_ANON,
    'Authorization': `Bearer ${EXTERNAL_SUPABASE_ANON}`,
    'Prefer': 'return=minimal',
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(row),
      keepalive: true,
    });
    if (!res.ok) {
      console.error(LOG_PREFIX, `POST failed ${res.status}:`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(LOG_PREFIX, 'fetch error:', err);
    return false;
  }
}

// Beacon send for unload
function sendToSupabaseBeacon(row: Record<string, any>) {
  const url = `${EXTERNAL_SUPABASE_URL}/rest/v1/usuarios_sesiones`;
  const blob = new Blob([JSON.stringify(row)], { type: 'application/json' });
  navigator.sendBeacon(url, blob);
}

export function SessionTrackingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const sessionRef = useRef<SessionData>(createEmptySession());
  const isSendingRef = useRef(false);
  const userEmailRef = useRef<string>('');

  const flushSession = useCallback(async () => {
    const session = sessionRef.current;
    const userEmail = userEmailRef.current;
    if (!session.loginTime || !userEmail || isSendingRef.current) return;
    isSendingRef.current = true;

    const row = buildRow(session, userEmail, Date.now());
    await sendToSupabase(row);

    sessionRef.current = createEmptySession();
    isSendingRef.current = false;
  }, []);

  useEffect(() => {
    if (user?.email) {
      sessionRef.current = createEmptySession();
      sessionRef.current.loginTime = new Date();
      userEmailRef.current = user.email; // Guardar email en vez de ID
    } else if (sessionRef.current.loginTime) {
      flushSession();
    }
  }, [user, flushSession]);

  // Handle window/tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      const session = sessionRef.current;
      const userEmail = userEmailRef.current;
      if (!session.loginTime || !userEmail) return;

      const row = buildRow(session, userEmail, Date.now());
      sendToSupabaseBeacon(row);
      sessionRef.current = createEmptySession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const trackCapas = useCallback((capaNames: string[]) => {
    const session = sessionRef.current;
    if (!session.loginTime) return;

    const now = Date.now();
    const newActiveCols = new Set<string>();
    capaNames.forEach(name => {
      const col = CAPA_COLUMN_MAP[name];
      if (col) newActiveCols.add(col);
    });

    session.activeCapas.forEach(col => {
      if (!newActiveCols.has(col) && session.capaStartTimes[col]) {
        session.capaAccumulatedMs[col] = (session.capaAccumulatedMs[col] || 0) + (now - session.capaStartTimes[col]);
        delete session.capaStartTimes[col];
      }
    });

    newActiveCols.forEach(col => {
      if (!session.activeCapas.has(col)) {
        session.capaStartTimes[col] = now;
        session.capaUsed.add(col);
      }
    });

    session.activeCapas = newActiveCols;
  }, []);

  const trackModule = useCallback((module: ModuleName, active: boolean) => {
    const session = sessionRef.current;
    if (!session.loginTime) return;

    const now = Date.now();
    if (active && !session.activeModules.has(module)) {
      session.activeModules.add(module);
      session.moduleStartTimes[module] = now;
      session.moduleUsed.add(module);
    } else if (!active && session.activeModules.has(module)) {
      session.activeModules.delete(module);
      if (session.moduleStartTimes[module]) {
        session.moduleAccumulatedMs[module] = (session.moduleAccumulatedMs[module] || 0) + (now - session.moduleStartTimes[module]);
        delete session.moduleStartTimes[module];
      }
    }
  }, []);

  const setVote = useCallback((like: boolean | null) => {
    const session = sessionRef.current;
    session.recomiendaApp = like;
    session.recomendationDate = like !== null ? new Date().toISOString() : null;
  }, []);

  const getVote = useCallback(() => {
    return sessionRef.current.recomiendaApp;
  }, []);

  return (
    <SessionTrackingContext.Provider value={{ trackCapas, trackModule, setVote, getVote }}>
      {children}
    </SessionTrackingContext.Provider>
  );
}

export function useSessionTracking() {
  const ctx = useContext(SessionTrackingContext);
  if (!ctx) throw new Error('useSessionTracking must be used within SessionTrackingProvider');
  return ctx;
}
