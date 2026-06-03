import { Router, type IRouter, type Response } from "express";
import { eq, and, asc, desc, count, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import {
  auctions,
  auctionBids,
  auctionAssignments,
  auctionPlayerQueue,
  fantaTeams,
  players,
  contracts,
  leagues,
  federations,
  type Auction,
  type AuctionBid,
} from "@workspace/db";
import {
  CreateAuctionBody,
  GetAuctionParams,
  CreateAuctionBidParams,
  CreateAuctionBidBody,
  AssignAuctionParams,
  AssignAuctionBody,
  SkipAuctionParams,
  SkipAuctionBody,
  PauseAuctionParams,
  ResumeAuctionParams,
  EndAuctionParams,
  UndoAuctionParams,
  ManualAddPlayerParams,
  ManualAddPlayerBody,
  ManualRemovePlayerParams,
  ManualRemovePlayerBody,
  ManualSetBudgetParams,
  ManualSetBudgetBody,
  ManualUpdatePriceParams,
  ManualUpdatePriceBody,
  CallPlayerParams,
  CallPlayerBody,
} from "@workspace/api-zod";
import { mapFantaTeam } from "../lib/mappers";

const router: IRouter = Router();

function mapAuction(a: Auction) {
  return {
    id: a.id,
    league_id: a.leagueId,
    status: a.status,
    timer_seconds: a.timerSeconds,
    roster_p: a.rosterP,
    roster_d: a.rosterD,
    roster_c: a.rosterC,
    roster_a: a.rosterA,
    undoable: a.lastUndoableAction !== null && a.lastUndoableAction !== undefined,
    call_mode: a.callMode,
    role_order: a.roleOrder,
    deadline_ts: a.deadlineTs ? a.deadlineTs.getTime() : null,
    paused_remaining_ms: a.pausedRemainingMs,
    started_at: a.startedAt ?? null,
    completed_at: a.completedAt ?? null,
    created_at: a.createdAt,
  };
}

function mapBid(b: AuctionBid) {
  return {
    id: b.id,
    auction_id: b.auctionId,
    player_id: b.playerId,
    fanta_team_id: b.fantaTeamId,
    amount_fm: b.amountFm,
    valid: b.valid,
    created_at: b.createdAt,
  };
}

// ── Helper svincolato — fonte di verità condivisa da manual/add e /call ──────
// Restituisce il nome della squadra che detiene il giocatore in questa asta,
// o null se è svincolato.  Usare per rifiutare con "Giocatore già di [squadra]".
async function getOwnerTeam(auctionId: string, playerId: number): Promise<string | null> {
  const [row] = await db
    .select({ teamName: fantaTeams.name })
    .from(auctionAssignments)
    .innerJoin(fantaTeams, eq(fantaTeams.id, auctionAssignments.fantaTeamId))
    .where(
      and(
        eq(auctionAssignments.auctionId, auctionId),
        eq(auctionAssignments.playerId, playerId),
      ),
    );
  return row?.teamName ?? null;
}

// ── Helper ruolo aperto (role_order) ─────────────────────────────────────────
// Restituisce il primo ruolo P→D→C→A per cui NON tutte le squadre hanno
// raggiunto la quota (roster_p/d/c/a). null = tutti i ruoli completi.
async function computeCurrentOpenRole(
  auctionId: string,
  leagueId: string,
  rosterP: number,
  rosterD: number,
  rosterC: number,
  rosterA: number,
): Promise<"GK" | "DEF" | "MID" | "ATT" | null> {
  const [teamRows, assignRows] = await Promise.all([
    db.select({ id: fantaTeams.id }).from(fantaTeams).where(eq(fantaTeams.leagueId, leagueId)),
    db
      .select({ fantaTeamId: auctionAssignments.fantaTeamId, role: players.roleClassic })
      .from(auctionAssignments)
      .innerJoin(players, eq(auctionAssignments.playerId, players.id))
      .where(eq(auctionAssignments.auctionId, auctionId)),
  ]);

  const quotas: Record<string, number> = { GK: rosterP, DEF: rosterD, MID: rosterC, ATT: rosterA };
  const roleOrder = ["GK", "DEF", "MID", "ATT"] as const;

  for (const role of roleOrder) {
    const countByTeam = new Map<string, number>();
    for (const a of assignRows) {
      if (a.role === role) countByTeam.set(a.fantaTeamId, (countByTeam.get(a.fantaTeamId) ?? 0) + 1);
    }
    const allFull = teamRows.every((t) => (countByTeam.get(t.id) ?? 0) >= quotas[role]);
    if (!allFull) return role;
  }
  return null;
}

// ── Giocatore corrente in asta ────────────────────────────────────────────────
// listone  → primo 'pending'  (avanzamento automatico)
// chiamata → primo 'called'   (chiamato esplicitamente dal banditore)
async function getCurrentQueuePlayer(auctionId: string, callMode = "listone") {
  const targetStatus = callMode === "chiamata" ? "called" : "pending";
  const rows = await db
    .select({
      playerId: auctionPlayerQueue.playerId,
      position: auctionPlayerQueue.position,
      status: auctionPlayerQueue.status,
      playerName: players.name,
      playerFullName: players.fullName,
      playerRole: players.roleClassic,
      playerTeam: players.realTeam,
      playerPhotoUrl: players.photoUrl,
    })
    .from(auctionPlayerQueue)
    .innerJoin(players, eq(auctionPlayerQueue.playerId, players.id))
    .where(
      and(
        eq(auctionPlayerQueue.auctionId, auctionId),
        eq(auctionPlayerQueue.status, targetStatus),
      ),
    )
    .orderBy(asc(auctionPlayerQueue.position))
    .limit(1);
  return rows[0] ?? null;
}

// Back-compat alias usato dove non si ha il callMode a portata di mano
const getNextPendingPlayer = (auctionId: string) => getCurrentQueuePlayer(auctionId, "listone");

type PlayerRow = NonNullable<Awaited<ReturnType<typeof getNextPendingPlayer>>>;

function mapPlayerEntry(row: PlayerRow) {
  return {
    player_id: row.playerId,
    position: row.position,
    status: row.status,
    name: row.playerName,
    full_name: row.playerFullName,
    role_classic: row.playerRole,
    real_team: row.playerTeam,
    photo_url: row.playerPhotoUrl ?? null,
  };
}

// ── SSE subscribers + buildAuctionState + notifyAuction ──────────────────────

const sseClients = new Map<string, Set<Response>>();

async function buildAuctionState(id: string) {
  const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
  if (!auction) return null;

  const currentPlayerRow = await getCurrentQueuePlayer(id, auction.callMode);
  let currentBid: AuctionBid | null = null;
  let bidsHistory: AuctionBid[] = [];

  if (currentPlayerRow) {
    const { playerId } = currentPlayerRow;
    const [topBid] = await db
      .select().from(auctionBids)
      .where(and(eq(auctionBids.auctionId, id), eq(auctionBids.playerId, playerId), eq(auctionBids.valid, true)))
      .orderBy(desc(auctionBids.amountFm)).limit(1);
    currentBid = topBid ?? null;
    bidsHistory = await db
      .select().from(auctionBids)
      .where(and(eq(auctionBids.auctionId, id), eq(auctionBids.playerId, playerId), eq(auctionBids.valid, true)))
      .orderBy(desc(auctionBids.createdAt)).limit(10);
  }

  const teams = await db.select().from(fantaTeams).where(eq(fantaTeams.leagueId, auction.leagueId));

  const assignmentRows = await db
    .select({
      playerId: auctionAssignments.playerId,
      playerName: players.name,
      roleClassic: players.roleClassic,
      fantaTeamId: auctionAssignments.fantaTeamId,
      finalPriceFm: auctionAssignments.finalPriceFm,
    })
    .from(auctionAssignments)
    .innerJoin(players, eq(auctionAssignments.playerId, players.id))
    .where(eq(auctionAssignments.auctionId, id));

  const [totalRow] = await db
    .select({ count: count() }).from(auctionPlayerQueue)
    .where(eq(auctionPlayerQueue.auctionId, id));
  const [soldRow] = await db
    .select({ count: count() }).from(auctionPlayerQueue)
    .where(and(eq(auctionPlayerQueue.auctionId, id), eq(auctionPlayerQueue.status, "sold")));

  const total = Number(totalRow?.count ?? 0);
  const sold = Number(soldRow?.count ?? 0);
  const currentPosition = currentPlayerRow?.position ?? total;

  return {
    auction: mapAuction(auction),
    current_player: currentPlayerRow ? mapPlayerEntry(currentPlayerRow) : null,
    current_bid: currentBid ? mapBid(currentBid) : null,
    bids_history: bidsHistory.map(mapBid),
    squadre: teams.map(mapFantaTeam),
    progress: { current: currentPosition + 1, total, sold },
    assignments: assignmentRows.map((a) => ({
      player_id: a.playerId,
      player_name: a.playerName,
      role_classic: a.roleClassic,
      fanta_team_id: a.fantaTeamId,
      final_price_fm: a.finalPriceFm,
    })),
  };
}

function notifyAuction(id: string): void {
  const clients = sseClients.get(id);
  if (!clients?.size) return;
  void buildAuctionState(id).then((state) => {
    if (!state) return;
    const msg = `data: ${JSON.stringify(state)}\n\n`;
    for (const client of clients) {
      try { client.write(msg); } catch { /* client disconnesso */ }
    }
  });
}

// ─── POST /auctions ───────────────────────────────────────

router.post("/auctions", async (req, res): Promise<void> => {
  const parsed = CreateAuctionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const {
    league_id: leagueId,
    timer_seconds = 8,
    team_names = {},
    roster_p = 3,
    roster_d = 8,
    roster_c = 8,
    roster_a = 6,
    call_mode: callMode = "listone",
    role_order: roleOrder = false,
  } = parsed.data;

  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId));
  if (!league) {
    res.status(400).json({ error: "Lega non trovata" });
    return;
  }

  const [teamCount] = await db
    .select({ count: count() })
    .from(fantaTeams)
    .where(eq(fantaTeams.leagueId, leagueId));
  if (Number(teamCount?.count ?? 0) < 4) {
    res.status(400).json({ error: "La lega deve avere almeno 4 squadre per avviare l'asta" });
    return;
  }

  const active = await db
    .select()
    .from(auctions)
    .where(
      and(
        eq(auctions.leagueId, leagueId),
        sql`${auctions.status} IN ('running', 'paused')`,
      ),
    );
  if (active.length > 0) {
    res.status(409).json({
      error: "Esiste già un'asta attiva per questa lega",
      existing_auction_id: active[0].id,
    });
    return;
  }

  const playerPool = await db
    .select()
    .from(players)
    .orderBy(
      sql`CASE ${players.roleClassic} WHEN 'GK' THEN 1 WHEN 'DEF' THEN 2 WHEN 'MID' THEN 3 WHEN 'ATT' THEN 4 ELSE 5 END`,
      asc(players.name),
      asc(players.fullName),
    );

  // Aggiorna nome_asta dei team se forniti nella config
  if (Object.keys(team_names).length > 0) {
    await Promise.all(
      Object.entries(team_names).map(([teamId, nameAuction]) =>
        db.update(fantaTeams)
          .set({ nameAuction })
          .where(and(eq(fantaTeams.id, teamId), eq(fantaTeams.leagueId, leagueId)))
      )
    );
  }

  const auctionId = `auc-${nanoid(8)}`;

  try {
    const auction = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(auctions)
        .values({
          id: auctionId,
          leagueId,
          status: "running",
          startedAt: new Date(),
          timerSeconds: timer_seconds,
          rosterP: roster_p,
          rosterD: roster_d,
          rosterC: roster_c,
          rosterA: roster_a,
          callMode,
          roleOrder,
        })
        .returning();

      if (playerPool.length > 0) {
        const queueRows = playerPool.map((p, idx) => ({
          id: `apq-${nanoid(8)}`,
          auctionId,
          playerId: p.id,
          position: idx,
          status: "pending" as const,
        }));
        const chunkSize = 500;
        for (let i = 0; i < queueRows.length; i += chunkSize) {
          await tx.insert(auctionPlayerQueue).values(queueRows.slice(i, i + chunkSize));
        }
      }

      return row;
    });

    // In chiamata: il primo giocatore non viene impostato automaticamente
    const firstPlayer = callMode === "chiamata" ? null : await getCurrentQueuePlayer(auctionId, "listone");

    res.status(201).json({
      auction: mapAuction(auction),
      current_player_id: firstPlayer?.playerId ?? null,
      total_players: playerPool.length,
    });
  } catch (err) {
    req.log.error({ err }, "Errore creazione asta");
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── GET /auctions/:id ────────────────────────────────────

router.get("/auctions/:id", async (req, res): Promise<void> => {
  const params = GetAuctionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const state = await buildAuctionState(params.data.id);
  if (!state) {
    res.status(404).json({ error: "Asta non trovata" });
    return;
  }
  res.json(state);
});

// ─── GET /auctions/:id/stream (SSE) ───────────────────────

router.get("/auctions/:id/stream", (req, res): void => {
  const { id } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  if (!sseClients.has(id)) sseClients.set(id, new Set());
  const clientSet = sseClients.get(id)!;
  clientSet.add(res);

  // Stato corrente immediato alla connessione (no-op se asta non trovata)
  void buildAuctionState(id).then((state) => {
    if (!state) return;
    try { res.write(`data: ${JSON.stringify(state)}\n\n`); } catch { /* ignore */ }
  });

  // Heartbeat ogni 25 s per tenere viva la connessione attraverso i proxy
  const heartbeatId = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeatId); }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeatId);
    clientSet.delete(res);
    if (clientSet.size === 0) sseClients.delete(id);
  });
});

