import { useEffect, useState } from 'react';
import { Layers, MapPin, TreePine, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterResultCounts {
  comunas?: number;
  activos?: number;
  poligonos?: number;
  planRegulador?: number;
  proyectos?: number;
}

interface MapResultsCounterProps {
  counts: FilterResultCounts;
  onClearAll?: () => void;
  hasActiveFilters: boolean;
  className?: string;
}

export default function MapResultsCounter({
  counts,
  onClearAll,
  hasActiveFilters,
  className,
}: MapResultsCounterProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const total =
    (counts.activos || 0) +
    (counts.poligonos || 0) +
    (counts.planRegulador || 0) +
    (counts.proyectos || 0);

  useEffect(() => {
    if (hasActiveFilters) {
      setIsVisible(true);
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [hasActiveFilters, total]);

  if (!isVisible) return null;

  const items: { icon: React.ReactNode; label: string; count: number; color: string }[] = [];

  if (counts.activos && counts.activos > 0) {
    items.push({ icon: <MapPin className="w-3 h-3" />, label: 'Activos', count: counts.activos, color: 'text-emerald-400' });
  }
  if (counts.proyectos && counts.proyectos > 0) {
    items.push({ icon: <Layers className="w-3 h-3" />, label: 'Proyectos', count: counts.proyectos, color: 'text-purple-400' });
  }
  if (counts.poligonos && counts.poligonos > 0) {
    items.push({ icon: <TreePine className="w-3 h-3" />, label: 'Polígonos', count: counts.poligonos, color: 'text-cyan-400' });
  }
  if (counts.planRegulador && counts.planRegulador > 0) {
    items.push({ icon: <FileText className="w-3 h-3" />, label: 'Plan Reg.', count: counts.planRegulador, color: 'text-violet-400' });
  }

  return (
    <div
      className={cn(
        'absolute top-4 left-1/2 -translate-x-1/2 z-[900]',
        'bg-card/95 border border-border rounded-xl',
        'px-4 py-2 flex items-center gap-3 shadow-lg',
        'transition-all duration-500',
        isAnimating && 'animate-scale-in',
        className
      )}
    >
      {/* Total */}
      <div className="flex items-center gap-1.5">
        <span className="text-primary font-bold text-sm tabular-nums">{total}</span>
        <span className="text-muted-foreground text-xs">resultados</span>
      </div>

      {/* Divider */}
      {items.length > 0 && <div className="w-px h-4 bg-muted" />}

      {/* Breakdown */}
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1">
          <span className={item.color}>{item.icon}</span>
          <span className="text-[10px] text-muted-foreground">{item.count}</span>
        </div>
      ))}

      {/* Clear button */}
      {onClearAll && (
        <>
          <div className="w-px h-4 bg-muted" />
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
            title="Quitar todos los filtros"
          >
            <X className="w-3 h-3" />
            <span>Limpiar</span>
          </button>
        </>
      )}
    </div>
  );
}
