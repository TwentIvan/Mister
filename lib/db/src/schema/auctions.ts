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
   * Marca "azione annullabile presente".
   * Impostata a 'bid'/'skip'/'assign' dopo ogni azione; azzerata (null)
   * dopo un undo. Il backend rifiuta /undo se null — protezione server-side
   * contro doppio-undo indipendentemente dal client.
   */
  lastUndoableAction: text("last_undoable_action"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  check(
    "auctions_status_check",
    sql`${t.status} IN ('setup', 'running', 'paused', 'completed', 'cancelled')`,
  ),
]);

export type Auction = typeof auctions.$inferSelect;
export type NewAuction = typeof auctions.$inferInsert;
