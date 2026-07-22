// Renderiza un campo escalar (temperatura, humedad, etc.) como una superficie
// continua tipo Windy, en vez del `heatmap` de puntos de Mapbox — que solo se
// ve bien con nubes de puntos densas y produce manchas aisladas con una grilla
// meteorológica dispersa como la nuestra (8x8).
//
// Enfoque: muestreamos la grilla de Open-Meteo sobre un <canvas> off-screen
// con interpolación bilineal (barata, suave, sin dependencias), coloreamos con
// una tabla precalculada de 256 entradas (rápido, sin parsear colores por
// píxel), y lo superponemos al mapa como fuente `canvas` + capa `raster` con
// resampling lineal en GPU para suavidad extra.

import type mapboxgl from "mapbox-gl";
import { colorAt, type Stop } from "@/lib/monitoring/palettes";

const CANVAS_SIZE = 256; // resolución fija; Mapbox la estira al cuadrilátero geográfico, así que solo afecta suavidad vs. costo de CPU

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
    this.canvas.width = CANVAS_SIZE;
    this.canvas.height = CANVAS_SIZE;
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
    const W = CANVAS_SIZE, H = CANVAS_SIZE;
    const img = this.ctx.createImageData(W, H);
    const data = img.data;

    for (let py = 0; py < H; py++) {
      const lat = n - ((n - s) * py) / (H - 1); // fila 0 = norte
      const fy = ((lat - s) / (n - s)) * (rows - 1);
      const j0 = Math.max(0, Math.min(rows - 2, Math.floor(fy)));
      const ty = fy - j0;

      for (let px = 0; px < W; px++) {
        const lon = w + ((e - w) * px) / (W - 1);
        const fx = ((lon - w) / (e - w)) * (cols - 1);
        const i0 = Math.max(0, Math.min(cols - 2, Math.floor(fx)));
        const tx = fx - i0;

        const v00 = values[j0 * cols + i0];
        const v10 = values[j0 * cols + i0 + 1];
        const v01 = values[(j0 + 1) * cols + i0];
        const v11 = values[(j0 + 1) * cols + i0 + 1];

        const idx = (py * W + px) * 4;
        if (!Number.isFinite(v00) || !Number.isFinite(v10) || !Number.isFinite(v01) || !Number.isFinite(v11)) {
          data[idx + 3] = 0; // transparente donde falte dato
          continue;
        }

        const top = v00 + (v10 - v00) * tx;
        const bottom = v01 + (v11 - v01) * tx;
        const value = top + (bottom - top) * ty;

        const t = Math.max(0, Math.min(1, (value - this.min) / (this.max - this.min)));
        const lutIdx = Math.round(t * 255) * 4;
        data[idx] = this.lut[lutIdx];
        data[idx + 1] = this.lut[lutIdx + 1];
        data[idx + 2] = this.lut[lutIdx + 2];
        data[idx + 3] = 255;
      }
    }
    this.ctx.putImageData(img, 0, 0);

    const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
      [w, n], [e, n], [e, s], [w, s],
    ];

    const srcId = `monitoring-canvas-src-${this.id}`;
    const lyrId = `monitoring-canvas-lyr-${this.id}`;

    if (!this.added) {
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

  remove() {
    const srcId = `monitoring-canvas-src-${this.id}`;
    const lyrId = `monitoring-canvas-lyr-${this.id}`;
    if (this.map.getLayer(lyrId)) this.map.removeLayer(lyrId);
    if (this.map.getSource(srcId)) this.map.removeSource(srcId);
    this.added = false;
  }
}
