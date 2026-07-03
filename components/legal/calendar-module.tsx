'use client';

import { useMemo } from 'react';
import { format, addDays, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, AlertTriangle, CalendarDays } from 'lucide-react';
import type { SerializedProjectWithSnapshot } from '~/lib/legal/types';

type CalendarModuleProps = {
  projects: SerializedProjectWithSnapshot[]
};

type UrgencyItem = {
  boletin: string
  title: string
  urgency: string
  daysRemaining: number | null
  level: 'high' | 'medium' | 'low'
};

export function CalendarModule({ projects }: CalendarModuleProps) {
  const urgentProjects = useMemo(() => {
    const items: UrgencyItem[] = [];

    for (const project of projects) {
      const urgency = project.urgencia || project.latestSnapshot?.urgency;

      if (urgency && urgency !== 'Sin urgencia' && urgency !== '—') {
        // Estimate days remaining based on urgency type
        let daysRemaining: number | null = null;
        let level: 'high' | 'medium' | 'low' = 'low';

        const urgencyLower = urgency.toLowerCase();
        if (urgencyLower.includes('discusión inmediata') || urgencyLower.includes('inmediata')) {
          daysRemaining = 3;
          level = 'high';
        } else if (urgencyLower.includes('suma')) {
          daysRemaining = 10;
          level = 'medium';
        } else if (urgencyLower.includes('simple')) {
          daysRemaining = 30;
          level = 'low';
        }

        items.push({
          boletin: project.boletin,
          title: project.title.length > 40 ? project.title.slice(0, 40) + '...' : project.title,
          urgency,
          daysRemaining,
          level,
        });
      }
    }

    // Sort by days remaining (most urgent first)
    return items.sort((a, b) => {
      if (a.daysRemaining === null) return 1;
      if (b.daysRemaining === null) return -1;
      return a.daysRemaining - b.daysRemaining;
    });
  }, [projects]);

  const recentlyUpdated = useMemo(() => {
    const sevenDaysAgo = addDays(new Date(), -7);

    return projects
      .filter((p) => {
        const updatedAt = new Date(p.updatedAt);
        return isAfter(updatedAt, sevenDaysAgo);
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [projects]);

  if (urgentProjects.length === 0 && recentlyUpdated.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500 dark:text-slate-400">
        <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No hay plazos urgentes</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Urgencias activas */}
      {urgentProjects.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-2">
            Urgencias Activas
          </h4>
          <div className="space-y-2">
            {urgentProjects.slice(0, 5).map((item) => (
              <div
                key={item.boletin}
                className={`rounded-lg p-3 ${
                  item.level === 'high'
                    ? 'bg-slate-900 dark:bg-slate-800'
                    : item.level === 'medium'
                      ? 'bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900'
                      : 'bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium truncate ${item.level === 'high' ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                      {item.title}
                    </p>
                    <p className={`text-xs ${item.level === 'high' ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {item.boletin}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.level === 'high' && (
                      <AlertTriangle className="h-4 w-4 text-white" />
                    )}
                    <span
                      className={`text-xs font-semibold ${
                        item.level === 'high'
                          ? 'text-white'
                          : item.level === 'medium'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {item.urgency}
                    </span>
                  </div>
                </div>
                {item.daysRemaining !== null && (
                  <div className={`mt-2 flex items-center gap-1 text-xs ${item.level === 'high' ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    <Clock className="h-3 w-3" />
                    <span>
                      ~
                      {item.daysRemaining}
                      {' '}
                      días estimados
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actualizaciones recientes */}
      {recentlyUpdated.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-2">
            Actualizados esta semana
          </h4>
          <div className="space-y-1.5">
            {recentlyUpdated.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between text-xs py-1"
              >
                <span className="text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                  {project.boletin}
                </span>
                <span className="text-slate-400 dark:text-slate-500">
                  {format(new Date(project.updatedAt), 'dd MMM', { locale: es })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
