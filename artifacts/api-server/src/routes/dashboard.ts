import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  leaguesTable,
  marketEventsTable,
  competitionsTable,
  templateProfilesTable,
} from "@workspace/db";
import {
  GetDashboardQueryParams,
  GetDashboardResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard", async (req, res): Promise<void> => {
  const parsed = GetDashboardQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { user_id } = parsed.data;

  const myLeaguesRaw = user_id
    ? await db.select().from(leaguesTable).where(eq(leaguesTable.adminUserId, user_id))
    : await db.select().from(leaguesTable).limit(5);

  const activeMarketsRaw = await db.select().from(marketEventsTable).limit(5);
  const recentCompetitionsRaw = await db.select().from(competitionsTable).limit(5);

  const [templateCount] = await db.select({ count: count() }).from(templateProfilesTable);
  const [totalLeagueCount] = await db.select({ count: count() }).from(leaguesTable);

  const myLeagues = myLeaguesRaw.map((l) => ({
    id: l.id,
    name: l.name,
    federation_id: l.federationId,
    template_id: l.templateId ?? null,
    admin_user_id: l.adminUserId,
    max_managers: l.maxManagers,
    season: l.season,
    visibility: l.visibility,
    started: l.started,
    created_at: l.createdAt,
  }));

  const activeMarkets = activeMarketsRaw.map((m) => ({
    id: m.id,
    league_id: m.leagueId,
    name: m.name,
    description: m.description,
    type: m.type,
    status: m.status,
    window_starts_at: m.windowStartsAt,
    window_ends_at: m.windowEndsAt,
    settings: m.settings ?? {},
    label_color: m.labelColor,
    created_at: m.createdAt,
  }));

  const recentCompetitions = recentCompetitionsRaw.map((c) => ({
    id: c.id,
    league_id: c.leagueId,
    name: c.name,
    description: c.description,
    type: c.type,
    season: c.season,
    start_giornata: c.startGiornata,
    end_giornata: c.endGiornata,
    participant_team_ids: c.participantTeamIds,
    tiebreakers: c.tiebreakers,
    settings: c.settings ?? {},
    active: c.active,
    completed: c.completed,
    starts_at: c.startsAt ?? null,
    ends_at: c.endsAt ?? null,
    created_at: c.createdAt,
  }));

  res.json({
    my_leagues: myLeagues,
    active_markets: activeMarkets,
    recent_competitions: recentCompetitions,
    template_count: Number(templateCount?.count ?? 0),
    total_league_count: Number(totalLeagueCount?.count ?? 0),
  });
});

export default router;
