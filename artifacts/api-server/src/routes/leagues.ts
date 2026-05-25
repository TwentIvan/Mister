import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import {
  leaguesTable,
  federationsTable,
  competitionsTable,
  marketEventsTable,
  fantaTeamsTable,
  contractsTable,
} from "@workspace/db";
import {
  ListLeaguesQueryParams,
  ListLeaguesResponse,
  CreateLeagueBody,
  GetLeagueParams,
  GetLeagueResponse,
  UpdateLeagueParams,
  UpdateLeagueBody,
  UpdateLeagueResponse,
  DeleteLeagueParams,
  GetLeagueStatsParams,
  GetLeagueStatsResponse,
} from "@workspace/api-zod";
import { mapLeague } from "../lib/mappers";

const router: IRouter = Router();

router.get("/leagues", async (req, res): Promise<void> => {
  const parsed = ListLeaguesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { admin_user_id } = parsed.data;
  const rows = admin_user_id
    ? await db.select().from(leaguesTable).where(eq(leaguesTable.adminUserId, admin_user_id))
    : await db.select().from(leaguesTable);
  res.json(ListLeaguesResponse.parse(rows.map(mapLeague)));
});

router.post("/leagues", async (req, res): Promise<void> => {
  const parsed = CreateLeagueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const leagueId = nanoid();
  const fedId = nanoid();
  await db.insert(federationsTable).values({
    id: fedId,
    name: parsed.data.name + " - Regolamento",
    leagueId,
    featureFlags: {},
  });
  const d = parsed.data;
  const [row] = await db
    .insert(leaguesTable)
    .values({
      id: leagueId,
      federationId: fedId,
      name: d.name,
      templateId: d.template_id,
      adminUserId: d.admin_user_id,
      season: d.season,
      maxManagers: d.max_managers ?? 10,
      visibility: d.visibility ?? "private",
    })
    .returning();
  res.status(201).json(GetLeagueResponse.parse(mapLeague(row)));
});

router.get("/leagues/:id", async (req, res): Promise<void> => {
  const params = GetLeagueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(leaguesTable)
    .where(eq(leaguesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "League not found" });
    return;
  }
  res.json(GetLeagueResponse.parse(mapLeague(row)));
});

router.patch("/leagues/:id", async (req, res): Promise<void> => {
  const params = UpdateLeagueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateLeagueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .update(leaguesTable)
    .set({
      ...(d.name !== undefined && { name: d.name }),
      ...(d.max_managers !== undefined && { maxManagers: d.max_managers }),
      ...(d.visibility !== undefined && { visibility: d.visibility }),
      ...(d.started !== undefined && { started: d.started }),
    })
    .where(eq(leaguesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "League not found" });
    return;
  }
  res.json(UpdateLeagueResponse.parse(mapLeague(row)));
});

router.delete("/leagues/:id", async (req, res): Promise<void> => {
  const params = DeleteLeagueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(leaguesTable)
    .where(eq(leaguesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "League not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/leagues/:id/stats", async (req, res): Promise<void> => {
  const params = GetLeagueStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { id } = params.data;
  const [teams] = await db
    .select({ count: count() })
    .from(fantaTeamsTable)
    .where(eq(fantaTeamsTable.leagueId, id));
  const [competitions] = await db
    .select({ count: count() })
    .from(competitionsTable)
    .where(eq(competitionsTable.leagueId, id));
  const [markets] = await db
    .select({ count: count() })
    .from(marketEventsTable)
    .where(eq(marketEventsTable.leagueId, id));
  const [contracts] = await db
    .select({ count: count() })
    .from(contractsTable)
    .where(eq(contractsTable.leagueId, id));
  res.json(
    GetLeagueStatsResponse.parse({
      team_count: Number(teams?.count ?? 0),
      competition_count: Number(competitions?.count ?? 0),
      active_market_count: Number(markets?.count ?? 0),
      contract_count: Number(contracts?.count ?? 0),
    }),
  );
});

export default router;
