/**
 * Competition — un singolo torneo dentro una Lega.
 *
 * Sei tipi supportati, allineati alle modalità standard del fantacalcio italiano:
 *   • campionato         — girone all'italiana, default ripetuto N volte
 *   • coppa              — eliminazione diretta, bracket manuale
 *   • battle_royale      — tutti contro tutti ogni giornata, cumulativo
 *   • sprint_race        — eliminazione del peggiore ogni giornata
 *   • formula_uno        — punteggio F1 per posizione ogni giornata
 *   • punteggio_assoluto — somma cumulativa pura
 *
 * L'admin crea ESPLICITAMENTE ogni Competizione: nessun automatismo,
 * nessun calendario di default. La Lega nasce con zero competizioni.
 *
 * I tiebreaker sono dinamici (l'admin sceglie l'ordine), ma validati per tipo:
 * vedi ALLOWED_TIEBREAKERS_BY_TYPE sotto.
 */

import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { leagues } from "./leagues";

// ============================================================
// ENUMS
// ============================================================

export const competitionTypeEnum = pgEnum("competition_type", [
  "campionato",
  "coppa",
  "battle_royale",
  "sprint_race",
  "formula_uno",
  "punteggio_assoluto",
]);
export type CompetitionType = (typeof competitionTypeEnum.enumValues)[number];

// ============================================================
// TIEBREAKER CATALOG
// ============================================================

export type TiebreakerCriterion =
  | "punti" // punti classifica 3-1-0 (campionato)
  | "scontri_diretti" // H2H (round-robin only)
  | "differenza_reti" // gol_fatti - gol_subiti
  | "gol_fatti"
  | "gol_subiti"
  | "punteggio_totale" // somma fanta-punti assoluti
  | "vittorie" // numero match vinti (campionato)
  | "vittorie_totali_match" // battle_royale: somma vittorie tra match paralleli
  | "giornate_vinte" // primi posti di giornata (F1, p.assoluto)
  | "f1_punti" // punti F1
  | "f1_vittorie" // primi posti F1
  | "f1_podi" // top 3 F1
  | "punteggio_max_giornata"
  | "gol_fatti_giornata" // sprint_race tiebreaker eliminazione
  | "punteggio_totale_storico" // cumulativo a quel punto (sprint_race)
  | "sorteggio"; // ultimo, sempre ammesso

/**
 * Tiebreaker ammessi per tipo. `sorteggio` è SEMPRE ammesso e viene aggiunto
 * automaticamente in coda se manca (rete di sicurezza).
 */
export const ALLOWED_TIEBREAKERS_BY_TYPE: Readonly<
  Record<CompetitionType, readonly TiebreakerCriterion[]>
> = {
  campionato: [
    "scontri_diretti",
    "differenza_reti",
    "gol_fatti",
    "gol_subiti",
    "punteggio_totale",
    "vittorie",
    "sorteggio",
  ],
  coppa: [], // gestito a livello di singolo match
  battle_royale: [
    "vittorie_totali_match",
    "differenza_reti",
    "gol_fatti",
    "gol_subiti",
    "punteggio_totale",
    "giornate_vinte",
    "sorteggio",
  ],
  sprint_race: ["gol_fatti_giornata", "punteggio_totale_storico", "sorteggio"],
  formula_uno: [
    "f1_vittorie",
    "f1_podi",
    "punteggio_totale",
    "punteggio_max_giornata",
    "sorteggio",
  ],
  punteggio_assoluto: ["giornate_vinte", "punteggio_max_giornata", "sorteggio"],
};

/** Valida che un tiebreaker sia applicabile al tipo. */
export function isValidTiebreaker(
  type: CompetitionType,
  criterion: TiebreakerCriterion,
): boolean {
  if (criterion === "sorteggio") return true;
  return ALLOWED_TIEBREAKERS_BY_TYPE[type].includes(criterion);
}

// ============================================================
// SUB-CONFIG PER TIPO (uno solo popolato per riga in `config`)
// ============================================================