// ─── POST /auctions/:id/bid ───────────────────────────────

router.post("/auctions/:id/bid", async (req, res): Promise<void> => {
  const params = CreateAuctionBidParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = CreateAuctionBidBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  const { id } = params.data;
  const { player_id: playerId, fanta_team_id: fantaTeamId, amount_fm: amountFm } = body.data;

  const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
  if (!auction || auction.status !== "running") {
    res.status(403).json({ error: "L'asta non è in corso" });
    return;
  }

  const currentPlayer = await getCurrentQueuePlayer(id, auction.callMode);
  if (!currentPlayer || currentPlayer.playerId !== playerId) {
    res.status(400).json({ error: "Il giocatore non è quello corrente in asta" });
    return;
  }

  const [team] = await db
    .select()
    .from(fantaTeams)
    .where(and(eq(fantaTeams.id, fantaTeamId), eq(fantaTeams.leagueId, auction.leagueId)));
  if (!team) {
    res.status(400).json({ error: "Squadra non trovata in questa lega" });
    return;
  }

  const [topBid] = await db
    .select()
    .from(auctionBids)
    .where(and(eq(auctionBids.auctionId, id), eq(auctionBids.playerId, playerId), eq(auctionBids.valid, true)))
    .orderBy(desc(auctionBids.amountFm))
    .limit(1);

  const minBid = topBid ? topBid.amountFm + 1 : 1;
  if (amountFm < minBid) {
    res.status(409).json({ error: `L'offerta deve essere almeno ${minBid} FM` });
    return;
  }
  if (amountFm > team.creditsRemaining) {
    res.status(400).json({ error: "Crediti insufficienti" });
    return;
  }

  // ── Flag federazione (default ON se lega senza federation) ────────────────
  const [leagueRow] = await db
    .select({ federationId: leagues.federationId })
    .from(leagues)
    .where(eq(leagues.id, auction.leagueId));

  let featureFlags: Record<string, unknown> = {};
  if (leagueRow?.federationId) {
    const [fed] = await db
      .select({ featureFlags: federations.featureFlags })
      .from(federations)
      .where(eq(federations.id, leagueRow.federationId));
    featureFlags = (fed?.featureFlags ?? {}) as Record<string, unknown>;
  }
  // Se un flag non è esplicitamente impostato a false lo consideriamo ON
  const flagRoleCap       = featureFlags["auction_role_cap"]       !== false;
  const flagReserveBudget = featureFlags["auction_reserve_budget"] !== false;

  // ── Regola 1: quota per ruolo ─────────────────────────────────────────────
  if (flagRoleCap) {
    const roleToRoster: Record<string, number | null | undefined> = {
      GK:  auction.rosterP,
      DEF: auction.rosterD,
      MID: auction.rosterC,
      ATT: auction.rosterA,
    };
    const roleLabel: Record<string, string> = {
      GK: "portieri", DEF: "difensori", MID: "centrocampisti", ATT: "attaccanti",
    };
    const roleQuota = roleToRoster[currentPlayer.playerRole] ?? null;
    if (roleQuota !== null) {
      const [roleCountRow] = await db
        .select({ n: count() })
        .from(auctionAssignments)
        .innerJoin(players, eq(auctionAssignments.playerId, players.id))
        .where(
          and(
            eq(auctionAssignments.auctionId, id),
            eq(auctionAssignments.fantaTeamId, fantaTeamId),
            eq(players.roleClassic, currentPlayer.playerRole),
          ),
        );
      const alreadyAcquired = Number(roleCountRow?.n ?? 0);
      if (alreadyAcquired >= roleQuota) {
        const label = roleLabel[currentPlayer.playerRole] ?? currentPlayer.playerRole.toLowerCase();
        res.status(400).json({ error: `Rosa ${label} completa` });
        return;
      }
    }
  }

  // ── Regola 2: riserva budget per completare la rosa ───────────────────────
  if (flagReserveBudget) {
    const totalSlots =
      (auction.rosterP ?? 0) +
      (auction.rosterD ?? 0) +
      (auction.rosterC ?? 0) +
      (auction.rosterA ?? 0);
    const [acquiredRow] = await db
      .select({ n: count() })
      .from(auctionAssignments)
      .where(
        and(
          eq(auctionAssignments.auctionId, id),
          eq(auctionAssignments.fantaTeamId, fantaTeamId),
        ),
      );
    const teamAcquired   = Number(acquiredRow?.n ?? 0);
    const emptySlots     = totalSlots - teamAcquired;
    // Dopo questo acquisto restano emptySlots-1 slot vuoti, ognuno richiede ≥1 FM
    const offertaMassima = team.creditsRemaining - (emptySlots - 1);
    if (amountFm > offertaMassima) {
      res.status(400).json({
        error: `Budget insufficiente per completare la rosa (massimo ${offertaMassima} FM)`,
      });
      return;
    }
  }

  const [bid] = await db
    .insert(auctionBids)
    .values({ id: `bid-${nanoid(8)}`, auctionId: id, playerId, fantaTeamId, amountFm, valid: true })
    .returning();

  // Timer server-authoritative: imposta deadline = now + timer_seconds
  const newDeadline = new Date(Date.now() + auction.timerSeconds * 1000);
  await db.update(auctions)
    .set({ lastUndoableAction: "bid", deadlineTs: newDeadline })
    .where(eq(auctions.id, id));

  res.status(201).json({ bid: mapBid(bid), new_current_bid: mapBid(bid) });
  notifyAuction(id);
});

