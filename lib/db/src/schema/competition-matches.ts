import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { competitions } from "./competitions";
import { fantaTeams } from "./fanta-teams";

export const competitionMatches = pgTable(
  "competition_matches",
  {
    id: serial("id").primaryKey(),

    /** FK → competitions.id (text) */
    competitionId: text("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),

    /** 1-38, corrisponde alla giornata Serie A */
    giornata: integer("giornata").notNull(),

    /** 1-4, ordine partita nella giornata */
    matchOrder: integer("match_order").notNull(),

    homeFantaTeamId: text("home_fanta_team_id")
      .notNull()
      .references(() => fantaTeams.id, { onDelete: "cascade" }),

    awayFantaTeamId: text("away_fanta_team_id")
      .notNull()
      .references(() => fantaTeams.id, { onDelete: "cascade" }),

    /** NULL finché la partita non è stata giocata */
    homeScore: numeric("home_score", { precision: 5, scale: 2 }),
    awayScore: numeric("away_score", { precision: 5, scale: 2 }),

    playedAt: timestamp("played_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueMatch: uniqueIndex("competition_match_unique").on(
      table.competitionId,
      table.giornata,
      table.matchOrder,
    ),
  }),
);

export type CompetitionMatch = typeof competitionMatches.$inferSelect;
export type NewCompetitionMatch = typeof competitionMatches.$inferInsert;
