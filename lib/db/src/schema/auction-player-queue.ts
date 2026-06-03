/**
 * AuctionPlayerQueue — pool ordinato di giocatori per un'asta live.
 *
 * Ogni riga rappresenta un giocatore nella coda di bandita.
 * L'ordine è: P → D → C → A, poi last_name ASC, first_name ASC.
 *
 * Query "prossimo da bandire":
 *   SELECT * FROM auction_player_queue
 *   WHERE auction_id = :id AND status = 'pending'
 *   ORDER BY position ASC LIMIT 1
 */

import {
  pgTable,
  text,
  integer,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { auctions } from "./auctions";
import { players } from "./players";

export const auctionPlayerQueue = pgTable(
  "auction_player_queue",
  {
    id: text("id").primaryKey(),

    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id, { onDelete: "cascade" }),

    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),

    /** Indice 0-based dell'ordine di bandita */
    position: integer("position").notNull(),

    /** pending → sold (aggiudicato) | skipped (saltato) */
    status: text("status").notNull().default("pending"),
  },
  (t) => [
    check(
      "apq_status_check",
      sql`${t.status} IN ('pending', 'sold', 'skipped', 'called')`,
    ),
    unique("uq_apq_auction_player").on(t.auctionId, t.playerId),
    unique("uq_apq_auction_position").on(t.auctionId, t.position),
    index("idx_apq_auction_status_pos").on(t.auctionId, t.status, t.position),
  ],
);

export type AuctionPlayerQueue = typeof auctionPlayerQueue.$inferSelect;
export type NewAuctionPlayerQueue = typeof auctionPlayerQueue.$inferInsert;
