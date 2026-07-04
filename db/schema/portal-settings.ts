import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Personalización del portal (una sola fila).
 * logoDataUrl guarda el logo subido como data URI (base64) — así funciona
 * igual en local y en serverless, sin necesitar storage de archivos.
 */
export const portalSettings = pgTable('portal_settings', {
  id: serial('id').primaryKey(),
  logoDataUrl: text('logo_data_url'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type PortalSettings = typeof portalSettings.$inferSelect;
