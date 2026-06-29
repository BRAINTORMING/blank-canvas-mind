import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BarChart3, Download, ChevronDown, ChevronUp, TableProperties, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardKPIs from '@/components/dashboard/DashboardKPIs';
import DashboardFiltersPanel from '@/components/dashboard/DashboardFilters';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import DashboardTable from '@/components/dashboard/DashboardTable';
import DashboardComparison from '@/components/dashboard/DashboardComparison';
import DashboardDetailModal from '@/components/dashboard/DashboardDetailModal';
import { useDashboardProyectos, type DashboardProyecto } from '@/hooks/useDashboardProyectos';
import logoAsset from '@/assets/LogoFull.svg';
import geodudexLogo from '@/assets/LogoFull.svg';

interface ProjectAnalyzerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProjectAnalyzerModal({ open, onOpenChange }: ProjectAnalyzerModalProps) {
  const {
    filtered, loading, error, filters, setFilters,
    uniqueRegiones, uniqueEstados, uniqueSectores, uniqueProvincias, uniqueComunas, kpis,
  } = useDashboardProyectos();

  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [detailProject, setDetailProject] = useState<DashboardProyecto | null>(null);
  const [tableExpanded, setTableExpanded] = useState(false);

  const inversionMax = filtered.reduce((max, p) => Math.max(max, p.inversion ?? 0), 0) || 10000;

  const exportCSV = () => {
    const headers = ['Nombre', 'Región', 'Comuna', 'Estado', 'Inversión MMU', 'Sector', 'Titular'];
    const rows = filtered.map(p => [p.nombre, p.region, p.comuna, p.estadoProyecto, p.inversion, p.sectorProductivo, p.titular].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proyectos-analisis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <img src={logoAsset} alt="Gdudex" className="h-8 w-auto object-contain" />
            <div className="h-6 w-px bg-gray-200" />
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h1 className="text-base font-semibold text-gray-900">Análisis Rápido de Proyectos</h1>
          </div>
          <Button onClick={exportCSV} variant="outline" size="sm" className="flex items-center gap-1.5 text-gray-700 border-gray-200">
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 bg-gray-50">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4">{error}</div>
          )}

          <DashboardKPIs data={kpis} loading={loading} />

          <div className="flex gap-6 mt-6">
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

            <div className="flex-1 space-y-4 min-w-0">
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between">
                {filters.regiones.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Seleccione una o más <span className="font-semibold text-blue-600">regiones</span> en el panel de filtros para cargar los proyectos.
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">
                    Mostrando <span className="font-semibold text-gray-900">{filtered.length.toLocaleString('es-CL')}</span> proyectos
                    en <span className="font-medium text-blue-600">{filters.regiones.join(', ')}</span>
                    {loading && <span className="ml-2 text-gray-400 animate-pulse">cargando...</span>}
                  </p>
                )}
              </div>

              <DashboardCharts
                filtered={filtered}
                estadoCounts={kpis.estadoCounts}
                regionCounts={kpis.regionCounts}
              />

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setTableExpanded(!tableExpanded)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <TableProperties className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-900">Tabla de Proyectos</span>
                    <span className="text-xs text-gray-500">({filtered.length.toLocaleString('es-CL')})</span>
                  </div>
                  {tableExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                {tableExpanded && (
                  <div className="border-t border-gray-100">
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

        <DashboardComparison open={compareOpen} onClose={() => setCompareOpen(false)} projects={filtered.filter(p => selected.includes(p.id))} />
        <DashboardDetailModal open={!!detailProject} onClose={() => setDetailProject(null)} project={detailProject} />
      </DialogContent>
    </Dialog>
  );
}
