import { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Layers as LayersIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MapStyleOption {
  key: string;
  label: string;
  url: string;
  /** When true, uses standard basemap config and auto light preset (day/dusk/night). */
  auto?: boolean;
  description?: string;
}

export const MAP_STYLES: MapStyleOption[] = [
  { key: "auto-satellite", label: "Satelital Automático", url: "mapbox://styles/mapbox/standard-satellite", auto: true, description: "Satélite con luz que sigue la hora local" },
  { key: "auto-standard",  label: "Estándar Automático",  url: "mapbox://styles/mapbox/standard", auto: true, description: "Mapa estándar con luz automática" },
  { key: "satellite",      label: "Satelital",            url: "mapbox://styles/mapbox/satellite-v9", description: "Imagen satelital pura" },
  { key: "streets",        label: "Calles",               url: "mapbox://styles/mapbox/streets-v12", description: "Mapa urbano detallado" },
  { key: "outdoors",       label: "Outdoor",              url: "mapbox://styles/mapbox/outdoors-v12", description: "Relieve y senderos" },
  { key: "light",          label: "Modo Día",             url: "mapbox://styles/mapbox/light-v11", description: "Fondo claro minimal" },
  { key: "dark",           label: "Modo Noche",           url: "mapbox://styles/mapbox/dark-v11", description: "Fondo oscuro minimal" },
  { key: "monochrome",     label: "Monocromático",        url: "mapbox://styles/mapbox/navigation-day-v1", description: "Paleta neutra para análisis" },
];

const STORAGE_KEY = "gdudex:mapStyleKey";

export function getStoredMapStyle(): MapStyleOption {
  const DEFAULT = MAP_STYLES.find(s => s.key === "light") ?? MAP_STYLES[0];
  try {
    const k = localStorage.getItem(STORAGE_KEY);
    const found = MAP_STYLES.find(s => s.key === k);
    if (found) return found;
  } catch {}
  return DEFAULT;
}

interface Props {
  sidebarCollapsed?: boolean;
  sidebarWidth?: number;
  isMobile?: boolean;
}

export default function MapStyleSelector({ sidebarCollapsed = false, sidebarWidth = 360, isMobile = false }: Props) {
  const [current, setCurrent] = useState<MapStyleOption>(() => getStoredMapStyle());

  useEffect(() => {
    const onChange = () => setCurrent(getStoredMapStyle());
    window.addEventListener("storage", onChange);
    return () => window.removeEventListener("storage", onChange);
  }, []);

  const handlePick = (style: MapStyleOption) => {
    if (style.key === current.key) return;
    try { localStorage.setItem(STORAGE_KEY, style.key); } catch {}
    setCurrent(style);
    // Reload so map re-initializes cleanly with the new style.
    window.location.reload();
  };

  // Position: anchored to the right edge of the SearchBar.
  const desktopStyle: React.CSSProperties = {
    top: 16,
    left: sidebarCollapsed
      ? "calc(50% + 268px)"
      : `calc(${sidebarWidth}px + (100% - ${sidebarWidth}px) / 2 + 268px)`,
  };

  return (
    <div
      className={cn(
        "fixed z-[901] font-graphik",
        isMobile ? "top-3 right-3" : ""
      )}
      style={!isMobile ? desktopStyle : undefined}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            title="Cambiar tipo de mapa"
            aria-label="Cambiar tipo de mapa"
            className="h-11 w-11 rounded-2xl bg-white flex items-center justify-center transition-colors hover:bg-[#EFF6FF]"
            style={{ boxShadow: "0 8px 28px -8px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.04)" }}
          >
            <LayersIcon className="h-4 w-4 text-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[260px] rounded-2xl border border-border p-1.5 z-[9999]"
        >
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1.5">
            Tipo de mapa
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {MAP_STYLES.map(s => {
            const active = s.key === current.key;
            return (
              <DropdownMenuItem
                key={s.key}
                onClick={() => handlePick(s)}
                className="rounded-xl px-2.5 py-2 cursor-pointer focus:bg-[#EFF6FF]"
              >
                <div className="flex items-start gap-2 w-full">
                  <div className="mt-0.5 w-4 shrink-0">
                    {active && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-[12.5px] font-medium leading-tight", active ? "text-primary" : "text-foreground")}>
                      {s.label}
                    </div>
                    {s.description && (
                      <div className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
                        {s.description}
                      </div>
                    )}
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
