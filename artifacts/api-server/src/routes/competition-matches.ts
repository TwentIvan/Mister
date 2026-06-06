import { Router, type IRouter } from "express";
import { eq, and, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@workspace/db";
import { competitionMatches, fantaTeams, societa, competitions, leagues, federations } from "@workspace/db";
import type { JerseyConfig } from "@workspace/db";

const router: IRouter = Router();

const homeTeam = alias(fantaTeams, "home_team");
const awayTeam = alias(fantaTeams, "away_team");
const homeSocieta = alias(societa, "home_societa");
const awaySocieta = alias(societa, "away_societa");

const BRAND_PRIMARY = "#1f4733";
const BRAND_SECONDARY = "#efe6d3";

function toMatchTeam(
  id: string,
  name: string | null,
  logoUrl: string | null,
  jersey: JerseyConfig | null,
) {
  const raw = (name ?? "???").trim().toUpperCase();
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
  homeName: string | null;
  homeLogoUrl: string | null;
  homeJersey: JerseyConfig | null;
  awayId: string;
  awayName: string | null;
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
      homeName: homeSocieta.name,
      homeLogoUrl: homeSocieta.logoUrl,
      homeJersey: homeSocieta.jersey,
      awayId: awayTeam.id,
      awayName: awaySocieta.name,
      awayLogoUrl: awaySocieta.logoUrl,
      awayJersey: awaySocieta.jersey,
      homeScore: competitionMatches.homeScore,
      awayScore: competitionMatches.awayScore,
      playedAt: competitionMatches.playedAt,
    })
    .from(competitionMatches)
    .innerJoin(homeTeam, eq(homeTeam.id, competitionMatches.homeFantaTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, competitionMatches.awayFantaTeamId))
    .leftJoin(homeSocieta, eq(homeTeam.societaId, homeSocieta.id))
    .leftJoin(awaySocieta, eq(awayTeam.societaId, awaySocieta.id))
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

  // Legge competition + federation per i parametri goalThresholds
  const compWithFed = await db
    .select({
      id: competitions.id,
      fedRules: federations.rules,
    })
    .from(competitions)
    .innerJoin(leagues, eq(leagues.id, competitions.leagueId))
    .innerJoin(federations, eq(federations.id, leagues.federationId))
    .where(eq(competitions.id, competitionId))
    .limit(1);

  if (compWithFed.length === 0) {
    res.status(404).json({ error: "Competizione non trovata" });
    return;
  }

  // goalThresholds della federazione (default classico se mancanti)
  const thresholds = compWithFed[0]!.fedRules?.goalThresholds ?? { base: 66, step: 6, maxGoals: 8 };

  /**
   * Conversione punteggio giornata → gol classico.
   * Formula: score < base → 0; altrimenti floor((score - (base - step)) / step), cappato a maxGoals.
   * Esempio (base=66, step=6): 65→0, 66→1, 72→2, 78→3 …
   */
  function scoreToGol(score: number): number {
    if (score < thresholds.base) return 0;
    return Math.min(
      thresholds.maxGoals,
      Math.floor((score - (thresholds.base - thresholds.step)) / thresholds.step),
    );
  }

  const playedRows = await db
    .select({
      homeId: homeTeam.id,
      homeName: homeSocieta.name,
      homeLogoUrl: homeSocieta.logoUrl,
      homeJersey: homeSocieta.jersey,
      awayId: awayTeam.id,
      awayName: awaySocieta.name,
      awayLogoUrl: awaySocieta.logoUrl,
      awayJersey: awaySocieta.jersey,
      homeScore: competitionMatches.homeScore,
      awayScore: competitionMatches.awayScore,
    })
    .from(competitionMatches)
    .innerJoin(homeTeam, eq(homeTeam.id, competitionMatches.homeFantaTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, competitionMatches.awayFantaTeamId))
    .leftJoin(homeSocieta, eq(homeTeam.societaId, homeSocieta.id))
    .leftJoin(awaySocieta, eq(awayTeam.societaId, awaySocieta.id))
    .where(
      and(
        eq(competitionMatches.competitionId, competitionId),
        isNotNull(competitionMatches.playedAt),
      ),
    );

  type TeamRow = {
    name: string | null;
    logoUrl: string | null;
    jersey: JerseyConfig | null;
    playedMatches: number;
    wins: number;
    draws: number;
    losses: number;
    /** Gol fatti (classico, somma per-partita convertita con soglie). */
    gf: number;
    /** Gol subiti (classico, somma per-partita convertita con soglie). */
    gs: number;
    /** Punti fantacalcio cumulati (raw score sum, usato come spareggio). */
    pf: number;
    points: number;
  };
  const table = new Map<string, TeamRow>();

  const ensureTeam = (id: string, name: string | null, logoUrl: string | null, jersey: JerseyConfig | null) => {
    if (!table.has(id)) {
      table.set(id, { name, logoUrl, jersey, playedMatches: 0, wins: 0, draws: 0, losses: 0, gf: 0, gs: 0, pf: 0, points: 0 });
    }
  };

  for (const row of playedRows) {
    if (row.homeScore === null || row.awayScore === null) continue;
    const hs = Math.round(parseFloat(row.homeScore) * 100) / 100;
    const as_ = Math.round(parseFloat(row.awayScore) * 100) / 100;

    // Conversione per-partita: punteggio → gol classico
    const homeGol = scoreToGol(hs);
    const awayGol = scoreToGol(as_);

    ensureTeam(row.homeId, row.homeName ?? null, row.homeLogoUrl, row.homeJersey);
    ensureTeam(row.awayId, row.awayName ?? null, row.awayLogoUrl, row.awayJersey);

    const home = table.get(row.homeId)!;
    const away = table.get(row.awayId)!;

    home.playedMatches++;
    home.gf += homeGol;
    home.gs += awayGol;
    home.pf = Math.round((home.pf + hs) * 100) / 100;

    away.playedMatches++;
    away.gf += awayGol;
    away.gs += homeGol;
    away.pf = Math.round((away.pf + as_) * 100) / 100;

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
    // Spareggio 1: differenza reti classico
    const gdA = a.gf - a.gs;
    const gdB = b.gf - b.gs;
    if (gdB !== gdA) return gdB - gdA;
    // Spareggio 2: gol fatti
    if (b.gf !== a.gf) return b.gf - a.gf;
    // Spareggio 3: PF (punteggio fanta cumulato)
    if (b.pf !== a.pf) return b.pf - a.pf;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  const standings = sorted.map(([id, r], idx) => ({
    position: idx + 1,
    fantaTeam: toMatchTeam(id, r.name, r.logoUrl, r.jersey),
    playedMatches: r.playedMatches,
    wins: r.wins,
    draws: r.draws,
    losses: r.losses,
    gf: r.gf,
    gs: r.gs,
    gd: r.gf - r.gs,
    points: r.points,
    pf: Math.round(r.pf * 100) / 100,
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
      homeName: homeSocieta.name,
      homeLogoUrl: homeSocieta.logoUrl,
      homeJersey: homeSocieta.jersey,
      awayId: awayTeam.id,
      awayName: awaySocieta.name,
      awayLogoUrl: awaySocieta.logoUrl,
      awayJersey: awaySocieta.jersey,
      homeScore: competitionMatches.homeScore,
      awayScore: competitionMatches.awayScore,
      playedAt: competitionMatches.playedAt,
    })
    .from(competitionMatches)
    .innerJoin(homeTeam, eq(homeTeam.id, competitionMatches.homeFantaTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, competitionMatches.awayFantaTeamId))
    .leftJoin(homeSocieta, eq(homeTeam.societaId, homeSocieta.id))
    .leftJoin(awaySocieta, eq(awayTeam.societaId, awaySocieta.id))
    .where(eq(competitionMatches.id, matchId))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Match non trovato" });
    return;
  }

  res.json(toCompetitionMatch(rows[0]));
});

export default router;
