import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import type { QuickFilterType } from '~/components/legal/quick-filters';
import type { SerializedProjectWithSnapshot } from '~/lib/legal/types';

function hasUrgencyFn(p: SerializedProjectWithSnapshot): boolean {
  const urgencia = p.urgencia || p.latestSnapshot?.urgency;
  return Boolean(urgencia && urgencia !== 'Sin urgencia' && urgencia !== '—');
}

function isUpdatedWithinDaysFn(p: SerializedProjectWithSnapshot, days: number): boolean {
  const updatedAt = new Date(p.updatedAt);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return updatedAt >= cutoff;
}

export function useProjectFilters(projects: SerializedProjectWithSnapshot[] | undefined) {
  const router = useRouter();

  // Read filter state directly from URL — no local mirror needed
  const relevanceFilter = (typeof router.query.relevance === 'string' ? router.query.relevance : null) ?? 'all';
  const camaraFilter = (typeof router.query.camara === 'string' ? router.query.camara : null) ?? 'all';
  const comisionFilter = (typeof router.query.comision === 'string' ? router.query.comision : null) ?? 'all';
  const searchQuery = (typeof router.query.q === 'string' ? router.query.q : null) ?? '';
  const quickFilter = (typeof router.query.quick === 'string' ? router.query.quick : null) as QuickFilterType;

  const pushToUrl = useCallback((patch: Record<string, string | null>) => {
    const next: Record<string, string> = {};
    const base = {
      relevance: relevanceFilter,
      camara: camaraFilter,
      comision: comisionFilter,
      q: searchQuery,
      quick: quickFilter ?? '',
    };
    const merged = { ...base, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== 'all') next[k] = v;
    }
    void router.replace({ pathname: router.pathname, query: next }, undefined, { shallow: true });
  }, [router, relevanceFilter, camaraFilter, comisionFilter, searchQuery, quickFilter]);

  const handleRelevanceChange = useCallback((value: string) => {
    pushToUrl({ relevance: value });
  }, [pushToUrl]);

  const handleCamaraChange = useCallback((value: string) => {
    pushToUrl({ camara: value });
  }, [pushToUrl]);

  const handleSearchChange = useCallback((query: string) => {
    pushToUrl({ q: query.toLowerCase() });
  }, [pushToUrl]);

  const handleQuickFilterChange = useCallback((filter: QuickFilterType) => {
    pushToUrl({ quick: filter ?? '' });
  }, [pushToUrl]);

  const clearAllFilters = useCallback(() => {
    void router.replace({ pathname: router.pathname, query: {} }, undefined, { shallow: true });
  }, [router]);

  // Quick filter counts
  const quickFilterCounts = useMemo(() => {
    if (!projects) return { week: 0, month: 0, urgent: 0, highPriority: 0 };
    return {
      week: projects.filter((p) => isUpdatedWithinDaysFn(p, 7)).length,
      month: projects.filter((p) => isUpdatedWithinDaysFn(p, 30)).length,
      urgent: projects.filter((p) => hasUrgencyFn(p)).length,
      highPriority: projects.filter((p) => p.relevance === 'HIGH').length,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects?.filter((p) => {
      if (quickFilter) {
        switch (quickFilter) {
          case 'week':
            if (!isUpdatedWithinDaysFn(p, 7)) return false;
            break;
          case 'month':
            if (!isUpdatedWithinDaysFn(p, 30)) return false;
            break;
          case 'urgent':
            if (!hasUrgencyFn(p)) return false;
            break;
          case 'high-priority':
            if (p.relevance !== 'HIGH') return false;
            break;
        }
      }

      if (relevanceFilter !== 'all' && p.relevance !== relevanceFilter) return false;

      if (camaraFilter !== 'all') {
        const camara = (p.camara || p.latestSnapshot?.chamberCurrent || '').toLowerCase();
        if (camaraFilter === 'diputados' && !camara.includes('diputado')) return false;
        if (camaraFilter === 'senado' && !camara.includes('senado')) return false;
      }

      if (comisionFilter !== 'all' && p.comision !== comisionFilter) return false;

      if (searchQuery) {
        const haystack = [
          p.title,
          p.boletin,
          p.estado,
          p.camara,
          p.comision,
          (p as unknown as { autores?: string }).autores,
          (p as unknown as { objetivo?: string }).objetivo,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(searchQuery);
      }

      return true;
    });
  }, [projects, quickFilter, relevanceFilter, camaraFilter, comisionFilter, searchQuery]);

  const hasActiveFilters
    = relevanceFilter !== 'all'
      || camaraFilter !== 'all'
      || comisionFilter !== 'all'
      || quickFilter !== null
      || searchQuery !== '';

  return {
    // State (from URL)
    relevanceFilter,
    camaraFilter,
    comisionFilter,
    searchQuery,
    quickFilter,
    // Derived
    filteredProjects,
    quickFilterCounts,
    hasActiveFilters,
    // Setters
    handleRelevanceChange,
    handleCamaraChange,
    handleSearchChange,
    handleQuickFilterChange,
    clearRelevanceFilter: useCallback(() => pushToUrl({ relevance: 'all' }), [pushToUrl]),
    clearCamaraFilter: useCallback(() => pushToUrl({ camara: 'all' }), [pushToUrl]),
    clearComisionFilter: useCallback(() => pushToUrl({ comision: 'all' }), [pushToUrl]),
    clearQuickFilter: useCallback(() => pushToUrl({ quick: '' }), [pushToUrl]),
    clearSearchQuery: useCallback(() => pushToUrl({ q: '' }), [pushToUrl]),
    clearAllFilters,
  };
}
