import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import type { DashboardProyecto } from '@/hooks/useDashboardProyectos';

const COLORS = [
  '#00E0FF', '#00C853', '#FFB300', '#FF4081', '#7C4DFF',
  '#2979FF', '#E040FB', '#76FF03', '#FF6E40', '#448AFF',
  '#00BFA5', '#FFAB00', '#536DFE', '#F9A825', '#00E676', '#FF5252',
];

const formatMMU = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString('es-CL');
};

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #1a3a54',
  fontSize: 10,
  backgroundColor: '#112E45',
  color: '#E6F1F8',
};

interface Props {
  filtered: DashboardProyecto[];
  estadoCounts: Record<string, number>;
  regionCounts: Record<string, number>;
}

export default function DashboardCharts({ filtered, estadoCounts }: Props) {
  const allRegionsData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(p => {
      if (p.region && p.inversion) map[p.region] = (map[p.region] || 0) + p.inversion;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([region, total]) => ({
        region: region.replace(/^Regi[oó]n\s+(de(l)?\s+)?/i, '').slice(0, 18),
        inversion: Math.round(total),
      }));
  }, [filtered]);

  const sectorPieData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(p => { if (p.sectorProductivo) map[p.sectorProductivo] = (map[p.sectorProductivo] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const donutData = useMemo(() => {
    return Object.entries(estadoCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [estadoCounts]);

  const timeline = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(p => {
      if (p.fechaPresentacion) {
        const key = p.fechaPresentacion.slice(0, 7);
        map[key] = (map[key] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([month, count]) => ({ month, count }));
  }, [filtered]);

  const investmentTrend = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(p => {
      if (p.fechaPresentacion && p.inversion) {
        const key = p.fechaPresentacion.slice(0, 7);
        map[key] = (map[key] || 0) + p.inversion;
      }
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([month, total]) => ({ month, total: Math.round(total) }));
  }, [filtered]);

  const topTitulares = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(p => { if (p.titular) map[p.titular] = (map[p.titular] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({
      name: name.length > 22 ? name.slice(0, 20) + '…' : name,
      count,
    }));
  }, [filtered]);

  const formatMonth = (m: string) => {
    const [y, mo] = m.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${months[parseInt(mo) - 1]} ${y.slice(2)}`;
  };

  const cardClass = "bg-[#112E45] border border-border rounded-lg p-2.5 hover:border-primary/20 transition-all hover:shadow-[0_0_15px_rgba(0,224,255,0.06)]";
  const titleClass = "text-[10px] font-semibold text-foreground mb-1";
  const gridStroke = '#1a3a54';
  const tickFill = '#8BA4B8';
  const chartH = 180;

  const renderCustomLabel = ({ name, percent, cx, x, y }: any) => {
    if (percent < 0.05) return null;
    const short = name.length > 10 ? name.slice(0, 8) + '…' : name;
    return (
      <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={8} fill="#8BA4B8">
        {short} {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
      <div className={cardClass}>
        <h3 className={titleClass}>Inversión por Región (MMU)</h3>
        <div style={{ height: Math.min(chartH, Math.max(120, allRegionsData.length * 18)) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={allRegionsData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis type="number" tickFormatter={formatMMU} tick={{ fontSize: 8, fill: tickFill }} />
              <YAxis type="category" dataKey="region" width={90} tick={{ fontSize: 8, fill: '#E6F1F8' }} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString('es-CL')} MMU`, 'Inversión']} contentStyle={tooltipStyle} />
              <Bar dataKey="inversion" fill="#00E0FF" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={cardClass}>
        <h3 className={titleClass}>Sector Productivo</h3>
        <div style={{ height: chartH }}>
          {sectorPieData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sectorPieData} cx="50%" cy="48%" outerRadius={60} paddingAngle={1} dataKey="value" label={renderCustomLabel} labelLine={{ strokeWidth: 1, stroke: '#2A3F55' }}>
                  {sectorPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number, name: string) => [v.toLocaleString('es-CL'), name]} contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className={cardClass}>
        <h3 className={titleClass}>Estado</h3>
        <div style={{ height: chartH }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={donutData} cx="50%" cy="48%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value" label={renderCustomLabel} labelLine={{ strokeWidth: 1, stroke: '#2A3F55' }}>
                {donutData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number, name: string) => [v.toLocaleString('es-CL'), name]} contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={cardClass}>
        <h3 className={titleClass}>Proyectos por Mes</h3>
        <div style={{ height: chartH }}>
          {timeline.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 8, fill: tickFill }} interval={Math.max(0, Math.floor(timeline.length / 6))} />
                <YAxis tick={{ fontSize: 8, fill: tickFill }} />
                <Tooltip labelFormatter={formatMonth} formatter={(v: number) => [v, 'Proyectos']} contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#7C4DFF" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className={cardClass}>
        <h3 className={titleClass}>Tendencia Inversión (MMU)</h3>
        <div style={{ height: chartH }}>
          {investmentTrend.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={investmentTrend} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 8, fill: tickFill }} interval={Math.max(0, Math.floor(investmentTrend.length / 6))} />
                <YAxis tick={{ fontSize: 8, fill: tickFill }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Tooltip labelFormatter={formatMonth} formatter={(v: number) => [v.toLocaleString('es-CL') + ' MMU', 'Inversión']} contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="total" stroke="#00E676" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className={cardClass}>
        <h3 className={titleClass}>Top Titulares</h3>
        <div style={{ height: chartH }}>
          {topTitulares.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTitulares} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis type="number" tick={{ fontSize: 8, fill: tickFill }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 8, fill: '#E6F1F8' }} />
                <Tooltip formatter={(v: number) => [v, 'Proyectos']} contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#2979FF" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
