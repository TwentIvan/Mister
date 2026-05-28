import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { fantaTeams, players, contracts, teamColors, playerGiornataStats } from "@workspace/db";
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
  const parsed = UpdateFantaTeamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .update(fantaTeams)
    .set({
      ...(d.name !== undefined && { name: d.name }),
      ...(d.name_auction !== undefined && { nameAuction: d.name_auction }),
      ...(d.logo_url !== undefined && { logoUrl: d.logo_url }),
      ...(d.credits_remaining !== undefined && { creditsRemaining: d.credits_remaining }),
    })
    .where(and(eq(fantaTeams.leagueId, p.data.leagueId), eq(fantaTeams.id, p.data.id)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Squadra non trovata" });
    return;
  }
  res.json(UpdateFantaTeamResponse.parse(mapFantaTeam(row)));
});

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
    })
    .from(contracts)
    .innerJoin(players, eq(players.id, contracts.playerId))
    .leftJoin(teamColors, eq(teamColors.teamId, players.currentTeamId))
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

  res.json(
    baseRows.map(r => ({
      id: r.id,
      name: r.name,
      roleClassic: r.roleClassic,
      photoUrl: r.photoUrl,
      photoCartoonUrl: r.photoCartoonUrl,
      realTeamName: r.realTeamName,
      realTeamId: r.realTeamId,
      realTeamColorPrimary: r.realTeamColorPrimary,
      realTeamColorSecondary: r.realTeamColorSecondary,
      votoMister: votoMap.has(r.id) ? (votoMap.get(r.id) ?? null) : null,
    })),
  );
});

export default router;
