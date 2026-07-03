import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { InferGetServerSidePropsType } from 'next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import { ArrowLeft, ExternalLink, RefreshCw, FileText, Users, Target, Link2, Briefcase } from 'lucide-react';
import { requireAuth, serializeUser } from '~/lib/ssr/require-auth';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { ProjectForm } from '~/components/legal/project-form';
import { SnapshotTimeline } from '~/components/legal/changes-timeline';
import { RelevanceBadge } from '~/components/legal/relevance-badge';
import { LobbyTab } from '~/components/legal/lobby-tab';
import type { LegalProject, ProjectSnapshot } from '~/db/schema';

export const getServerSideProps = requireAuth(async (_ctx, session) => ({
  props: {
    user: serializeUser(session.user),
  },
}));

const projectDetailSchema = z.object({
  id: z.number(),
  boletin: z.string(),
  title: z.string(),
  relevance: z.string(),
  dateIngreso: z.string().nullable(),
  estado: z.string().nullable().optional(),
  camara: z.string().nullable().optional(),
  urgencia: z.string().nullable().optional(),
  comision: z.string().nullable().optional(),
  // Enhanced fields
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
  snapshots: z.array(
    z.object({
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
    }),
  ),
});

type ProjectDetail = z.infer<typeof projectDetailSchema>;

