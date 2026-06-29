// Catalog of layer/module categories used by the Innovation Dashboard.
// The actual list of columns is discovered at runtime from usuarios_sesiones
// (any column starting with "capa_" or matching a known module is included).

export type LayerCategory =
  | "energía"
  | "minería"
  | "logística"
  | "infraestructura"
  | "territorio"
  | "negocio"
  | "otros";

const CATEGORY_RULES: Array<{ test: RegExp; cat: LayerCategory }> = [
  { test: /(solar|eolic|hidrogen|subestacion|linea|transmision|oleoducto|gasoducto|desal)/, cat: "energía" },
  { test: /(faena|minera|fundicion|refineria|litio|salar|campamento)/, cat: "minería" },
  { test: /(puerto|aeropuerto|ferrocarril|carretera|paso_fronterizo|terminal|terminales)/, cat: "logística" },
  { test: /(planta|zona_industrial|centro|estacion_de_carga)/, cat: "infraestructura" },
  { test: /(comunidad|area_protegida|monumento)/, cat: "territorio" },
  { test: /(proyecto|cliente|proveedor)/, cat: "negocio" },
];

export function categorize(layerKey: string): LayerCategory {
  const k = layerKey.toLowerCase();
  for (const r of CATEGORY_RULES) if (r.test.test(k)) return r.cat;
  return "otros";
}

export function prettyLayerName(col: string): string {
  return col
    .replace(/^capa_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

// Parse a Postgres interval like "1:23:45" or "01:23:45.123" or "00:00:30" into seconds.
export function intervalToSeconds(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const s = v.trim();
  if (!s) return 0;
  // Match H:MM:SS(.fff)? possibly with leading sign
  const m = /^-?(\d+):(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/.exec(s);
  if (m) {
    const sign = s.startsWith("-") ? -1 : 1;
    const h = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    const se = parseInt(m[3], 10);
    return sign * (h * 3600 + mi * 60 + se);
  }
  // Postgres "01:02:03" already matched. Try "X hours Y mins" verbose form.
  const verbose = /(\d+)\s*(hour|hours|min|mins|minute|minutes|sec|secs|second|seconds)/g;
  let total = 0;
  let match: RegExpExecArray | null;
  while ((match = verbose.exec(s)) !== null) {
    const n = parseInt(match[1], 10);
    const unit = match[2];
    if (/hour/.test(unit)) total += n * 3600;
    else if (/min/.test(unit)) total += n * 60;
    else if (/sec/.test(unit)) total += n;
  }
  return total;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
