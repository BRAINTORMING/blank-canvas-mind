
# 🌦 Monitoreo Territorial — Plan de implementación

Nuevo módulo dentro del sidebar de GdudeX, ubicado **debajo de "Proyectos del Territorio"**, sin alterar el modelo ni funcionalidades existentes. Solo se agrega código nuevo; los archivos actuales se tocarán únicamente para (a) montar la nueva sección en el sidebar y (b) montar los layers en `MapView`.

---

## 1. Alcance de esta primera iteración

Dado el tamaño del requerimiento, propongo entregar la **base funcional completa** en esta ronda y dejar preparada la arquitectura escalable. Iteraciones siguientes pulen visuales avanzados.

**Incluido en esta entrega:**
- Sección sidebar `🌦 Monitoreo Territorial` con 10 switches (todas las capas listadas).
- Backend: tabla `weather_cache` + Edge Function `weather-api` (Open-Meteo) + Edge Function `nasa-firms` (incendios activos).
- Servicios frontend: `WeatherService`, `FireRiskService`, `NASAFirmsService`, `WeatherLayerManager`.
- Capas Mapbox WebGL:
  - **Temperatura** — heatmap continuo con gradiente Windy-like, muestreo por grilla dinámica según viewport.
  - **Viento** — partículas fluidas vía `mapbox-gl-wind` (WebGL, puerto oficial Mapbox).
  - **Humedad, Radiación, UV, Precipitación, Nubosidad, Presión** — capas heatmap con gradientes y leyendas propias.
  - **Riesgo de Incendio** — capa calculada localmente con `calculateFireRisk()`.
  - **Incendios Activos NASA FIRMS** — puntos con popup (nivel, fecha, hora, confianza, FRP).
- **Popup meteorológico** al click en mapa (todas las variables).
- **Timeline horario** inferior (Ahora, +1h, +3h, +6h, +12h, +24h).
- **Leyendas flotantes** por capa activa.
- Integración con infraestructura crítica: al hover sobre una subestación/activo visible con capas activas, mini-panel con temp/viento/radiación/riesgo.

**Preparado para futuro (no implementado ahora):** calidad del aire, caudales, sismicidad, ECMWF/GFS, SENAPRED — la arquitectura de `WeatherLayerManager` + `weather-api` permite agregarlos sin refactor.

---

## 2. Backend Supabase

### 2.1 Migración SQL

```sql
CREATE TABLE public.weather_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat numeric(9,5) NOT NULL,
  lon numeric(9,5) NOT NULL,
  provider text NOT NULL,          -- 'open-meteo' | 'nasa-firms'
  variant text NOT NULL DEFAULT 'current', -- 'current' | 'forecast' | 'grid'
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX ON public.weather_cache (provider, variant, lat, lon);
CREATE INDEX ON public.weather_cache (expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weather_cache TO authenticated;
GRANT SELECT ON public.weather_cache TO anon;  -- lectura pública (datos abiertos)
GRANT ALL ON public.weather_cache TO service_role;

ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read cache" ON public.weather_cache FOR SELECT TO anon, authenticated USING (true);
-- Escritura solo desde edge functions (service_role bypassa RLS).
```

### 2.2 Edge Function `weather-api`

Entrada:
```
POST /weather-api  { mode: 'point'|'grid', lat, lon, bbox?, hours? }
```

Lógica:
1. Buscar en `weather_cache` un registro no expirado con match ~0.05° de tolerancia.
2. Si no existe → llamar `api.open-meteo.com/v1/forecast` con los parámetros solicitados.
3. Normalizar respuesta y persistir con `expires_at` (15 min datos actuales, 30 min forecast).
4. Responder normalizado.

CORS estándar (`npm:@supabase/supabase-js@2/cors`).

### 2.3 Edge Function `nasa-firms`

Entrada: `{ bbox, days? }` → llama a `firms.modaps.eosdis.nasa.gov/api/area/csv/...` (endpoint gratuito con MAP_KEY vía secret). Cachea 30 min. Devuelve GeoJSON.
Secret requerido: `NASA_FIRMS_MAP_KEY` — pediré al usuario tras generar la migración.

---

## 3. Frontend

### 3.1 Nuevos archivos

```text
src/services/monitoring/
  WeatherService.ts        // fetch al edge weather-api, con dedupe/debounce
  FireRiskService.ts       // calculateFireRisk(temp, rh, wind, rain, rad, uv)
  NASAFirmsService.ts      // fetch al edge nasa-firms
  WeatherLayerManager.ts   // registra/actualiza sources y layers en mapbox
  WindAnimation.ts         // wrapper del shader webgl-wind acoplado a mapbox
  TemperatureLayer.ts      // heatmap continuo con muestreo por grilla

src/components/monitoring/
  MonitoringSidebar.tsx    // sección con switches, se monta en AppSidebar
  Timeline.tsx             // barra inferior con offsets horarios
  WeatherPopup.tsx         // popup unificado al click en el mapa
  Legend.tsx               // leyendas flotantes por capa activa
  InfraWeatherBadge.tsx    // mini panel sobre activos visibles
```

