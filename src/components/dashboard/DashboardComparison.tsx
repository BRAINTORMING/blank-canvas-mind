import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend,
} from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { DashboardProyecto } from '@/hooks/useDashboardProyectos';

const COLORS = ['#00E0FF', '#00C853', '#FFB300', '#FF4081'];

interface Props {
  open: boolean;
  onClose: () => void;
  projects: DashboardProyecto[];
}

export default function DashboardComparison({ open, onClose, projects }: Props) {
  if (projects.length < 2) return null;

  const maxInv = Math.max(...projects.map(p => p.inversion ?? 0), 1);
  const radarData = [
    { metric: 'Inversión', ...Object.fromEntries(projects.map((p, i) => [`p${i}`, ((p.inversion ?? 0) / maxInv) * 100])) },
    { metric: 'Titular', ...Object.fromEntries(projects.map((p, i) => [`p${i}`, p.titular ? Math.min(p.titular.length * 2, 100) : 0])) },
    { metric: 'Región', ...Object.fromEntries(projects.map((p, i) => [`p${i}`, p.region ? 80 : 10])) },
    { metric: 'Sector', ...Object.fromEntries(projects.map((p, i) => [`p${i}`, p.sectorProductivo ? 80 : 10])) },
    { metric: 'Estado', ...Object.fromEntries(projects.map((p, i) => [`p${i}`, p.estadoProyecto ? 80 : 10])) },
  ];

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#112E45] border-border">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            Comparación de Proyectos ({projects.length})
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${projects.length}, 1fr)` }}>
          {projects.map((p, i) => (
            <div key={p.id} className="border border-border rounded-lg p-4 space-y-3 bg-card" style={{ borderTopColor: COLORS[i], borderTopWidth: 3 }}>
              <h4 className="text-sm font-semibold text-foreground line-clamp-2">{p.nombre || '—'}</h4>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span className="text-muted-foreground/60">Inversión</span>
                  <span className="font-semibold text-foreground">{p.inversion?.toLocaleString('es-CL') ?? '—'} MMU</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground/60">Estado</span>
                  <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{p.estadoProyecto || '—'}</Badge>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground/60">Región</span><span>{p.region || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground/60">Comuna</span><span>{p.comuna || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground/60">Titular</span><span className="text-right max-w-[120px] truncate">{p.titular || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground/60">Fecha</span><span>{p.fechaPresentacion || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground/60">Sector</span><span className="text-right max-w-[120px] truncate">{p.sectorProductivo || '—'}</span></div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-lg p-4 mt-2 border border-border">
          <h4 className="text-sm font-semibold text-foreground mb-3">Comparación Visual</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1a3a54" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#8BA4B8' }} />
                <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                {projects.map((p, i) => (
                  <Radar key={p.id} name={p.nombre?.slice(0, 20) || `Proyecto ${i + 1}`} dataKey={`p${i}`}
                    stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.15} strokeWidth={2} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11, color: '#8BA4B8' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
