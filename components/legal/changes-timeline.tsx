'use client';

import { FIELD_LABELS } from '~/lib/legal/diff-engine';
import { RelevanceBadge } from './relevance-badge';
import type { SnapshotChange, ProjectSnapshot } from '~/db/schema';

type ChangeEntry = {
  id: number
  boletin: string
  title: string
  relevance: string
  changes: SnapshotChange[] | null
  fetchedAt: Date | string
  stage: string | null
  chamberCurrent: string | null
  lastAction: string | null
  lastActionDate: string | null
};

type ChangesTimelineProps = {
  changes: ChangeEntry[]
};

export function ChangesTimeline({ changes }: ChangesTimelineProps) {
  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-zinc-500 dark:text-zinc-400">
          No se han detectado cambios en los proyectos monitoreados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {changes.map((change) => (
        <ChangeCard key={change.id} change={change} />
      ))}
    </div>
  );
}

function safeParseDate(dateValue: Date | string): Date {
  if (dateValue instanceof Date) return dateValue;
  const parsed = new Date(dateValue);
  // Return a valid date or fallback to current date
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function ChangeCard({ change }: { change: ChangeEntry }) {
  const date = safeParseDate(change.fetchedAt);
  const formattedDate = date.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
              {change.boletin}
            </span>
            <RelevanceBadge relevance={change.relevance} />
          </div>
          <h3 className="font-medium">{change.title}</h3>
        </div>
        <div className="text-right text-sm text-zinc-500 dark:text-zinc-400">
          <div>{formattedDate}</div>
          <div>{formattedTime}</div>
        </div>
      </div>

      {change.changes && change.changes.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Cambios detectados:
          </h4>
          <ul className="space-y-1" aria-label="Lista de cambios detectados">
            {change.changes.map((c, idx) => (
              <li
                key={`${change.id}-${c.field}-${idx}`}
                className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400"
              >
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-500" />
                <span>
                  <span className="font-medium">
                    {FIELD_LABELS[c.field] || c.field}
                    :
                  </span>
                  {' '}
                  <span className="text-red-600 line-through dark:text-red-400">
                    {c.from || '∅'}
                  </span>
                  {' '}
                  →
                  {' '}
                  <span className="text-green-600 dark:text-green-400">
                    {c.to || '∅'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 text-sm dark:border-zinc-800">
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Estado actual:</span>
          <p className="font-medium">{change.stage || '—'}</p>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Cámara:</span>
          <p className="font-medium">{change.chamberCurrent || '—'}</p>
        </div>
      </div>
    </div>
  );
}

type SnapshotTimelineProps = {
  snapshots: ProjectSnapshot[]
};

export function SnapshotTimeline({ snapshots }: SnapshotTimelineProps) {
  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-zinc-500 dark:text-zinc-400">
          No hay historial de snapshots disponible.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {snapshots.map((snapshot, idx) => (
        <div
          key={snapshot.id}
          className="relative rounded-lg border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {idx === 0 && (
            <span className="absolute -top-2 right-4 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Más reciente
            </span>
          )}

          <div className="flex items-start justify-between">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              {safeParseDate(snapshot.fetchedAt).toLocaleDateString('es-CL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Estado:</span>
              <p className="font-medium">{snapshot.stage || '—'}</p>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Cámara:</span>
              <p className="font-medium">{snapshot.chamberCurrent || '—'}</p>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Urgencia:</span>
              <p className="font-medium">{snapshot.urgency || '—'}</p>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Último trámite:</span>
              <p className="font-medium">{snapshot.lastActionDate || '—'}</p>
            </div>
          </div>

          {snapshot.lastAction && (
            <div className="mt-3 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">
                Descripción último trámite:
              </span>
              <p className="mt-1">{snapshot.lastAction}</p>
            </div>
          )}

          {snapshot.changesDetected && snapshot.changesDetected.length > 0 && (
            <div className="mt-3 rounded bg-yellow-50 p-2 dark:bg-yellow-950/30">
              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Cambios vs snapshot anterior:
              </h4>
              <ul className="mt-1 space-y-1" aria-label="Cambios vs snapshot anterior">
                {snapshot.changesDetected.map((c, cidx) => (
                  <li
                    key={`${snapshot.id}-change-${c.field}-${cidx}`}
                    className="text-sm text-yellow-700 dark:text-yellow-300"
                  >
                    {FIELD_LABELS[c.field] || c.field}
                    :
                    {' '}
                    {c.from || '∅'}
                    {' '}
                    →
                    {' '}
                    {c.to || '∅'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
