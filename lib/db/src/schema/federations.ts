/**
 * Federation — il regolamento sportivo + feature flags di UNA Lega.
 *
 * La Federation contiene due cose: il calcolo (bonus/soglie/modificatori,
 * tabella difesa, modificatore centrocampo, vantaggio campo) E i feature
 * flags risolti (snapshot del template di origine).
 *
 * SNAPSHOT, NON RIFERIMENTO LIVE: al momento della creazione della Lega,
 * i feature flag vengono copiati dal TemplateProfile scelto. Da quel momento
 * la Federation è autonoma. Cambi al template non impattano leghe esistenti.
 *
 * IMPORTANTE: NON c'è una "voto_source" configurabile. I voti sono calcolati
 * dall'algoritmo proprietario Mister sui dati grezzi API-Football. Mai
 * aggiungere `voto_source` alla tabella.
 */

import { pgTable, text, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import type { FeatureFlagValues } from "./template-profiles";

// ============================================================
// ENUMS
// ============================================================

export const gameModeEnum = pgEnum("game_mode", ["classic", "mantra"]);
export type GameMode = (typeof gameModeEnum.enumValues)[number];

// ============================================================
// TIPI DI SUPPORTO (serializzati come JSONB in `rules`)
// ============================================================

/** Tabella bonus/malus per evento. Valori in fanta-punti. */
export interface BonusMalus {
  goalAtt: number;
  goalMid: number;
  goalDef: number;
  goalGk: number;
  assist: number;
  keyPassChain: number;
  penaltySaved: number;
  cleanSheetGk: number;
  goalConcededGk: number;
  penaltyScored: number;
  penaltyMissed: number;
  yellow: number;
  red: number;
  ownGoal: number;
  goalConcededDef: number;
}

/** Conversione punteggio squadra → fanta-gol. */
export interface GoalThresholds {
  /** Punteggio minimo per il primo gol */
  base: number;
  /** Incremento per i gol successivi */
  step: number;
  /** Tetto massimo gol/giornata */
  maxGoals: number;
}

/** Modificatore difesa: media voto centrali → bonus al totale. */
export interface DefenseModifier {
  enabled: boolean;
  useFullDefense: boolean;
  /** Chiavi tipo "<=5.0", "5.0-5.5", "5.5-6.0", ..., ">7.5" */
  table: Record<string, number>;
}

/** Modificatore centrocampo (analogo al modificatore difesa). */
export interface MidfieldModifier {
  enabled: boolean;
  table: Record<string, number>;
}

/**
 * Bonus al fanta-punteggio del padrone di casa.
 * Applicato PRIMA della conversione in gol via GoalThresholds.
 * Default qui è il "consigliato Federation", le Competizioni possono override.
 */
export interface HomeAdvantage {
  enabled: boolean;
  bonusPoints: number;
}

/** Sostituzioni automatiche per titolari senza voto. */
export interface SubstitutionRules {
  autoSubstitution: boolean;
  maxAutoSubs: number;
  fallbackNoVote: "sv_zero" | "exclude" | "average";
}

/** Tutte le regole di calcolo, serializzate come JSONB. */
export interface FederationRules {
  bonusMalus: BonusMalus;
  goalThresholds: GoalThresholds;
  defenseModifier: DefenseModifier;
  midfieldModifier: MidfieldModifier;
  homeAdvantage: HomeAdvantage;
  substitutions: SubstitutionRules;
}

// ============================================================
// DEFAULTS
// ============================================================

export const DEFAULT_RULES: FederationRules = {
  bonusMalus: {
    goalAtt: 3.0,
    goalMid: 3.5,
    goalDef: 4.0,
    goalGk: 6.0,
    assist: 1.0,
    keyPassChain: 0.5,
    penaltySaved: 3.0,
    cleanSheetGk: 1.0,
    goalConcededGk: -1.0,
    penaltyScored: 3.0,
    penaltyMissed: -3.0,
    yellow: -0.5,
    red: -1.0,
    ownGoal: -2.0,
    goalConcededDef: 0.0,
  },
  goalThresholds: {
    base: 66,
    step: 6,
    maxGoals: 8,
  },
  defenseModifier: {
    enabled: true,
    useFullDefense: false,
    table: {
      "<=5.0": -1.0,
      "5.0-5.5": -0.5,
      "5.5-6.0": 0.0,
      "6.0-6.5": 1.0,
      "6.5-7.0": 3.0,
      "7.0-7.5": 5.0,
      ">7.5": 6.0,
    },
  },
  midfieldModifier: {
    enabled: false,
    table: {
      "<=5.5": -0.5,
      "5.5-6.0": 0.0,
      "6.0-6.5": 1.0,
      "6.5-7.0": 2.0,
      ">7.0": 3.0,
    },
  },
  homeAdvantage: {
    enabled: true,
    bonusPoints: 3.0,
  },
  substitutions: {
    autoSubstitution: true,
    maxAutoSubs: 3,
    fallbackNoVote: "sv_zero",
  },
};

// ============================================================
// TABELLA
// ============================================================

export const federations = pgTable("federations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),

  /**
   * Slug del TemplateProfile da cui è stata generata. Analytics-only:
   * NON viene letto a runtime, la Federation è autonoma dal template.
   */
  templateId: text("template_id"),

  /** Classico (lista posizione GK/DEF/MID/ATT) vs Mantra (ruoli mantra estesi). */
  mode: gameModeEnum("mode").notNull().default("classic"),

  /**
   * Snapshot dei feature flag al momento della creazione della Lega.
   * Le chiavi sono i 18 flag in `flags.ts`. Cambi a template profiles non
   * modificano questo campo.
   */
  featureFlags: jsonb("feature_flags").$type<FeatureFlagValues>().notNull(),

  /**
   * Tutte le regole di calcolo (bonus, soglie, modificatori).
   * Default in DEFAULT_RULES; l'admin può modificare in "modalità avanzata".
   */
  rules: jsonb("rules").$type<FederationRules>().notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Federation = typeof federations.$inferSelect;
export type NewFederation = typeof federations.$inferInsert;
