import type { MonitoringLayerId } from "@/lib/monitoring/palettes";
import { LAYER_DEFS, FIRE_RISK_STOPS } from "@/lib/monitoring/palettes";

interface Props { active: MonitoringLayerId[] }

export default function Legend({ active }: Props) {
  const items = active
    .filter(id => id !== "wind" && id !== "firms")
    .map(id => {
      if (id === "fireRisk") {
        return { id, label: "Riesgo de Incendio", unit: "", stops: FIRE_RISK_STOPS };
      }
      const d = LAYER_DEFS[id as keyof typeof LAYER_DEFS];
      return d ? { id, label: d.label, unit: d.unit, stops: d.stops } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const specials: { id: string; label: string; note: string }[] = [];
  if (active.includes("wind")) specials.push({ id: "wind", label: "Viento", note: "Partículas — km/h" });
  if (active.includes("firms")) specials.push({ id: "firms", label: "Incendios Activos", note: "NASA FIRMS" });

  if (items.length === 0 && specials.length === 0) return null;

  return (
    <div className="absolute right-3 bottom-24 z-10 pointer-events-none">
      <div className="bg-white/95 backdrop-blur rounded-xl p-3 space-y-2.5 max-w-[240px]" style={{ boxShadow: "0 4px 20px -4px rgba(0,0,0,0.15)" }}>
        {items.map(it => (
          <div key={it.id}>
            <div className="text-[11px] font-semibold text-foreground mb-1">{it.label}{it.unit ? ` (${it.unit})` : ""}</div>
            <div className="h-2 rounded-full overflow-hidden" style={{
              background: `linear-gradient(to right, ${it.stops.map(s => s.c).join(",")})`,
            }} />
            <div className="flex justify-between text-[9.5px] text-muted-foreground mt-0.5">
              <span>{it.stops[0].label ?? it.stops[0].v}</span>
              <span>{it.stops[it.stops.length - 1].label ?? it.stops[it.stops.length - 1].v}</span>
            </div>
          </div>
        ))}
        {specials.map(s => (
          <div key={s.id} className="text-[11px]">
            <div className="font-semibold">{s.label}</div>
            <div className="text-muted-foreground text-[10px]">{s.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
