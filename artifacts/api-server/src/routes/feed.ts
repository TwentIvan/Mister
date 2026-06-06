import { Router, type IRouter } from "express";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@workspace/db";
import {
  competitionMatches,
  fantaTeams,
  societa,
  competitions,
  leagues,
} from "@workspace/db";
import type { JerseyConfig } from "@workspace/db";

const router: IRouter = Router();

const homeFt = alias(fantaTeams, "hft");
const awayFt = alias(fantaTeams, "aft");
const homeSoc = alias(societa, "hs");
const awaySoc = alias(societa, "as_");

const BRAND_PRIMARY = "#1f4733";
const BRAND_SECONDARY = "#efe6d3";

function jerseyColors(jersey: JerseyConfig | null) {
  return {
    colorPrimary: jersey?.primaryColor ?? BRAND_PRIMARY,
    colorSecondary: jersey?.secondaryColor ?? BRAND_SECONDARY,
  };
}

function teamCode(name: string | null): string {
  if (!name) return "??";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0]! + words[1][0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function ordinal(n: number): string {
  return `${n}ª`;
}

function risultatoHeadline(
  homeName: string,
  awayName: string,
  homeScore: number,
  awayScore: number,
  giornata: number,
): { headline: string; body: string } {
  const diff = Math.abs(homeScore - awayScore);
  const winnerName = homeScore > awayScore ? homeName : awayName;
  const loserName = homeScore > awayScore ? awayName : homeName;
  const winScore = Math.max(homeScore, awayScore).toFixed(2);
  const loseScore = Math.min(homeScore, awayScore).toFixed(2);
  const ord = ordinal(giornata);

  let headline: string;
  if (diff > 8) {
    headline = `${winnerName} travolge ${loserName}: ${winScore}–${loseScore} nella ${ord} giornata.`;
  } else if (diff > 4) {
    headline = `${winnerName} domina la ${ord} giornata: ${winScore}–${loseScore} il finale.`;
  } else if (diff > 2) {
    headline = `${winnerName} supera ${loserName} nella ${ord} giornata: ${winScore}–${loseScore}.`;
  } else {
    headline = `${ord} giornata: ${winnerName} spunta di misura su ${loserName}, ${winScore}–${loseScore}.`;
  }

  const body = `${winnerName} porta a casa i 3 punti con ${winScore}. ${loserName} si ferma a ${loseScore}.`;
  return { headline, body };
}

// ─── GET /feed ────────────────────────────────────────────────────────────────

router.get("/feed", async (req, res): Promise<void> => {
  const leagueId = req.query["leagueId"] as string | undefined;
  const limit = Math.min(
    parseInt((req.query["limit"] as string) ?? "20", 10),
    50,
  );

  const baseConditions = [isNotNull(competitionMatches.playedAt)];
  if (leagueId) {
    baseConditions.push(eq(leagues.id, leagueId));
  }

  const rows = await db
    .select({
      id: competitionMatches.id,
      giornata: competitionMatches.giornata,
      competitionId: competitionMatches.competitionId,
      homeScore: competitionMatches.homeScore,
      awayScore: competitionMatches.awayScore,
      playedAt: competitionMatches.playedAt,
      leagueId: leagues.id,
      leagueName: leagues.name,
      homeId: homeFt.id,
      homeName: homeSoc.name,
      homeJersey: homeSoc.jersey,
      awayId: awayFt.id,
      awayName: awaySoc.name,
      awayJersey: awaySoc.jersey,
    })
    .from(competitionMatches)
    .innerJoin(
      competitions,
      eq(competitions.id, competitionMatches.competitionId),
    )
    .innerJoin(leagues, eq(leagues.id, competitions.leagueId))
    .leftJoin(homeFt, eq(homeFt.id, competitionMatches.homeFantaTeamId))
    .leftJoin(homeSoc, eq(homeFt.societaId, homeSoc.id))
    .leftJoin(awayFt, eq(awayFt.id, competitionMatches.awayFantaTeamId))
    .leftJoin(awaySoc, eq(awayFt.societaId, awaySoc.id))
    .where(and(...baseConditions))
    .orderBy(desc(competitionMatches.playedAt), desc(competitionMatches.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);

  const events = pageRows.map((row) => {
    const hs = parseFloat(row.homeScore ?? "0");
    const as_ = parseFloat(row.awayScore ?? "0");
    const { headline, body } = risultatoHeadline(
      row.homeName ?? "Casa",
      row.awayName ?? "Ospite",
      hs,
      as_,
      row.giornata,
    );

    return {
      id: `match-${row.id}`,
      type: "risultato" as const,
      timestamp: row.playedAt?.toISOString() ?? new Date().toISOString(),
      leagueId: row.leagueId,
      leagueName: row.leagueName ?? "Lega",
      competitionId: row.competitionId,
      tag: `${ordinal(row.giornata)} giornata`,
      headline,
      body,
      matchData: {
        giornata: row.giornata,
        homeTeam: {
          id: row.homeId ?? "",
          name: row.homeName ?? "Casa",
          code: teamCode(row.homeName),
          ...jerseyColors(row.homeJersey as JerseyConfig | null),
        },
        awayTeam: {
          id: row.awayId ?? "",
          name: row.awayName ?? "Ospite",
          code: teamCode(row.awayName),
          ...jerseyColors(row.awayJersey as JerseyConfig | null),
        },
        homeScore: hs,
        awayScore: as_,
      },
    };
  });

  const nextCursor =
    hasMore && pageRows.length > 0
      ? pageRows[pageRows.length - 1]!.playedAt?.toISOString() ?? null
      : null;

  res.json({ events, nextCursor, hasMore });
});

export default router;
