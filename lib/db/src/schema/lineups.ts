import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { fantaTeams } from "./fanta-teams";
import { players } from "./players";

export const lineups = pgTable("lineups", {
  id: serial("id").primaryKey(),
  fantaTeamId: text("fanta_team_id").notNull().references(() => fantaTeams.id, { onDelete: "cascade" }),
  season: integer("season").notNull(),
  round: integer("round").notNull(),
  module: text("module").notNull(),
  captainPlayerId: integer("captain_player_id").references(() => players.id),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
}, (table) => ({
  uniqueRound: uniqueIndex("lineup_one_per_team_round").on(table.fantaTeamId, table.season, table.round),
}));

export type Lineup = typeof lineups.$inferSelect;
export type NewLineup = typeof lineups.$inferInsert;
