import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contractsTable = pgTable("contracts", {
  id: text("id").primaryKey(),
  leagueId: text("league_id").notNull(),
  fantaTeamId: text("fanta_team_id").notNull(),
  playerId: integer("player_id").notNull(),
  seasonStart: integer("season_start").notNull(),
  durationSeasons: integer("duration_seasons").notNull(),
  purchasePrice: integer("purchase_price").notNull(),
  clauseDefault: integer("clause_default").notNull(),
  clauseInvestment: integer("clause_investment").notNull().default(0),
  state: text("state").notNull().default("active"),
  notes: jsonb("notes").notNull().$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const insertContractSchema = createInsertSchema(contractsTable).omit({ createdAt: true });
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contractsTable.$inferSelect;
