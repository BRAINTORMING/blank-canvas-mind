// Cache de grilla meteorológica persistente y adaptativa por zoom — la
// contraparte en el navegador del cache en Supabase del Edge Function.
// Junto con WeatherLayerManager (que decide CUÁNDO pedir cobertura, sobre un
// buffer más grande que el viewport) logran:
//  1) puntos de muestreo fijos a una escala discreta de espaciados (no
//     relativos al viewport), así que volver al mismo lugar reutiliza los
//     mismos nodos en vez de dibujar una grilla nueva con otro desfase;
//  2) solo se piden los nodos faltantes/vencidos, tanto aquí (memoria del
//     navegador) como en el servidor (Postgres, compartido entre usuarios);
//  3) más resolución al acercar el zoom y menos al alejar, con un tope fijo
//     de nodos — como una pirámide de tiles, pero para un campo continuo;
//  4) un tope duro de nodos por eje, independiente de qué tan grande sea el
//     bbox pedido, para que un buffer generoso nunca dispare miles de
//     llamadas en una sola cobertura.
import { WeatherService } from "@/services/monitoring/WeatherService";

export interface HourlyPayload {
  time: string[];
  temperature_2m?: number[];
  relative_humidity_2m?: number[];
  wind_speed_10m?: number[];
  wind_direction_10m?: number[];
  rain?: number[];
  cloud_cover?: number[];
  pressure_msl?: number[];
  uv_index?: number[];
  shortwave_radiation?: number[];
}

interface CachedNode {
  hourly: HourlyPayload | null;
  expiresAt: number;
}

// Escala discreta de espaciados en grados, de más fino a más grueso. Fija
// (no continua) para que viewports parecidos elijan el mismo espaciado y
// reutilicen los nodos ya cacheados entre sí.
const STEP_LADDER = [0.0625, 0.125, 0.25, 0.5, 1, 2, 4, 8, 16];

// Nodos por eje usados para ELEGIR el espaciado (resolución) a partir del
// viewport real (más chico = más fino).
const STEP_CHOICE_NODES_PER_AXIS = 16;

// Tope duro de nodos por eje al pedir cobertura sobre un bbox (que puede ser
// un buffer bastante más grande que el viewport). Protege el tamaño del
// payload y el número de llamadas al edge function sin importar qué tan
// grande sea el bbox solicitado.
const MAX_NODES_PER_AXIS_HARD_CAP = 40;

const CLIENT_TTL_MS = 18 * 60_000; // un poco menos que el TTL "points" del servidor (20 min)

function round5(n: number) { return Math.round(n * 1e5) / 1e5; }

export class WeatherGridCache {
  private cache = new Map<string, CachedNode>(); // clave: `${step}:${ix},${iy}`

  private key(step: number, ix: number, iy: number) {
    return `${step}:${ix},${iy}`;
  }

  /** Espaciado elegido en función de qué tan grande es el bbox (normalmente
   *  el viewport real, no el buffer) — más nodos visibles → grilla más
   *  gruesa; viewport chico (zoom alto) → grilla fina. */
  chooseStep(bbox: [number, number, number, number]): number {
    const [w, s, e, n] = bbox;
    const span = Math.max(e - w, n - s);
    for (const step of STEP_LADDER) {
      if (span / step <= STEP_CHOICE_NODES_PER_AXIS) return step;
    }
    return STEP_LADDER[STEP_LADDER.length - 1];
  }

  private nodesForBBox(bbox: [number, number, number, number], step: number) {
    const [w, s, e, n] = bbox;
    const rawIxMin = Math.floor(w / step), rawIxMax = Math.ceil(e / step);
    const rawIyMin = Math.floor(s / step), rawIyMax = Math.ceil(n / step);

    // Tope duro: si el bbox (p. ej. un buffer grande) pediría más nodos por
    // eje de los permitidos a este step, recorta simétricamente alrededor
    // del centro en vez de explotar el número de nodos.
    const [ixMin, ixMax] = clampRange(rawIxMin, rawIxMax, MAX_NODES_PER_AXIS_HARD_CAP);
    const [iyMin, iyMax] = clampRange(rawIyMin, rawIyMax, MAX_NODES_PER_AXIS_HARD_CAP);

    const nodes: { ix: number; iy: number; lat: number; lon: number }[] = [];
    for (let iy = iyMin; iy <= iyMax; iy++) {
      for (let ix = ixMin; ix <= ixMax; ix++) {
        nodes.push({ ix, iy, lat: round5(iy * step), lon: round5(ix * step) });
      }
    }
    return nodes;
  }

