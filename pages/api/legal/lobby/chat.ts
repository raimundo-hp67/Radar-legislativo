import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { protectedHandler } from '~/lib/api/protected-handler';
import { db } from '~/db';
import { lobbyAudiencias } from '~/db/schema';
import { ilike, count, desc, sql, and } from 'drizzle-orm';

const SYSTEM_PROMPT = `Eres un analista experto en lobby y relaciones institucionales en Chile. 
Tienes acceso a una base de datos de audiencias de lobby registradas en InfoLobby (Ley 20.730).
Los datos cubren audiencias desde 2024 en adelante, de instituciones como el Congreso, CMF, Banco Central, 
Superintendencias, y ministerios relevantes.

Responde en español de Chile. Sé conciso y analítico. Cuando des datos, cita números específicos.
Si no tienes datos suficientes para responder, dilo claramente.
Siempre que puedas, ofrece insights o patrones interesantes que observes en los datos.`;

async function searchAudiencias(query: string, limit: number = 10) {
  const term = `%${query.toLowerCase()}%`;
  return db
    .select({
      fecha: lobbyAudiencias.fecha,
      sujetoPasivo: lobbyAudiencias.sujetoPasivo,
      sujetoPasivoCargo: lobbyAudiencias.sujetoPasivoCargo,
      sujetoPasivoInstitucion: lobbyAudiencias.sujetoPasivoInstitucion,
      sujetoActivo: lobbyAudiencias.sujetoActivo,
      materia: lobbyAudiencias.materia,
    })
    .from(lobbyAudiencias)
    .where(ilike(lobbyAudiencias.searchText, term))
    .orderBy(desc(lobbyAudiencias.fecha))
    .limit(limit);
}

async function getInstitutionStats(institution: string) {
  const term = `%${institution}%`;
  const [total] = await db
    .select({ value: count() })
    .from(lobbyAudiencias)
    .where(ilike(lobbyAudiencias.sujetoPasivoInstitucion, term));

  const topActivos = await db
    .select({ name: lobbyAudiencias.sujetoActivo, count: count() })
    .from(lobbyAudiencias)
    .where(and(
      ilike(lobbyAudiencias.sujetoPasivoInstitucion, term),
      sql`${lobbyAudiencias.sujetoActivo} IS NOT NULL`,
    ))
    .groupBy(lobbyAudiencias.sujetoActivo)
    .orderBy(desc(count()))
    .limit(5);

  const topPasivos = await db
    .select({
      name: lobbyAudiencias.sujetoPasivo,
      cargo: lobbyAudiencias.sujetoPasivoCargo,
      count: count(),
    })
    .from(lobbyAudiencias)
    .where(ilike(lobbyAudiencias.sujetoPasivoInstitucion, term))
    .groupBy(lobbyAudiencias.sujetoPasivo, lobbyAudiencias.sujetoPasivoCargo)
    .orderBy(desc(count()))
    .limit(5);

  return { total: total.value, topActivos, topPasivos };
}

async function countMeetings(person: string) {
  const term = `%${person.toLowerCase()}%`;
  const [asPassive] = await db
    .select({ value: count() })
    .from(lobbyAudiencias)
    .where(ilike(lobbyAudiencias.sujetoPasivo, term));

  const [asActive] = await db
    .select({ value: count() })
    .from(lobbyAudiencias)
    .where(ilike(lobbyAudiencias.sujetoActivo, term));

  const recent = await db
    .select({
      fecha: lobbyAudiencias.fecha,
      sujetoPasivo: lobbyAudiencias.sujetoPasivo,
      sujetoPasivoInstitucion: lobbyAudiencias.sujetoPasivoInstitucion,
      sujetoActivo: lobbyAudiencias.sujetoActivo,
      materia: lobbyAudiencias.materia,
    })
    .from(lobbyAudiencias)
    .where(ilike(lobbyAudiencias.searchText, term))
    .orderBy(desc(lobbyAudiencias.fecha))
    .limit(5);

  return { asPassive: asPassive.value, asActive: asActive.value, recent };
}

