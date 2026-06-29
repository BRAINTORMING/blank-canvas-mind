import { BarChart3, DollarSign, Activity, MapPin, Factory } from 'lucide-react';

interface KPIData {
  total: number;
  inversionTotal: number;
  activos: number;
  aprobados: number;
  topRegiones: [string, number][];
  topSectores: [string, number][];
}

interface DashboardKPIsProps {
  data: KPIData;
  loading: boolean;
}

const formatInversion = (value: number): string => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export default function DashboardKPIs({ data, loading }: DashboardKPIsProps) {
  const cards = [
    { label: 'Total Proyectos', value: data.total.toLocaleString('es-CL'), icon: BarChart3, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Inversión Total', value: formatInversion(data.inversionTotal), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'En Calificación', value: data.activos.toLocaleString('es-CL'), icon: Activity, color: 'text-[#FFB300]', bg: 'bg-[#FFB300]/10' },
    { label: 'Top Región', value: data.topRegiones[0]?.[0]?.replace(/^Regi[oó]n\s+(de(l)?\s+)?/i, '').slice(0, 14) || '—', subtitle: data.topRegiones[0] ? `${((data.topRegiones[0][1] / data.total) * 100).toFixed(0)}%` : undefined, icon: MapPin, color: 'text-[#2979FF]', bg: 'bg-[#2979FF]/10' },
    { label: 'Top Sector', value: data.topSectores?.[0]?.[0]?.slice(0, 14) || '—', subtitle: data.topSectores?.[0] ? `${((data.topSectores[0][1] / data.total) * 100).toFixed(0)}%` : undefined, icon: Factory, color: 'text-teal-400', bg: 'bg-teal-400/10' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 flex-shrink-0">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-[#112E45] border border-border rounded-lg p-2.5 transition-all hover:border-primary/25 hover:shadow-[0_0_15px_rgba(0,224,255,0.08)] group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">{card.label}</span>
            <div className={`${card.bg} ${card.color} p-1.5 rounded-md`}>
              <card.icon className="w-3 h-3" />
            </div>
          </div>
          {loading ? (
            <div className="h-5 bg-card rounded animate-pulse" />
          ) : (
            <>
              <p className="text-base font-bold text-foreground truncate">{card.value}</p>
              {card.subtitle && <p className="text-[10px] text-muted-foreground">{card.subtitle}</p>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
