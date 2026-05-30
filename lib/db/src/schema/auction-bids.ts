/**
 * AuctionBid — una singola offerta in asta.
 *
 * Ogni rilancio crea una nuova riga. Non si cancellano righe per mantenere
 * lo storico completo; offerte annullate (errori admin) usano `valid = false`.
 *
 * L'indice composito su (auction_id, player_id) velocizza le query
 * "storia rilanci per questo player in questa asta".
 */

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { auctions } from "./auctions";
import { fantaTeams } from "./fanta-teams";
import { players } from "./players";

export const auctionBids = pgTable("auction_bids", {
  id: text("id").primaryKey(),

  auctionId: text("auction_id")
    .notNull()
    .references(() => auctions.id, { onDelete: "cascade" }),

  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "restrict" }),

  fantaTeamId: text("fanta_team_id")
    .notNull()
    .references(() => fantaTeams.id, { onDelete: "restrict" }),

  /** Importo offerto in fanta-milioni (FM). Deve essere > 0. */
  amountFm: integer("amount_fm").notNull(),

  /**
   * false = offerta annullata dall'admin (es. rilancio errato).
   * Non cancellare mai righe: servono per audit e ricostruzione storia.
   */
  valid: boolean("valid").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  check("auction_bids_amount_check", sql`${t.amountFm} > 0`),
  index("idx_auction_bids_auction_player").on(t.auctionId, t.playerId),
]);

export type AuctionBid = typeof auctionBids.$inferSelect;
export type NewAuctionBid = typeof auctionBids.$inferInsert;
