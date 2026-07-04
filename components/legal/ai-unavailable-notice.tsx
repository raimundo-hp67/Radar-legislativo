'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';

/**
 * Banner que avisa cuando los agentes de IA están deshabilitados porque
 * falta OPENAI_API_KEY, en vez de dejar que el usuario descubra el error
 * recién al enviar su primer mensaje.
 */
export function AiUnavailableNotice() {
  const { data } = useQuery({
    queryKey: ['legal-health'],
    queryFn: async () => {
      const res = await fetch('/api/legal/health');
      if (!res.ok) return null;
      return res.json() as Promise<{ features?: { ai?: boolean } }>;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!data || data.features?.ai !== false) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        El asistente de IA está deshabilitado: falta configurar
        {' '}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">OPENAI_API_KEY</code>
        {' '}
        en el archivo
        {' '}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">.env</code>
        {' '}
        (y reiniciar la app). El resto de la aplicación funciona normal.
      </p>
    </div>
  );
}
