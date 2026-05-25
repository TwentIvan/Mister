/**
 * League — l'istanza di una Lega fantacalcio.
 *
 * Una League appartiene a una Federation (1-a-1: cascade). La Federation
 * contiene il regolamento sportivo + i feature flags. La League contiene
 * il resto: chi sono i manager, quanti crediti partono, composizione rosa,
 * regole capitano, visibilità, calendario.
 *
 * `templateId` è denormalizzato qui per UI/analytics rapide — la fonte
 * di verità del template di origine è `federations.templateId`.
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
import { federations } from "./federations";

// ============================================================
// ENUMS
// ============================================================

export const visibilityEnum = pgEnum("league_visibility", [
  "private",
  "public",
  "unlisted",
]);
export type LeagueVisibility = (typeof visibilityEnum.enumValues)[number];

export const lineupVisibilityEnum = pgEnum("lineup_visibility", [
  "always",
  "after_deadline",
  "hidden_all_season",
]);
export type LineupVisibility = (typeof lineupVisibilityEnum.enumValues)[number];

// ============================================================
// TIPI DI SUPPORTO (serializzati come JSONB in `config`)
// ============================================================

/** Composizione rosa. */
export interface SquadComposition {
  /** Portieri */
  gk: number;
  /** Difensori */
  def: number;
  /** Centrocampisti */
  mid: number;
  /** Attaccanti */
  att: number;
  /** Totale titolari schierati per giornata (tipicamente 11) */
  startersTotal: number;
  /** Moduli ammessi nella lega, es. ["3-4-3", "4-3-3", "4-4-2"] */
  allowedModules: string[];
}

/** Regole capitano. */
export interface CaptainRules {
  enabled: boolean;
  /** 1.0 = simbolico (default). 1.5 = generoso. >2.0 sbilancia. */
  multiplier: number;
  useVice: boolean;
}

/** Crediti d'asta e regole di gestione budget. */
export interface BudgetRules {
  initialCredits: number;
  minimumBid: number;
  allowNegativeBalance: boolean;
  reserveForUnfilledRoles: boolean;
}

/**
 * Finestra di decisione contratto + clausola dopo l'aggiudicazione di un
 * giocatore. Applicabile solo se il template ha multi_season_contracts=on.
 */
export interface PostAcquisitionWindow {
  enabled: boolean;
  /** Quanti secondi in asta live */
  liveSeconds: number;
  /** Quante ore in asta async */
  asyncHours: number;
  /** Se il manager non decide entro la finestra, assegna questo numero di anni */
  defaultContractYears: number;
  defaultClauseAction: "leave_default" | "decline";
}

/** Aggregato di tutte le config "League-level" serializzate in JSONB. */
export interface LeagueConfig {
  squad: SquadComposition;
  captain: CaptainRules;
  budget: BudgetRules;
  postAcquisitionWindow: PostAcquisitionWindow;
}

// ============================================================
// DEFAULTS
// ============================================================

export const DEFAULT_LEAGUE_CONFIG: LeagueConfig = {
  squad: {
    gk: 3,
    def: 8,
    mid: 8,
    att: 6,
    startersTotal: 11,
    allowedModules: [
      "3-4-3",
      "3-5-2",
      "4-3-3",
      "4-4-2",
      "4-5-1",
      "5-3-2",
      "5-4-1",
    ],
  },
  captain: {
    enabled: true,
    multiplier: 1.0,
    useVice: true,
  },
  budget: {
    initialCredits: 500,
    minimumBid: 1,
    allowNegativeBalance: false,
    reserveForUnfilledRoles: true,
  },
  postAcquisitionWindow: {
    enabled: true,
    liveSeconds: 45,
    asyncHours: 12,
    defaultContractYears: 1,
    defaultClauseAction: "leave_default",
  },
};

// ============================================================
// TABELLA
// ============================================================

export const leagues = pgTable("leagues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),

  /** Referenza alla Federation (1-a-1). */
  federationId: text("federation_id")
    .notNull()
    .references(() => federations.id, { onDelete: "cascade" }),

  /** Slug del template di origine. Denormalizzato per UI rapide. */
  templateId: text("template_id"),

  visibility: visibilityEnum("visibility").notNull().default("private"),
  invitationCode: text("invitation_code").unique(),

  maxManagers: integer("max_managers").notNull().default(10),
  adminUserId: text("admin_user_id").notNull(),
  coAdminUserIds: jsonb("co_admin_user_ids")
    .$type<string[]>()
    .notNull()
    .default([]),

  /** Config rose/capitano/budget/finestra post-asta serializzato. */
  config: jsonb("config").$type<LeagueConfig>().notNull(),

  lineupVisibility: lineupVisibilityEnum("lineup_visibility")
    .notNull()
    .default("after_deadline"),
  rosterVisibility: lineupVisibilityEnum("roster_visibility")
    .notNull()
    .default("always"),

  /** Stagione, es. 2025 per la stagione 2025-26. */
  season: integer("season").notNull(),

  started: boolean("started").notNull().default(false),

  notifyEmail: boolean("notify_email").notNull().default(true),
  notifyPush: boolean("notify_push").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type League = typeof leagues.$inferSelect;
export type NewLeague = typeof leagues.$inferInsert;
