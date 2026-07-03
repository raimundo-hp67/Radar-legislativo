'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { differenceInDays } from 'date-fns';
import { AlertCircle, Clock, TrendingUp, CheckCircle } from 'lucide-react';
import type { SerializedProjectWithSnapshot } from '~/lib/legal/types';

type AlertsModuleProps = {
  projects: SerializedProjectWithSnapshot[]
};

type Alert = {
  id: string
  type: 'high-change' | 'stale' | 'urgent'
  title: string
  message: string
  projectId: number
  boletin: string
  severity: 'critical' | 'warning' | 'info'
};

export function AlertsModule({ projects }: AlertsModuleProps) {
  const alerts = useMemo(() => {
    const alertList: Alert[] = [];
    const now = new Date();

    for (const project of projects) {
      // Alert: HIGH priority with recent changes
      if (project.relevance === 'HIGH' && project.hasRecentChanges) {
        alertList.push({
          id: `high-change-${project.id}`,
          type: 'high-change',
          title: 'Cambio en proyecto prioritario',
          message: project.title.slice(0, 50) + (project.title.length > 50 ? '...' : ''),
          projectId: project.id,
          boletin: project.boletin,
          severity: 'critical',
        });
      }

      // Alert: Project not updated in 14+ days
      const lastFetch = project.latestSnapshot?.fetchedAt;
      if (lastFetch) {
        const daysSinceUpdate = differenceInDays(now, new Date(lastFetch));
        if (daysSinceUpdate > 14) {
          alertList.push({
            id: `stale-${project.id}`,
            type: 'stale',
            title: 'Sin actualizar',
            message: `${project.boletin} - ${daysSinceUpdate} días`,
            projectId: project.id,
            boletin: project.boletin,
            severity: 'warning',
          });
        }
      }

      // Alert: Urgent projects
      const urgency = project.urgencia || project.latestSnapshot?.urgency;
      if (urgency && (urgency.toLowerCase().includes('inmediata') || urgency.toLowerCase().includes('suma'))) {
        alertList.push({
          id: `urgent-${project.id}`,
          type: 'urgent',
          title: 'Urgencia activa',
          message: `${project.boletin} - ${urgency}`,
          projectId: project.id,
          boletin: project.boletin,
          severity: urgency.toLowerCase().includes('inmediata') ? 'critical' : 'warning',
        });
      }
    }

    // Sort by severity
    return alertList.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [projects]);

  if (alerts.length === 0) {
    return (
      <div className="text-center py-4">
        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-blue-500" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sin alertas pendientes
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      {alerts.slice(0, 10).map((alert) => (
        <Link
          key={alert.id}
          href={`/legal/projects/${alert.projectId}`}
          className={`block rounded-lg p-3 transition-colors hover:opacity-90 ${
            alert.severity === 'critical'
              ? 'bg-slate-900 dark:bg-slate-800'
              : alert.severity === 'warning'
                ? 'bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900'
                : 'bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700'
          }`}
        >
          <div className="flex items-start gap-2">
            <div className="mt-0.5">
              {alert.type === 'high-change' && (
                <TrendingUp
                  className={`h-4 w-4 ${
                    alert.severity === 'critical' ? 'text-white' : 'text-blue-600'
                  }`}
                />
              )}
              {alert.type === 'stale' && (
                <Clock className="h-4 w-4 text-slate-500" />
              )}
              {alert.type === 'urgent' && (
                <AlertCircle
                  className={`h-4 w-4 ${
                    alert.severity === 'critical' ? 'text-white' : 'text-blue-600'
                  }`}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`text-xs font-semibold ${
                  alert.severity === 'critical'
                    ? 'text-white'
                    : alert.severity === 'warning'
                      ? 'text-blue-700 dark:text-blue-400'
                      : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {alert.title}
              </p>
              <p className={`text-xs truncate ${alert.severity === 'critical' ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400'}`}>
                {alert.message}
              </p>
            </div>
          </div>
        </Link>
      ))}
      {alerts.length > 10 && (
        <p className="text-xs text-center text-slate-500 dark:text-slate-400 pt-2">
          +
          {alerts.length - 10}
          {' '}
          alertas más
        </p>
      )}
    </div>
  );
}

export function getAlertsCount(projects: SerializedProjectWithSnapshot[]): number {
  let count = 0;
  const now = new Date();

  for (const project of projects) {
    if (project.relevance === 'HIGH' && project.hasRecentChanges) count++;

    const lastFetch = project.latestSnapshot?.fetchedAt;
    if (lastFetch && differenceInDays(now, new Date(lastFetch)) > 14) count++;

    const urgency = project.urgencia || project.latestSnapshot?.urgency;
    if (urgency && (urgency.toLowerCase().includes('inmediata') || urgency.toLowerCase().includes('suma'))) {
      count++;
    }
  }

  return count;
}
