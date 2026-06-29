import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, LogOut, UserPlus, FilterX, LineChart } from "lucide-react";
import geodudexLogo from "@/assets/gdudex-logo.svg";
import { type PoligonoData, type PlanReguladorData } from "./ActivosLayerControl";
import IntelligenceProjects from "./IntelligenceProjects";
import RadialAnalysisControl from "./RadialAnalysisControl";
import CorredorBioceanico from "./CorredorBioceanico";
import { type Proyecto } from "@/hooks/useProyectos";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { CORREDOR_EVENT, type CorredorSelectionDetail } from "@/lib/corredorBioceanico";
import {
  SidebarFiltersProvider,
  RegionesYComunasFixed,
  CapasBaseSection,
  MedioambienteSection,
  PlanReguladorSection,
  SidebarSectionHeader,
  FavoritesSection,
} from "./sidebar/SidebarFilters";

interface AppSidebarProps {
  onFiltersChange?: (filters: { capas: string[]; categorias: string[]; poligonos: PoligonoData[]; planRegulador: PlanReguladorData[]; comunas: string[] }) => void;
  onResetView?: () => void;
  onProyectosChange?: (proyectos: Proyecto[]) => void;
  externalSearchText?: string;
  onSidebarToggle?: (isOpen: boolean) => void;
  onRegionChange?: (region: string) => void;
  onComunasChange?: (comunas: string[]) => void;
}