  /** Asegura que todos los nodos que cubren bbox al espaciado elegido estén
   *  cacheados y vigentes, pidiendo solo lo que falta. `forcedStep`, cuando
   *  se pasa, evita que un bbox grande (un buffer) elija por sí mismo un
   *  espaciado más grueso — el llamador (WeatherLayerManager) decide la
   *  resolución en base al viewport real y la aplica también al buffer.
   *  Devuelve el espaciado usado y el rango de índices, para que quien
   *  renderiza arme una ventana de muestreo densa. */
  async ensureCoverage(
    bbox: [number, number, number, number],
    forcedStep?: number,
  ): Promise<{
    step: number;
    ixRange: [number, number];
    iyRange: [number, number];
  }> {
    const step = forcedStep ?? this.chooseStep(bbox);
    const nodes = this.nodesForBBox(bbox, step);
    const now = Date.now();
    const missing = nodes.filter(nd => {
      const c = this.cache.get(this.key(step, nd.ix, nd.iy));
      return !c || c.expiresAt <= now;
    });

    if (missing.length > 0) {
      const results = await WeatherService.points(
        missing.map(nd => ({ lat: nd.lat, lon: nd.lon })),
        step,
      );
      for (let i = 0; i < missing.length; i++) {
        const nd = missing[i];
        const r = results[i];
        this.cache.set(this.key(step, nd.ix, nd.iy), {
          hourly: r?.hourly ?? null,
          expiresAt: now + CLIENT_TTL_MS,
        });
      }
    }

    const ixs = nodes.map(n_ => n_.ix), iys = nodes.map(n_ => n_.iy);
    return {
      step,
      ixRange: [Math.min(...ixs), Math.max(...ixs)],
      iyRange: [Math.min(...iys), Math.max(...iys)],
    };
  }

  /** Igual que nodesForBBox pero sin tocar la red: sirve para que el manager
   *  pueda preguntar "¿ya tengo todo lo que necesito para este bbox?" antes
   *  de decidir si vale la pena pedir cobertura nueva. */
  hasFullCoverage(bbox: [number, number, number, number], step: number): boolean {
    const nodes = this.nodesForBBox(bbox, step);
    const now = Date.now();
    return nodes.every(nd => {
      const c = this.cache.get(this.key(step, nd.ix, nd.iy));
      return !!c && c.expiresAt > now;
    });
  }

  /** Valor de una variable en un nodo, para una hora del timeline. NaN si no
   *  está cacheado (el renderer lo trata como transparente/hueco a rellenar
   *  por interpolación con vecinos válidos). */
  sample(step: number, ix: number, iy: number, variable: string, hourOffset: number): number {
    const c = this.cache.get(this.key(step, ix, iy));
    if (!c || !c.hourly) return NaN;
    const arr = (c.hourly as any)[variable] as number[] | undefined;
    if (!arr || arr.length === 0) return NaN;
    const idx = Math.min(hourOffset, arr.length - 1);
    const v = arr[idx];
    return typeof v === "number" && Number.isFinite(v) ? v : NaN;
  }

  /** Payload horario crudo de un nodo, por ejemplo para FireRiskService. */
  hourlyAt(step: number, ix: number, iy: number): HourlyPayload | null {
    return this.cache.get(this.key(step, ix, iy))?.hourly ?? null;
  }
}

/** Recorta [min, max] para que (max - min + 1) <= cap, manteniendo el centro. */
function clampRange(min: number, max: number, cap: number): [number, number] {
  const count = max - min + 1;
  if (count <= cap) return [min, max];
  const center = (min + max) / 2;
  const half = Math.floor((cap - 1) / 2);
  const newMin = Math.round(center - half);
  const newMax = newMin + cap - 1;
  return [newMin, newMax];
}
