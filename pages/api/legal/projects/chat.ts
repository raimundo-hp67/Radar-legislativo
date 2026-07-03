import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import * as z from 'zod';
import { protectedHandler } from '~/lib/api/protected-handler';
import { db } from '~/db';
import { legalProjects, projectSnapshots } from '~/db/schema';
import { eq, desc } from 'drizzle-orm';
import {
  searchProjectsInCache,
  searchByBoletin,
} from '~/lib/legal/project-search';

// Vercel: allow up to 60s for tool calls + streaming
export const maxDuration = 60;

export const config = {
  api: {
    bodyParser: true,
    responseLimit: false,
  },
};

const MODEL = 'gpt-4o';

const SYSTEM_PROMPT = `Eres un analista legislativo experto en el proceso legislativo chileno.
Tienes acceso a herramientas para buscar proyectos de ley, obtener detalles, consultar el historial de cambios, y enviar alertas al canal de Slack del equipo.
Los datos incluyen proyectos en trámite en la Cámara de Diputados y el Senado de Chile.

Responde en español de Chile. Sé conciso, claro y analítico.
Cuando cites datos, sé específico con boletines, fechas y estados.
Si no tienes datos suficientes, dilo claramente y sugiere cómo refinar la búsqueda.
Ofrece contexto legislativo cuando sea relevante (ej: qué significa cada trámite, urgencias, etc).
Cuando el usuario quiera crear una alerta o seguimiento, usa la herramienta send_slack_alert.`;

const projectsChatRequestSchema = z.object({
  message: z.string().trim().min(1),
  history: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).optional().default([]),
  moduleKey: z.enum(['proyectos', 'investigacion']).optional().default('proyectos'),
});

async function getTrackedProjects() {
  const rows = await db
    .select({
      boletin: legalProjects.boletin,
      title: legalProjects.title,
      relevance: legalProjects.relevance,
      estado: legalProjects.estado,
      camara: legalProjects.camara,
      urgencia: legalProjects.urgencia,
      comision: legalProjects.comision,
      objetivo: legalProjects.objetivo,
    })
    .from(legalProjects)
    .orderBy(desc(legalProjects.updatedAt))
    .limit(50);

  return rows;
}

async function getProjectSnapshots(boletin: string) {
  const rows = await db
    .select({
      stage: projectSnapshots.stage,
      chamberCurrent: projectSnapshots.chamberCurrent,
      lastAction: projectSnapshots.lastAction,
      lastActionDate: projectSnapshots.lastActionDate,
      urgency: projectSnapshots.urgency,
      commission: projectSnapshots.commission,
      fetchedAt: projectSnapshots.fetchedAt,
      changesDetected: projectSnapshots.changesDetected,
    })
    .from(projectSnapshots)
    .where(eq(projectSnapshots.boletin, boletin.trim()))
    .orderBy(desc(projectSnapshots.fetchedAt))
    .limit(20);

  return rows;
}

async function getProjectDetail(boletin: string) {
  const [project] = await db
    .select()
    .from(legalProjects)
    .where(eq(legalProjects.boletin, boletin.trim()))
    .limit(1);

  return project ?? null;
}

