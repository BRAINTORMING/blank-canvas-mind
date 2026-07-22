// Monitoreo Territorial — Wind particle animation (canvas overlay above Mapbox).
// Non-blocking: samples U/V from Open-Meteo grid, advects thousands of particles
// with fading trails. Zoom/pan aware. Not a heatmap; no arrows.
import type mapboxgl from "mapbox-gl";
import type { GridResponse } from "@/services/monitoring/WeatherService";

interface UV { u: number; v: number }

export class WindAnimation {
  private map: mapboxgl.Map;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private running = false;
  private particles: Array<{ lng: number; lat: number; age: number }> = [];
  private grid: GridResponse | null = null;
  private hourOffset = 0;
  private numParticles = 3500;
  private maxAge = 90;

  constructor(map: mapboxgl.Map) {
    this.map = map;
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.inset = "0";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "5";
    this.ctx = this.canvas.getContext("2d")!;
    const container = map.getContainer();
    container.appendChild(this.canvas);
    this.resize();
    this.onResize = this.onResize.bind(this);
    window.addEventListener("resize", this.onResize);
    map.on("resize", this.onResize);
    map.on("move", this.onResize);
  }

  setGrid(grid: GridResponse | null) { this.grid = grid; this.seed(); }
  setHourOffset(h: number) { this.hourOffset = h; }

  start() { if (this.running) return; this.running = true; this.loop(); }
  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  destroy() {
    this.stop();
    window.removeEventListener("resize", this.onResize);
    this.map.off("resize", this.onResize);
    this.map.off("move", this.onResize);
    this.canvas.remove();
  }

  private onResize() { this.resize(); }
  private resize() {
    const c = this.map.getContainer();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = c.clientWidth * dpr;
    this.canvas.height = c.clientHeight * dpr;
    this.canvas.style.width = c.clientWidth + "px";
    this.canvas.style.height = c.clientHeight + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private seed() {
    const b = this.map.getBounds();
    if (!b) return;
    const w = b.getWest(), e = b.getEast(), s = b.getSouth(), n = b.getNorth();
    this.particles = new Array(this.numParticles).fill(0).map(() => ({
      lng: w + Math.random() * (e - w),
      lat: s + Math.random() * (n - s),
      age: Math.random() * this.maxAge,
    }));
  }

  private sampleUV(lng: number, lat: number): UV | null {
    const g = this.grid;
    if (!g) return null;
    const [w, s, e, n] = g.bbox;
    if (lng < w || lng > e || lat < s || lat > n) return null;
    const fx = ((lng - w) / (e - w)) * (g.cols - 1);
    const fy = ((lat - s) / (n - s)) * (g.rows - 1);
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = Math.min(g.cols - 1, x0 + 1), y1 = Math.min(g.rows - 1, y0 + 1);
    const tx = fx - x0, ty = fy - y0;

    const idx = (x: number, y: number) => y * g.cols + x;
    const at = (cellIdx: number): UV | null => {
      const cell = g.grid[cellIdx];
      if (!cell?.hourly) return null;
      const h = cell.hourly;
      const i = Math.min(this.hourOffset, (h.time?.length ?? 1) - 1);
      const spd = h.wind_speed_10m?.[i]; // km/h
      const dir = h.wind_direction_10m?.[i]; // meteorological deg (from)
      if (spd == null || dir == null) return null;
      // Convert "from" direction to velocity vector (to-direction) in degrees space
      const rad = ((dir + 180) % 360) * Math.PI / 180;
      return { u: Math.sin(rad) * spd, v: Math.cos(rad) * spd };
    };
    const a = at(idx(x0, y0)); const b = at(idx(x1, y0));
    const c = at(idx(x0, y1)); const d = at(idx(x1, y1));
    if (!a && !b && !c && !d) return null;
    const A = a ?? b ?? c ?? d!;
    const B = b ?? A; const C = c ?? A; const D = d ?? A;
    const u = (A.u * (1 - tx) + B.u * tx) * (1 - ty) + (C.u * (1 - tx) + D.u * tx) * ty;
    const v = (A.v * (1 - tx) + B.v * tx) * (1 - ty) + (C.v * (1 - tx) + D.v * tx) * ty;
    return { u, v };
  }

  private loop = () => {
    if (!this.running) return;
    const ctx = this.ctx;
    // Fade trails
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "rgba(0,0,0,0.94)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalCompositeOperation = "source-over";

    if (this.grid && this.particles.length) {
      const b = this.map.getBounds();
      if (!b) { this.raf = requestAnimationFrame(this.loop); return; }
      const w = b.getWest(), e = b.getEast(), s = b.getSouth(), n = b.getNorth();
      // Speed factor: km/h → degrees/frame (very rough)
      const spdFactor = 0.00006;

      ctx.lineWidth = 1;
      for (const p of this.particles) {
        p.age++;
        const uv = this.sampleUV(p.lng, p.lat);
        if (!uv || p.age > this.maxAge || p.lng < w || p.lng > e || p.lat < s || p.lat > n) {
          p.lng = w + Math.random() * (e - w);
          p.lat = s + Math.random() * (n - s);
          p.age = 0;
          continue;
        }
        const prev = this.map.project([p.lng, p.lat]);
        p.lng += uv.u * spdFactor;
        p.lat += uv.v * spdFactor;
        const cur = this.map.project([p.lng, p.lat]);
        const mag = Math.hypot(uv.u, uv.v);
        const alpha = Math.min(0.9, 0.25 + mag / 80);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(cur.x, cur.y);
        ctx.stroke();
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };
}