// ─── POST /auctions/:id/assign ───────────────────────────

router.post("/auctions/:id/assign", async (req, res): Promise<void> => {
  const params = AssignAuctionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = AssignAuctionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  const { id } = params.data;
  const { player_id: playerId } = body.data;

  const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
  if (!auction || auction.status !== "running") {
    res.status(403).json({ error: "L'asta non è in corso" });
    return;
  }

  try {
    const { nextPlayerId, auctionCompleted } = await db.transaction(async (tx) => {
      const [topBid] = await tx
        .select()
        .from(auctionBids)
        .where(and(eq(auctionBids.auctionId, id), eq(auctionBids.playerId, playerId), eq(auctionBids.valid, true)))
        .orderBy(desc(auctionBids.amountFm))
        .limit(1);

      if (!topBid) throw { code: 409, message: "Nessuna offerta valida per questo giocatore" };

      await tx.insert(auctionAssignments).values({
        id: `asg-${nanoid(8)}`,
        auctionId: id,
        playerId,
        fantaTeamId: topBid.fantaTeamId,
        finalPriceFm: topBid.amountFm,
      });

      await tx.insert(contracts).values({
        id: `ctr-${nanoid(8)}`,
        leagueId: auction.leagueId,
        fantaTeamId: topBid.fantaTeamId,
        playerId,
        seasonStart: 2025,
        durationSeasons: 1,
        purchasePrice: topBid.amountFm,
        purchasePriceFm: topBid.amountFm,
        clauseDefault: Math.max(1, Math.round(topBid.amountFm * 0.8)),
        clauseInvestment: 0,
        state: "active",
      });

      await tx
        .update(fantaTeams)
        .set({ creditsRemaining: sql`${fantaTeams.creditsRemaining} - ${topBid.amountFm}` })
        .where(eq(fantaTeams.id, topBid.fantaTeamId));

      await tx
        .update(auctionPlayerQueue)
        .set({ status: "sold" })
        .where(and(eq(auctionPlayerQueue.auctionId, id), eq(auctionPlayerQueue.playerId, playerId)));

      // In chiamata: no auto-avanzamento — il banditore chiama esplicitamente il prossimo
      if (auction.callMode === "chiamata") {
        await tx.update(auctions).set({ lastUndoableAction: "assign", deadlineTs: null }).where(eq(auctions.id, id));
        return { nextPlayerId: null, auctionCompleted: false };
      }

      const [nextRow] = await tx
        .select({ playerId: auctionPlayerQueue.playerId })
        .from(auctionPlayerQueue)
        .where(and(eq(auctionPlayerQueue.auctionId, id), eq(auctionPlayerQueue.status, "pending")))
        .orderBy(asc(auctionPlayerQueue.position))
        .limit(1);

      if (!nextRow) {
        await tx.update(auctions)
          .set({ status: "completed", completedAt: new Date(), lastUndoableAction: "assign", deadlineTs: null })
          .where(eq(auctions.id, id));
        return { nextPlayerId: null, auctionCompleted: true };
      } else {
        await tx.update(auctions)
          .set({ lastUndoableAction: "assign", deadlineTs: null })
          .where(eq(auctions.id, id));
        return { nextPlayerId: nextRow.playerId, auctionCompleted: false };
      }
    });

    res.json({ next_player_id: nextPlayerId, auction_completed: auctionCompleted });
    notifyAuction(id);
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && "message" in err) {
      const e = err as { code: number; message: string };
      if (e.code === 409) {
        res.status(409).json({ error: e.message });
        return;
      }
    }
    req.log.error({ err }, "Errore aggiudicazione");
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── POST /auctions/:id/skip ─────────────────────────────

router.post("/auctions/:id/skip", async (req, res): Promise<void> => {
  const params = SkipAuctionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SkipAuctionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  const { id } = params.data;
  const { player_id: playerId } = body.data;

  const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
  if (!auction || auction.status !== "running") {
    res.status(403).json({ error: "L'asta non è in corso" });
    return;
  }

  await db
    .update(auctionPlayerQueue)
    .set({ status: "skipped" })
    .where(and(eq(auctionPlayerQueue.auctionId, id), eq(auctionPlayerQueue.playerId, playerId)));

  // In chiamata: no auto-avanzamento
  if (auction.callMode === "chiamata") {
    await db.update(auctions).set({ lastUndoableAction: "skip", deadlineTs: null }).where(eq(auctions.id, id));
    res.json({ next_player_id: null, auction_completed: false });
    notifyAuction(id);
    return;
  }

  const nextRow = await getCurrentQueuePlayer(id, "listone");
  if (!nextRow) {
    await db.update(auctions)
      .set({ status: "completed", completedAt: new Date(), lastUndoableAction: "skip", deadlineTs: null })
      .where(eq(auctions.id, id));
  } else {
    await db.update(auctions).set({ lastUndoableAction: "skip", deadlineTs: null }).where(eq(auctions.id, id));
  }

  res.json({ next_player_id: nextRow?.playerId ?? null, auction_completed: nextRow === null });
  notifyAuction(id);
});

// ─── POST /auctions/:id/pause ────────────────────────────

router.post("/auctions/:id/pause", async (req, res): Promise<void> => {
  const params = PauseAuctionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { id } = params.data;
  const [current] = await db.select().from(auctions).where(eq(auctions.id, id));
  if (!current) { res.status(404).json({ error: "Asta non trovata" }); return; }
  // Salva il tempo residuo del timer al momento della pausa
  const remaining = current.deadlineTs ? Math.max(0, current.deadlineTs.getTime() - Date.now()) : 0;
  const [auction] = await db.update(auctions)
    .set({ status: "paused", pausedRemainingMs: remaining, deadlineTs: null })
    .where(eq(auctions.id, id))
    .returning();
  if (!auction) { res.status(404).json({ error: "Asta non trovata" }); return; }
  res.json(mapAuction(auction));
  notifyAuction(id);
});

// ─── POST /auctions/:id/resume ───────────────────────────

router.post("/auctions/:id/resume", async (req, res): Promise<void> => {
  const params = ResumeAuctionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { id } = params.data;
  const [current] = await db.select().from(auctions).where(eq(auctions.id, id));
  if (!current) { res.status(404).json({ error: "Asta non trovata" }); return; }
  // Ripristina il timer dal tempo residuo salvato alla pausa
  const newDeadline = current.pausedRemainingMs > 0 ? new Date(Date.now() + current.pausedRemainingMs) : null;
  const [auction] = await db.update(auctions)
    .set({ status: "running", deadlineTs: newDeadline, pausedRemainingMs: 0 })
    .where(eq(auctions.id, id))
    .returning();
  if (!auction) { res.status(404).json({ error: "Asta non trovata" }); return; }
  res.json(mapAuction(auction));
  notifyAuction(id);
});

// ─── POST /auctions/:id/undo ─────────────────────────────

router.post("/auctions/:id/undo", async (req, res): Promise<void> => {
  const params = UndoAuctionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { id } = params.data;

  const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
  if (!auction || (auction.status !== "running" && auction.status !== "paused")) {
    res.status(403).json({ error: "L'asta non è in corso" });
    return;
  }

  // ── Guard server-authoritative: un solo passo ────────────────────────────
  if (!auction.lastUndoableAction) {
    res.json({ undone: null, message: "Nessuna azione da annullare" });
    return;
  }

  try {
    // ── Determina l'ultima azione ──────────────────────────────────────────
    // 1. Se il giocatore corrente ha offerte valide → undo bid
    // 2. Altrimenti confronta posizione del player skipped più recente vs
    //    posizione del player venduto più recente → il più alto position
    //    determina chi è venuto dopo

    const currentPlayer = await getCurrentQueuePlayer(id, auction.callMode);

    // (a) cerca l'offerta top sul giocatore corrente
    const currentBid = currentPlayer
      ? await db
          .select()
          .from(auctionBids)
          .where(
            and(
              eq(auctionBids.auctionId, id),
              eq(auctionBids.playerId, currentPlayer.playerId),
              eq(auctionBids.valid, true),
            ),
          )
          .orderBy(desc(auctionBids.amountFm))
          .limit(1)
          .then((r) => r[0] ?? null)
      : null;

    if (currentBid) {
      // ── UNDO BID ────────────────────────────────────────────────────────
      await db
        .delete(auctionBids)
        .where(eq(auctionBids.id, currentBid.id));

      // Azzera azione annullabile e timer (nessun bid attivo)
      await db.update(auctions).set({ lastUndoableAction: null, deadlineTs: null }).where(eq(auctions.id, id));

      res.json({ undone: "bid", message: "Ultima offerta annullata" });
      notifyAuction(id);
      return;
    }

    // (b) trova il player skipped con posizione più alta
    const lastSkipped = await db
      .select({
        playerId: auctionPlayerQueue.playerId,
        position: auctionPlayerQueue.position,
      })
      .from(auctionPlayerQueue)
      .where(
        and(
          eq(auctionPlayerQueue.auctionId, id),
          eq(auctionPlayerQueue.status, "skipped"),
        ),
      )
      .orderBy(desc(auctionPlayerQueue.position))
      .limit(1)
      .then((r) => r[0] ?? null);

    // (c) trova l'ultima aggiudicazione per assignedAt
    const lastAssignment = await db
      .select({
        id: auctionAssignments.id,
        playerId: auctionAssignments.playerId,
        fantaTeamId: auctionAssignments.fantaTeamId,
        finalPriceFm: auctionAssignments.finalPriceFm,
        position: auctionPlayerQueue.position,
        assignedAt: auctionAssignments.assignedAt,
      })
      .from(auctionAssignments)
      .innerJoin(
        auctionPlayerQueue,
        and(
          eq(auctionPlayerQueue.auctionId, id),
          eq(auctionPlayerQueue.playerId, auctionAssignments.playerId),
        ),
      )
      .where(eq(auctionAssignments.auctionId, id))
      .orderBy(desc(auctionAssignments.assignedAt))
      .limit(1)
      .then((r) => r[0] ?? null);

    // Nulla da annullare
    if (!lastSkipped && !lastAssignment) {
      res.status(204).end();
      return;
    }

    // Chi è più recente: confronto per posizione (più alto = più recente)
    const skipPos   = lastSkipped?.position ?? -1;
    const assignPos = lastAssignment?.position ?? -1;

    if (skipPos >= assignPos) {
      // ── UNDO SKIP ────────────────────────────────────────────────────────
      // In chiamata: ripristina a 'called' (era stato chiamato, poi saltato)
      const restoreStatus = auction.callMode === "chiamata" ? "called" : "pending";
      await db
        .update(auctionPlayerQueue)
        .set({ status: restoreStatus })
        .where(
          and(
            eq(auctionPlayerQueue.auctionId, id),
            eq(auctionPlayerQueue.playerId, lastSkipped!.playerId),
          ),
        );

      await db.update(auctions).set({ lastUndoableAction: null, deadlineTs: null }).where(eq(auctions.id, id));

      res.json({ undone: "skip", message: "Salto annullato, giocatore riportato in asta" });
      notifyAuction(id);
      return;
    }

    // ── UNDO ASSIGN ────────────────────────────────────────────────────────
    const asgn = lastAssignment!;
    await db.transaction(async (tx) => {
      // Elimina assignment
      await tx
        .delete(auctionAssignments)
        .where(eq(auctionAssignments.id, asgn.id));

      // Elimina il contratto creato dall'asta per questo giocatore/squadra
      await tx
        .delete(contracts)
        .where(
          and(
            eq(contracts.leagueId, auction.leagueId),
            eq(contracts.fantaTeamId, asgn.fantaTeamId),
            eq(contracts.playerId, asgn.playerId),
          ),
        );

      // Rimborsa i crediti
      await tx
        .update(fantaTeams)
        .set({ creditsRemaining: sql`${fantaTeams.creditsRemaining} + ${asgn.finalPriceFm}` })
        .where(eq(fantaTeams.id, asgn.fantaTeamId));

      // Azzera tutte le offerte per questo giocatore (riaperto da zero)
      await tx
        .delete(auctionBids)
        .where(
          and(
            eq(auctionBids.auctionId, id),
            eq(auctionBids.playerId, asgn.playerId),
          ),
        );

      // Riporta il giocatore a pending (o 'called' in chiamata mode)
      const undoAssignStatus = auction.callMode === "chiamata" ? "called" : "pending";
      await tx
        .update(auctionPlayerQueue)
        .set({ status: undoAssignStatus })
        .where(
          and(
            eq(auctionPlayerQueue.auctionId, id),
            eq(auctionPlayerQueue.playerId, asgn.playerId),
          ),
        );

      // Se l'asta era completed, riportala a running; in ogni caso azzera undoable e timer
      if (auction.status === "completed") {
        await tx
          .update(auctions)
          .set({ status: "running", completedAt: null, lastUndoableAction: null, deadlineTs: null })
          .where(eq(auctions.id, id));
      } else {
        await tx
          .update(auctions)
          .set({ lastUndoableAction: null, deadlineTs: null })
          .where(eq(auctions.id, id));
      }
    });

    res.json({ undone: "assign", message: "Aggiudicazione annullata, giocatore riaperto" });
    notifyAuction(id);
  } catch (err) {
    req.log.error({ err }, "Errore undo asta");
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── POST /auctions/:id/manual/add ───────────────────────

router.post("/auctions/:id/manual/add", async (req, res): Promise<void> => {
  const params = ManualAddPlayerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = ManualAddPlayerBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.flatten() }); return; }
  const { id } = params.data;
  const { fanta_team_id: fantaTeamId, player_id: playerId, price_fm: priceFm } = body.data;

  const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
  if (!auction || (auction.status !== "running" && auction.status !== "paused")) {
    res.status(403).json({ error: "L'asta non è in corso" }); return;
  }
  const [team] = await db
    .select()
    .from(fantaTeams)
    .where(and(eq(fantaTeams.id, fantaTeamId), eq(fantaTeams.leagueId, auction.leagueId)));
  if (!team) { res.status(400).json({ error: "Squadra non trovata" }); return; }

  // ── Regola svincolato: rifiuta se già assegnato in questa asta ────────────
  // getOwnerTeam è l'unica fonte di verità: usata sia qui che in /call.
  const ownerTeam = await getOwnerTeam(id, playerId);
  if (ownerTeam) {
    res.status(400).json({ error: `Giocatore già di ${ownerTeam}` });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(auctionAssignments).values({
        id: `asg-${nanoid(8)}`,
        auctionId: id,
        playerId,
        fantaTeamId,
        finalPriceFm: priceFm,
      });
      await tx.insert(contracts).values({
        id: `ctr-${nanoid(8)}`,
        leagueId: auction.leagueId,
        fantaTeamId,
        playerId,
        seasonStart: 2025,
        durationSeasons: 1,
        purchasePrice: priceFm,
        purchasePriceFm: priceFm,
        clauseDefault: Math.max(1, Math.round(priceFm * 0.8)),
        clauseInvestment: 0,
        state: "active",
      });
      await tx
        .update(fantaTeams)
        .set({ creditsRemaining: sql`${fantaTeams.creditsRemaining} - ${priceFm}` })
        .where(eq(fantaTeams.id, fantaTeamId));
      // Segna il player come sold nella coda se presente
      await tx
        .update(auctionPlayerQueue)
        .set({ status: "sold" })
        .where(
          and(eq(auctionPlayerQueue.auctionId, id), eq(auctionPlayerQueue.playerId, playerId)),
        );
    });
    res.json({ ok: true, message: "Giocatore aggiunto manualmente" });
    notifyAuction(id);
  } catch (err) {
    req.log.error({ err }, "Errore manual add");
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── POST /auctions/:id/manual/remove ────────────────────

router.post("/auctions/:id/manual/remove", async (req, res): Promise<void> => {
  const params = ManualRemovePlayerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = ManualRemovePlayerBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.flatten() }); return; }
  const { id } = params.data;
  const { fanta_team_id: fantaTeamId, player_id: playerId } = body.data;

  const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
  if (!auction || (auction.status !== "running" && auction.status !== "paused")) {
    res.status(403).json({ error: "L'asta non è in corso" }); return;
  }

  const [asgn] = await db
    .select()
    .from(auctionAssignments)
    .where(
      and(
        eq(auctionAssignments.auctionId, id),
        eq(auctionAssignments.fantaTeamId, fantaTeamId),
        eq(auctionAssignments.playerId, playerId),
      ),
    );
  if (!asgn) { res.status(400).json({ error: "Giocatore non trovato in rosa" }); return; }

  try {
    await db.transaction(async (tx) => {
      await tx.delete(auctionAssignments).where(eq(auctionAssignments.id, asgn.id));
      await tx.delete(contracts).where(
        and(
          eq(contracts.leagueId, auction.leagueId),
          eq(contracts.fantaTeamId, fantaTeamId),
          eq(contracts.playerId, playerId),
        ),
      );
      await tx
        .update(fantaTeams)
        .set({ creditsRemaining: sql`${fantaTeams.creditsRemaining} + ${asgn.finalPriceFm}` })
        .where(eq(fantaTeams.id, fantaTeamId));
      // Riporta il player a pending nella coda
      await tx
        .update(auctionPlayerQueue)
        .set({ status: "pending" })
        .where(
          and(eq(auctionPlayerQueue.auctionId, id), eq(auctionPlayerQueue.playerId, playerId)),
        );
    });
    res.json({ ok: true, message: "Giocatore rimosso, crediti rimborsati" });
    notifyAuction(id);
  } catch (err) {
    req.log.error({ err }, "Errore manual remove");
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── POST /auctions/:id/manual/update-price ──────────────

router.post("/auctions/:id/manual/update-price", async (req, res): Promise<void> => {
  const params = ManualUpdatePriceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = ManualUpdatePriceBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.flatten() }); return; }
  const { id } = params.data;
  const { fanta_team_id: fantaTeamId, player_id: playerId, new_price_fm: newPriceFm } = body.data;

  const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
  if (!auction || (auction.status !== "running" && auction.status !== "paused")) {
    res.status(403).json({ error: "L'asta non è in corso" }); return;
  }

  // Recupera l'assignment esistente per leggere il prezzo attuale
  const [asgn] = await db
    .select()
    .from(auctionAssignments)
    .where(
      and(
        eq(auctionAssignments.auctionId, id),
        eq(auctionAssignments.fantaTeamId, fantaTeamId),
        eq(auctionAssignments.playerId, playerId),
      ),
    );
  if (!asgn) { res.status(400).json({ error: "Giocatore non trovato in rosa" }); return; }

  const oldPriceFm = asgn.finalPriceFm;
  const creditsDelta = oldPriceFm - newPriceFm; // positivo = rimborso, negativo = addebito

  try {
    await db.transaction(async (tx) => {
      // 1. Aggiorna il prezzo nell'assignment
      await tx
        .update(auctionAssignments)
        .set({ finalPriceFm: newPriceFm })
        .where(eq(auctionAssignments.id, asgn.id));

      // 2. Aggiorna il contratto corrispondente
      await tx
        .update(contracts)
        .set({
          purchasePrice: newPriceFm,
          purchasePriceFm: newPriceFm,
          clauseDefault: Math.max(1, Math.round(newPriceFm * 0.8)),
        })
        .where(
          and(
            eq(contracts.leagueId, auction.leagueId),
            eq(contracts.fantaTeamId, fantaTeamId),
            eq(contracts.playerId, playerId),
          ),
        );

      // 3. Riconcilia i crediti: += (vecchio - nuovo)
      await tx
        .update(fantaTeams)
        .set({ creditsRemaining: sql`${fantaTeams.creditsRemaining} + ${creditsDelta}` })
        .where(and(eq(fantaTeams.id, fantaTeamId), eq(fantaTeams.leagueId, auction.leagueId)));
    });

    res.json({
      ok: true,
      old_price_fm: oldPriceFm,
      new_price_fm: newPriceFm,
      credits_delta: creditsDelta,
      message: `Prezzo aggiornato: ${oldPriceFm} → ${newPriceFm} FM (crediti ${creditsDelta >= 0 ? "+" : ""}${creditsDelta})`,
    });
    notifyAuction(id);
  } catch (err) {
    req.log.error({ err }, "Errore manual update-price");
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── POST /auctions/:id/manual/set-budget ────────────────

router.post("/auctions/:id/manual/set-budget", async (req, res): Promise<void> => {
  const params = ManualSetBudgetParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = ManualSetBudgetBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.flatten() }); return; }
  const { id } = params.data;
  const { fanta_team_id: fantaTeamId, credits_remaining: creditsRemaining } = body.data;

  const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
  if (!auction || (auction.status !== "running" && auction.status !== "paused")) {
    res.status(403).json({ error: "L'asta non è in corso" }); return;
  }

  const [team] = await db
    .update(fantaTeams)
    .set({ creditsRemaining })
    .where(and(eq(fantaTeams.id, fantaTeamId), eq(fantaTeams.leagueId, auction.leagueId)))
    .returning();
  if (!team) { res.status(400).json({ error: "Squadra non trovata" }); return; }

  res.json({ ok: true, message: `Budget impostato a ${creditsRemaining} FM` });
  notifyAuction(id);
});

