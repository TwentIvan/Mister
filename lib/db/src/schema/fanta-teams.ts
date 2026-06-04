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

// ============================================================
// TIPI DI SUPPORTO
// ============================================================

/** Maglia personalizzata del manager (colori, dettagli). */
export interface JerseyConfig {
  primaryColor: string;
  secondaryColor: string;
  pattern: "solid" | "stripes_vertical" | "stripes_horizontal" | "halved" | "checkered";
  /** Sponsor testuale opzionale sul petto */
  sponsor?: string;
}

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
  managerUserId: text("manager_user_id").notNull(),

  /** Nome ufficiale della squadra */
  name: text("name").notNull(),
  /**
   * Nome usato dal battitore in asta (può essere diverso per ragioni di
   * pronuncia, es. "Bar Roma" invece di "Champions del Bar Roma 2025").
   */
  nameAuction: text("name_auction"),

  /** URL del logo della squadra (caricato dal manager). */
  logoUrl: text("logo_url"),

  /** Configurazione visuale della maglia. */
  jersey: jsonb("jersey").$type<JerseyConfig>(),

  /** Crediti disponibili in questo momento. */
  creditsRemaining: integer("credits_remaining").notNull().default(0),

  /** Snapshot della rosa attuale. */
  roster: jsonb("roster").$type<RosterSnapshot>().notNull(),

  /** Allenatore fanta scelto dal manager (riferisce coaches.id). */
  headCoachId: integer("head_coach_id").references(() => coaches.id, { onDelete: "set null" }),

  /** Nome allenatore libero inserito dal manager (display only, indipendente dai dati reali). */
  coachName: text("coach_name"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FantaTeam = typeof fantaTeams.$inferSelect;
export type NewFantaTeam = typeof fantaTeams.$inferInsert;
