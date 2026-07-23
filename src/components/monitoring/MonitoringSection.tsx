import { useState, useEffect } from "react";
import {
  Thermometer, Wind, Sun, Droplets, CloudRain, Cloud,
  Gauge, Flame, AlertTriangle, Zap, ChevronDown, ChevronRight,
} from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { MonitoringLayerId } from "@/lib/monitoring/palettes";

const ITEMS: { id: MonitoringLayerId; label: string; Icon: typeof Thermometer; hint: string }[] = [
  { id: "temperature", label: "Temperatura", Icon: Thermometer, hint: "Superficie térmica continua" },
  { id: "wind", label: "Viento", Icon: Wind, hint: "Partículas animadas WebGL" },
  { id: "solar", label: "Radiación Solar", Icon: Sun, hint: "Onda corta W/m²" },
  { id: "uv", label: "Índice UV", Icon: Zap, hint: "0 – 12+" },
  { id: "humidity", label: "Humedad", Icon: Droplets, hint: "% relativa" },
  { id: "rain", label: "Precipitación", Icon: CloudRain, hint: "Intensidad mm/h" },
  { id: "cloud", label: "Nubosidad", Icon: Cloud, hint: "Cobertura %" },
  { id: "pressure", label: "Presión Atmosférica", Icon: Gauge, hint: "hPa nivel del mar" },
  { id: "fireRisk", label: "Riesgo de Incendio", Icon: Flame, hint: "Índice combinado" },
  { id: "firms", label: "Incendios Activos", Icon: AlertTriangle, hint: "NASA FIRMS VIIRS" },
];

export const MONITORING_TOGGLE_EVENT = "monitoring:toggle";
export const MONITORING_TIME_EVENT = "monitoring:timeOffset";

export interface MonitoringSectionProps {
  disabled?: boolean;
}

export default function MonitoringSection({ disabled }: MonitoringSectionProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onExternal = (e: Event) => {
      const d = (e as CustomEvent).detail as { id: MonitoringLayerId; on: boolean } | undefined;
      if (!d) return;
      setActive(prev => ({ ...prev, [d.id]: d.on }));
    };
    window.addEventListener("monitoring:externalSet", onExternal);
    return () => window.removeEventListener("monitoring:externalSet", onExternal);
  }, []);

  const toggle = (id: MonitoringLayerId) => {
    const on = !active[id];
    setActive(prev => ({ ...prev, [id]: on }));
    window.dispatchEvent(new CustomEvent(MONITORING_TOGGLE_EVENT, { detail: { id, on } }));
  };

  const activeCount = Object.values(active).filter(Boolean).length;

  return (
    <div className={cn("select-none", disabled && "opacity-60 pointer-events-none")}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold text-foreground hover:bg-[#EFF6FF] transition-colors"
        title="Variables meteorológicas y ambientales en tiempo real"
      >
        <CloudRain className="h-4 w-4 text-primary" />
        <span className="flex-1 text-left">Monitoreo Territorial</span>
        {activeCount > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
            {activeCount}
          </span>
        )}
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-1 space-y-0.5 pl-1">
          {ITEMS.map(({ id, label, Icon, hint }) => (
            <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#EFF6FF] transition-colors">
              <Icon className="h-4 w-4 text-foreground/80 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium leading-tight">{label}</div>
                <div className="text-[10.5px] text-muted-foreground leading-tight truncate">{hint}</div>
              </div>
              <Switch checked={!!active[id]} onCheckedChange={() => toggle(id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
