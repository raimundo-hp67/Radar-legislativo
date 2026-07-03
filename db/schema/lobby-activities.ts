import { pgTable, serial, text, timestamp, varchar, index } from 'drizzle-orm/pg-core';

export const lobbyAudiencias = pgTable('lobby_audiencias', {
  id: serial('id').primaryKey(),
  infolobbyId: varchar('infolobby_id', { length: 100 }).notNull().unique(),
  fecha: varchar('fecha', { length: 20 }),
  lugar: text('lugar'),
  forma: varchar('forma', { length: 50 }),
  tipoAudiencia: varchar('tipo_audiencia', { length: 100 }),
  sujetoPasivo: text('sujeto_pasivo'),
  sujetoPasivoCargo: text('sujeto_pasivo_cargo'),
  sujetoPasivoInstitucion: text('sujeto_pasivo_institucion'),
  sujetoActivo: text('sujeto_activo'),
  sujetoActivoTipo: varchar('sujeto_activo_tipo', { length: 50 }),
  sujetoActivoOrganizacion: text('sujeto_activo_organizacion'),
  materia: text('materia'),
  observaciones: text('observaciones'),
  searchText: text('search_text'),
  sourceUrl: text('source_url'),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_lobby_infolobby_id').on(table.infolobbyId),
  index('idx_lobby_fecha').on(table.fecha),
  index('idx_lobby_sujeto_pasivo').on(table.sujetoPasivo),
  index('idx_lobby_sujeto_activo').on(table.sujetoActivo),
  index('idx_lobby_institucion').on(table.sujetoPasivoInstitucion),
  index('idx_lobby_search_text').on(table.searchText),
]);

export type LobbyAudiencia = typeof lobbyAudiencias.$inferSelect;
export type NewLobbyAudiencia = typeof lobbyAudiencias.$inferInsert;
