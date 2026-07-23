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
    // con el render inicial. Solo prefetcheamos la pirámide BASE — la
    // capa de detalle se llena sola, bajo demanda, cuando el usuario
    // efectivamente hace zoom sobre una zona.
    const run = () => this.prefetchBaseTiles(variable).catch(() => {});
    if (typeof (window as any).requestIdleCallback === "function") {
      (window as any).requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 250);
    }
  }

  private async prefetchBaseTiles(variable: string) {
    // Prefetch por niveles, del más bajo al más alto: primero cubrimos
    // el globo, luego afinamos dentro del rango de la base. Cada nivel
    // espera al anterior para no saturar la red.
    for (let z = 0; z <= BASE_MAX_ZOOM; z++) {
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
