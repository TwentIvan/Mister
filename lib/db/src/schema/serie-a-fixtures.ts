import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";

export const serieAFixtures = pgTable("serie_a_fixtures", {
  id:          integer("id").primaryKey(),
  season:      integer("season").notNull(),
  round:       integer("round").notNull(),
  homeTeamId:  integer("home_team_id").notNull(),
  awayTeamId:  integer("away_team_id").notNull(),
  homeTeamName: text("home_team_name").notNull(),
  awayTeamName: text("away_team_name").notNull(),
  homeGoals:   integer("home_goals"),
  awayGoals:   integer("away_goals"),
  status:      text("status").notNull().default("NS"),
  date:        timestamp("date", { withTimezone: true }),
});

export type SerieAFixture    = typeof serieAFixtures.$inferSelect;
export type NewSerieAFixture = typeof serieAFixtures.$inferInsert;
