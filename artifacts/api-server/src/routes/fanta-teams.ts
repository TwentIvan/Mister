import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { fantaTeams } from "@workspace/db";
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

export default router;
