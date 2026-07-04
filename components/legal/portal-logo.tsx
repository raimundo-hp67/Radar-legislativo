'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Scale, Pencil, X, Loader2 } from 'lucide-react';

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Logo del portal, personalizable: al pasar el mouse aparece un lápiz que
 * abre el selector de archivos; la imagen subida (PNG/JPG/WebP, máx 2 MB)
 * reemplaza el ícono por defecto para todos los usuarios. La X lo quita.
 */
export function PortalLogo() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['portal-settings'],
    queryFn: async () => {
      const res = await fetch('/api/legal/settings');
      if (!res.ok) return { logoDataUrl: null };
      return res.json() as Promise<{ logoDataUrl: string | null }>;
    },
    staleTime: 5 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (logoDataUrl: string | null) => {
      const res = await fetch('/api/legal/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoDataUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'No se pudo guardar el logo');
      }
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['portal-settings'] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Error al guardar'),
  });

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError('Formato no soportado: usa PNG, JPG o WebP.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('La imagen no puede superar los 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => mutation.mutate(reader.result as string);
    reader.readAsDataURL(file);
  };

  const logo = data?.logoDataUrl;

  return (
    <div className="flex flex-col">
      <div className="group relative h-12 w-12 shrink-0">
        {logo
          ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt="Logo del portal"
                className="h-12 w-12 rounded-2xl border border-slate-200 bg-white object-contain p-1 shadow-md dark:border-slate-700"
              />
            )
          : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#000081] to-[#0DC9EB] shadow-md shadow-blue-900/25">
                <Scale className="h-6 w-6 text-white" />
              </div>
            )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={mutation.isPending}
          title="Personaliza el portal: sube tu logo (PNG, JPG o WebP, máx 2 MB)"
          className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition-opacity hover:text-slate-800 focus-visible:opacity-100 group-hover:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
        >
          {mutation.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Pencil className="h-3 w-3" />}
        </button>

        {logo && (
          <button
            type="button"
            onClick={() => mutation.mutate(null)}
            disabled={mutation.isPending}
            title="Quitar el logo y volver al ícono por defecto"
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100 dark:border-slate-600 dark:bg-slate-800"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {error && (
        <p className="absolute mt-14 w-56 text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}
