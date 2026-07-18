// Edge Function: consultar-viabilidad
// Reemplaza el webhook antiguo de N8N para la pestaña "Oportunidades".
// Soporta tres modos: exploracion (A), punto_fijo (B), camino_minimo (C).
//
// - A y C devuelven una vista rápida (candidatos / ruta). Datos poblados con
//   heurística mínima; el backend de datos definitivo puede reemplazar estas
//   ramas conectándose a las tablas y RPCs correspondientes.
// - B genera respuesta_narrativa vía Lovable AI Gateway a partir del dictamen
//   que el cliente adjunta (calculado por el RPC evaluar_proyecto_pric del
//   proyecto externo). Devuelve el resto con el shape acordado.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const baseLoc = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const bodySchema = z.discriminatedUnion('modo', [
  baseLoc.extend({
    modo: z.literal('exploracion'),
    radio_m: z.number().positive().max(50000).default(5000),
  }),
  baseLoc.extend({
    modo: z.literal('punto_fijo'),
    categoria_proyecto: z.string().min(1),
    destino_especifico: z.string().nullable().optional(),
    superficie_terreno: z.number().nullable().optional(),
    superficie_edificada: z.number().nullable().optional(),
    huella_basal: z.number().nullable().optional(),
    altura_proyecto: z.number().nullable().optional(),
    pregunta_texto: z.string().max(2000).optional(),
    // El cliente adjunta el dictamen ya calculado (mismo shape que
    // evaluar_proyecto_pric) para que el server genere la narrativa.
    dictamen_input: z.unknown().optional(),
  }),
  baseLoc.extend({
    modo: z.literal('camino_minimo'),
    max_saltos: z.number().int().positive().max(20).default(8),
    factor_costo: z.number().min(0).max(100).default(50),
  }),
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function generarNarrativa(params: {
  categoria: string;
  destino?: string | null;
  lat: number;
  lon: number;
  pregunta?: string;
  dictamen: unknown;
}): Promise<string> {
  if (!LOVABLE_API_KEY) {
    return 'Configuración de IA no disponible. Contacta al administrador para habilitar la explicación en lenguaje natural.';
  }
  const system = [
    'Eres un asistente experto en normativa territorial chilena (Plan Regulador Intercomunal Costero).',
    'Explica en español, en tono claro y directo, la viabilidad de un proyecto en base al dictamen adjunto.',
    'Estructura: 1) veredicto general en una frase; 2) motivos clave; 3) próximos pasos concretos.',
    'No inventes normas: apóyate solo en lo que aparece en el dictamen.',
  ].join(' ');

  const user = [
    `Ubicación: lat ${params.lat}, lon ${params.lon}.`,
    `Categoría: ${params.categoria}${params.destino ? ` — ${params.destino}` : ''}.`,
    params.pregunta ? `Pregunta adicional del usuario: ${params.pregunta}` : '',
    `Dictamen técnico (JSON):\n${JSON.stringify(params.dictamen ?? {}, null, 2)}`,
  ].filter(Boolean).join('\n\n');

  try {
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (resp.status === 429) return 'Se alcanzó el límite de solicitudes de IA. Intenta nuevamente en unos minutos.';
    if (resp.status === 402) return 'Se agotó el crédito de IA. Recarga el plan para continuar.';
    if (!resp.ok) {
      const t = await resp.text();
      console.error('AI gateway error:', resp.status, t);
      return 'No fue posible generar la explicación narrativa en este momento.';
    }
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content ?? 'Sin respuesta del modelo.';
  } catch (e) {
    console.error('AI call failed:', e);
    return 'No fue posible generar la explicación narrativa en este momento.';
  }
}

function stubCandidatos(lat: number, lon: number, radio_m: number) {
  // Genera candidatos sintéticos alrededor del punto para que el frontend
  // pueda pintar la UI. Reemplazar por consulta espacial real cuando el
  // RPC/tabla esté disponible.
  const items = [] as Array<Record<string, unknown>>;
  const kms = Math.max(1, radio_m / 1000);
  for (let i = 0; i < 5; i++) {
    const dLat = (Math.random() - 0.5) * (kms / 111) * 2;
    const dLon = (Math.random() - 0.5) * (kms / 111) * 2;
    items.push({
      id: `stub-${i}`,
      nombre: `Zona candidata ${i + 1}`,
      comuna: '—',
      lat: lat + dLat,
      lon: lon + dLon,
      distancia_m: Math.round(Math.sqrt(dLat * dLat + dLon * dLon) * 111000),
      costo_contexto: Math.round(20 + Math.random() * 80),
    });
  }
  items.sort((a, b) => (a.costo_contexto as number) - (b.costo_contexto as number));
  return items;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido en el cuerpo de la solicitud.' }, 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Parámetros inválidos', detalles: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;

  try {
    if (input.modo === 'exploracion') {
      const candidatos = stubCandidatos(input.lat, input.lon, input.radio_m);
      return json({ modo: input.modo, candidatos });
    }

    if (input.modo === 'camino_minimo') {
      const base = stubCandidatos(input.lat, input.lon, 8000);
      // factor_costo alto -> priorizar costo bajo; bajo -> priorizar cercanía.
      const w = input.factor_costo / 100;
      const ruta = base
        .map((c) => ({
          ...c,
          score:
            w * (c.costo_contexto as number) +
            (1 - w) * ((c.distancia_m as number) / 100),
        }))
        .sort((a, b) => (a.score as number) - (b.score as number))
        .slice(0, input.max_saltos);
      return json({ modo: input.modo, ruta });
    }

    // modo === 'punto_fijo'
    const respuesta_narrativa = await generarNarrativa({
      categoria: input.categoria_proyecto,
      destino: input.destino_especifico,
      lat: input.lat,
      lon: input.lon,
      pregunta: input.pregunta_texto,
      dictamen: input.dictamen_input,
    });

    // Extrae el primer dictamen si viene, para exponerlo aparte al frontend.
    const dictamenAny = input.dictamen_input as
      | { dictamenes_por_instrumento?: Array<Record<string, unknown>> }
      | undefined;
    const primerDictamen = dictamenAny?.dictamenes_por_instrumento?.[0] ?? null;

    return json({
      modo: input.modo,
      respuesta_narrativa,
      dictamen: primerDictamen
        ? { dictamen: primerDictamen.dictamen, motivos: primerDictamen.motivos ?? [] }
        : { dictamen: 'requiere_revision_manual', motivos: [] },
      dictamen_completo: input.dictamen_input ?? null,
      // Placeholders con shape esperado; el backend puede completar.
      costo_contexto_detalle: [] as Array<{ etiqueta: string; valor: number }>,
      precedentes: [] as Array<{ titulo: string; senal: 'positiva' | 'negativa' | 'pendiente' | 'neutra'; nota?: string }>,
    });
  } catch (e) {
    console.error('consultar-viabilidad error:', e);
    return json({ error: 'Error interno procesando la solicitud.' }, 500);
  }
});
