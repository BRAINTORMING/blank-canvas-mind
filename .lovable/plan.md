# Reemplazo del webhook de Oportunidades por Edge Function

## Objetivo
En la pestaña "Oportunidades" del `SearchBar`, reemplazar la llamada al webhook de N8N por una Edge Function `consultar-viabilidad`, y agregar un selector explícito de 3 modos con formularios y resultados diferenciados. La Evaluación PRIC no se toca.

## Alcance

1. **Extraer formulario reutilizable** desde `EvaluacionPRICModal.tsx` a un componente compartido `src/components/FormularioProyecto.tsx`:
   - Campos: `categoria_proyecto` (dropdown obligatorio), `destino_especifico`, `superficie_terreno`, `superficie_edificada`, `huella_basal`, `altura_proyecto` (numéricos condicionales según categoría, igual que hoy).
   - Props: `values`, `onChange`, `mode` (para saber si mostrar el picker de coordenadas o no).
   - Mantiene la carga dinámica de categorías/tipos vía Supabase que ya usa el modal.
   - `EvaluacionPRICModal` pasa a consumir este componente sin cambios en su comportamiento.

2. **Selector de modo en la pestaña Oportunidades** (`SearchBar.tsx`, dentro del panel de Oportunidades, debajo del buscador):
   - Chips/pills con el mismo estilo del segmentado superior "Evaluación PRIC / Oportunidades / Pasos a seguir".
   - 3 opciones con ícono ⓘ + tooltip (usar `Tooltip` de shadcn, tap en mobile):
     - **A — Explorar zona** → `modo: "exploracion"`
     - **B — Evaluar mi proyecto** → `modo: "punto_fijo"`
     - **C — Mejor ubicación cercana** → `modo: "camino_minimo"`
   - Estado inicial: ninguna seleccionada (solo se ve el buscador y el mapa).
   - La selección es explícita — no se infiere del texto.

3. **Formularios según modo**:
   - **A**: slider "Radio de búsqueda" 1–10 km (default 5). Sin más campos. La ubicación viene de click en mapa o del selector Región/Comuna existente.
   - **B**: renderiza `<FormularioProyecto />` + un textarea opcional propio de esta pestaña: "¿Alguna pregunta adicional?" (`pregunta_texto`). La ubicación puede venir del picker del mapa (reusar el flujo `pric:pickMode` existente) o del click en mapa.
   - **C**: slider "¿Qué tanto priorizar menor costo sobre cercanía?" 0–100 (default 50, `factor_costo`). Ubicación desde mapa.

4. **Llamada a la función**: Sustituir el `fetch` al webhook N8N (línea ~720 de `SearchBar.tsx`) por:
   ```ts
   const { data, error } = await supabase.functions.invoke('consultar-viabilidad', { body: payload });
   ```
   Construcción del payload según el modo (ver spec del usuario). El webhook N8N queda en el código como constante muerta (comentario de referencia) para poder reactivarlo temporalmente si hace falta comparar.

5. **Renderizado de resultados** (nuevo componente `OportunidadesResults.tsx`):
   - **A → `data.candidatos`**: tarjetas en panel lateral + pines en mapa (evento nuevo `oportunidades:candidatos`). Color verde/amarillo/rojo por rango relativo de `costo_contexto`. Botón "Evaluar en detalle" que precarga la ubicación en el modo B.
   - **B → `data.respuesta_narrativa`** como respuesta principal (chat), y panel expandible con:
     - Badge de color para `data.dictamen.dictamen` (verde `viable`, amarillo `requiere_revision_manual`, rojo el resto).
     - `data.costo_contexto_detalle` como barras/números.
     - `data.precedentes` como lista con ícono según `senal` (✅ / ❌ / ⏳ / —).
   - **C → `data.ruta`**: lista ordenada + línea en el mapa hacia los primeros 3–5 candidatos (evento `oportunidades:ruta`). Nota visible: "Esta es una estimación rápida — haz clic en un resultado para evaluarlo en detalle". Cada ítem al clic → modo B con ubicación precargada.

6. **Estados**:
   - Loading B: mensaje "Analizando normativa aplicable...".
   - Loading A/C: spinner genérico.
   - Errores: si `data.error` viene, mostrar mensaje legible (no JSON crudo).

7. **Edge Function** `supabase/functions/consultar-viabilidad/index.ts` (skeleton listo para conectar a la lógica del backend):
   - CORS + validación JWT con `getClaims`.
   - Zod schema discriminado por `modo`.
   - Para `punto_fijo`: llama internamente al RPC `evaluar_proyecto_pric` para obtener el dictamen, y a Lovable AI Gateway (`google/gemini-3-flash-preview`) para producir `respuesta_narrativa`. Devuelve `{ dictamen, respuesta_narrativa, costo_contexto_detalle, precedentes }`.
   - Para `exploracion`: consulta preliminar sobre `poligonos_pric` en un radio y devuelve `candidatos` con `costo_contexto` estimado.
   - Para `camino_minimo`: variación de `exploracion` ordenada por combinación de `factor_costo` y distancia, devuelve `ruta`.
   - Nota: el backend de datos ya existente para estos modos puede requerir RPCs adicionales; la Edge Function queda modular para conectarlas cuando estén disponibles.

8. **No tocar**:
   - Flujo de "Evaluación PRIC" (modal y RPC actuales) intacto.
   - Webhook N8N no se borra, solo se desconecta del botón.

## Notas técnicas

- Reusar `externalSupabase` (o `supabase` de `@/integrations/supabase/client` según el destino real de la Edge Function — necesito confirmar cuál proyecto Supabase la hostea).
- Reusar el picker de coordenadas del mapa (`pric:pickMode` / `pric:pointPicked`) generalizándolo con un `source` opcional para no colisionar con el flujo PRIC.
- Los tooltips usan `@/components/ui/tooltip` (shadcn) con `TooltipProvider` a nivel del panel.

## Pregunta antes de implementar

- ¿La Edge Function `consultar-viabilidad` debe vivir en el mismo proyecto Supabase externo (`externalSupabase`) donde vive `evaluar_proyecto_pric`, o en el proyecto Lovable Cloud interno? Esto determina desde qué cliente se hace `functions.invoke`.
- ¿Los RPCs internos (`evaluar_viabilidad_instrumento`, fuentes de `costo_contexto`, `precedentes`, `ruta`) ya existen en la base o los implementa el usuario aparte? Si no existen aún, la Edge Function devolverá stubs con la forma correcta hasta que se conecten.
