import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { federations, leagues } from "@workspace/db";
import {
  GetFederationParams,
  GetFederationResponse,
  UpdateFederationParams,
  UpdateFederationBody,
  UpdateFederationResponse,
} from "@workspace/api-zod";
import { mapFederation } from "../lib/mappers";
import type { FederationRules } from "@workspace/db";

const router: IRouter = Router();

router.get("/leagues/:leagueId/federation", async (req, res): Promise<void> => {
  const params = GetFederationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [leagueRow] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, params.data.leagueId));
  if (!leagueRow) {
    res.status(404).json({ error: "Lega non trovata" });
    return;
  }
  const [row] = await db
    .select()
    .from(federations)
    .where(eq(federations.id, leagueRow.federationId));
  if (!row) {
    res.status(404).json({ error: "Regolamento non trovato" });
    return;
  }
  res.json(GetFederationResponse.parse(mapFederation(row)));
});

router.patch("/leagues/:leagueId/federation", async (req, res): Promise<void> => {
  const params = UpdateFederationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateFederationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [leagueRow] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, params.data.leagueId));
  if (!leagueRow) {
    res.status(404).json({ error: "Lega non trovata" });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .update(federations)
    .set({
      ...(d.name !== undefined && { name: d.name }),
      ...(d.description !== undefined && { description: d.description }),
      ...(d.mode !== undefined && { mode: d.mode }),
      ...(d.feature_flags !== undefined && { featureFlags: d.feature_flags }),
      ...(d.rules !== undefined && { rules: d.rules as unknown as FederationRules }),
      updatedAt: new Date(),
    })
    .where(eq(federations.id, leagueRow.federationId))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Regolamento non trovato" });
    return;
  }
  res.json(UpdateFederationResponse.parse(mapFederation(row)));
});

export default router;
