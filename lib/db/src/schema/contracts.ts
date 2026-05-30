/**
 * Contract — il legame contrattuale Manager ↔ Giocatore.
 *
 * Rilevante solo per leghe con federation.featureFlags.multi_season_contracts
 * true (Esploratore e Manageriale di default). Per Classico non si creano
 * Contract: i giocatori sono "una sola stagione" e basta.
 *
 * MATEMATICA CHIAVE:
 *   • ingaggioAnnuo = purchasePrice / durationSeasons (ammortamento lineare)
 *   • ammortamentoResiduo = ingaggioAnnuo * stagioniRimanenti
 *   • clausolaDefault = ammortamentoResiduo * clause_default_factor (es. 0.8)
 *   • clausolaEffettiva = clausolaDefault + clauseInvestment (alzata pagando)
 *   • penaleRescissione = ammortamentoResiduo * coefficient_for_year_X
 *
 * LIFECYCLE:
 *   1. Asta: giocatore aggiudicato a prezzo P
 *   2. Finestra post-aggiudicazione: manager sceglie durata N e clausola
 *   3. Contract creato con state='active'
 *   4. Ogni inizio stagione, ingaggioAnnuo scalato dal budget
 *   5. A scadenza naturale: state='expired', giocatore va all'asta come
 *      svincolato (con diritto di pareggio del detentore se preemption_right)
 *   6. Rescissione attiva del manager: state='rescinded', applica penale
 *   7. Pagamento clausola da altro manager: state='clause_paid',
 *      vecchio manager incassa, nuovo apre Contract nuovo
 */

import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { leagues } from "./leagues";
import { fantaTeams } from "./fanta-teams";

// ============================================================
// ENUMS
// ============================================================

export const contractStateEnum = pgEnum("contract_state", [
  "active",
  "expired",
  "rescinded",
  "clause_paid",
  "traded",
]);
export type ContractState = (typeof contractStateEnum.enumValues)[number];

// ============================================================
// TABELLA
// ============================================================

export const contracts = pgTable("contracts", {
  id: text("id").primaryKey(),
  leagueId: text("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  fantaTeamId: text("fanta_team_id")
    .notNull()
    .references(() => fantaTeams.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull(),

  // Termini del contratto
  /** Stagione in cui parte il contratto, es. 2025 */
  seasonStart: integer("season_start").notNull(),
  durationSeasons: integer("duration_seasons").notNull(),
  /** Prezzo pagato all'asta in crediti */
  purchasePrice: integer("purchase_price").notNull(),

  // Clausola
  /** Default fissato alla firma: ammortamento residuo × clause_default_factor */
  clauseDefault: integer("clause_default").notNull(),
  /**
   * Crediti aggiuntivi pagati dal manager per alzare la clausola
   * sopra il default. 1:1 al momento del contratto.
   */
  clauseInvestment: integer("clause_investment").notNull().default(0),

  state: contractStateEnum("state").notNull().default("active"),

  /**
   * Prezzo pagato in asta in fanta-milioni (FM).
   * NULL per i contracts seedati pre-asta (semanticamente corretto:
   * il prezzo è sconosciuto perché non sono stati aggiudicati tramite asta).
   * Valorizzato post-aggiudicazione dal flusso auction_assignments → contracts.
   */
  purchasePriceFm: integer("purchase_price_fm"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),

  /** Storia per audit + UI. Lista di stringhe testuali, oppure più strutturato a bisogno. */
  notes: jsonb("notes").$type<string[]>().notNull().default([]),
});

export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;

// ============================================================
// HELPERS DI CALCOLO
// ============================================================

/** Quota annuale di ammortamento. */
export function ingaggioAnnuo(c: Pick<Contract, "purchasePrice" | "durationSeasons">): number {
  return c.purchasePrice / c.durationSeasons;
}

/** Stagioni rimanenti (incluso quella corrente se attivo). */
export function seasonsRemaining(
  c: Pick<Contract, "seasonStart" | "durationSeasons">,
  currentSeason: number,
): number {
  const seasonsPassed = currentSeason - c.seasonStart;
  return Math.max(0, c.durationSeasons - seasonsPassed);
}

/** Crediti residui da ammortizzare. */
export function ammortamentoResiduo(
  c: Pick<Contract, "purchasePrice" | "durationSeasons" | "seasonStart">,
  currentSeason: number,
): number {
  return ingaggioAnnuo(c) * seasonsRemaining(c, currentSeason);
}

/**
 * Clausola effettiva = (residuo × factor) + investimento del manager.
 * Cala col tempo (residuo decrescente), a meno che il manager abbia
 * investito per alzarla.
 *
 * `clauseDefaultFactor` arriva da Federation.featureFlags.clause_default_factor.
 */
export function clausolaEffettiva(
  c: Pick<
    Contract,
    "purchasePrice" | "durationSeasons" | "seasonStart" | "clauseInvestment"
  >,
  currentSeason: number,
  clauseDefaultFactor: number,
): number {
  const residuo = ammortamentoResiduo(c, currentSeason);
  return residuo * clauseDefaultFactor + c.clauseInvestment;
}

/**
 * Penale per rescissione attiva del manager.
 *
 * I coefficienti sono indicizzati per anno (1-based) di contratto:
 *   coefficients[0] = anno 1, coefficients[1] = anno 2, ...
 *
 * Esempio: [1.5, 1.3, 1.1, 1.0, 1.0] su contratto 5-anni:
 *   rescissione anno 1 → ammortamentoResiduo × 1.5
 *   rescissione anno 2 → ammortamentoResiduo × 1.3
 *   ...
 */
export function rescissionPenalty(
  c: Pick<Contract, "purchasePrice" | "durationSeasons" | "seasonStart">,
  currentSeason: number,
  coefficients: number[],
): number {
  const yearInContract = currentSeason - c.seasonStart + 1;
  const idx = Math.min(yearInContract - 1, coefficients.length - 1);
  const coeff = coefficients[idx] ?? 1.0;
  return ammortamentoResiduo(c, currentSeason) * coeff;
}

/** Default dei coefficienti penale per contratto da 5 anni (1.5x → 1.0x). */
export const DEFAULT_RESCISSION_COEFFICIENTS: readonly number[] = [
  1.5, 1.3, 1.1, 1.0, 1.0,
];
