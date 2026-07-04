'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, ExternalLink, Building2, User, Calendar,
  RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

interface Audiencia {
  id: number
  infolobbyId: string
  fecha: string | null
  sujetoPasivo: string | null
  sujetoPasivoCargo: string | null
  sujetoPasivoInstitucion: string | null
  sujetoActivo: string | null
  sujetoActivoOrganizacion: string | null
  materia: string | null
  sourceUrl: string | null
}

interface AnalyticsData {
  total: number
  uniqueInstitutions: number
  uniquePeople: number
  topInstitutions: Array<{ name: string | null, count: number }>
}

const PAGE_SIZE = 15;

export function LobbyExplorer() {
  const [searchText, setSearchText] = useState('');
  const [institution, setInstitution] = useState('all');
  const [cargo, setCargo] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);

  const [activeSearch, setActiveSearch] = useState('');
  const [activeInst, setActiveInst] = useState('all');
  const [activeCargo, setActiveCargo] = useState('all');
  const [activeDateFrom, setActiveDateFrom] = useState('');
  const [activeDateTo, setActiveDateTo] = useState('');

  const { data: analytics } = useQuery<AnalyticsData>({
    queryKey: ['lobby-analytics'],
    queryFn: async () => {
      const r = await fetch('/api/legal/lobby/analytics');
      return r.json();
    },
  });

  const buildParams = () => {
    const params = new URLSearchParams();
    if (activeSearch) params.set('q', activeSearch);
    if (activeInst !== 'all') params.set('institution', activeInst);
    if (activeCargo !== 'all') params.set('cargo', activeCargo);
    if (activeDateFrom) params.set('dateFrom', activeDateFrom);
    if (activeDateTo) params.set('dateTo', activeDateTo);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(page * PAGE_SIZE));
    return params.toString();
  };

  const { data, isLoading } = useQuery<{
    audiencias: Audiencia[]
    totalCount: number
  }>({
    queryKey: ['lobby-explorer', activeSearch, activeInst, activeCargo, activeDateFrom, activeDateTo, page],
    queryFn: async () => {
      const r = await fetch(`/api/legal/lobby/search?${buildParams()}`);
      return r.json();
    },
  });

  const handleApplyFilters = () => {
    setActiveSearch(searchText);
    setActiveInst(institution);
    setActiveCargo(cargo);
    setActiveDateFrom(dateFrom);
    setActiveDateTo(dateTo);
    setPage(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleApplyFilters();
  };

  const handleClear = () => {
    setSearchText('');
    setInstitution('all');
    setCargo('all');
    setDateFrom('');
    setDateTo('');
    setActiveSearch('');
    setActiveInst('all');
    setActiveCargo('all');
    setActiveDateFrom('');
    setActiveDateTo('');
    setPage(0);
  };

  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const audiencias = data?.audiencias || [];
  const hasFilters = activeSearch || activeInst !== 'all' || activeCargo !== 'all' || activeDateFrom || activeDateTo;

  const institutions = analytics?.topInstitutions?.map((i) => i.name).filter(Boolean) || [];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">Total Audiencias</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-stone-900 dark:text-white">{(analytics?.total || 0).toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">Instituciones</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-stone-900 dark:text-white">{analytics?.uniqueInstitutions || 0}</p>
        </div>
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">Personas</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-stone-900 dark:text-white">{(analytics?.uniquePeople || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -transtone-y-1/2 text-stone-400" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar nombre, tema..."
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select value={institution} onValueChange={setInstitution}>
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue placeholder="Institución" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las instituciones</SelectItem>
              {institutions.map((name) => (
                <SelectItem key={name} value={name!}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cargo} onValueChange={setCargo}>
            <SelectTrigger className="h-9 w-[130px] text-xs">
              <SelectValue placeholder="Cargo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Diputado">Diputado</SelectItem>
              <SelectItem value="Senador">Senador</SelectItem>
              <SelectItem value="Ministro">Ministro</SelectItem>
              <SelectItem value="Subsecretario">Subsecretario</SelectItem>
              <SelectItem value="Superintendente">Superintendente</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-[140px] text-xs"
            placeholder="Desde"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-[140px] text-xs"
            placeholder="Hasta"
          />
          <Button size="sm" onClick={handleApplyFilters} className="h-9">
            <Search className="h-4 w-4 mr-1" />
            Buscar
          </Button>
          {hasFilters && (
            <Button size="sm" variant="outline" onClick={handleClear} className="h-9 text-xs">
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Results count */}
      {hasFilters && (
        <p className="text-sm text-stone-500">
          {totalCount.toLocaleString()}
          {' '}
          resultado
          {totalCount !== 1 ? 's' : ''}
        </p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
        {isLoading
          ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-orange-500" />
              </div>
            )
          : audiencias.length === 0
            ? (
                <div className="py-12 text-center text-sm text-stone-500">
                  {(analytics?.total ?? 0) === 0
                    ? (
                        <>
                          <p className="font-medium text-stone-700 dark:text-stone-300">Aún no hay audiencias en la base de datos.</p>
                          <p className="mt-1">
                            Pulsa el botón
                            {' '}
                            <span className="font-semibold">&quot;Sincronizar Lobby&quot;</span>
                            {' '}
                            (arriba) para traerlas, o corre
                            {' '}
                            <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">bun run scripts/sync-lobby.ts</code>
                            .
                          </p>
                        </>
                      )
                    : hasFilters
                      ? 'No se encontraron audiencias con estos filtros.'
                      : 'Usa los filtros para buscar audiencias.'}
                </div>
              )
            : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900/60">
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-stone-500">Fecha</th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-stone-500">Sujeto Pasivo</th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-stone-500">Institución</th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-stone-500">Sujeto Activo</th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-stone-500">Materia</th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-stone-500 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {audiencias.map((a) => (
                        <tr
                          key={a.id}
                          className="border-b border-stone-100 transition-colors hover:bg-stone-50 dark:border-stone-800/70 dark:hover:bg-stone-800/40"
                        >
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs text-stone-600 dark:text-stone-400">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3" />
                              {a.fecha || '—'}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-start gap-1.5">
                              <User className="h-3 w-3 mt-0.5 text-orange-500 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-stone-800 dark:text-stone-200">
                                  {a.sujetoPasivo || '—'}
                                </p>
                                {a.sujetoPasivoCargo && (
                                  <p className="text-xs text-stone-400">{a.sujetoPasivoCargo}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 text-stone-400 flex-shrink-0" />
                              <span className="text-xs text-stone-600 dark:text-stone-400 line-clamp-1">
                                {a.sujetoPasivoInstitucion || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-stone-600 dark:text-stone-400 max-w-[180px]">
                            <span className="line-clamp-1">{a.sujetoActivo || '—'}</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-stone-500 max-w-[200px]">
                            <span className="line-clamp-1">{a.materia || '—'}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            {a.sourceUrl && (
                              <a
                                href={a.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-orange-500 hover:text-orange-700"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-4 py-2.5 dark:border-stone-800 dark:bg-stone-900/60">
            <span className="text-xs text-stone-500">
              Página
              {' '}
              {page + 1}
              {' '}
              de
              {' '}
              {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-7 px-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="h-7 px-2"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
