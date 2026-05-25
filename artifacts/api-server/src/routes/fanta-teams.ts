import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { fantaTeamsTable } from "@workspace/db";
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
    .from(fantaTeamsTable)
    .where(eq(fantaTeamsTable.leagueId, params.data.leagueId));
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
  const [row] = await db
    .insert(fantaTeamsTable)
    .values({
      id: nanoid(),
      leagueId: params.data.leagueId,
      managerUserId: d.manager_user_id,
      name: d.name,
      nameAuction: d.name_auction ?? null,
      logoUrl: d.logo_url ?? null,
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
    .from(fantaTeamsTable)
    .where(and(eq(fantaTeamsTable.leagueId, p.data.leagueId), eq(fantaTeamsTable.id, p.data.id)));
  if (!row) {
    res.status(404).json({ error: "FantaTeam not found" });
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
    .update(fantaTeamsTable)
    .set({
      ...(d.name !== undefined && { name: d.name }),
      ...(d.name_auction !== undefined && { nameAuction: d.name_auction }),
      ...(d.logo_url !== undefined && { logoUrl: d.logo_url }),
      ...(d.credits_remaining !== undefined && { creditsRemaining: d.credits_remaining }),
    })
    .where(and(eq(fantaTeamsTable.leagueId, p.data.leagueId), eq(fantaTeamsTable.id, p.data.id)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "FantaTeam not found" });
    return;
  }
  res.json(UpdateFantaTeamResponse.parse(mapFantaTeam(row)));
});

export default router;
