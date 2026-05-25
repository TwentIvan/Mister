import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketEventsTable = pgTable("market_events", {
  id: text("id").primaryKey(),
  leagueId: text("league_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  type: text("type").notNull(),
  status: text("status").notNull().default("scheduled"),
  windowStartsAt: timestamp("window_starts_at", { withTimezone: true }).notNull(),
  windowEndsAt: timestamp("window_ends_at", { withTimezone: true }).notNull(),
  settings: jsonb("settings").$type<Record<string, unknown>>(),
  labelColor: text("label_color").notNull().default("#1f4733"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMarketEventSchema = createInsertSchema(marketEventsTable).omit({ createdAt: true });
export type InsertMarketEvent = z.infer<typeof insertMarketEventSchema>;
export type MarketEvent = typeof marketEventsTable.$inferSelect;
