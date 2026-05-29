import { Router, type IRouter } from "express";
import { eq, and, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@workspace/db";
import { competitionMatches, fantaTeams, competitions } from "@workspace/db";
import type { JerseyConfig } from "@workspace/db";

const router: IRouter = Router();

const homeTeam = alias(fantaTeams, "home_team");
const awayTeam = alias(fantaTeams, "away_team");

const BRAND_PRIMARY = "#1f4733";
const BRAND_SECONDARY = "#efe6d3";

function toMatchTeam(
  id: string,
  name: string,
  logoUrl: string | null,
  jersey: JerseyConfig | null,
) {
  const raw = name.trim().toUpperCase();
  const words = raw.split(/\s+/).filter(Boolean);
  const code3 =
    words.length >= 2
      ? (words[0][0] + words[1][0] + (words[2]?.[0] ?? words[1][1] ?? "X")).toUpperCase()
      : raw.slice(0, 3).padEnd(3, "X");

  return {
    id,
    name,
    code3,
    logoUrl: logoUrl ?? null,
    colorPrimary: jersey?.primaryColor ?? BRAND_PRIMARY,
    colorSecondary: jersey?.secondaryColor ?? BRAND_SECONDARY,
  };
}

function toCompetitionMatch(row: {
  id: number;
  giornata: number;
  homeId: string;
  homeName: string;
  homeLogoUrl: string | null;
  homeJersey: JerseyConfig | null;
  awayId: string;
  awayName: string;
  awayLogoUrl: string | null;
  awayJersey: JerseyConfig | null;
  homeScore: string | null;
  awayScore: string | null;
  playedAt: Date | null;
}) {
  const playedAt = row.playedAt?.toISOString() ?? null;
  return {
    id: row.id,
    round: row.giornata,
    homeTeam: toMatchTeam(row.homeId, row.homeName, row.homeLogoUrl, row.homeJersey),
    awayTeam: toMatchTeam(row.awayId, row.awayName, row.awayLogoUrl, row.awayJersey),
    homeScore: row.homeScore !== null ? Math.round(parseFloat(row.homeScore) * 100) / 100 : null,
    awayScore: row.awayScore !== null ? Math.round(parseFloat(row.awayScore) * 100) / 100 : null,
    playedAt,
    status: (playedAt !== null ? "played" : "upcoming") as "played" | "upcoming",
  };
}

// ─── GET /competition/:competitionId/matches ──────────────────────────────────

router.get("/competition/:competitionId/matches", async (req, res): Promise<void> => {
  const { competitionId } = req.params;
  const roundParam = req.query["round"];
  const round = roundParam !== undefined ? parseInt(roundParam as string, 10) : undefined;

  const comp = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  if (comp.length === 0) {
    res.status(404).json({ error: "Competizione non trovata" });
    return;
  }

  const rows = await db
    .select({
      id: competitionMatches.id,
      giornata: competitionMatches.giornata,
      homeId: homeTeam.id,
      homeName: homeTeam.name,
      homeLogoUrl: homeTeam.logoUrl,
      homeJersey: homeTeam.jersey,
      awayId: awayTeam.id,
      awayName: awayTeam.name,
      awayLogoUrl: awayTeam.logoUrl,
      awayJersey: awayTeam.jersey,
      homeScore: competitionMatches.homeScore,
      awayScore: competitionMatches.awayScore,
      playedAt: competitionMatches.playedAt,
    })
    .from(competitionMatches)
    .innerJoin(homeTeam, eq(homeTeam.id, competitionMatches.homeFantaTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, competitionMatches.awayFantaTeamId))
    .where(
      round !== undefined
        ? and(
            eq(competitionMatches.competitionId, competitionId),
            eq(competitionMatches.giornata, round),
          )
        : eq(competitionMatches.competitionId, competitionId),
    )
    .orderBy(competitionMatches.giornata, competitionMatches.id);

  res.json({ matches: rows.map(toCompetitionMatch) });
});

// ─── GET /competition/:competitionId/standings ────────────────────────────────

router.get("/competition/:competitionId/standings", async (req, res): Promise<void> => {
  const { competitionId } = req.params;

  const comp = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  if (comp.length === 0) {
    res.status(404).json({ error: "Competizione non trovata" });
    return;
  }

  const playedRows = await db
    .select({
      homeId: homeTeam.id,
      homeName: homeTeam.name,
      homeLogoUrl: homeTeam.logoUrl,
      homeJersey: homeTeam.jersey,
      awayId: awayTeam.id,
      awayName: awayTeam.name,
      awayLogoUrl: awayTeam.logoUrl,
      awayJersey: awayTeam.jersey,
      homeScore: competitionMatches.homeScore,
      awayScore: competitionMatches.awayScore,
    })
    .from(competitionMatches)
    .innerJoin(homeTeam, eq(homeTeam.id, competitionMatches.homeFantaTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, competitionMatches.awayFantaTeamId))
    .where(
      and(
        eq(competitionMatches.competitionId, competitionId),
        isNotNull(competitionMatches.playedAt),
      ),
    );

  type TeamRow = {
    name: string;
    logoUrl: string | null;
    jersey: JerseyConfig | null;
    playedMatches: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  };
  const table = new Map<string, TeamRow>();

  const ensureTeam = (id: string, name: string, logoUrl: string | null, jersey: JerseyConfig | null) => {
    if (!table.has(id)) {
      table.set(id, { name, logoUrl, jersey, playedMatches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
    }
  };

  for (const row of playedRows) {
    if (row.homeScore === null || row.awayScore === null) continue;
    const hs = Math.round(parseFloat(row.homeScore) * 100) / 100;
    const as_ = Math.round(parseFloat(row.awayScore) * 100) / 100;

    ensureTeam(row.homeId, row.homeName, row.homeLogoUrl, row.homeJersey);
    ensureTeam(row.awayId, row.awayName, row.awayLogoUrl, row.awayJersey);

    const home = table.get(row.homeId)!;
    const away = table.get(row.awayId)!;

    home.playedMatches++;
    home.goalsFor = Math.round((home.goalsFor + hs) * 100) / 100;
    home.goalsAgainst = Math.round((home.goalsAgainst + as_) * 100) / 100;

    away.playedMatches++;
    away.goalsFor = Math.round((away.goalsFor + as_) * 100) / 100;
    away.goalsAgainst = Math.round((away.goalsAgainst + hs) * 100) / 100;

    if (hs > as_) {
      home.wins++;
      home.points += 3;
      away.losses++;
    } else if (as_ > hs) {
      away.wins++;
      away.points += 3;
      home.losses++;
    } else {
      home.draws++;
      home.points++;
      away.draws++;
      away.points++;
    }
  }

  const sorted = [...table.entries()].sort(([, a], [, b]) => {
    if (b.points !== a.points) return b.points - a.points;
    const drA = Math.round((a.goalsFor - a.goalsAgainst) * 100) / 100;
    const drB = Math.round((b.goalsFor - b.goalsAgainst) * 100) / 100;
    if (drB !== drA) return drB - drA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });

  const standings = sorted.map(([id, r], idx) => ({
    position: idx + 1,
    fantaTeam: toMatchTeam(id, r.name, r.logoUrl, r.jersey),
    playedMatches: r.playedMatches,
    wins: r.wins,
    draws: r.draws,
    losses: r.losses,
    goalsFor: Math.round(r.goalsFor * 100) / 100,
    goalsAgainst: Math.round(r.goalsAgainst * 100) / 100,
    goalDifference: Math.round((r.goalsFor - r.goalsAgainst) * 100) / 100,
    points: r.points,
  }));

  res.json({ standings });
});

// ─── GET /matches/:matchId ────────────────────────────────────────────────────

router.get("/matches/:matchId", async (req, res): Promise<void> => {
  const matchId = parseInt(req.params["matchId"], 10);
  if (isNaN(matchId)) {
    res.status(400).json({ error: "matchId deve essere un intero" });
    return;
  }

  const rows = await db
    .select({
      id: competitionMatches.id,
      giornata: competitionMatches.giornata,
      homeId: homeTeam.id,
      homeName: homeTeam.name,
      homeLogoUrl: homeTeam.logoUrl,
      homeJersey: homeTeam.jersey,
      awayId: awayTeam.id,
      awayName: awayTeam.name,
      awayLogoUrl: awayTeam.logoUrl,
      awayJersey: awayTeam.jersey,
      homeScore: competitionMatches.homeScore,
      awayScore: competitionMatches.awayScore,
      playedAt: competitionMatches.playedAt,
    })
    .from(competitionMatches)
    .innerJoin(homeTeam, eq(homeTeam.id, competitionMatches.homeFantaTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, competitionMatches.awayFantaTeamId))
    .where(eq(competitionMatches.id, matchId))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Match non trovato" });
    return;
  }

  res.json(toCompetitionMatch(rows[0]));
});

export default router;
