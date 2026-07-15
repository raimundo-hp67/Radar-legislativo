/**
 * ⚙️ CONFIGURACIÓN TEMÁTICA DEL RADAR
 *
 * Este es EL archivo que editas para adaptar la herramienta a tu área de
 * interés (salud, minería, educación, medio ambiente, …). Todo lo temático
 * vive aquí: keywords de búsqueda, instituciones vigiladas para alertas de
 * lobby, boletines semilla y preguntas sugeridas de los agentes de IA.
 *
 * Los valores incluidos son el ejemplo con que se distribuye el proyecto
 * (regulación financiera / fintech). Reemplázalos por los de tu tema y
 * reinicia la app — no hay que tocar ningún otro archivo.
 *
 * Guía completa: README → "Adaptar el radar a tu tema".
 */

export const radarConfig = {
  /**
   * Keywords por defecto del buscador de proyectos de ley (pestaña
   * Investigación y `GET /api/legal/search?preset=default`).
   */
  searchKeywords: [
    'fintech',
    'open banking',
    'banca abierta',
    'pagos electrónicos',
    'transferencias',
    'datos financieros',
    'API bancaria',
    'sistema de pagos',
    'interoperabilidad financiera',
    'protección de datos',
    'ciberseguridad',
    'fraude financiero',
    'ley fintech',
    'regulación financiera',
    'CMF',
    'instituciones financieras',
    'tarjetas de crédito',
    'tarjetas de débito',
    'pago instantáneo',
    'billetera digital',
    'criptomonedas',
    'inteligencia artificial',
  ],

  /**
   * Alertas de lobby: si una audiencia nueva involucra una institución cuyo
   * nombre contiene alguna de estas keywords, se notifica a Slack.
   */
  lobbyWatchKeywords: [
    'CMF',
    'Comisión para el Mercado Financiero',
    'Banco Central',
    'Coordinación de Mercados de Capitales',
    'Mercado de Capitales',
  ],

  /** Etiqueta corta de las instituciones vigiladas (texto de la alerta Slack). */
  lobbyAlertLabel: 'CMF / Banco Central / Mercado de Capitales',

  /**
   * Boletines que sincroniza el refresco rápido del cache de búsqueda
   * (`syncRecentProjects`). Máximo ~5 para que el refresco tome segundos;
   * la carga masiva real se hace con `bun run scripts/bulk-sync.ts`.
   */
  cacheSeedBoletines: [
    '14570', // Ley Fintech (publicada 2023)
    '15034', // Seguridad cajas bancarias
    '18079',
    '18081',
    '18083',
  ],

  /**
   * Búsquedas temáticas de audiencias de lobby para el endpoint
   * `POST /api/legal/lobby/refresh-recent` (código corto + términos de búsqueda).
   */
  lobbySearchTargets: [
    { code: 'CMF', query: 'Comisión para el Mercado Financiero fintech pagos emisoras no bancarias' },
    { code: 'BCCH', query: 'Banco Central de Chile medios de pago sistema de pagos' },
    { code: 'HACIENDA', query: 'Ministerio de Hacienda fintech servicios financieros digitales' },
    { code: 'UAF', query: 'Unidad de Análisis Financiero lavado de activos fintech' },
    { code: 'FINTEC', query: 'fintech medios de pago emisores no bancarios pagos digitales' },
  ],

  /** Preguntas sugeridas del agente de la pestaña Investigación. */
  suggestedQuestions: [
    '¿Qué proyectos de fintech están en trámite?',
    '¿Cuál es el estado del proyecto sobre open banking?',
    '¿Qué proyectos de alta prioridad estamos monitoreando?',
    '¿Qué cambios recientes han tenido nuestros proyectos?',
    '¿Hay proyectos sobre protección de datos financieros?',
  ],

  /** Chips de búsqueda rápida de la pestaña Investigación. */
  quickKeywords: [
    'fintech',
    'open banking',
    'pagos electrónicos',
    'ciberseguridad',
    'protección de datos',
    'CMF',
    'criptomonedas',
    'inteligencia artificial',
  ],

  /** Placeholder del buscador de la pestaña Investigación. */
  searchPlaceholder: 'fintech, pagos, datos...',

  /** Preguntas sugeridas del agente de la pestaña Lobby. */
  lobbySuggestedQuestions: [
    '¿Cuántas veces se ha reunido el Banco Central con asociaciones del retail financiero?',
    '¿Quién del Senado ha tenido más audiencias sobre fintech?',
    '¿Qué temas se han discutido más en la CMF este año?',
    '¿Cuáles son las instituciones con más audiencias de lobby?',
    '¿Quién se ha reunido más con la Superintendencia de Bancos?',
  ],
};
