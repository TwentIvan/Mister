/**
 * MarketEvent — un evento di mercato schedulato dentro una Lega.
 *
 * L'admin crea esplicitamente ogni evento. Il TemplateProfile suggerisce
 * un calendario di partenza in onboarding, ma è solo facilitation:
 * l'admin accetta/rifiuta ogni suggerimento, e in qualunque momento
 * può aggiungere nuovi eventi.
 *
 * Quattro tipi canonici che mappano le 7 modalità di Leghe Fantacalcio
 * in una tassonomia più chiara:
 *
 * | Mister                       | Mappa a LF                 |
 * |------------------------------|----------------------------|
 * | auction (mode=live)          | Asta Classica              |
 * | auction (mode=async)         | Asta Smart                 |
 * | auction (mode=blind)         | Asta a Buste               |
 * | auction (mode=token)         | A Gettone                  |
 * | trade                        | Scambi                     |
 * | release (mode=open)          | Svincoli                   |
 * | release (mode=blind)         | Svincoli al Buio           |
 * | free_agent                   | (non in LF, pool permanente) |
 */

import {
  pgTable,
  text,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { leagues } from "./leagues";

// ============================================================
// ENUMS
// ============================================================

export const marketTypeEnum = pgEnum("market_type", [
  "auction",
  "trade",
  "release",
  "free_agent",
]);
export type MarketType = (typeof marketTypeEnum.enumValues)[number];

export const marketStatusEnum = pgEnum("market_status", [
  "scheduled",
  "active",
  "completed",
  "cancelled",
]);
export type MarketStatus = (typeof marketStatusEnum.enumValues)[number];

export type AuctionMode = "live" | "async" | "blind" | "token";
export type ReleaseMode = "open" | "blind";
export type PlayerRole = "GK" | "DEF" | "MID" | "ATT";

// ============================================================
// SUB-MODELS COMUNI
// ============================================================

/** Anti-snipe: estende la scadenza su rilanci dell'ultimo minuto. */
export interface TimeshiftRule {
  enabled: boolean;
  thresholdSeconds: number;
  extensionSeconds: number;
}

/** Autobid con soglia max o strategia AI delegata. */
export interface AutobidRule {
  enabled: boolean;
  allowAiStrategy: boolean;
  visibleMaxToOthers: boolean;
}

// ============================================================
// AUCTION
// ============================================================

export interface AuctionRules {
  mode: AuctionMode;
  rolePool: PlayerRole[];
  /** Null/undefined = tutti i giocatori Serie A */
  playerPool?: number[];
  baseBid: number;
  bidIncrements: number[];
  secondsPerPlayer: number;
  timeshift: TimeshiftRule;
  autobid: AutobidRule;
  showBestBidder: boolean;

  // Solo per mode="live"
  voiceRecognition: boolean;
  auctioneerAi: boolean;

  // Solo per mode="blind"
  bidsPerPlayer: number;
  revealAllAfter: boolean;

  // Solo per mode="token"
  tokensPerManager?: number;

  /**
   * Diritto di pareggio del detentore uscente.
   * Effettivo solo se Federation.featureFlags.preemption_right è true E
   * il giocatore è in scadenza contratto.
   */
  allowPreemption: boolean;
}

// ============================================================
// TRADE
// ============================================================

export interface TradeRules {
  bilateralOnly: boolean;
  includeCredits: boolean;
  requiresAdminApproval: boolean;
  coolDownDays: number;
  maxPerManager?: number;
}

// ============================================================
// RELEASE
// ============================================================

export interface ReleaseRules {
  mode: ReleaseMode;
  /** Percentuale del prezzo/residuo recuperata dal manager. */
  recoveryPercentage: number;
  maxReleasesPerManager?: number;
  blockRebuy: boolean;
  rebuyCooldownDays: number;
  blindCompetingBids: boolean;
  /**
   * Se true e il giocatore ha contratto pluriennale, applica la penale
   * di rescissione (richiede Federation.featureFlags.rescission_penalty).
   */
  applyRescissionPenalty: boolean;
}

// ============================================================
// FREE AGENT
// ============================================================

export interface FreeAgentRules {
  basePricePerRole: Record<PlayerRole, number>;
  allowBlindCompeting: boolean;
  waitingPeriodHours: number;
  /**
   * Se true include anche giocatori svincolati attivamente da altri
   * manager. Se false, solo non-acquistati all'asta iniziale (Classico).
   */
  includeRescindedPlayers: boolean;
}

// ============================================================
// MARKET EVENT CONFIG (solo il campo corrispondente al type è popolato)
// ============================================================

export interface MarketEventConfig {
  auction?: AuctionRules;
  trade?: TradeRules;
  release?: ReleaseRules;
  freeAgent?: FreeAgentRules;
  labelColor: string;
}

// ============================================================
// TABELLA
// ============================================================

export const marketEvents = pgTable("market_events", {
  id: text("id").primaryKey(),
  leagueId: text("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  type: marketTypeEnum("type").notNull(),

  /** Finestra di apertura/chiusura. open_24h si gestisce in config se serve. */
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

  status: marketStatusEnum("status").notNull().default("scheduled"),

  config: jsonb("config").$type<MarketEventConfig>().notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MarketEvent = typeof marketEvents.$inferSelect;
export type NewMarketEvent = typeof marketEvents.$inferInsert;
