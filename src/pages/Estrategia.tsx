import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, Download, ChevronDown, ChevronUp, TableProperties, MapPin, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardKPIs from '@/components/dashboard/DashboardKPIs';
import DashboardFiltersPanel from '@/components/dashboard/DashboardFilters';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import DashboardTable from '@/components/dashboard/DashboardTable';
import DashboardComparison from '@/components/dashboard/DashboardComparison';
import DashboardDetailModal from '@/components/dashboard/DashboardDetailModal';
import { useDashboardProyectos, type DashboardProyecto } from '@/hooks/useDashboardProyectos';
import { useAuth } from '@/contexts/AuthContext';
import { PAID_LOCK_MESSAGE } from '@/lib/planLocks';
import geodudexLogo from '@/assets/LogoFull.svg';

function PaidPlanGate() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-lg">
        <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Función bloqueada</h2>
        <p className="text-sm text-muted-foreground mb-6">{PAID_LOCK_MESSAGE}</p>
        <Link to="/">
          <Button variant="default" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Volver al mapa
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function Estrategia() {
  const { isFreePlan } = useAuth();
  if (isFreePlan) return <PaidPlanGate />;
  return <EstrategiaInner />;
}

function EstrategiaInner() {
  const {
    filtered, loading, error, filters, setFilters,
    uniqueRegiones, uniqueEstados, uniqueSectores, uniqueProvincias, uniqueComunas, kpis,
  } = useDashboardProyectos();

  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [detailProject, setDetailProject] = useState<DashboardProyecto | null>(null);
  const [tableExpanded, setTableExpanded] = useState(false);

  const inversionMax = filtered.reduce((max, p) => Math.max(max, p.inversion ?? 0), 0) || 10000;
  const compareProjects = filtered.filter(p => selected.includes(p.id));

  const exportCSV = () => {
    const headers = ['Nombre', 'Región', 'Comuna', 'Estado', 'Inversión MMU', 'Sector', 'Titular'];
    const rows = filtered.map(p => [p.nombre, p.region, p.comuna, p.estadoProyecto, p.inversion, p.sectorProductivo, p.titular].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proyectos-estrategia-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen flex flex-col bg-card font-graphik overflow-hidden">
      {/* Header */}
      <header className="bg-[#112E45] border-b border-border flex-shrink-0 z-50">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
  <Link to="/">
    <img
      src={geodudexLogo}
      alt="Gdudex"
      className="h-12 w-auto object-contain"
      draggable={false}
    />
  </Link>

  <div className="h-4 w-px bg-muted" />

  <Link
    to="/"
    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-xs"
  >
    <ArrowLeft className="w-3.5 h-3.5" />
    <span className="hidden sm:inline">Volver</span>
  </Link>

  <div className="h-4 w-px bg-muted" />

  <div className="flex items-center gap-1.5">
    <BarChart3 className="w-4 h-4 text-primary" />
    <h1 className="text-sm font-semibold text-foreground">
      Dashboard Estratégico
    </h1>
  </div>
</div>
            <div className="flex items-center gap-1.5">
              <Button onClick={exportCSV} variant="outline" size="sm" className="h-7 text-xs flex items-center gap-1 text-muted-foreground border-border bg-transparent hover:bg-muted hover:text-foreground">
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
              <Link to="/">
                <Button variant="outline" size="sm" className="h-7 text-xs flex items-center gap-1 text-muted-foreground border-border bg-transparent hover:bg-muted hover:text-foreground">
                  <MapPin className="w-3 h-3" />
                  <span className="hidden sm:inline">Mapa</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 pt-2 flex-shrink-0">
          <div className="bg-red-900/30 border border-red-500/30 text-red-300 rounded-lg p-2 text-xs">{error}</div>
        </div>
      )}

      {/* Main content - fills remaining viewport */}
      <div className="flex-1 min-h-0 max-w-[1600px] w-full mx-auto px-3 sm:px-4 lg:px-6 py-2 flex flex-col gap-2 overflow-auto">
        <DashboardKPIs data={kpis} loading={loading} />

        <div className="flex gap-3 flex-1 min-h-0">
          <DashboardFiltersPanel
            filters={filters}
            onFiltersChange={setFilters}
            regiones={uniqueRegiones}
            comunas={uniqueComunas}
            provincias={uniqueProvincias}
            estados={uniqueEstados}
            sectores={uniqueSectores}
            inversionMax={inversionMax}
          />

          <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">
            {/* Summary */}
            <div className="bg-[#112E45] border border-border rounded-lg px-3 py-1.5 flex items-center justify-between flex-shrink-0">
              <p className="text-xs text-muted-foreground">
                Mostrando <span className="font-semibold text-foreground">{filtered.length.toLocaleString('es-CL')}</span> proyectos
                {filters.regiones.length > 0 && filters.regiones.length < 16 && (
                  <> en <span className="font-medium text-primary">{filters.regiones.join(', ')}</span></>
                )}
                {loading && <span className="ml-2 text-muted-foreground animate-pulse">cargando...</span>}
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-auto" style={{ scrollbarWidth: 'thin' }}>
              <DashboardCharts
                filtered={filtered}
                estadoCounts={kpis.estadoCounts}
                regionCounts={kpis.regionCounts}
              />

              {/* Collapsible Table */}
              <div className="bg-[#112E45] border border-border rounded-xl overflow-hidden mt-2">
                <button
                  onClick={() => setTableExpanded(!tableExpanded)}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <TableProperties className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">Tabla de Proyectos</span>
                    <span className="text-[10px] text-muted-foreground">({filtered.length.toLocaleString('es-CL')})</span>
                  </div>
                  {tableExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
                {tableExpanded && (
                  <div className="border-t border-border">
                    <DashboardTable
                      filtered={filtered}
                      selected={selected}
                      onSelectionChange={setSelected}
                      onCompare={() => setCompareOpen(true)}
                      onViewDetail={(p) => setDetailProject(p)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DashboardComparison
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        projects={compareProjects}
      />
      <DashboardDetailModal
        open={!!detailProject}
        onClose={() => setDetailProject(null)}
        project={detailProject}
      />
    </div>
  );
}
