// src/services/monitoring/WeatherTileLayerManager.ts
//
// Estrategia:
// - Un único Source raster por variable, con `refreshExpiredTiles:false` y
//   `volatile:false` para que Mapbox reutilice las tiles ya descargadas
//   durante toda la sesión (comportamiento tipo Windy / Google Maps).
// - Prefetch progresivo z=0..3 para cubrir el planeta desde el inicio.
// - Al cambiar de hora NO se elimina el Source: se llama a `setTiles([...])`
//   para reemplazar la URL sin perder los tiles en pantalla mientras
//   se cargan los nuevos.
// - Cache HTTP nativo (Cache-Control del edge) + `cache:"force-cache"`
//   en el prefetch para minimizar solicitudes repetidas.

import type mapboxgl from "mapbox-gl";

const TILE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weather-tile`;

const TILE_READY_VARIABLES = new Set(["temperature"]);

// Nivel global de prefetch. z=0..3 => 1+4+16+64 = 85 tiles.
// Cubre el planeta entero, es barato y evita "zonas vacías" al hacer pan.
const PREFETCH_MAX_ZOOM = 3;

export class WeatherTileLayerManager {
  private map: mapboxgl.Map;
  private hourOffset = 0;
  private active = new Set<string>();

  // Evita repetir el prefetch para la misma variable+hora.
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
      this.addLayer(variable);
      this.schedulePrefetch(variable);
    } else {
      this.active.delete(variable);
      this.removeLayer(variable);
    }
  }

  setHourOffset(h: number) {
    if (this.hourOffset === h) return;
    this.hourOffset = h;

    // Reemplazamos la URL sin destruir el Source: mantiene los tiles
    // actuales visibles mientras Mapbox descarga los nuevos.
    for (const v of this.active) {
      const src = this.map.getSource(this.srcId(v)) as
        | (mapboxgl.RasterTileSource & { setTiles?: (t: string[]) => void })
        | undefined;
      if (src && typeof src.setTiles === "function") {
        src.setTiles([this.tilePattern(v)]);
      } else {
        // Fallback: recrear si el source no expone setTiles.
        this.removeLayer(v);
        this.addLayer(v);
      }
      this.schedulePrefetch(v);
    }
  }

  private srcId(v: string) {
    return `weather-tile-src-${v}`;
  }

  private lyrId(v: string) {
    return `weather-tile-lyr-${v}`;
  }

  private tilePattern(variable: string) {
    return `${TILE_FN_URL}/${variable}/{z}/{x}/{y}?hour=${this.hourOffset}`;
  }

  private tileUrl(variable: string, z: number, x: number, y: number) {
    return `${TILE_FN_URL}/${variable}/${z}/${x}/${y}?hour=${this.hourOffset}`;
  }

  private schedulePrefetch(variable: string) {
    const key = `${variable}:${this.hourOffset}`;
    if (this.prefetched.has(key)) return;
    this.prefetched.add(key);

    // No bloqueamos el hilo principal; disparamos en idle para no competir
    // con el render inicial.
    const run = () => this.prefetchGlobalTiles(variable).catch(() => {});
    if (typeof (window as any).requestIdleCallback === "function") {
      (window as any).requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 250);
    }
  }

  private async prefetchGlobalTiles(variable: string) {
    // Prefetch por niveles, del más bajo al más alto: primero cubrimos
    // el globo, luego afinamos. Cada nivel espera al anterior para no
    // saturar la red.
    for (let z = 0; z <= PREFETCH_MAX_ZOOM; z++) {
      const max = 1 << z;
      const batch: Promise<unknown>[] = [];
      for (let x = 0; x < max; x++) {
        for (let y = 0; y < max; y++) {
          batch.push(
            fetch(this.tileUrl(variable, z, x, y), { cache: "force-cache" }).catch(() => {}),
          );
        }
      }
      await Promise.allSettled(batch);
    }
    console.info(`[WeatherTiles] Prefetch z=0..${PREFETCH_MAX_ZOOM} listo (${variable})`);
  }

  private addLayer(variable: string) {
    const srcId = this.srcId(variable);
    const lyrId = this.lyrId(variable);

    if (this.map.getSource(srcId)) return;

    this.map.addSource(srcId, {
      type: "raster",
      tiles: [this.tilePattern(variable)],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 12,
      // Reutiliza tiles ya descargados durante toda la sesión:
      // no re-descarga cuando el usuario vuelve a una zona.
      volatile: false,
    } as mapboxgl.RasterSourceSpecification);

    this.map.addLayer({
      id: lyrId,
      type: "raster",
      source: srcId,
      paint: {
        "raster-opacity": 0.72,
        "raster-fade-duration": 200,
        "raster-resampling": "linear",
      },
    });
  }

  private removeLayer(variable: string) {
    const srcId = this.srcId(variable);
    const lyrId = this.lyrId(variable);

    if (this.map.getLayer(lyrId)) this.map.removeLayer(lyrId);
    if (this.map.getSource(srcId)) this.map.removeSource(srcId);
  }

  destroy() {
    for (const v of Array.from(this.active)) this.removeLayer(v);
    this.active.clear();
    this.prefetched.clear();
  }
}
