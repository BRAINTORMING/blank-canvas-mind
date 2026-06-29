import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { DashboardProyecto } from '@/hooks/useDashboardProyectos';

interface Props {
  open: boolean;
  onClose: () => void;
  project: DashboardProyecto | null;
}

const Field = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <div className="flex justify-between py-2 border-b border-border">
    <span className="text-xs text-muted-foreground/60">{label}</span>
    <span className="text-xs text-foreground font-medium text-right max-w-[60%] truncate">{value ?? '—'}</span>
  </div>
);

export default function DashboardDetailModal({ open, onClose, project }: Props) {
  if (!project) return null;
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg bg-[#112E45] border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-foreground line-clamp-2">{project.nombre || 'Proyecto'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-0">
          <Field label="Inversión (MMU)" value={project.inversion?.toLocaleString('es-CL')} />
          <Field label="Estado" value={project.estadoProyecto} />
          <Field label="Región" value={project.region} />
          <Field label="Comuna" value={project.comuna} />
          <Field label="Provincia" value={project.provincia} />
          <Field label="Titular" value={project.titular} />
          <Field label="Sector Productivo" value={project.sectorProductivo} />
          <Field label="Tipo Presentación" value={project.tipoPresentacion} />
          <Field label="Tipo Proyecto" value={project.tipoProyecto} />
          <Field label="Fecha Presentación" value={project.fechaPresentacion} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
