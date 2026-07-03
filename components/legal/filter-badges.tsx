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
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600 dark:text-orange-400">Filtros activos</span>
      {badges.map((badge) => (
        <span
          key={badge.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs shadow-sm dark:border-orange-800 dark:bg-orange-950/50"
        >
          <span className="text-orange-500 dark:text-orange-400">
            {badge.label}
            :
          </span>
          <span className="font-semibold text-orange-700 dark:text-orange-200">{badge.value}</span>
          <button
            type="button"
            onClick={badge.onRemove}
            className="ml-0.5 rounded-full p-0.5 text-orange-400 transition hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-800 dark:hover:text-orange-200"
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
          className="h-8 gap-1 px-3 text-xs font-medium text-orange-600 hover:bg-orange-50 hover:text-orange-800 dark:text-orange-400 dark:hover:bg-orange-950 dark:hover:text-orange-200"
        >
          <X className="h-3 w-3" />
          Limpiar todos
        </Button>
      )}
    </div>
  );
}
