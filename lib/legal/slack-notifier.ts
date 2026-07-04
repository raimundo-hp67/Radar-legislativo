import { env } from '~/config/env';
import { radarConfig } from '~/config/radar.config';
import { formatChanges } from './diff-engine';
import type { PollResult } from './types';
import type { LobbyAudiencia } from '~/db/schema';

const RELEVANCE_CONFIG = {
  HIGH: { emoji: '🔴', label: 'Alta' },
  MEDIUM: { emoji: '🟡', label: 'Media' },
  LOW: { emoji: '⚪', label: 'Baja' },
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type SlackMessage = {
  text: string
  blocks?: SlackBlock[]
};

type SlackBlock = {
  type: string
  text?: { type: string, text: string, emoji?: boolean }
  elements?: Array<{ type: string, text: string }>
  accessory?: {
    type: string
    text: { type: string, text: string, emoji?: boolean }
    url: string
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send the weekly digest with the legislative changes detected by the poll.
 */
export async function sendWeeklyDigest(
  legislativeChanges: PollResult[],
): Promise<void> {
  const webhookUrl = env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('Slack webhook URL not configured, skipping weekly digest');
    return;
  }
  const message = formatWeeklyDigest(legislativeChanges);
  await postToSlack(webhookUrl, message);
}

/**
 * Send an immediate alert for a high-priority legislative change
 */
export async function sendSlackAlert(result: PollResult): Promise<void> {
  const webhookUrl = env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  await postToSlack(webhookUrl, formatAlertMessage(result));
}

// Keep for backward compatibility
export async function sendSlackDigest(resultsWithChanges: PollResult[]): Promise<void> {
  await sendWeeklyDigest(resultsWithChanges);
}

// ─── Core ─────────────────────────────────────────────────────────────────────

async function postToSlack(webhookUrl: string, message: SlackMessage): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Slack webhook failed: ${response.status} ${errorText}`);
  }
}

function getChileTimestamp(): string {
  return new Date().toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function getChileDate(): string {
  return new Date().toLocaleDateString('es-CL', {
    timeZone: 'America/Santiago',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Weekly Digest ────────────────────────────────────────────────────────────

function formatWeeklyDigest(legislativeChanges: PollResult[]): SlackMessage {
  const blocks: SlackBlock[] = [];

  // ── Header ────────────────────────────────────────────────────────────────
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: '📅 Resumen Semanal Legislativo', emoji: true },
  });
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `*${getChileDate()}*  |  Generado automáticamente cada lunes` }],
  });
  blocks.push({ type: 'divider' } as SlackBlock);

  // ── Radar Legislativo ─────────────────────────────────────────────────────
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: '*⚖️  RADAR LEGISLATIVO*' },
  });

  if (legislativeChanges.length === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '✅ Sin cambios en los proyectos de ley monitoreados esta semana.' },
    });
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Se detectaron cambios en *${legislativeChanges.length}* proyecto(s):`,
      },
    });

    const sorted = [...legislativeChanges].sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return order[a.relevance] - order[b.relevance];
    });

    for (const result of sorted.slice(0, 5)) {
      const { emoji, label } = RELEVANCE_CONFIG[result.relevance];
      const changesText = result.changes
        ? formatChanges(result.changes).map((c) => `  › ${c}`).join('\n')
        : '';
      const url = result.snapshot.sourceUrl;

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *Boletín ${result.boletin}* — _${label}_\n${result.title}${changesText ? `\n${changesText}` : ''}`,
        },
        accessory: url
          ? { type: 'button', text: { type: 'plain_text', text: '📄 Ver PDL', emoji: true }, url }
          : undefined,
      });
    }

    if (legislativeChanges.length > 5) {
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `_...y ${legislativeChanges.length - 5} proyecto(s) más con cambios._` }],
      });
    }
  }
  blocks.push({ type: 'divider' } as SlackBlock);

  // ── Footer ────────────────────────────────────────────────────────────────
  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `🤖 Generado automáticamente | ${getChileTimestamp()} | Radar Legislativo` },
    ],
  });

  const summaryText = legislativeChanges.length === 0
    ? '📅 Resumen semanal: sin novedades esta semana'
    : `📅 Resumen semanal: ${legislativeChanges.length} proyecto(s) con cambios`;

  return { text: summaryText, blocks };
}

// ─── Alert ────────────────────────────────────────────────────────────────────

function formatAlertMessage(result: PollResult): SlackMessage {
  const sourceUrl = result.snapshot.sourceUrl;
  const changesText = result.changes
    ? formatChanges(result.changes).map((c) => `• ${c}`).join('\n')
    : 'Sin detalles de cambios';

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🚨 Alerta: Cambio en Proyecto Prioritario', emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `🔴 *Boletín ${result.boletin}*\n${result.title}` },
      accessory: sourceUrl
        ? { type: 'button', text: { type: 'plain_text', text: '📄 Ver PDL', emoji: true }, url: sourceUrl }
        : undefined,
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Cambios detectados:*\n${changesText}` },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Detectado: ${getChileTimestamp()}` }],
    },
  ];

  return {
    text: `🚨 ALERTA: Cambio en Boletín ${result.boletin} - ${result.title}`,
    blocks,
  };
}

// ─── Legacy (project-level) ───────────────────────────────────────────────────

function formatProjectBlock(result: PollResult): SlackBlock[] {
  const { emoji, label } = RELEVANCE_CONFIG[result.relevance];
  const sourceUrl = result.snapshot.sourceUrl;
  const changesText = result.changes
    ? formatChanges(result.changes).map((c) => `• ${c}`).join('\n')
    : '';

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *Boletín ${result.boletin}*\n${result.title}\n_Prioridad: ${label}_`,
      },
      accessory: sourceUrl
        ? { type: 'button', text: { type: 'plain_text', text: '📄 Ver PDL', emoji: true }, url: sourceUrl }
        : undefined,
    },
  ];

  if (changesText) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Cambios detectados:*\n${changesText}` },
    });
  }

  blocks.push({ type: 'divider' } as SlackBlock);
  return blocks;
}

export { formatProjectBlock };

// ─── Lobby Activity Notifications ────────────────────────────────────────────

// Watched institutions come from the theme config (config/radar.config.ts)
const LOBBY_WATCH_KEYWORDS = radarConfig.lobbyWatchKeywords;

/**
 * Send a Slack alert when audiencias involving key financial institutions are
 * detected during a lobby sync. Does nothing if there are no matching rows or
 * if the webhook is not configured.
 */
export async function notifyLobbyActividad(audiencias: LobbyAudiencia[]): Promise<void> {
  const webhookUrl = env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const relevant = audiencias.filter((a) => {
    const institucion = a.sujetoPasivoInstitucion ?? '';
    return LOBBY_WATCH_KEYWORDS.some((kw) =>
      institucion.toLowerCase().includes(kw.toLowerCase()),
    );
  });

  if (relevant.length === 0) return;

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🤝 Nuevas Audiencias de Lobby Detectadas',
        emoji: true,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*${getChileDate()}*  |  ${relevant.length} audiencia(s) en instituciones clave`,
        },
      ],
    },
    { type: 'divider' } as SlackBlock,
  ];

  for (const a of relevant.slice(0, 10)) {
    const fecha = a.fecha ?? 'Fecha desconocida';
    const institucion = a.sujetoPasivoInstitucion ?? 'Institución desconocida';
    const sujetoPasivo = a.sujetoPasivo ?? '';
    const sujetoActivo = a.sujetoActivo ?? '';
    const materia = a.materia ?? '';

    const lines: string[] = [];
    if (sujetoPasivo) lines.push(`*Sujeto pasivo:* ${sujetoPasivo}`);
    if (sujetoActivo) lines.push(`*Lobbyist:* ${sujetoActivo}`);
    if (a.sujetoActivoOrganizacion) lines.push(`*Organización:* ${a.sujetoActivoOrganizacion}`);
    if (materia) {
      const trimmed = materia.length > 200 ? `${materia.substring(0, 200)}…` : materia;
      lines.push(`*Materia:* ${trimmed}`);
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🏛️ *${institucion}* — ${fecha}\n${lines.join('\n')}`,
      },
      accessory: a.sourceUrl
        ? { type: 'button', text: { type: 'plain_text', text: '🔗 Ver', emoji: true }, url: a.sourceUrl }
        : undefined,
    });
  }

  if (relevant.length > 10) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_…y ${relevant.length - 10} audiencia(s) más. <https://www.infolobby.cl|Ver en InfoLobby>_`,
        },
      ],
    });
  }

  blocks.push({ type: 'divider' } as SlackBlock);
  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `🤖 Generado automáticamente | ${getChileTimestamp()} | Radar Legislativo` },
    ],
  });

  await postToSlack(webhookUrl, {
    text: `🤝 ${relevant.length} nueva(s) audiencia(s) de lobby en ${radarConfig.lobbyAlertLabel}`,
    blocks,
  });
}
