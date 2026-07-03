/**
 * User table for BetterAuth
 * Safe to extend with additional fields for your application
 */
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  // Add your custom user fields below this line
});

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
