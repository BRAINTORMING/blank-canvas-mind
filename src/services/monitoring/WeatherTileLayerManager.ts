// src/services/monitoring/WeatherTileLayerManager.ts

import type mapboxgl from "mapbox-gl";

const TILE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weather-tile`;

const TILE_READY_VARIABLES = new Set(["temperature"]);

export class WeatherTileLayerManager {
  private map: mapboxgl.Map;
  private hourOffset = 0;
  private active = new Set<string>();

  // evita repetir el prefetch
  private prefetched = new Set<string>();

  constructor(map: mapboxgl.Map) {
    this.map = map;
  }

  isTileReady(variable: string) {
    return TILE_READY_VARIABLES.has(variable);
  }

  async setActive(variable: string, on: boolean) {
    if (!this.isTileReady(variable)) return;

    if (on) {
      this.active.add(variable);

      if (!this.prefetched.has(variable)) {
        this.prefetched.add(variable);
        this.prefetchTiles(variable).catch(console.warn);
      }

      this.addLayer(variable);
    } else {
      this.active.delete(variable);
      this.removeLayer(variable);
    }
  }

  setHourOffset(h: number) {
    this.hourOffset = h;

    // Cambió la hora: volver a precargar para la nueva hora
    this.prefetched.clear();

    for (const v of this.active) {
      this.reloadTiles(v);
    }
  }

  private srcId(v: string) {
    return `weather-tile-src-${v}`;
  }

  private lyrId(v: string) {
    return `weather-tile-lyr-${v}`;
  }

  private tileUrl(variable: string, z: number, x: number, y: number) {
    return `${TILE_FN_URL}/${variable}/${z}/${x}/${y}?hour=${this.hourOffset}`;
  }

  /**
   * Precarga los tiles globales (zoom 0-4).
   * Son 341 tiles aprox.
   */
  private async prefetchTiles(variable: string) {
    const requests: Promise<any>[] = [];

    for (let z = 0; z <= 4; z++) {
      const max = 1 << z;

      for (let x = 0; x < max; x++) {
        for (let y = 0; y < max; y++) {
          requests.push(
            fetch(this.tileUrl(variable, z, x, y), {
              cache: "force-cache",
            }).catch(() => {})
          );
        }
      }
    }

    await Promise.allSettled(requests);

    console.info(
      `[WeatherTiles] Prefetch completado (${variable})`
    );
  }

  private addLayer(variable: string) {
    const srcId = this.srcId(variable);
    const lyrId = this.lyrId(variable);

    if (this.map.getSource(srcId)) return;

    this.map.addSource(srcId, {
      type: "raster",
      tiles: [
        `${TILE_FN_URL}/${variable}/{z}/{x}/{y}?hour=${this.hourOffset}`,
      ],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 12,
    });

    this.map.addLayer({
      id: lyrId,
      type: "raster",
      source: srcId,
      paint: {
        "raster-opacity": 0.72,
        "raster-fade-duration": 300,
        "raster-resampling": "linear",
      },
    });
  }

  private removeLayer(variable: string) {
    const srcId = this.srcId(variable);
    const lyrId = this.lyrId(variable);

    if (this.map.getLayer(lyrId))
      this.map.removeLayer(lyrId);

    if (this.map.getSource(srcId))
      this.map.removeSource(srcId);
  }

  private reloadTiles(variable: string) {
    if (!this.active.has(variable)) return;

    this.removeLayer(variable);
    this.addLayer(variable);
  }

  destroy() {
    for (const v of Array.from(this.active)) {
      this.removeLayer(v);
    }

    this.active.clear();
    this.prefetched.clear();
  }
}
