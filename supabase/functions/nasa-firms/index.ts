// Monitoreo Territorial — NASA FIRMS active fire proxy.
// Requires secret NASA_FIRMS_MAP_KEY (free at https://firms.modaps.eosdis.nasa.gov/api/map_key/).
// If missing, returns empty features so the layer degrades gracefully.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  bbox: [number, number, number, number]; // [west, south, east, north]
  days?: number;
  source?: string; // e.g. VIIRS_SNPP_NRT, MODIS_NRT
}

const memCache = new Map<string, { data: unknown; expiresAt: number }>();
function getCached(k: string) {
  const h = memCache.get(k);
  if (!h) return null;
  if (h.expiresAt < Date.now()) { memCache.delete(k); return null; }
  return h.data;
}
function setCached(k: string, d: unknown, ttlMs: number) {
  memCache.set(k, { data: d, expiresAt: Date.now() + ttlMs });
}

function csvToFeatures(csv: string): any[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const idx = (n: string) => header.indexOf(n);
  const iLat = idx("latitude"), iLon = idx("longitude");
  const iBright = idx("bright_ti4") >= 0 ? idx("bright_ti4") : idx("brightness");
  const iFrp = idx("frp"), iConf = idx("confidence");
  const iDate = idx("acq_date"), iTime = idx("acq_time");
  const iSat = idx("satellite");
  const feats: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    const lat = Number(c[iLat]), lon = Number(c[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const frp = Number(c[iFrp]);
    feats.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        brightness: Number(c[iBright]),
        frp: Number.isFinite(frp) ? frp : null,
        confidence: c[iConf] ?? null,
        acq_date: c[iDate] ?? null,
        acq_time: c[iTime] ?? null,
        satellite: c[iSat] ?? null,
      },
    });
  }
  return feats;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    if (!body.bbox || body.bbox.length !== 4) {
      return new Response(JSON.stringify({ error: "bbox required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const days = Math.max(1, Math.min(10, body.days ?? 2));
    const source = body.source ?? "VIIRS_SNPP_NRT";
    const [w, s, e, n] = body.bbox;
    const bboxStr = `${w},${s},${e},${n}`;
    const key = `firms:${source}:${bboxStr}:${days}`;
    const cached = getCached(key);
    if (cached) {
      return new Response(JSON.stringify({ cached: true, ...(cached as object) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mapKey = Deno.env.get("NASA_FIRMS_MAP_KEY");
    if (!mapKey) {
      return new Response(JSON.stringify({
        cached: false,
        type: "FeatureCollection",
        features: [],
        warning: "NASA_FIRMS_MAP_KEY no configurada",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/${bboxStr}/${days}`;
    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      return new Response(JSON.stringify({ error: "firms upstream", status: r.status, details: text }), {
        status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const csv = await r.text();
    const features = csvToFeatures(csv);
    const payload = { type: "FeatureCollection", features, source, days, bbox: body.bbox };
    setCached(key, payload, 30 * 60_000);
    return new Response(JSON.stringify({ cached: false, ...payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("nasa-firms error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
