import { useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, X, Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import type { DashboardFilters as Filters } from '@/hooks/useDashboardProyectos';

export type { Filters };

interface DashboardFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  regiones: string[];
  comunas: string[];
  provincias: string[];
  estados: string[];
  sectores: string[];
  inversionMax: number;
}

function FilterSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border pb-2">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
        {title}
        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-90")} />
      </button>
      {open && <div className="mt-0.5 space-y-0.5 max-h-32 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>{children}</div>}
    </div>
  );
}

function CheckboxList({ items, selected, onChange }: { items: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (item: string) => {
    onChange(selected.includes(item) ? selected.filter(s => s !== item) : [...selected, item]);
  };
  return (
    <>
      {items.map(item => (
        <label key={item} className="flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-muted/50 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          <Checkbox checked={selected.includes(item)} onCheckedChange={() => toggle(item)} className="h-3 w-3 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
          <span className="truncate">{item}</span>
        </label>
      ))}
    </>
  );
}

export default function DashboardFiltersPanel({
  filters, onFiltersChange, regiones, comunas, provincias, estados, sectores, inversionMax,
}: DashboardFiltersProps) {
  const [collapsed, setCollapsed] = useState(false);

  const activeCount = [
    filters.regiones.length,
    filters.comunas.length,
    filters.provincias.length,
    filters.estados.length,
    filters.sectores.length,
    filters.titular.trim() ? 1 : 0,
    filters.inversionMin > 0 || filters.inversionMax < Infinity ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearAll = () => {
    onFiltersChange({
      regiones: [], comunas: [], provincias: [], estados: [], sectores: [],
      inversionMin: 0, inversionMax: Infinity, titular: '',
    });
  };

  const maxVal = inversionMax > 0 ? inversionMax : 10000;

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-3 z-10 flex items-center justify-center w-5 h-8 bg-[#112E45] border border-border rounded-r-lg hover:bg-muted"
      >
        {collapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronLeft className="w-3 h-3 text-muted-foreground" />}
      </button>

      <div className={cn(
        "bg-[#112E45] border border-border rounded-xl overflow-hidden transition-all duration-300",
        collapsed ? "w-0 opacity-0 pointer-events-none" : "w-56 opacity-100"
      )}>
        <div className="p-3 overflow-y-auto h-full max-h-[calc(100vh-180px)]" style={{ scrollbarWidth: 'thin' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">Filtros</span>
              {activeCount > 0 && (
                <span className="bg-primary text-[#0B1C2D] text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </div>
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5">
                <X className="w-2.5 h-2.5" /> Limpiar
              </button>
            )}
          </div>

          <div className="mb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Buscar titular..."
                value={filters.titular}
                onChange={(e) => onFiltersChange({ ...filters, titular: e.target.value })}
                className="pl-7 h-7 text-xs bg-card border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary/20"
              />
            </div>
          </div>

          <FilterSection title="Región" defaultOpen>
            <CheckboxList items={regiones} selected={filters.regiones} onChange={(v) => onFiltersChange({ ...filters, regiones: v, comunas: [] })} />
          </FilterSection>

          <FilterSection title="Comuna">
            {comunas.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/60 py-1">Seleccione una región</p>
            ) : (
              <CheckboxList items={comunas} selected={filters.comunas} onChange={(v) => onFiltersChange({ ...filters, comunas: v })} />
            )}
          </FilterSection>

          <FilterSection title="Provincia">
            <CheckboxList items={provincias} selected={filters.provincias} onChange={(v) => onFiltersChange({ ...filters, provincias: v })} />
          </FilterSection>

          <FilterSection title="Estado" defaultOpen>
            <CheckboxList items={estados} selected={filters.estados} onChange={(v) => onFiltersChange({ ...filters, estados: v })} />
          </FilterSection>

          <FilterSection title="Sector Productivo">
            <CheckboxList items={sectores} selected={filters.sectores} onChange={(v) => onFiltersChange({ ...filters, sectores: v })} />
          </FilterSection>

          <FilterSection title="Inversión (MMU)">
            <div className="px-1 pt-1.5 pb-0.5">
              <Slider
                min={0}
                max={maxVal}
                step={Math.max(1, Math.floor(maxVal / 100))}
                value={[filters.inversionMin, filters.inversionMax === Infinity ? maxVal : filters.inversionMax]}
                onValueChange={([min, max]) => onFiltersChange({ ...filters, inversionMin: min, inversionMax: max >= maxVal ? Infinity : max })}
                className="w-full"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                <span>{filters.inversionMin.toLocaleString('es-CL')}</span>
                <span>{filters.inversionMax === Infinity ? `${maxVal.toLocaleString('es-CL')}+` : filters.inversionMax.toLocaleString('es-CL')}</span>
              </div>
            </div>
          </FilterSection>
        </div>
      </div>
    </div>
  );
}
