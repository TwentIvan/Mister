import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leaguesTable = pgTable("leagues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  federationId: text("federation_id").notNull(),
  templateId: text("template_id"),
  adminUserId: text("admin_user_id").notNull(),
  coAdminUserIds: jsonb("co_admin_user_ids").notNull().$type<string[]>().default([]),
  maxManagers: integer("max_managers").notNull().default(10),
  season: integer("season").notNull(),
  visibility: text("visibility").notNull().default("private"),
  invitationCode: text("invitation_code"),
  lineupVisibility: text("lineup_visibility").notNull().default("after_deadline"),
  rosterVisibility: text("roster_visibility").notNull().default("always"),
  started: boolean("started").notNull().default(false),
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifyPush: boolean("notify_push").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLeagueSchema = createInsertSchema(leaguesTable).omit({ createdAt: true });
export type InsertLeague = z.infer<typeof insertLeagueSchema>;
export type League = typeof leaguesTable.$inferSelect;
