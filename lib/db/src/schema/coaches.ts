import {
  pgTable,
  integer,
  text,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

export const coaches = pgTable("coaches", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  firstname: text("firstname"),
  lastname: text("lastname"),
  photoUrl: text("photo_url"),
  photoCartoonUrl: text("photo_cartoon_url"),
  nationality: text("nationality"),
  birthDate: date("birth_date"),
  currentTeamId: integer("current_team_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Coach = typeof coaches.$inferSelect;
export type NewCoach = typeof coaches.$inferInsert;
