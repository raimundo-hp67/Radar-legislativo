import { pgTable, serial, text, timestamp, varchar, date, index, jsonb } from 'drizzle-orm/pg-core';

export const legalProjects = pgTable('legal_projects', {
  id: serial('id').primaryKey(),
  boletin: varchar('boletin', { length: 20 }).notNull().unique(),
  title: text('title').notNull(),
  relevance: varchar('relevance', { length: 10 }).notNull(), // LOW, MEDIUM, HIGH
  dateIngreso: date('date_ingreso'),
  // Manual tracking fields (editable by user)
  estado: varchar('estado', { length: 50 }), // primer trámite, segundo trámite, etc.
  camara: varchar('camara', { length: 50 }), // Diputados, Senado
  urgencia: varchar('urgencia', { length: 50 }), // Simple, Suma, Inmediata, Sin urgencia
  comision: varchar('comision', { length: 100 }), // Comisión actual
  // Enhanced fields
  autores: text('autores'), // Autores/patrocinadores separados por coma
  objetivo: text('objetivo'), // Resumen/objetivo del proyecto (más prominente que notas)
  linkProyecto: text('link_proyecto'), // Link al proyecto en cámara.cl
  linkInformes: jsonb('link_informes').$type<string[]>(), // Array de links a informes relevantes
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_projects_relevance').on(table.relevance),
  index('idx_projects_created_at').on(table.createdAt),
]);

export type LegalProject = typeof legalProjects.$inferSelect;
export type NewLegalProject = typeof legalProjects.$inferInsert;
