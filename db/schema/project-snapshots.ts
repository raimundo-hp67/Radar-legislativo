import { pgTable, serial, text, timestamp, varchar, date, jsonb, index } from 'drizzle-orm/pg-core';

export const projectSnapshots = pgTable('project_snapshots', {
  id: serial('id').primaryKey(),
  boletin: varchar('boletin', { length: 20 }).notNull(),
  // text (no varchar acotado): las etapas/cámaras scrapeadas pueden ser largas
  // y un límite fijo hacía fallar el insert de snapshots.
  stage: text('stage'),
  chamberCurrent: text('chamber_current'),
  lastAction: text('last_action'),
  lastActionDate: date('last_action_date'),
  urgency: varchar('urgency', { length: 50 }),
  commission: text('commission'),
  sourceProvider: varchar('source_provider', { length: 50 }).notNull(),
  sourceUrl: text('source_url'),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
  changesDetected: jsonb('changes_detected').$type<SnapshotChange[] | null>(),
}, (table) => [
  index('idx_snapshots_boletin').on(table.boletin),
  index('idx_snapshots_fetched_at').on(table.fetchedAt),
  index('idx_snapshots_boletin_fetched').on(table.boletin, table.fetchedAt),
]);

export type SnapshotChange = {
  field: string
  from: string | null
  to: string | null
};

export type ProjectSnapshot = typeof projectSnapshots.$inferSelect;
export type NewProjectSnapshot = typeof projectSnapshots.$inferInsert;
