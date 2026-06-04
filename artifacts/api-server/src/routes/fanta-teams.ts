import { Router, type IRouter } from "express";
import { eq, and, or, inArray, sql, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { fantaTeams, societa, players, contracts, teamColors, serieAFixtures, coaches } from "@workspace/db";
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
    .leftJoin(societa, eq(fantaTeams.societaId, societa.id))
    .where(eq(fantaTeams.leagueId, params.data.leagueId));
  res.json(ListFantaTeamsResponse.parse(rows.map(r => mapFantaTeam(r.fanta_teams, r.societa))));
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

  const result = await db.transaction(async (tx) => {
    const socId = `soc-${nanoid(8)}`;
    const [soc] = await tx.insert(societa).values({
      id: socId,
      ownerUserId: d.manager_user_id,
      name: d.name,
      nameAuction: d.name_auction ?? undefined,
      logoUrl: d.logo_url ?? undefined,
      jersey: (d.color_primary && d.color_secondary)
        ? { primaryColor: d.color_primary, secondaryColor: d.color_secondary, pattern: "solid" as const }
        : undefined,
    }).returning();

    const [team] = await tx.insert(fantaTeams).values({
      id: nanoid(),
      leagueId: params.data.leagueId,
      managerUserId: d.manager_user_id,
      societaId: socId,
      roster: emptyRoster,
    }).returning();

    return { team, soc };
  });

  res.status(201).json(GetFantaTeamResponse.parse(mapFantaTeam(result.team, result.soc)));
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
    .leftJoin(societa, eq(fantaTeams.societaId, societa.id))
    .where(and(eq(fantaTeams.leagueId, p.data.leagueId), eq(fantaTeams.id, p.data.id)));
  if (!row) {
    res.status(404).json({ error: "Squadra non trovata" });
    return;
  }
  res.json(GetFantaTeamResponse.parse(mapFantaTeam(row.fanta_teams, row.societa)));
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

  const [existing] = await db
    .select()
    .from(fantaTeams)
    .leftJoin(societa, eq(fantaTeams.societaId, societa.id))
    .where(and(eq(fantaTeams.leagueId, p.data.leagueId), eq(fantaTeams.id, p.data.id)));
  if (!existing) {
    res.status(404).json({ error: "Squadra non trovata" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    // ── Campi identità → aggiorna società ──────────────────────────────────
    const hasIdentityUpdate =
      d.name !== undefined || d.name_auction !== undefined ||
      d.logo_url !== undefined || d.color_primary !== undefined || d.color_secondary !== undefined;

    let updatedSoc = existing.societa;

    if (hasIdentityUpdate && existing.fanta_teams.societaId) {
      const jerseyPatch: Record<string, string> = {};
      if (d.color_primary !== undefined) jerseyPatch.primaryColor = d.color_primary;
      if (d.color_secondary !== undefined) jerseyPatch.secondaryColor = d.color_secondary;
      const hasJerseyUpdate = Object.keys(jerseyPatch).length > 0;
      const jerseyJson = hasJerseyUpdate ? JSON.stringify(jerseyPatch) : undefined;

      const [soc] = await tx
        .update(societa)
        .set({
          ...(d.name !== undefined && { name: d.name }),
          ...(d.name_auction !== undefined && { nameAuction: d.name_auction }),
          ...(d.logo_url !== undefined && { logoUrl: d.logo_url }),
          ...(jerseyJson !== undefined && {
            jersey: sql`COALESCE(${societa.jersey}, '{}'::jsonb) || ${jerseyJson}::jsonb`,
          }),
        })
        .where(eq(societa.id, existing.fanta_teams.societaId))
        .returning();
      updatedSoc = soc ?? existing.societa;
    }

    // ── Campi per-lega → aggiorna partecipazione ───────────────────────────
    const hasTeamUpdate =
      d.coach_name !== undefined || d.credits_remaining !== undefined || d.roster !== undefined;

    let updatedTeam = existing.fanta_teams;

    if (hasTeamUpdate) {
      const [team] = await tx
        .update(fantaTeams)
        .set({
          ...(d.coach_name !== undefined && { coachName: d.coach_name }),
          ...(d.credits_remaining !== undefined && { creditsRemaining: d.credits_remaining }),
          ...(d.roster !== undefined && {
            roster: d.roster as unknown as RosterSnapshot,
          }),
        })
        .where(and(eq(fantaTeams.leagueId, p.data.leagueId), eq(fantaTeams.id, p.data.id)))
        .returning();
      if (!team) { throw Object.assign(new Error("not found"), { code: 404 }); }
      updatedTeam = team;
    }

    return { team: updatedTeam, soc: updatedSoc };
  });

  res.json(UpdateFantaTeamResponse.parse(mapFantaTeam(result.team, result.soc)));
});

