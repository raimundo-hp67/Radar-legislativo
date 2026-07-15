import Link from 'next/link';
import { useRouter } from 'next/router';
import type { InferGetServerSidePropsType } from 'next';
import { useQuery } from '@tanstack/react-query';
import * as z from 'zod';
import {
  ArrowLeft, Building2, Calendar, ExternalLink, FileText,
  Handshake, MapPin, RefreshCw, User, Users,
} from 'lucide-react';
import { requireAuth, serializeUser } from '~/lib/ssr/require-auth';
import { Button } from '~/components/ui/button';

export const getServerSideProps = requireAuth(async (_ctx, session) => ({
  props: {
    user: serializeUser(session.user),
  },
}));

const audienciaSchema = z.object({
  id: z.number(),
  infolobbyId: z.string(),
  fecha: z.string().nullable(),
  lugar: z.string().nullable(),
  forma: z.string().nullable(),
  tipoAudiencia: z.string().nullable(),
  sujetoPasivo: z.string().nullable(),
  sujetoPasivoCargo: z.string().nullable(),
  sujetoPasivoInstitucion: z.string().nullable(),
  sujetoActivo: z.string().nullable(),
  sujetoActivoTipo: z.string().nullable(),
  sujetoActivoOrganizacion: z.string().nullable(),
  materia: z.string().nullable(),
  observaciones: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  fetchedAt: z.string(),
});

type Audiencia = z.infer<typeof audienciaSchema>;

function formatFecha(fecha: string | null): string {
  if (!fecha) return '—';
  const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return fecha;
  const [, year, month, day] = match;
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const monthName = meses[Number(month) - 1] ?? month;
  return `${Number(day)} de ${monthName} de ${year}`;
}

function DetailField({ label, value }: { label: string, value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}

export default function LobbyAudienciaDetailPage(
  _props: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : null;

  const { data: audiencia, isLoading, isError } = useQuery<Audiencia>({
    queryKey: ['lobby-audiencia', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await fetch(`/api/legal/lobby/audiencia/${id}`);
      if (!response.ok) throw new Error('No se pudo cargar la audiencia');
      return audienciaSchema.parse(await response.json());
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/legal?tab=lobby" className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" />
          Volver a Lobby
        </Link>

        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="h-6 w-6 animate-spin text-cyan-500" />
          </div>
        )}

        {isError && (
          <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No se encontró esta audiencia.</p>
            <p className="mt-1 text-sm text-slate-500">Puede haber sido eliminada en una resincronización.</p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/legal?tab=lobby">Ir al explorador de lobby</Link>
            </Button>
          </div>
        )}

        {audiencia && (
          <div className="mt-4 space-y-4">
            {/* Header */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-600 dark:text-cyan-400">
                    <Handshake className="h-4 w-4" />
                    Audiencia de lobby
                    {audiencia.tipoAudiencia ? ` · ${audiencia.tipoAudiencia}` : ''}
                  </div>
                  <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    {audiencia.sujetoPasivo || 'Sujeto pasivo no informado'}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatFecha(audiencia.fecha)}
                    </span>
                    {audiencia.lugar && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {audiencia.lugar}
                      </span>
                    )}
                    {audiencia.forma && <span>{audiencia.forma}</span>}
                  </div>
                </div>
                {audiencia.sourceUrl && (
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <a href={audiencia.sourceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Ver fuente
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* Materia */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <FileText className="h-4 w-4 text-cyan-500" />
                Materia tratada
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {audiencia.materia || 'No informada.'}
              </p>
              {audiencia.observaciones && (
                <>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Observaciones</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {audiencia.observaciones}
                  </p>
                </>
              )}
            </div>

            {/* Quién recibe / quién gestiona */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <User className="h-4 w-4 text-cyan-500" />
                  Sujeto pasivo (quien recibe)
                </div>
                <div className="mt-4 space-y-4">
                  <DetailField label="Nombre" value={audiencia.sujetoPasivo} />
                  <DetailField label="Cargo" value={audiencia.sujetoPasivoCargo} />
                  <DetailField label="Institución" value={audiencia.sujetoPasivoInstitucion} />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <Users className="h-4 w-4 text-amber-500" />
                  Sujeto activo (quien gestiona)
                </div>
                <div className="mt-4 space-y-4">
                  <DetailField label="Nombre" value={audiencia.sujetoActivo} />
                  <DetailField label="Tipo" value={audiencia.sujetoActivoTipo} />
                  <DetailField label="Organización que representa" value={audiencia.sujetoActivoOrganizacion} />
                  {!audiencia.sujetoActivo && !audiencia.sujetoActivoOrganizacion && (
                    <p className="text-sm text-slate-500">No informado en el registro público.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Building2 className="h-4 w-4 text-slate-400" />
                Registro
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <DetailField label="ID del registro" value={audiencia.infolobbyId} />
                <DetailField label="Forma" value={audiencia.forma} />
                <DetailField
                  label="Descargada el"
                  value={new Date(audiencia.fetchedAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                />
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Datos públicos de la Ley 20.730 (Ley de Lobby). La app guarda una copia local; el registro oficial vive en la fuente.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
