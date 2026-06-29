
# Innovation Dashboard — Plan de implementación

Construir una nueva pantalla `/innovation` (Innovation Dashboard) basada en Innovation Accounting de Lean Startup, alimentada por las tablas existentes `usuarios_perfiles`, `usuarios_sesiones` y los usuarios de Supabase Auth.

## Alcance y supuestos

- El proyecto ya está conectado a un Supabase externo (`externalSupabase`) con las tablas mencionadas. **Asumo que `usuarios_sesiones` ya existe con todos los campos `capa_*` y `capa_*_time` listados.** Si falta algún campo, lo detectaré al consultar y te avisaré antes de cambiar el esquema.
- Para Innovation Accounting (hipótesis) crearé una tabla nueva `innovation_hypotheses` **en Lovable Cloud** (no en el Supabase externo, para no tocar tu BD de producción). Si prefieres que vaya al mismo Supabase externo, dímelo y ajusto.
- La pantalla quedará protegida y visible solo a usuarios con permiso. Añadiré un nuevo permiso `innovation_dashboard` al enum existente en `AuthContext`.
- IA (resúmenes de feedback, sentimiento, nube de palabras) usará **Lovable AI Gateway** vía edge function (`google/gemini-3-flash-preview`).
- Exportación: Excel con `xlsx` (SheetJS) y PDF con `jspdf` + `jspdf-autotable`.
- Modo claro/oscuro vía tokens existentes en `index.css` (sin hardcodear colores).
- No tocaré las pantallas ni la lógica existentes salvo: agregar la ruta, el permiso, y un enlace de navegación desde el sidebar para usuarios con el nuevo permiso.

## Arquitectura

```text
src/pages/Innovation.tsx                 ← shell con tabs/módulos + filtros globales
src/components/innovation/
  ├─ InnovationFilters.tsx               ← fecha, región, permiso, usuario
  ├─ KpiCard.tsx, ChartCard.tsx, ...     ← primitivas reutilizables
  ├─ NorthStarStrip.tsx                  ← 5 NSM destacadas arriba
  ├─ modules/
  │   ├─ GrowthModule.tsx                ← Módulo 1
  │   ├─ ActivationModule.tsx            ← Módulo 2
  │   ├─ RetentionModule.tsx             ← Módulo 3 (+ cohort heatmap)
  │   ├─ EngagementModule.tsx            ← Módulo 4
  │   ├─ GeoIntelligenceModule.tsx       ← Módulo 5 (el más grande)
  │   ├─ FeedbackModule.tsx              ← Módulo 6 (+ IA)
  │   ├─ UsersModule.tsx                 ← Módulo 7
  │   └─ InnovationAccountingModule.tsx  ← Módulo 8
  └─ export/ExcelPdfButtons.tsx
src/hooks/innovation/
  ├─ useInnovationData.ts                ← fetch crudo paginado (perfiles + sesiones)
  ├─ useGrowthMetrics.ts
  ├─ useActivationMetrics.ts
  ├─ useRetentionMetrics.ts              ← retención D1/D7/D30 + cohortes
  ├─ useEngagementMetrics.ts
  ├─ useGeoMetrics.ts                    ← rankings, IDT, intensidad, favorita
  ├─ useFeedbackMetrics.ts
  └─ useHypotheses.ts                    ← CRUD a innovation_hypotheses
src/lib/innovation/
  ├─ layers.ts                           ← catálogo de las 30 capas + labels/categorías
  ├─ metrics.ts                          ← funciones puras (IDT, intensidad, cohortes…)
  └─ export.ts                           ← excel + pdf helpers
supabase/functions/innovation-feedback-ai/index.ts  ← IA para feedback
```

Todos los cálculos pesados se hacen client-side sobre los datos cargados, memoizados con React Query + `useMemo`. Los filtros globales viven en un Context y todos los módulos los consumen.

## Detalle por módulo

1. **Crecimiento** — registros totales, WAU/MAU (basado en `ultima_conexion` y `login_time`), series diarias/semanales/mensuales (Recharts).
2. **Activación** — usuarios con ≥1 sesión, usuarios sin sesión, tiempo promedio `fecha_registro → primer login_time`, % activación.
3. **Retención** — D1/D7/D30 calculados desde `fecha_registro` y `login_time`. Tabla cohort por semana de registro × semana de actividad (heatmap).
4. **Engagement** — stats de `sesion_duration` (avg/median/min/max), total sesiones, promedio por usuario, ranking top usuarios.
5. **Geo Intelligence** (núcleo):
   - Catálogo de 30 capas en `layers.ts`.
   - Ranking por uso (sesiones con `capa_x=true`, usuarios únicos, %).
   - Ranking por tiempo (suma `capa_x_time`, promedio por usuario, por sesión).
   - Heatmap de uso (matriz capa × intensidad), distribución por categoría (pie/treemap).
   - Tendencia temporal por capa (line chart multi-serie con selector).
   - Top 10: más visitadas / mayor tiempo / mayor crecimiento (delta últimas 4 semanas vs anteriores) / menor uso.
   - **IDT** por usuario = capas distintas usadas / 30 × 100 → promedio, ranking, evolución, por región, por tipo de permiso.
   - **Índice de Intensidad Territorial** = Σ tiempos de capas / Σ `sesion_duration` → promedio, ranking, evolución.
   - **Capa favorita** por usuario (más usada y donde pasó más tiempo).
