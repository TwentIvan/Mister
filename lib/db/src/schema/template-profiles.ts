import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const templateProfilesTable = pgTable("template_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  complexityLabel: text("complexity_label").notNull(),
  minutesPerWeek: integer("minutes_per_week").notNull(),
  featureFlags: jsonb("feature_flags").notNull().$type<Record<string, unknown>>(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTemplateProfileSchema = createInsertSchema(templateProfilesTable).omit({ createdAt: true, updatedAt: true });
export type InsertTemplateProfile = z.infer<typeof insertTemplateProfileSchema>;
export type TemplateProfile = typeof templateProfilesTable.$inferSelect;
