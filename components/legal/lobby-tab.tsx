'use client';

import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Users, Building2, Calendar, MapPin, MessageSquare, ExternalLink, Briefcase } from 'lucide-react';
import { Button } from '~/components/ui/button';

type LobbyAudiencia = {
  id: number
  fecha: string | null
  sujetoPasivo: string | null
  sujetoPasivoInstitucion: string | null
  sujetoActivo: string | null
  sujetoActivoTipo: string | null
  tipoAudiencia: string | null
  lugar: string | null
  materia: string | null
  forma: string | null
  sourceUrl: string | null
};

type LobbyResponse = {
  boletin: string
  audiencias: LobbyAudiencia[]
  lastFetched: string | null
};

type LobbyTabProps = {
  boletin: string
  projectTitle: string
};

export function LobbyTab({ boletin, projectTitle }: LobbyTabProps) {
  // Generate direct search link to InfoLobby
  const infoLobbySearchUrl = `https://www.infolobby.cl/?q=${encodeURIComponent(projectTitle)}`;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['lobby', boletin],
    queryFn: async (): Promise<LobbyResponse> => {
      const response = await fetch(`/api/legal/lobby/${encodeURIComponent(boletin)}`);
      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = 'Error al cargar datos de lobby';
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) errorMsg = errorJson.error;
        } catch { /* use default */ }
        throw new Error(errorMsg);
      }
      return response.json();
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async (): Promise<LobbyResponse> => {
      const response = await fetch(`/api/legal/lobby/${encodeURIComponent(boletin)}`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Error al actualizar datos de lobby');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lobby', boletin] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-slate-500 dark:text-slate-400">
          {error instanceof Error ? error.message : 'Error al cargar datos de lobby'}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => refreshMutation.mutate()}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  const audiencias = data?.audiencias || [];
  const lastFetched = data?.lastFetched;

  return (
    <div className="space-y-4">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between rounded-lg border bg-gradient-to-r from-rose-50 to-purple-50 p-4 dark:border-slate-800 dark:from-rose-950/30 dark:to-purple-950/30">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
            <Briefcase className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            Actividad de Lobby
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Audiencias relacionadas con este proyecto desde InfoLobby
          </p>
          {lastFetched && (
            <p className="mt-1 text-xs text-slate-500">
              Última actualización:
              {' '}
              {new Date(lastFetched).toLocaleDateString('es-CL', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="shrink-0"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          {refreshMutation.isPending ? 'Buscando...' : 'Buscar Audiencias'}
        </Button>
      </div>

      {/* Audiencias list */}
      {audiencias.length === 0
        ? (
            <div className="rounded-lg border bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Users className="h-6 w-6 text-slate-400" />
              </div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">
                No se encontraron audiencias de lobby automáticamente
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Haz clic en &quot;Buscar Audiencias&quot; o busca directamente en InfoLobby:
              </p>
              <a
                href={infoLobbySearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
              >
                Buscar en InfoLobby
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )
        : (
            <div className="space-y-3">
              {audiencias.map((audiencia) => (
                <AudienciaCard key={audiencia.id} audiencia={audiencia} />
              ))}
            </div>
          )}

      {/* InfoLobby attribution */}
      <div className="text-center">
        <a
          href="https://www.infolobby.cl"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          Datos provistos por InfoLobby - Consejo para la Transparencia
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

function AudienciaCard({ audiencia }: { audiencia: LobbyAudiencia }) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(`/legal/lobby/${audiencia.id}`)}
      title="Ver el detalle de esta audiencia"
      className="cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Header with date and type */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {audiencia.fecha && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Calendar className="h-3 w-3" />
                {new Date(audiencia.fecha).toLocaleDateString('es-CL', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
            {audiencia.tipoAudiencia && (
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                {audiencia.tipoAudiencia}
              </span>
            )}
            {audiencia.forma && (
              <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-medium text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300">
                {audiencia.forma}
              </span>
            )}
          </div>

          {/* Participants */}
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {/* Sujeto Pasivo - quien recibe */}
            {audiencia.sujetoPasivo && (
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Recibió a:</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {audiencia.sujetoPasivo}
                  </p>
                  {audiencia.sujetoPasivoInstitucion && (
                    <p className="text-xs text-slate-500">{audiencia.sujetoPasivoInstitucion}</p>
                  )}
                </div>
              </div>
            )}

            {/* Sujeto Activo - quien solicita */}
            {audiencia.sujetoActivo && (
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Solicitó audiencia:</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {audiencia.sujetoActivo}
                  </p>
                  {audiencia.sujetoActivoTipo && (
                    <p className="text-xs text-slate-500">{audiencia.sujetoActivoTipo}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Lugar */}
          {audiencia.lugar && (
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <MapPin className="h-3.5 w-3.5" />
              {audiencia.lugar}
            </div>
          )}

          {/* Materia */}
          {audiencia.materia && (
            <div className="flex items-start gap-2">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {audiencia.materia}
              </p>
            </div>
          )}
        </div>

        {/* External link */}
        {audiencia.sourceUrl && (
          <a
            href={audiencia.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            title="Ver en InfoLobby"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}
