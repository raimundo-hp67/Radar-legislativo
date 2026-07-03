import Link from 'next/link';
import { Scale, ArrowRight } from 'lucide-react';

export default function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 font-sans dark:bg-stone-950">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 px-8 py-32 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-500/25">
          <Scale className="h-8 w-8 text-white" />
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            Radar Legislativo
          </h1>
          <p className="max-w-md text-lg leading-8 text-stone-600 dark:text-stone-400">
            Seguimiento de proyectos de ley del Congreso de Chile y audiencias
            de lobby (Ley 20.730), con alertas y análisis.
          </p>
        </div>
        <Link
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-orange-600 px-6 text-base font-medium text-white shadow-sm transition-all hover:bg-orange-500 hover:shadow-md"
          href="/legal"
        >
          Ir al dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </main>
    </div>
  );
}