export function AppSidebar({
  onFiltersChange,
  onResetView,
  onProyectosChange,
  externalSearchText,
  onSidebarToggle,
  onRegionChange,
  onComunasChange,
}: AppSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedComunas, setSelectedComunas] = useState<string[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [hasActivosFilters, setHasActivosFilters] = useState(false);
  const [hasProyectosFilters, setHasProyectosFilters] = useState(false);
  const { user, signOut, hasPermission } = useAuth();
  const navigate = useNavigate();

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onSidebarToggle?.(newState);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const [radialActive, setRadialActive] = useState(false);
  const [corredorActive, setCorredorActive] = useState(false);

  useEffect(() => {
    const onRadial = (e: Event) => setRadialActive(Boolean((e as CustomEvent).detail?.active));
    const onCorredor = (e: Event) => {
      const d = (e as CustomEvent<CorredorSelectionDetail>).detail;
      setCorredorActive(Boolean(d?.selected?.length));
    };
    window.addEventListener("radial:set", onRadial);
    window.addEventListener(CORREDOR_EVENT, onCorredor);
    return () => {
      window.removeEventListener("radial:set", onRadial);
      window.removeEventListener(CORREDOR_EVENT, onCorredor);
    };
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setResetKey(prev => prev + 1);
    setSelectedRegion("");
    setSelectedComunas([]);
    onRegionChange?.("");
    onComunasChange?.([]);
    window.dispatchEvent(new CustomEvent("filters:clearAll"));
    onResetView?.();
  }, [onResetView, onRegionChange, onComunasChange]);

  const anyFilterActive = hasActivosFilters || hasProyectosFilters || radialActive || corredorActive;

  const showProyectos = hasPermission("proyectos");
  const showCreateUser = hasPermission("modulo_creacion_usuarios");
  const showRadial = hasPermission("analisis_radial");
  const showCorredor = hasPermission("corredor_bioceanico");
  const showInnovation = hasPermission("innovation_dashboard");

  return (
    <div className="relative">
      {/* Toggle */}
      <button
        onClick={handleToggle}
        className={cn(
          "absolute top-4 z-10 flex items-center justify-center w-6 h-12 rounded-r-lg transition-all duration-200",
          "bg-white border-0 hover:bg-[#EFF6FF]",
          isCollapsed ? "-left-3" : "left-[calc(100%-1px)]"
        )}
        style={{ boxShadow: "var(--shadow-1)" }}
        title={isCollapsed ? "Abrir panel" : "Cerrar panel"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-primary" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Sidebar */}
      <div
        className={cn(
          "w-[345px] h-[calc(100vh-24px)] rounded-2xl overflow-hidden transition-all duration-300 ease-out",
          "bg-white border-0 outline-none ring-0",
          isCollapsed
            ? "opacity-0 -translate-x-full pointer-events-none w-0"
            : "opacity-100 translate-x-0"
        )}
        style={{ boxShadow: "none" }}
      >
        <div className="flex flex-col h-full font-graphik">
          {/* Header — gdudex logo */}
          <div className="px-6 pt-8 pb-2">
            <img
              src={geodudexLogo}
              alt="Gdudex"
              className="h-20 w-auto object-contain select-none"
              draggable={false}
            />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 flex flex-col min-w-0">
            {anyFilterActive && (
              <div className="flex justify-end px-2 pb-1">
                <button
                  onClick={handleClearAllFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary transition-colors"
                  title="Quitar todos los filtros activos"
                >
                  <FilterX className="h-3.5 w-3.5" />
                  Restablecer filtros
                </button>
              </div>
            )}

            <SidebarFiltersProvider
              onFiltersChange={onFiltersChange}
              onResetView={onResetView}
              onRegionChange={(r) => { setSelectedRegion(r); onRegionChange?.(r); }}
              onComunasChange={(c) => { setSelectedComunas(c); onComunasChange?.(c); }}
              onHasFiltersChange={setHasActivosFilters}
              resetKey={resetKey}
            >
              {/* A. Ubicación — non-collapsible at top */}
              <RegionesYComunasFixed />

              {/* B. CAPAS DE DATOS */}
              <SidebarSectionHeader title="Capas de información territorial">
                Capas de Datos
              </SidebarSectionHeader>
              <div className="px-1 pt-1">
                <FavoritesSection />
                <CapasBaseSection />
                <MedioambienteSection />
                <PlanReguladorSection />
                {showCorredor && <CorredorBioceanico />}
              </div>

              {/* C. INTELIGENCIA */}
              {showRadial && (
                <>
                  <SidebarSectionHeader title="Herramientas de análisis territorial">
                    Inteligencia
                  </SidebarSectionHeader>
                  <div className="px-1 pt-1">
                    <RadialAnalysisControl selectedRegion={selectedRegion} />
                  </div>
                </>
              )}

              {/* D. NEGOCIO */}
              {showProyectos && (
                <>
                  <SidebarSectionHeader title="Cartera de proyectos del territorio">
                    Negocio
                  </SidebarSectionHeader>
                  <div className="px-1 pt-1">
                    <IntelligenceProjects
                      onFiltersChange={(proyectos) => onProyectosChange?.(proyectos)}
                      externalSearchText={externalSearchText}
                      selectedRegion={selectedRegion}
                      selectedComunas={selectedComunas}
                      resetKey={resetKey}
                      onHasFiltersChange={setHasProyectosFilters}
                    />
                  </div>
                </>
              )}
            </SidebarFiltersProvider>

            {/* Spacer pushes Administración to the bottom */}
            <div className="flex-1" />

            {/* E. ADMINISTRACIÓN */}
            {showCreateUser && (
              <>
                <SidebarSectionHeader title="Gestión de usuarios">
                  Administración
                </SidebarSectionHeader>
                <div className="px-1 pt-1">
                  <button
                    onClick={() => navigate("/admin")}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium text-foreground hover:bg-[#EFF6FF] transition-colors"
                    title="Crear o gestionar usuarios de la plataforma"
                  >
                    <UserPlus className="h-4 w-4 text-foreground/80" />
                    Agregar usuario
                  </button>
                </div>
              </>
            )}

            {showInnovation && (
              <>
                <SidebarSectionHeader title="Tablero estratégico de Innovation Accounting">
                  Estrategia
                </SidebarSectionHeader>
                <div className="px-1 pt-1">
                  <button
                    onClick={() => navigate("/innovation")}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium text-foreground hover:bg-[#EFF6FF] transition-colors"
                    title="Innovation Dashboard"
                  >
                    <LineChart className="h-4 w-4 text-foreground/80" />
                    Innovation Dashboard
                  </button>
                </div>
              </>
            )}
          </div>

          {/* F. Footer — perfil + cerrar sesión */}
          <div className="px-4 py-3 bg-white border-t border-[#F3F4F6]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-sm font-semibold uppercase">
                {(user?.email ?? "?").slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">
                  {user?.email?.split("@")[0] ?? "Usuario"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-md text-muted-foreground hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
