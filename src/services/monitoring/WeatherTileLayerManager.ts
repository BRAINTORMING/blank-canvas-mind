// src/services/monitoring/WeatherTileLayerManager.ts
//
// Estrategia (tipo Google Earth / Windy):
// - Por variable se montan DOS Sources/Layers raster, no uno:
//   1) "base": pirámide global z=0..BASE_MAX_ZOOM (barata, ~85 tiles).
//      Se prefetchea al iniciar y Mapbox la mantiene SIEMPRE visible en
//      cualquier punto del planeta gracias a su "overzoom" nativo (si pedís
//      un zoom mayor a `maxzoom` del source, Mapbox estira el último nivel
//      disponible en vez de dejar un hueco). Así nunca hay zonas vacías,
//      sin necesidad de tener el planeta entero en máxima resolución.
//   2) "detail": minzoom=DETAIL_MIN_ZOOM, sin prefetch. Mapbox la pide sola,
//      de forma nativa, únicamente para la zona/zoom que el usuario está
//      mirando en ese momento — resolución creciente solo cuando hacés zoom,
//      nunca antes.
// - `refreshExpiredTiles:false`-like (volatile:false) para que Mapbox
//   reutilice tiles ya descargados durante toda la sesión.
// - Al cambiar de hora NO se elimina ningún Source: se llama a
//   `setTiles([...])` para reemplazar la URL sin perder los tiles en
//   pantalla mientras se cargan los nuevos.
//
// FIX (2026-07-23): la base pyramid nunca terminaba de mostrarse.
// Causa: prefetchBaseTiles() disparaba TODO un nivel de zoom en paralelo
// (64 requests simultáneos en z=3) justo cuando Mapbox también estaba
// pidiendo los tiles del viewport actual -> ráfaga de ~65-100 requests
// concurrentes contra el edge function -> timeouts en cascada (ver logs).
// Como el fetch de prefetch usaba `.catch(() => {})`, un tile que fallaba
// en esa ráfaga quedaba roto para siempre (nunca se reintentaba), así que
// la capa base quedaba permanentemente vacía y solo se veían los tiles de
// detalle puntuales que el usuario alcanzaba a cargar haciendo zoom.
// Ahora: (a) se limita la concurrencia del prefetch, (b) cada tile
// reintenta una vez si falla, y (c) se da un pequeño respiro antes de
// arrancar el prefetch para no competir con los tiles del viewport inicial.
import type mapboxgl from "mapbox-gl";

