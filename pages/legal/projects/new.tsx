import Link from 'next/link';
import type { InferGetServerSidePropsType } from 'next';
import { ArrowLeft } from 'lucide-react';
import { requireAuth, serializeUser } from '~/lib/ssr/require-auth';
import { ProjectForm } from '~/components/legal/project-form';

export const getServerSideProps = requireAuth(async (_ctx, session) => ({
  props: {
    user: serializeUser(session.user),
  },
}));

export default function NewProject(
  _props: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-black">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/legal"
            className="mb-4 inline-flex items-center text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver al Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-slate-50">
            Nuevo Proyecto de Ley
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Agrega un nuevo proyecto de ley al seguimiento legislativo
          </p>
        </div>

        {/* Form */}
        <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ProjectForm />
        </div>
      </div>
    </div>
  );
}
