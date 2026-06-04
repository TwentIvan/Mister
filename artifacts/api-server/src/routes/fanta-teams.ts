import { Router, type IRouter } from "express";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { fantaTeams, players, contracts, teamColors, playerGiornataStats, serieAFixtures, coaches } from "@workspace/db";
import { computeCoachVoto } from "@workspace/scoring";
import {
  ListFantaTeamsParams,
  ListFantaTeamsResponse,
  CreateFantaTeamParams,
  CreateFantaTeamBody,
  GetFantaTeamParams,
  GetFantaTeamResponse,
  UpdateFantaTeamParams,
  UpdateFantaTeamBody,
  UpdateFantaTeamResponse,
} from "@workspace/api-zod";
import type { RosterSnapshot } from "@workspace/db";
import { mapFantaTeam } from "../lib/mappers";
import { guardLeagueAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/leagues/:leagueId/teams", async (req, res): Promise<void> => {
  const params = ListFantaTeamsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(fantaTeams)
    .where(eq(fantaTeams.leagueId, params.data.leagueId));
  res.json(ListFantaTeamsResponse.parse(rows.map(mapFantaTeam)));
});

router.post("/leagues/:leagueId/teams", async (req, res): Promise<void> => {
  const params = CreateFantaTeamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!await guardLeagueAdmin(req, res, params.data.leagueId)) return;
  const parsed = CreateFantaTeamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const emptyRoster: RosterSnapshot = { gk: [], def: [], mid: [], att: [] };
  const [row] = await db
    .insert(fantaTeams)
    .values({
      id: nanoid(),
      leagueId: params.data.leagueId,
      managerUserId: d.manager_user_id,
      name: d.name,
      nameAuction: d.name_auction ?? null,
      logoUrl: d.logo_url ?? null,
      roster: emptyRoster,
    })
    .returning();
  res.status(201).json(GetFantaTeamResponse.parse(mapFantaTeam(row)));
});

router.get("/leagues/:leagueId/teams/:id", async (req, res): Promise<void> => {
  const p = GetFantaTeamParams.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(fantaTeams)
    .where(and(eq(fantaTeams.leagueId, p.data.leagueId), eq(fantaTeams.id, p.data.id)));
  if (!row) {
    res.status(404).json({ error: "Squadra non trovata" });
    return;
  }
  res.json(GetFantaTeamResponse.parse(mapFantaTeam(row)));
});

