/**
 * Template Profile — preset di partenza per la creazione di una Lega.
 *
 * I tre profili Classico/Esploratore/Manageriale vivono come righe in questa
 * tabella, non come costanti del codice, perché il superadmin (Ivan, owner
 * del prodotto) può tarare i valori, aggiungere nuovi template, disattivarli.
 *
 * Quando un admin crea una Lega scegliendo un template:
 *   1. Il sistema legge feature_flags + suggested_markets + suggested_competitions
 *   2. Li COPIA dentro la nuova Federation (snapshot)
 *   3. Da quel momento la lega è autonoma — modifiche al template
 *      NON impattano leghe esistenti
 *
 * Vedi seeds/templates.ts per i tre seed di sistema.
 */

import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import type { FlagKey, FlagValue } from "../flags";

// ============================================================
// TIPI DI SUPPORTO (serializzati come JSONB)
// ============================================================

/** Suggerimento di evento di mercato che il template propone in onboarding. */
export interface MarketEventTemplate {
  name: string;
  type: "auction" | "trade" | "release" | "free_agent";
  /** Sub-modalità: opzionale, dipende dal type */
  mode?: "live" | "async" | "blind" | "token" | "open";
  /** Suggerimento testuale per l'admin, es. "metà agosto" o "30 gen - 2 feb" */
  windowHint: string;
  description: string;
}

/** Suggerimento di competizione che il template propone in onboarding. */
export interface CompetitionSuggestion {
  name: string;
  type:
    | "campionato"
    | "coppa"
    | "battle_royale"
    | "sprint_race"
    | "formula_uno"
    | "punteggio_assoluto";
  description: string;
}

/**
 * Map dei valori dei feature flag per questo template.
 *
 * Le chiavi sono le `key` definite nel catalogo `flags.ts`. I valori non
 * specificati qui assumono il defaultValue dal catalogo.
 */
export type FeatureFlagValues = Partial<Record<FlagKey, FlagValue>>;

// ============================================================
// TABELLA
// ============================================================

export const templateProfiles = pgTable("template_profiles", {
  /** Slug univoco, es. "classico", "esploratore", "manageriale" */
  id: text("id").primaryKey(),

  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),

  /** 1 = base, 3 = full. Determina l'ordine nel selettore di onboarding. */
  complexityLevel: integer("complexity_level").notNull(),

  /** Tempo stimato di gestione settimanale per il manager. */
  estimatedWeeklyMinutes: integer("estimated_weekly_minutes").notNull(),

  /** Identificatore icona per UI, es. "ball-football" / "compass" / "briefcase". */
  icon: text("icon").notNull().default(""),

  /** Valori dei feature flag per questo template. */
  featureFlags: jsonb("feature_flags").$type<FeatureFlagValues>().notNull(),

  /** Eventi di mercato suggeriti all'admin in onboarding. */
  suggestedMarkets: jsonb("suggested_markets")
    .$type<MarketEventTemplate[]>()
    .notNull()
    .default([]),

  /** Competizioni suggerite all'admin in onboarding. */
  suggestedCompetitions: jsonb("suggested_competitions")
    .$type<CompetitionSuggestion[]>()
    .notNull()
    .default([]),

  /**
   * NULL per template di sistema (creati dal seed),
   * user_id per template creati dal superadmin via pannello.
   */
  authorUserId: text("author_user_id"),

  /**
   * Template di sistema: non possono essere cancellati, solo disattivati.
   * Il superadmin può modificarne i valori ma non eliminarli.
   */
  isSystem: boolean("is_system").notNull().default(false),

  /** Se false, il template è nascosto dal selettore di onboarding. */
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TemplateProfile = typeof templateProfiles.$inferSelect;
export type NewTemplateProfile = typeof templateProfiles.$inferInsert;
