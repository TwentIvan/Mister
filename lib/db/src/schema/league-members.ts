import { pgTable, text, timestamp, pgEnum, primaryKey } from "drizzle-orm/pg-core";
import { users } from "./users";
import { leagues } from "./leagues";

export const memberRoleEnum = pgEnum("member_role", ["admin", "member"]);
export type MemberRole = (typeof memberRoleEnum.enumValues)[number];

/**
 * Appartenenza utente a una lega, con ruolo.
 *
 * - role=admin: creatore della lega o promosso. Può gestire tutto.
 * - role=member: partecipante. Gestisce solo la propria squadra.
 *
 * Chi CREA una lega ottiene automaticamente role=admin.
 * Il flusso di invito (codice/link) porta un utente come role=member.
 * L'enforcement delle autorizzazioni è nel Passo B (middleware canManageLeague/canManageFederation).
 */
export const leagueMembers = pgTable(
  "league_members",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.leagueId] })],
);

export type LeagueMember = typeof leagueMembers.$inferSelect;
export type NewLeagueMember = typeof leagueMembers.$inferInsert;
