import { Router, type IRouter } from "express";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db, pool, votoAlgorithmConfig, playerGiornataStats } from "@workspace/db";
import {
  ListVotoAlgorithmConfigsQueryParams,
  CreateVotoAlgorithmConfigBody,
  UpdateVotoAlgorithmConfigParams,
  UpdateVotoAlgorithmConfigBody,
  RecalculateVotoMisterQueryParams,
} from "@workspace/api-zod";
import { computeVoti, loadActiveConfig } from "@workspace/voto-engine";
import type { StatsJson } from "@workspace/voto-engine";

const router: IRouter = Router();

// ─── GET /voto-algorithm-configs ────────────────────────────────────────────

router.get("/voto-algorithm-configs", async (req, res): Promise<void> => {
  const parsed = ListVotoAlgorithmConfigsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = [];
  const { federationId, status } = parsed.data;

  if (federationId === "null") {
    conditions.push(isNull(votoAlgorithmConfig.federationId));
  } else if (federationId != null && federationId !== "") {
    conditions.push(eq(votoAlgorithmConfig.federationId, federationId));
  }
  if (status) {
    conditions.push(eq(votoAlgorithmConfig.status, status));
  }

  const rows = await db
    .select()
    .from(votoAlgorithmConfig)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(votoAlgorithmConfig.createdAt));

  res.json(rows);
});

// ─── POST /voto-algorithm-configs/recalculate ────────────────────────────────
// DEVE stare prima di /:id per evitare che Express interpreti "recalculate" come id

router.post("/voto-algorithm-configs/recalculate", async (req, res): Promise<void> => {
  const parsed = RecalculateVotoMisterQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const federationId = (parsed.data.federationId ?? null) as string | null;
  const startTime = Date.now();

  let config;
  try {
    config = await loadActiveConfig(federationId);
  } catch {
    res.status(404).json({ error: "Nessuna configurazione algoritmo attiva trovata" });
    return;
  }

  const rows = await db
    .select({ id: playerGiornataStats.id, statsJson: playerGiornataStats.statsJson })
    .from(playerGiornataStats);

  const toUpdate: Array<{ id: number; voto: number }> = [];
  let skippedCount = 0;

  for (const row of rows) {
    const v = computeVoti(row.statsJson as StatsJson, config);
    if (v.votoSynthesis !== null) {
      toUpdate.push({ id: row.id, voto: v.votoSynthesis });
    } else {
      skippedCount++;
    }
  }

  if (toUpdate.length > 0) {
    const valuesClause = toUpdate.map(c => `(${c.id}, ${c.voto})`).join(",\n  ");
    await pool.query(`
      UPDATE player_giornata_stats AS t
      SET voto_mister = v.voto::real
      FROM (VALUES
        ${valuesClause}
      ) AS v(id, voto)
      WHERE t.id = v.id
    `);
  }

  res.json({
    updatedCount: toUpdate.length,
    skippedCount,
    durationMs: Date.now() - startTime,
  });
});

// ─── POST /voto-algorithm-configs ───────────────────────────────────────────

router.post("/voto-algorithm-configs", async (req, res): Promise<void> => {
  const parsed = CreateVotoAlgorithmConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const body = parsed.data;

  try {
    await db.transaction(async (tx) => {
      if (body.status === "active") {
        await tx
          .update(votoAlgorithmConfig)
          .set({ status: "archived" })
          .where(
            and(
              body.federationId
                ? eq(votoAlgorithmConfig.federationId, body.federationId)
                : isNull(votoAlgorithmConfig.federationId),
              eq(votoAlgorithmConfig.status, "active"),
            ),
          );
      }

      const [created] = await tx
        .insert(votoAlgorithmConfig)
        .values({
          federationId: body.federationId ?? null,
          version: body.version,
          configJson: body.configJson,
          status: body.status,
          isProtected: false,
          notes: body.notes ?? null,
          createdBy: "api",
        })
        .returning();

      res.status(201).json(created);
    });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      res.status(409).json({ error: "Vincolo unique violato: esiste già una configurazione attiva per questa federazione" });
      return;
    }
    throw err;
  }
});

// ─── PATCH /voto-algorithm-configs/:id ──────────────────────────────────────

router.patch("/voto-algorithm-configs/:id", async (req, res): Promise<void> => {
  const params = UpdateVotoAlgorithmConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateVotoAlgorithmConfigBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(votoAlgorithmConfig)
    .where(eq(votoAlgorithmConfig.id, params.data.id))
    .limit(1);

  if (existing.length === 0) {
    res.status(404).json({ error: "Configurazione non trovata" });
    return;
  }

  const current = existing[0]!;
  const patch = body.data;

  const updated = await db.transaction(async (tx) => {
    if (patch.status === "active") {
      await tx
        .update(votoAlgorithmConfig)
        .set({ status: "archived" })
        .where(
          and(
            current.federationId
              ? eq(votoAlgorithmConfig.federationId, current.federationId)
              : isNull(votoAlgorithmConfig.federationId),
            eq(votoAlgorithmConfig.status, "active"),
          ),
        );
    }

    const setValues: Partial<typeof current> = {};
    if (patch.configJson !== undefined) setValues.configJson = patch.configJson;
    if (patch.status !== undefined) setValues.status = patch.status;
    if (patch.notes !== undefined) setValues.notes = patch.notes;

    const [row] = await tx
      .update(votoAlgorithmConfig)
      .set(setValues)
      .where(eq(votoAlgorithmConfig.id, params.data.id))
      .returning();

    return row;
  });

  res.json(updated);
});

export default router;
