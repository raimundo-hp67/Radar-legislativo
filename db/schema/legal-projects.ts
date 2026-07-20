import { pgTable, serial, text, timestamp, varchar, date, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';

export const legalProjects = pgTable('legal_projects', {
  id: serial('id').primaryKey(),
  // Dueño del proyecto: cada usuario tiene su propio radar privado. Los datos
  // públicos scrapeados (project_snapshots) se comparten por boletín, pero la
  // decisión de seguir un proyecto y sus notas/prioridad son de cada usuario.
  userId: text('user_id').notNull(),
  boletin: varchar('boletin', { length: 20 }).notNull(),
  title: text('title').notNull(),
  relevance: varchar('relevance', { length: 10 }).notNull(), // LOW, MEDIUM, HIGH
  dateIngreso: date('date_ingreso'),
  // Campos de seguimiento (editables, y sobrescritos por el scraper).
  // Son text (no varchar acotado): el Congreso usa etapas largas como
  // "Comisión Mixta por rechazo de modificaciones (Senado)" que rompían
  // el límite de 50 caracteres en cada ciclo de actualización.
  estado: text('estado'), // primer trámite, segundo trámite, comisión mixta…
  camara: text('camara'), // Diputados, Senado
  urgencia: text('urgencia'), // Simple, Suma, Inmediata, Sin urgencia
  comision: text('comision'), // Comisión actual
  // Enhanced fields
  autores: text('autores'), // Autores/patrocinadores separados por coma
  objetivo: text('objetivo'), // Resumen/objetivo del proyecto (más prominente que notas)
  linkProyecto: text('link_proyecto'), // Link al proyecto en cámara.cl
  linkInformes: jsonb('link_informes').$type<string[]>(), // Array de links a informes relevantes
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  // Un mismo boletín puede ser seguido por varios usuarios, pero solo una vez
  // por usuario. La unicidad es por (usuario, boletín), no global.
  uniqueIndex('uq_projects_user_boletin').on(table.userId, table.boletin),
  index('idx_projects_user').on(table.userId),
  index('idx_projects_relevance').on(table.relevance),
  index('idx_projects_created_at').on(table.createdAt),
]);

export type LegalProject = typeof legalProjects.$inferSelect;
export type NewLegalProject = typeof legalProjects.$inferInsert;
