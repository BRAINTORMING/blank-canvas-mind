// Monitoreo Territorial — WeatherService, FireRiskService, FirmsService.
// All external calls go through Supabase edge functions.
import { supabase } from "@/integrations/supabase/client";

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

  // Monitoreo Territorial — Mapbox layer manager para variables meteorológicas.
// Usa WeatherGridCache (grilla fija tipo tiles + cache) en vez de pedir una
// grilla nueva relativa al viewport cada vez.
import type mapboxgl from "mapbox-gl";
import { LAYER_DEFS, FIRE_RISK_STOPS, type MonitoringLayerId } from "@/lib/monitoring/palettes";
import { FireRiskService, type GridResponse } from "@/services/monitoring/WeatherService";
import { ContinuousFieldLayer } from "@/services/monitoring/ContinuousFieldLayer";
import { WeatherGridCache } from "@/services/monitoring/WeatherGridCache";

export class WeatherLayerManager {
  private map: mapboxgl.Map;
  private gridCache = new WeatherGridCache();
  private currentStep: number | null = null;
  private currentIxRange: [number, number] | null = null;
  private currentIyRange: [number, number] | null = null;
  private hourOffset = 0;
  private active = new Set<MonitoringLayerId>();
  private fields = new Map<MonitoringLayerId, ContinuousFieldLayer>();
  private pendingCoverage: Promise<void> | null = null;

  constructor(map: mapboxgl.Map) {
    this.map = map;
  }

  setActive(layer: MonitoringLayerId, on: boolean) {
    if (on) this.active.add(layer); else this.active.delete(layer);
    if (on) this.ensureGrid().then(() => this.renderLayer(layer));
    else this.removeLayer(layer);
  }

  setHourOffset(h: number) {
    this.hourOffset = h;
    for (const l of this.active) this.renderLayer(l);
  }

  currentHourOffset() { return this.hourOffset; }
  activeLayers(): MonitoringLayerId[] { return [...this.active]; }

  refreshForViewport() {
    this.pendingCoverage = null;
    if (this.active.size > 0) {
      this.ensureGrid().then(() => {
        for (const l of this.active) this.renderLayer(l);
      });
    }
  }

  private async ensureGrid() {
    if (this.pendingCoverage) return this.pendingCoverage;
    const b = this.map.getBounds();
    if (!b) return;
    const bbox: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const dx = (bbox[2] - bbox[0]) * 0.15, dy = (bbox[3] - bbox[1]) * 0.15;
    const padded: [number, number, number, number] = [bbox[0] - dx, bbox[1] - dy, bbox[2] + dx, bbox[3] + dy];
    this.pendingCoverage = this.gridCache.ensureCoverage(padded)
      .then(({ step, ixRange, iyRange }) => {
        this.currentStep = step;
        this.currentIxRange = ixRange;
        this.currentIyRange = iyRange;
      })
      .catch(err => console.error("[monitoring] coverage fetch failed", err))
      .finally(() => { this.pendingCoverage = null; });
    return this.pendingCoverage;
  }

  private renderLayer(layer: MonitoringLayerId) {
    if (layer === "wind" || layer === "firms") return;
    if (this.currentStep == null || !this.currentIxRange || !this.currentIyRange) return;

    const step = this.currentStep;
    const [ixMin, ixMax] = this.currentIxRange;
    const [iyMin, iyMax] = this.currentIyRange;
    const cols = ixMax - ixMin + 1;
    const rows = iyMax - iyMin + 1;
    const bbox: [number, number, number, number] = [ixMin * step, iyMin * step, ixMax * step, iyMax * step];

    const values = new Float32Array(rows * cols).fill(NaN);
    for (let iy = iyMin; iy <= iyMax; iy++) {
      for (let ix = ixMin; ix <= ixMax; ix++) {
        const idx = (iy - iyMin) * cols + (ix - ixMin);
        let v: number;
        if (layer === "fireRisk") {
          const h = this.gridCache.hourlyAt(step, ix, iy);
          if (!h) { v = NaN; }
          else {
            const hi = Math.min(this.hourOffset, (h.time?.length ?? 1) - 1);
            v = FireRiskService.compute({
              temperature_2m: h.temperature_2m?.[hi] ?? null,
              relative_humidity_2m: h.relative_humidity_2m?.[hi] ?? null,
              wind_speed_10m: h.wind_speed_10m?.[hi] ?? null,
              rain: h.rain?.[hi] ?? null,
              shortwave_radiation: h.shortwave_radiation?.[hi] ?? null,
              uv_index: h.uv_index?.[hi] ?? null,
            }).score;
          }
        } else {
          const def = LAYER_DEFS[layer as keyof typeof LAYER_DEFS];
          v = def ? this.gridCache.sample(step, ix, iy, def.variable, this.hourOffset) : NaN;
        }
        values[idx] = v;
      }
    }

    let field = this.fields.get(layer);
    if (!field) {
      const { min, max, stops } = this.spec(layer);
      field = new ContinuousFieldLayer(this.map, layer, stops, min, max);
      this.fields.set(layer, field);
    }
    field.render(values, cols, rows, bbox);
  }

  private spec(layer: MonitoringLayerId): { min: number; max: number; stops: any } {
    if (layer === "fireRisk") return { min: 0, max: 1, stops: FIRE_RISK_STOPS };
    const d = LAYER_DEFS[layer as keyof typeof LAYER_DEFS];
    return { min: d.min, max: d.max, stops: d.stops };
  }

  private removeLayer(layer: MonitoringLayerId) {
    const field = this.fields.get(layer);
    if (field) {
      field.remove();
      this.fields.delete(layer);
    }
  }

  /** Snapshot con la misma forma que antes (rows/cols/bbox/grid[]), construido
   *  al vuelo desde la grilla persistente — para no tocar WindAnimation.ts ni
   *  MonitoringController.tsx, que siguen esperando este formato. */
  getGrid(): GridResponse | null {
    if (this.currentStep == null || !this.currentIxRange || !this.currentIyRange) return null;
    const step = this.currentStep;
    const [ixMin, ixMax] = this.currentIxRange;
    const [iyMin, iyMax] = this.currentIyRange;
    const grid: GridResponse["grid"] = [];
    for (let iy = iyMin; iy <= iyMax; iy++) {
      for (let ix = ixMin; ix <= ixMax; ix++) {
        const hourly = this.gridCache.hourlyAt(step, ix, iy);
        grid.push({ lat: iy * step, lon: ix * step, hourly: hourly as any });
      }
    }
    return {
      cols: ixMax - ixMin + 1,
      rows: iyMax - iyMin + 1,
      bbox: [ixMin * step, iyMin * step, ixMax * step, iyMax * step],
      grid,
      generated_at: new Date().toISOString(),
    };
  }

  destroy() {
    for (const l of Array.from(this.active)) this.removeLayer(l);
    this.active.clear();
  }
}

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
