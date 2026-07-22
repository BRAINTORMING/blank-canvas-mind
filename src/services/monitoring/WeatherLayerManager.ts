// Monitoreo Territorial — Mapbox layer manager for weather variables.
// Each variable is a Mapbox `heatmap` layer (WebGL under the hood) fed from a
// grid of samples. Wind is a canvas particle overlay (see WindAnimation.ts).
import type mapboxgl from "mapbox-gl";
import { LAYER_DEFS, FIRE_RISK_STOPS, mapboxHeatmapColor, type MonitoringLayerId } from "@/lib/monitoring/palettes";
import { WeatherService, FireRiskService, type GridResponse, type PointWeather } from "@/services/monitoring/WeatherService";

type HeatmapVar = "temperature" | "solar" | "uv" | "humidity" | "rain" | "cloud" | "pressure" | "fireRisk";

const SRC_PREFIX = "monitoring-src-";
const LYR_PREFIX = "monitoring-lyr-";

export class WeatherLayerManager {
  private map: mapboxgl.Map;
  private grid: GridResponse | null = null;
  private hourOffset = 0;
  private active = new Set<MonitoringLayerId>();
  private pendingGridFetch: Promise<void> | null = null;

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
    // re-render all active heatmaps with new hour
    for (const l of this.active) this.renderLayer(l);
  }

  currentHourOffset() { return this.hourOffset; }
  activeLayers(): MonitoringLayerId[] { return [...this.active]; }

  refreshForViewport() {
    // refetch grid based on new viewport
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
    // Expand slightly to avoid edge artifacts
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
    if (layer === "wind" || layer === "firms") return; // handled elsewhere

    const samples = WeatherService.extractHour(this.grid, this.hourOffset);
    const features = samples
      .map(s => this.toFeature(layer, s))
      .filter((f): f is GeoJSON.Feature => Boolean(f));

    const srcId = SRC_PREFIX + layer;
    const lyrId = LYR_PREFIX + layer;
    const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };
    const src = this.map.getSource(srcId) as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(fc);
      return;
    }

    this.map.addSource(srcId, { type: "geojson", data: fc });

    const { min, max, stops } = this.spec(layer);
    this.map.addLayer({
      id: lyrId,
      type: "heatmap",
      source: srcId,
      maxzoom: 15,
      paint: {
        "heatmap-weight": [
          "interpolate", ["linear"], ["get", "value"],
          min, 0,
          max, 1,
        ],
        "heatmap-intensity": [
          "interpolate", ["linear"], ["zoom"],
          0, 0.8,
          6, 1.4,
          12, 2.2,
        ],
        "heatmap-color": mapboxHeatmapColor(stops, min, max),
        "heatmap-radius": [
          "interpolate", ["linear"], ["zoom"],
          0, 20,
          4, 60,
          8, 110,
          12, 180,
        ],
        "heatmap-opacity": 0.72,
      },
    });
  }

  private toFeature(layer: MonitoringLayerId, s: { lat: number; lon: number; values: PointWeather }): GeoJSON.Feature | null {
    let v: number | null = null;
    if (layer === "fireRisk") {
      v = FireRiskService.compute(s.values).score;
    } else {
      const def = LAYER_DEFS[layer as keyof typeof LAYER_DEFS];
      if (!def) return null;
      v = (s.values as any)[def.variable];
    }
    if (v == null || !Number.isFinite(v)) return null;
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: { value: v },
    };
  }

  private spec(layer: MonitoringLayerId): { min: number; max: number; stops: any } {
    if (layer === "fireRisk") return { min: 0, max: 1, stops: FIRE_RISK_STOPS };
    const d = LAYER_DEFS[layer as keyof typeof LAYER_DEFS];
    return { min: d.min, max: d.max, stops: d.stops };
  }

  private removeLayer(layer: MonitoringLayerId) {
    const srcId = SRC_PREFIX + layer;
    const lyrId = LYR_PREFIX + layer;
    if (this.map.getLayer(lyrId)) this.map.removeLayer(lyrId);
    if (this.map.getSource(srcId)) this.map.removeSource(srcId);
  }

  getGrid() { return this.grid; }
  destroy() {
    for (const l of Array.from(this.active)) this.removeLayer(l);
    this.active.clear();
  }
}
