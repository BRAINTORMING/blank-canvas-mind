// Monitoreo Territorial — Mapbox layer manager for weather variables.
// Cada variable escalar se renderiza como una superficie continua (raster
// interpolado) vía ContinuousFieldLayer. El viento se maneja aparte
// (WindAnimation.ts) y FIRMS también (puntos, no campo continuo).
import type mapboxgl from "mapbox-gl";
import { LAYER_DEFS, FIRE_RISK_STOPS, type MonitoringLayerId } from "@/lib/monitoring/palettes";
import { WeatherService, FireRiskService, type GridResponse, type PointWeather } from "@/services/monitoring/WeatherService";
import { ContinuousFieldLayer } from "@/services/monitoring/ContinuousFieldLayer";

export class WeatherLayerManager {
  private map: mapboxgl.Map;
  private grid: GridResponse | null = null;
  private hourOffset = 0;
  private active = new Set<MonitoringLayerId>();
  private pendingGridFetch: Promise<void> | null = null;
  private fields = new Map<MonitoringLayerId, ContinuousFieldLayer>();

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
    this.grid = null;
    this.pendingGridFetch = null;
    if (this.active.size > 0) {
      this.ensureGrid().then(() => {
        for (const l of this.active) this.renderLayer(l);
      });
    }
  }

  private async ensureGrid() {
    if (this.grid) return;
    if (this.pendingGridFetch) return this.pendingGridFetch;
    const b = this.map.getBounds();
    if (!b) return;
    const bbox: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const dx = (bbox[2] - bbox[0]) * 0.1, dy = (bbox[3] - bbox[1]) * 0.1;
    const padded: [number, number, number, number] = [bbox[0] - dx, bbox[1] - dy, bbox[2] + dx, bbox[3] + dy];
    this.pendingGridFetch = WeatherService.grid(padded, 8, 8)
      .then(g => { this.grid = g; })
      .catch(err => { console.error("[monitoring] grid fetch failed", err); })
      .finally(() => { this.pendingGridFetch = null; });
    return this.pendingGridFetch;
  }

  private renderLayer(layer: MonitoringLayerId) {
    if (!this.grid) return;
    if (layer === "wind" || layer === "firms") return; // manejados aparte

    const { cols, rows, bbox, grid: cells } = this.grid;
    const values = new Float32Array(rows * cols).fill(NaN);

    for (let idx = 0; idx < cells.length; idx++) {
      const h = cells[idx].hourly;
      if (!h) continue;
      const hIdx = Math.min(this.hourOffset, (h.time?.length ?? 1) - 1);
      const raw: PointWeather = {
        temperature_2m: h.temperature_2m?.[hIdx] ?? null,
        relative_humidity_2m: h.relative_humidity_2m?.[hIdx] ?? null,
        wind_speed_10m: h.wind_speed_10m?.[hIdx] ?? null,
        wind_direction_10m: h.wind_direction_10m?.[hIdx] ?? null,
        rain: h.rain?.[hIdx] ?? null,
        cloud_cover: h.cloud_cover?.[hIdx] ?? null,
        pressure_msl: h.pressure_msl?.[hIdx] ?? null,
        uv_index: h.uv_index?.[hIdx] ?? null,
        shortwave_radiation: h.shortwave_radiation?.[hIdx] ?? null,
      };

      let v: number | null = null;
      if (layer === "fireRisk") {
        v = FireRiskService.compute(raw).score;
      } else {
        const def = LAYER_DEFS[layer as keyof typeof LAYER_DEFS];
        if (def) v = (raw as any)[def.variable];
      }
      if (v != null && Number.isFinite(v)) values[idx] = v;
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

  getGrid() { return this.grid; }
  destroy() {
    for (const l of Array.from(this.active)) this.removeLayer(l);
    this.active.clear();
  }
}
