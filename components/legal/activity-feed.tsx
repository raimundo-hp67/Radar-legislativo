'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw, TrendingUp, Building2, AlertTriangle } from 'lucide-react';
import { RelevanceBadge } from './relevance-badge';
import type { SerializedProjectWithSnapshot } from '~/lib/legal/types';

type ExtendedProject = SerializedProjectWithSnapshot & {
  autores?: string | null
  objetivo?: string | null
  linkProyecto?: string | null
  linkInformes?: string[] | null
};

type ActivityFeedProps = {
  projects: ExtendedProject[]
  maxItems?: number
};

type ActivityItem = {
  id: string
  projectId: number
  boletin: string
  title: string
  relevance: string
  type: 'snapshot' | 'stage_change' | 'chamber_change' | 'urgency_change'
  description: string
  timestamp: Date
  from?: string | null
  to?: string | null
};

function formatDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) {
    return 'Hoy';
  }
  if (dateOnly.getTime() === yesterday.getTime()) {
    return 'Ayer';
  }
  return date.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function getActivityIcon(type: ActivityItem['type']) {
  const iconClasses = 'h-4 w-4';
  switch (type) {
    case 'stage_change':
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
          <TrendingUp className={`${iconClasses} text-blue-600 dark:text-blue-400`} />
        </div>
      );
    case 'chamber_change':
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50">
          <Building2 className={`${iconClasses} text-violet-600 dark:text-violet-400`} />
        </div>
      );
    case 'urgency_change':
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
          <AlertTriangle className={`${iconClasses} text-amber-600 dark:text-amber-400`} />
        </div>
      );
    default:
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <RefreshCw className={`${iconClasses} text-zinc-500 dark:text-zinc-400`} />
        </div>
      );
  }
}

function getActivityTypeLabel(type: ActivityItem['type']): string {
  switch (type) {
    case 'stage_change':
      return 'Cambio de estado';
    case 'chamber_change':
      return 'Cambio de cámara';
    case 'urgency_change':
      return 'Cambio de urgencia';
    default:
      return 'Actualización';
  }
}

export function ActivityFeed({ projects, maxItems = 10 }: ActivityFeedProps) {
  const activityItems = useMemo(() => {
    const items: ActivityItem[] = [];

    for (const project of projects) {
      // Add activity from snapshots with detected changes
      if (project.latestSnapshot?.changesDetected) {
        const changes = project.latestSnapshot.changesDetected as Array<{
          field: string
          from: string | null
          to: string | null
        }>;

        for (const change of changes) {
          let type: ActivityItem['type'] = 'snapshot';
          let description = '';

          if (change.field === 'stage') {
            type = 'stage_change';
            description = change.to
              ? `Estado cambió a "${change.to}"`
              : 'Estado actualizado';
          } else if (change.field === 'chamberCurrent') {
            type = 'chamber_change';
            description = change.to
              ? `Pasó a ${change.to}`
              : 'Cámara actualizada';
          } else if (change.field === 'urgency') {
            type = 'urgency_change';
            description = change.to
              ? `Urgencia: ${change.to}`
              : 'Urgencia actualizada';
          } else {
            description = `${change.field}: ${change.from || '—'} → ${change.to || '—'}`;
          }

          items.push({
            id: `${project.id}-${change.field}-${project.latestSnapshot.fetchedAt}`,
            projectId: project.id,
            boletin: project.boletin,
            title: project.title,
            relevance: project.relevance,
            type,
            description,
            timestamp: new Date(project.latestSnapshot.fetchedAt),
            from: change.from,
            to: change.to,
          });
        }
      }

      // Add general update activity if project was recently updated but no specific changes
      if (project.hasRecentChanges && !project.latestSnapshot?.changesDetected?.length) {
        items.push({
          id: `${project.id}-update-${project.updatedAt}`,
          projectId: project.id,
          boletin: project.boletin,
          title: project.title,
          relevance: project.relevance,
          type: 'snapshot',
          description: 'Datos actualizados',
          timestamp: new Date(project.updatedAt),
        });
      }
    }

    // Sort by timestamp descending and limit
    return items
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, maxItems);
  }, [projects, maxItems]);

  // Group by date
  const groupedItems = useMemo(() => {
    const groups = new Map<string, ActivityItem[]>();
    for (const item of activityItems) {
      const dateKey = formatDate(item.timestamp);
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(item);
    }
    return groups;
  }, [activityItems]);

  if (activityItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <RefreshCw className="h-6 w-6 text-zinc-400" />
        </div>
        <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Sin actividad reciente
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Los cambios detectados aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {Array.from(groupedItems.entries()).map(([dateLabel, items]) => (
        <div key={dateLabel} className="px-4 py-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
            {dateLabel}
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
          </h3>
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="group flex items-start gap-3 rounded-lg p-2 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div className="shrink-0">{getActivityIcon(item.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/legal/projects/${item.projectId}`}
                      className="font-mono text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      {item.boletin}
                    </Link>
                    <RelevanceBadge relevance={item.relevance} />
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium uppercase tracking-[0.14em] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {getActivityTypeLabel(item.type)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400" title={item.title}>
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {item.description}
                  </p>
                  {item.from && item.to && (
                    <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-2.5 py-1 text-xs dark:bg-zinc-800">
                      <span className="text-zinc-500 line-through">{item.from}</span>
                      <ArrowRight className="h-3 w-3 text-zinc-400" />
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{item.to}</span>
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right text-xs text-zinc-400">
                  {item.timestamp.toLocaleTimeString('es-CL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