export default function ProjectDetailPage(
  _props: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = router.query;
  const [activeTab, setActiveTab] = useState('info');

  const { data: project, isLoading } = useQuery({
    queryKey: ['legal-project', id],
    queryFn: async () => {
      const response = await fetch(`/api/legal/projects/${id}`);
      if (!response.ok) {
        throw new Error('Project not found');
      }
      const data = await response.json();
      return projectDetailSchema.parse(data) as ProjectDetail;
    },
    enabled: !!id,
  });

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['legal-project', id] });
    queryClient.invalidateQueries({ queryKey: ['legal-projects'] });
    setActiveTab('info');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-black">
        <RefreshCw className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 dark:bg-black">
        <p className="text-stone-600 dark:text-stone-400">
          Proyecto no encontrado
        </p>
        <Link href="/legal">
          <Button className="mt-4">Volver al Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans dark:bg-black">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/legal"
            className="mb-4 inline-flex items-center text-sm text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver al Dashboard
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-black dark:text-stone-50">
                  {project.title}
                </h1>
                <RelevanceBadge relevance={project.relevance} />
              </div>
              <div className="mt-2 flex items-center gap-4">
                <a
                  href={`https://www.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${project.boletin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-mono text-sm text-orange-600 hover:underline dark:text-orange-400"
                >
                  Boletín
                  {' '}
                  {project.boletin}
                  <ExternalLink className="h-3 w-3" />
                </a>
                {project.dateIngreso && (
                  <span className="text-sm text-stone-600 dark:text-stone-400">
                    Ingreso:
                    {' '}
                    {project.dateIngreso}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Objetivo Section - Prominent */}
        {project.objetivo && (
          <div className="mb-6 rounded-lg border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-orange-100/50 p-5 dark:border-orange-900 dark:from-orange-950/30 dark:to-orange-900/20">
            <div className="flex items-start gap-3">
              <Target className="mt-0.5 h-5 w-5 text-orange-600 dark:text-orange-400" />
              <div>
                <h2 className="font-semibold text-orange-800 dark:text-orange-300">
                  Objetivo del Proyecto
                </h2>
                <p className="mt-2 text-stone-700 dark:text-stone-300">
                  {project.objetivo}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Current Status Card */}
        <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <h2 className="mb-3 font-semibold">Estado Actual</h2>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <span className="text-stone-500 dark:text-stone-400">Estado:</span>
              <p className="font-medium">
                {project.estado || project.latestSnapshot?.stage || '—'}
              </p>
            </div>
            <div>
              <span className="text-stone-500 dark:text-stone-400">Cámara:</span>
              <p className="font-medium">
                {project.camara || project.latestSnapshot?.chamberCurrent || '—'}
              </p>
            </div>
            <div>
              <span className="text-stone-500 dark:text-stone-400">Urgencia:</span>
              <p className="font-medium">
                {project.urgencia || project.latestSnapshot?.urgency || '—'}
              </p>
            </div>
            <div>
              <span className="text-stone-500 dark:text-stone-400">
                Último trámite:
              </span>
              <p className="font-medium">
                {project.latestSnapshot?.lastActionDate || '—'}
              </p>
            </div>
          </div>
          {project.latestSnapshot?.lastAction && (
            <div className="mt-3 border-t pt-3 dark:border-stone-800">
              <span className="text-sm text-stone-500 dark:text-stone-400">
                Descripción último trámite:
              </span>
              <p className="mt-1 text-sm">
                {project.latestSnapshot.lastAction}
              </p>
            </div>
          )}
        </div>

        {/* Autores and Links Section */}
        <div className="mb-6 grid gap-6 md:grid-cols-2">
          {/* Autores */}
          {project.autores && (
            <div className="rounded-lg border bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-stone-600 dark:text-stone-400" />
                <h2 className="font-semibold">Autores / Patrocinadores</h2>
              </div>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                {project.autores}
              </p>
            </div>
          )}

          {/* External Links */}
          {(project.linkProyecto || (project.linkInformes && project.linkInformes.length > 0)) && (
            <div className="rounded-lg border bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
              <div className="mb-3 flex items-center gap-2">
                <Link2 className="h-5 w-5 text-stone-600 dark:text-stone-400" />
                <h2 className="font-semibold">Enlaces Externos</h2>
              </div>
              <div className="space-y-2">
                {project.linkProyecto && (
                  <a
                    href={project.linkProyecto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-orange-600 hover:underline dark:text-orange-400"
                  >
                    <FileText className="h-4 w-4" />
                    Ver proyecto en Cámara
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {project.linkInformes && project.linkInformes.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-stone-500 dark:text-stone-400">
                      Informes relacionados:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {project.linkInformes.map((link, index) => (
                        <a
                          key={index}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 text-xs text-orange-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-orange-400 dark:hover:bg-stone-700"
                        >
                          Informe
                          {' '}
                          {index + 1}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="lobby" className="flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" />
              Lobby
            </TabsTrigger>
            <TabsTrigger value="edit">Editar</TabsTrigger>
            <TabsTrigger value="history">
              Historial (
              {project.snapshots.length}
              )
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4">
            <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
              <dl className="grid gap-6 md:grid-cols-2">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="border-b pb-2 text-sm font-semibold text-stone-900 dark:border-stone-700 dark:text-stone-100">
                    Información Básica
                  </h3>
                  <div>
                    <dt className="text-sm text-stone-500 dark:text-stone-400">
                      Boletín
                    </dt>
                    <dd className="font-mono">{project.boletin}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-stone-500 dark:text-stone-400">
                      Título
                    </dt>
                    <dd>{project.title}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-stone-500 dark:text-stone-400">
                      Relevancia
                    </dt>
                    <dd>
                      <RelevanceBadge relevance={project.relevance} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-stone-500 dark:text-stone-400">
                      Fecha de Ingreso
                    </dt>
                    <dd>{project.dateIngreso || '—'}</dd>
                  </div>
                </div>

                {/* Status Info */}
                <div className="space-y-4">
                  <h3 className="border-b pb-2 text-sm font-semibold text-stone-900 dark:border-stone-700 dark:text-stone-100">
                    Estado y Tramitación
                  </h3>
                  <div>
                    <dt className="text-sm text-stone-500 dark:text-stone-400">
                      Estado
                    </dt>
                    <dd>{project.estado || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-stone-500 dark:text-stone-400">
                      Cámara Actual
                    </dt>
                    <dd>{project.camara || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-stone-500 dark:text-stone-400">
                      Urgencia
                    </dt>
                    <dd>{project.urgencia || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-stone-500 dark:text-stone-400">
                      Comisión
                    </dt>
                    <dd>{project.comision || '—'}</dd>
                  </div>
                </div>

                {/* Additional Info - Full Width */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="border-b pb-2 text-sm font-semibold text-stone-900 dark:border-stone-700 dark:text-stone-100">
                    Información Adicional
                  </h3>
                  {project.objetivo && (
                    <div>
                      <dt className="text-sm text-stone-500 dark:text-stone-400">
                        Objetivo / Resumen
                      </dt>
                      <dd className="whitespace-pre-wrap">{project.objetivo}</dd>
                    </div>
                  )}
                  {project.autores && (
                    <div>
                      <dt className="text-sm text-stone-500 dark:text-stone-400">
                        Autores / Patrocinadores
                      </dt>
                      <dd>{project.autores}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm text-stone-500 dark:text-stone-400">
                      Notas
                    </dt>
                    <dd className="whitespace-pre-wrap">
                      {project.notes || 'Sin notas'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-stone-500 dark:text-stone-400">
                      Agregado al seguimiento
                    </dt>
                    <dd>
                      {new Date(project.createdAt).toLocaleDateString('es-CL', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          </TabsContent>

          <TabsContent value="lobby" className="mt-4">
            <LobbyTab boletin={project.boletin} projectTitle={project.title} />
          </TabsContent>

          <TabsContent value="edit" className="mt-4">
            <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
              <ProjectForm
                project={project as unknown as LegalProject}
                onSuccess={handleFormSuccess}
              />
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <SnapshotTimeline
              snapshots={project.snapshots as unknown as ProjectSnapshot[]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