/**
 * Campionato a girone all'italiana, ripetuto N volte sul calendario.
 *
 * Esempio classico per 8 manager:
 *   giornatePerGirone = 7 (n-1)
 *   numeroGironi      = 5
 *   → totale 35 giornate fanta su 38 di Serie A
 *
 * Per ogni girone si può sovrascrivere "campo neutro" — utile per il
 * girone numero dispari finale, così non favorisce nessuno.
 */
export interface CampionatoSettings {
  giornatePerGirone: number;
  numeroGironi: number;
  homeAdvantageEnabled: boolean;
  /** Bonus padrone di casa. Default eredita da Federation.rules.homeAdvantage. */
  homeAdvantageBonus: number;
  /** Numeri di girone (1-indexed) giocati in campo neutro. */
  gironeNeutro: number[];
}

/** Coppa a eliminazione diretta. Bracket gestito manualmente dall'admin. */
export interface CoppaSettings {
  twoLegs: boolean;
  /**
   * "penalties": sorteggio fanta come rigori
   * "fanta_extra_time": tempi supplementari simulati (50% voti)
   * "away_goals": gol fuori casa (FIFA l'ha abolita, opzione legacy)
   */
  tieBreakInMatch: "penalties" | "fanta_extra_time" | "away_goals";
  /**
   * Coppie del primo turno definite dall'admin.
   * Es. [["team_a","team_b"],["team_c","team_d"]]
   */
  bracket: [string, string][];
}

/**
 * Battle Royale: ogni manager gioca N-1 partite per giornata, somma punti
 * 0..(3*(N-1)). Cumulativo nella classifica della competizione.
 */
export interface BattleRoyaleSettings {
  /** Di default off (formato simmetrico). */
  homeAdvantageEnabled: boolean;
}

/** Sprint Race: eliminazione del peggiore ogni giornata. */
export interface SprintRaceSettings {
  // Nessuna config oltre ai partecipanti / range giornate / tiebreaker.
  _placeholder?: never;
}

/** Formula 1: punti F1 per posizione di giornata. */
export interface FormulaUnoSettings {
  /**
   * Punti per posizione 1, 2, 3, ... Posizioni oltre la lunghezza ricevono 0.
   * Preset moderno: [25,18,15,12,10,8,6,4,2,1]
   * Preset storico: [10,6,4,3,2,1]
   */
  pointsScale: number[];
}

/** Punteggio Assoluto: somma cumulativa fanta-punteggi. */
export interface PunteggioAssolutoSettings {
  /** Scarto delle N peggiori giornate per ammorbidire la fortuna. */
  excludeWorstNGiornate: number;
}

/** Tutta la sub-config serializzata; solo il campo corrispondente al type è popolato. */
export interface CompetitionConfig {
  campionato?: CampionatoSettings;
  coppa?: CoppaSettings;
  battleRoyale?: BattleRoyaleSettings;
  sprintRace?: SprintRaceSettings;
  formulaUno?: FormulaUnoSettings;
  punteggioAssoluto?: PunteggioAssolutoSettings;
  /** Scoring 3-1-0 per campionato / battle_royale. */
  scoring: {
    win: number;
    draw: number;
    loss: number;
  };
  /** Tiebreaker ordinati dall'admin. `sorteggio` deve sempre essere in coda. */
  tiebreakers: TiebreakerCriterion[];
  /** Premi testuali (no monetario). Es. { "1°": "Cena offerta", "2°": "Cassa di vino" } */
  prizes: Record<string, string>;
  /** Sottoinsieme dei manager della lega. Vuoto = tutti. */
  participantTeamIds: string[];
}

// ============================================================
// TABELLA
// ============================================================

export const competitions = pgTable("competitions", {
  id: text("id").primaryKey(),
  leagueId: text("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  type: competitionTypeEnum("type").notNull(),
  season: integer("season").notNull(),

  /** Range giornate Serie A su cui si svolge la competizione. */
  startGiornata: integer("start_giornata").notNull(),
  endGiornata: integer("end_giornata").notNull(),

  /** Sub-config + scoring + tiebreaker + premi + partecipanti. */
  config: jsonb("config").$type<CompetitionConfig>().notNull(),

  active: boolean("active").notNull().default(true),
  completed: boolean("completed").notNull().default(false),

  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Competition = typeof competitions.$inferSelect;
export type NewCompetition = typeof competitions.$inferInsert;
