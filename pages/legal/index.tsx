import { useState, useMemo, useCallback, type ComponentType } from 'react';
import type { InferGetServerSidePropsType } from 'next';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import {
  RefreshCw,
  FileText,
  TrendingUp,
  AlertCircle,
  Handshake,
  Search,
  LayoutDashboard,
  ArrowRight,
  Clock3,
  ShieldCheck,
  History,
  Plus,
} from 'lucide-react';
import { requireAuth, serializeUser } from '~/lib/ssr/require-auth';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { ProjectTable } from '~/components/legal/project-table';
import { SearchBar } from '~/components/legal/search-bar';
import { QuickFilters } from '~/components/legal/quick-filters';
import { Pagination } from '~/components/legal/pagination';
import { FilterBadges } from '~/components/legal/filter-badges';
import { ViewSelector, useViewMode } from '~/components/legal/view-selector';
import { getAlertsCount } from '~/components/legal/alerts-module';
import { LobbyDashboard } from '~/components/legal/lobby-dashboard';
import { PortalLogo } from '~/components/legal/portal-logo';
import { ProjectResearchTab } from '~/components/legal/project-research-tab';
import type { SerializedProjectWithSnapshot } from '~/lib/legal/types';
import { useProjectFilters } from '~/lib/legal/use-project-filters';
import { cn } from '~/lib/utils';

export const getServerSideProps = requireAuth(async (_ctx, session) => ({
  props: {
    user: serializeUser(session.user),
  },
}));

const projectsSchema = z.array(
  z.object({
    id: z.number(),
    boletin: z.string(),
    title: z.string(),
    relevance: z.string(),
    dateIngreso: z.string().nullable(),
    estado: z.string().nullable(),
    camara: z.string().nullable(),
    urgencia: z.string().nullable(),
    comision: z.string().nullable(),
    autores: z.string().nullable().optional(),
    objetivo: z.string().nullable().optional(),
    linkProyecto: z.string().nullable().optional(),
    linkInformes: z.array(z.string()).nullable().optional(),
    notes: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    latestSnapshot: z
      .object({
        id: z.number(),
        boletin: z.string(),
        stage: z.string().nullable(),
        chamberCurrent: z.string().nullable(),
        lastAction: z.string().nullable(),
        lastActionDate: z.string().nullable(),
        urgency: z.string().nullable(),
        commission: z.string().nullable(),
        sourceProvider: z.string(),
        sourceUrl: z.string().nullable(),
        fetchedAt: z.string(),
        changesDetected: z.array(z.any()).nullable(),
      })
      .nullable(),
    hasRecentChanges: z.boolean(),
  }),
);

const lobbyAnalyticsSchema = z.object({
  total: z.number(),
  uniqueInstitutions: z.number(),
  uniquePeople: z.number(),
});

type DashboardTab = 'inicio' | 'proyectos' | 'lobby' | 'investigacion';