### 3.2 Cambios mínimos en archivos existentes

- `src/components/AppSidebar.tsx`: montar `<MonitoringSidebar />` justo debajo de `IntelligenceProjects` (dentro del bloque `showProyectos` o como sección propia "Monitoreo Territorial" con `SidebarSectionHeader`).
- `src/components/MapView.tsx`: inicializar `WeatherLayerManager` con la instancia de mapa; escuchar eventos `monitoring:toggle`, `monitoring:timeOffset` y `monitoring:click`; renderizar `<Timeline/>`, `<Legend/>`, `<WeatherPopup/>` como overlays sobre el mapa.

No se toca lógica de negocio, permisos, PRIC, radial, oportunidades, etc.

### 3.3 Capa de temperatura (Windy-like)

Estrategia: muestreo por grilla de ~12×12 puntos según viewport actual, request batched al edge (mode `grid`), interpolación en cliente vía `mapbox heatmap` con `heatmap-weight` mapeando temperatura y gradiente 7 stops (azul oscuro → rojo). Refetch onmoveend con debounce 500 ms. Radio adaptativo por zoom para superficie continua.

Timeline horario: mismo grid pero con `hourly` array; al cambiar offset se recalcula `heatmap-weight` sin refetch.

### 3.4 Viento

`mapbox-gl-wind` (fork oficial): source de textura U/V generada en cliente a partir del grid de Open-Meteo (`wind_u_10m`, `wind_v_10m`). Custom layer WebGL con partículas, velocidad/fade tunable. Se re-genera la textura al `moveend` o cambio de hora.

### 3.5 Popup

Al click con cualquier capa monitoring activa: `WeatherService.point(lat, lon, hourOffset)` → `WeatherPopup` con todas las variables en un card blanco redondeado consistente con `src/lib/mapPopups.ts`.

### 3.6 Integración con infraestructura crítica

`InfraWeatherBadge` escucha visibilidad de capas de subestaciones/activos ya existentes; para cada feature en viewport pide su clima puntual (cacheado) y muestra un chip flotante al hover con temp/viento/radiación/riesgo.

---

## 4. Diseño

Reutilizar tokens actuales (`bg-white`, `rounded-2xl`, `shadow-1`, `text-primary`, `border-[#F3F4F6]`). Switches shadcn. Iconos lucide (`Thermometer`, `Wind`, `Sun`, `Droplets`, `CloudRain`, `Cloud`, `Gauge`, `Flame`, `AlertTriangle`, `Zap`). Sin cambios globales de CSS.

---

## 5. Rendimiento

- Grid adaptativo (12×12 fijo → 400 muestras máx.)
- Cache doble: memoria (Map por `lat,lon,hour`) + Supabase.
- Debounce 500 ms en `moveend`.
- Wind: textura 256×256 regenerada solo al pan/hour change.
- Sin GeoJSON pesados; todo raster/heatmap WebGL.

---

## 6. Detalles técnicos clave

- Uso de `mapbox-gl` ya presente en el proyecto; sin nuevas deps salvo `mapbox-gl-wind` (peso ~30 KB).
- Edge Functions con `verify_jwt = false` (datos abiertos), validación Zod del body.
- NASA FIRMS requiere `NASA_FIRMS_MAP_KEY` (free tier). Añadido como secret vía `add_secret`; si el usuario no lo entrega, la capa se muestra deshabilitada con tooltip.
- Gradientes definidos como constantes exportadas en `WeatherLayerManager` para reuso en `Legend`.
- `calculateFireRisk`: fórmula ponderada `0.30*T + 0.20*Rad + 0.15*UV + 0.20*Wind − 0.25*RH − 0.30*Rain` normalizada 0-1 → 5 niveles.
- Todos los eventos del módulo usan namespace `monitoring:*` para no colisionar con `radial:*`, `pric:*`, etc.
- La sección se muestra a todos los planes; si el usuario prefiere gatearla a premium, se puede añadir `hasPermission("monitoreo_territorial")` en un turno posterior.

---

## 7. Orden de ejecución

1. Migración `weather_cache` + secret NASA FIRMS (te pediré la key).
2. Edge Functions `weather-api` y `nasa-firms`.
3. Servicios frontend + `WeatherLayerManager`.
4. Componente `MonitoringSidebar` y montaje en `AppSidebar`.
5. Layers en `MapView` (temperatura, humedad, radiación, UV, lluvia, nubosidad, presión, fire-risk, FIRMS).
6. `WindAnimation` con partículas WebGL.
7. `Timeline`, `Legend`, `WeatherPopup`, `InfraWeatherBadge`.
8. QA visual con Playwright + typecheck.

¿Confirmas que avance con este plan? Si tienes ya la `NASA_FIRMS_MAP_KEY`, pásamela para dejar la capa de incendios activa desde el primer despliegue.
