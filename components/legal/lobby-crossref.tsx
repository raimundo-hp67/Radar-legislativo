'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, Building2, Users, RefreshCw, ExternalLink, Calendar,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Input } from '~/components/ui/input';

interface TopPair {
  institution: string | null
  activo: string | null
  count: number
}

interface OverviewData {
  type: 'overview'
  topPairs: TopPair[]
  institutions: string[]
}

interface InstitutionData {
  type: 'institution'
  institution: string
  totalMeetings: number
  topActivos: Array<{ name: string | null, count: number }>
  topPasivos: Array<{ name: string | null, cargo: string | null, count: number }>
}

interface DetailData {
  type: 'detail'
  institution: string
  organization: string
  count: number
  audiencias: Array<{
    id: number
    fecha: string | null
    sujetoPasivo: string | null
    sujetoPasivoCargo: string | null
    sujetoActivo: string | null
    sujetoActivoOrganizacion: string | null
    materia: string | null
    sourceUrl: string | null
  }>
}

type CrossRefResponse = OverviewData | InstitutionData | DetailData;

export function LobbyCrossRef() {
  const [selectedInst, setSelectedInst] = useState('');
  const [orgSearch, setOrgSearch] = useState('');
  const [activeInst, setActiveInst] = useState('');
  const [activeOrg, setActiveOrg] = useState('');

  const { data: overview, isLoading: loadingOverview } = useQuery<OverviewData>({
    queryKey: ['lobby-crossref-overview'],
    queryFn: async () => {
      const r = await fetch('/api/legal/lobby/crossref');
      return r.json();
    },
  });

  const { data: result, isLoading: loadingResult } = useQuery<CrossRefResponse>({
    queryKey: ['lobby-crossref', activeInst, activeOrg],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeInst) params.set('institution', activeInst);
      if (activeOrg) params.set('organization', activeOrg);
      const r = await fetch(`/api/legal/lobby/crossref?${params}`);
      return r.json();
    },
    enabled: !!activeInst,
  });

  const handleSearch = () => {
    setActiveInst(selectedInst);
    setActiveOrg(orgSearch);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handlePairClick = (inst: string, activo: string) => {
    setSelectedInst(inst);
    setOrgSearch(activo);
    setActiveInst(inst);
    setActiveOrg(activo);
  };

  const institutions = overview?.institutions || [];

  return (
    <div className="space-y-4">
      {/* Cross-ref search */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          Cruzar datos: ¿qué organizaciones se reúnen con qué instituciones?
        </p>
        <div className="flex flex-wrap gap-2">
          <Select value={selectedInst} onValueChange={setSelectedInst}>
            <SelectTrigger className="h-9 w-[220px] text-xs">
              <SelectValue placeholder="Seleccionar institución..." />
            </SelectTrigger>
            <SelectContent>
              {institutions.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ArrowRight className="h-9 w-4 text-slate-400 self-center" />
          <Input
            value={orgSearch}
            onChange={(e) => setOrgSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Organización o persona activa (ej: Asociación de Bancos)"
            className="h-9 flex-1 min-w-[200px] text-sm"
          />
          <Button size="sm" onClick={handleSearch} disabled={!selectedInst} className="h-9">
            Cruzar datos
          </Button>
        </div>
      </div>

      {/* Results */}
      {loadingResult
        ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-cyan-500" />
            </div>
          )
        : result?.type === 'institution' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm dark:border-cyan-900 dark:bg-cyan-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-5 w-5 text-cyan-600" />
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-900 dark:text-cyan-200">
                  {result.institution}
                </h3>
              </div>
              <p className="text-3xl font-semibold tracking-tight text-cyan-700 dark:text-cyan-300">
                {result.totalMeetings}
                {' '}
                <span className="text-sm font-normal">audiencias totales</span>
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  <Users className="h-3.5 w-3.5" />
                  Principales visitantes (activos)
                </h4>
                <div className="space-y-2">
                  {result.topActivos.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between cursor-pointer rounded px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700"
                      onClick={() => handlePairClick(activeInst, a.name || '')}
                    >
                      <span className="text-xs text-slate-700 dark:text-slate-300 line-clamp-1 flex-1 mr-2">
                        {a.name || '—'}
                      </span>
                      <span className="whitespace-nowrap rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300">
                        {a.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  <Building2 className="h-3.5 w-3.5" />
                  Principales funcionarios (pasivos)
                </h4>
                <div className="space-y-2">
                  {result.topPasivos.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded px-2 py-1.5"
                    >
                      <div className="flex-1 mr-2">
                        <span className="text-xs text-slate-700 dark:text-slate-300 line-clamp-1">
                          {p.name || '—'}
                        </span>
                        {p.cargo && (
                          <span className="text-xs text-slate-400 ml-1">
                            (
                            {p.cargo}
                            )
                          </span>
                        )}
                      </div>
                      <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {p.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      {result?.type === 'detail' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200">
              <Building2 className="h-4 w-4" />
              <span className="font-semibold">{result.institution}</span>
              <ArrowRight className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold">{result.organization}</span>
            </div>
            <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
              {result.count}
              {' '}
              audiencia
              {result.count !== 1 ? 's' : ''}
              {' '}
              encontrada
              {result.count !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Sujeto Pasivo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Sujeto Activo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Materia</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {result.audiencias.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-100 dark:border-slate-800/70"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {a.fecha || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {a.sujetoPasivo || '—'}
                      </p>
                      {a.sujetoPasivoCargo && (
                        <p className="text-xs text-slate-400">{a.sujetoPasivoCargo}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 max-w-[200px]">
                      <span className="line-clamp-1">{a.sujetoActivo || '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 max-w-[200px]">
                      <span className="line-clamp-1">{a.materia || '—'}</span>
                    </td>
                    <td className="px-3 py-2">
                      {a.sourceUrl && (
                        <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-700">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top pairs overview - shown by default */}
      {!activeInst && !loadingOverview && overview?.topPairs && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Top pares institución ↔ visitante por cantidad de reuniones
          </h3>
          <div className="space-y-1">
            {overview.topPairs.map((pair, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded px-2 py-2 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => handlePairClick(pair.institution || '', pair.activo || '')}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300">
                  {i + 1}
                </span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate flex-1">
                  {pair.institution || '—'}
                </span>
                <ArrowRight className="h-3 w-3 text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400 truncate flex-1">
                  {pair.activo || '—'}
                </span>
                <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                  {pair.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loadingOverview && !activeInst && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-cyan-500" />
        </div>
      )}
    </div>
  );
}
