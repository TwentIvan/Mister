import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { federationsTable } from "@workspace/db";
import {
  GetFederationParams,
  GetFederationResponse,
  UpdateFederationParams,
  UpdateFederationBody,
  UpdateFederationResponse,
} from "@workspace/api-zod";
import { mapFederation } from "../lib/mappers";

const router: IRouter = Router();

router.get("/leagues/:leagueId/federation", async (req, res): Promise<void> => {
  const params = GetFederationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(federationsTable)
    .where(eq(federationsTable.leagueId, params.data.leagueId));
  if (!row) {
    res.status(404).json({ error: "Federation not found" });
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
  const d = parsed.data;
  const [row] = await db
    .update(federationsTable)
    .set({
      ...(d.name !== undefined && { name: d.name }),
      ...(d.mode !== undefined && { mode: d.mode }),
      ...(d.voto_source !== undefined && { votoSource: d.voto_source }),
      ...(d.feature_flags !== undefined && { featureFlags: d.feature_flags }),
    })
    .where(eq(federationsTable.leagueId, params.data.leagueId))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Federation not found" });
    return;
  }
  res.json(UpdateFederationResponse.parse(mapFederation(row)));
});

export default router;
