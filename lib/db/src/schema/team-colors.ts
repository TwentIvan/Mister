import { pgTable, integer, text } from "drizzle-orm/pg-core";

export const teamColors = pgTable("team_colors", {
  teamId: integer("team_id").primaryKey(),
  teamName: text("team_name").notNull(),
  primaryHex: text("primary_hex").notNull(),
  secondaryHex: text("secondary_hex").notNull(),
  textHex: text("text_hex").notNull().default("#FFFFFF"),
  source: text("source"),
});

export type TeamColor = typeof teamColors.$inferSelect;
export type NewTeamColor = typeof teamColors.$inferInsert;
