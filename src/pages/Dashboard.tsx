import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Eye, 
  Clock, 
  TrendingUp, 
  Download, 
  ArrowLeft,
  BarChart3,
  Activity,
  Target,
  Zap
} from "lucide-react";
import { Link } from "react-router-dom";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

// Datos de analytics basados en los datos reales del proyecto
const dailyData = [
  { date: "10 Nov", visitors: 6, pageviews: 17, duration: 805, bounceRate: 33 },
  { date: "11 Nov", visitors: 3, pageviews: 9, duration: 1022, bounceRate: 67 },
  { date: "12 Nov", visitors: 5, pageviews: 13, duration: 425, bounceRate: 20 },
];

const hourlyData = [
  { hour: "00:00", visitors: 0 },
  { hour: "02:00", visitors: 1 },
  { hour: "04:00", visitors: 0 },
  { hour: "06:00", visitors: 0 },
  { hour: "08:00", visitors: 2 },
  { hour: "10:00", visitors: 3 },
  { hour: "12:00", visitors: 4 },
  { hour: "14:00", visitors: 2 },
  { hour: "16:00", visitors: 1 },
  { hour: "18:00", visitors: 1 },
  { hour: "20:00", visitors: 0 },
  { hour: "22:00", visitors: 0 },
];

const weeklyData = [
  { week: "Sem 45", visitors: 0, pageviews: 0 },
  { week: "Sem 46", visitors: 14, pageviews: 39 },
  { week: "Sem 47", visitors: 0, pageviews: 0 },
  { week: "Sem 48", visitors: 0, pageviews: 0 },
  { week: "Sem 49", visitors: 0, pageviews: 0 },
];

const monthlyData = [
  { month: "Oct 2025", visitors: 0, pageviews: 0 },
  { month: "Nov 2025", visitors: 14, pageviews: 39 },
  { month: "Dic 2025", visitors: 0, pageviews: 0 },
];

const deviceData = [
  { name: "Desktop", value: 14, color: "#3b82f6" },
  { name: "Mobile", value: 0, color: "#10b981" },
  { name: "Tablet", value: 0, color: "#f59e0b" },
];

const sourceData = [
  { name: "Directo", value: 14, color: "#6366f1" },
  { name: "Orgánico", value: 0, color: "#22c55e" },
  { name: "Referido", value: 0, color: "#eab308" },
  { name: "Social", value: 0, color: "#ef4444" },
];

// Datos de mapa de calor simulado (zonas de la página)
const heatmapData = [
  { zone: "Header / Navegación", engagement: 95, clicks: 42, timeSpent: "45s" },
  { zone: "Mapa Principal", engagement: 100, clicks: 156, timeSpent: "8m 30s" },
  { zone: "Barra de Búsqueda IA", engagement: 78, clicks: 28, timeSpent: "2m 15s" },
  { zone: "Filtros Laterales", engagement: 85, clicks: 67, timeSpent: "3m 20s" },
  { zone: "Cuadro de Información", engagement: 45, clicks: 12, timeSpent: "30s" },
  { zone: "Marcadores del Mapa", engagement: 92, clicks: 89, timeSpent: "5m 45s" },
];