router.delete("/leagues/:leagueId/teams/:id", async (req, res): Promise<void> => {
  const p = UpdateFantaTeamParams.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  if (!await guardLeagueAdmin(req, res, p.data.leagueId)) return;

  const [row] = await db
    .delete(fantaTeams)
    .where(and(eq(fantaTeams.leagueId, p.data.leagueId), eq(fantaTeams.id, p.data.id)))
    .returning({ id: fantaTeams.id });
  if (!row) {
    res.status(404).json({ error: "Squadra non trovata" });
    return;
  }
  res.status(204).send();
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

  if (!fantaTeamId || isNaN(season)) {
    res.status(400).json({ error: "fantaTeamId e season sono obbligatori" });
    return;
  }

  const rows = await db
    .select({
      playerId: contracts.playerId,
      name: players.name,
      fullName: players.fullName,
      realTeam: players.realTeam,
      roleClassic: players.roleClassic,
      rolesMantra: players.rolesMantra,
      injured: players.injured,
      photoUrl: players.photoUrl,
      purchasePrice: contracts.purchasePrice,
      durationSeasons: contracts.durationSeasons,
      clauseDefault: contracts.clauseDefault,
    })
    .from(contracts)
    .innerJoin(players, eq(players.id, contracts.playerId))
    .where(
      and(
        eq(contracts.fantaTeamId, fantaTeamId),
        eq(contracts.seasonStart, season),
        eq(contracts.state, "active"),
      )
    );

  const teamColorRows = await db
    .select()
    .from(teamColors)
    .where(
      inArray(
        teamColors.teamName,
        [...new Set(rows.map(r => r.realTeam))],
      )
    );

  const colorMap = Object.fromEntries(teamColorRows.map(c => [c.teamName, c]));

  const roster = rows.map(r => {
    const tc = colorMap[r.realTeam];
    const code = SERIE_A_TEAM_CODE[r.realTeam] ?? r.realTeam.slice(0, 3).toUpperCase();
    return {
      player_id: r.playerId,
      name: r.name,
      full_name: r.fullName,
      real_team: r.realTeam,
      real_team_code: code,
      role_classic: r.roleClassic,
      roles_mantra: r.rolesMantra,
      injured: r.injured,
      photo_url: r.photoUrl,
      purchase_price: r.purchasePrice,
      duration_seasons: r.durationSeasons,
      clause_default: r.clauseDefault,
      team_primary_color:   tc?.primaryHex   ?? null,
      team_secondary_color: tc?.secondaryHex ?? null,
      team_logo_url:        tc != null
        ? `https://media.api-sports.io/football/teams/${tc.teamId}.png`
        : null,
    };
  });

  res.json(roster);
});

router.get("/coach-voto", async (req, res): Promise<void> => {
  const { fantaTeamId, season, giornata } = req.query as Record<string, string>;
  if (!fantaTeamId || !season || !giornata) {
    res.status(400).json({ error: "fantaTeamId, season, giornata obbligatori" });
    return;
  }

  const [team] = await db
    .select({ coachId: fantaTeams.headCoachId, coachName: fantaTeams.coachName })
    .from(fantaTeams)
    .where(eq(fantaTeams.id, fantaTeamId));

  if (!team) {
    res.status(404).json({ error: "Squadra non trovata" });
    return;
  }

  if (!team.coachId) {
    res.json({ coachName: team.coachName ?? null, coachVoto: 6.0, coachDelta: 0, goalsFor: null, goalsAgainst: null });
    return;
  }

  const coach = await db.select().from(coaches).where(eq(coaches.id, team.coachId)).then(r => r[0]);
  if (!coach) {
    res.json({ coachName: team.coachName ?? null, coachVoto: 6.0, coachDelta: 0, goalsFor: null, goalsAgainst: null });
    return;
  }

  if (!coach.currentTeamId) {
    res.json({ coachName: coach.name, coachVoto: 6.0, coachDelta: 0, goalsFor: null, goalsAgainst: null });
    return;
  }

  const gNum = parseInt(giornata, 10);
  const fixture = await db
    .select()
    .from(serieAFixtures)
    .where(
      and(
        or(
          eq(serieAFixtures.homeTeamId, coach.currentTeamId),
          eq(serieAFixtures.awayTeamId, coach.currentTeamId),
        ),
        eq(serieAFixtures.round, gNum),
      )
    )
    .then(r => r[0]);

  if (!fixture || fixture.homeGoals == null || fixture.awayGoals == null) {
    res.json({ coachName: coach.name, coachVoto: 6.0, coachDelta: 0, goalsFor: null, goalsAgainst: null });
    return;
  }

  const isHome = fixture.homeTeamId === coach.currentTeamId;
  const goalsFor     = isHome ? fixture.homeGoals : fixture.awayGoals;
  const goalsAgainst = isHome ? fixture.awayGoals : fixture.homeGoals;
  const rawVoto   = computeCoachVoto({ goalsFor, goalsAgainst });
  const coachVoto = Math.round(rawVoto * 100) / 100;
  const coachDelta = Math.round((rawVoto - 6.0) * 100) / 100;
  res.json({ coachName: coach.name, coachVoto, coachDelta, goalsFor, goalsAgainst });
});

export default router;
