'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Send, ExternalLink } from 'lucide-react';
import { Button } from '~/components/ui/button';

type RefreshResult = {
  total: number
  success: number
  updated: number
  failed: number
};

type QuickActionsModuleProps = {
  onRefreshAll?: () => void
  isRefreshing?: boolean
  refreshResult?: RefreshResult | null
};

export function QuickActionsModule({ onRefreshAll, isRefreshing, refreshResult }: QuickActionsModuleProps) {
  const [slackSending, setSlackSending] = useState(false);
  const [slackMessage, setSlackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const sendSlackTest = async () => {
    setSlackSending(true);
    setSlackMessage(null);
    try {
      const response = await fetch('/api/legal/test-slack', { method: 'POST' });
      if (response.ok) {
        setSlackMessage({ type: 'success', text: 'Notificación enviada' });
      } else {
        setSlackMessage({ type: 'error', text: 'Error al enviar' });
      }
    } catch {
      setSlackMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setSlackSending(false);
      setTimeout(() => setSlackMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-2">
      {/* Agregar Proyecto */}
      <Link href="/legal/projects/new" className="block">
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/30">
          <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span>Agregar Proyecto</span>
        </Button>
      </Link>

      {/* Refrescar Todos */}
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
        onClick={onRefreshAll}
        disabled={isRefreshing}
      >
        <RefreshCw className={`h-4 w-4 text-slate-600 dark:text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} />
        <span>{isRefreshing ? 'Actualizando...' : 'Refrescar Todos'}</span>
      </Button>
      {!isRefreshing && refreshResult && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
          <p className="font-medium text-slate-700 dark:text-slate-300">Último refresco</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-slate-500 dark:text-slate-400">
            <span>
              {refreshResult.total}
              {' proyectos'}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400">
              {refreshResult.success}
              {' ok'}
            </span>
            {refreshResult.updated > 0 && (
              <span className="text-blue-600 dark:text-blue-400">
                {refreshResult.updated}
                {' actualizados'}
              </span>
            )}
            {refreshResult.failed > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {refreshResult.failed}
                {' fallidos'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Enviar a Slack */}
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
        onClick={sendSlackTest}
        disabled={slackSending}
      >
        <Send className={`h-4 w-4 text-slate-600 dark:text-slate-400 ${slackSending ? 'animate-pulse' : ''}`} />
        <span>{slackSending ? 'Enviando...' : 'Enviar Test a Slack'}</span>
      </Button>
      {slackMessage && (
        <p className={`text-xs px-2 ${slackMessage.type === 'success' ? 'text-blue-600' : 'text-red-600'}`}>
          {slackMessage.text}
        </p>
      )}

      {/* Ver Cambios */}
      <Link href="/legal/changes" className="block">
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/30">
          <ExternalLink className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span>Ver Historial de Cambios</span>
        </Button>
      </Link>
    </div>
  );
}
