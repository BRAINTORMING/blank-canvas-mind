import { useState, useEffect, useCallback } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import MapView from "@/components/MapView";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Filter, Map as MapIcon } from "lucide-react";
import ActivosLayerControl, { type PoligonoData, type PlanReguladorData } from "@/components/ActivosLayerControl";
import IntelligenceProjects from "@/components/IntelligenceProjects";
import { externalSupabase as supabase } from '@/integrations/supabase/externalClient';
import type { FilterAction } from "@/components/SearchBar";
import { type Proyecto, useProyectos } from "@/hooks/useProyectos";
import RecommendationWidget from "@/components/RecommendationWidget";
import RadialSummaryPanel from "@/components/RadialSummaryPanel";
import ResponsibleUseNotice from "@/components/ResponsibleUseNotice";
import { fetchAllRows } from "@/lib/supabasePagination";

// Ray-casting point-in-polygon over a 2D ring `[[lng, lat], ...]`.
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function geometryContainsPoint(geom: any, lng: number, lat: number): boolean {
  if (!geom || !geom.type) return false;
  if (geom.type === 'Polygon') {
    const rings = geom.coordinates as number[][][];
    if (!rings?.[0] || !pointInRing(lng, lat, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) {
      if (pointInRing(lng, lat, rings[i])) return false; // in a hole
    }
    return true;
  }
  if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates as number[][][][]) {
      if (!poly?.[0] || !pointInRing(lng, lat, poly[0])) continue;
      let inHole = false;
      for (let i = 1; i < poly.length; i++) {
        if (pointInRing(lng, lat, poly[i])) { inHole = true; break; }
      }
      if (!inHole) return true;
    }
    return false;
  }
  if (geom.type === 'GeometryCollection') {
    return (geom.geometries || []).some((g: any) => geometryContainsPoint(g, lng, lat));
  }
  return false;
}

// Checks whether a GeoJSON string (Feature / FeatureCollection / raw geometry)
// contains a given lng/lat point. Used to identify the Plan Regulador zones
// involved in a PRIC evaluation so the map only highlights those.
export function geoJsonContainsPoint(geoJsonString: string, lng: number, lat: number): boolean {
  try {
    const gj = JSON.parse(geoJsonString);
    if (gj.type === 'FeatureCollection') {
      return (gj.features || []).some((f: any) => f?.geometry && geometryContainsPoint(f.geometry, lng, lat));
    }
    if (gj.type === 'Feature') return geometryContainsPoint(gj.geometry, lng, lat);
    return geometryContainsPoint(gj, lng, lat);
  } catch {
    return false;
  }
}


export interface CapaWithCategorias {
  capa: string;
  categorias: string[];
}

export interface MedioambienteCapa {
  capa: string;
  categorias: { categoria: string; etiquetas: string[] }[];
}

export interface PlanReguladorItem {
  capa: string;
  coordenadas: string;
}

