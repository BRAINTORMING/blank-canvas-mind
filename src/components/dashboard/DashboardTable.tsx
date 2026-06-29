import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Eye, GitCompare, Settings2 } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { DashboardProyecto } from '@/hooks/useDashboardProyectos';

type SortKey = keyof DashboardProyecto;
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string; defaultVisible: boolean }[] = [
  { key: 'nombre', label: 'Proyecto', defaultVisible: true },
  { key: 'region', label: 'Región', defaultVisible: true },
  { key: 'comuna', label: 'Comuna', defaultVisible: false },
  { key: 'provincia', label: 'Provincia', defaultVisible: false },
  { key: 'inversion', label: 'Inversión MMU', defaultVisible: true },
  { key: 'estadoProyecto', label: 'Estado', defaultVisible: true },
  { key: 'sectorProductivo', label: 'Sector', defaultVisible: true },
  { key: 'titular', label: 'Titular', defaultVisible: true },
  { key: 'fechaPresentacion', label: 'Fecha Presentación', defaultVisible: false },
  { key: 'tipoPresentacion', label: 'Tipo', defaultVisible: false },
];

const estadoBadge = (estado: string | null) => {
  if (!estado) return <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">—</Badge>;
  const s = estado.toLowerCase();
  let cls = 'border-border text-muted-foreground bg-transparent';
  if (s.includes('aprobado')) cls = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  else if (s.includes('calificación') || s.includes('evaluación')) cls = 'bg-[#FFB300]/10 text-[#FFB300] border-[#FFB300]/30';
  else if (s.includes('rechazado') || s.includes('no admitido')) cls = 'bg-red-500/10 text-red-400 border-red-500/30';
  else if (s.includes('desistido')) cls = 'border-border text-muted-foreground/60 bg-transparent';
  return <Badge variant="outline" className={cn('text-[10px] font-medium', cls)}>{estado}</Badge>;
};

interface Props {
  filtered: DashboardProyecto[];
  selected: string[];
  onSelectionChange: (ids: string[]) => void;
  onCompare: () => void;
  onViewDetail: (p: DashboardProyecto) => void;
}

export default function DashboardTable({ filtered, selected, onSelectionChange, onCompare, onViewDetail }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('inversion');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [visibleCols, setVisibleCols] = useState<Set<SortKey>>(
    () => new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
  );
  const pageSize = 25;

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sorted.length / pageSize);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  };

  const toggleAll = () => {
    if (selected.length === paged.length) onSelectionChange([]);
    else onSelectionChange(paged.map(p => p.id));
  };

  const toggleOne = (id: string) => {
    onSelectionChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  const toggleCol = (key: SortKey) => {
    const next = new Set(visibleCols);
    if (next.has(key)) next.delete(key); else next.add(key);
    setVisibleCols(next);
  };

  const activeCols = COLUMNS.filter(c => visibleCols.has(c.key));

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/60" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  return (
    <div className="bg-[#112E45] border border-border rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">Proyectos</h3>
          <span className="text-xs text-muted-foreground">{sorted.length.toLocaleString('es-CL')} resultados</span>
          {selected.length > 0 && (
            <span className="text-xs text-primary font-medium">{selected.length} seleccionados</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected.length >= 2 && selected.length <= 4 && (
            <Button onClick={onCompare} variant="outline" size="sm" className="text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 bg-transparent">
              <GitCompare className="w-3.5 h-3.5" /> Comparar ({selected.length})
            </Button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs gap-1 border-border text-muted-foreground bg-transparent hover:bg-muted">
                <Settings2 className="w-3.5 h-3.5" /> Columnas
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2 bg-[#112E45] border-border" align="end">
              {COLUMNS.map(c => (
                <label key={c.key} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer text-sm text-muted-foreground">
                  <Checkbox checked={visibleCols.has(c.key)} onCheckedChange={() => toggleCol(c.key)} className="h-3.5 w-3.5 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                  {c.label}
                </label>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-card border-b border-border">
              <TableHead className="w-10">
                <Checkbox checked={paged.length > 0 && selected.length === paged.length} onCheckedChange={toggleAll} className="h-3.5 w-3.5 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
              </TableHead>
              {activeCols.map(c => (
                <TableHead key={c.key}>
                  <button onClick={() => handleSort(c.key)} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                    {c.label} <SortIcon col={c.key} />
                  </button>
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={activeCols.length + 2} className="text-center py-12 text-muted-foreground text-sm">
                  No se encontraron proyectos con los filtros actuales
                </TableCell>
              </TableRow>
            ) : (
              paged.map(p => (
                <TableRow key={p.id} className={cn("hover:bg-muted/40 transition-colors border-b border-border", selected.includes(p.id) && "bg-primary/5")}>
                  <TableCell>
                    <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggleOne(p.id)} className="h-3.5 w-3.5 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                  </TableCell>
                  {activeCols.map(c => (
                    <TableCell key={c.key} className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {c.key === 'estadoProyecto' ? estadoBadge(p.estadoProyecto) :
                       c.key === 'inversion' ? (p.inversion != null ? p.inversion.toLocaleString('es-CL') : '—') :
                       (p[c.key] as string) || '—'}
                    </TableCell>
                  ))}
                  <TableCell>
                    <button onClick={() => onViewDetail(p)} className="text-muted-foreground/60 hover:text-primary transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="text-xs h-7 px-2 border-border text-muted-foreground bg-transparent hover:bg-muted disabled:opacity-30">
              Anterior
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = page < 3 ? i : page > totalPages - 4 ? totalPages - 5 + i : page - 2 + i;
              if (p < 0 || p >= totalPages) return null;
              return (
                <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => setPage(p)}
                  className={cn("text-xs h-7 w-7 p-0", p === page ? "bg-primary text-[#0B1C2D] hover:bg-primary/90" : "border-border text-muted-foreground bg-transparent hover:bg-muted")}>
                  {p + 1}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="text-xs h-7 px-2 border-border text-muted-foreground bg-transparent hover:bg-muted disabled:opacity-30">
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