// ─── POST /auctions/:id/call ─────────────────────────────
// Modalità chiamata: il banditore seleziona esplicitamente il prossimo giocatore
// da mettere all'asta. Imposta lo status del giocatore da 'pending' → 'called'.
// Se c'è già un 'called', la richiesta viene rifiutata con 409.

router.post("/auctions/:id/call", async (req, res): Promise<void> => {
  const params = CallPlayerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = CallPlayerBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.flatten() }); return; }

  const { id } = params.data;
  const { player_id: playerId } = body.data;

  const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
  if (!auction || auction.status !== "running") {
    res.status(403).json({ error: "L'asta non è in corso" });
    return;
  }
  if (auction.callMode !== "chiamata") {
    res.status(403).json({ error: "L'asta non è in modalità chiamata" });
    return;
  }

  // Guard: giocatore già assegnato
  const ownerTeam = await getOwnerTeam(id, playerId);
  if (ownerTeam) {
    res.status(400).json({ error: `Giocatore già di ${ownerTeam}` });
    return;
  }

  // Guard: role_order — solo giocatori del ruolo corrente
  if (auction.roleOrder) {
    const [playerRow] = await db
      .select({ role: players.roleClassic })
      .from(players)
      .where(eq(players.id, playerId));
    if (!playerRow) {
      res.status(400).json({ error: "Giocatore non trovato" });
      return;
    }
    const openRole = await computeCurrentOpenRole(
      id,
      auction.leagueId,
      auction.rosterP,
      auction.rosterD,
      auction.rosterC,
      auction.rosterA,
    );
    if (openRole !== null && playerRow.role !== openRole) {
      const roleLabel: Record<string, string> = {
        GK: "i portieri",
        DEF: "i difensori",
        MID: "i centrocampisti",
        ATT: "gli attaccanti",
      };
      res.status(403).json({ error: `Si chiamano ${roleLabel[openRole] ?? openRole}` });
      return;
    }
  }

  // Guard: c'è già un giocatore in corso d'asta
  const existingCalled = await getCurrentQueuePlayer(id, "chiamata");
  if (existingCalled) {
    res.status(409).json({ error: "C'è già un giocatore in asta — aggiudica o salta prima di chiamarne un altro" });
    return;
  }

  // Controlla che il giocatore sia nella coda con status 'pending'
  const [queueEntry] = await db
    .select()
    .from(auctionPlayerQueue)
    .where(
      and(
        eq(auctionPlayerQueue.auctionId, id),
        eq(auctionPlayerQueue.playerId, playerId),
        eq(auctionPlayerQueue.status, "pending"),
      ),
    );
  if (!queueEntry) {
    res.status(400).json({ error: "Giocatore non trovato in coda (già aggiudicato, saltato o non presente)" });
    return;
  }

  await db
    .update(auctionPlayerQueue)
    .set({ status: "called" })
    .where(
      and(
        eq(auctionPlayerQueue.auctionId, id),
        eq(auctionPlayerQueue.playerId, playerId),
      ),
    );

  // Nuovo giocatore chiamato — nessun bid ancora, azzera deadline
  await db.update(auctions).set({ deadlineTs: null }).where(eq(auctions.id, id));

  res.json({ ok: true, player_id: playerId, message: "Giocatore chiamato in asta" });
  notifyAuction(id);
});

