import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@workspace/db";
import { competitionMatches, fantaTeams } from "@workspace/db";
import { GetMatchesQueryParams, GetMatchesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const homeTeam = alias(fantaTeams, "home_team");
const awayTeam = alias(fantaTeams, "away_team");

router.get("/matches", async (req, res): Promise<void> => {
  const params = GetMatchesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ errors: params.error.issues.map((i) => i.message) });
    return;
  }

  const { competitionId, giornata } = params.data;

  const rows = await db
    .select({
      id: competitionMatches.id,
      giornata: competitionMatches.giornata,
      matchOrder: competitionMatches.matchOrder,
      homeFantaTeamId: competitionMatches.homeFantaTeamId,
      homeTeamName: homeTeam.name,
      homeScore: competitionMatches.homeScore,
      awayFantaTeamId: competitionMatches.awayFantaTeamId,
      awayTeamName: awayTeam.name,
      awayScore: competitionMatches.awayScore,
      playedAt: competitionMatches.playedAt,
    })
    .from(competitionMatches)
    .innerJoin(homeTeam, eq(homeTeam.id, competitionMatches.homeFantaTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, competitionMatches.awayFantaTeamId))
    .where(
      and(
        eq(competitionMatches.competitionId, competitionId),
        eq(competitionMatches.giornata, giornata),
      ),
    )
    .orderBy(competitionMatches.matchOrder);

  const result = rows.map((r) => ({
    id: r.id,
    giornata: r.giornata,
    matchOrder: r.matchOrder,
    homeFantaTeamId: r.homeFantaTeamId,
    homeTeamName: r.homeTeamName,
    homeScore: r.homeScore !== null ? parseFloat(r.homeScore) : null,
    awayFantaTeamId: r.awayFantaTeamId,
    awayTeamName: r.awayTeamName,
    awayScore: r.awayScore !== null ? parseFloat(r.awayScore) : null,
    playedAt: r.playedAt?.toISOString() ?? null,
  }));

  res.json(GetMatchesResponse.parse(result));
});

export default router;