async function crossReference(institution: string, organization: string) {
  const instTerm = `%${institution}%`;
  const orgTerm = `%${organization.toLowerCase()}%`;

  const meetings = await db
    .select({
      fecha: lobbyAudiencias.fecha,
      sujetoPasivo: lobbyAudiencias.sujetoPasivo,
      sujetoActivo: lobbyAudiencias.sujetoActivo,
      materia: lobbyAudiencias.materia,
    })
    .from(lobbyAudiencias)
    .where(and(
      ilike(lobbyAudiencias.sujetoPasivoInstitucion, instTerm),
      ilike(lobbyAudiencias.searchText, orgTerm),
    ))
    .orderBy(desc(lobbyAudiencias.fecha))
    .limit(10);

  return { count: meetings.length, meetings };
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_audiencias',
      description: 'Buscar audiencias de lobby por texto libre (nombre, tema, institución, etc)',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda' },
          limit: { type: 'number', description: 'Máximo de resultados (default 10)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_institution_stats',
      description: 'Obtener estadísticas de una institución: total de audiencias, principales visitantes y funcionarios',
      parameters: {
        type: 'object',
        properties: {
          institution: { type: 'string', description: 'Nombre de la institución (ej: Banco Central, CMF, Senado)' },
        },
        required: ['institution'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'count_meetings',
      description: 'Contar reuniones de una persona específica (como sujeto pasivo o activo)',
      parameters: {
        type: 'object',
        properties: {
          person: { type: 'string', description: 'Nombre de la persona' },
        },
        required: ['person'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crossref',
      description: 'Cruzar datos: encontrar reuniones entre una institución y una organización/persona específica',
      parameters: {
        type: 'object',
        properties: {
          institution: { type: 'string', description: 'Institución del sujeto pasivo' },
          organization: { type: 'string', description: 'Organización o nombre del sujeto activo' },
        },
        required: ['institution', 'organization'],
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'search_audiencias': {
      const results = await searchAudiencias(args.query as string, (args.limit as number) || 10);
      return JSON.stringify(results);
    }
    case 'get_institution_stats': {
      const stats = await getInstitutionStats(args.institution as string);
      return JSON.stringify(stats);
    }
    case 'count_meetings': {
      const data = await countMeetings(args.person as string);
      return JSON.stringify(data);
    }
    case 'crossref': {
      const data = await crossReference(args.institution as string, args.organization as string);
      return JSON.stringify(data);
    }
    default:
      return JSON.stringify({ error: 'Unknown tool' });
  }
}

export default protectedHandler(async (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  const { message, history = [] } = req.body as {
    message: string
    history: Array<{ role: string, content: string }>
  };

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const openai = new OpenAI({ apiKey });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const MODEL = 'gpt-4o';

    let response = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: 'auto',
    });

    let assistantMessage = response.choices[0].message;

    // Handle tool calls (up to 3 rounds)
    let rounds = 0;
    while (assistantMessage.tool_calls && rounds < 3) {
      rounds++;
      messages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const fn = toolCall.function;
        const args = JSON.parse(fn.arguments);
        const result = await executeTool(fn.name, args);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      response = await openai.chat.completions.create({
        model: MODEL,
        messages,
        tools,
        tool_choice: 'auto',
      });

      assistantMessage = response.choices[0].message;
    }

    return res.status(200).json({
      response: assistantMessage.content || 'No pude generar una respuesta.',
    });
  } catch (error) {
    console.error('Error in lobby chat:', error);

    // Handle OpenAI rate limit (429) with a user-friendly message
    const status = (error as { status?: number }).status;
    if (status === 429) {
      return res.status(429).json({
        error: 'Límite de solicitudes alcanzado. Por favor espera unos segundos e intenta de nuevo.',
      });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
