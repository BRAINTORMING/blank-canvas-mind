// Renderiza un campo escalar (temperatura, humedad, etc.) como una superficie
// continua tipo Windy, en vez del `heatmap` de puntos de Mapbox — que solo se
// ve bien con nubes de puntos densas y produce manchas aisladas con una
// grilla meteorológica dispersa como la nuestra.
//
// Enfoque: muestreamos la grilla de Open-Meteo sobre un <canvas> off-screen
// con interpolación bicúbica (Catmull-Rom, separable en X/Y), coloreamos con
// una tabla precalculada de 256 entradas (rápido, sin parsear colores por
// píxel), y lo superponemos al mapa como fuente `canvas` + capa `raster` con
// resampling lineal en GPU para suavidad extra durante pan/zoom.
//
// La interpolación bicúbica, además de verse más suave que la bilineal,
// rellena huecos de nodos individuales faltantes de forma natural: cada
// píxel promedia sus 16 vecinos ponderados y simplemente ignora (sin sumar
// peso) los que sean NaN. Si TODOS los vecinos relevantes faltan, el píxel
// queda transparente; si solo faltan algunos, el resultado sigue siendo un
// valor válido en vez de un agujero — evita el efecto "manchas" de una grilla
// dispersa con cobertura parcial.
import type mapboxgl from "mapbox-gl";
import { colorAt, type Stop } from "@/lib/monitoring/palettes";

// Resolución del canvas: se recalcula por render en función del tamaño de la
// grilla de entrada (más nodos → más píxeles), acotada para no disparar el
// costo de CPU. No depende del viewport ni del devicePixelRatio: es una
// propiedad del dato, no de la pantalla — así el mismo canvas se ve bien
// mientras Mapbox lo reproyecta durante pan/zoom sin necesidad de redibujar.
const PIXELS_PER_CELL = 48;
const MIN_CANVAS_SIZE = 512;
const MAX_CANVAS_SIZE = 1536;

// Peso cúbico de Catmull-Rom (a = -0.5), la misma curva que usan la mayoría
// de los motores de imagen para "bicubic" — buen balance entre suavidad y
// nitidez, sin el halo excesivo de kernels con `a` más negativo.
function cubicWeight(x: number): number {
  const ax = Math.abs(x);
  const a = -0.5;
  if (ax <= 1) return (a + 2) * ax ** 3 - (a + 3) * ax ** 2 + 1;
  if (ax < 2) return a * ax ** 3 - 5 * a * ax ** 2 + 8 * a * ax - 4 * a;
  return 0;
}

export class ContinuousFieldLayer {
  private map: mapboxgl.Map;
  private id: string;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lut: Uint8ClampedArray; // 256 entradas RGBA
  private min: number;
  private max: number;
  private added = false;

  constructor(map: mapboxgl.Map, id: string, stops: Stop[], min: number, max: number) {
    this.map = map;
    this.id = id;
    this.min = min;
    this.max = max;
    this.canvas = document.createElement("canvas");
    this.canvas.width = MIN_CANVAS_SIZE;
    this.canvas.height = MIN_CANVAS_SIZE;
    this.ctx = this.canvas.getContext("2d")!;
    this.lut = ContinuousFieldLayer.buildLUT(stops, min, max);
  }

  private static buildLUT(stops: Stop[], min: number, max: number): Uint8ClampedArray {
    const lut = new Uint8ClampedArray(256 * 4);
    for (let i = 0; i < 256; i++) {
      const v = min + ((max - min) * i) / 255;
      const [r, g, b] = ContinuousFieldLayer.parseColor(colorAt(stops, v));
      lut[i * 4] = r;
      lut[i * 4 + 1] = g;
      lut[i * 4 + 2] = b;
      lut[i * 4 + 3] = 255;
    }
    return lut;
  }

  private static parseColor(c: string): [number, number, number] {
    if (c.startsWith("#")) {
      const h = c.replace("#", "");
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0];
    const p = m[1].split(",").map((s) => parseFloat(s.trim()));
    return [p[0], p[1], p[2]];
  }