// ─── GET /auctions/:id/queue ─────────────────────────────
// Lista giocatori pending nella coda dell'asta.
// Usata dalla UI in modalità chiamata per la ricerca del giocatore da bandire.

router.get("/auctions/:id/queue", async (req, res): Promise<void> => {
  const { id } = req.params;
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : undefined;
  const role = typeof req.query.role === "string" ? req.query.role : undefined;

  const [auction] = await db.select({ id: auctions.id }).from(auctions).where(eq(auctions.id, id));
  if (!auction) { res.status(404).json({ error: "Asta non trovata" }); return; }

  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      fullName: players.fullName,
      roleClassic: players.roleClassic,
      realTeam: players.realTeam,
    })
    .from(auctionPlayerQueue)
    .innerJoin(players, eq(auctionPlayerQueue.playerId, players.id))
    .where(
      and(
        eq(auctionPlayerQueue.auctionId, id),
        eq(auctionPlayerQueue.status, "pending"),
        role ? eq(players.roleClassic, role as "GK" | "DEF" | "MID" | "ATT") : undefined,
      ),
    )
    .orderBy(auctionPlayerQueue.position);

  const filtered = search
    ? rows.filter((r) =>
        r.name.toLowerCase().includes(search) ||
        r.fullName.toLowerCase().includes(search) ||
        r.realTeam.toLowerCase().includes(search),
      )
    : rows;

  res.json({
    players: filtered.map((r) => ({
      id: r.id,
      name: r.name,
      full_name: r.fullName,
      role_classic: r.roleClassic,
      real_team: r.realTeam,
    })),
  });
});

// ─── POST /auctions/:id/end ──────────────────────────────

router.post("/auctions/:id/end", async (req, res): Promise<void> => {
  const params = EndAuctionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [auction] = await db
    .update(auctions)
    .set({ status: "completed", completedAt: new Date(), deadlineTs: null })
    .where(eq(auctions.id, params.data.id))
    .returning();
  if (!auction) { res.status(404).json({ error: "Asta non trovata" }); return; }
  res.json(mapAuction(auction));
  notifyAuction(params.data.id);
});

export default router;
