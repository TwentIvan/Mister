import { pgTable, text, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  realTeam: text("real_team").notNull(),
  birthDate: text("birth_date"),
  nationality: text("nationality"),
  heightCm: integer("height_cm"),
  weightKg: integer("weight_kg"),
  foot: text("foot"),
  roleClassic: text("role_classic").notNull(),
  rolesMantra: jsonb("roles_mantra").notNull().$type<string[]>().default([]),
  injured: boolean("injured").notNull().default(false),
  photoUrl: text("photo_url"),
});

export const insertPlayerSchema = createInsertSchema(playersTable);
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
