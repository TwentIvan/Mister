/**
 * Auction — una sessione d'asta live legata a una Lega.
 *
 * Una Lega può avere più aste nel tempo (es. asta iniziale, aste di riparazione).
 * Lo stato segue la macchina: setup → running → (paused)* → completed | cancelled.
 *
 * Le offerte sono in `auction_bids`; le aggiudicazioni finali in
 * `auction_assignments`. I contracts vengono creati SOLO dopo l'aggiudicazione,
 * non durante l'asta.
 */

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { leagues } from "./leagues";

export const auctions = pgTable("auctions", {
  id: text("id").primaryKey(),

  leagueId: text("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),

  /**
   * Stato corrente dell'asta.
   * setup      — configurata ma non ancora avviata
   * running    — in corso
   * paused     — sospesa temporaneamente dall'admin
   * completed  — terminata con tutte le aggiudicazioni
   * cancelled  — annullata (nessuna aggiudicazione prodotta)
   */
  status: text("status").notNull().default("setup"),

  /** Durata del rilancio in secondi (range 5-30). Default 8. */
  timerSeconds: integer("timer_seconds").notNull().default(8),

  /** Composizione rosa: slot per ruolo. Default classico 3/8/8/6. */
  rosterP: integer("roster_p").notNull().default(3),
  rosterD: integer("roster_d").notNull().default(8),
  rosterC: integer("roster_c").notNull().default(8),
  rosterA: integer("roster_a").notNull().default(6),

  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  /**
   * Deadline assoluta del rilancio corrente (server-authoritative).
   * Impostata dal server a now + timer_seconds su ogni bid riuscito.
   * Azzerata (null) su assign/skip/call/undo/pausa.
   */
  deadlineTs: timestamp("deadline_ts", { withTimezone: true }),

  /**
   * Ms residui del timer al momento della pausa.
   * Usati da /resume per ripristinare la deadline senza perdere il tempo rimasto.
   */
  pausedRemainingMs: integer("paused_remaining_ms").notNull().default(0),

  /**
   * Marca "azione annullabile presente".
   * Impostata a 'bid'/'skip'/'assign' dopo ogni azione; azzerata (null)
   * dopo un undo. Il backend rifiuta /undo se null — protezione server-side
   * contro doppio-undo indipendentemente dal client.
   */
  lastUndoableAction: text("last_undoable_action"),

  /**
   * Modalità di avanzamento dell'asta.
   * 'listone'  — sequenziale automatico (comportamento classico)
   * 'chiamata' — il banditore chiama esplicitamente ogni giocatore
   */
  callMode: text("call_mode").notNull().default("listone"),

  /**
   * Se true (solo in callMode='chiamata'), i giocatori si chiamano
   * rispettando l'ordine di ruolo P → D → C → A.
   */
  roleOrder: boolean("role_order").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  check(
    "auctions_status_check",
    sql`${t.status} IN ('setup', 'running', 'paused', 'completed', 'cancelled')`,
  ),
  check(
    "auctions_call_mode_check",
    sql`${t.callMode} IN ('listone', 'chiamata')`,
  ),
]);

export type Auction = typeof auctions.$inferSelect;
export type NewAuction = typeof auctions.$inferInsert;