router.patch("/leagues/:leagueId/teams/:id", async (req, res): Promise<void> => {
  const p = UpdateFantaTeamParams.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  if (!await guardLeagueAdmin(req, res, p.data.leagueId)) return;
  const parsed = UpdateFantaTeamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;

  // Costruisci aggiornamento JSONB per jersey (merge, non sovrascrittura)
  const jerseyPatch: Record<string, string> = {};
  if (d.color_primary !== undefined) jerseyPatch.primaryColor = d.color_primary;
  if (d.color_secondary !== undefined) jerseyPatch.secondaryColor = d.color_secondary;
  const hasJerseyUpdate = Object.keys(jerseyPatch).length > 0;
  const jerseyJson = hasJerseyUpdate ? JSON.stringify(jerseyPatch) : undefined;

  const [row] = await db
    .update(fantaTeams)
    .set({
      ...(d.name !== undefined && { name: d.name }),
      ...(d.name_auction !== undefined && { nameAuction: d.name_auction }),
      ...(d.logo_url !== undefined && { logoUrl: d.logo_url }),
      ...(d.coach_name !== undefined && { coachName: d.coach_name }),
      ...(d.credits_remaining !== undefined && { creditsRemaining: d.credits_remaining }),
      ...(jerseyJson !== undefined && {
        jersey: sql`COALESCE(${fantaTeams.jersey}, '{}'::jsonb) || ${jerseyJson}::jsonb`,
      }),
    })
    .where(and(eq(fantaTeams.leagueId, p.data.leagueId), eq(fantaTeams.id, p.data.id)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Squadra non trovata" });
    return;
  }
  res.json(UpdateFantaTeamResponse.parse(mapFantaTeam(row)));
});

const SERIE_A_TEAM_CODE: Record<string, string> = {
  "Atalanta":      "ATA",
  "Bologna":       "BOL",
  "Cagliari":      "CAG",
  "Como":          "COM",
  "Empoli":        "EMP",
  "Fiorentina":    "FIO",
  "Genoa":         "GEN",
  "Inter":         "INT",
  "Juventus":      "JUV",
  "Lazio":         "LAZ",
  "Lecce":         "LEC",
  "Milan":         "MIL",
  "AC Milan":      "MIL",
  "Monza":         "MON",
  "Napoli":        "NAP",
  "Parma":         "PAR",
  "AS Roma":       "ROM",
  "Torino":        "TOR",
  "Udinese":       "UDI",
  "Venezia":       "VEN",
  "Hellas Verona": "VER",
};

router.get("/roster", async (req, res): Promise<void> => {
  const fantaTeamId = req.query.fantaTeamId as string | undefined;
  const season = parseInt(req.query.season as string, 10);

  if (!fantaTeamId) {
    res.status(400).json({ error: "fantaTeamId richiesto" });
    return;
  }
  const round = req.query.round !== undefined ? parseInt(req.query.round as string, 10) : null;

  if (isNaN(season)) {
    res.status(400).json({ error: "season richiesto" });
    return;
  }

  const baseRows = await db
    .select({
      id: players.id,
      name: players.name,
      roleClassic: players.roleClassic,
      photoUrl: players.photoUrl,
      photoCartoonUrl: players.photoCartoonUrl,
      realTeamName: players.realTeam,
      realTeamId: players.currentTeamId,
      realTeamColorPrimary: teamColors.primaryHex,
      realTeamColorSecondary: teamColors.secondaryHex,
      realTeamApiId: teamColors.teamId,
    })
    .from(contracts)
    .innerJoin(players, eq(players.id, contracts.playerId))
    .leftJoin(teamColors, eq(teamColors.teamName, players.realTeam))
    .where(
      and(
        eq(contracts.fantaTeamId, fantaTeamId),
        eq(contracts.seasonStart, season),
      ),
    );

  const votoMap = new Map<number, number | null>();
  if (round !== null && !isNaN(round)) {
    const pgsRows = await db
      .select({
        playerId: playerGiornataStats.playerId,
        votoMister: playerGiornataStats.votoMister,
      })
      .from(playerGiornataStats)
      .where(
        and(
          eq(playerGiornataStats.season, season),
          eq(playerGiornataStats.round, round),
        ),
      );
    for (const r of pgsRows) {
      votoMap.set(r.playerId, r.votoMister !== null ? Number(r.votoMister) : null);
    }
  }

  // Mappa teamId → { opponentCode, isHome } per la giornata richiesta
  const opponentMap = new Map<number, { opponentCode: string; isHome: boolean }>();
  if (round !== null && !isNaN(round)) {
    const allTeamIds = baseRows
      .map(r => r.realTeamApiId)
      .filter((id): id is number => id !== null);

    if (allTeamIds.length > 0) {
      const fixtures = await db
        .select()
        .from(serieAFixtures)
        .where(
          and(
            eq(serieAFixtures.season, season),
            eq(serieAFixtures.round, round),
          ),
        );

      for (const fx of fixtures) {
        const homeCode = SERIE_A_TEAM_CODE[fx.homeTeamName] ?? fx.homeTeamName.slice(0, 3).toUpperCase();
        const awayCode = SERIE_A_TEAM_CODE[fx.awayTeamName] ?? fx.awayTeamName.slice(0, 3).toUpperCase();
        if (allTeamIds.includes(fx.homeTeamId)) {
          opponentMap.set(fx.homeTeamId, { opponentCode: awayCode, isHome: true });
        }
        if (allTeamIds.includes(fx.awayTeamId)) {
          opponentMap.set(fx.awayTeamId, { opponentCode: homeCode, isHome: false });
        }
      }
    }
  }

  res.json(
    baseRows.map(r => {
      const opp = r.realTeamApiId != null ? (opponentMap.get(r.realTeamApiId) ?? null) : null;
      return {
        id: r.id,
        name: r.name,
        roleClassic: r.roleClassic,
        photoUrl: r.photoUrl,
        photoCartoonUrl: r.photoCartoonUrl,
        realTeamName: r.realTeamName,
        realTeamId: r.realTeamApiId ?? r.realTeamId,
        realTeamColorPrimary: r.realTeamColorPrimary,
        realTeamColorSecondary: r.realTeamColorSecondary,
        logoUrl: r.realTeamApiId != null
          ? `https://media.api-sports.io/football/teams/${r.realTeamApiId}.png`
          : null,
        votoMister: votoMap.has(r.id) ? (votoMap.get(r.id) ?? null) : null,
        opponentCode: opp?.opponentCode ?? null,
        opponentIsHome: opp?.isHome ?? null,
      };
    }),
  );
});

router.get("/coach-voto", async (req, res): Promise<void> => {
  const fantaTeamId = req.query.fantaTeamId as string | undefined;
  const season = parseInt(req.query.season as string, 10);
  const round  = parseInt(req.query.round as string, 10);

  if (!fantaTeamId || isNaN(season) || isNaN(round)) {
    res.status(400).json({ error: "fantaTeamId, season, round richiesti" });
    return;
  }

  const teamRow = await db.select({ headCoachId: fantaTeams.headCoachId })
    .from(fantaTeams).where(eq(fantaTeams.id, fantaTeamId)).limit(1);
  const headCoachId = teamRow[0]?.headCoachId ?? null;

  if (!headCoachId) {
    res.json({ coachName: null, coachVoto: 6.0, coachDelta: 0, goalsFor: null, goalsAgainst: null });
    return;
  }

  const coachRow = await db.select().from(coaches).where(eq(coaches.id, headCoachId)).limit(1);
  const coach = coachRow[0] ?? null;
  if (!coach?.currentTeamId) {
    res.json({ coachName: coach?.name ?? null, coachVoto: 6.0, coachDelta: 0, goalsFor: null, goalsAgainst: null });
    return;
  }

  const fixtures = await db.select().from(serieAFixtures).where(
    and(eq(serieAFixtures.season, season), eq(serieAFixtures.round, round)),
  );
  const fx = fixtures.find(f => f.homeTeamId === coach.currentTeamId || f.awayTeamId === coach.currentTeamId);

  if (!fx || fx.homeGoals === null || fx.awayGoals === null) {
    res.json({ coachName: coach.name, coachVoto: 6.0, coachDelta: 0, goalsFor: null, goalsAgainst: null });
    return;
  }

  const isHome = fx.homeTeamId === coach.currentTeamId;
  const goalsFor     = isHome ? fx.homeGoals : fx.awayGoals;
  const goalsAgainst = isHome ? fx.awayGoals : fx.homeGoals;
  const coachVoto    = computeCoachVoto({ goalsFor, goalsAgainst });
  const coachDelta   = Math.round((coachVoto - 6.0) / 0.5) * 0.5;

  res.json({ coachName: coach.name, coachVoto, coachDelta, goalsFor, goalsAgainst });
});

export default router;
