import { intervalToSeconds } from "./layers";

export interface SessionRow {
  id?: string | number;
  user_id: string; // email in this project
  login_time: string | null;
  logout_time: string | null;
  sesion_duration: string | null;
  recomienda_app: boolean | null;
  recomendation_date: string | null;
  feedback: string | null;
  feedback_date: string | null;
  [k: string]: unknown;
}

export interface ProfileRow {
  id: string;
  email: string;
  permisos: string[] | null;
  fecha_registro: string | null;
  ultima_conexion: string | null;
  activo: boolean | null;
  regiones_permitidas: string[] | null;
}

export interface LayerColumn {
  flag: string; // e.g. "capa_mineria"
  time: string; // e.g. "capa_mineria_time"
  key: string; // shortened: "mineria"
}

/** Inspect a sample row and discover layer columns (flag + matching _time column). */
export function discoverLayerColumns(sample: Record<string, unknown> | null | undefined): LayerColumn[] {
  if (!sample) return [];
  const keys = Object.keys(sample);
  const flags = keys.filter((k) => k.startsWith("capa_") && !k.endsWith("_time"));
  const out: LayerColumn[] = [];
  for (const flag of flags) {
    const time = `${flag}_time`;
    if (keys.includes(time)) {
      out.push({ flag, time, key: flag.replace(/^capa_/, "") });
    }
  }
  // Also include modules: proyectos, medioambiente, plan_regulador if present
  for (const mod of ["proyectos", "medioambiente", "plan_regulador"]) {
    const time = `${mod}_time`;
    if (keys.includes(mod) && keys.includes(time)) {
      out.push({ flag: mod, time, key: mod });
    }
  }
  return out;
}

export function sessionDurationSec(s: SessionRow): number {
  const fromCol = intervalToSeconds(s.sesion_duration);
  if (fromCol > 0) return fromCol;
  if (s.login_time && s.logout_time) {
    const a = new Date(s.login_time).getTime();
    const b = new Date(s.logout_time).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) return (b - a) / 1000;
  }
  return 0;
}

export function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function diffDays(a: Date, b: Date): number {
  return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

export function isoWeek(d: Date): string {
  // Returns ISO yyyy-Www
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ym(d: Date): string {
  return d.toISOString().slice(0, 7);
}
