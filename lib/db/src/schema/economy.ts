/**
 * Sottosistema cassa (economy) — libro trasferimenti a partita doppia semplificata.
 *
 * `economy_transactions` registra ogni movimento monetario all'interno di una
 * lega: depositi, prelievi, trasferimenti crediti tra team, penali, bonus.
 * La coppia (fromTeamId, toTeamId) modella il dare/avere; uno dei due può
 * essere NULL per movimenti verso/da la cassa centrale della lega.
 *
 * Tutto è spento di default (`realMoneyEnabled: false`) — le leghe esistenti
 * non vengono toccate.
 */

import {
  pgTable,
  pgEnum,
  text,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { leagues } from "./leagues";
import { fantaTeams } from "./fanta-teams";

// ============================================================
// ENUM
// ============================================================

export const currencyEnum = pgEnum("currency", [
  "credits",
  "euro",
]);
export type Currency = (typeof currencyEnum.enumValues)[number];

export const economyTxnStatusEnum = pgEnum("economy_txn_status", [
  "pending",
  "completed",
  "failed",
  "cancelled",
]);
export type EconomyTxnStatus = (typeof economyTxnStatusEnum.enumValues)[number];

export const economyTxnTypeEnum = pgEnum("economy_txn_type", [
  "deposit",
  "withdrawal",
  "transfer",
  "fine",
  "bonus",
  "fee",
]);
export type EconomyTxnType = (typeof economyTxnTypeEnum.enumValues)[number];

// ============================================================
// TABELLA
// ============================================================

export const economyTransactions = pgTable("economy_transactions", {
  id: text("id").primaryKey(),

  /** Lega di appartenenza. CASCADE: eliminare la lega rimuove le transazioni. */
  leagueId: text("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),

  /** Valuta del movimento. */
  currency: currencyEnum("currency").notNull(),

  /** Stato corrente della transazione. */
  status: economyTxnStatusEnum("status").notNull().default("pending"),

  /** Tipologia di movimento. */
  type: economyTxnTypeEnum("type").notNull(),

  /**
   * Importo in unità intere (crediti FM o centesimi di euro).
   * Sempre positivo; la direzione è indicata da fromTeamId/toTeamId.
   */
  amount: integer("amount").notNull(),

  /**
   * Team che cede il valore (dare). NULL = cassa centrale della lega.
   * NO cascade: se il team viene eliminato la transazione rimane per audit.
   */
  fromTeamId: text("from_team_id").references(() => fantaTeams.id, {
    onDelete: "set null",
  }),

  /**
   * Team che riceve il valore (avere). NULL = cassa centrale della lega.
   */
  toTeamId: text("to_team_id").references(() => fantaTeams.id, {
    onDelete: "set null",
  }),

  /** Descrizione leggibile del movimento (opzionale). */
  note: text("note"),

  /** Dati arbitrari aggiuntivi (riferimenti asta, offerta, ecc.). */
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type EconomyTransaction = typeof economyTransactions.$inferSelect;
export type NewEconomyTransaction = typeof economyTransactions.$inferInsert;
