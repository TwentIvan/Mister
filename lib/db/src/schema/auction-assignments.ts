/**
 * AuctionAssignment — aggiudicazione finale di un giocatore in asta.
 *
 * Una riga per ogni giocatore aggiudicato. Il vincolo UNIQUE su
 * (auction_id, player_id) garantisce che un giocatore sia assegnato
 * al massimo una volta per asta.
 *
 * Dopo la creazione di questo record, il flusso post-asta crea il
 * Contract corrispondente con purchase_price_fm = final_price_fm.
 */

import {
  pgTable,
  text,
  integer,
  timestamp,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { auctions } from "./auctions";
import { fantaTeams } from "./fanta-teams";
import { players } from "./players";

export const auctionAssignments = pgTable("auction_assignments", {
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

  /** Prezzo finale pagato all'aggiudicazione in fanta-milioni (FM). */
  finalPriceFm: integer("final_price_fm").notNull(),

  assignedAt: timestamp("assigned_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  check("auction_assignments_price_check", sql`${t.finalPriceFm} > 0`),
  unique("uq_auction_assignment_player").on(t.auctionId, t.playerId),
]);

export type AuctionAssignment = typeof auctionAssignments.$inferSelect;
export type NewAuctionAssignment = typeof auctionAssignments.$inferInsert;
