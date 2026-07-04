import { useState } from 'react';
import Link from 'next/link';
import type { InferGetServerSidePropsType } from 'next';
import { useQuery } from '@tanstack/react-query';
import * as z from 'zod';
import { ArrowLeft, RefreshCw, Filter } from 'lucide-react';
import { requireAuth, serializeUser } from '~/lib/ssr/require-auth';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { ChangesTimeline } from '~/components/legal/changes-timeline';

export const getServerSideProps = requireAuth(async (_ctx, session) => ({
  props: {
    user: serializeUser(session.user),
  },
}));

const changesSchema = z.array(
  z.object({
    id: z.number(),
    boletin: z.string(),
    title: z.string(),
    relevance: z.string(),
    changes: z.array(
      z.object({
        field: z.string(),
        from: z.string().nullable(),
        to: z.string().nullable(),
      }),
    ).nullable(),
    fetchedAt: z.string(),
    stage: z.string().nullable(),
    chamberCurrent: z.string().nullable(),
    lastAction: z.string().nullable(),
    lastActionDate: z.string().nullable(),
  }),
);

export default function ChangesPage(
  _props: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  const [relevanceFilter, setRelevanceFilter] = useState<string>('all');
  const [daysFilter, setDaysFilter] = useState<string>('30');

  const { data: changes, isLoading, refetch } = useQuery({
    queryKey: ['legal-changes', relevanceFilter, daysFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (relevanceFilter !== 'all') {
        params.set('relevance', relevanceFilter);
      }
      if (daysFilter !== 'all') {
        params.set('days', daysFilter);
      }
      const response = await fetch(`/api/legal/changes?${params.toString()}`);
      const data = await response.json();
      return changesSchema.parse(data);
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-black">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/legal"
            className="mb-4 inline-flex items-center text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver al Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-black dark:text-slate-50">
                Cambios Detectados
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Historial de cambios en los proyectos de ley monitoreados
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
              />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium">Filtros:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Relevancia:
            </span>
            <Select value={relevanceFilter} onValueChange={setRelevanceFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="HIGH">Alta</SelectItem>
                <SelectItem value="MEDIUM">Media</SelectItem>
                <SelectItem value="LOW">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Período:
            </span>
            <Select value={daysFilter} onValueChange={setDaysFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="30 días" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Última semana</SelectItem>
                <SelectItem value="30">Último mes</SelectItem>
                <SelectItem value="90">Últimos 3 meses</SelectItem>
                <SelectItem value="all">Todo el historial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results count */}
        {!isLoading && changes && (
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
            {changes.length}
            {' '}
            cambio
            {changes.length !== 1 ? 's' : ''}
            {' '}
            encontrado
            {changes.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Timeline */}
        {isLoading
          ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            )
          : (
              <ChangesTimeline changes={changes || []} />
            )}
      </div>
    </div>
  );
}
