/**
 * Next.js instrumentation hook: runs once when the server starts.
 * https://nextjs.org/docs/pages/guides/instrumentation
 */
export async function register(): Promise<void> {
  // Only in the Node.js server runtime (not edge, not the client bundle).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // On Vercel the cron jobs in vercel.json handle updates; a long-lived
  // interval makes no sense in serverless functions.
  if (process.env.VERCEL) return;

  const { startAutoUpdater } = await import('~/lib/legal/auto-updater');
  startAutoUpdater();
}
