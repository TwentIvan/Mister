import { Router, type IRouter } from "express";
import { eq, ilike, or, and, count, SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { playersTable } from "@workspace/db";
import {
  ListPlayersQueryParams,
  ListPlayersResponse,
  GetPlayerParams,
  GetPlayerResponse,
} from "@workspace/api-zod";
import { mapPlayer } from "../lib/mappers";

const router: IRouter = Router();

router.get("/players", async (req, res): Promise<void> => {
  const parsed = ListPlayersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, role, team, limit, offset } = parsed.data;
  const conditions: SQL[] = [];
  if (search) {
    conditions.push(
      or(
        ilike(playersTable.name, `%${search}%`),
        ilike(playersTable.fullName, `%${search}%`),
      ) as SQL,
    );
  }
  if (role) conditions.push(eq(playersTable.roleClassic, role));
  if (team) conditions.push(eq(playersTable.realTeam, team));

  const lim = limit ?? 50;
  const off = offset ?? 0;

  if (conditions.length) {
    const where = conditions.reduce((a, b) => and(a, b) as SQL);
    const rows = await db.select().from(playersTable).where(where).limit(lim).offset(off);
    const [{ total }] = await db.select({ total: count() }).from(playersTable).where(where);
    res.json(ListPlayersResponse.parse({ items: rows.map(mapPlayer), total: Number(total), limit: lim, offset: off }));
    return;
  }

  const rows = await db.select().from(playersTable).limit(lim).offset(off);
  const [{ total }] = await db.select({ total: count() }).from(playersTable);
  res.json(ListPlayersResponse.parse({ items: rows.map(mapPlayer), total: Number(total), limit: lim, offset: off }));
});

router.get("/players/:id", async (req, res): Promise<void> => {
  const params = GetPlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json(GetPlayerResponse.parse(mapPlayer(row)));
});

export default router;
