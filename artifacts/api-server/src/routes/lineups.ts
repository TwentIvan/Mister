import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { lineups, lineupPlayers, contracts, players as playersTable } from "@workspace/db";
import {
  GetLineupsQueryParams,
  GetLineupsResponse,
  PutLineupBody,
  PutLineupResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Helpers ────────────────────────────────────────────────────────────────

function parseFormation(module: string): number[] {
  return [1, ...module.split("-").map(Number)];
}

function slotPositionForRow(rowIdx: number, totalRows: number): string {
  if (rowIdx === 0) return "GK";
  if (rowIdx === 1) return "DEF";
  if (rowIdx === totalRows - 1) return "ATT";
  if (rowIdx === totalRows - 2 && totalRows >= 5) return "T";
  return "MID";
}

function buildLineupResult(
  lineupRow: typeof lineups.$inferSelect,
  playerRows: (typeof lineupPlayers.$inferSelect)[],
) {
  return {
    id: lineupRow.id,
    fantaTeamId: lineupRow.fantaTeamId,
    season: lineupRow.season,
    round: lineupRow.round,
    module: lineupRow.module,
    captainPlayerId: lineupRow.captainPlayerId ?? null,
    submittedAt: lineupRow.submittedAt ?? null,
    lockedAt: lineupRow.lockedAt ?? null,
    players: playerRows.map(p => ({
      playerId: p.playerId,
      slotPosition: p.slotPosition as "GK" | "DEF" | "MID" | "T" | "ATT",
      slotIndex: p.slotIndex,
      isStarter: p.isStarter,
      benchOrder: p.benchOrder ?? null,
    })),
  };
}

// ── GET /lineups ───────────────────────────────────────────────────────────

router.get("/lineups", async (req, res): Promise<void> => {
  const params = GetLineupsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { fantaTeamId, season, round } = params.data;

  const [lineupRow] = await db
    .select()
    .from(lineups)
    .where(and(
      eq(lineups.fantaTeamId, fantaTeamId),
      eq(lineups.season, season),
      eq(lineups.round, round),
    ))
    .limit(1);

  if (!lineupRow) {
    res.json(null);
    return;
  }

  const playerRows = await db
    .select()
    .from(lineupPlayers)
    .where(eq(lineupPlayers.lineupId, lineupRow.id));

  res.json(GetLineupsResponse.parse(buildLineupResult(lineupRow, playerRows)));
});

// ── PUT /lineups ───────────────────────────────────────────────────────────

router.put("/lineups", async (req, res): Promise<void> => {
  const parsed = PutLineupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: [parsed.error.message] });
    return;
  }

  const body = parsed.data;
  const errors: string[] = [];

  // ── Regola 1: esattamente 11 titolari ─────────────────────────────────────
  const starters = body.players.filter(p => p.isStarter);
  if (starters.length !== 11) {
    errors.push(`Servono esattamente 11 titolari; trovati ${starters.length}`);
  }

  // ── Regola 2: distribuzione ruoli corrisponde al modulo ───────────────────
  const formation = parseFormation(body.module);
  const totalRows = formation.length;
  const expectedCounts: Record<string, number> = {};
  formation.forEach((count, rowIdx) => {
    const pos = slotPositionForRow(rowIdx, totalRows);
    expectedCounts[pos] = (expectedCounts[pos] ?? 0) + count;
  });
  const actualCounts: Record<string, number> = {};
  starters.forEach(p => {
    actualCounts[p.slotPosition] = (actualCounts[p.slotPosition] ?? 0) + 1;
  });
  for (const [pos, expected] of Object.entries(expectedCounts)) {
    const actual = actualCounts[pos] ?? 0;
    if (actual !== expected) {
      errors.push(`Posizione ${pos}: attesi ${expected} titolari, trovati ${actual}`);
    }
  }

  // ── Regola 4: capitano tra i titolari (o null) ────────────────────────────
  if (body.captainPlayerId != null) {
    const isStarterCaptain = starters.some(p => p.playerId === body.captainPlayerId);
    if (!isStarterCaptain) {
      errors.push(`Il capitano (playerId ${body.captainPlayerId}) deve essere tra i titolari`);
    }
  }

  // ── Regola 6: no playerId duplicati ───────────────────────────────────────
  const playerIdSet = new Set<number>();
  const duplicates: number[] = [];
  for (const p of body.players) {
    if (playerIdSet.has(p.playerId)) duplicates.push(p.playerId);
    playerIdSet.add(p.playerId);
  }
  if (duplicates.length > 0) {
    errors.push(`Giocatori duplicati: ${duplicates.join(", ")}`);
  }

  // ── Regola 7: slotIndex unico ─────────────────────────────────────────────
  const slotIndexSet = new Set<number>();
  const dupSlots: number[] = [];
  for (const p of body.players) {
    if (slotIndexSet.has(p.slotIndex)) dupSlots.push(p.slotIndex);
    slotIndexSet.add(p.slotIndex);
  }
  if (dupSlots.length > 0) {
    errors.push(`slotIndex duplicati: ${dupSlots.join(", ")}`);
  }

  // ── Regola 3: posizione T ammette solo ruolo C (MID) ─────────────────────
  const tSlotPlayerIds = body.players
    .filter(p => p.slotPosition === "T")
    .map(p => p.playerId);
  if (tSlotPlayerIds.length > 0) {
    const tPlayers = await db
      .select({ id: playersTable.id, roleClassic: playersTable.roleClassic })
      .from(playersTable)
      .where(inArray(playersTable.id, tSlotPlayerIds));
    const nonMid = tPlayers.filter(p => p.roleClassic !== "MID");
    if (nonMid.length > 0) {
      errors.push(`Posizione T richiede ruolo C; non validi: ${nonMid.map(p => p.id).join(", ")}`);
    }
  }

  // ── Regola 5: tutti i playerId in rosa (contratti attivi) ─────────────────
  // Nota: se la rosa non ha contratti attivi (es. squadra MVP senza asta),
  // la validazione viene saltata per non bloccare lo sviluppo.
  const activeContracts = await db
    .select({ playerId: contracts.playerId })
    .from(contracts)
    .where(and(
      eq(contracts.fantaTeamId, body.fantaTeamId),
      eq(contracts.state, "active"),
    ));
  if (activeContracts.length > 0) {
    const rosterIds = new Set(activeContracts.map(c => c.playerId));
    const notInRoster = body.players.filter(p => !rosterIds.has(p.playerId));
    if (notInRoster.length > 0) {
      errors.push(`Giocatori non in rosa: ${notInRoster.map(p => p.playerId).join(", ")}`);
    }
  }

  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }

  // ── Upsert transazionale ──────────────────────────────────────────────────
  let lockedError = false;

  const savedLineup = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(lineups)
      .where(and(
        eq(lineups.fantaTeamId, body.fantaTeamId),
        eq(lineups.season, body.season),
        eq(lineups.round, body.round),
      ))
      .limit(1);

    let lineupId: number;

    if (existing) {
      if (existing.lockedAt !== null) {
        lockedError = true;
        throw new Error("Lineup bloccato");
      }
      const [updated] = await tx
        .update(lineups)
        .set({
          module: body.module,
          captainPlayerId: body.captainPlayerId ?? null,
          submittedAt: new Date(),
        })
        .where(eq(lineups.id, existing.id))
        .returning();
      lineupId = updated.id;
      await tx.delete(lineupPlayers).where(eq(lineupPlayers.lineupId, lineupId));
    } else {
      const [inserted] = await tx
        .insert(lineups)
        .values({
          fantaTeamId: body.fantaTeamId,
          season: body.season,
          round: body.round,
          module: body.module,
          captainPlayerId: body.captainPlayerId ?? null,
          submittedAt: new Date(),
        })
        .returning();
      lineupId = inserted.id;
    }

    await tx.insert(lineupPlayers).values(
      body.players.map(p => ({
        lineupId,
        playerId: p.playerId,
        slotPosition: p.slotPosition,
        slotIndex: p.slotIndex,
        isStarter: p.isStarter,
        benchOrder: p.benchOrder ?? null,
      }))
    );

    const [finalLineup] = await tx
      .select()
      .from(lineups)
      .where(eq(lineups.id, lineupId))
      .limit(1);

    const finalPlayers = await tx
      .select()
      .from(lineupPlayers)
      .where(eq(lineupPlayers.lineupId, lineupId));

    return { lineup: finalLineup, players: finalPlayers };
  }).catch((err: unknown) => {
    if (lockedError) return null;
    throw err;
  });

  if (lockedError || savedLineup === null) {
    res.status(403).json({ error: "Lineup bloccato — deadline passata" });
    return;
  }

  res.json(PutLineupResponse.parse(buildLineupResult(savedLineup.lineup, savedLineup.players)));
});

export default router;
