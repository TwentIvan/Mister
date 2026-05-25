import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  leagues,
  marketEvents,
  competitions,
  templateProfiles,
} from "@workspace/db";
import {
  GetDashboardQueryParams,
  GetDashboardResponse,
} from "@workspace/api-zod";
import { mapLeague, mapMarket, mapCompetition } from "../lib/mappers";

const router: IRouter = Router();

router.get("/dashboard", async (req, res): Promise<void> => {
  const parsed = GetDashboardQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { user_id } = parsed.data;

  const myLeaguesRaw = user_id
    ? await db.select().from(leagues).where(eq(leagues.adminUserId, user_id))
    : await db.select().from(leagues).limit(5);

  const activeMarketsRaw = await db.select().from(marketEvents).limit(5);
  const recentCompetitionsRaw = await db.select().from(competitions).limit(5);

  const [templateCount] = await db.select({ count: count() }).from(templateProfiles);
  const [totalLeagueCount] = await db.select({ count: count() }).from(leagues);

  res.json(
    GetDashboardResponse.parse({
      my_leagues: myLeaguesRaw.map(mapLeague),
      active_markets: activeMarketsRaw.map(mapMarket),
      recent_competitions: recentCompetitionsRaw.map(mapCompetition),
      template_count: Number(templateCount?.count ?? 0),
      total_league_count: Number(totalLeagueCount?.count ?? 0),
    }),
  );
});

export default router;
