import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { competitionsTable } from "@workspace/db";
import {
  ListCompetitionsParams,
  ListCompetitionsResponse,
  CreateCompetitionParams,
  CreateCompetitionBody,
  GetCompetitionParams,
  GetCompetitionResponse,
  UpdateCompetitionParams,
  UpdateCompetitionBody,
  UpdateCompetitionResponse,
  DeleteCompetitionParams,
} from "@workspace/api-zod";
import { mapCompetition } from "../lib/mappers";

const router: IRouter = Router();

router.get("/leagues/:leagueId/competitions", async (req, res): Promise<void> => {
  const params = ListCompetitionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(competitionsTable)
    .where(eq(competitionsTable.leagueId, params.data.leagueId));
  res.json(ListCompetitionsResponse.parse(rows.map(mapCompetition)));
});

router.post("/leagues/:leagueId/competitions", async (req, res): Promise<void> => {
  const params = CreateCompetitionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateCompetitionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .insert(competitionsTable)
    .values({
      id: nanoid(),
      leagueId: params.data.leagueId,
      name: d.name,
      description: d.description ?? "",
      type: d.type,
      season: d.season,
      startGiornata: d.start_giornata,
      endGiornata: d.end_giornata,
      participantTeamIds: d.participant_team_ids ?? [],
      tiebreakers: d.tiebreakers ?? [],
      settings: d.settings ?? null,
    })
    .returning();
  res.status(201).json(GetCompetitionResponse.parse(mapCompetition(row)));
});

router.get("/leagues/:leagueId/competitions/:id", async (req, res): Promise<void> => {
  const p = GetCompetitionParams.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(competitionsTable)
    .where(and(eq(competitionsTable.leagueId, p.data.leagueId), eq(competitionsTable.id, p.data.id)));
  if (!row) {
    res.status(404).json({ error: "Competition not found" });
    return;
  }
  res.json(GetCompetitionResponse.parse(mapCompetition(row)));
});

router.patch("/leagues/:leagueId/competitions/:id", async (req, res): Promise<void> => {
  const p = UpdateCompetitionParams.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  const parsed = UpdateCompetitionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .update(competitionsTable)
    .set({
      ...(d.name !== undefined && { name: d.name }),
      ...(d.active !== undefined && { active: d.active }),
      ...(d.completed !== undefined && { completed: d.completed }),
      ...(d.start_giornata !== undefined && { startGiornata: d.start_giornata }),
      ...(d.end_giornata !== undefined && { endGiornata: d.end_giornata }),
    })
    .where(and(eq(competitionsTable.leagueId, p.data.leagueId), eq(competitionsTable.id, p.data.id)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Competition not found" });
    return;
  }
  res.json(UpdateCompetitionResponse.parse(mapCompetition(row)));
});

router.delete("/leagues/:leagueId/competitions/:id", async (req, res): Promise<void> => {
  const p = DeleteCompetitionParams.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  const [row] = await db
    .delete(competitionsTable)
    .where(and(eq(competitionsTable.leagueId, p.data.leagueId), eq(competitionsTable.id, p.data.id)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Competition not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
