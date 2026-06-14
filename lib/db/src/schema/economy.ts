/**
 * Economy — il "libro dei trasferimenti" della cassa di una lega.
 *
 * Ogni movimento è UN trasferimento da un conto a un conto: per costruzione
 * bilancia, nessun euro o FM nasce dal nulla senza una controparte tracciata.
 * È partita doppia semplificata (framing da→a), non contabilità con dare/avere.
 *
 * MODELLO A DUE ZONE + MEMBRANA:
 *   • Zona di gioco (FM): capitale sociale, aste, scambi, rimborsi, prestiti,
 *     comproprietà. Transazioni interne FM↔FM.
 *   • Zona reale (€): cassa dei presidenti, montepremi. Transazioni interne €↔€
 *     (quote, multe, cartellino svincolato, premi).
 *   • Membrana: le DUE sole conversioni €↔FM, "deposit_in" e "cash_out".
 *     Il tasso (fmToEur della valvola) viene stampato sul movimento come
 *     "rate" per l'audit; default 1.0 (1 FM = 1 €) ma configurabile per lega.
 *
 * SALDI DERIVATI (single source of truth, mai memorizzati):
 *   saldo(X) = Σ amountTo dove toAccount=X − Σ amountFrom dove fromAccount=X
 *   (solo movimenti status='confirmed', filtrati per valuta)
 *   • Trasferimento interno: currencyFrom==currencyTo, amountFrom==amountTo, rate=1
 *   • Trasferimento di membrana: currencyFrom!=currencyTo, amountTo = amountFrom * rate
 *
 * GATING:
 *   Tutto attivo solo se leagues.config.economy.realMoneyEnabled.
 *   Le conversioni richiedono anche conversion.<valvola>.enabled.
 *
 * Chiavi conto: "tipo:ownerId" oppure conto di sistema.
 *   fm_capital:{fantaTeamId}  (FM)  — capitale sociale di una squadra
 *   real_cash:{fantaTeamId}   (€)   — cassa del presidente di una squadra
 *   prize_pool:{leagueId}     (€)   — montepremi della lega
 *   fm_system                 (FM)  — emissione/ritiro FM (capitale iniziale, rimborsi)
 *   eur_external              (€)   — banca esterna, fuori dal gioco
 */

import {
  pgTable,
  text,
  integer,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { leagues } from "./leagues";

// ============================================================
// ENUMS
// ============================================================

export const currencyEnum = pgEnum("currency", ["fm", "eur"]);
export type Currency = (typeof currencyEnum.enumValues)[number];

export const economyTxnStatusEnum = pgEnum("economy_txn_status", [
  "pending", // in attesa di conferma admin (valvole con requiresApproval)
  "confirmed", // concorre al saldo
  "voided", // annullato, non concorre al saldo
]);
export type EconomyTxnStatus = (typeof economyTxnStatusEnum.enumValues)[number];

export const economyTxnTypeEnum = pgEnum("economy_txn_type", [
  // --- Zona di gioco (FM ↔ FM) ---
  "initial_capital", // fm_system        -> fm_capital:{team}
  "auction_purchase", // fm_capital:{buyer} -> fm_system (draft) | :{seller} (scambio)
  "trade_payment", // fm_capital:{A}    -> fm_capital:{B}
  "refund_lost_player", // fm_system        -> fm_capital:{team}
  "loan_fee", // fm_capital:{A}    -> fm_capital:{B}
  "co_ownership_payment", // fm_capital:{A}    -> fm_capital:{B}
  // --- Zona reale (€ ↔ €) ---
  "initial_fund", // real_cash:{team} -> prize_pool:{league}
  "entry_fee", // real_cash:{team} -> prize_pool:{league}
  "fine", // real_cash:{team} -> prize_pool:{league}
  "free_agent_card", // real_cash:{team} -> prize_pool:{league}
  "semi_owner_fee", // real_cash:{buyer}-> real_cash:{semiOwner}
  "prize_payout", // prize_pool:{lg}  -> real_cash:{winner}
  // --- Membrana (€ ↔ FM) ---
  "deposit_in", // real_cash:{team} -> fm_capital:{team}
  "cash_out", // fm_capital:{team}-> real_cash:{team}
]);
export type EconomyTxnType = (typeof economyTxnTypeEnum.enumValues)[number];

// ============================================================
// TABELLA
// ============================================================

export const economyTransactions = pgTable("economy_transactions", {
  id: text("id").primaryKey(),
  leagueId: text("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),

  type: economyTxnTypeEnum("type").notNull(),

  /** Conto di origine (es. "fm_capital:ft-abc", "fm_system"). */
  fromAccount: text("from_account").notNull(),
  /** Conto di destinazione (es. "prize_pool:lg-xyz"). */
  toAccount: text("to_account").notNull(),

  /**
   * Valuta dei due estremi. Coincidono per i trasferimenti interni;
   * differiscono SOLO alle valvole di membrana (deposit_in / cash_out).
   */
  currencyFrom: currencyEnum("currency_from").notNull(),
  currencyTo: currencyEnum("currency_to").notNull(),

  /**
   * Importi dei due lati. Coincidono nei trasferimenti interni; alla membrana
   * amountTo = amountFrom * rate. Tenerli entrambi espliciti rende i saldi una
   * semplice somma, senza moltiplicazioni per riga. numeric (non float) per
   * sicurezza monetaria e per i decimali del regolamento (€1,50, mezzi punti,
   * offerta "numero primo + un decimale").
   */
  amountFrom: numeric("amount_from", { precision: 12, scale: 2 }).notNull(),
  amountTo: numeric("amount_to", { precision: 12, scale: 2 }).notNull(),

  /**
   * Tasso applicato (fmToEur della valvola al momento del movimento).
   * 1 per i trasferimenti interni. Stampato sul movimento per audit, così
   * resta storicizzato anche se la config della lega cambia in seguito.
   * numeric a virgola fissa, NON floating point.
   */
  rate: numeric("rate", { precision: 12, scale: 6 }).notNull().default("1"),

  status: economyTxnStatusEnum("status").notNull().default("confirmed"),

  // Riferimenti opzionali, per tracciabilità (nessuna FK forte).
  relatedPlayerId: integer("related_player_id"),
  relatedContractId: text("related_contract_id"),
  relatedMarketEventId: text("related_market_event_id"),

  note: text("note").notNull().default(""),
  /** Utente che ha registrato il movimento (admin o presidente). */
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type EconomyTransaction = typeof economyTransactions.$inferSelect;
export type NewEconomyTransaction = typeof economyTransactions.$inferInsert;
