import { pgTable, serial, integer, text, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { lineups } from "./lineups";
import { players } from "./players";

export const lineupPlayers = pgTable("lineup_players", {
  id: serial("id").primaryKey(),
  lineupId: integer("lineup_id").notNull().references(() => lineups.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => players.id),
  slotPosition: text("slot_position").notNull(),
  slotIndex: integer("slot_index").notNull(),
  isStarter: boolean("is_starter").notNull(),
  benchOrder: integer("bench_order"),
}, (table) => ({
  uniqueSlot: uniqueIndex("lineup_unique_slot").on(table.lineupId, table.slotIndex),
}));

export type LineupPlayer = typeof lineupPlayers.$inferSelect;
export type NewLineupPlayer = typeof lineupPlayers.$inferInsert;
