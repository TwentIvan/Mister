/**
 * Player — cache locale dei giocatori Serie A sincronizzata da API-Football.
 *
 * Il primary key `id` è l'ID API-Football, così possiamo deduplicare facilmente
 * tra refresh. Tutte le metriche grezze (eventi, statistiche, lineups) per
 * giocatore-giornata vivono in `player_giornata_stats` (vedi sotto), questa
 * tabella è solo il profilo statico.
 *
 * `currentValue` viene aggiornato dal sistema solo se la federation ha
 * `player_value_dynamic` true. Altrimenti resta null.
 */

import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  real,
  serial,
  doublePrecision,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ============================================================
// ENUMS (espressi come union types, perché variano poco)
// ============================================================

export type PlayerRoleClassic = "GK" | "DEF" | "MID" | "ATT";

/**
 * Ruoli Mantra estesi. Por = portiere. Difensori: Dc, Dd, Ds, B (braccetto).
 * Centrocampisti: E (esterno), M (mediano), C (centrale), W (ala), T (trequartista).
 * Attaccanti: A (ala att), Pc (punta centrale).
 */
export type PlayerRoleMantra =
  | "Por"
  | "Dc"
  | "Dd"
  | "Ds"
  | "B"
  | "E"
  | "M"
  | "C"
  | "W"
  | "T"
  | "A"
  | "Pc";

// ============================================================
// PLAYER (profilo statico)
// ============================================================

export const players = pgTable("players", {
  /** API-Football player ID */
  id: integer("id").primaryKey(),

  /** Nome breve (cognome o "Lautaro", "Theo Hernandez", ecc.) */
  name: text("name").notNull(),
  /** Nome completo come da API-Football */
  fullName: text("full_name").notNull(),

  /** Nome squadra Serie A reale, es. "Inter", "Milan", "Roma" */
  realTeam: text("real_team").notNull(),

  /** Ruolo Classico GK/DEF/MID/ATT */
  roleClassic: text("role_classic").$type<PlayerRoleClassic>().notNull(),

  /**
   * Ruoli Mantra. Solitamente 1-2 per giocatore, qualche jolly fino a 3.
   * Es. per Theo Hernandez: ["Ds", "E"].
   */
  rolesMantra: jsonb("roles_mantra").$type<PlayerRoleMantra[]>().notNull().default([]),

  /** Date in formato ISO yyyy-mm-dd */
  birthDate: text("birth_date"),
  nationality: text("nationality"),
  heightCm: integer("height_cm"),
  foot: text("foot"), // "left" | "right" | "both"
  photoUrl: text("photo_url"),

  injured: boolean("injured").notNull().default(false),

  /**
   * Valore corrente del giocatore in crediti, aggiornato dal sistema.
   * Null se la lega non ha player_value_dynamic attivo, o se non ancora computato.
   */
  currentValue: doublePrecision("current_value"),

  /**
   * Riferimento facoltativo alla squadra attuale (stagione corrente).
   * Null finché non viene popolato da un sync dedicato (task 5d).
   * Separato da real_team che è derivato dalle statistiche storiche.
   */
  currentTeamId: integer("current_team_id"),

  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;

// ============================================================
// PERFORMANCE STATS PER GIORNATA
// ============================================================

/**
 * Una riga per giocatore × giornata.
 * `statsJson` contiene il dump strutturato di tutte le metriche API-Football
 * (gol, assist, tiri, ammonizioni, espulsioni, minuti, voti grezzi, ecc.)
 * che servono all'algoritmo proprietario per calcolare il voto finale.
 */
export const playerGiornataStats = pgTable(
  "player_giornata_stats",
  {
    id: serial("id").primaryKey(),
    season: integer("season").notNull(),
    round: integer("round").notNull(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    fixtureId: integer("fixture_id").notNull(),

    /** Voto finale calcolato dall'algoritmo Mister */
    votoMister: real("voto_mister"),

    /** Statistiche grezze + log degli eventi per replay/debug */
    statsJson: jsonb("stats_json").notNull(),

    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("player_giornata_stats_unique_idx").on(
      t.season,
      t.round,
      t.fixtureId,
      t.playerId,
    ),
  ],
);

export type PlayerGiornataStats = typeof playerGiornataStats.$inferSelect;