6. **Feedback** — % recomendación, conteos, edge function `innovation-feedback-ai` que devuelve `{resumen, fortalezas, problemas, solicitudes, sentimiento, palabras[]}` a partir de los `feedback` no nulos. Render: resumen ejecutivo, listas, gauge de sentimiento, nube de palabras (componente propio simple).
7. **Gestión de usuarios** — tabla con búsqueda/orden/filtros: nombre, email, permisos, región, última conexión, estado, # sesiones, tiempo acumulado, IDT, intensidad, capa favorita, último feedback.
8. **Innovation Accounting**:
   - Tabla nueva `innovation_hypotheses` (Lovable Cloud) con RLS por owner + lectura para usuarios con permiso.
   - CRUD de hipótesis: nombre, objetivo, métricas asociadas (multi-select de métricas predefinidas), tendencia (auto desde la métrica), evidencia (texto + snapshot), nivel de confianza (1–5), estado (Validándose/Perseverar/Pivotar/Riesgo).
   - Para cada hipótesis: muestra valor actual + sparkline de las métricas asociadas reales.
   - **North Star Strip** fija arriba del dashboard con WAU, Retención D7, Tiempo prom. sesión, IDT prom., % recomendación.

## Filtros globales

Rango de fechas (preset + custom), región (de `regiones_permitidas`), permiso (multi), usuario (combobox). Aplican a todos los módulos vía Context. Se filtran sesiones por `login_time` y usuarios por intersección con sesiones filtradas.

## Permisos, navegación, ruta

- Añadir `'innovation_dashboard'` a `Permission` + `ALL_PERMISSIONS` + `PERMISSION_LABELS` en `AuthContext.tsx`.
- Añadir `<Route path="/innovation" element={<ProtectedRoute><Innovation /></ProtectedRoute>} />` en `App.tsx`.
- En `AppSidebar.tsx` (sección Administración o nueva sección "Estrategia"), botón "Innovation Dashboard" visible solo con el permiso.
- Editar `CreateUserDialog` no es necesario: el admin podrá asignar el nuevo permiso automáticamente porque viene del enum.

## Exportación

Botón "Exportar" en cada módulo y uno global:
- Excel: una hoja por módulo con los datos visibles.
- PDF: render simplificado con KPIs + tablas; gráficos como imágenes (capturadas con `html2canvas` solo para PDF).

Dependencias nuevas: `xlsx`, `jspdf`, `jspdf-autotable`, `html2canvas`, `date-fns` (si no está). Reviso primero `package.json`.

## Riesgos / cosas a confirmar

1. **Tabla `usuarios_sesiones` y todos los campos `capa_*`**: si alguno falta en producción, las queries fallarán. Lo verifico antes de programar las métricas.
2. **Volumen de datos**: si hay muchas sesiones, paginaré con `range()` y cachearé con React Query. Si se vuelve lento, agrego una RPC SQL agregada (te pido permiso antes).
3. **Hipótesis en Lovable Cloud vs Supabase externo**: confírmame.
4. **IA de feedback**: requiere habilitar Lovable Cloud (para la edge function y `LOVABLE_API_KEY`). Si no quieres Cloud, el módulo Feedback funciona sin IA y dejo placeholder.

## Plan de ejecución (orden)

1. Verificar esquema actual (`usuarios_sesiones`) y dependencias en `package.json`.
2. Habilitar Lovable Cloud + crear tabla `innovation_hypotheses` + edge function de feedback IA.
3. Permiso, ruta, link en sidebar.
4. Hooks de datos + librería de métricas (con tests rápidos manuales).
5. Shell de Innovation + filtros globales + North Star Strip.
6. Módulos 1→4.
7. Módulo 5 (Geo Intelligence) — el más grande.
8. Módulos 6, 7.
9. Módulo 8 (Innovation Accounting con CRUD).
10. Exportación Excel/PDF + pulido responsive + dark mode.

## Preguntas antes de ejecutar

- ¿Las hipótesis de Innovation Accounting van en **Lovable Cloud** (recomendado, aislado) o en tu **Supabase externo**?
- ¿Habilito **Lovable Cloud + Lovable AI** para el análisis de feedback? (sin esto, el módulo 6 queda sin IA)
- ¿Quieres el enlace al dashboard dentro del sidebar actual o como **pantalla separada** accesible solo por URL/menú admin?
