import { useState, useEffect, useRef, useMemo } from 'react';
import { Layers, Filter, ChevronDown, ChevronRight, MapPin, Leaf, FileText } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { externalSupabase as supabase } from '@/integrations/supabase/externalClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRegionComunas } from '@/hooks/useRegionComunas';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionTracking } from '@/contexts/SessionTrackingContext';
import { fetchAllRows } from '@/lib/supabasePagination';

interface CapaWithCategorias {
  capa: string;
  categorias: string[];
}

// Export for compatibility with existing code - now populated from Supabase
export interface ComunaInfo {
  id: string;
  nombre: string;
  coordenadas: string;
}

export interface PoligonoData {
  capa: string;
  categoria: string;
  coordenadas: string;
  image?: string | null;
  descripcion?: string | null;
  etiqueta?: string | null;
  comuna?: string | null;
  region?: string | null;
}

export interface PlanReguladorData {
  capa: string;
  coordenadas: string;
}

interface PoligonoItem {
  categoria: string;
  coordenadas: string;
  image?: string | null;
  descripcion?: string | null;
  etiqueta?: string | null;
  comuna?: string | null;
  region?: string | null;
}

interface CategoriaGroup {
  categoria: string;
  poligonos: PoligonoItem[];
  isGroup: boolean;
}

interface MedioambienteCapaWithCategorias {
  capa: string;
  categorias: CategoriaGroup[];
}

// This will be populated dynamically from Supabase region_comunas table
// Kept for backward compatibility with other components
export let COMUNAS_TARAPACA: ComunaInfo[] = [];

interface ActivosLayerControlProps {
  onFiltersChange?: (filters: { capas: string[]; categorias: string[]; comunas: string[]; poligonos: PoligonoData[]; planRegulador: PlanReguladorData[] }) => void;
  onResetView?: () => void;
  onRegionChange?: (region: string) => void;
  onComunasChange?: (comunas: string[]) => void;
  resetKey?: number;
  onHasFiltersChange?: (hasFilters: boolean) => void;
}

