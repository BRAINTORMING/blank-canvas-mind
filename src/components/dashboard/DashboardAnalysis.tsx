import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import type { DashboardProyecto } from '@/hooks/useDashboardProyectos';

const COLORS = ['#00E0FF', '#00C853', '#FFB300', '#FF4081', '#7C4DFF', '#2979FF', '#E040FB', '#76FF03'];

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #1a3a54',
  fontSize: 12,
  backgroundColor: '#112E45',
  color: '#E6F1F8',
};

interface Props {
  filtered: DashboardProyecto[];
}

export default function DashboardAnalysis({ filtered }: Props) {
  const timeline = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(p => {
      if (p.fechaPresentacion) {
        const key = p.fechaPresentacion.slice(0, 7);
        map[key] = (map[key] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-24).map(([month, count]) => ({ month, count }));
  }, [filtered]);

  const investmentTrend = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(p => {
      if (p.fechaPresentacion && p.inversion) {
        const key = p.fechaPresentacion.slice(0, 7);
        map[key] = (map[key] || 0) + p.inversion;
      }
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-24).map(([month, total]) => ({ month, total: Math.round(total) }));
  }, [filtered]);

  const topTitulares = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(p => { if (p.titular) map[p.titular] = (map[p.titular] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({
      name: name.length > 30 ? name.slice(0, 28) + '…' : name,
      count,
    }));
  }, [filtered]);

  const sectorData = useMemo(() => {
    const map: Record<string, { count: number; inversion: number }> = {};
    filtered.forEach(p => {
      if (p.sectorProductivo) {
        if (!map[p.sectorProductivo]) map[p.sectorProductivo] = { count: 0, inversion: 0 };
        map[p.sectorProductivo].count++;
        map[p.sectorProductivo].inversion += p.inversion ?? 0;
      }
    });
    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, v]) => ({ name: name.slice(0, 25), count: v.count, inversion: Math.round(v.inversion) }));
  }, [filtered]);

  const formatMonth = (m: string) => {
    const [y, mo] = m.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${months[parseInt(mo) - 1]} ${y.slice(2)}`;
  };

  const gridStroke = '#1a3a54';
  const tickFill = '#8BA4B8';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#112E45] border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Proyectos Presentados por Mes</h3>
          <div className="h-56">
            {timeline.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sin datos de fechas</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeline} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 10, fill: tickFill }} interval={Math.max(0, Math.floor(timeline.length / 8))} />
                  <YAxis tick={{ fontSize: 10, fill: tickFill }} />
                  <Tooltip labelFormatter={formatMonth} formatter={(v: number) => [v, 'Proyectos']} contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#00E0FF" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-[#112E45] border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Tendencia de Inversión (MMU)</h3>
          <div className="h-56">
            {investmentTrend.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sin datos de inversión</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={investmentTrend} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 10, fill: tickFill }} interval={Math.max(0, Math.floor(investmentTrend.length / 8))} />
                  <YAxis tick={{ fontSize: 10, fill: tickFill }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                  <Tooltip labelFormatter={formatMonth} formatter={(v: number) => [v.toLocaleString('es-CL') + ' MMU', 'Inversión']} contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="total" stroke="#00E676" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#112E45] border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top 5 Titulares por Proyectos</h3>
          <div className="space-y-3">
            {topTitulares.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground/60 w-5 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{t.name}</p>
                  <div className="w-full bg-card rounded-full h-1.5 mt-1">
                    <div className="h-1.5 rounded-full" style={{
                      width: `${(t.count / (topTitulares[0]?.count || 1)) * 100}%`,
                      backgroundColor: COLORS[i % COLORS.length],
                    }} />
                  </div>
                </div>
                <span className="text-xs font-semibold text-foreground">{t.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#112E45] border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Análisis por Sector Productivo</h3>
          <div className="space-y-2.5">
            {sectorData.map((s, i) => (
              <div key={s.name}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-muted-foreground truncate mr-2">{s.name}</span>
                  <span className="text-muted-foreground/60 whitespace-nowrap">{s.count} proy · {s.inversion.toLocaleString('es-CL')} MMU</span>
                </div>
                <div className="w-full bg-card rounded-full h-1.5">
                  <div className="h-1.5 rounded-full" style={{
                    width: `${(s.count / (sectorData[0]?.count || 1)) * 100}%`,
                    backgroundColor: COLORS[i % COLORS.length],
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
