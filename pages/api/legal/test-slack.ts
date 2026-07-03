import type { NextApiResponse } from 'next';
import { db } from '~/db';
import { legalProjects } from '~/db/schema';
import { protectedHandler } from '~/lib/api/protected-handler';
import { sendSlackAlert } from '~/lib/legal/slack-notifier';
import { env } from '~/config/env';
import type { PollResult, Relevance } from '~/lib/legal/types';
import { eq } from 'drizzle-orm';

/**
 * POST /api/legal/test-slack
 * Test endpoint to simulate a HIGH priority change and send Slack notification
 *
 * Body can optionally include:
 * - boletin: string (to test with a specific project)
 */
export default protectedHandler(async (req, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if Slack webhook is configured
  if (!env.SLACK_WEBHOOK_URL) {
    return res.status(400).json({
      error: 'Slack webhook not configured',
      message: 'Please set SLACK_WEBHOOK_URL environment variable',
    });
  }

  try {
    // Get a HIGH priority project to test with, or use provided boletin
    const { boletin } = req.body as { boletin?: string };

    let project;
    if (boletin) {
      [project] = await db
        .select()
        .from(legalProjects)
        .where(eq(legalProjects.boletin, boletin))
        .limit(1);
    } else {
      // Get first HIGH priority project
      [project] = await db
        .select()
        .from(legalProjects)
        .where(eq(legalProjects.relevance, 'HIGH'))
        .limit(1);
    }

    if (!project) {
      // If no HIGH priority project, get any project
      [project] = await db.select().from(legalProjects).limit(1);
    }

    if (!project) {
      return res.status(404).json({
        error: 'No projects found',
        message: 'Please add at least one project to test',
      });
    }

    // Create a simulated poll result with fake changes
    const testResult: PollResult = {
      boletin: project.boletin,
      title: project.title,
      relevance: (project.relevance || 'HIGH') as Relevance,
      snapshot: {
        id: 0,
        boletin: project.boletin,
        stage: project.estado || 'Segundo trámite',
        chamberCurrent: project.camara || 'Senado',
        lastAction: 'PRUEBA: Votación en sala - Aprobado',
        lastActionDate: new Date().toLocaleDateString('es-CL'),
        urgency: project.urgencia || 'Simple',
        commission: project.comision || 'Comisión de Hacienda',
        sourceProvider: 'test',
        sourceUrl: `https://www.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${project.boletin}`,
        fetchedAt: new Date(),
        changesDetected: null,
      },
      changes: [
        {
          field: 'stage',
          from: 'Primer trámite',
          to: 'Segundo trámite',
        },
        {
          field: 'chamberCurrent',
          from: 'Cámara de Diputados',
          to: 'Senado',
        },
        {
          field: 'lastAction',
          from: 'Cuenta de proyecto',
          to: 'PRUEBA: Votación en sala - Aprobado',
        },
      ],
    };

    // Send the test alert
    await sendSlackAlert(testResult);

    return res.status(200).json({
      success: true,
      message: 'Test notification sent to Slack',
      testData: {
        boletin: testResult.boletin,
        title: testResult.title,
        relevance: testResult.relevance,
        changesSimulated: testResult.changes?.length || 0,
      },
    });
  } catch (error) {
    console.error('Test Slack notification failed:', error);
    return res.status(500).json({
      error: 'Failed to send test notification',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
