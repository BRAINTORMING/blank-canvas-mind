import { useEffect, useRef, useState, useCallback } from 'react';
import { X, GripHorizontal, MapPin, ExternalLink, Star, Lock } from 'lucide-react';
import type { DetailPayload, DetailType } from '@/lib/mapPopups';
import { useFavorites, favoriteIdFor } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { showPaidLockToast } from '@/lib/planLocks';

interface PanelState {
  open: boolean;
  payload: DetailPayload | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_W = 380;
const DEFAULT_H = 480;
const MIN_W = 280;
const MIN_H = 240;

const formatInversion = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}B USD`;
  if (value >= 1) return `$${value.toFixed(0)}M USD`;
  return `$${(value * 1000).toFixed(0)}K USD`;
};

function titleFor(p: DetailPayload): string {
  const d = p.data || {};
  switch (p.type) {
    case 'activo': return d.etiqueta || 'Activo';
    case 'proyecto': return d.nombre || 'Proyecto';
    case 'poligono': return d.etiqueta || d.categoria || 'Área';
    case 'planRegulador': return d.capa || 'Plan Regulador';
    case 'comuna': return d.comuna || 'Comuna';
    case 'pric': return 'Consulta PRIC';
    default: return 'Detalles';
  }
}

function badgeFor(p: DetailPayload, hideProyectoEstado = false): string | null {
  const d = p.data || {};
  switch (p.type) {
    case 'activo': return d.capa || null;
    case 'proyecto': return hideProyectoEstado ? null : (d.estadoProyecto || null);
    case 'poligono': return d.capa || null;
    case 'planRegulador': return 'Plan Regulador';
    case 'comuna': return 'Comuna';
    case 'pric': return 'PRIC';
    default: return null;
  }
}

/** Inline "locked" placeholder rendered in place of sensitive proyecto fields. */
function LockedValue({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Desbloquee con un Plan de Pago"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/70 transition-colors select-none"
      style={{ filter: 'blur(0.5px)' }}
    >
      <Lock className="h-3 w-3" />
      <span className="tracking-wider">••••••••</span>
    </button>
  );
}

interface RowProps { label: string; value?: React.ReactNode }
const Row = ({ label, value }: RowProps) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-border last:border-0">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium shrink-0">{label}</span>
      <span className="text-[12.5px] text-foreground text-right break-words">{value}</span>
    </div>
  );
};

function Body({ payload }: { payload: DetailPayload }) {
  const d = payload.data || {};
  switch (payload.type) {
    case 'activo':
      return (
        <>
          {d.image && (
            <div className="rounded-xl overflow-hidden border border-border mb-3">
              <img src={d.image} alt={d.etiqueta} className="w-full h-40 object-cover" />
            </div>
          )}
          {d.descripcion && <p className="text-[13px] leading-relaxed text-foreground/80 mb-3">{d.descripcion}</p>}
          <div className="space-y-0">
            <Row label="Capa" value={d.capa} />
            <Row label="Categoría" value={d.categoria} />
            <Row label="Tipo" value={d.tipo} />
            <Row label="Faena" value={d.faena_explotacion} />
            <Row label="Minerales" value={d.minerales} />
            <Row label="Potencial" value={d.potencial ? `${d.potencial}%` : null} />
            <Row label="Región" value={d.region} />
            <Row label="Comuna" value={d.comuna} />
            <Row label="Oficina" value={d.direccion_oficina} />
            <Row label="Contacto" value={d.datos_contacto} />
            <Row label="Web" value={d.website ? (
              <a href={d.website} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                {d.website}<ExternalLink className="h-3 w-3" />
              </a>
            ) : null} />
            <Row label="Fuente" value={d.fuente_datos} />
          </div>
        </>
      );
    case 'proyecto':
      return (
        <div className="space-y-0">
          <Row label="Titular" value={d.titular} />
          <Row label="Inversión" value={<span className="font-semibold text-foreground">{formatInversion(d.inversion)}</span>} />
          <Row label="Estado" value={d.estadoProyecto} />
          <Row label="Sector" value={d.sectorProductivo} />
          <Row label="Tipo" value={d.tipoPresentacion} />
          <Row label="Región" value={d.region} />
          <Row label="Comuna" value={d.comuna} />
          <Row label="Provincia" value={d.provincia} />
          <Row label="Presentado" value={d.fechaPresentacion} />
        </div>
      );
    case 'poligono':
      return (
        <>
          {d.image && (
            <div className="rounded-xl overflow-hidden border border-border mb-3">
              <img src={d.image} alt={d.etiqueta} className="w-full h-40 object-cover" />
            </div>
          )}
          {d.descripcion && <p className="text-[13px] leading-relaxed text-foreground/80 mb-3">{d.descripcion}</p>}
          <div className="space-y-0">
            <Row label="Capa" value={d.capa} />
            <Row label="Categoría" value={d.categoria} />
            <Row label="Etiqueta" value={d.etiqueta} />
            <Row label="Región" value={d.region} />
            <Row label="Comuna" value={d.comuna} />
          </div>
        </>
      );
    case 'planRegulador':
      return (
        <div className="space-y-0">
          <Row label="Plan" value={d.capa} />
          <Row label="Comuna" value={d.comuna} />
        </div>
      );
    case 'comuna':
      return (
        <div className="space-y-0">
          <Row label="Comuna" value={d.comuna} />
          <Row label="Región" value={d.region} />
        </div>
      );
    case 'pric':
      return (
        <>
          <p className="text-[13px] leading-relaxed text-foreground/80 mb-3">
            Punto de consulta para evaluación del Plan Regulador Intercomunal Costero.
          </p>
        </>
      );
  }
}

function FavoriteButton({ payload, accentColor }: { payload: DetailPayload; accentColor: string }) {
  const { isFavorite, toggle } = useFavorites();
  const id = favoriteIdFor(payload);
  if (!id) return null;
  const active = isFavorite(id);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggle(payload); }}
      onMouseDown={(e) => e.stopPropagation()}
      title={active ? 'Quitar de favoritos' : 'Marcar como favorito'}
      aria-label={active ? 'Quitar de favoritos' : 'Marcar como favorito'}
      className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-border bg-white hover:bg-amber-50 transition-colors shrink-0"
    >
      <Star
        className="h-3.5 w-3.5 transition-colors"
        style={{
          color: active ? '#F59E0B' : '#9CA3AF',
          fill: active ? '#F59E0B' : 'transparent',
        }}
        strokeWidth={2}
      />
    </button>
  );
}

export default function MapDetailPanel() {
  const [state, setState] = useState<PanelState>(() => ({
    open: false,
    payload: null,
    x: Math.max(80, window.innerWidth - DEFAULT_W - 32),
    y: 96,
    width: DEFAULT_W,
    height: DEFAULT_H,
  }));

  const dragRef = useRef<{ startX: number; startY: number; px: number; py: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; w: number; h: number } | null>(null);

  const [closing, setClosing] = useState(false);

  const closeWithAnim = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setState((s) => ({ ...s, open: false }));
      setClosing(false);
    }, 200);
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<DetailPayload>).detail;
      if (!detail) return;
      setClosing(false);
      setState((s) => ({ ...s, open: true, payload: detail }));
    };
    const onClose = () => {
      setState((s) => {
        if (!s.open) return s;
        setClosing(true);
        setTimeout(() => setState((s2) => ({ ...s2, open: false })), 200);
        setTimeout(() => setClosing(false), 220);
        return s;
      });
    };
    window.addEventListener('map:open-detail', onOpen as EventListener);
    window.addEventListener('map:close-detail', onClose as EventListener);
    return () => {
      window.removeEventListener('map:open-detail', onOpen as EventListener);
      window.removeEventListener('map:close-detail', onClose as EventListener);
    };
  }, []);

  const onDragMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current; if (!d) return;
    const nx = d.px + (e.clientX - d.startX);
    const ny = d.py + (e.clientY - d.startY);
    setState((s) => ({
      ...s,
      x: Math.max(0, Math.min(window.innerWidth - s.width, nx)),
      y: Math.max(0, Math.min(window.innerHeight - 60, ny)),
    }));
  }, []);
  const onDragEnd = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    document.body.style.userSelect = '';
  }, [onDragMove]);
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, px: state.x, py: state.y };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  };

  const onResizeMove = useCallback((e: MouseEvent) => {
    const r = resizeRef.current; if (!r) return;
    setState((s) => ({
      ...s,
      width: Math.max(MIN_W, r.w + (e.clientX - r.startX)),
      height: Math.max(MIN_H, r.h + (e.clientY - r.startY)),
    }));
  }, []);
  const onResizeEnd = useCallback(() => {
    resizeRef.current = null;
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeEnd);
    document.body.style.userSelect = '';
  }, [onResizeMove]);
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, w: state.width, h: state.height };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeEnd);
  };

  if (!state.open || !state.payload) return null;
  const p = state.payload;
  const title = titleFor(p);
  const badge = badgeFor(p);
  const d = p.data || {};
  const location = [d.region, d.comuna].filter(Boolean).join(', ');
  const accentColor = p.color || 'hsl(204 93% 45%)';

  return (
    <div
      className={`fixed z-[1500] bg-white rounded-2xl flex flex-col overflow-hidden ${closing ? 'animate-out fade-out-0 slide-out-to-bottom-2 duration-200 ease-in' : 'animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out'}`}
      style={{
        left: state.x,
        top: state.y,
        width: state.width,
        height: state.height,
        boxShadow: '0 24px 60px -12px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.06)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header / drag handle — clean, no secondary bg, no border */}
      <div
        onMouseDown={startDrag}
        className="flex items-start gap-2 px-5 pt-4 pb-3 cursor-grab active:cursor-grabbing select-none"
      >
        <GripHorizontal className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground leading-snug tracking-tight">{title}</h3>
          {badge && (
            <div
              className="text-[11px] font-semibold uppercase tracking-wide mt-1"
              style={{ color: accentColor, letterSpacing: '0.04em' }}
            >
              {badge}
            </div>
          )}
          {location && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1.5">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{location}</span>
            </div>
          )}
        </div>
        <FavoriteButton payload={p} accentColor={accentColor} />
        <button
          onClick={closeWithAnim}
          onMouseDown={(e) => e.stopPropagation()}
          className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-1">
        <Body payload={p} />
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
        style={{
          background:
            'linear-gradient(135deg, transparent 50%, hsl(0 0% 70%) 50%, hsl(0 0% 70%) 60%, transparent 60%, transparent 70%, hsl(0 0% 70%) 70%, hsl(0 0% 70%) 80%, transparent 80%)',
        }}
      />
    </div>
  );
}
