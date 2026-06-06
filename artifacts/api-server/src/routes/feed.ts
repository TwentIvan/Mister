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
  federations,
} from "@workspace/db";
import type { JerseyConfig, GoalThresholds } from "@workspace/db";
import { resolveMatchResult, DEFAULT_THRESHOLDS } from "../lib/competition-result";

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

/** Headline editoriale: solo [Vincitore] [verbo] [Perdente]. Niente punteggio nel titolo. */
function risultatoHeadline(
  homeName: string,
  awayName: string,
  homeGoals: number,
  awayGoals: number,
  giornata: number,
): { headline: string; body: string } {
  const ord = ordinal(giornata);
  const goalMargin = Math.abs(homeGoals - awayGoals);

  if (homeGoals === awayGoals) {
    // Pareggio
    return {
      headline: `${homeName} e ${awayName} si dividono la posta.`,
      body: `${homeGoals}–${awayGoals} in gol classici · ${ord} giornata`,
    };
  }

  const winnerName = homeGoals > awayGoals ? homeName : awayName;
  const loserName = homeGoals > awayGoals ? awayName : homeName;
  const winGoals = Math.max(homeGoals, awayGoals);
  const loseGoals = Math.min(homeGoals, awayGoals);

  let verb: string;
  if (goalMargin >= 5) verb = "travolge";
  else if (goalMargin >= 3) verb = "domina";
  else if (goalMargin >= 2) verb = "supera";
  else verb = "batte";

  return {
    headline: `${winnerName} ${verb} ${loserName}.`,
    body: `${winGoals}–${loseGoals} in gol classici · ${ord} giornata`,
  };
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
      fedRules: federations.rules,
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
    .innerJoin(federations, eq(federations.id, leagues.federationId))
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

    // Soglie dalla federazione — stessa fonte della Classifica
    const thresholds: GoalThresholds =
      row.fedRules?.goalThresholds ?? DEFAULT_THRESHOLDS;

    // Risultato ufficiale via helper condiviso — Feed e Classifica non divergono
    const result = resolveMatchResult(hs, as_, thresholds);
    const { homeGoals, awayGoals, outcome } = result;

    const { headline, body } = risultatoHeadline(
      row.homeName ?? "Casa",
      row.awayName ?? "Ospite",
      homeGoals,
      awayGoals,
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
        outcome,
        homeGoals,
        awayGoals,
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
