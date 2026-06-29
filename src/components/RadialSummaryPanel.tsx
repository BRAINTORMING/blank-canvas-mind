import { useEffect, useMemo, useState } from "react";
import { externalSupabase as supabase } from "@/integrations/supabase/externalClient";
import { fetchAllRows } from "@/lib/supabasePagination";
import type { Proyecto } from "@/hooks/useProyectos";
import type { PoligonoData } from "@/components/ActivosLayerControl";
import {
  MapPin,
  Building2,
  Layers,
  Leaf,
  Briefcase,
  X,
  Sparkles,
  ChevronDown,
} from "lucide-react";

interface RadialState {
  active: boolean;
  center: { lat: number; lng: number } | null;
  radiusKm: number;
}

interface ActivoMini {
  lat: number;
  lng: number;
  capa: string;
  categoria: string | null;
}

interface Props {
  allProyectos: Proyecto[];
  allPoligonos: PoligonoData[];
}

/* ---------- Geo helpers ---------- */
const toRad = (d: number) => (d * Math.PI) / 180;
function haversineKm(a: { lat: number; lng: number }, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = toRad(lat2 - a.lat);
  const dLng = toRad(lng2 - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function polygonInRadius(geoJsonString: string, center: { lat: number; lng: number }, radiusKm: number): boolean {
  try {
    const verts: [number, number][] = [];
    const walk = (g: any) => {
      if (!g) return;
      if (g.type === "FeatureCollection") g.features?.forEach((f: any) => walk(f.geometry));
      else if (g.type === "Feature") walk(g.geometry);
      else if (g.type === "GeometryCollection") g.geometries?.forEach(walk);
      else if (g.type === "Polygon") g.coordinates?.[0]?.forEach((c: number[]) => verts.push([c[0], c[1]]));
      else if (g.type === "MultiPolygon") g.coordinates?.forEach((p: number[][][]) => p[0]?.forEach((c: number[]) => verts.push([c[0], c[1]])));
      else if (g.type === "Point") verts.push([g.coordinates[0], g.coordinates[1]]);
    };
    walk(JSON.parse(geoJsonString));
    for (const [lng, lat] of verts) {
      if (haversineKm(center, lat, lng) <= radiusKm) return true;
    }
    let sx = 0, sy = 0, n = 0;
    for (const [lng, lat] of verts) { sx += lng; sy += lat; n++; }
    if (n > 0 && haversineKm(center, sy / n, sx / n) <= radiusKm) return true;
  } catch {}
  return false;
}

/* ---------- Helpers ---------- */
const norm = (s: string | null | undefined) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function groupCount<T>(items: T[], key: (i: T) => string, sub: (i: T) => string) {
  const map = new Map<string, Map<string, number>>();
  items.forEach((i) => {
    const k = key(i) || "Sin clasificar";
    const s = sub(i) || "Sin categoría";
    if (!map.has(k)) map.set(k, new Map());
    const inner = map.get(k)!;
    inner.set(s, (inner.get(s) || 0) + 1);
  });
  // sort capas alphabetically, categorias desc by count
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([capa, inner]) => ({
      capa,
      total: Array.from(inner.values()).reduce((s, n) => s + n, 0),
      categorias: Array.from(inner.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([categoria, count]) => ({ categoria, count })),
    }));
}

function colorFor(name: string): string {
  const palette = [
    "hsl(200 85% 60%)", "hsl(145 63% 50%)", "hsl(38 92% 55%)",
    "hsl(280 60% 65%)", "hsl(180 70% 55%)", "hsl(20 85% 55%)",
    "hsl(260 70% 65%)", "hsl(160 60% 50%)", "hsl(330 70% 60%)",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
  return palette[Math.abs(hash) % palette.length];
}

/* ---------- Subcomponents ---------- */
function SectionHeader({ icon: Icon, title, count }: { icon: any; title: string; count: number }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-white/5 ring-1 ring-white/10">
          <Icon className="h-3.5 w-3.5 text-sky-300" />
        </div>
        <h3 className="text-[12px] font-semibold tracking-wide text-white/90 uppercase">{title}</h3>
      </div>
      <span className="text-[11px] font-semibold text-white/70 tabular-nums bg-white/5 px-2 py-0.5 rounded-md ring-1 ring-white/10">
        {count}
      </span>
    </div>
  );
}

function CapaCard({
  capa,
  total,
  categorias,
}: {
  capa: string;
  total: number;
  categorias: { categoria: string; count: number }[];
}) {
  const [open, setOpen] = useState(true);
  const accent = colorFor(capa);
  return (
    <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: accent }} />
          <span className="text-[12.5px] font-semibold text-white truncate">{capa}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[11px] font-bold text-white tabular-nums bg-white/10 px-2 py-0.5 rounded-md">{total}</span>
          <ChevronDown className={`h-3.5 w-3.5 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="px-3 pb-2.5 pt-1 space-y-1 border-t border-white/5">
          {categorias.map(({ categoria, count }) => (
            <div key={categoria} className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-md hover:bg-white/5 transition-colors">
              <span className="text-[11.5px] text-white/75 truncate">{categoria}</span>
              <span className="text-[11.5px] font-semibold text-white tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Main panel ---------- */
export default function RadialSummaryPanel({ allProyectos, allPoligonos }: Props) {
  const [radial, setRadial] = useState<RadialState>({ active: false, center: null, radiusKm: 10 });
  const [activos, setActivos] = useState<ActivoMini[]>([]);
  const [opened, setOpened] = useState(false);

  // Subscribe to radial events
  useEffect(() => {
    const onSet = (e: Event) => {
      const detail = (e as CustomEvent).detail as RadialState;
      setRadial(detail);
      // Panel does NOT auto-open with the circle — only when the user
      // clicks the consult-point marker (radial:openSummary) or the radial
      // analysis is turned off (then we hide it).
      if (!detail.active || !detail.center) setOpened(false);
    };
    const onOpen = () => setOpened(true);
    const onClose = () => setOpened(false);
    window.addEventListener("radial:set", onSet);
    window.addEventListener("radial:openSummary", onOpen);
    window.addEventListener("radial:closeSummary", onClose);
    return () => {
      window.removeEventListener("radial:set", onSet);
      window.removeEventListener("radial:openSummary", onOpen);
      window.removeEventListener("radial:closeSummary", onClose);
    };
  }, []);

  // Load activos once
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchAllRows<any>((from, to) =>
          supabase
            .from("activos_mapa")
            .select("latitud, longitud, capa, categoria, visible")
            .eq("visible", true)
            .range(from, to)
        );
        if (cancelled) return;
        const mapped: ActivoMini[] = (rows || [])
          .map((r) => ({
            lat: parseFloat(r.latitud),
            lng: parseFloat(r.longitud),
            capa: r.capa || "",
            categoria: r.categoria || null,
          }))
          .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
        setActivos(mapped);
      } catch (e) {
        console.error("[RadialSummaryPanel] activos load error", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = opened && radial.active && !!radial.center;

  /* ---------- Compute grouped counts within radius ---------- */
  const data = useMemo(() => {
    if (!radial.center) return null;
    const center = radial.center;
    const r = radial.radiusKm;

    // Activos (puntos) within radius
    const activosInside = activos.filter((a) => haversineKm(center, a.lat, a.lng) <= r);

    // Poligonos within radius
    const poligonosInside = allPoligonos.filter(
      (p) => p.coordenadas && polygonInRadius(p.coordenadas, center, r)
    );

    // Separate polygons into "Medioambiente" and the rest by their capa label.
    const isMedioambiente = (capa: string) => norm(capa).includes("medio") || norm(capa).includes("ambiente");
    const poligonosMA = poligonosInside.filter((p) => isMedioambiente(p.capa));
    const poligonosOtros = poligonosInside.filter((p) => !isMedioambiente(p.capa));

    // "Capas" section = todos los activos (puntos) + polígonos no-medioambiente
    // agrupados por capa → categoría
    const capasGroups = groupCount<{ capa: string; categoria: string | null }>(
      [
        ...activosInside.map((a) => ({ capa: a.capa, categoria: a.categoria })),
        ...poligonosOtros.map((p) => ({ capa: p.capa, categoria: p.categoria || null })),
      ],
      (i) => i.capa,
      (i) => i.categoria || "Sin categoría"
    );

    // "Medioambiente" section = polígonos del grupo medioambiente
    // agrupados por capa → categoría
    const ambienteGroups = groupCount<{ capa: string; categoria: string | null }>(
      poligonosMA.map((p) => ({ capa: p.capa, categoria: p.categoria || null })),
      (i) => i.capa,
      (i) => i.categoria || "Sin categoría"
    );

    // Proyectos SEA dentro del radio
    const proyInside = allProyectos.filter(
      (p) => p.latitud != null && p.longitud != null && haversineKm(center, p.latitud, p.longitud) <= r
    );
    const estado = (s: string | null) => norm(s);
    const sea = {
      total: proyInside.length,
      aprobados: proyInside.filter((p) => estado(p.estadoProyecto).includes("aprobad")).length,
      enEvaluacion: proyInside.filter((p) => {
        const s = estado(p.estadoProyecto);
        return s.includes("calificac") || s.includes("evaluac") || s.includes("admision");
      }).length,
      rechazados: proyInside.filter((p) => estado(p.estadoProyecto).includes("rechaz")).length,
    };

    // Proyectos agrupados por Sector productivo
    const sectorMap = new Map<string, number>();
    proyInside.forEach((p) => {
      const sector = (p.sectorProductivo || "Sin sector").trim() || "Sin sector";
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + 1);
    });
    const sectores = Array.from(sectorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([sector, count]) => ({ sector, count }));

    const capasTotal = capasGroups.reduce((s, g) => s + g.total, 0);
    const ambienteTotal = ambienteGroups.reduce((s, g) => s + g.total, 0);

    // Heurística de potencial
    const score = sea.aprobados * 2 + sea.enEvaluacion + capasTotal - ambienteTotal * 2;
    let potencial: { label: string; color: string; dot: string };
    if (score >= 8) potencial = { label: "Potencial Alto", color: "text-emerald-300", dot: "bg-emerald-400" };
    else if (score >= 3) potencial = { label: "Potencial Medio", color: "text-amber-300", dot: "bg-amber-400" };
    else potencial = { label: "Potencial Bajo", color: "text-rose-300", dot: "bg-rose-400" };

    return { capasGroups, capasTotal, ambienteGroups, ambienteTotal, sea, sectores, potencial };
  }, [allProyectos, allPoligonos, activos, radial.center, radial.radiusKm]);

  if (!visible || !data || !radial.center) return null;

  const { capasGroups, capasTotal, ambienteGroups, ambienteTotal, sea, sectores, potencial } = data;

  return (
    <aside
      className="fixed right-4 top-4 bottom-4 w-[360px] z-[1100] flex flex-col rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 animate-in slide-in-from-right-4 fade-in duration-300"
      style={{
        background: "linear-gradient(180deg, #0a2236 0%, #071827 100%)",
        boxShadow: "0 20px 60px -10px rgba(0,0,0,0.5), 0 8px 20px -6px rgba(0,0,0,0.3)",
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500/15 ring-1 ring-sky-400/30">
              <MapPin className="h-4 w-4 text-sky-300" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-white leading-tight">Resumen Territorial</h2>
              <p className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Análisis Radial</p>
            </div>
          </div>
          <button
            onClick={() => setOpened(false)}
            className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Cerrar panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">Centro</div>
            <div className="text-[11px] font-mono text-white/90 mt-0.5 tabular-nums">
              {radial.center.lat.toFixed(3)}°, {radial.center.lng.toFixed(3)}°
            </div>
          </div>
          <div className="rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">Radio</div>
            <div className="text-[13px] font-bold text-white mt-0.5 tabular-nums">{radial.radiusKm} km</div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/10">
          <Sparkles className="h-3.5 w-3.5 text-sky-300" />
          <span className={`h-2 w-2 rounded-full ${potencial.dot}`} />
          <span className={`text-[12px] font-semibold ${potencial.color}`}>{potencial.label}</span>
          <span className="ml-auto text-[10px] text-white/40">IA</span>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
        {/* Capas */}
        <section>
          <SectionHeader icon={Layers} title="Capas" count={capasTotal} />
          {capasGroups.length === 0 ? (
            <p className="text-[11.5px] text-white/40 px-1">Sin capas dentro del radio.</p>
          ) : (
            <div className="space-y-2">
              {capasGroups.map((g) => (
                <CapaCard key={g.capa} capa={g.capa} total={g.total} categorias={g.categorias} />
              ))}
            </div>
          )}
        </section>

        {/* Medioambiente */}
        <section>
          <SectionHeader icon={Leaf} title="Medioambiente" count={ambienteTotal} />
          {ambienteGroups.length === 0 ? (
            <p className="text-[11.5px] text-white/40 px-1">Sin capas de medioambiente dentro del radio.</p>
          ) : (
            <div className="space-y-2">
              {ambienteGroups.map((g) => (
                <CapaCard key={g.capa} capa={g.capa} total={g.total} categorias={g.categorias} />
              ))}
            </div>
          )}
        </section>

        {/* Proyectos SEA */}
        <section>
          <SectionHeader icon={Building2} title="Proyectos SEA" count={sea.total} />
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            <div className="rounded-lg bg-emerald-500/10 ring-1 ring-emerald-400/20 px-2 py-1.5">
              <div className="text-[9px] uppercase tracking-wider text-emerald-300/70 font-semibold">Aprob.</div>
              <div className="text-[13px] font-bold text-emerald-200 tabular-nums">{sea.aprobados}</div>
            </div>
            <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-400/20 px-2 py-1.5">
              <div className="text-[9px] uppercase tracking-wider text-amber-300/70 font-semibold">En eval.</div>
              <div className="text-[13px] font-bold text-amber-200 tabular-nums">{sea.enEvaluacion}</div>
            </div>
            <div className="rounded-lg bg-rose-500/10 ring-1 ring-rose-400/20 px-2 py-1.5">
              <div className="text-[9px] uppercase tracking-wider text-rose-300/70 font-semibold">Rechaz.</div>
              <div className="text-[13px] font-bold text-rose-200 tabular-nums">{sea.rechazados}</div>
            </div>
          </div>
        </section>

        {/* Proyectos por Sector productivo */}
        <section>
          <SectionHeader icon={Briefcase} title="Sector productivo" count={sea.total} />
          {sectores.length === 0 ? (
            <p className="text-[11.5px] text-white/40 px-1">Sin proyectos dentro del radio.</p>
          ) : (
            <div className="space-y-1">
              {sectores.map(({ sector, count }) => {
                const max = Math.max(...sectores.map((s) => s.count), 1);
                const pct = (count / max) * 100;
                const c = colorFor(sector);
                return (
                  <div key={sector} className="space-y-1 px-1 py-1">
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="text-white/80 truncate pr-2">{sector}</span>
                      <span className="font-semibold text-white tabular-nums">{count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: c }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-[10px] text-white/30 text-center pt-2 pb-1">
          Cifras calculadas en tiempo real dentro del radio.
        </p>
      </div>
    </aside>
  );
}