export default function ActivosLayerControl({ onFiltersChange, onResetView, onRegionChange, onComunasChange, resetKey, onHasFiltersChange }: ActivosLayerControlProps) {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const { trackCapas, trackModule } = useSessionTracking();
  const { regionsWithComunas: allRegionsWithComunas, data: regionComunasData, loading: loadingComunas } = useRegionComunas();
  const { regionesPermitidas } = useAuth();

  // Filter regions based on user's allowed regions
  const regionsWithComunas = useMemo(() => {
    if (!regionesPermitidas || regionesPermitidas.length === 0) return allRegionsWithComunas;
    return allRegionsWithComunas.filter(r => 
      regionesPermitidas.some(allowed => {
        const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^regi[oó]n\s+(de(l)?\s+)?/i, '').replace(/[_\s]+/g, ' ').trim();
        const na = normalize(r.region);
        const nb = normalize(allowed);
        return na === nb || na.includes(nb) || nb.includes(na);
      })
    );
  }, [allRegionsWithComunas, regionesPermitidas]);

  const [capasWithCategorias, setCapasWithCategorias] = useState<CapaWithCategorias[]>([]);
  const [selectedCapas, setSelectedCapas] = useState<string[]>([]);
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [selectedComunas, setSelectedComunas] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [expandedCapas, setExpandedCapas] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const hadFiltersRef = useRef(false);
  const onFiltersChangeRef = useRef(onFiltersChange);
  const onResetViewRef = useRef(onResetView);
  
  const [isCapasOpen, setIsCapasOpen] = useState(false);
  const [isComunasOpen, setIsComunasOpen] = useState(false);
  const [isMedioambienteOpen, setIsMedioambienteOpen] = useState(false);
  const [isPlanReguladorOpen, setIsPlanReguladorOpen] = useState(false);
  
  const [medioambienteCapas, setMedioambienteCapas] = useState<MedioambienteCapaWithCategorias[]>([]);
  const [selectedMedioambienteCategorias, setSelectedMedioambienteCategorias] = useState<string[]>([]);
  const [expandedMedioambienteCapas, setExpandedMedioambienteCapas] = useState<string[]>([]);
  const [expandedMedioambienteCategorias, setExpandedMedioambienteCategorias] = useState<string[]>([]);
  const [allPoligonos, setAllPoligonos] = useState<PoligonoData[]>([]);
  
  // Plan Regulador state
  const [planReguladorCapas, setPlanReguladorCapas] = useState<string[]>([]);
  const [selectedPlanRegulador, setSelectedPlanRegulador] = useState<string[]>([]);
  const [allPlanReguladorData, setAllPlanReguladorData] = useState<PlanReguladorData[]>([]);

  // Update COMUNAS_TARAPACA when data loads (for backward compatibility)
  useEffect(() => {
    if (regionComunasData.length > 0) {
      COMUNAS_TARAPACA = regionComunasData.map(item => ({
        id: item.comuna.toLowerCase().replace(/\s+/g, '-'),
        nombre: item.comuna,
        coordenadas: item.coordenadas
      }));
    }
  }, [regionComunasData]);

  // Get comunas filtered by selected region
  const filteredComunas = selectedRegion 
    ? regionsWithComunas.find(r => r.region === selectedRegion)?.comunas || []
    : [];

  useEffect(() => {
    onFiltersChangeRef.current = onFiltersChange;
    onResetViewRef.current = onResetView;
  });

  useEffect(() => {
    if (!supabase) {
      console.error('External Supabase client not configured.');
      return;
    }

    loadFilterOptions();
    loadMedioambienteOptions();
    loadPlanReguladorOptions();
    
    const channel = supabase
      .channel('activos-mapa-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activos_mapa' }, () => {
        loadFilterOptions();
        toast({ title: "Datos actualizados", description: "Los filtros se han actualizado" });
      })
      .subscribe();

    const poligonosChannel = supabase
      .channel('poligonos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poligonos' }, () => {
        loadMedioambienteOptions();
        toast({ title: "Datos actualizados", description: "Los filtros de medioambiente se han actualizado" });
      })
      .subscribe();

    const planReguladorChannel = supabase
      .channel('plan-regulador-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_regulador' }, () => {
        loadPlanReguladorOptions();
        toast({ title: "Datos actualizados", description: "Los filtros de Plan Regulador se han actualizado" });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(poligonosChannel);
      supabase.removeChannel(planReguladorChannel);
    };
  }, []);

  useEffect(() => {
    const selectedPoligonos = allPoligonos.filter(p => {
      const uniqueKey = `${p.capa}::${p.categoria}::${p.etiqueta || ''}`;
      return selectedMedioambienteCategorias.includes(uniqueKey);
    });

    const selectedPlanReguladorData = allPlanReguladorData.filter(p => 
      selectedPlanRegulador.includes(p.capa)
    );
    
    onFiltersChangeRef.current?.({
      capas: selectedCapas,
      categorias: selectedCategorias,
      comunas: selectedComunas,
      poligonos: selectedPoligonos,
      planRegulador: selectedPlanReguladorData
    });
    
    const hasFilters = selectedCapas.length > 0 || selectedCategorias.length > 0 || selectedComunas.length > 0 || selectedMedioambienteCategorias.length > 0 || selectedPlanRegulador.length > 0 || selectedRegion !== '';
    
    onHasFiltersChange?.(hasFilters);
    
    if (!hasFilters && hadFiltersRef.current) {
      onResetViewRef.current?.();
    }
    hadFiltersRef.current = hasFilters;
  }, [selectedCapas, selectedCategorias, selectedComunas, selectedMedioambienteCategorias, allPoligonos, selectedPlanRegulador, allPlanReguladorData]);

  // Notify parent of comuna selection changes
  useEffect(() => {
    onComunasChange?.(selectedComunas);
  }, [selectedComunas]);

  // External reset
  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setSelectedCapas([]);
      setSelectedCategorias([]);
      setSelectedComunas([]);
      setSelectedRegion('');
      setSelectedMedioambienteCategorias([]);
      setSelectedPlanRegulador([]);
      setExpandedCapas([]);
      setExpandedMedioambienteCapas([]);
      setExpandedMedioambienteCategorias([]);
      onRegionChange?.('');
    }
  }, [resetKey]);

  // Session tracking: capas
  useEffect(() => {
    trackCapas(selectedCapas);
  }, [selectedCapas, trackCapas]);

  // Session tracking: modules
  useEffect(() => {
    trackModule('medioambiente', selectedMedioambienteCategorias.length > 0);
  }, [selectedMedioambienteCategorias, trackModule]);

  useEffect(() => {
    trackModule('plan_regulador', selectedPlanRegulador.length > 0);
  }, [selectedPlanRegulador, trackModule]);

  async function loadFilterOptions() {
    try {
      if (!supabase) return;
      const data = await fetchAllRows((from, to) =>
        supabase.from('activos_mapa')
          .select('capa, categoria, region')
          .eq('visible', true)
          .range(from, to)
      );

      // Filter by allowed regions
      const filtered = regionesPermitidas.length > 0
        ? (data || []).filter((item: any) => item.region && regionesPermitidas.some(allowed => {
            const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^regi[oó]n\s+(de(l)?\s+)?/i, '').replace(/[_\s]+/g, ' ').trim();
            return normalize(item.region).includes(normalize(allowed)) || normalize(allowed).includes(normalize(item.region));
          }))
        : (data || []);

      const capaMap = new Map<string, Set<string>>();
      filtered.forEach((item: any) => {
        if (item.capa) {
          if (!capaMap.has(item.capa)) capaMap.set(item.capa, new Set());
          if (item.categoria) capaMap.get(item.capa)!.add(item.categoria);
        }
      });

      const result: CapaWithCategorias[] = [];
      capaMap.forEach((categorias, capa) => {
        result.push({ capa, categorias: Array.from(categorias).sort() });
      });

      setCapasWithCategorias(result.sort((a, b) => a.capa.localeCompare(b.capa)));
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  }

  async function loadMedioambienteOptions() {
    try {
      if (!supabase) return;
      const data = await fetchAllRows((from, to) =>
        supabase.from('poligonos')
          .select('capa, categoria, coordenadas, image, descripcion, etiqueta, comuna, region')
          .range(from, to)
      );

      // Filter by allowed regions
      const filtered = regionesPermitidas.length > 0
        ? (data || []).filter((item: any) => item.region && regionesPermitidas.some(allowed => {
            const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^regi[oó]n\s+(de(l)?\s+)?/i, '').replace(/[_\s]+/g, ' ').trim();
            return normalize(item.region).includes(normalize(allowed)) || normalize(allowed).includes(normalize(item.region));
          }))
        : (data || []);

      setAllPoligonos(filtered);

      const capaMap = new Map<string, Map<string, PoligonoItem[]>>();
      data?.forEach(item => {
        if (item.capa && item.categoria && item.coordenadas) {
          if (!capaMap.has(item.capa)) capaMap.set(item.capa, new Map());
          const categoriaMap = capaMap.get(item.capa)!;
          if (!categoriaMap.has(item.categoria)) categoriaMap.set(item.categoria, []);
          categoriaMap.get(item.categoria)!.push({
            categoria: item.categoria,
            coordenadas: item.coordenadas,
            image: item.image,
            descripcion: item.descripcion,
            etiqueta: item.etiqueta,
            comuna: item.comuna,
            region: item.region
          });
        }
      });

      const result: MedioambienteCapaWithCategorias[] = [];
      capaMap.forEach((categoriaMap, capa) => {
        const categoriaGroups: CategoriaGroup[] = [];
        categoriaMap.forEach((poligonos, categoria) => {
          categoriaGroups.push({
            categoria,
            poligonos: poligonos.sort((a, b) => (a.etiqueta || '').localeCompare(b.etiqueta || '')),
            isGroup: poligonos.length > 1
          });
        });
        result.push({ capa, categorias: categoriaGroups.sort((a, b) => a.categoria.localeCompare(b.categoria)) });
      });

      setMedioambienteCapas(result.sort((a, b) => a.capa.localeCompare(b.capa)));
    } catch (error) {
      console.error('Error loading medioambiente options:', error);
    }
  }

  async function loadPlanReguladorOptions() {
    try {
      if (!supabase) return;
      const { data, error } = await (supabase as any)
        .from('plan_regulador')
        .select('capa, coordenadas');

      if (error) throw error;

      setAllPlanReguladorData(data || []);
      
      // Get unique capa names
      const uniqueCapas: string[] = [...new Set((data || []).map((item: any) => item.capa as string))].filter((c): c is string => Boolean(c)).sort();
      setPlanReguladorCapas(uniqueCapas);
    } catch (error) {
      console.error('Error loading plan regulador options:', error);
    }
  }

  const togglePlanRegulador = (capa: string) => {
    setSelectedPlanRegulador(prev => 
      prev.includes(capa) ? prev.filter(c => c !== capa) : [...prev, capa]
    );
  };

  const toggleCapa = (capa: string) => {
    setSelectedCapas(prev => {
      const isSelected = prev.includes(capa);
      if (isSelected) {
        const capaData = capasWithCategorias.find(c => c.capa === capa);
        if (capaData) {
          setSelectedCategorias(prevCats => prevCats.filter(cat => !capaData.categorias.includes(cat)));
        }
        return prev.filter(c => c !== capa);
      }
      return [...prev, capa];
    });
  };

  const toggleCategoria = (categoria: string, parentCapa: string) => {
    if (!selectedCapas.includes(parentCapa)) {
      setSelectedCapas(prev => [...prev, parentCapa]);
    }
    setSelectedCategorias(prev => prev.includes(categoria) ? prev.filter(c => c !== categoria) : [...prev, categoria]);
  };

  const toggleExpandCapa = (capa: string) => {
    setExpandedCapas(prev => prev.includes(capa) ? prev.filter(c => c !== capa) : [...prev, capa]);
  };

  const toggleComuna = (comunaId: string) => {
    setSelectedComunas(prev => prev.includes(comunaId) ? prev.filter(c => c !== comunaId) : [...prev, comunaId]);
  };

  const toggleMedioambientePoligono = (capa: string, categoria: string, etiqueta: string) => {
    const key = `${capa}::${categoria}::${etiqueta}`;
    setSelectedMedioambienteCategorias(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
  };

  const toggleExpandMedioambienteCapa = (capa: string) => {
    setExpandedMedioambienteCapas(prev => prev.includes(capa) ? prev.filter(c => c !== capa) : [...prev, capa]);
  };

  const toggleExpandMedioambienteCategoria = (capa: string, categoria: string) => {
    const key = `${capa}::${categoria}`;
    setExpandedMedioambienteCategorias(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
  };

  const getSelectedMedioambienteCategoriasCount = (capa: string): number => {
    return selectedMedioambienteCategorias.filter(key => key.startsWith(`${capa}::`)).length;
  };

  const totalFiltersActive = selectedCapas.length + selectedCategorias.length + selectedComunas.length + selectedMedioambienteCategorias.length + selectedPlanRegulador.length;

  const getSelectedCategoriasCount = (capa: string): number => {
    const capaData = capasWithCategorias.find(c => c.capa === capa);
    if (!capaData) return 0;
    return capaData.categorias.filter(cat => selectedCategorias.includes(cat)).length;
  };

  const selectAllCategoriasForCapa = (capaData: CapaWithCategorias) => {
    if (!selectedCapas.includes(capaData.capa)) {
      setSelectedCapas(prev => [...prev, capaData.capa]);
    }
    setSelectedCategorias(prev => {
      const newCats = capaData.categorias.filter(cat => !prev.includes(cat));
      return [...prev, ...newCats];
    });
  };

  const areAllCategoriasSelected = (capaData: CapaWithCategorias): boolean => {
    return capaData.categorias.every(cat => selectedCategorias.includes(cat));
  };

  const getAllMedioambienteKeysForCapa = (capa: string): string[] => {
    const capaData = medioambienteCapas.find(c => c.capa === capa);
    if (!capaData) return [];
    const keys: string[] = [];
    capaData.categorias.forEach(catGroup => {
      catGroup.poligonos.forEach(pol => {
        keys.push(`${capa}::${catGroup.categoria}::${pol.etiqueta || ''}`);
      });
    });
    return keys;
  };

  const selectAllMedioambienteCapa = (capa: string) => {
    const allKeys = getAllMedioambienteKeysForCapa(capa);
    setSelectedMedioambienteCategorias(prev => {
      const newKeys = allKeys.filter(key => !prev.includes(key));
      return [...prev, ...newKeys];
    });
  };

  const areAllMedioambienteCapaSelected = (capa: string): boolean => {
    const allKeys = getAllMedioambienteKeysForCapa(capa);
    return allKeys.length > 0 && allKeys.every(key => selectedMedioambienteCategorias.includes(key));
  };

  const getAllMedioambienteKeysForCategoriaGroup = (capa: string, categoria: string): string[] => {
    const capaData = medioambienteCapas.find(c => c.capa === capa);
    if (!capaData) return [];
    const catGroup = capaData.categorias.find(cg => cg.categoria === categoria);
    if (!catGroup) return [];
    return catGroup.poligonos.map(pol => `${capa}::${categoria}::${pol.etiqueta || ''}`);
  };

  const selectAllMedioambienteCategoriaGroup = (capa: string, categoria: string) => {
    const allKeys = getAllMedioambienteKeysForCategoriaGroup(capa, categoria);
    setSelectedMedioambienteCategorias(prev => {
      const newKeys = allKeys.filter(key => !prev.includes(key));
      return [...prev, ...newKeys];
    });
  };

  const areAllMedioambienteCategoriaGroupSelected = (capa: string, categoria: string): boolean => {
    const allKeys = getAllMedioambienteKeysForCategoriaGroup(capa, categoria);
    return allKeys.length > 0 && allKeys.every(key => selectedMedioambienteCategorias.includes(key));
  };

  return (
    <div className="overflow-hidden font-graphik">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3.5 hover:bg-secondary transition-colors duration-200 rounded-xl">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Filter className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-sm text-foreground">Filtros del Mapa</span>
              {totalFiltersActive > 0 && (
                <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                  {totalFiltersActive}
                </span>
              )}
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 duration-200">
          <div className="pt-2 space-y-3">
            {/* Capas */}
            {hasPermission('capas') && (<Collapsible open={isCapasOpen} onOpenChange={setIsCapasOpen}>
              <div className={cn("overflow-hidden rounded-xl transition-colors duration-200 border-l-2", isCapasOpen ? "bg-secondary/40" : "bg-transparent")} style={{ borderLeftColor: 'hsl(var(--primary))' }}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-3.5 hover:bg-secondary transition-colors duration-150 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-xs text-foreground">Capas</span>
                      {selectedCapas.length > 0 && (
                        <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
                          {selectedCapas.length}
                        </span>
                      )}
                    </div>
                    <ChevronDown className={cn(
                      "h-3.5 w-3.5 text-gray-400 transition-transform duration-200",
                      isCapasOpen && "rotate-180"
                    )} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 duration-200">
                  <div className="p-2 pt-0 space-y-1">
                    {capasWithCategorias.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground px-2 py-1">No hay capas disponibles</p>
                    ) : (
                      capasWithCategorias.map((capaData) => (
                        <div key={capaData.capa} className="rounded-lg bg-white border border-border/60">
                          <div className="flex items-center">
                            <button
                              onClick={() => toggleExpandCapa(capaData.capa)}
                              className="p-1.5 hover:bg-gray-50 transition-colors"
                            >
                              <ChevronRight className={cn(
                                "h-3 w-3 text-gray-400 transition-transform duration-150",
                                expandedCapas.includes(capaData.capa) && "rotate-90"
                              )} />
                            </button>
                            <div className="flex items-center gap-2 flex-1 py-1.5 pr-2">
                              <Checkbox
                                id={`capa-${capaData.capa}`}
                                checked={areAllCategoriasSelected(capaData)}
                                onCheckedChange={(checked) => {
                                  if (checked) selectAllCategoriasForCapa(capaData);
                                  else {
                                    setSelectedCategorias(prev => prev.filter(cat => !capaData.categorias.includes(cat)));
                                    setSelectedCapas(prev => prev.filter(c => c !== capaData.capa));
                                  }
                                }}
                                className="h-3.5 w-3.5 border-gray-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                              />
                              <Label htmlFor={`capa-${capaData.capa}`} className="text-[11px] cursor-pointer flex-1 font-medium text-foreground">
                                {capaData.capa}
                              </Label>
                              {getSelectedCategoriasCount(capaData.capa) > 0 && (
                                <span className="text-[9px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded font-medium">
                                  {getSelectedCategoriasCount(capaData.capa)}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {expandedCapas.includes(capaData.capa) && capaData.categorias.length > 0 && (
                            <div className="pl-6 pr-2 py-1.5 bg-muted/40 space-y-1 border-t border-border/50">
                              {capaData.categorias.map((categoria) => (
                                <div key={categoria} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`cat-${capaData.capa}-${categoria}`}
                                    checked={selectedCategorias.includes(categoria)}
                                    onCheckedChange={() => toggleCategoria(categoria, capaData.capa)}
                                    className="h-3 w-3 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                  />
                                  <Label htmlFor={`cat-${capaData.capa}-${categoria}`} className="text-[10px] cursor-pointer flex-1 text-muted-foreground">
                                    {categoria}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>)}

            {/* Regiones y Comunas */}
            {hasPermission('regiones_comunas') && (<Collapsible open={isComunasOpen} onOpenChange={setIsComunasOpen}>
              <div className={cn("overflow-hidden rounded-xl transition-colors duration-200 border-l-2", isComunasOpen ? "bg-secondary/40" : "bg-transparent")} style={{ borderLeftColor: '#FFB300' }}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-3.5 hover:bg-secondary transition-colors duration-150 rounded-xl">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-[#FFB300]" />
                      <span className="font-medium text-xs text-foreground">Regiones y Comunas</span>
                      {selectedComunas.length > 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
                          {selectedComunas.length}
                        </span>
                      )}
                    </div>
                    <ChevronDown className={cn(
                      "h-3.5 w-3.5 text-gray-400 transition-transform duration-200",
                      isComunasOpen && "rotate-180"
                    )} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 duration-200">
                  <div className="p-2 pt-0 space-y-2">
                    {/* Region Selector */}
                    {loadingComunas ? (
                      <p className="text-[11px] text-muted-foreground px-2 py-1">Cargando regiones...</p>
                    ) : regionsWithComunas.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground px-2 py-1">No hay regiones disponibles</p>
                    ) : (
                      <Select value={selectedRegion} onValueChange={(value) => {
                        setSelectedRegion(value);
                        // Auto-select all comunas of this region
                        const regionComunas = regionsWithComunas.find(r => r.region === value)?.comunas || [];
                        setSelectedComunas(regionComunas.map(c => c.comuna.toLowerCase().replace(/\s+/g, '-')));
                        onRegionChange?.(value);
                      }}>
                        <SelectTrigger className="h-8 text-[11px] bg-card border-border text-foreground">
                          <SelectValue placeholder="Selecciona una región" />
                        </SelectTrigger>
                        <SelectContent className="z-[9999] bg-popover border border-border shadow-lg">
                          {regionsWithComunas.map((regionData) => (
                            <SelectItem 
                              key={regionData.region} 
                              value={regionData.region} 
                              className="text-[11px] text-foreground cursor-pointer hover:bg-secondary focus:bg-secondary focus:text-foreground"
                            >
                              {regionData.region}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Comunas List (filtered by selected region) */}
                    {selectedRegion && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 py-1">
                            <Checkbox
                              id="select-all-comunas"
                              checked={filteredComunas.length > 0 && filteredComunas.every(c => selectedComunas.includes(c.comuna.toLowerCase().replace(/\s+/g, '-')))}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedComunas(filteredComunas.map(c => c.comuna.toLowerCase().replace(/\s+/g, '-')));
                                } else {
                                  setSelectedComunas([]);
                                }
                              }}
                              className="h-3 w-3 border-border data-[state=checked]:bg-[#FFB300] data-[state=checked]:border-[#FFB300]"
                            />
                            <Label htmlFor="select-all-comunas" className="text-[10px] cursor-pointer text-muted-foreground">
                              Seleccionar todas las comunas
                            </Label>
                        </div>
                        {filteredComunas.map((comunaData) => {
                          const comunaId = comunaData.comuna.toLowerCase().replace(/\s+/g, '-');
                          return (
                            <div key={comunaId} className="rounded-lg bg-white border border-border/60">
                              <div className="flex items-center gap-2 py-1.5 px-2">
                                <Checkbox
                                  id={`comuna-${comunaId}`}
                                  checked={selectedComunas.includes(comunaId)}
                                  onCheckedChange={() => toggleComuna(comunaId)}
                                  className="h-3.5 w-3.5 border-border data-[state=checked]:bg-[#FFB300] data-[state=checked]:border-[#FFB300]"
                                />
                                <Label htmlFor={`comuna-${comunaId}`} className="text-[11px] cursor-pointer flex-1 font-medium text-foreground">
                                  {comunaData.comuna}
                                </Label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {!selectedRegion && (
                      <p className="text-[10px] text-muted-foreground px-1">
                        Selecciona una región para ver sus comunas
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>)}

            {/* Medioambiente */}
            {hasPermission('medioambiente') && (<Collapsible open={isMedioambienteOpen} onOpenChange={setIsMedioambienteOpen}>
              <div className={cn("overflow-hidden rounded-xl transition-colors duration-200 border-l-2", isMedioambienteOpen ? "bg-secondary/40" : "bg-transparent")} style={{ borderLeftColor: '#00C853' }}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-3.5 hover:bg-secondary transition-colors duration-150 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Leaf className="h-3.5 w-3.5 text-[#00C853]" />
                      <span className="font-medium text-xs text-foreground">Medioambiente</span>
                      {selectedMedioambienteCategorias.length > 0 && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">
                          {selectedMedioambienteCategorias.length}
                        </span>
                      )}
                    </div>
                    <ChevronDown className={cn(
                      "h-3.5 w-3.5 text-gray-400 transition-transform duration-200",
                      isMedioambienteOpen && "rotate-180"
                    )} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 duration-200">
                  <div className="p-2 pt-0 space-y-1">
                    {medioambienteCapas.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground px-2 py-1">No hay datos disponibles</p>
                    ) : (
                      medioambienteCapas.map((capaData) => (
                        <div key={capaData.capa} className="rounded-lg bg-white border border-border/60">
                          <div className="flex items-center">
                            <button
                              onClick={() => toggleExpandMedioambienteCapa(capaData.capa)}
                              className="p-1.5 hover:bg-gray-50 transition-colors"
                            >
                              <ChevronRight className={cn(
                                "h-3 w-3 text-gray-400 transition-transform duration-150",
                                expandedMedioambienteCapas.includes(capaData.capa) && "rotate-90"
                              )} />
                            </button>
                            <div className="flex items-center gap-2 flex-1 py-1.5 pr-2">
                              <Checkbox
                                id={`medioambiente-capa-all-${capaData.capa}`}
                                checked={areAllMedioambienteCapaSelected(capaData.capa)}
                                onCheckedChange={(checked) => {
                                  if (checked) selectAllMedioambienteCapa(capaData.capa);
                                  else {
                                    const allKeys = getAllMedioambienteKeysForCapa(capaData.capa);
                                    setSelectedMedioambienteCategorias(prev => prev.filter(key => !allKeys.includes(key)));
                                  }
                                }}
                                className="h-3.5 w-3.5 border-gray-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                              />
                              <Label className="text-[11px] cursor-pointer flex-1 font-medium text-foreground" onClick={() => toggleExpandMedioambienteCapa(capaData.capa)}>
                                {capaData.capa}
                              </Label>
                              {getSelectedMedioambienteCategoriasCount(capaData.capa) > 0 && (
                                <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded font-medium">
                                  {getSelectedMedioambienteCategoriasCount(capaData.capa)}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {expandedMedioambienteCapas.includes(capaData.capa) && capaData.categorias.length > 0 && (
                            <div className="pl-4 pr-2 py-1.5 bg-muted/40 space-y-1 border-t border-border/50">
                              {capaData.categorias.map((catGroup) => (
                                <div key={`${capaData.capa}-${catGroup.categoria}`}>
                                  {catGroup.isGroup ? (
                                    <div className="rounded-md overflow-hidden border border-border">
                                      <div className="flex items-center bg-muted/60">
                                        <button
                                          onClick={() => toggleExpandMedioambienteCategoria(capaData.capa, catGroup.categoria)}
                                          className="p-1 hover:bg-secondary transition-colors"
                                        >
                                          <ChevronRight className={cn(
                                            "h-2.5 w-2.5 text-muted-foreground transition-transform duration-150",
                                            expandedMedioambienteCategorias.includes(`${capaData.capa}::${catGroup.categoria}`) && "rotate-90"
                                          )} />
                                        </button>
                                        <Checkbox
                                          id={`medioambiente-catgroup-all-${capaData.capa}-${catGroup.categoria}`}
                                          checked={areAllMedioambienteCategoriaGroupSelected(capaData.capa, catGroup.categoria)}
                                          onCheckedChange={(checked) => {
                                            if (checked) selectAllMedioambienteCategoriaGroup(capaData.capa, catGroup.categoria);
                                            else {
                                              const allKeys = getAllMedioambienteKeysForCategoriaGroup(capaData.capa, catGroup.categoria);
                                              setSelectedMedioambienteCategorias(prev => prev.filter(key => !allKeys.includes(key)));
                                            }
                                          }}
                                          className="h-3 w-3 border-border data-[state=checked]:bg-[#00C853] data-[state=checked]:border-[#00C853] mr-1.5"
                                        />
                                        <Label className="text-[10px] cursor-pointer flex-1 py-1 pr-2 text-muted-foreground font-medium" onClick={() => toggleExpandMedioambienteCategoria(capaData.capa, catGroup.categoria)}>
                                          {catGroup.categoria}
                                          <span className="ml-1 text-[9px] text-muted-foreground">({catGroup.poligonos.length})</span>
                                        </Label>
                                      </div>
                                      {expandedMedioambienteCategorias.includes(`${capaData.capa}::${catGroup.categoria}`) && (
                                        <div className="pl-5 pr-2 py-1 bg-muted/40 space-y-1 border-t border-border/50">
                                          {catGroup.poligonos.map((poligono, idx) => {
                                            const uniqueKey = `${capaData.capa}::${catGroup.categoria}::${poligono.etiqueta || ''}`;
                                            return (
                                              <div key={uniqueKey + idx} className="flex items-center gap-2">
                                                <Checkbox
                                                  id={`medioambiente-poligono-${uniqueKey}`}
                                                  checked={selectedMedioambienteCategorias.includes(uniqueKey)}
                                                  onCheckedChange={() => toggleMedioambientePoligono(capaData.capa, catGroup.categoria, poligono.etiqueta || '')}
                                                  className="h-2.5 w-2.5 border-border data-[state=checked]:bg-[#00C853] data-[state=checked]:border-[#00C853]"
                                                />
                                                <Label htmlFor={`medioambiente-poligono-${uniqueKey}`} className="text-[9px] cursor-pointer flex-1 text-muted-foreground">
                                                  {poligono.etiqueta || catGroup.categoria}
                                                </Label>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    catGroup.poligonos.map((poligono, idx) => {
                                      const uniqueKey = `${capaData.capa}::${catGroup.categoria}::${poligono.etiqueta || ''}`;
                                      return (
                                        <div key={uniqueKey + idx} className="flex items-center gap-2 py-0.5">
                                          <Checkbox
                                            id={`medioambiente-poligono-single-${uniqueKey}`}
                                            checked={selectedMedioambienteCategorias.includes(uniqueKey)}
                                            onCheckedChange={() => toggleMedioambientePoligono(capaData.capa, catGroup.categoria, poligono.etiqueta || '')}
                                            className="h-3 w-3 border-border data-[state=checked]:bg-[#00C853] data-[state=checked]:border-[#00C853]"
                                          />
                                          <Label htmlFor={`medioambiente-poligono-single-${uniqueKey}`} className="text-[10px] cursor-pointer flex-1 text-muted-foreground">
                                            {poligono.etiqueta || catGroup.categoria}
                                          </Label>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>)}

            {/* Plan Regulador */}
            {hasPermission('plan_regulador') && (<Collapsible open={isPlanReguladorOpen} onOpenChange={setIsPlanReguladorOpen}>
              <div className={cn("overflow-hidden rounded-xl transition-colors duration-200 border-l-2", isPlanReguladorOpen ? "bg-secondary/40" : "bg-transparent")} style={{ borderLeftColor: 'hsl(var(--primary))' }}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-3.5 hover:bg-secondary transition-colors duration-150 rounded-xl">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-xs text-foreground">Plan Regulador</span>
                      {selectedPlanRegulador.length > 0 && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                          {selectedPlanRegulador.length}
                        </span>
                      )}
                    </div>
                    <ChevronDown className={cn(
                      "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                      isPlanReguladorOpen && "rotate-180"
                    )} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 duration-200">
                  <div className="p-2 pt-0 space-y-1">
                    {planReguladorCapas.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground px-2 py-1">No hay datos disponibles</p>
                    ) : (
                      <>
                        {/* Select All / Deselect All buttons */}
                        <div className="flex items-center gap-2 px-1 py-1">
                          <button
                            onClick={() => setSelectedPlanRegulador([...planReguladorCapas])}
                            className="text-[10px] font-medium text-primary hover:text-foreground transition-colors duration-[120ms]"
                          >
                            Seleccionar todos
                          </button>
                          <span className="text-muted-foreground/60">|</span>
                          <button
                            onClick={() => setSelectedPlanRegulador([])}
                            className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-[120ms]"
                          >
                            Deseleccionar todos
                          </button>
                        </div>
                        {planReguladorCapas.map((capa) => (
                          <div key={capa} className="rounded-lg bg-white border border-border/60">
                            <div className="flex items-center gap-2 py-1.5 px-2">
                              <Checkbox
                                id={`plan-regulador-${capa}`}
                                checked={selectedPlanRegulador.includes(capa)}
                                onCheckedChange={() => togglePlanRegulador(capa)}
                                className="h-3.5 w-3.5 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <Label htmlFor={`plan-regulador-${capa}`} className="text-[11px] cursor-pointer flex-1 font-medium text-foreground">
                                {capa}
                              </Label>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>)}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}