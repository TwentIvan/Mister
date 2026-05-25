import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const competitionsTable = pgTable("competitions", {
  id: text("id").primaryKey(),
  leagueId: text("league_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  type: text("type").notNull(),
  season: integer("season").notNull(),
  startGiornata: integer("start_giornata").notNull(),
  endGiornata: integer("end_giornata").notNull(),
  participantTeamIds: jsonb("participant_team_ids").notNull().$type<string[]>().default([]),
  tiebreakers: jsonb("tiebreakers").notNull().$type<string[]>().default([]),
  settings: jsonb("settings").$type<Record<string, unknown>>(),
  active: boolean("active").notNull().default(true),
  completed: boolean("completed").notNull().default(false),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompetitionSchema = createInsertSchema(competitionsTable).omit({ createdAt: true });
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type Competition = typeof competitionsTable.$inferSelect;
