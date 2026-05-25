import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const federationsTable = pgTable("federations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  leagueId: text("league_id").notNull(),
  templateId: text("template_id"),
  mode: text("mode").notNull().default("classic"),
  votoSource: text("voto_source").notNull().default("consensus"),
  featureFlags: jsonb("feature_flags").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFederationSchema = createInsertSchema(federationsTable).omit({ createdAt: true, updatedAt: true });
export type InsertFederation = z.infer<typeof insertFederationSchema>;
export type Federation = typeof federationsTable.$inferSelect;
