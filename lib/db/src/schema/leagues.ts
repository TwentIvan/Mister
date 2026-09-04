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
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { federations } from "./federations";
import type { FederationRules } from "./federations";
import type { FeatureFlagValues } from "./template-profiles";

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

/**
 * Composizione rosa — solo campi NON denormalizzati.
 * Portieri/Difensori/Centrocampisti/Attaccanti vivono nelle colonne flat
 * roster_p/d/c/a sulla tabella leagues (fonte canonica). Qui restano
 * solo i campi che non hanno colonna flat dedicata.
 */
export interface SquadComposition {
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

/**
 * Regole budget — solo campi NON denormalizzati.
 * Il budget iniziale vive nella colonna flat budget_initial sulla tabella
 * leagues (fonte canonica). Qui restano le regole di gestione.
 */
export interface BudgetRules {
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

// ============================================================
// CASSA / ECONOMIA REALE (€) + FANTAMILIONI (FM)
// ============================================================

/**
 * Valuta di un conto/movimento (definita in economy.ts, qui non serve).
 * - "fm"  = fantamilioni (zona di gioco)
 * - "eur" = euro reali (zona reale)
 */

/** Arrotondamento applicato agli importi. */
export type RoundingRule = "round5_first_decimal" | "standard" | "none";

/**
 * Valvola di conversione tra zona reale (€) e zona di gioco (FM).
 * Disabilitata di default. Le due valvole (in/out) sono indipendenti.
 */
export interface ConversionValve {
  enabled: boolean;
  /**
   * Tasso di conversione: quanti € vale 1 FM. Default 1.0 (1 FM = 1 €).
   * È un parametro di config (number); nei movimenti viene stampato come
   * numeric per la sicurezza monetaria. Consente leghe con cambio != 1:1.
   */
  fmToEur: number;
  /** Importo minimo per operazione. */
  min: number;
  /** Tetto per operazione (null = nessun tetto). */
  max: number | null;
  /** Se true il movimento resta "pending" finché un admin non conferma. */
  requiresApproval: boolean;
  /** Arrotondamento sull'importo. */
  rounding: RoundingRule;
}

/**
 * Sottosistema cassa. Tutto spento di default: una lega "solo gloria"
 * resta identica a oggi. Vive in JSONB dentro LeagueConfig.
 */
export interface EconomyConfig {
  /** Master: se false nessuna cassa, nessun libro, nessuna UI. */
  realMoneyEnabled: boolean;

  /** Le due valvole della membrana — indipendenti. */
  conversion: {
    /** € -> FM: versamento di capitale. */
    depositIn: ConversionValve;
    /** FM -> €: prelievo/incasso di fantamilioni residui. */
    cashOut: ConversionValve;
  };

  /** Importi della zona reale (€). Usati solo se realMoneyEnabled. */
  realAmounts: {
    initialFund: number;
    entryFees: { league: number; cup: number; supercup: number };
    missedLineupFine: { amount: number; freeCount: number };
    freeAgentCardCost: number;
    semiOwnerFee: number;
  };

  /** Parametri della zona di gioco (FM). */
  fmRules: {
    /** Rimborso giocatore perso, frazione del valore, in FM (Reg.26). */
    lostPlayerRefundFraction: number;
    rounding: RoundingRule;
  };
}

/** Aggregato di tutte le config "League-level" serializzate in JSONB. */
export interface LeagueConfig {
  squad: SquadComposition;
  captain: CaptainRules;
  budget: BudgetRules;
  postAcquisitionWindow: PostAcquisitionWindow;
  economy: EconomyConfig;
  /**
   * Sorgente dei prezzi base d'asta e del pool giocatori (T151):
   * null/assente = anagrafica completa (comportamento storico);
   * valorizzato = id del listone importato da cui derivano pool
   * (solo entry matchate e non fuori lista) e basi d'asta (Qt.A).
   */
  priceSourceListoneId?: number | null;
}

// ============================================================
// DEFAULTS
// ============================================================

/** Cassa interamente spenta: le leghe "solo gloria" restano invariate. */
export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  realMoneyEnabled: false,
  conversion: {
    depositIn: { enabled: false, fmToEur: 1.0, min: 1, max: null, requiresApproval: true, rounding: "none" },
    cashOut: { enabled: false, fmToEur: 1.0, min: 1, max: null, requiresApproval: true, rounding: "none" },
  },
  realAmounts: {
    initialFund: 50,
    entryFees: { league: 18, cup: 6, supercup: 1 },
    missedLineupFine: { amount: 5, freeCount: 2 },
    freeAgentCardCost: 1,
    semiOwnerFee: 1.5,
  },
  fmRules: {
    lostPlayerRefundFraction: 0.3333,
    rounding: "round5_first_decimal",
  },
};

export const DEFAULT_LEAGUE_CONFIG: LeagueConfig = {
  squad: {
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
  economy: DEFAULT_ECONOMY_CONFIG,
};

// ============================================================
// TABELLA
// ============================================================

export const leagues = pgTable("leagues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),

  /**
   * Referenza alla Federation (1-a-1, NOT NULL).
   * Ogni lega deve avere una federazione: il POST /leagues la crea
   * automaticamente se non ne viene passata una esistente.
   */
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

  // ── Campi asta live ──────────────────────────────────────────────────────────
  /** Secondi per ogni round d'asta. DEFAULT 8. */
  timerSeconds: integer("timer_seconds").notNull().default(8),

  /** Budget iniziale in fanta-milioni (FM). Denormalizzato da config.budget.initialCredits. */
  budgetInitial: integer("budget_initial"),

  /** Composizione rosa: portieri. Denormalizzato da config.squad.gk. */
  rosterP: integer("roster_p"),
  /** Composizione rosa: difensori. Denormalizzato da config.squad.def. */
  rosterD: integer("roster_d"),
  /** Composizione rosa: centrocampisti. Denormalizzato da config.squad.mid. */
  rosterC: integer("roster_c"),
  /** Composizione rosa: attaccanti. Denormalizzato da config.squad.att. */
  rosterA: integer("roster_a"),

  /**
   * Modalità asta: 'classico' | 'manageriale' | 'manageriale_pro'.
   * Check constraint SQL applicato a livello tabella.
   */
  auctionMode: text("auction_mode"),

  /**
   * Snapshot delle regole federazione congelato all'avvio della prima asta
   * della stagione. Null finché non è avvenuto il freeze.
   * Dopo il freeze, il bid handler usa questi valori — non quelli live della
   * federazione — garantendo invarianza per leghe già avviate.
   */
  snapshotFeatureFlags: jsonb("snapshot_feature_flags").$type<FeatureFlagValues>(),
  snapshotRules: jsonb("snapshot_rules").$type<FederationRules>(),
  snapshotLockedAt: timestamp("snapshot_locked_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  check(
    "leagues_auction_mode_check",
    sql`${t.auctionMode} IS NULL OR ${t.auctionMode} IN ('classico', 'manageriale', 'manageriale_pro')`,
  ),
]);

export type League = typeof leagues.$inferSelect;
export type NewLeague = typeof leagues.$inferInsert;
