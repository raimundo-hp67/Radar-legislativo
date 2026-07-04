'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Button } from '~/components/ui/button';
import { Search, GitCompareArrows, Bot, Handshake, DatabaseZap, Loader2 } from 'lucide-react';
import { LobbyExplorer } from '~/components/legal/lobby-explorer';
import { LobbyCrossRef } from '~/components/legal/lobby-crossref';
import { LobbyAgent } from '~/components/legal/lobby-agent';

export function LobbyDashboard() {
  const queryClient = useQueryClient();
  const [syncLog, setSyncLog] = useState<string | null>(null);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/legal/lobby/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Error al sincronizar');
      return res.json() as Promise<{
        status: string
        inserted: number
        skipped: number
        errors: number
      }>;
    },
    onSuccess: (data) => {
      setSyncLog(
        `Sync completado — ${data.inserted} insertados, ${data.skipped} existentes${data.errors > 0 ? `, ${data.errors} errores` : ''}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['lobby-audiencias'] });
      void queryClient.invalidateQueries({ queryKey: ['lobby-recent'] });
    },
    onError: (err) => {
      setSyncLog(`Error: ${err instanceof Error ? err.message : String(err)}`);
    },
  });

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/60">
                <Handshake className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Lobby Estratégico
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Exploración de audiencias, cruces entre actores e investigación asistida por IA.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            title="Descargar audiencias de los últimos 6 meses desde InfoLobby"
          >
            {syncMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <DatabaseZap className="h-3.5 w-3.5" />}
            {syncMutation.isPending ? 'Sincronizando…' : 'Sincronizar Lobby'}
          </Button>
        </div>
        {syncLog && (
          <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {syncLog}
          </p>
        )}
      </section>

      <Tabs defaultValue="explorer" className="w-full">
        <TabsList className="mb-4 h-auto w-full flex-wrap rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <TabsTrigger value="explorer" className="gap-1.5 text-xs">
            <Search className="h-3.5 w-3.5" />
            Explorador
          </TabsTrigger>
          <TabsTrigger value="crossref" className="gap-1.5 text-xs">
            <GitCompareArrows className="h-3.5 w-3.5" />
            Cruces
          </TabsTrigger>
          <TabsTrigger value="agent" className="gap-1.5 text-xs">
            <Bot className="h-3.5 w-3.5" />
            Agente IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="explorer">
          <LobbyExplorer />
        </TabsContent>

        <TabsContent value="crossref">
          <LobbyCrossRef />
        </TabsContent>

        <TabsContent value="agent">
          <LobbyAgent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