export default function Index() {
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<{ capas: string[]; categorias: string[]; comunas: string[]; poligonos: PoligonoData[]; planRegulador: PlanReguladorData[] }>({
    capas: [],
    categorias: [],
    comunas: [],
    poligonos: [],
    planRegulador: []
  });
  const [proyectosFiltrados, setProyectosFiltrados] = useState<Proyecto[]>([]);
  const [proyectoSearchText, setProyectoSearchText] = useState('');
  const [shouldResetView, setShouldResetView] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pricFormOpen, setPricFormOpen] = useState(false);
  const [mobileSelectedRegion, setMobileSelectedRegion] = useState<string>('');
  const [mobileSelectedComunas, setMobileSelectedComunas] = useState<string[]>([]);
  const [desktopSelectedRegion, setDesktopSelectedRegion] = useState<string>('');
  const [desktopSelectedComunas, setDesktopSelectedComunas] = useState<string[]>([]);

  const effectiveRegion = isMobile ? mobileSelectedRegion : desktopSelectedRegion;
  const effectiveComunas = isMobile ? mobileSelectedComunas : desktopSelectedComunas;
  const { proyectos: allProyectos } = useProyectos(effectiveRegion, effectiveComunas);
  
  const [availableCapas, setAvailableCapas] = useState<CapaWithCategorias[]>([]);
  const [availableMedioambiente, setAvailableMedioambiente] = useState<MedioambienteCapa[]>([]);
  const [allPoligonos, setAllPoligonos] = useState<PoligonoData[]>([]);
  const [allPlanRegulador, setAllPlanRegulador] = useState<PlanReguladorItem[]>([]);
  const [pricQueryPoint, setPricQueryPoint] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    loadAvailableFilters();
    loadPlanReguladorData();
  }, []);

  const loadAvailableFilters = async () => {
    if (!supabase) return;

    try {
      let activosData: any[] | null = null;
      try {
        activosData = await fetchAllRows((from, to) =>
          supabase.from('activos_mapa').select('capa, categoria').eq('visible', true).range(from, to)
        );
      } catch (e) {
        console.error('Error loading activos_mapa filters:', e);
      }
      if (activosData) {
        const capaMap = new Map<string, Set<string>>();
        activosData.forEach(item => {
          if (item.capa) {
            if (!capaMap.has(item.capa)) capaMap.set(item.capa, new Set());
            if (item.categoria) capaMap.get(item.capa)!.add(item.categoria);
          }
        });

        const result: CapaWithCategorias[] = [];
        capaMap.forEach((categorias, capa) => {
          result.push({ capa, categorias: Array.from(categorias) });
        });
        setAvailableCapas(result);
      }

      let poligonosData: any[] | null = null;
      try {
        poligonosData = await fetchAllRows((from, to) =>
          supabase.from('poligonos')
            .select('capa, categoria, coordenadas, image, descripcion, etiqueta, comuna, region')
            .range(from, to)
        );
      } catch (e) {
        console.error('Error loading poligonos filters:', e);
      }
      if (poligonosData) {
        setAllPoligonos(poligonosData as PoligonoData[]);
        
        const capaMap = new Map<string, Map<string, string[]>>();
        poligonosData.forEach(item => {
          if (item.capa && item.categoria) {
            if (!capaMap.has(item.capa)) capaMap.set(item.capa, new Map());
            const categoriaMap = capaMap.get(item.capa)!;
            if (!categoriaMap.has(item.categoria)) categoriaMap.set(item.categoria, []);
            categoriaMap.get(item.categoria)!.push(item.etiqueta || '');
          }
        });

        const result: MedioambienteCapa[] = [];
        capaMap.forEach((categoriaMap, capa) => {
          const categorias: { categoria: string; etiquetas: string[] }[] = [];
          categoriaMap.forEach((etiquetas, categoria) => {
            categorias.push({ categoria, etiquetas });
          });
          result.push({ capa, categorias });
        });
        setAvailableMedioambiente(result);
      }
    } catch (error) {
      console.error('Error loading available filters:', error);
    }
  };

  const loadPlanReguladorData = async () => {
    if (!supabase) return;

    try {
      const data = await fetchAllRows<PlanReguladorItem>((from, to) =>
        (supabase as any).from('plan_regulador').select('capa, coordenadas').range(from, to)
      );
      setAllPlanRegulador(data);
    } catch (error) {
      console.error('Error loading plan regulador data:', error);
    }
  };

  const handleResetView = () => {
    setShouldResetView(prev => !prev);
  };

  const handleFiltersFromAgent = useCallback((filterAction: FilterAction) => {
    // Handle PRIC query point for map marker
    if (filterAction.pricQueryPoint) {
      setPricQueryPoint(filterAction.pricQueryPoint);
    }

    // Handle Plan Regulador activation
    if (filterAction.activateAllPlanRegulador) {
      // When we have a query point (PRIC evaluation), activate ONLY the
      // polygons that actually contain the evaluated coordinate, so the map
      // zooms to the zones involved in the evaluation instead of drowning
      // them in every zone of the plan. The user can still add more zones
      // manually from the sidebar. When there is no query point, fall back
      // to activating all polygons (previous behavior for other triggers).
      const point = filterAction.pricQueryPoint;
      const relevant = point
        ? allPlanRegulador.filter(p => geoJsonContainsPoint(p.coordenadas, point.lng, point.lat))
        : allPlanRegulador;

      const selected = relevant.map(p => ({ capa: p.capa, coordenadas: p.coordenadas }));

      setFilters(prev => ({
        ...prev,
        planRegulador: selected,
      }));
      return;
    }


    if (filterAction.clearPrevious) {
      const matchingPoligonos = allPoligonos.filter(p => {
        const key = `${p.capa}::${p.categoria}::${p.etiqueta || ''}`;
        return filterAction.medioambienteKeys.includes(key);
      });

      setFilters({
        capas: filterAction.capas,
        categorias: filterAction.categorias,
        comunas: filterAction.comunas,
        poligonos: matchingPoligonos,
        planRegulador: []
      });
      
      setProyectoSearchText(filterAction.proyectoSearch || '');
      setPricQueryPoint(null);
    } else {
      const matchingPoligonos = allPoligonos.filter(p => {
        const key = `${p.capa}::${p.categoria}::${p.etiqueta || ''}`;
        return filterAction.medioambienteKeys.includes(key);
      });

      setFilters(prev => ({
        capas: filterAction.capas.length > 0 ? filterAction.capas : prev.capas,
        categorias: filterAction.categorias.length > 0 ? filterAction.categorias : prev.categorias,
        comunas: filterAction.comunas.length > 0 ? filterAction.comunas : prev.comunas,
        poligonos: matchingPoligonos.length > 0 ? matchingPoligonos : prev.poligonos,
        planRegulador: prev.planRegulador
      }));
      
      if (filterAction.proyectoSearch !== undefined) {
        setProyectoSearchText(filterAction.proyectoSearch || '');
      }
    }
  }, [allPoligonos, allPlanRegulador]);

  const handleSidebarToggle = (isCollapsed: boolean) => {
    setSidebarCollapsed(isCollapsed);
  };

  if (isMobile) {
    return (
      <div className="min-h-screen w-full flex flex-col relative">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="fixed top-4 left-4 z-[1100] bg-card border-border hover:border-primary/30"
            >
              <Filter className="h-5 w-5 text-primary" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-0 overflow-y-auto z-[1200] bg-card border-border">
            <SheetHeader className="p-4 border-b border-border font-graphik">
              <SheetTitle className="flex items-center gap-2 font-display text-foreground">
                <MapIcon className="h-5 w-5 text-primary" />
                <span>Geodude X</span>
              </SheetTitle>
            </SheetHeader>
            <div className="p-4">
              <ActivosLayerControl 
                onFiltersChange={setFilters} 
                onResetView={handleResetView}
                onRegionChange={setMobileSelectedRegion}
                onComunasChange={setMobileSelectedComunas}
              />
              <IntelligenceProjects onFiltersChange={setProyectosFiltrados} externalSearchText={proyectoSearchText} selectedRegion={mobileSelectedRegion} selectedComunas={mobileSelectedComunas} />
            </div>
          </SheetContent>
        </Sheet>
        
        <div className="w-full h-screen">
          <MapView 
            filters={filters} 
            onResetView={shouldResetView} 
            isMobile={isMobile}
            onFiltersApply={handleFiltersFromAgent}
            availableCapas={availableCapas}
            availableMedioambiente={availableMedioambiente}
            proyectosFiltrados={proyectosFiltrados}
            allProyectos={allProyectos}
            sidebarCollapsed={true}
            pricQueryPoint={pricQueryPoint}
            allPoligonos={allPoligonos}
            allPlanRegulador={allPlanRegulador.map(p => ({ capa: p.capa, coordenadas: p.coordenadas }))}
          />
        </div>
        <RecommendationWidget />
        <ResponsibleUseNotice />
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000] px-3.5 py-1 rounded-md bg-black/50 text-white text-[12px] font-medium pointer-events-none select-none">
          © GdudeX
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative">
      {/* Full screen map as background - shrinks when PRIC form is open */}
      <div
        className="absolute inset-0 transition-all duration-300"
        style={{ right: pricFormOpen ? '520px' : '0' }}
      >
        <MapView 
          filters={filters} 
          onResetView={shouldResetView} 
          isMobile={false}
          onFiltersApply={handleFiltersFromAgent}
          availableCapas={availableCapas}
          availableMedioambiente={availableMedioambiente}
          proyectosFiltrados={proyectosFiltrados}
          allProyectos={allProyectos}
          sidebarCollapsed={sidebarCollapsed}
          pricQueryPoint={pricQueryPoint}
          onPricFormOpenChange={setPricFormOpen}
          allPoligonos={allPoligonos}
          allPlanRegulador={allPlanRegulador.map(p => ({ capa: p.capa, coordenadas: p.coordenadas }))}
        />
      </div>
      
      {/* Floating sidebar */}
      <SidebarProvider>
        <div className="relative z-[1000] p-3">
          <AppSidebar 
            onFiltersChange={setFilters} 
            onResetView={handleResetView} 
            onProyectosChange={setProyectosFiltrados} 
            externalSearchText={proyectoSearchText}
            onSidebarToggle={handleSidebarToggle}
            onRegionChange={setDesktopSelectedRegion}
            onComunasChange={setDesktopSelectedComunas}
          />
        </div>
      </SidebarProvider>
      <RadialSummaryPanel allProyectos={allProyectos} allPoligonos={allPoligonos} />
      <RecommendationWidget />
      <ResponsibleUseNotice />

      {/* Copyright */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000] px-3.5 py-1 rounded-md bg-black/50 text-white text-[12px] font-medium pointer-events-none select-none">
        © GdudeX
      </div>
    </div>
  );
}
