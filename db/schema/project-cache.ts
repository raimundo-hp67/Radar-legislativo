import { pgTable, serial, text, timestamp, index, boolean } from 'drizzle-orm/pg-core';

/**
 * Cache of all legislative projects from Senado
 * This table is periodically synced with the Senado API
 * to enable fast local keyword searches
 */
export const projectCache = pgTable(
  'project_cache',
  {
    id: serial('id').primaryKey(),
    boletin: text('boletin').notNull().unique(),
    titulo: text('titulo').notNull(),
    fechaIngreso: text('fecha_ingreso'),
    estado: text('estado'),
    etapa: text('etapa'),
    subetapa: text('subetapa'),
    camaraOrigen: text('camara_origen'),
    urgencia: text('urgencia'),
    ultimoTramite: text('ultimo_tramite'),
    fechaUltimoTramite: text('fecha_ultimo_tramite'),
    autores: text('autores'),
    materias: text('materias'),
    resumen: text('resumen'),
    // Search optimization: concatenated searchable text
    searchText: text('search_text'),
    // Track if project is currently active (in tramitación)
    isActive: boolean('is_active').default(true),
    // Metadata
    sourceUrl: text('source_url'),
    lastSyncedAt: timestamp('last_synced_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  // Nota: search_text NO se indexa a propósito. Las búsquedas usan
  // ILIKE '%...%' (un btree no ayuda ahí) y los textos largos superan el
  // máximo de fila de un índice btree (~2.7 KB), lo que hacía fallar el
  // insert de proyectos con muchos autores/materias.
  (table) => [
    index('project_cache_boletin_idx').on(table.boletin),
    index('project_cache_is_active_idx').on(table.isActive),
    index('project_cache_fecha_ingreso_idx').on(table.fechaIngreso),
  ],
);

export type ProjectCache = typeof projectCache.$inferSelect;
export type NewProjectCache = typeof projectCache.$inferInsert;
