import { useEffect, useState } from 'react';
import { ChevronRight, Route, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CORREDOR_ROUTES,
  CORREDOR_EVENT,
  CORREDOR_BASE_COLOR,
  type CorredorSelectionDetail,
} from '@/lib/corredorBioceanico';

export default function CorredorBioceanico() {
  const [open, setOpen] = useState(false);
  // Empty by default: the user must press "Chile" to enable the corridor.
  const [selected, setSelected] = useState<string[]>([]);

  // Broadcast current selection so MapView can update layer visibility/colors.
  useEffect(() => {
    const detail: CorredorSelectionDetail = { selected };
    window.dispatchEvent(new CustomEvent(CORREDOR_EVENT, { detail }));
  }, [selected]);

  // External clear (from "Quitar todos los filtros" in the sidebar)
  useEffect(() => {
    const onReset = () => setSelected([]);
    window.addEventListener('filters:clearAll', onReset);
    return () => window.removeEventListener('filters:clearAll', onReset);
  }, []);

  const allSelected = selected.length === CORREDOR_ROUTES.length;
  const chileOn = selected.length > 0;

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleChile = () => {
    // ON → select all routes (MapView zooms to fit the whole corridor).
    // OFF → clear selection (MapView returns to the initial globe view).
    setSelected(chileOn ? [] : CORREDOR_ROUTES.map(r => r.id));
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-[#EFF6FF] transition-colors duration-150 rounded-[13px]"
            title="Activa rutas del Corredor Bioceánico Capricornio"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Route className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-[13px] font-medium text-foreground truncate">
                Corredor Bioceánico
              </span>
            </div>
            <ChevronRight
              className={cn(
                'h-4 w-4 text-[#9CA3AF] transition-transform duration-200 flex-shrink-0',
                open ? 'rotate-90' : 'rotate-0'
              )}
            />
          </button>
        </CollapsibleTrigger>


        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 duration-200">
          <div className="px-3 pb-3 pt-2 space-y-2.5">
            {/* Master "Chile" toggle */}
            <button
              type="button"
              onClick={toggleChile}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors',
                chileOn
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-muted'
              )}
              aria-pressed={chileOn}
            >
              <span className="flex items-center gap-2">
                <Flag className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">Chile</span>
              </span>
              <span className="text-[10px] uppercase tracking-wide font-medium opacity-90">
                {chileOn ? 'Activo · zoom' : 'Activar y hacer zoom'}
              </span>
            </button>

            <ul className="space-y-1.5">
              {CORREDOR_ROUTES.map(route => {
                const checked = selected.includes(route.id);
                const swatch = allSelected ? CORREDOR_BASE_COLOR : route.color;
                return (
                  <li key={route.id}>
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(route.id)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      <span
                        className="inline-block h-2.5 w-5 rounded-full shrink-0"
                        style={{
                          backgroundColor: checked ? swatch : 'transparent',
                          border: `2px solid ${checked ? swatch : 'hsl(var(--border))'}`,
                        }}
                      />
                      <span className="text-xs text-foreground group-hover:text-primary transition-colors leading-tight">
                        {route.name}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <p className="text-[10px] text-muted-foreground leading-relaxed pt-1">
              Pasa el cursor sobre una ruta en el mapa para ver su nombre.
            </p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
