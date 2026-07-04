'use client';

import { X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { QuickFilterType } from './quick-filters';

type FilterBadge = {
  id: string
  label: string
  value: string
  onRemove: () => void
};

type FilterBadgesProps = {
  relevanceFilter: string
  camaraFilter: string
  comisionFilter: string
  quickFilter: QuickFilterType
  searchQuery: string
  onClearRelevance: () => void
  onClearCamara: () => void
  onClearComision: () => void
  onClearQuickFilter: () => void
  onClearSearch: () => void
  onClearAll: () => void
};

const QUICK_FILTER_LABELS: Record<string, string> = {
  week: 'Esta semana',
  month: 'Este mes',
  urgent: 'Con urgencia',
  'high-priority': 'Alta prioridad',
};

const RELEVANCE_LABELS: Record<string, string> = {
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

const CAMARA_LABELS: Record<string, string> = {
  diputados: 'Diputados',
  senado: 'Senado',
};

export function FilterBadges({
  relevanceFilter,
  camaraFilter,
  comisionFilter,
  quickFilter,
  searchQuery,
  onClearRelevance,
  onClearCamara,
  onClearComision,
  onClearQuickFilter,
  onClearSearch,
  onClearAll,
}: FilterBadgesProps) {
  const badges: FilterBadge[] = [];

  if (quickFilter) {
    badges.push({
      id: 'quick',
      label: 'Filtro rápido',
      value: QUICK_FILTER_LABELS[quickFilter] || quickFilter,
      onRemove: onClearQuickFilter,
    });
  }

  if (relevanceFilter !== 'all') {
    badges.push({
      id: 'relevance',
      label: 'Relevancia',
      value: RELEVANCE_LABELS[relevanceFilter] || relevanceFilter,
      onRemove: onClearRelevance,
    });
  }

  if (camaraFilter !== 'all') {
    badges.push({
      id: 'camara',
      label: 'Cámara',
      value: CAMARA_LABELS[camaraFilter] || camaraFilter,
      onRemove: onClearCamara,
    });
  }

  if (comisionFilter !== 'all') {
    badges.push({
      id: 'comision',
      label: 'Comisión',
      value: comisionFilter.length > 15 ? `${comisionFilter.slice(0, 15)}...` : comisionFilter,
      onRemove: onClearComision,
    });
  }

  if (searchQuery) {
    badges.push({
      id: 'search',
      label: 'Búsqueda',
      value: searchQuery.length > 20 ? `${searchQuery.slice(0, 20)}...` : searchQuery,
      onRemove: onClearSearch,
    });
  }

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-600 dark:text-cyan-400">Filtros activos</span>
      {badges.map((badge) => (
        <span
          key={badge.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs shadow-sm dark:border-cyan-800 dark:bg-cyan-950/50"
        >
          <span className="text-cyan-500 dark:text-cyan-400">
            {badge.label}
            :
          </span>
          <span className="font-semibold text-cyan-700 dark:text-cyan-200">{badge.value}</span>
          <button
            type="button"
            onClick={badge.onRemove}
            className="ml-0.5 rounded-full p-0.5 text-cyan-400 transition hover:bg-cyan-100 hover:text-cyan-700 dark:hover:bg-cyan-800 dark:hover:text-cyan-200"
            aria-label={`Eliminar filtro ${badge.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {badges.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-8 gap-1 px-3 text-xs font-medium text-cyan-600 hover:bg-cyan-50 hover:text-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-950 dark:hover:text-cyan-200"
        >
          <X className="h-3 w-3" />
          Limpiar todos
        </Button>
      )}
    </div>
  );
}
