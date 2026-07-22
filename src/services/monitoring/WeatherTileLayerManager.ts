// src/services/monitoring/WeatherTileLayerManager.ts
// Capas de tiles raster XYZ servidas por weather-tile. Reemplaza, solo
// para las variables ya migradas, el pipeline de canvas único
// (WeatherLayerManager + ContinuousFieldLayer), que sigue intacto y se
// sigue usando para viento y el resto de variables mientras se migran.
import type mapboxgl from "mapbox-gl";

const TILE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weather-tile`;

// Variables ya servidas por weather-tile. Sumar acá a medida que se migren.
const TILE_READY_VARIABLES = new Set(["temperature"]);

export class WeatherTileLayerManager {
  private map: mapboxgl.Map;
  private hourOffset = 0;
  private active = new Set<string>();

  constructor(map: mapboxgl.Map) { this.map = map; }

  isTileReady(variable: string) { return TILE_READY_VARIABLES.has(variable); }

  setActive(variable: string, on: boolean) {
    if (!this.isTileReady(variable)) return;
    if (on) { this.active.add(variable); this.addLayer(variable); }
    else { this.active.delete(variable); this.removeLayer(variable); }
  }

  setHourOffset(h: number) {
    this.hourOffset = h;
    for (const v of this.active) this.reloadTiles(v);
  }

  private srcId(v: string) { return `weather-tile-src-${v}`; }
  private lyrId(v: string) { return `weather-tile-lyr-${v}`; }

  private addLayer(variable: string) {
    const srcId = this.srcId(variable), lyrId = this.lyrId(variable);
    if (this.map.getSource(srcId)) return;
    this.map.addSource(srcId, {
      type: "raster",
      tiles: [`${TILE_FN_URL}/${variable}/{z}/{x}/{y}?hour=${this.hourOffset}`],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 12,
    });
    this.map.addLayer({
      id: lyrId,
      type: "raster",
      source: srcId,
      paint: { "raster-opacity": 0.72, "raster-fade-duration": 300, "raster-resampling": "linear" },
    });
  }

  private removeLayer(variable: string) {
    const srcId = this.srcId(variable), lyrId = this.lyrId(variable);
    if (this.map.getLayer(lyrId)) this.map.removeLayer(lyrId);
    if (this.map.getSource(srcId)) this.map.removeSource(srcId);
  }

  private reloadTiles(variable: string) {
    if (!this.active.has(variable)) return;
    this.removeLayer(variable);
    this.addLayer(variable);
  }

  destroy() {
    for (const v of Array.from(this.active)) this.removeLayer(v);
    this.active.clear();
  }
}