export default function LegalDashboard(
  _props: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);
  const [viewMode, setViewMode] = useViewMode();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // Permite llegar directo a una pestaña vía /legal?tab=lobby (lo usan los
  // enlaces "volver" de las páginas de detalle). La URL manda hasta que el
  // usuario hace clic en otra pestaña; entonces manda el clic.
  const [clickedTab, setClickedTab] = useState<DashboardTab | null>(null);
  const queryTab = typeof router.query.tab === 'string'
    && ['inicio', 'proyectos', 'lobby', 'investigacion'].includes(router.query.tab)
    ? (router.query.tab as DashboardTab)
    : null;
  const activeTab: DashboardTab = clickedTab ?? queryTab ?? 'inicio';
  const setActiveTab = (tab: DashboardTab) => setClickedTab(tab);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['legal-projects'],
    queryFn: async () => {
      const response = await fetch('/api/legal/projects');
      const data = await response.json();
      return projectsSchema.parse(data) as SerializedProjectWithSnapshot[];
    },
  });

  const { data: lobbyAnalytics } = useQuery({
    queryKey: ['lobby-analytics'],
    queryFn: async () => {
      const response = await fetch('/api/legal/lobby/analytics');
      if (!response.ok) {
        throw new Error('No se pudo cargar analytics de lobby');
      }
      const data = await response.json();
      return lobbyAnalyticsSchema.parse(data);
    },
    staleTime: 5 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/legal/projects/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-projects'] });
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    },
  });

  const handleDeleteClick = (id: number) => {
    setProjectToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (projectToDelete) deleteMutation.mutate(projectToDelete);
  };

  const {
    relevanceFilter,
    camaraFilter,
    comisionFilter,
    searchQuery,
    quickFilter,
    filteredProjects,
    quickFilterCounts,
    hasActiveFilters,
    handleRelevanceChange,
    handleCamaraChange,
    handleSearchChange,
    handleQuickFilterChange,
    clearRelevanceFilter,
    clearCamaraFilter,
    clearComisionFilter,
    clearQuickFilter,
    clearSearchQuery,
    clearAllFilters,
  } = useProjectFilters(projects);

  // Reset page when filters change
  const handleRelevanceFilterChange = useCallback((value: string) => {
    handleRelevanceChange(value);
    setCurrentPage(1);
  }, [handleRelevanceChange]);

  const handleCamaraFilterChange = useCallback((value: string) => {
    handleCamaraChange(value);
    setCurrentPage(1);
  }, [handleCamaraChange]);

  const handleQuickFilterChangeWithReset = useCallback((filter: typeof quickFilter) => {
    handleQuickFilterChange(filter);
    setCurrentPage(1);
  }, [handleQuickFilterChange]);

  const handleSearchWithReset = useCallback((query: string) => {
    handleSearchChange(query);
    setCurrentPage(1);
  }, [handleSearchChange]);

  const handleClearRelevance = useCallback(() => {
    clearRelevanceFilter();
    setCurrentPage(1);
  }, [clearRelevanceFilter]);

  const handleClearCamara = useCallback(() => {
    clearCamaraFilter();
    setCurrentPage(1);
  }, [clearCamaraFilter]);

  const handleClearComision = useCallback(() => {
    clearComisionFilter();
    setCurrentPage(1);
  }, [clearComisionFilter]);

  const handleClearQuickFilter = useCallback(() => {
    clearQuickFilter();
    setCurrentPage(1);
  }, [clearQuickFilter]);

  const handleClearSearch = useCallback(() => {
    clearSearchQuery();
    setCurrentPage(1);
  }, [clearSearchQuery]);

  const handleClearAll = useCallback(() => {
    clearAllFilters();
    setCurrentPage(1);
  }, [clearAllFilters]);

  const changesCount = projects?.filter((p) => p.hasRecentChanges).length || 0;

  // Paginated projects
  const paginatedProjects = useMemo(() => {
    if (!filteredProjects) return [];
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage, pageSize]);

  // Alerts count
  const alertsCount = useMemo(() => {
    if (!projects) return 0;
    return getAlertsCount(projects);
  }, [projects]);

  const navigationItems: Array<{
    id: DashboardTab
    title: string
    description: string
    icon: ComponentType<{ className?: string }>
    badge?: string
  }> = [
    {
      id: 'inicio',
      title: 'Inicio',
      description: 'Resumen ejecutivo',
      icon: LayoutDashboard,
    },
    {
      id: 'proyectos',
      title: 'Proyectos',
      description: 'Radar legislativo',
      icon: FileText,
      badge: projects ? String(projects.length) : undefined,
    },
    {
      id: 'lobby',
      title: 'Lobby',
      description: 'Audiencias y cruces',
      icon: Handshake,
      badge: lobbyAnalytics ? String(lobbyAnalytics.total) : undefined,
    },
    {
      id: 'investigacion',
      title: 'Investigación',
      description: 'Análisis de proyectos',
      icon: Search,
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 font-sans dark:bg-slate-950">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-0 h-[280px] w-[280px] rounded-full bg-cyan-200/35 blur-3xl dark:bg-cyan-900/20" />
        <div className="absolute right-0 top-16 h-[220px] w-[220px] rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-900/20" />
      </div>

      <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative mb-6 overflow-hidden rounded-3xl border border-cyan-100 bg-gradient-to-r from-sky-50 via-cyan-50/60 to-white px-6 py-6 shadow-sm dark:border-slate-700/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#091733] via-[#000081] via-30% via-[#0DC9EB] via-70% to-[#27D545]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(13,201,235,0.16),transparent_45%)]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <PortalLogo />
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                  Radar Legislativo
                </h1>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Seguimiento de proyectos de ley y audiencias de lobby en Chile.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Radar legal activo
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-medium text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
                <Clock3 className="h-3.5 w-3.5" />
                Actualización continua
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[272px_1fr]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-900/40">
                <nav aria-label="Navegación principal dashboard legal">
                  {[
                    { label: null, ids: ['inicio'] },
                    { label: 'Datos legales', ids: ['proyectos'] },
                    { label: 'Operaciones', ids: ['lobby'] },
                    { label: 'Monitoreo', ids: ['investigacion'] },
                  ].map((group, groupIdx) => {
                    const groupItems = navigationItems.filter((n) => group.ids.includes(n.id));
                    return (
                      <div key={groupIdx} className={cn(groupIdx > 0 && 'mt-3 border-t border-slate-200/70 pt-3 dark:border-slate-700/60')}>
                        {group.label && (
                          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                            {group.label}
                          </p>
                        )}
                        <div className="space-y-0.5">
                          {groupItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            const sharedClassName = cn(
                              'group relative flex w-full items-center gap-3 rounded-xl border py-2.5 pl-3 pr-2.5 text-left transition-all duration-200',
                              isActive
                                ? 'border-cyan-200 border-l-2 border-l-cyan-500 bg-white text-slate-900 shadow-[0_10px_30px_-24px_rgba(234,88,12,0.9)] dark:border-cyan-900 dark:border-l-cyan-500 dark:bg-slate-900 dark:text-slate-100'
                                : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800',
                            );

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveTab(item.id)}
                                className={sharedClassName}
                              >
                                <div
                                  className={cn(
                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                                    isActive
                                      ? 'bg-cyan-600 text-white'
                                      : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-slate-700',
                                  )}
                                >
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{item.title}</p>
                                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                                </div>
                                {item.badge && (
                                  <span
                                    className={cn(
                                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                                      isActive
                                        ? 'bg-cyan-600 text-white'
                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100',
                                    )}
                                  >
                                    {item.badge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </nav>
              </div>
            </div>
          </aside>

          <section className="min-w-0 space-y-4">
            {activeTab === 'inicio' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="max-w-2xl">
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                        Centro de operaciones legal
                      </h2>
                      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                        Vista rápida del estado de Proyectos, Lobby e Investigación.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {projects?.length ?? 0}
                          {' '}
                          proyectos en seguimiento
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {lobbyAnalytics?.total ?? 0}
                          {' '}
                          audiencias de lobby registradas
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                      onClick={() => {
                        queryClient.invalidateQueries({ queryKey: ['legal-projects'] });
                        queryClient.invalidateQueries({ queryKey: ['lobby-analytics'] });
                      }}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Actualizar resumen
                    </Button>
                  </div>
                </div>

                {(projects?.length ?? 0) === 0 && (
                  <div className="rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/60 p-5 dark:border-cyan-900 dark:bg-cyan-950/20">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      👋 Primer uso: aún no hay proyectos en seguimiento
                    </p>
                    <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-300">
                      <li>
                        <button type="button" onClick={() => router.push('/legal/projects/new')} className="font-medium text-cyan-700 underline dark:text-cyan-400">
                          Agrega tu primer proyecto de ley
                        </button>
                        {' '}
                        (o carga ejemplos con
                        {' '}
                        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">bun run scripts/seed-legal-projects.ts</code>
                        )
                      </li>
                      <li>
                        Sincroniza audiencias en la pestaña
                        {' '}
                        <button type="button" onClick={() => setActiveTab('lobby')} className="font-medium text-cyan-700 underline dark:text-cyan-400">
                          Lobby
                        </button>
                      </li>
                      <li>
                        Habilita el buscador de Investigación con
                        {' '}
                        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">bun run scripts/bulk-sync.ts</code>
                      </li>
                    </ol>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <OverviewModuleCard
                    title="Proyectos"
                    primaryValue={projects?.length ?? 0}
                    secondaryLine={`${changesCount} con cambios · ${alertsCount} alertas`}
                    icon={<FileText className="h-5 w-5" />}
                    color="slate"
                    onOpen={() => setActiveTab('proyectos')}
                  />
                  <OverviewModuleCard
                    title="Lobby"
                    primaryValue={lobbyAnalytics?.total ?? 0}
                    secondaryLine={`${lobbyAnalytics?.uniqueInstitutions ?? 0} instituciones · ${lobbyAnalytics?.uniquePeople ?? 0} personas`}
                    icon={<Handshake className="h-5 w-5" />}
                    color="indigo"
                    onOpen={() => setActiveTab('lobby')}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Atajos operativos
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <ShortcutCard icon={<FileText className="h-4 w-4" />} label="Pipeline legislativo" onClick={() => setActiveTab('proyectos')} color="blue" />
                    <ShortcutCard icon={<Handshake className="h-4 w-4" />} label="Audiencias de lobby" onClick={() => setActiveTab('lobby')} color="amber" />
                    <ShortcutCard icon={<Search className="h-4 w-4" />} label="Investigación" onClick={() => setActiveTab('investigacion')} color="slate" />
                    <ShortcutCard icon={<History className="h-4 w-4" />} label="Cambios detectados" onClick={() => router.push('/legal/changes')} color="slate" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'proyectos' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        <FileText className="h-5 w-5 text-cyan-600" />
                        Radar Legislativo
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Seguimiento integral de proyectos de ley, prioridad, estado y cambios relevantes.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['legal-projects'] })}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Actualizar
                      </Button>
                      <Button size="sm" onClick={() => router.push('/legal/projects/new')}>
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar Proyecto
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard
                    title="Total Proyectos"
                    value={projects?.length || 0}
                    icon={<FileText className="h-5 w-5" />}
                    color="slate"
                  />
                  <StatCard
                    title="Alta Prioridad"
                    value={projects?.filter((p) => p.relevance === 'HIGH').length || 0}
                    icon={<AlertCircle className="h-5 w-5" />}
                    color="rose"
                  />
                  <StatCard
                    title="Media Prioridad"
                    value={projects?.filter((p) => p.relevance === 'MEDIUM').length || 0}
                    icon={<TrendingUp className="h-5 w-5" />}
                    color="amber"
                  />
                  <StatCard
                    title="Con Cambios"
                    value={changesCount}
                    icon={<RefreshCw className="h-5 w-5" />}
                    color="emerald"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <QuickFilters
                    activeFilter={quickFilter}
                    onChange={handleQuickFilterChangeWithReset}
                    counts={quickFilterCounts}
                  />

                  <div className="my-3 h-px bg-slate-200 dark:bg-slate-800" />

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[200px] max-w-[280px] flex-1">
                      <SearchBar
                        onSearch={handleSearchWithReset}
                        placeholder="Buscar..."
                      />
                    </div>
                    <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
                    <ViewSelector value={viewMode} onChange={setViewMode} />
                    <Select value={relevanceFilter} onValueChange={handleRelevanceFilterChange}>
                      <SelectTrigger className="h-8 w-[90px] border-slate-200 bg-slate-50 text-xs dark:border-slate-700 dark:bg-slate-800">
                        <SelectValue placeholder="Prioridad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="HIGH">Alta</SelectItem>
                        <SelectItem value="MEDIUM">Media</SelectItem>
                        <SelectItem value="LOW">Baja</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={camaraFilter} onValueChange={handleCamaraFilterChange}>
                      <SelectTrigger className="h-8 w-[100px] border-slate-200 bg-slate-50 text-xs dark:border-slate-700 dark:bg-slate-800">
                        <SelectValue placeholder="Cámara" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="diputados">Diputados</SelectItem>
                        <SelectItem value="senado">Senado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(hasActiveFilters || (filteredProjects && filteredProjects.length !== projects?.length)) && (
                  <div className="flex flex-col gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900 dark:bg-cyan-950/30 sm:flex-row sm:items-center sm:justify-between">
                    <FilterBadges
                      relevanceFilter={relevanceFilter}
                      camaraFilter={camaraFilter}
                      comisionFilter={comisionFilter}
                      quickFilter={quickFilter}
                      searchQuery={searchQuery}
                      onClearRelevance={handleClearRelevance}
                      onClearCamara={handleClearCamara}
                      onClearComision={handleClearComision}
                      onClearQuickFilter={handleClearQuickFilter}
                      onClearSearch={handleClearSearch}
                      onClearAll={handleClearAll}
                    />
                    <div className="text-sm text-cyan-700 dark:text-cyan-300">
                      Mostrando
                      {' '}
                      <span className="font-semibold">{filteredProjects?.length || 0}</span>
                      {' '}
                      de
                      {' '}
                      <span className="font-semibold">{projects?.length || 0}</span>
                      {' '}
                      proyectos
                    </div>
                  </div>
                )}

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  {isLoading
                    ? (
                        <div className="flex items-center justify-center py-16">
                          <div className="flex flex-col items-center gap-3">
                            <RefreshCw className="h-10 w-10 animate-spin text-cyan-600" />
                            <span className="text-sm text-slate-500">Cargando proyectos...</span>
                          </div>
                        </div>
                      )
                    : filteredProjects?.length === 0 && hasActiveFilters
                      ? (
                          <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                              <FileText className="h-7 w-7 text-slate-400" />
                            </div>
                            <p className="mt-4 text-base font-medium text-slate-700 dark:text-slate-300">
                              Sin resultados para estos filtros
                            </p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              Prueba ajustando o limpiando los filtros activos
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-5"
                              onClick={handleClearAll}
                            >
                              Limpiar filtros
                            </Button>
                          </div>
                        )
                      : (
                          <>
                            <ProjectTable
                              projects={paginatedProjects}
                              onDelete={handleDeleteClick}
                              viewMode={viewMode}
                            />
                            {(filteredProjects?.length || 0) > 0 && (
                              <div className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
                                <Pagination
                                  currentPage={currentPage}
                                  totalItems={filteredProjects?.length || 0}
                                  pageSize={pageSize}
                                  onPageChange={setCurrentPage}
                                  onPageSizeChange={setPageSize}
                                />
                              </div>
                            )}
                          </>
                        )}
                </div>
              </div>
            )}

            {activeTab === 'lobby' && <LobbyDashboard />}

            {activeTab === 'investigacion' && <ProjectResearchTab />}
          </section>
        </div>

        {/* Back link */}
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={() => setActiveTab('inicio')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ← Volver al inicio
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Proyecto</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este proyecto? Esta acción
              eliminará también todo el historial de snapshots y no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const colorVariants = {
  slate: {
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconColor: 'text-slate-700 dark:text-slate-200',
    accent: 'from-slate-300/70 to-transparent dark:from-slate-500/30',
  },
  rose: {
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    iconColor: 'text-cyan-700 dark:text-cyan-300',
    accent: 'from-cyan-300/80 to-transparent dark:from-cyan-500/30',
  },
  amber: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-700 dark:text-emerald-300',
    accent: 'from-emerald-300/80 to-transparent dark:from-emerald-500/30',
  },
  emerald: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-700 dark:text-emerald-300',
    accent: 'from-emerald-300/80 to-transparent dark:from-emerald-500/30',
  },
};

const shortcutColorMap = {
  blue: {
    iconBg: 'bg-cyan-50 dark:bg-cyan-950/40',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
  },
  amber: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  slate: {
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconColor: 'text-slate-600 dark:text-slate-300',
  },
};

function ShortcutCard({
  icon,
  label,
  onClick,
  color = 'slate',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  color?: keyof typeof shortcutColorMap
}) {
  const variant = shortcutColorMap[color];
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3 text-left transition-all duration-150 hover:scale-[1.02] hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', variant.iconBg)}>
        <div className={variant.iconColor}>{icon}</div>
      </div>
      <span className="flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <ArrowRight className="h-3 w-3 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function StatCard({
  title,
  value,
  icon,
  color = 'slate',
}: {
  title: string
  value: number
  icon: React.ReactNode
  color?: keyof typeof colorVariants
}) {
  const variant = colorVariants[color];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r', variant.accent)} />
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{title}</span>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${variant.iconBg}`}>
          <div className={variant.iconColor}>{icon}</div>
        </div>
      </div>
    </div>
  );
}

const overviewCardVariants = {
  slate: {
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/40',
    iconColor: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-slate-200/80 dark:border-slate-800',
    leftBorder: 'border-l-cyan-500',
    gradient: 'from-white to-cyan-50/30 dark:from-slate-900 dark:to-cyan-950/20',
    accent: 'from-cyan-300/80 to-transparent dark:from-cyan-500/30',
    linkColor: 'text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-200',
  },
  indigo: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-slate-200/80 dark:border-slate-800',
    leftBorder: 'border-l-emerald-500',
    gradient: 'from-white to-emerald-50/30 dark:from-slate-900 dark:to-emerald-950/20',
    accent: 'from-emerald-300/80 to-transparent dark:from-emerald-500/30',
    linkColor: 'text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200',
  },
};

function OverviewModuleCard({
  title,
  primaryValue,
  secondaryLine,
  icon,
  color,
  onOpen,
}: {
  title: string
  primaryValue: number
  secondaryLine: string
  icon: React.ReactNode
  color: keyof typeof overviewCardVariants
  onOpen: () => void
}) {
  const variant = overviewCardVariants[color];

  return (
    <article className={cn('group relative overflow-hidden rounded-2xl border border-l-4 bg-gradient-to-br p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900', variant.border, variant.leftBorder, variant.gradient)}>
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r', variant.accent)} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-1.5 text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{primaryValue}</p>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', variant.iconBg)}>
          <div className={variant.iconColor}>{icon}</div>
        </div>
      </div>
      <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">{secondaryLine}</p>
      <button
        type="button"
        className={cn('mt-3 inline-flex items-center gap-1 text-xs font-medium transition-colors', variant.linkColor)}
        onClick={onOpen}
      >
        Ir al módulo
        <ArrowRight className="h-3 w-3" />
      </button>
    </article>
  );
}