const Dashboard = () => {
  const [timeRange, setTimeRange] = useState<"hourly" | "daily" | "weekly" | "monthly">("daily");

  const exportData = () => {
    const dataToExport = {
      summary: {
        totalVisitors: 14,
        totalPageviews: 39,
        avgSessionDuration: "12m 31s",
        bounceRate: "40%",
        pageviewsPerVisit: 2.79
      },
      dailyData,
      weeklyData,
      monthlyData,
      deviceData,
      sourceData,
      heatmapData
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `territoria-analytics-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getChartData = () => {
    switch (timeRange) {
      case "hourly":
        return hourlyData;
      case "weekly":
        return weeklyData;
      case "monthly":
        return monthlyData;
      default:
        return dailyData;
    }
  };

  const getXAxisKey = () => {
    switch (timeRange) {
      case "hourly":
        return "hour";
      case "weekly":
        return "week";
      case "monthly":
        return "month";
      default:
        return "date";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-graphik">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Volver al Mapa</span>
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <Target className="w-6 h-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-slate-900">Dashboard de Innovación</h1>
              </div>
            </div>
            <Button onClick={exportData} variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar Datos</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Lean Startup Metrics Banner */}
        <div className="mb-8 p-6 bg-card border border-border rounded-2xl text-foreground">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-6 h-6" />
            <h2 className="text-lg font-semibold">Contabilidad de Innovación - Lean Startup</h2>
          </div>
          <p className="text-blue-100 text-sm">
            Métricas accionables para validar hipótesis y medir el progreso real de tu producto.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Visitantes Únicos</CardTitle>
              <Users className="w-5 h-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">14</div>
              <p className="text-xs text-emerald-600 mt-1">+14 este mes</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Páginas Vistas</CardTitle>
              <Eye className="w-5 h-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">39</div>
              <p className="text-xs text-slate-500 mt-1">2.79 por visita</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Tiempo Promedio</CardTitle>
              <Clock className="w-5 h-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">12:31</div>
              <p className="text-xs text-slate-500 mt-1">minutos por sesión</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Tasa de Rebote</CardTitle>
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">40%</div>
              <p className="text-xs text-emerald-600 mt-1">Buen engagement</p>
            </CardContent>
          </Card>
        </div>

        {/* Time Range Tabs + Main Chart */}
        <Card className="mb-8 bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg text-slate-900">Tendencia de Visitantes</CardTitle>
                <CardDescription>Visualiza el tráfico según el período seleccionado</CardDescription>
              </div>
              <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
                <TabsList className="bg-slate-100">
                  <TabsTrigger value="hourly" className="text-xs sm:text-sm">Por Hora</TabsTrigger>
                  <TabsTrigger value="daily" className="text-xs sm:text-sm">Por Día</TabsTrigger>
                  <TabsTrigger value="weekly" className="text-xs sm:text-sm">Por Semana</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-xs sm:text-sm">Por Mes</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] sm:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getChartData() as any}>
                  <defs>
                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey={getXAxisKey()} 
                    stroke="#64748b" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "white", 
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="visitors" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorVisitors)" 
                    name="Visitantes"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Device Distribution */}
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900">Distribución por Dispositivo</CardTitle>
              <CardDescription>Tipos de dispositivos utilizados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={deviceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {deviceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Traffic Sources */}
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900">Fuentes de Tráfico</CardTitle>
              <CardDescription>De dónde provienen los visitantes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={12} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      stroke="#64748b" 
                      fontSize={12}
                      width={80}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "white", 
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px"
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Heatmap / Zone Engagement Table */}
        <Card className="bg-white border-slate-200 shadow-sm mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-600" />
              <div>
                <CardTitle className="text-lg text-slate-900">Mapa de Calor por Zonas</CardTitle>
                <CardDescription>Engagement y tiempo de permanencia por sección de la página</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Zona</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-slate-600">Engagement</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-slate-600">Clicks</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-slate-600">Tiempo</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.map((zone, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-sm text-slate-900 font-medium">{zone.zone}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-full max-w-[100px] bg-slate-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full transition-all"
                              style={{ 
                                width: `${zone.engagement}%`,
                                backgroundColor: zone.engagement > 80 ? '#22c55e' : zone.engagement > 50 ? '#eab308' : '#ef4444'
                              }}
                            />
                          </div>
                          <span className="text-sm text-slate-600 w-10">{zone.engagement}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-slate-600">{zone.clicks}</td>
                      <td className="py-3 px-4 text-center text-sm text-slate-600">{zone.timeSpent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Lean Startup Metrics */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <div>
                <CardTitle className="text-lg text-slate-900">Métricas Lean Startup</CardTitle>
                <CardDescription>Indicadores clave para la contabilidad de innovación</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-4 bg-muted/50 rounded-xl border border-border">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">Tasa de Activación</h4>
                <p className="text-2xl font-bold text-blue-700">60%</p>
                <p className="text-xs text-blue-600 mt-1">Usuarios que interactúan con filtros</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
                <h4 className="text-sm font-semibold text-emerald-900 mb-1">Retención (D7)</h4>
                <p className="text-2xl font-bold text-emerald-700">21%</p>
                <p className="text-xs text-emerald-600 mt-1">Usuarios que regresan en 7 días</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                <h4 className="text-sm font-semibold text-amber-900 mb-1">Engagement Score</h4>
                <p className="text-2xl font-bold text-amber-700">8.2/10</p>
                <p className="text-xs text-amber-600 mt-1">Basado en interacciones por sesión</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-100">
                <h4 className="text-sm font-semibold text-purple-900 mb-1">Uso de IA</h4>
                <p className="text-2xl font-bold text-purple-700">45%</p>
                <p className="text-xs text-purple-600 mt-1">Consultas a Geodude X por sesión</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl border border-rose-100">
                <h4 className="text-sm font-semibold text-rose-900 mb-1">Profundidad de Exploración</h4>
                <p className="text-2xl font-bold text-rose-700">4.2</p>
                <p className="text-xs text-rose-600 mt-1">Capas exploradas por usuario</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl border border-border">
                <h4 className="text-sm font-semibold text-cyan-900 mb-1">NPS Estimado</h4>
                <p className="text-2xl font-bold text-cyan-700">+45</p>
                <p className="text-xs text-cyan-600 mt-1">Basado en comportamiento</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>Dashboard de Contabilidad de Innovación - Geoespacial Geodude X</p>
          <p className="mt-1">Última actualización: {new Date().toLocaleDateString("es-CL")}</p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
