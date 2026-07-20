import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Estado interno de los procesos de sincronización (clave → valor).
 *
 * Hoy se usa para marcar que la carga histórica del lobby del Senado terminó
 * completa ('senado_lobby_full_scan'): si el usuario interrumpe la primera
 * carga (Ctrl+C), quedan filas parciales en la base y contar filas ya no
 * sirve para saber si falta histórico — este marcador sí.
 */
export const syncState = pgTable('sync_state', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type SyncState = typeof syncState.$inferSelect;
