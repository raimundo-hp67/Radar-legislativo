import type { NextApiRequest, NextApiResponse } from 'next';
import { protectedHandler } from '~/lib/api/protected-handler';
import {
  searchProjects,
  searchByBoletin,
  getSearchCacheStats,
  DEFAULT_SEARCH_KEYWORDS,
  type SearchResult,
} from '~/lib/legal/project-search';

type SearchResponse = {
  results: SearchResult[]
  query: string
  count: number
  cacheEmpty?: boolean
} | {
  error: string
};

export default protectedHandler(async (
  req: NextApiRequest,
  res: NextApiResponse<SearchResponse>,
) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q, boletin, preset } = req.query;

  try {
    // Search by specific boletin
    if (boletin && typeof boletin === 'string') {
      const result = await searchByBoletin(boletin);
      return res.status(200).json({
        results: result ? [result] : [],
        query: boletin,
        count: result ? 1 : 0,
      });
    }

    // Search by keywords
    let keywords: string[] = [];

    if (preset === 'default' || preset === 'fintech') {
      // Theme keywords from config/radar.config.ts ('fintech' kept as legacy alias)
      keywords = DEFAULT_SEARCH_KEYWORDS.slice(0, 5); // Use top 5 keywords
    } else if (q && typeof q === 'string') {
      // Use custom query
      keywords = q.split(',').map((k) => k.trim()).filter(Boolean);
    }

    if (keywords.length === 0) {
      return res.status(400).json({
        error: 'Se requiere al menos una palabra clave (q=keyword1,keyword2) o preset=default',
      });
    }

    const results = await searchProjects({
      keywords,
      limit: 30,
    });

    // "Sin resultados" y "la caché nunca se sincronizó" son indistinguibles
    // para el usuario: avisar al frontend cuando la caché está vacía.
    let cacheEmpty = false;
    if (results.length === 0) {
      const stats = await getSearchCacheStats();
      cacheEmpty = stats.totalProjects === 0;
    }

    return res.status(200).json({
      results,
      query: keywords.join(', '),
      count: results.length,
      cacheEmpty,
    });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({
      error: 'Error al buscar proyectos',
    });
  }
});
