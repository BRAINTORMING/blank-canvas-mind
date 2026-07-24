import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Route,
  Anchor,
  Factory,
  Warehouse,
  MapPinned,
  Globe,
  Lock,
  BrainCircuit,
} from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { showPaidLockToast } from '@/lib/planLocks';
import {
  LOGISTICS_CATEGORIES,
  LOGISTICS_EVENT,
  type LogisticsCategoryId,
  type LogisticsEventDetail,
} from '@/lib/logisticsData';
import CorredorBioceanico from './CorredorBioceanico';

const ICONS: Record<LogisticsCategoryId, React.ComponentType<{ className?: string }>> = {
  corredor: Route,
  puertos: Anchor,
  parques_industriales: Factory,
  centros_logisticos: Warehouse,
  zonas_pric: MapPinned,
};

export default function LogisticsIntelligence() {
  const { isFreePlan } = useAuth();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<LogisticsCategoryId | null>(null);
  const [activeCats, setActiveCats] = useState<Set<LogisticsCategoryId>>(new Set());

  // Broadcast active point-based categories to MapView.
  useEffect(() => {
    const detail: LogisticsEventDetail = {
      active: Array.from(activeCats).filter(id => id !== 'corredor'),
    };
    window.dispatchEvent(new CustomEvent(LOGISTICS_EVENT, { detail }));
  }, [activeCats]);

  // Respond to global "clear all filters" signal.
  useEffect(() => {
    const onReset = () => setActiveCats(new Set());
    window.addEventListener('filters:clearAll', onReset);
    return () => window.removeEventListener('filters:clearAll', onReset);
  }, []);

  const activeCount = activeCats.size;

  const toggleCategory = (id: LogisticsCategoryId) => {
    if (isFreePlan) { showPaidLockToast(); return; }
    setActiveCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: LogisticsCategoryId) => {
    setExpanded(prev => (prev === id ? null : id));
  };

  const counts = useMemo(() => {
    const m: Record<LogisticsCategoryId, number> = {
      corredor: 10, // number of corredor routes handled inside CorredorBioceanico
      puertos: 0,
      parques_industriales: 0,
      centros_logisticos: 0,
      zonas_pric: 0,
    };
    LOGISTICS_CATEGORIES.forEach(c => {
      if (c.id !== 'corredor') m[c.id] = c.points.length;
    });
    return m;
  }, []);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-[#EFF6FF] transition-colors duration-150 rounded-[13px] group"
            title="Centro de Inteligencia Logística — infraestructura estratégica"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex-shrink-0">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium text-[13px] text-foreground truncate">
                Inteligencia Logística
              </span>
              {isFreePlan && <Lock className="h-3 w-3 text-amber-500 flex-shrink-0" />}
              {activeCount > 0 && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                  {activeCount}
                </span>
              )}
            </div>
            <ChevronRight
              className={cn(
                'h-4 w-4 text-[#9CA3AF] transition-transform duration-200 flex-shrink-0',
                open && 'rotate-90'
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 duration-200">
          <div className="px-2 pt-1 pb-2 space-y-1.5">
            {/* Premium banner */}
            <div className="mx-1 mb-1 rounded-lg border border-[#E5E7EB] bg-gradient-to-br from-[#F8FAFC] to-white px-2.5 py-2 flex items-start gap-2">
              <BrainCircuit className="h-3.5 w-3.5 text-[#7C3AED] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold text-foreground leading-tight">
                  Centro de Inteligencia Logística
                </p>
                <p className="text-[9.5px] text-muted-foreground leading-snug mt-0.5">
                  Visualiza infraestructura estratégica y prepara decisiones asistidas por IA.
                </p>
              </div>
            </div>

            {LOGISTICS_CATEGORIES.map(cat => {
              const Icon = ICONS[cat.id];
              const isActive = activeCats.has(cat.id);
              const isExpanded = expanded === cat.id;
              const isCorredor = cat.id === 'corredor';
              return (
                <div
                  key={cat.id}
                  className={cn(
                    'rounded-lg border transition-all duration-200',
                    isActive
                      ? 'border-[color:var(--cat-color)] bg-[color:var(--cat-color)]/5 shadow-sm'
                      : 'border-[#EEF2F7] bg-white hover:border-[#E5E7EB] hover:bg-[#F8FAFC]'
                  )}
                  style={{ ['--cat-color' as any]: cat.color }}
                >
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <Checkbox
                      checked={isActive}
                      onCheckedChange={() => toggleCategory(cat.id)}
                      className="h-3.5 w-3.5"
                      style={{
                        borderColor: isActive ? cat.color : undefined,
                        backgroundColor: isActive ? cat.color : undefined,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => toggleExpand(cat.id)}
                      className="flex-1 flex items-center gap-2 min-w-0 text-left"
                    >
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-md flex-shrink-0 transition-transform group-hover:scale-105"
                        style={{
                          backgroundColor: `${cat.color}14`,
                          color: cat.color,
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-[12px] font-medium text-foreground truncate">
                        {cat.label}
                      </span>
                      <span
                        className="ml-auto text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${cat.color}14`,
                          color: cat.color,
                        }}
                      >
                        {counts[cat.id]}
                      </span>
                      <ChevronRight
                        className={cn(
                          'h-3.5 w-3.5 text-[#9CA3AF] transition-transform duration-200 flex-shrink-0',
                          isExpanded && 'rotate-90'
                        )}
                      />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-2 pb-2 pt-0.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                      {isCorredor ? (
                        <div className="rounded-md border border-[#EEF2F7] bg-white">
                          <CorredorBioceanico />
                        </div>
                      ) : (
                        <ul className="space-y-0.5">
                          {cat.points.map(p => (
                            <li
                              key={p.id}
                              className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-[#F8FAFC] transition-colors"
                            >
                              <span
                                className="mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11.5px] font-medium text-foreground leading-tight truncate">
                                  {p.name}
                                </p>
                                {p.description && (
                                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
                                    {p.description}
                                  </p>
                                )}
                              </div>
                              <span className="text-[9px] font-mono text-muted-foreground tabular-nums flex-shrink-0">
                                {p.lat.toFixed(2)}°, {p.lng.toFixed(2)}°
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <p className="text-[9.5px] text-muted-foreground leading-relaxed px-1 pt-1">
              Activa una categoría para visualizarla en el mapa. Próximamente:
              optimización de rutas y análisis predictivo con IA.
            </p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