const TILE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weather-tile`;

const TILE_READY_VARIABLES = new Set(["temperature"]);

// Tope de la pirámide BASE: z=0..3 => 1+4+16+64 = 85 tiles. Cubre el
// planeta entero, es barato, y es lo único que se prefetchea.
const BASE_MAX_ZOOM = 3;

// A partir de qué zoom empieza a pedirse la capa de DETALLE. Nunca se
// prefetchea: Mapbox la solicita sola, solo para lo que está en pantalla.
const DETAIL_MIN_ZOOM = 4;
const DETAIL_MAX_ZOOM = 12;

// Cuántos tiles del prefetch de la base se piden en simultáneo. Antes se
// pedía un nivel de zoom entero de una (hasta 64 a la vez), lo que
// saturaba el edge function. Con esto se evita la ráfaga.
const PREFETCH_CONCURRENCY = 6;

// Reintentos por tile del prefetch si el primer intento falla (network
// error, 5xx puntual, etc.).
const PREFETCH_RETRIES = 1;

// Espera antes de arrancar el prefetch de la base, para darle prioridad
// a los tiles que Mapbox ya está pidiendo por el viewport inicial.
const PREFETCH_START_DELAY_MS = 600;

export class WeatherTileLayerManager {
  private map: mapboxgl.Map;
  private hourOffset = 0;
  private active = new Set<string>();

  // Evita repetir el prefetch de la base para la misma variable+hora.
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

    // Reemplazamos la URL sin destruir los Sources: mantiene los tiles
    // actuales visibles (base y detalle) mientras Mapbox descarga los nuevos.
    for (const v of this.active) {
      this.retile(this.baseSrcId(v), v);
      this.retile(this.detailSrcId(v), v);
      this.schedulePrefetch(v);
    }
  }

  private retile(srcId: string, variable: string) {
    const src = this.map.getSource(srcId) as
      | (mapboxgl.RasterTileSource & { setTiles?: (t: string[]) => void })
      | undefined;
    if (src && typeof src.setTiles === "function") {
      src.setTiles([this.tilePattern(variable)]);
    }
  }

  private baseSrcId(v: string) {
    return `weather-tile-src-${v}-base`;
  }
  private baseLyrId(v: string) {
    return `weather-tile-lyr-${v}-base`;
  }
  private detailSrcId(v: string) {
    return `weather-tile-src-${v}-detail`;
  }
  private detailLyrId(v: string) {
    return `weather-tile-lyr-${v}-detail`;
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
    // con el render inicial, y encima esperamos un respiro extra para
    // priorizar los tiles que Mapbox ya pidió para el viewport actual.
    const run = () =>
      setTimeout(
        () => this.prefetchBaseTiles(variable).catch(() => {}),
        PREFETCH_START_DELAY_MS,
      );
    if (typeof (window as any).requestIdleCallback === "function") {
      (window as any).requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 250);
    }
  }

  // Descarga una tile con un reintento simple si falla.
  private async fetchTileWithRetry(url: string, attemptsLeft = PREFETCH_RETRIES) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok && attemptsLeft > 0) {
        return this.fetchTileWithRetry(url, attemptsLeft - 1);
      }
    } catch {
      if (attemptsLeft > 0) {
        return this.fetchTileWithRetry(url, attemptsLeft - 1);
      }
    }
  }

  // Corre una lista de tareas con un límite de concurrencia, en vez de
  // lanzar todo junto con Promise.allSettled (eso era lo que saturaba
  // el edge function con ~64 requests simultáneos por nivel de zoom).
  private async runWithConcurrencyLimit<T>(items: T[], limit: number, task: (item: T) => Promise<unknown>) {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++];
        await task(item);
      }
    });
    await Promise.all(workers);
  }

  private async prefetchBaseTiles(variable: string) {
    // Prefetch por niveles, del más bajo al más alto: primero cubrimos
    // el globo a baja resolución, luego afinamos dentro del rango de la
    // base. Dentro de cada nivel, la concurrencia está limitada para no
    // saturar el edge function ni la red.
    for (let z = 0; z <= BASE_MAX_ZOOM; z++) {
      const max = 1 << z;
      const coords: { x: number; y: number }[] = [];
      for (let x = 0; x < max; x++) {
        for (let y = 0; y < max; y++) {
          coords.push({ x, y });
        }
      }
      await this.runWithConcurrencyLimit(coords, PREFETCH_CONCURRENCY, ({ x, y }) =>
        this.fetchTileWithRetry(this.tileUrl(variable, z, x, y)),
      );
    }
    console.info(`[WeatherTiles] Base global z=0..${BASE_MAX_ZOOM} lista (${variable})`);
  }

  private addLayer(variable: string) {
    // Capa BASE: pirámide global de baja resolución. Se limita su maxzoom
    // a BASE_MAX_ZOOM — más allá de eso Mapbox la overzoomea (estira el
    // último nivel) automáticamente, así que siempre hay algo dibujado en
    // cualquier lugar del planeta, sin depender de que el detalle ya haya
    // cargado ahí.
    const baseSrcId = this.baseSrcId(variable);
    const baseLyrId = this.baseLyrId(variable);
    if (!this.map.getSource(baseSrcId)) {
      this.map.addSource(baseSrcId, {
        type: "raster",
        tiles: [this.tilePattern(variable)],
        tileSize: 256,
        minzoom: 0,
        maxzoom: BASE_MAX_ZOOM,
        volatile: false,
      } as mapboxgl.RasterSourceSpecification);

      this.map.addLayer({
        id: baseLyrId,
        type: "raster",
        source: baseSrcId,
        paint: {
          "raster-opacity": 0.72,
          "raster-fade-duration": 250,
          "raster-resampling": "linear",
        },
      });
    }

    // Capa DETALLE: sin prefetch. Mapbox pide sola cada tile, solo cuando
    // el usuario hace zoom/pan sobre esa zona real — resolución creciente
    // 100% por demanda. Se agrega encima de la base para taparla donde ya
    // haya datos más finos cargados.
    const detailSrcId = this.detailSrcId(variable);
    const detailLyrId = this.detailLyrId(variable);
    if (!this.map.getSource(detailSrcId)) {
      this.map.addSource(detailSrcId, {
        type: "raster",
        tiles: [this.tilePattern(variable)],
        tileSize: 256,
        minzoom: DETAIL_MIN_ZOOM,
        maxzoom: DETAIL_MAX_ZOOM,
        volatile: false,
      } as mapboxgl.RasterSourceSpecification);

      this.map.addLayer({
        id: detailLyrId,
        type: "raster",
        source: detailSrcId,
        paint: {
          "raster-opacity": 0.72,
          "raster-fade-duration": 250,
          "raster-resampling": "linear",
        },
      });
    }
  }

  private removeLayer(variable: string) {
    for (const [srcId, lyrId] of [
      [this.detailSrcId(variable), this.detailLyrId(variable)],
      [this.baseSrcId(variable), this.baseLyrId(variable)],
    ]) {
      if (this.map.getLayer(lyrId)) this.map.removeLayer(lyrId);
      if (this.map.getSource(srcId)) this.map.removeSource(srcId);
    }
  }

  destroy() {
    for (const v of Array.from(this.active)) this.removeLayer(v);
    this.active.clear();
    this.prefetched.clear();
  }
}
