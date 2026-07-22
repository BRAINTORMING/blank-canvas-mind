export const WeatherService = {
  async point(lat: number, lon: number): Promise<any> {
    const k = keyPoint(lat, lon);
    const hit = pointMem.get(k);
    if (hit && hit.expiresAt > Date.now()) return hit.data;
    if (inflight.has(k)) return inflight.get(k)!;
    const p = supabase.functions
      .invoke("weather-api", { body: { mode: "point", lat, lon } })
      .then(({ data, error }) => {
        if (error) throw error;
        pointMem.set(k, { data, expiresAt: Date.now() + 10 * 60_000 });
        return data;
      })
      .finally(() => inflight.delete(k));
    inflight.set(k, p);
    return p;
  },

  async grid(
    bbox: [number, number, number, number],
    cols = 8,
    rows = 8
  ): Promise<GridResponse> {
    const k = keyGrid(bbox, cols, rows);
    const hit = gridMem.get(k);
    if (hit && hit.expiresAt > Date.now()) return hit.data;
    if (inflight.has(k)) return inflight.get(k)!;
    const p = supabase.functions
      .invoke("weather-api", { body: { mode: "grid", bbox, cols, rows } })
      .then(({ data, error }) => {
        if (error) throw error;
        gridMem.set(k, {
          data: data as GridResponse,
          expiresAt: Date.now() + 20 * 60_000,
        });
        return data as GridResponse;
      })
      .finally(() => inflight.delete(k));
    inflight.set(k, p);
    return p;
  },

  async points(
    pts: { lat: number; lon: number }[],
    step: number
  ): Promise<
    Array<{
      lat: number;
      lon: number;
      hourly: any;
      hourly_units: any;
    }>
  > {
    if (pts.length === 0) return [];

    const { data, error } = await supabase.functions.invoke("weather-api", {
      body: {
        mode: "points",
        points: pts,
        step,
      },
    });

    if (error) throw error;

    return (data as any)?.points ?? [];
  },

  extractHour(
    grid: GridResponse,
    hourOffset: number
  ): Array<{ lat: number; lon: number; values: PointWeather }> {
    const out: Array<{
      lat: number;
      lon: number;
      values: PointWeather;
    }> = [];

    for (const cell of grid.grid) {
      const h = cell.hourly;
      if (!h) continue;

      const idx = Math.min(hourOffset, (h.time?.length ?? 1) - 1);

      out.push({
        lat: cell.lat,
        lon: cell.lon,
        values: {
          temperature_2m: h.temperature_2m?.[idx] ?? null,
          relative_humidity_2m: h.relative_humidity_2m?.[idx] ?? null,
          wind_speed_10m: h.wind_speed_10m?.[idx] ?? null,
          wind_direction_10m: h.wind_direction_10m?.[idx] ?? null,
          rain: h.rain?.[idx] ?? null,
          cloud_cover: h.cloud_cover?.[idx] ?? null,
          pressure_msl: h.pressure_msl?.[idx] ?? null,
          uv_index: h.uv_index?.[idx] ?? null,
          shortwave_radiation: h.shortwave_radiation?.[idx] ?? null,
        },
      });
    }

    return out;
  },
};
