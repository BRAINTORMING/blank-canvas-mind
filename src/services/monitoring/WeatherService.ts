// Monitoreo Territorial — WeatherService, FireRiskService, FirmsService.
// All external calls go through Supabase edge functions.
import { externalSupabase as supabase } from "@/integrations/supabase/externalClient";

export interface PointWeather {
  temperature_2m: number | null;
  relative_humidity_2m: number | null;
  wind_speed_10m: number | null;
  wind_direction_10m: number | null;
  rain: number | null;
  cloud_cover: number | null;
  pressure_msl: number | null;
  uv_index: number | null;
  shortwave_radiation: number | null;
}

export interface GridResponse {
  cols: number;
  rows: number;
  bbox: [number, number, number, number];
  grid: Array<{
    lat: number; lon: number;
    hourly: {
      time: string[];
      temperature_2m?: number[];
      relative_humidity_2m?: number[];
      wind_speed_10m?: number[];
      wind_direction_10m?: number[];
      rain?: number[];
      cloud_cover?: number[];
      pressure_msl?: number[];
      uv_index?: number[];
      shortwave_radiation?: number[];
    } | null;
  }>;
  generated_at: string;
}

const pointMem = new Map<string, { data: any; expiresAt: number }>();
const gridMem = new Map<string, { data: GridResponse; expiresAt: number }>();
const inflight = new Map<string, Promise<any>>();

function keyPoint(lat: number, lon: number) {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}
function keyGrid(bbox: number[], cols: number, rows: number) {
  return `${cols}x${rows}:${bbox.map(n => n.toFixed(2)).join(",")}`;
}

export const WeatherService = {
  async point(lat: number, lon: number): Promise<any> {
    const k = keyPoint(lat, lon);
    const hit = pointMem.get(k);
    if (hit && hit.expiresAt > Date.now()) return hit.data;
    if (inflight.has(k)) return inflight.get(k)!;
    const p = supabase.functions
      .invoke("weather-api", { body: { mode: "point", lat, lon } })
      .then(({ data, error }) => {
        if (error) throw error;
        pointMem.set(k, { data, expiresAt: Date.now() + 10 * 60_000 });
        return data;
      })
      .finally(() => inflight.delete(k));
    inflight.set(k, p);
    return p;
  },

  async grid(bbox: [number, number, number, number], cols = 8, rows = 8): Promise<GridResponse> {
    const k = keyGrid(bbox, cols, rows);
    const hit = gridMem.get(k);
    if (hit && hit.expiresAt > Date.now()) return hit.data;
    if (inflight.has(k)) return inflight.get(k)!;
    const p = supabase.functions
      .invoke("weather-api", { body: { mode: "grid", bbox, cols, rows } })
      .then(({ data, error }) => {
        if (error) throw error;
        gridMem.set(k, { data: data as GridResponse, expiresAt: Date.now() + 20 * 60_000 });
        return data as GridResponse;
      })
      .finally(() => inflight.delete(k));
    inflight.set(k, p);
    return p;
  },

  extractHour(grid: GridResponse, hourOffset: number): Array<{ lat: number; lon: number; values: PointWeather }> {
    const out: Array<{ lat: number; lon: number; values: PointWeather }> = [];
    for (const cell of grid.grid) {
      const h = cell.hourly;
      if (!h) continue;
      const idx = Math.min(hourOffset, (h.time?.length ?? 1) - 1);
      out.push({
        lat: cell.lat, lon: cell.lon,
        values: {
          temperature_2m: h.temperature_2m?.[idx] ?? null,
          relative_humidity_2m: h.relative_humidity_2m?.[idx] ?? null,
          wind_speed_10m: h.wind_speed_10m?.[idx] ?? null,
          wind_direction_10m: h.wind_direction_10m?.[idx] ?? null,
          rain: h.rain?.[idx] ?? null,
          cloud_cover: h.cloud_cover?.[idx] ?? null,
          pressure_msl: h.pressure_msl?.[idx] ?? null,
          uv_index: h.uv_index?.[idx] ?? null,
          shortwave_radiation: h.shortwave_radiation?.[idx] ?? null,
        },
      });
    }
    return out;
  },
};

// Normalized 0..1 fire-risk index and its category.
export const FireRiskService = {
  compute(v: {
    temperature_2m: number | null; relative_humidity_2m: number | null;
    wind_speed_10m: number | null; rain: number | null;
    shortwave_radiation: number | null; uv_index: number | null;
  }): { score: number; label: string; color: string } {
    const T = clamp((v.temperature_2m ?? 15) / 45, 0, 1);
    const Rad = clamp((v.shortwave_radiation ?? 0) / 1100, 0, 1);
    const UV = clamp((v.uv_index ?? 0) / 11, 0, 1);
    const W = clamp((v.wind_speed_10m ?? 0) / 60, 0, 1);
    const RH = clamp((v.relative_humidity_2m ?? 50) / 100, 0, 1);
    const R = clamp((v.rain ?? 0) / 10, 0, 1);
    const raw = 0.30 * T + 0.20 * Rad + 0.15 * UV + 0.20 * W - 0.25 * RH - 0.30 * R;
    const score = clamp((raw + 0.55) / 1.05, 0, 1);
    if (score < 0.30) return { score, label: "Muy Bajo", color: "#22c55e" };
    if (score < 0.50) return { score, label: "Bajo", color: "#facc15" };
    if (score < 0.70) return { score, label: "Moderado", color: "#f97316" };
    if (score < 0.90) return { score, label: "Alto", color: "#dc2626" };
    return { score, label: "Extremo", color: "#7e22ce" };
  },
};

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

const firmsMem = new Map<string, { data: any; expiresAt: number }>();
export const NASAFirmsService = {
  async fetchBBox(bbox: [number, number, number, number], days = 2) {
    const k = `${days}:${bbox.map(n => n.toFixed(2)).join(",")}`;
    const hit = firmsMem.get(k);
    if (hit && hit.expiresAt > Date.now()) return hit.data;
    const { data, error } = await supabase.functions.invoke("nasa-firms", {
      body: { bbox, days },
    });
    if (error) throw error;
    firmsMem.set(k, { data, expiresAt: Date.now() + 20 * 60_000 });
    return data;
  },
};
