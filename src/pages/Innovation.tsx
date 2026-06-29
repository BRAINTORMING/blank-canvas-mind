import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, FileSpreadsheet, FileText, Plus, Trash2 } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useInnovationData } from "@/hooks/innovation/useInnovationData";
import { useHypotheses, type Hypothesis } from "@/hooks/innovation/useHypotheses";
import {
  discoverLayerColumns, sessionDurationSec, median, avg, diffDays, ymd, ym, isoWeek,
  type SessionRow, type ProfileRow,
} from "@/lib/innovation/metrics";
import { categorize, formatDuration, intervalToSeconds, prettyLayerName } from "@/lib/innovation/layers";
import { exportExcel, exportPdf } from "@/lib/innovation/export";

const PALETTE = ["#40AEF8", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9", "#14B8A6", "#F97316", "#A855F7", "#10B981"];

// ─── Filters state ────────────────────────────────────────────────────────────
interface Filters {
  from: string; // yyyy-mm-dd
  to: string;
  region: string; // "" = all
  permiso: string; // "" = all
  user: string; // "" = all (email)
}

function defaultFilters(): Filters {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  return { from: ymd(from), to: ymd(to), region: "", permiso: "", user: "" };
}

// ─── KPI primitives ───────────────────────────────────────────────────────────
function Kpi({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/50 bg-primary/5" : ""}>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Innovation() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useInnovationData();
  const [filters, setFilters] = useState<Filters>(defaultFilters());
  const hyp = useHypotheses();

  // Derived dataset
  const computed = useMemo(() => {
    if (!data) return null;
    return computeAll(data.profiles, data.sessions, filters);
  }, [data, filters]);

  // Build region / permission option lists
  const optRegiones = useMemo(() => {
    const s = new Set<string>();
    data?.profiles.forEach((p) => p.regiones_permitidas?.forEach((r) => r && s.add(r)));
    return Array.from(s).sort();
  }, [data]);
  const optPermisos = useMemo(() => {
    const s = new Set<string>();
    data?.profiles.forEach((p) => p.permisos?.forEach((r) => r && s.add(r)));
    return Array.from(s).sort();
  }, [data]);
  const optUsers = useMemo(() => {
    const s = new Set<string>();
    data?.profiles.forEach((p) => p.email && s.add(p.email));
    return Array.from(s).sort();
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Cargando datos del territorio…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-destructive">Error cargando datos: {String((error as Error).message)}</div>
      </div>
    );
  }
  if (!computed) return null;

  const exportAll = (kind: "xlsx" | "pdf") => {
    const sheets = [
      { name: "NorthStar", rows: computed.northStarRows },
      { name: "Crecimiento", rows: computed.growthSeriesDaily },
      { name: "Engagement", rows: computed.userEngagementTable },
      { name: "Capas", rows: computed.layerRanking.map((r) => ({ Capa: r.name, Usos: r.uses, "Usuarios únicos": r.users, "% usuarios": r.pctUsers, "Tiempo total (s)": r.totalSec })) },
      { name: "Usuarios", rows: computed.usersTable },
    ];
    if (kind === "xlsx") exportExcel("innovation-dashboard", sheets);
    else
      exportPdf("innovation-dashboard", "Innovation Dashboard – GdudeX", [
        { title: "North Star Metrics", head: ["Métrica", "Valor"], body: computed.northStarRows.map((r) => [r.metric, r.value]) },
        { title: "Top 10 capas por uso", head: ["Capa", "Usos", "Usuarios", "%"], body: computed.layerRanking.slice(0, 10).map((r) => [r.name, r.uses, r.users, `${r.pctUsers.toFixed(1)}%`]) },
        { title: "Usuarios (resumen)", head: ["Email", "Sesiones", "Tiempo total", "IDT", "Intensidad"], body: computed.usersTable.slice(0, 25).map((u) => [u.email, u.sesiones, u.tiempoTotal, `${u.idt.toFixed(0)}%`, `${u.intensidad.toFixed(0)}%`]) },
      ]);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <div className="bg-background border-b sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Volver
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Innovation Dashboard</h1>
            <p className="text-xs text-muted-foreground">Innovation Accounting · Lean Startup · GdudeX</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportAll("xlsx")}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportAll("pdf")}>
            <FileText className="h-4 w-4 mr-1.5" /> PDF
          </Button>
        </div>

        {/* Global filters */}
        <div className="max-w-[1400px] mx-auto px-6 pb-3 grid grid-cols-1 md:grid-cols-5 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Desde</Label>
            <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Hasta</Label>
            <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Región</Label>
            <Select value={filters.region || "__all"} onValueChange={(v) => setFilters({ ...filters, region: v === "__all" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas</SelectItem>
                {optRegiones.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Permiso</Label>
            <Select value={filters.permiso || "__all"} onValueChange={(v) => setFilters({ ...filters, permiso: v === "__all" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                {optPermisos.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Usuario</Label>
            <Select value={filters.user || "__all"} onValueChange={(v) => setFilters({ ...filters, user: v === "__all" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__all">Todos</SelectItem>
                {optUsers.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* North Star strip */}
      <div className="max-w-[1400px] mx-auto px-6 pt-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {computed.northStarRows.map((r) => (
            <Kpi key={r.metric} label={r.metric} value={r.value} accent hint="North Star" />
          ))}
        </div>
      </div>

      {/* Modules */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <Tabs defaultValue="crecimiento">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="crecimiento">1 · Crecimiento</TabsTrigger>
            <TabsTrigger value="activacion">2 · Activación</TabsTrigger>
            <TabsTrigger value="retencion">3 · Retención</TabsTrigger>
            <TabsTrigger value="engagement">4 · Engagement</TabsTrigger>
            <TabsTrigger value="geo">5 · Geo Intelligence</TabsTrigger>
            <TabsTrigger value="feedback">6 · Feedback</TabsTrigger>
            <TabsTrigger value="usuarios">7 · Usuarios</TabsTrigger>
            <TabsTrigger value="ia">8 · Innovation Accounting</TabsTrigger>
          </TabsList>

          {/* 1 · Crecimiento */}
          <TabsContent value="crecimiento" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Kpi label="Usuarios registrados" value={computed.growth.totalUsers} />
              <Kpi label="Activos 7d" value={computed.growth.active7d} />
              <Kpi label="Activos 30d" value={computed.growth.active30d} />
              <Kpi label="Nuevos / día (avg)" value={computed.growth.newPerDayAvg.toFixed(1)} />
              <Kpi label="Nuevos / semana" value={computed.growth.newPerWeekAvg.toFixed(1)} />
              <Kpi label="Nuevos / mes" value={computed.growth.newPerMonthAvg.toFixed(1)} />
            </div>
            <Card><CardHeader><CardTitle className="text-sm">Evolución diaria de registros</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer><LineChart data={computed.growthSeriesDaily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" /><YAxis /><Tooltip /><Legend />
                  <Line type="monotone" dataKey="Nuevos" stroke={PALETTE[0]} dot={false} />
                  <Line type="monotone" dataKey="Acumulado" stroke={PALETTE[1]} dot={false} />
                </LineChart></ResponsiveContainer>
              </CardContent>
            </Card>
            <div className="grid md:grid-cols-2 gap-4">
              <Card><CardHeader><CardTitle className="text-sm">Por semana</CardTitle></CardHeader>
                <CardContent className="h-64"><ResponsiveContainer><BarChart data={computed.growthSeriesWeekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="week" /><YAxis /><Tooltip />
                  <Bar dataKey="Nuevos" fill={PALETTE[0]} />
                </BarChart></ResponsiveContainer></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Por mes</CardTitle></CardHeader>
                <CardContent className="h-64"><ResponsiveContainer><BarChart data={computed.growthSeriesMonthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" /><YAxis /><Tooltip />
                  <Bar dataKey="Nuevos" fill={PALETTE[2]} />
                </BarChart></ResponsiveContainer></CardContent></Card>
            </div>
          </TabsContent>

          {/* 2 · Activación */}
          <TabsContent value="activacion" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Iniciaron sesión ≥ 1 vez" value={computed.activation.withLogin} />
              <Kpi label="Nunca iniciaron sesión" value={computed.activation.neverLogin} />
              <Kpi label="Tiempo prom. registro → 1er login" value={`${computed.activation.avgDaysToFirst.toFixed(1)} días`} />
              <Kpi label="% Activación" value={`${computed.activation.activationPct.toFixed(1)}%`} accent />
            </div>
          </TabsContent>

          {/* 3 · Retención */}
          <TabsContent value="retencion" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi label="Retención D1" value={`${computed.retention.d1.toFixed(1)}%`} />
              <Kpi label="Retención D7" value={`${computed.retention.d7.toFixed(1)}%`} accent />
              <Kpi label="Retención D30" value={`${computed.retention.d30.toFixed(1)}%`} />
              <Kpi label="Usuarios recurrentes" value={computed.retention.recurrent} />
              <Kpi label="Frec. prom. (sesiones/sem)" value={computed.retention.freqPerWeek.toFixed(2)} />
            </div>
            <Card><CardHeader><CardTitle className="text-sm">Cohort de retención semanal</CardTitle></CardHeader>
              <CardContent className="overflow-auto">
                <table className="text-xs border-collapse">
                  <thead><tr><th className="p-2 text-left">Cohort</th><th className="p-2">Tamaño</th>
                    {computed.retention.cohortWeeks.map((w) => <th key={w} className="p-2">W+{w}</th>)}
                  </tr></thead>
                  <tbody>{computed.retention.cohorts.map((c) => (
                    <tr key={c.cohort}>
                      <td className="p-2 font-medium">{c.cohort}</td>
                      <td className="p-2 text-center">{c.size}</td>
                      {c.values.map((v, i) => (
                        <td key={i} className="p-2 text-center" style={{ background: v != null ? `hsl(204 93% ${100 - v * 0.5}%)` : "transparent" }}>
                          {v != null ? `${v.toFixed(0)}%` : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}</tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 4 · Engagement */}
          <TabsContent value="engagement" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Kpi label="Sesiones totales" value={computed.engagement.totalSessions} />
              <Kpi label="Sesiones / usuario" value={computed.engagement.avgPerUser.toFixed(2)} />
              <Kpi label="Tiempo prom." value={formatDuration(computed.engagement.avgSec)} accent />
              <Kpi label="Tiempo mediano" value={formatDuration(computed.engagement.medianSec)} />
              <Kpi label="Tiempo máx." value={formatDuration(computed.engagement.maxSec)} />
              <Kpi label="Tiempo mín." value={formatDuration(computed.engagement.minSec)} />
            </div>
            <Card><CardHeader><CardTitle className="text-sm">Top 10 usuarios más activos</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Usuario</TableHead><TableHead className="text-right">Sesiones</TableHead><TableHead className="text-right">Tiempo total</TableHead></TableRow></TableHeader>
                  <TableBody>{computed.userEngagementTable.slice(0, 10).map((u, i) => (
                    <TableRow key={u.Usuario}><TableCell>{i + 1}</TableCell><TableCell>{u.Usuario}</TableCell>
                      <TableCell className="text-right">{u.Sesiones}</TableCell>
                      <TableCell className="text-right">{u["Tiempo total"]}</TableCell></TableRow>
                  ))}</TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 5 · Geo Intelligence */}
          <TabsContent value="geo" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Capas distintas detectadas" value={computed.geo.layerCount} />
              <Kpi label="IDT promedio" value={`${computed.geo.idtAvg.toFixed(1)}%`} accent hint="Descubrimiento Territorial" />
              <Kpi label="Intensidad territorial prom." value={`${computed.geo.intensityAvg.toFixed(1)}%`} accent />
              <Kpi label="Tiempo total en capas" value={formatDuration(computed.geo.totalLayerSec)} />
            </div>

            <Card><CardHeader><CardTitle className="text-sm">Ranking de capas más utilizadas</CardTitle></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer><BarChart data={computed.layerRanking.slice(0, 15)} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" /><YAxis type="category" dataKey="name" width={140} />
                  <Tooltip /><Bar dataKey="uses" fill={PALETTE[0]} name="Usos" />
                </BarChart></ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card><CardHeader><CardTitle className="text-sm">Tiempo total por capa</CardTitle></CardHeader>
                <CardContent className="h-72"><ResponsiveContainer><BarChart data={computed.layerRanking.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" angle={-25} height={70} textAnchor="end" interval={0} fontSize={11} /><YAxis /><Tooltip formatter={(v: number) => formatDuration(v)} />
                  <Bar dataKey="totalSec" fill={PALETTE[2]} name="Segundos" />
                </BarChart></ResponsiveContainer></CardContent></Card>

              <Card><CardHeader><CardTitle className="text-sm">Distribución por categoría</CardTitle></CardHeader>
                <CardContent className="h-72"><ResponsiveContainer><PieChart>
                  <Pie data={computed.geo.categoryDist} dataKey="value" nameKey="name" outerRadius={100} label>
                    {computed.geo.categoryDist.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie><Tooltip /><Legend />
                </PieChart></ResponsiveContainer></CardContent></Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card><CardHeader><CardTitle className="text-sm">Top 10 · Más visitadas</CardTitle></CardHeader>
                <CardContent><TopList items={computed.geo.top.mostVisited} field="uses" /></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Top 10 · Mayor tiempo</CardTitle></CardHeader>
                <CardContent><TopList items={computed.geo.top.mostTime} field="time" /></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Top 10 · Mayor crecimiento</CardTitle></CardHeader>
                <CardContent><TopList items={computed.geo.top.fastestGrowing} field="growth" /></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Top 10 · Menor utilización</CardTitle></CardHeader>
                <CardContent><TopList items={computed.geo.top.leastUsed} field="uses" /></CardContent></Card>
            </div>

            <Card><CardHeader><CardTitle className="text-sm">Heatmap de uso (capa × intensidad)</CardTitle></CardHeader>
              <CardContent className="overflow-auto">
                <div className="grid gap-1" style={{ gridTemplateColumns: "180px repeat(10, 1fr)" }}>
                  <div />{Array.from({ length: 10 }).map((_, i) => <div key={i} className="text-[10px] text-center text-muted-foreground">{i * 10}%+</div>)}
                  {computed.layerRanking.slice(0, 15).map((r) => (
                    <>
                      <div key={`${r.name}-l`} className="text-xs truncate pr-2">{r.name}</div>
                      {Array.from({ length: 10 }).map((_, i) => {
                        const filled = (i + 1) * 10 <= Math.round(r.pctUsers);
                        return <div key={`${r.name}-${i}`} className="h-5 rounded-sm" style={{ background: filled ? `hsl(204 93% ${75 - i * 4}%)` : "hsl(var(--muted))" }} />;
                      })}
                    </>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 6 · Feedback */}
          <TabsContent value="feedback" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Total recomendaciones" value={computed.feedback.recommends} />
              <Kpi label="No recomiendan" value={computed.feedback.notRecommends} />
              <Kpi label="% Recomendación" value={`${computed.feedback.nps.toFixed(1)}%`} accent />
              <Kpi label="Sentimiento (heurístico)" value={computed.feedback.sentimentLabel} />
            </div>
            <Card><CardHeader><CardTitle className="text-sm">Resumen ejecutivo (heurístico)</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-3">
                <p className="text-muted-foreground">{computed.feedback.summary}</p>
                <div className="grid md:grid-cols-3 gap-3">
                  <div><p className="font-medium mb-1">Fortalezas</p><ul className="text-xs space-y-1">{computed.feedback.strengths.map((s) => <li key={s}>• {s}</li>)}</ul></div>
                  <div><p className="font-medium mb-1">Problemas</p><ul className="text-xs space-y-1">{computed.feedback.issues.map((s) => <li key={s}>• {s}</li>)}</ul></div>
                  <div><p className="font-medium mb-1">Más solicitadas</p><ul className="text-xs space-y-1">{computed.feedback.requests.map((s) => <li key={s}>• {s}</li>)}</ul></div>
                </div>
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-sm">Nube de palabras</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {computed.feedback.wordCloud.map((w) => (
                  <span key={w.word} className="rounded-full bg-primary/10 text-primary px-3 py-1" style={{ fontSize: 10 + Math.min(20, w.count * 2) }}>{w.word}</span>
                ))}
                {!computed.feedback.wordCloud.length && <p className="text-xs text-muted-foreground">Sin feedback aún.</p>}
              </CardContent>
            </Card>
            <p className="text-[11px] text-muted-foreground">Análisis local heurístico. Activa Lovable Cloud + AI para un resumen ejecutivo generado por IA con análisis de sentimiento avanzado.</p>
          </TabsContent>

          {/* 7 · Usuarios */}
          <TabsContent value="usuarios" className="space-y-4 mt-4">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Email</TableHead><TableHead>Permisos</TableHead><TableHead>Regiones</TableHead>
                  <TableHead>Última conexión</TableHead><TableHead>Estado</TableHead>
                  <TableHead className="text-right">Sesiones</TableHead><TableHead className="text-right">Tiempo</TableHead>
                  <TableHead className="text-right">IDT</TableHead><TableHead className="text-right">Intensidad</TableHead>
                  <TableHead>Capa favorita</TableHead><TableHead>Último feedback</TableHead>
                </TableRow></TableHeader>
                <TableBody>{computed.usersTable.map((u) => (
                  <TableRow key={u.email}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell className="text-xs">{u.permisos}</TableCell>
                    <TableCell className="text-xs">{u.regiones}</TableCell>
                    <TableCell className="text-xs">{u.ultimaConexion}</TableCell>
                    <TableCell>{u.activo ? <Badge>Activo</Badge> : <Badge variant="outline">Inactivo</Badge>}</TableCell>
                    <TableCell className="text-right">{u.sesiones}</TableCell>
                    <TableCell className="text-right">{u.tiempoTotal}</TableCell>
                    <TableCell className="text-right">{u.idt.toFixed(0)}%</TableCell>
                    <TableCell className="text-right">{u.intensidad.toFixed(0)}%</TableCell>
                    <TableCell className="text-xs">{u.favorita}</TableCell>
                    <TableCell className="text-xs max-w-[260px] truncate">{u.feedback}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* 8 · Innovation Accounting */}
          <TabsContent value="ia" className="space-y-4 mt-4">
            <HypothesesBoard hyp={hyp} northStar={computed.northStarRows} />
            <p className="text-[11px] text-muted-foreground">Las hipótesis se guardan en este navegador. Para sincronizarlas entre usuarios, podemos migrarlas a Lovable Cloud.</p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────
function TopList({ items, field }: { items: Array<{ name: string; uses: number; totalSec: number; growth: number }>; field: "uses" | "time" | "growth" }) {
  return (
    <ol className="space-y-1.5 text-sm">
      {items.map((r, i) => (
        <li key={r.name} className="flex justify-between gap-3">
          <span className="truncate"><span className="text-muted-foreground mr-2">{i + 1}.</span>{r.name}</span>
          <span className="font-medium tabular-nums">
            {field === "uses" && r.uses}
            {field === "time" && formatDuration(r.totalSec)}
            {field === "growth" && `${r.growth > 0 ? "+" : ""}${(r.growth * 100).toFixed(0)}%`}
          </span>
        </li>
      ))}
    </ol>
  );
}

function HypothesesBoard({ hyp, northStar }: { hyp: ReturnType<typeof useHypotheses>; northStar: Array<{ metric: string; value: string }> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<Hypothesis, "id" | "createdAt">>({
    name: "", objective: "", metrics: [], evidence: "", confidence: 3, status: "Validándose",
  });

  const statusColor: Record<Hypothesis["status"], string> = {
    "Validándose": "bg-amber-100 text-amber-900",
    "Perseverar": "bg-emerald-100 text-emerald-900",
    "Pivotar": "bg-rose-100 text-rose-900",
    "Riesgo": "bg-orange-100 text-orange-900",
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{hyp.list.length} hipótesis registradas</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Nueva hipótesis</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva hipótesis</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
              <div><Label>Objetivo</Label><Textarea value={draft.objective} onChange={(e) => setDraft({ ...draft, objective: e.target.value })} /></div>
              <div>
                <Label>Métricas asociadas</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {northStar.map((m) => {
                    const sel = draft.metrics.includes(m.metric);
                    return (
                      <button key={m.metric} type="button" onClick={() => setDraft({ ...draft, metrics: sel ? draft.metrics.filter((x) => x !== m.metric) : [...draft.metrics, m.metric] })}
                        className={`text-xs px-2 py-1 rounded-full border ${sel ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{m.metric}</button>
                    );
                  })}
                </div>
              </div>
              <div><Label>Evidencia</Label><Textarea value={draft.evidence} onChange={(e) => setDraft({ ...draft, evidence: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nivel de confianza</Label>
                  <Select value={String(draft.confidence)} onValueChange={(v) => setDraft({ ...draft, confidence: Number(v) as Hypothesis["confidence"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} / 5</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label>Estado</Label>
                  <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as Hypothesis["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(["Validándose", "Perseverar", "Pivotar", "Riesgo"] as const).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => { if (draft.name.trim()) { hyp.add(draft); setOpen(false); setDraft({ name: "", objective: "", metrics: [], evidence: "", confidence: 3, status: "Validándose" }); } }}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {hyp.list.map((h) => (
          <Card key={h.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm">{h.name}</CardTitle>
                <Badge className={statusColor[h.status]}>{h.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground text-xs">{h.objective}</p>
              <div className="flex flex-wrap gap-1">
                {h.metrics.map((m) => {
                  const val = northStar.find((n) => n.metric === m)?.value;
                  return <span key={m} className="text-[11px] bg-muted px-2 py-0.5 rounded">{m}: <b>{val ?? "—"}</b></span>;
                })}
              </div>
              {h.evidence && <p className="text-xs"><b>Evidencia:</b> {h.evidence}</p>}
              <div className="flex justify-between items-center pt-1">
                <span className="text-[11px] text-muted-foreground">Confianza {h.confidence}/5</span>
                <div className="flex gap-1">
                  <Select value={h.status} onValueChange={(v) => hyp.update(h.id, { status: v as Hypothesis["status"] })}>
                    <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{(["Validándose", "Perseverar", "Pivotar", "Riesgo"] as const).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => hyp.remove(h.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!hyp.list.length && <p className="text-sm text-muted-foreground col-span-2 py-8 text-center">Aún no hay hipótesis. Crea la primera para empezar a medir aprendizaje validado.</p>}
      </div>
    </div>
  );
}

// ─── Heavy computation ────────────────────────────────────────────────────────
function computeAll(profiles: ProfileRow[], sessionsAll: SessionRow[], f: Filters) {
  // Sample for layer discovery: pick first session
  const sample = sessionsAll[0] as Record<string, unknown> | undefined;
  const layerCols = discoverLayerColumns(sample);

  const fromMs = new Date(f.from + "T00:00:00").getTime();
  const toMs = new Date(f.to + "T23:59:59").getTime();

  // Filter profiles
  const filteredProfiles = profiles.filter((p) => {
    if (f.region && !(p.regiones_permitidas || []).includes(f.region)) return false;
    if (f.permiso && !(p.permisos || []).includes(f.permiso)) return false;
    if (f.user && p.email !== f.user) return false;
    return true;
  });
  const allowedEmails = new Set(filteredProfiles.map((p) => p.email));

  // Filter sessions by date + by allowed users
  const sessions = sessionsAll.filter((s) => {
    if (!s.login_time) return false;
    const t = new Date(s.login_time).getTime();
    if (!Number.isFinite(t)) return false;
    if (t < fromMs || t > toMs) return false;
    if (f.user && s.user_id !== f.user) return false;
    if ((f.region || f.permiso) && !allowedEmails.has(s.user_id)) return false;
    return true;
  });

  // ─── 1 · Growth ─────────────────────────────────────────────────────────────
  const now = Date.now();
  const totalUsers = filteredProfiles.length;
  const active7d = new Set(sessions.filter((s) => new Date(s.login_time!).getTime() > now - 7 * 86400000).map((s) => s.user_id)).size;
  const active30d = new Set(sessions.filter((s) => new Date(s.login_time!).getTime() > now - 30 * 86400000).map((s) => s.user_id)).size;

  const dailyMap = new Map<string, number>();
  const weeklyMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();
  filteredProfiles.forEach((p) => {
    if (!p.fecha_registro) return;
    const d = new Date(p.fecha_registro);
    if (d.getTime() < fromMs || d.getTime() > toMs) return;
    dailyMap.set(ymd(d), (dailyMap.get(ymd(d)) || 0) + 1);
    weeklyMap.set(isoWeek(d), (weeklyMap.get(isoWeek(d)) || 0) + 1);
    monthlyMap.set(ym(d), (monthlyMap.get(ym(d)) || 0) + 1);
  });
  const growthSeriesDaily = Array.from(dailyMap.entries()).sort().reduce((acc, [date, n]) => {
    const prev = acc.length ? (acc[acc.length - 1].Acumulado as number) : 0;
    acc.push({ date, Nuevos: n, Acumulado: prev + n });
    return acc;
  }, [] as Array<{ date: string; Nuevos: number; Acumulado: number }>);
  const growthSeriesWeekly = Array.from(weeklyMap.entries()).sort().map(([week, n]) => ({ week, Nuevos: n }));
  const growthSeriesMonthly = Array.from(monthlyMap.entries()).sort().map(([month, n]) => ({ month, Nuevos: n }));
  const growth = {
    totalUsers, active7d, active30d,
    newPerDayAvg: growthSeriesDaily.length ? avg(growthSeriesDaily.map((x) => x.Nuevos)) : 0,
    newPerWeekAvg: growthSeriesWeekly.length ? avg(growthSeriesWeekly.map((x) => x.Nuevos)) : 0,
    newPerMonthAvg: growthSeriesMonthly.length ? avg(growthSeriesMonthly.map((x) => x.Nuevos)) : 0,
  };

  // ─── 2 · Activation ─────────────────────────────────────────────────────────
  const firstLoginByUser = new Map<string, Date>();
  sessionsAll.forEach((s) => {
    if (!s.login_time) return;
    const d = new Date(s.login_time);
    const cur = firstLoginByUser.get(s.user_id);
    if (!cur || d < cur) firstLoginByUser.set(s.user_id, d);
  });
  const withLogin = filteredProfiles.filter((p) => firstLoginByUser.has(p.email)).length;
  const neverLogin = totalUsers - withLogin;
  const deltas: number[] = [];
  filteredProfiles.forEach((p) => {
    const fl = firstLoginByUser.get(p.email);
    if (p.fecha_registro && fl) deltas.push(diffDays(new Date(p.fecha_registro), fl));
  });
  const activation = {
    withLogin, neverLogin,
    avgDaysToFirst: deltas.length ? avg(deltas) : 0,
    activationPct: totalUsers ? (withLogin / totalUsers) * 100 : 0,
  };

  // ─── 3 · Retention (D1/D7/D30 + cohort) ─────────────────────────────────────
  function retainedAtDay(day: number) {
    let eligible = 0, retained = 0;
    filteredProfiles.forEach((p) => {
      if (!p.fecha_registro) return;
      const reg = new Date(p.fecha_registro);
      if (now - reg.getTime() < day * 86400000) return;
      eligible++;
      const target = reg.getTime() + day * 86400000;
      const userSessions = sessionsAll.filter((s) => s.user_id === p.email && s.login_time);
      const hit = userSessions.some((s) => {
        const t = new Date(s.login_time!).getTime();
        return t >= target - 86400000 && t <= target + 86400000;
      });
      if (hit) retained++;
    });
    return eligible ? (retained / eligible) * 100 : 0;
  }
  const recurrent = Array.from(new Set(sessions.map((s) => s.user_id))).filter((email) => sessions.filter((s) => s.user_id === email).length >= 2).length;
  const weeksSpan = Math.max(1, (toMs - fromMs) / (7 * 86400000));
  const freqPerWeek = sessions.length / (filteredProfiles.length || 1) / weeksSpan;

  // Cohort weekly (last 8 cohorts, 4 follow weeks)
  const cohortWeeks = [0, 1, 2, 3, 4];
  const cohortMap = new Map<string, { regDates: Date[]; users: string[] }>();
  filteredProfiles.forEach((p) => {
    if (!p.fecha_registro) return;
    const d = new Date(p.fecha_registro);
    const w = isoWeek(d);
    const e = cohortMap.get(w) || { regDates: [], users: [] };
    e.regDates.push(d); e.users.push(p.email);
    cohortMap.set(w, e);
  });
  const cohortKeys = Array.from(cohortMap.keys()).sort().slice(-8);
  const cohorts = cohortKeys.map((week) => {
    const entry = cohortMap.get(week)!;
    const values = cohortWeeks.map((w) => {
      let retained = 0;
      entry.users.forEach((email, idx) => {
        const reg = entry.regDates[idx];
        const start = reg.getTime() + w * 7 * 86400000;
        const end = start + 7 * 86400000;
        const hit = sessionsAll.some((s) => s.user_id === email && s.login_time && new Date(s.login_time).getTime() >= start && new Date(s.login_time).getTime() < end);
        if (hit) retained++;
      });
      return entry.users.length ? (retained / entry.users.length) * 100 : null;
    });
    return { cohort: week, size: entry.users.length, values };
  });
  const retention = {
    d1: retainedAtDay(1), d7: retainedAtDay(7), d30: retainedAtDay(30),
    recurrent, freqPerWeek, cohorts, cohortWeeks,
  };

  // ─── 4 · Engagement ─────────────────────────────────────────────────────────
  const durs = sessions.map(sessionDurationSec).filter((x) => x > 0);
  const totalSessions = sessions.length;
  const uniqueUsers = new Set(sessions.map((s) => s.user_id)).size || 1;
  const engagement = {
    totalSessions,
    avgPerUser: totalSessions / uniqueUsers,
    avgSec: durs.length ? avg(durs) : 0,
    medianSec: median(durs),
    maxSec: durs.length ? Math.max(...durs) : 0,
    minSec: durs.length ? Math.min(...durs) : 0,
  };
  const perUserSessions = new Map<string, { count: number; total: number }>();
  sessions.forEach((s) => {
    const cur = perUserSessions.get(s.user_id) || { count: 0, total: 0 };
    cur.count++; cur.total += sessionDurationSec(s);
    perUserSessions.set(s.user_id, cur);
  });
  const userEngagementTable = Array.from(perUserSessions.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([email, v]) => ({ Usuario: email, Sesiones: v.count, "Tiempo total": formatDuration(v.total) }));

  // ─── 5 · Geo Intelligence ───────────────────────────────────────────────────
  // Per-layer aggregates
  const layerAgg = layerCols.map((lc) => {
    const name = prettyLayerName(lc.flag);
    let uses = 0, totalSec = 0;
    const usersSet = new Set<string>();
    sessions.forEach((s) => {
      if (s[lc.flag]) { uses++; usersSet.add(s.user_id); }
      totalSec += intervalToSeconds(s[lc.time]);
    });
    return { key: lc.key, flag: lc.flag, name, uses, users: usersSet.size, totalSec, pctUsers: filteredProfiles.length ? (usersSet.size / filteredProfiles.length) * 100 : 0 };
  });
  // Growth per layer: last 30d vs previous 30d
  const halfMs = 30 * 86400000;
  const layerRanking = layerAgg.map((l) => {
    const lateUses = sessions.filter((s) => s[l.flag] && new Date(s.login_time!).getTime() > now - halfMs).length;
    const earlyUses = sessions.filter((s) => s[l.flag] && new Date(s.login_time!).getTime() <= now - halfMs && new Date(s.login_time!).getTime() > now - 2 * halfMs).length;
    const growth = earlyUses ? (lateUses - earlyUses) / earlyUses : (lateUses ? 1 : 0);
    return { ...l, growth };
  }).sort((a, b) => b.uses - a.uses);

  const categoryDist = Object.entries(
    layerRanking.reduce<Record<string, number>>((acc, l) => {
      const c = categorize(l.flag);
      acc[c] = (acc[c] || 0) + l.totalSec;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  // IDT per user
  const idtPerUser = new Map<string, number>();
  const intensityPerUser = new Map<string, number>();
  const favoritePerUser = new Map<string, string>();
  filteredProfiles.forEach((p) => {
    const us = sessions.filter((s) => s.user_id === p.email);
    if (!us.length) { idtPerUser.set(p.email, 0); intensityPerUser.set(p.email, 0); return; }
    const used = new Set<string>();
    let layerTime = 0, sessionTime = 0;
    const perLayerSec = new Map<string, number>();
    us.forEach((s) => {
      sessionTime += sessionDurationSec(s);
      layerCols.forEach((lc) => {
        if (s[lc.flag]) used.add(lc.flag);
        const t = intervalToSeconds(s[lc.time]);
        layerTime += t;
        perLayerSec.set(lc.flag, (perLayerSec.get(lc.flag) || 0) + t);
      });
    });
    idtPerUser.set(p.email, layerCols.length ? (used.size / layerCols.length) * 100 : 0);
    intensityPerUser.set(p.email, sessionTime ? Math.min(100, (layerTime / sessionTime) * 100) : 0);
    let best = ""; let bestSec = 0;
    perLayerSec.forEach((v, k) => { if (v > bestSec) { bestSec = v; best = prettyLayerName(k); } });
    favoritePerUser.set(p.email, best || "—");
  });

  const idtValues = Array.from(idtPerUser.values());
  const intensityValues = Array.from(intensityPerUser.values());

  const geo = {
    layerCount: layerCols.length,
    idtAvg: idtValues.length ? avg(idtValues) : 0,
    intensityAvg: intensityValues.length ? avg(intensityValues) : 0,
    totalLayerSec: layerRanking.reduce((acc, l) => acc + l.totalSec, 0),
    categoryDist,
    top: {
      mostVisited: layerRanking.slice(0, 10),
      mostTime: [...layerRanking].sort((a, b) => b.totalSec - a.totalSec).slice(0, 10),
      fastestGrowing: [...layerRanking].sort((a, b) => b.growth - a.growth).slice(0, 10),
      leastUsed: [...layerRanking].sort((a, b) => a.uses - b.uses).slice(0, 10),
    },
  };

  // ─── 6 · Feedback ───────────────────────────────────────────────────────────
  const feedbackRows = sessions.filter((s) => s.feedback && String(s.feedback).trim());
  const recommends = sessions.filter((s) => s.recomienda_app === true).length;
  const notRecommends = sessions.filter((s) => s.recomienda_app === false).length;
  const total = recommends + notRecommends;
  const nps = total ? (recommends / total) * 100 : 0;

  const POS = ["bueno", "buena", "excelente", "útil", "util", "rápido", "rapido", "intuitivo", "fácil", "facil", "claro", "potente", "gran", "increíble", "love", "great"];
  const NEG = ["malo", "mala", "lento", "confuso", "difícil", "dificil", "error", "bug", "falla", "problema", "pésimo", "pesimo", "no funciona", "crash"];
  let pos = 0, neg = 0;
  const wordFreq = new Map<string, number>();
  const STOP = new Set("a al algo algun alguna algunas alguno algunos ante antes como con contra cual cuando de del desde donde durante e el ella ellas ellos en entre era eran es esa esas ese eso esos esta estaba estaban estan estar este esto estos fue fueron fui ha han hasta hay la las le les lo los más mas me mi muy nada ni no nos o otra otras otro otros para pero por porque que quien si sin sobre su sus también tambien te tu tus un una unas uno unos y ya".split(" "));
  feedbackRows.forEach((s) => {
    const txt = String(s.feedback).toLowerCase();
    POS.forEach((w) => { if (txt.includes(w)) pos++; });
    NEG.forEach((w) => { if (txt.includes(w)) neg++; });
    txt.replace(/[^a-záéíóúñ\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)).forEach((w) => wordFreq.set(w, (wordFreq.get(w) || 0) + 1));
  });
  const wordCloud = Array.from(wordFreq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([word, count]) => ({ word, count }));
  const sentimentLabel = pos > neg * 1.3 ? "Positivo" : neg > pos * 1.3 ? "Negativo" : "Neutral";

  const strengths = wordCloud.filter((w) => POS.some((p) => w.word.includes(p))).slice(0, 5).map((w) => `Menciones de "${w.word}" (${w.count})`);
  const issues = wordCloud.filter((w) => NEG.some((p) => w.word.includes(p))).slice(0, 5).map((w) => `Reportes de "${w.word}" (${w.count})`);
  const requests = wordCloud.filter((w) => /agreg|añad|incluir|necesit|querer|falta|deber/.test(w.word)).slice(0, 5).map((w) => `Solicitan "${w.word}"`);
  const summary = feedbackRows.length
    ? `${feedbackRows.length} comentarios analizados. Sentimiento general ${sentimentLabel.toLowerCase()}. ${recommends} usuarios recomiendan la plataforma, ${notRecommends} no lo harían.`
    : "Aún no hay feedback de usuarios para analizar.";
  const feedback = { recommends, notRecommends, nps, sentimentLabel, wordCloud, strengths: strengths.length ? strengths : ["—"], issues: issues.length ? issues : ["—"], requests: requests.length ? requests : ["—"], summary };

  // ─── 7 · Users table ────────────────────────────────────────────────────────
  const lastFeedbackByUser = new Map<string, string>();
  feedbackRows.slice().sort((a, b) => new Date(b.feedback_date || 0).getTime() - new Date(a.feedback_date || 0).getTime())
    .forEach((s) => { if (!lastFeedbackByUser.has(s.user_id)) lastFeedbackByUser.set(s.user_id, String(s.feedback)); });

  const usersTable = filteredProfiles.map((p) => {
    const eng = perUserSessions.get(p.email) || { count: 0, total: 0 };
    return {
      email: p.email,
      permisos: (p.permisos || []).join(", "),
      regiones: (p.regiones_permitidas || []).join(", ") || "Todas",
      ultimaConexion: p.ultima_conexion ? new Date(p.ultima_conexion).toLocaleString() : "—",
      activo: !!p.activo,
      sesiones: eng.count,
      tiempoTotal: formatDuration(eng.total),
      idt: idtPerUser.get(p.email) || 0,
      intensidad: intensityPerUser.get(p.email) || 0,
      favorita: favoritePerUser.get(p.email) || "—",
      feedback: lastFeedbackByUser.get(p.email) || "—",
    };
  }).sort((a, b) => b.sesiones - a.sesiones);

  // ─── North Star ─────────────────────────────────────────────────────────────
  const wau = new Set(sessions.filter((s) => new Date(s.login_time!).getTime() > now - 7 * 86400000).map((s) => s.user_id)).size;
  const northStarRows = [
    { metric: "WAU", value: String(wau) },
    { metric: "Retención D7", value: `${retention.d7.toFixed(1)}%` },
    { metric: "Tiempo prom./sesión", value: formatDuration(engagement.avgSec) },
    { metric: "IDT promedio", value: `${geo.idtAvg.toFixed(1)}%` },
    { metric: "% Recomendación", value: `${nps.toFixed(1)}%` },
  ];

  return {
    growth, growthSeriesDaily, growthSeriesWeekly, growthSeriesMonthly,
    activation, retention, engagement, userEngagementTable,
    geo, layerRanking,
    feedback, usersTable, northStarRows,
  };
}
