/**
 * FantaTeam — la squadra di UN manager dentro UNA Lega.
 *
 * Una FantaTeam contiene la rosa di giocatori (riferimenti via Contract o
 * via roster snapshot) e i crediti residui del manager.
 */

import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { leagues } from "./leagues";
import { coaches } from "./coaches";
import { societa } from "./societa";

/**
 * Rosa attuale (snapshot).
 * Per leghe Manageriale, la verità è nei Contract attivi; questo è cache UI.
 * Per leghe Classico, questo è la fonte primaria.
 */
export interface RosterSnapshot {
  /** Liste di player_id per ruolo Classico */
  gk: number[];
  def: number[];
  mid: number[];
  att: number[];
  /** ID del capitano scelto per la prossima giornata */
  captainPlayerId?: number;
  vicePlayerId?: number;
}

// ============================================================
// TABELLA
// ============================================================

export const fantaTeams = pgTable("fanta_teams", {
  id: text("id").primaryKey(),
  leagueId: text("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  /**
   * Manager della squadra. NULL = slot non rivendicato (in attesa di claim).
   * Valorizzato atomicamente dal flusso di claim invito.
   */
  managerUserId: text("manager_user_id"),

  /**
   * Società collegata — fonte dell'identità (nome, stemma, colori).
   * Nullable: null = slot non rivendicato (nessun manager assegnato ancora).
   */
  societaId: text("societa_id").references(() => societa.id, { onDelete: "set null" }),

  /** Crediti disponibili in questa lega (per-lega, MAI sulla società). */
  creditsRemaining: integer("credits_remaining").notNull().default(0),

  /** Snapshot della rosa attuale (per-lega, MAI sulla società). */
  roster: jsonb("roster").$type<RosterSnapshot>().notNull(),

  /** Allenatore fanta scelto dal manager (riferisce coaches.id). */
  headCoachId: integer("head_coach_id").references(() => coaches.id, { onDelete: "set null" }),

  /** Nome allenatore libero inserito dal manager (display only). */
  coachName: text("coach_name"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FantaTeam = typeof fantaTeams.$inferSelect;
export type NewFantaTeam = typeof fantaTeams.$inferInsert;
