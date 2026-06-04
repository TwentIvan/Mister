import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { auctions } from "./auctions";
import { fantaTeams } from "./fanta-teams";

export const auctionTokens = pgTable("auction_tokens", {
  token: text("token").primaryKey(),
  auctionId: text("auction_id")
    .notNull()
    .references(() => auctions.id, { onDelete: "cascade" }),
  fantaTeamId: text("fanta_team_id")
    .notNull()
    .references(() => fantaTeams.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
