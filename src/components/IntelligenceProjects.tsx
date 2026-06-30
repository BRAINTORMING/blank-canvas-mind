import { useState, useEffect } from 'react';
import { Search, ChevronRight, Briefcase, Wheat, Zap, Building2, TrainFront, Droplets, Ship, Home, Factory, Mountain, MoreHorizontal, Fish, MapPinned, Trash2, LucideIcon, BarChart3, Lock } from 'lucide-react';
import { showPaidLockToast } from '@/lib/planLocks';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useProyectos, useFilteredProyectos, type ProyectoFilters, type Proyecto } from '@/hooks/useProyectos';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionTracking } from '@/contexts/SessionTrackingContext';
import { useNavigate } from 'react-router-dom';

const SECTORES_ICONS: Record<string, LucideIcon> = {
  'Agropecuario': Wheat,
  'Energía': Zap,
  'Equipamiento': Building2,
  'Infraestructura de Transporte': TrainFront,
  'Infraestructura Hidráulica': Droplets,
  'Infraestructura Portuaria': Ship,
  'Inmobiliarios': Home,
  'Instalaciones fabriles varias': Factory,
  'Minería': Mountain,
  'Otros': MoreHorizontal,
  'Pesca y Agricultura': Fish,
  'Planificación Territorial e inmobiliarios en Zonas': MapPinned,
  'Saneamiento Ambiental': Trash2,
};

// Status color mapping for the new design
const getEstadoStyle = (estado: string, isSelected: boolean) => {
  if (isSelected) {
    switch (estado) {
      case 'Aprobado':
        return 'bg-[hsl(145_63%_42%)] text-white pulse-approved';
      case 'Rechazado':
        return 'bg-destructive text-white';
      case 'En Calificación':
        return 'bg-amber-intel text-navy-deep';
      case 'Abandonado':
      case 'Caducado':
      case 'Desistido':
        return 'bg-gray-blue text-foreground';
      default:
        return 'bg-cyan-electric/80 text-navy-deep';
    }
  }
  switch (estado) {
    case 'Aprobado':
      return 'bg-[hsl(145_63%_42%)]/10 text-emerald-vibrant border border-emerald-vibrant/30 hover:bg-[hsl(145_63%_42%)]/20';
    case 'Rechazado':
      return 'bg-destructive/10 text-magenta-signal border border-magenta-signal/20 hover:bg-destructive/15';
    case 'En Calificación':
      return 'bg-amber-intel/10 text-amber-intel border border-amber-intel/20 hover:bg-amber-intel/15';
    case 'Abandonado':
    case 'Caducado':
    case 'Desistido':
      return 'bg-muted/30 text-muted-foreground border border-border/30 hover:bg-muted/50';
    default:
      return 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15';
  }
};

interface IntelligenceProjectsProps {
  onFiltersChange?: (proyectosFiltrados: Proyecto[]) => void;
  externalSearchText?: string;
  selectedRegion?: string;
  selectedComunas?: string[];
  resetKey?: number;
  onHasFiltersChange?: (hasFilters: boolean) => void;
}

