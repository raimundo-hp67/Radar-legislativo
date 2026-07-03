import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchProjectStatus } from '~/lib/legal/congress-scraper';
import { protectedHandler } from '~/lib/api/protected-handler';

/**
 * GET /api/legal/test-scraper?boletin=17618-19
 * Test endpoint to debug the scraper
 */
export default protectedHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const boletin = req.query.boletin as string;
  if (!boletin) {
    return res.status(400).json({ error: 'Missing boletin parameter' });
  }

  try {
    // Test the scraper
    const scrapedData = await fetchProjectStatus(boletin);

    return res.status(200).json({
      success: true,
      boletin,
      scrapedData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      boletin,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