async function sendSlackAlert(args: {
  title: string
  message: string
  boletin?: string
  urgency?: string
}): Promise<string> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return JSON.stringify({
      error: 'Slack no configurado. Agrega SLACK_WEBHOOK_URL a las variables de entorno.',
    });
  }

  const urgency = args.urgency ?? 'media';
  const emoji = urgency === 'alta' ? '🔴' : urgency === 'baja' ? '⚪' : '🟡';
  const boletinText = args.boletin ? `\n*Boletín:* ${args.boletin}` : '';
  const dateText = new Date().toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const body = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} ${args.title}`, emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `${args.message}${boletinText}` },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Urgencia:* ${urgency} · *Fuente:* Agente Legislativo · ${dateText}`,
          },
        ],
      },
    ],
  };

  try {
    const slackRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!slackRes.ok) {
      return JSON.stringify({ error: `Slack respondió con ${slackRes.status}` });
    }

    return JSON.stringify({ sent: true, message: 'Alerta enviada a Slack exitosamente.' });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : 'Error enviando a Slack' });
  }
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_projects',
      description: 'Buscar proyectos de ley por palabras clave en el caché local (título, autores, materias)',
      parameters: {
        type: 'object',
        properties: {
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Palabras clave para buscar (ej: ["fintech", "pagos"])',
          },
          limit: { type: 'number', description: 'Máximo de resultados (default 15)' },
        },
        required: ['keywords'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project_by_boletin',
      description: 'Obtener un proyecto específico por su número de boletín',
      parameters: {
        type: 'object',
        properties: {
          boletin: { type: 'string', description: 'Número de boletín (ej: "12345-03")' },
        },
        required: ['boletin'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tracked_projects',
      description: 'Listar los proyectos de ley que estamos monitoreando activamente con su prioridad y estado',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project_snapshots',
      description: 'Obtener el historial de cambios de un proyecto por su boletín (snapshots con cambios detectados)',
      parameters: {
        type: 'object',
        properties: {
          boletin: { type: 'string', description: 'Número de boletín' },
        },
        required: ['boletin'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project_detail',
      description: 'Obtener todos los detalles de un proyecto que estamos rastreando (notas, objetivo, links, etc)',
      parameters: {
        type: 'object',
        properties: {
          boletin: { type: 'string', description: 'Número de boletín' },
        },
        required: ['boletin'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_slack_alert',
      description: 'Enviar una alerta de seguimiento legislativo al canal de Slack del equipo',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Título corto y descriptivo de la alerta (ej: "Proyecto Fintech avanza a 2° trámite")',
          },
          message: {
            type: 'string',
            description: 'Descripción detallada con el contexto legislativo relevante para el equipo',
          },
          boletin: {
            type: 'string',
            description: 'Número de boletín relacionado (opcional)',
          },
          urgency: {
            type: 'string',
            enum: ['alta', 'media', 'baja'],
            description: 'Nivel de urgencia: alta (🔴), media (🟡), baja (⚪)',
          },
        },
        required: ['title', 'message'],
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'search_projects': {
      const results = await searchProjectsInCache(
        args.keywords as string[],
        (args.limit as number) || 15,
      );
      return JSON.stringify(results);
    }
    case 'get_project_by_boletin': {
      const result = await searchByBoletin(args.boletin as string);
      return JSON.stringify(result);
    }
    case 'get_tracked_projects': {
      const projects = await getTrackedProjects();
      return JSON.stringify(projects);
    }
    case 'get_project_snapshots': {
      const snapshots = await getProjectSnapshots(args.boletin as string);
      return JSON.stringify(snapshots);
    }
    case 'get_project_detail': {
      const detail = await getProjectDetail(args.boletin as string);
      return JSON.stringify(detail);
    }
    case 'send_slack_alert': {
      return sendSlackAlert(args as { title: string, message: string, boletin?: string, urgency?: string });
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

  const parsedBody = projectsChatRequestSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      error: 'Body inválido',
      details: parsedBody.error.flatten(),
    });
  }

  const { message, history } = parsedBody.data;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'El asistente de IA no está configurado. Agrega OPENAI_API_KEY a las variables de entorno para habilitarlo.',
    });
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

    // Phase 1 — non-streaming tool calls (up to 3 rounds)
    let toolRounds = 0;
    while (toolRounds < 3) {
      const resp = await openai.chat.completions.create({
        model: MODEL,
        messages,
        tools,
        tool_choice: 'auto',
      });

      const assistantMsg = resp.choices[0].message;

      if (!assistantMsg.tool_calls?.length) {
        // No more tool calls — ready for streaming final response
        break;
      }

      messages.push(assistantMsg);

      for (const toolCall of assistantMsg.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        const result = await executeTool(toolCall.function.name, args);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      toolRounds++;
    }

    // Phase 2 — stream final text response as SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Note: no `tools` here so the model won't try to call any
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify(delta)}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Error in projects chat:', error);

    if (!res.headersSent) {
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

    // Streaming already started — send error via SSE and close
    try {
      res.write(`data: ${JSON.stringify('[ERROR] Ocurrió un error generando la respuesta.')}\n\n`);
      res.write('data: [DONE]\n\n');
    } catch {
      // ignore write errors on closed connection
    } finally {
      res.end();
    }
  }
}, { rateLimit: { limit: 20, windowMs: 5 * 60_000 } });
