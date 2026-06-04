import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Tabella utenti — nucleo di identità dell'app.
 *
 * NOTE — VERIFICA EMAIL RIMANDATA:
 *   L'email è la chiave univoca dell'account, ma al momento non è verificata.
 *   Un utente può registrarsi con qualsiasi email senza conferma.
 *   Il flusso di verifica (link magico via email) è previsto in una fase
 *   successiva; aggiungere `email_verified_at timestamp` e il route
 *   GET /auth/verify/:token al momento dell'implementazione.
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
