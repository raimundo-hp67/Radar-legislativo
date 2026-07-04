'use client';

import { Calendar, CalendarDays, AlertTriangle, Flame } from 'lucide-react';
import { cn } from '~/lib/utils';

export type QuickFilterType = 'week' | 'month' | 'urgent' | 'high-priority' | null;

type QuickFiltersProps = {
  activeFilter: QuickFilterType
  onChange: (filter: QuickFilterType) => void
  counts?: {
    week: number
    month: number
    urgent: number
    highPriority: number
  }
};

const filters: { id: QuickFilterType, label: string, icon: React.ReactNode, color: string, activeColor: string }[] = [
  {
    id: 'week',
    label: 'Esta semana',
    icon: <Calendar className="h-4 w-4" />,
    color: 'hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-700 dark:hover:bg-cyan-950 dark:hover:border-cyan-700 dark:hover:text-cyan-300',
    activeColor: 'bg-cyan-500 text-white border-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600 dark:border-cyan-600',
  },
  {
    id: 'month',
    label: 'Este mes',
    icon: <CalendarDays className="h-4 w-4" />,
    color: 'hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 dark:hover:bg-rose-950 dark:hover:border-rose-700 dark:hover:text-rose-300',
    activeColor: 'bg-rose-500 text-white border-rose-500 hover:bg-rose-600 dark:bg-rose-600 dark:border-rose-600',
  },
  {
    id: 'urgent',
    label: 'Con urgencia',
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 dark:hover:bg-amber-950 dark:hover:border-amber-700 dark:hover:text-amber-300',
    activeColor: 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:border-amber-600',
  },
  {
    id: 'high-priority',
    label: 'Alta prioridad',
    icon: <Flame className="h-4 w-4" />,
    color: 'hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 dark:hover:bg-rose-950 dark:hover:border-rose-700 dark:hover:text-rose-300',
    activeColor: 'bg-rose-500 text-white border-rose-500 hover:bg-rose-600 dark:bg-rose-600 dark:border-rose-600',
  },
];

export function QuickFilters({ activeFilter, onChange, counts }: QuickFiltersProps) {
  const getCount = (id: QuickFilterType): number | undefined => {
    if (!counts) return undefined;
    switch (id) {
      case 'week':
        return counts.week;
      case 'month':
        return counts.month;
      case 'urgent':
        return counts.urgent;
      case 'high-priority':
        return counts.highPriority;
      default:
        return undefined;
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Filtros rápidos</span>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const count = getCount(filter.id);
          const isActive = activeFilter === filter.id;

          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onChange(isActive ? null : filter.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all',
                isActive
                  ? filter.activeColor
                  : `border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ${filter.color}`,
              )}
            >
              {filter.icon}
              {filter.label}
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    isActive
                      ? 'bg-white/25'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
