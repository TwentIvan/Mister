import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fantaTeamsTable = pgTable("fanta_teams", {
  id: text("id").primaryKey(),
  leagueId: text("league_id").notNull(),
  managerUserId: text("manager_user_id").notNull(),
  name: text("name").notNull(),
  nameAuction: text("name_auction"),
  logoUrl: text("logo_url"),
  creditsRemaining: integer("credits_remaining").notNull().default(500),
  roster: jsonb("roster").notNull().$type<number[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFantaTeamSchema = createInsertSchema(fantaTeamsTable).omit({ createdAt: true });
export type InsertFantaTeam = z.infer<typeof insertFantaTeamSchema>;
export type FantaTeam = typeof fantaTeamsTable.$inferSelect;
