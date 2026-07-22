// Monitoreo Territorial — Weather API proxy (Open-Meteo)
// Modes:
//   'point' → single lat/lon, current + hourly forecast (24h)
//   'grid'  → NxM grid of samples covering bbox, hourly forecast (24h)
// Cache TTL: 15 min current, 30 min forecast/grid.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

const HOURLY_VARS = [
  "temperature_2m",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "rain",
  "cloud_cover",
  "pressure_msl",
  "uv_index",
  "shortwave_radiation",
].join(",");

const CURRENT_VARS = [
  "temperature_2m",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "rain",
  "cloud_cover",
  "pressure_msl",
  "uv_index",
  "shortwave_radiation",
].join(",");

interface Body {
  mode: "point" | "grid";
  lat?: number;
  lon?: number;
  bbox?: [number, number, number, number]; // [west, south, east, north]
  cols?: number;
  rows?: number;
  hours?: number;
}

function roundKey(n: number) {
  return Math.round(n * 100) / 100; // 0.01° tolerance
}

async function fetchOpenMeteoPoint(lat: number, lon: number) {
  const url = new URL(OPEN_METEO);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", CURRENT_VARS);
  url.searchParams.set("hourly", HOURLY_VARS);
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("wind_speed_unit", "kmh");
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`open-meteo ${r.status}: ${await r.text()}`);
  return await r.json();
}

async function fetchOpenMeteoBatch(latitudes: number[], longitudes: number[]) {
  const url = new URL(OPEN_METEO);
  url.searchParams.set("latitude", latitudes.join(","));
  url.searchParams.set("longitude", longitudes.join(","));
  url.searchParams.set("hourly", HOURLY_VARS);
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("wind_speed_unit", "kmh");
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`open-meteo grid ${r.status}: ${await r.text()}`);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (body.mode === "point") {
      const lat = roundKey(Number(body.lat));
      const lon = roundKey(Number(body.lon));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return new Response(JSON.stringify({ error: "invalid lat/lon" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: cached } = await supabase
        .from("weather_cache")
        .select("data, expires_at")
        .eq("provider", "open-meteo")
        .eq("variant", "point")
        .eq("lat", lat)
        .eq("lon", lon)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached?.data) {
        return new Response(JSON.stringify({ cached: true, ...cached.data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const om = await fetchOpenMeteoPoint(lat, lon);
      const expires = new Date(Date.now() + 15 * 60_000).toISOString();
      await supabase.from("weather_cache").insert({
        lat, lon, provider: "open-meteo", variant: "point",
        data: om, expires_at: expires,
      });
      return new Response(JSON.stringify({ cached: false, ...om }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.mode === "grid") {
      const bbox = body.bbox;
      if (!bbox || bbox.length !== 4) {
        return new Response(JSON.stringify({ error: "bbox required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const [w, s, e, n] = bbox;
      const cols = Math.max(3, Math.min(12, body.cols ?? 10));
      const rows = Math.max(3, Math.min(12, body.rows ?? 10));

      // Build grid
      const latitudes: number[] = [];
      const longitudes: number[] = [];
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const lon = w + ((e - w) * i) / (cols - 1);
          const lat = s + ((n - s) * j) / (rows - 1);
          latitudes.push(Number(lat.toFixed(4)));
          longitudes.push(Number(lon.toFixed(4)));
        }
      }

      // Cache key by bbox rounded
      const cacheKey = {
        lat: roundKey((s + n) / 2),
        lon: roundKey((w + e) / 2),
        variant: `grid_${cols}x${rows}_${roundKey(e - w)}x${roundKey(n - s)}`,
      };
      const { data: cached } = await supabase
        .from("weather_cache")
        .select("data, expires_at")
        .eq("provider", "open-meteo")
        .eq("variant", cacheKey.variant)
        .eq("lat", cacheKey.lat)
        .eq("lon", cacheKey.lon)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (cached?.data) {
        return new Response(JSON.stringify({ cached: true, ...cached.data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const om = await fetchOpenMeteoBatch(latitudes, longitudes);
      // om is an array of responses (one per point)
      const points = Array.isArray(om) ? om : [om];
      const grid = points.map((p: any, idx: number) => ({
        lat: latitudes[idx],
        lon: longitudes[idx],
        hourly: p?.hourly ?? null,
        hourly_units: p?.hourly_units ?? null,
      }));
      const payload = { cols, rows, bbox, grid, generated_at: new Date().toISOString() };

      const expires = new Date(Date.now() + 30 * 60_000).toISOString();
      await supabase.from("weather_cache").insert({
        lat: cacheKey.lat, lon: cacheKey.lon,
        provider: "open-meteo", variant: cacheKey.variant,
        data: payload, expires_at: expires,
      });

      return new Response(JSON.stringify({ cached: false, ...payload }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "invalid mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("weather-api error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
