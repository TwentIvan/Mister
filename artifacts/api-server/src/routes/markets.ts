import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { marketEventsTable } from "@workspace/db";
import {
  GetLeagueMarketsParams,
  GetLeagueMarketsResponse,
  CreateMarketEventParams,
  CreateMarketEventBody,
  GetMarketEventParams,
  GetMarketEventResponse,
  UpdateMarketEventParams,
  UpdateMarketEventBody,
  UpdateMarketEventResponse,
  DeleteMarketEventParams,
} from "@workspace/api-zod";
import { mapMarket } from "../lib/mappers";

const router: IRouter = Router();

router.get("/leagues/:leagueId/markets", async (req, res): Promise<void> => {
  const params = GetLeagueMarketsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(marketEventsTable)
    .where(eq(marketEventsTable.leagueId, params.data.leagueId));
  res.json(GetLeagueMarketsResponse.parse(rows.map(mapMarket)));
});

router.post("/leagues/:leagueId/markets", async (req, res): Promise<void> => {
  const params = CreateMarketEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateMarketEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .insert(marketEventsTable)
    .values({
      id: nanoid(),
      leagueId: params.data.leagueId,
      name: d.name,
      description: d.description ?? "",
      type: d.type,
      windowStartsAt: d.window_starts_at,
      windowEndsAt: d.window_ends_at,
      settings: d.settings ?? null,
      labelColor: d.label_color ?? "#1f4733",
    })
    .returning();
  res.status(201).json(GetMarketEventResponse.parse(mapMarket(row)));
});

router.get("/leagues/:leagueId/markets/:id", async (req, res): Promise<void> => {
  const p = GetMarketEventParams.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(marketEventsTable)
    .where(and(eq(marketEventsTable.leagueId, p.data.leagueId), eq(marketEventsTable.id, p.data.id)));
  if (!row) {
    res.status(404).json({ error: "Market event not found" });
    return;
  }
  res.json(GetMarketEventResponse.parse(mapMarket(row)));
});

router.patch("/leagues/:leagueId/markets/:id", async (req, res): Promise<void> => {
  const p = UpdateMarketEventParams.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  const parsed = UpdateMarketEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .update(marketEventsTable)
    .set({
      ...(d.name !== undefined && { name: d.name }),
      ...(d.status !== undefined && { status: d.status }),
      ...(d.window_starts_at !== undefined && { windowStartsAt: d.window_starts_at }),
      ...(d.window_ends_at !== undefined && { windowEndsAt: d.window_ends_at }),
    })
    .where(and(eq(marketEventsTable.leagueId, p.data.leagueId), eq(marketEventsTable.id, p.data.id)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Market event not found" });
    return;
  }
  res.json(UpdateMarketEventResponse.parse(mapMarket(row)));
});

router.delete("/leagues/:leagueId/markets/:id", async (req, res): Promise<void> => {
  const p = DeleteMarketEventParams.safeParse(req.params);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  const [row] = await db
    .delete(marketEventsTable)
    .where(and(eq(marketEventsTable.leagueId, p.data.leagueId), eq(marketEventsTable.id, p.data.id)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Market event not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