export default function IntelligenceProjects({ onFiltersChange, externalSearchText, selectedRegion, selectedComunas, resetKey, onHasFiltersChange }: IntelligenceProjectsProps) {
  const { proyectos, loading, estadosUnicos, sectoresUnicos, inversionStats } = useProyectos(selectedRegion, selectedComunas);
  const { hasPermission, isFreePlan } = useAuth();
  const { trackModule } = useSessionTracking();
  const navigate = useNavigate();
  const showAnalyzer = hasPermission('analizador_proyectos');
  const lockEstadoSector = isFreePlan;
  
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    trackModule('proyectos', isOpen);
  }, [isOpen, trackModule]);
  const [searchText, setSearchText] = useState('');
  const [tipoDIA, setTipoDIA] = useState(false);
  const [tipoEIA, setTipoEIA] = useState(false);
  const [selectedEstados, setSelectedEstados] = useState<string[]>([]);
  const [selectedSectores, setSelectedSectores] = useState<string[]>([]);
  const [inversionRange, setInversionRange] = useState<[number, number]>([0, 1000]);

  useEffect(() => {
    if (inversionStats.max > 0) {
      setInversionRange([inversionStats.min, inversionStats.max]);
    }
  }, [inversionStats]);

  useEffect(() => {
    if (externalSearchText !== undefined) {
      setSearchText(externalSearchText);
    }
  }, [externalSearchText]);

  // External reset
  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setSearchText('');
      setTipoDIA(false);
      setTipoEIA(false);
      setSelectedEstados([]);
      setSelectedSectores([]);
      if (inversionStats.max > 0) {
        setInversionRange([inversionStats.min, inversionStats.max]);
      }
    }
  }, [resetKey]);

  const filters: ProyectoFilters = {
    searchText,
    tipoPresentacion: { DIA: tipoDIA, EIA: tipoEIA },
    estadosSeleccionados: selectedEstados,
    sectoresSeleccionados: selectedSectores,
    inversionMin: inversionRange[0],
    inversionMax: inversionRange[1],
  };

  const proyectosFiltrados = useFilteredProyectos(proyectos, filters);

  // Track if any project filters are active
  const hasProjectFilters = searchText.trim() !== '' || tipoDIA || tipoEIA || selectedEstados.length > 0 || selectedSectores.length > 0 || (inversionStats.max > 0 && (inversionRange[0] > inversionStats.min || inversionRange[1] < inversionStats.max));

  useEffect(() => {
    onHasFiltersChange?.(hasProjectFilters);
  }, [hasProjectFilters]);

  // Only emit filtered projects when a region is selected
  useEffect(() => {
    if (!selectedRegion) {
      onFiltersChange?.([]);
    } else {
      onFiltersChange?.(proyectosFiltrados);
    }
  }, [proyectosFiltrados, onFiltersChange, selectedRegion]);

  const impactoFiltrado = proyectosFiltrados.reduce((sum, p) => sum + (p.inversion || 0), 0);

  const toggleEstado = (estado: string) => {
    if (lockEstadoSector) { showPaidLockToast(); return; }
    setSelectedEstados(prev => prev.includes(estado) ? prev.filter(e => e !== estado) : [...prev, estado]);
  };

  const toggleSector = (sector: string) => {
    if (lockEstadoSector) { showPaidLockToast(); return; }
    setSelectedSectores(prev => prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]);
  };

  const formatInversion = (value: number): string => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}B`;
    if (value >= 1) return `${value.toFixed(0)}M`;
    return `${(value * 1000).toFixed(0)}K`;
  };

  const totalFiltersActive = selectedEstados.length + selectedSectores.length + (tipoDIA ? 1 : 0) + (tipoEIA ? 1 : 0);

  const estadosOrdenados = [
    'No calificado', 'En Calificación', 'Aprobado', 'Abandonado',
    'Caducado', 'Desistido', 'No Admitido a Tramitación', 'Rechazado'
  ].filter(e => estadosUnicos.includes(e) || estadosUnicos.length === 0);

  const displayEstados = estadosUnicos.length > 0 ? estadosOrdenados : estadosOrdenados;

  return (
    <div className="font-graphik">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#EFF6FF] text-foreground transition-colors duration-150 rounded-[13px] group">
            <div className="flex items-center gap-2.5 min-w-0" title="Cartera de proyectos del territorio con filtros e inversión">
              <Briefcase className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="flex flex-col items-start min-w-0">
                <span className="font-medium text-[13px] text-foreground tracking-tight truncate">Proyectos del Territorio</span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {proyectosFiltrados.length} resultados • <span className="text-emerald-vibrant font-semibold">${formatInversion(impactoFiltrado)} USD</span>
                </span>
              </div>
            </div>
            <ChevronRight className={cn(
              "h-4 w-4 text-[#9CA3AF] transition-transform duration-200 flex-shrink-0",
              isOpen && "rotate-90"
            )} />
          </button>
        </CollapsibleTrigger>


        <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 duration-200">
          <div className="px-3 pb-3 pt-1 space-y-4">

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar proyecto..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9 h-9 text-xs bg-input border-border rounded-xl focus:ring-1 focus:ring-primary/40 focus:border-primary/50 placeholder:text-muted-foreground text-foreground"
              />
            </div>

            {/* Investment Card */}
            <div className="rounded-xl p-4 border border-border bg-white">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-display font-bold tracking-tight text-foreground">
                    ${formatInversion(impactoFiltrado)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">USD</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium tracking-wide uppercase">Impacto Filtrado</p>

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Rango de Inversión</p>
                    <p className="text-[10px] text-primary font-mono font-medium">{formatInversion(inversionRange[0])} — {formatInversion(inversionRange[1])}</p>
                  </div>
                  <Slider
                    value={inversionRange}
                    onValueChange={(value) => setInversionRange(value as [number, number])}
                    min={inversionStats.min}
                    max={inversionStats.max}
                    step={1}
                    className="w-full [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-primary [&_[role=slider]]:border-0"
                  />
                </div>
              </div>
            </div>


            {/* Tipo de Presentación */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Tipo de Presentación</h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTipoDIA(!tipoDIA)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all duration-150",
                    tipoDIA
                      ? "glass-toggle active text-primary"
                      : "glass-toggle text-muted-foreground"
                  )}
                >
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    tipoDIA ? "bg-primary" : "bg-muted-foreground/40"
                  )} />
                  DIA
                </button>
                <button
                  onClick={() => setTipoEIA(!tipoEIA)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all duration-150",
                    tipoEIA
                      ? "glass-toggle active text-primary"
                      : "glass-toggle text-muted-foreground"
                  )}
                >
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    tipoEIA ? "bg-primary" : "bg-muted-foreground/40"
                  )} />
                  EIA
                </button>
              </div>
            </div>

            {/* Estado del Proyecto — vivid identity per status */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Estado del Proyecto</h4>
              <div className="flex flex-wrap gap-1.5">
                {displayEstados.map((estado) => (
                  <button
                    key={estado}
                    onClick={() => toggleEstado(estado)}
                    className={cn(
                      "relative px-2.5 py-1.5 text-[10px] rounded-lg font-medium transition-all duration-150",
                      "hover:scale-[1.03]",
                      lockEstadoSector
                        ? "bg-muted/40 text-muted-foreground/70 border border-border/60 hover:bg-muted/60 cursor-not-allowed pl-5"
                        : getEstadoStyle(estado, selectedEstados.includes(estado))
                    )}
                    title={lockEstadoSector ? 'Función bloqueada — disponible en plan de pago' : estado}
                    aria-disabled={lockEstadoSector}
                  >
                    {lockEstadoSector && (
                      <Lock className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-muted-foreground" />
                    )}
                    {estado}
                  </button>
                ))}
              </div>
            </div>

            {/* Sector Productivo — icon grid with tooltips */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Sector Productivo</h4>
              <div className="grid grid-cols-5 gap-1.5">
                {(sectoresUnicos.length > 0 ? sectoresUnicos : Object.keys(SECTORES_ICONS)).map((sector) => {
                  const IconComponent = SECTORES_ICONS[sector] || MoreHorizontal;
                  const isSelected = selectedSectores.includes(sector);
                  return (
                    <button
                      key={sector}
                      onClick={() => toggleSector(sector)}
                      className={cn(
                        "relative flex items-center justify-center p-2.5 rounded-xl transition-all duration-150 group",
                        "hover:scale-[1.03]",
                        lockEstadoSector
                          ? "bg-muted/40 text-muted-foreground/60 border border-border/60 cursor-not-allowed"
                          : isSelected
                            ? "glass-toggle active text-primary"
                            : "glass-toggle text-muted-foreground"
                      )}
                      title={lockEstadoSector ? 'Función bloqueada — disponible en plan de pago' : sector}
                      aria-disabled={lockEstadoSector}
                    >
                      <IconComponent className="h-4 w-4" />
                      {lockEstadoSector && (
                        <Lock className="absolute -top-1 -right-1 h-3 w-3 text-muted-foreground bg-white rounded-full p-[1px] border border-border" />
                      )}
                      {/* Tooltip */}
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-75 whitespace-nowrap pointer-events-none z-50 border border-primary/20 text-foreground" style={{ background: 'hsl(0 0% 100% / 0.98)', backdropFilter: 'blur(8px)', boxShadow: 'var(--shadow-2)' }}>
                        {lockEstadoSector ? '🔒 Plan de pago' : sector}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!selectedRegion && (
              <div className="flex items-center justify-center py-4">
                <span className="text-[10px] text-muted-foreground italic">Selecciona una región para ver proyectos</span>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-3 gap-2">
                <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] text-muted-foreground">Cargando proyectos...</span>
              </div>
            )}

            {/* Analyzer link */}
            {showAnalyzer && (
              <button
                onClick={() => navigate('/estrategia')}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20 transition-colors"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Hacer un análisis rápido de proyectos
              </button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