  /**
   * values: array plano largo rows*cols, orden j*cols+i (igual que la grilla
   * del edge function), lat crece con j (sur→norte), lon crece con i (oeste→este).
   * NaN donde falte el dato.
   */
  render(
    values: Float32Array,
    cols: number,
    rows: number,
    bbox: [number, number, number, number], // [w, s, e, n]
    opacity = 0.72
  ) {
    const [w, s, e, n] = bbox;

    // Resolución proporcional a la densidad de la grilla de entrada, acotada.
    const size = Math.max(
      MIN_CANVAS_SIZE,
      Math.min(MAX_CANVAS_SIZE, Math.round(Math.max(cols, rows) * PIXELS_PER_CELL)),
    );
    if (this.canvas.width !== size || this.canvas.height !== size) {
      this.canvas.width = size;
      this.canvas.height = size;
    }
    const W = this.canvas.width, H = this.canvas.height;

    const img = this.ctx.createImageData(W, H);
    const data = img.data;

    for (let py = 0; py < H; py++) {
      const lat = n - ((n - s) * py) / (H - 1); // fila 0 = norte
      const fy = ((lat - s) / (n - s)) * (rows - 1);
      const j0 = Math.floor(fy);
      const ty = fy - j0;

      for (let px = 0; px < W; px++) {
        const lon = w + ((e - w) * px) / (W - 1);
        const fx = ((lon - w) / (e - w)) * (cols - 1);
        const i0 = Math.floor(fx);
        const tx = fx - i0;

        const idx = (py * W + px) * 4;

        let sum = 0;
        let wsum = 0;
        for (let dy = -1; dy <= 2; dy++) {
          const jy = clampInt(j0 + dy, 0, rows - 1);
          const wy = cubicWeight(dy - ty);
          if (wy === 0) continue;
          for (let dx = -1; dx <= 2; dx++) {
            const ix = clampInt(i0 + dx, 0, cols - 1);
            const wx = cubicWeight(dx - tx);
            if (wx === 0) continue;
            const v = values[jy * cols + ix];
            if (!Number.isFinite(v)) continue; // hueco: no aporta peso ni valor
            const weight = wx * wy;
            sum += v * weight;
            wsum += weight;
          }
        }

        // wsum ~1 cuando los 16 vecinos están presentes; cae con datos
        // faltantes, dando además un desvanecido natural en los bordes de
        // la cobertura de datos en vez de un corte duro.
        if (wsum <= 0.05) {
          data[idx + 3] = 0;
          continue;
        }

        const value = sum / wsum;
        const t = Math.max(0, Math.min(1, (value - this.min) / (this.max - this.min)));
        const lutIdx = Math.round(t * 255) * 4;
        const alpha = Math.round(255 * Math.min(1, wsum));

        data[idx] = this.lut[lutIdx];
        data[idx + 1] = this.lut[lutIdx + 1];
        data[idx + 2] = this.lut[lutIdx + 2];
        data[idx + 3] = alpha;
      }
    }
    this.ctx.putImageData(img, 0, 0);

    const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
      [w, n], [e, n], [e, s], [w, s],
    ];

    const srcId = `monitoring-canvas-src-${this.id}`;
    const lyrId = `monitoring-canvas-lyr-${this.id}`;

    if (!this.added || !this.map.getSource(srcId)) {
      this.safeRemove();
      this.map.addSource(srcId, {
        type: "canvas",
        canvas: this.canvas,
        coordinates,
        animate: false,
      } as any);
      this.map.addLayer({
        id: lyrId,
        type: "raster",
        source: srcId,
        paint: {
          "raster-opacity": opacity,
          "raster-fade-duration": 0,
          "raster-resampling": "linear",
        },
      });
      this.added = true;
    } else {
      (this.map.getSource(srcId) as any).setCoordinates(coordinates);
    }
    this.map.triggerRepaint(); // con animate:false hay que forzar el refresco manualmente
  }

  private safeRemove() {
    const srcId = `monitoring-canvas-src-${this.id}`;
    const lyrId = `monitoring-canvas-lyr-${this.id}`;
    if (this.map.getLayer(lyrId)) this.map.removeLayer(lyrId);
    if (this.map.getSource(srcId)) this.map.removeSource(srcId);
  }

  remove() {
    this.safeRemove();
    this.added = false;
  }
}

function clampInt(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
