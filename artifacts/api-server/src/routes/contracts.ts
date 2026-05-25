import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { contracts } from "@workspace/db";
import {
  GetLeagueContractsParams,
  GetLeagueContractsResponse,
  CreateContractParams,
  CreateContractBody,
  GetContractParams,
  GetContractResponse,
  UpdateContractParams,
  UpdateContractBody,
  UpdateContractResponse,
} from "@workspace/api-zod";
import { mapContract } from "../lib/mappers";

const router: IRouter = Router();

router.get("/leagues/:leagueId/contracts", async (req, res): Promise<void> => {
  const params = GetLeagueContractsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(contracts)
    .where(eq(contracts.leagueId, params.data.leagueId));
  res.json(GetLeagueContractsResponse.parse(rows.map(mapContract)));
});

router.post("/leagues/:leagueId/contracts", async (req, res): Promise<void> => {
  const params = CreateContractParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateContractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .insert(contracts)
    .values({
      id: nanoid(),
      leagueId: params.data.leagueId,
      fantaTeamId: d.fanta_team_id,
      playerId: d.player_id,
      seasonStart: d.season_start,
      durationSeasons: d.duration_seasons,
      purchasePrice: d.purchase_price,
      clauseDefault: d.clause_default,
      clauseInvestment: d.clause_investment ?? 0,
    })
    .returning();
  res.status(201).json(GetContractResponse.parse(mapContract(row)));
});

router.get("/leagues/:leagueId/contracts/:id", async (req, res): Promise<void> => {
  const p = GetContractParams.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.leagueId, p.data.leagueId), eq(contracts.id, p.data.id)));
  if (!row) {
    res.status(404).json({ error: "Contratto non trovato" });
    return;
  }
  res.json(GetContractResponse.parse(mapContract(row)));
});

router.patch("/leagues/:leagueId/contracts/:id", async (req, res): Promise<void> => {
  const p = UpdateContractParams.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  const parsed = UpdateContractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .update(contracts)
    .set({
      ...(d.state !== undefined && { state: d.state }),
      ...(d.clause_investment !== undefined && { clauseInvestment: d.clause_investment }),
      ...(d.notes !== undefined && { notes: d.notes }),
      ...(d.closed_at !== undefined && { closedAt: d.closed_at ? new Date(d.closed_at) : null }),
    })
    .where(and(eq(contracts.leagueId, p.data.leagueId), eq(contracts.id, p.data.id)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Contratto non trovato" });
    return;
  }
  res.json(UpdateContractResponse.parse(mapContract(row)));
});

export default router;
