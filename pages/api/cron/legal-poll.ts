import type { NextApiRequest, NextApiResponse } from 'next';
import { runPoll } from '~/lib/legal/poll-runner';
import { rejectUnauthorizedCron } from '~/lib/api/cron-auth';

// Vercel: polling every tracked project (fetch + 500ms delay each) can take minutes
export const maxDuration = 300;

/**
 * Cron endpoint for Vercel - called automatically on the schedule in vercel.json
 * Protected by Vercel's CRON_SECRET header verification
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests (Vercel Cron uses GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the request is from Vercel Cron (fail closed if CRON_SECRET is missing)
  if (rejectUnauthorizedCron(req, res)) return;

  console.log('Starting legal poll cron job...');

  try {
    const summary = await runPoll();
    console.log(`Poll completed: ${summary.polled}/${summary.total} projects, ${summary.withChanges} with changes`);
    return res.status(200).json(summary);
  } catch (error) {
    console.error('Poll failed:', error);
    return res.status(500).json({
      error: 'Poll failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
