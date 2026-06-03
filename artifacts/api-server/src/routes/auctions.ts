import { Router, type IRouter } from "express";
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
} from "@workspace/api-zod";
import { mapFantaTeam } from "../lib/mappers";

const router: IRouter = Router();

function mapAuction(a: Auction) {
  return {
    id: a.id,
    league_id: a.leagueId,
    status: a.status,
    timer_seconds: a.timerSeconds,
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

async function getNextPendingPlayer(auctionId: string) {
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
        eq(auctionPlayerQueue.status, "pending"),
      ),
    )
    .orderBy(asc(auctionPlayerQueue.position))
    .limit(1);
  return rows[0] ?? null;
}

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

// ─── POST /auctions ───────────────────────────────────────

router.post("/auctions", async (req, res): Promise<void> => {
  const parsed = CreateAuctionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { league_id: leagueId, timer_seconds = 8, team_names = {} } = parsed.data;

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
        .values({ id: auctionId, leagueId, status: "running", startedAt: new Date(), timerSeconds: timer_seconds })
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

    const firstPlayer = await getNextPendingPlayer(auctionId);

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
  const { id } = params.data;

  const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
  if (!auction) {
    res.status(404).json({ error: "Asta non trovata" });
    return;
  }

  const currentPlayerRow = await getNextPendingPlayer(id);

  let currentBid: AuctionBid | null = null;
  let bidsHistory: AuctionBid[] = [];

  if (currentPlayerRow) {
    const { playerId } = currentPlayerRow;
    const [topBid] = await db
      .select()
      .from(auctionBids)
      .where(and(eq(auctionBids.auctionId, id), eq(auctionBids.playerId, playerId), eq(auctionBids.valid, true)))
      .orderBy(desc(auctionBids.amountFm))
      .limit(1);
    currentBid = topBid ?? null;

    bidsHistory = await db
      .select()
      .from(auctionBids)
      .where(and(eq(auctionBids.auctionId, id), eq(auctionBids.playerId, playerId), eq(auctionBids.valid, true)))
      .orderBy(desc(auctionBids.createdAt))
      .limit(10);
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
    .select({ count: count() })
    .from(auctionPlayerQueue)
    .where(eq(auctionPlayerQueue.auctionId, id));
  const [soldRow] = await db
    .select({ count: count() })
    .from(auctionPlayerQueue)
    .where(and(eq(auctionPlayerQueue.auctionId, id), eq(auctionPlayerQueue.status, "sold")));

  const total = Number(totalRow?.count ?? 0);
  const sold = Number(soldRow?.count ?? 0);
  const currentPosition = currentPlayerRow?.position ?? total;

  res.json({
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

  const currentPlayer = await getNextPendingPlayer(id);
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

  const [bid] = await db
    .insert(auctionBids)
    .values({ id: `bid-${nanoid(8)}`, auctionId: id, playerId, fantaTeamId, amountFm, valid: true })
    .returning();

  res.status(201).json({ bid: mapBid(bid), new_current_bid: mapBid(bid) });
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
    const nextPlayerId = await db.transaction(async (tx) => {
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

      const [nextRow] = await tx
        .select({ playerId: auctionPlayerQueue.playerId })
        .from(auctionPlayerQueue)
        .where(and(eq(auctionPlayerQueue.auctionId, id), eq(auctionPlayerQueue.status, "pending")))
        .orderBy(asc(auctionPlayerQueue.position))
        .limit(1);

      if (!nextRow) {
        await tx.update(auctions).set({ status: "completed", completedAt: new Date() }).where(eq(auctions.id, id));
      }

      return nextRow?.playerId ?? null;
    });

    res.json({ next_player_id: nextPlayerId, auction_completed: nextPlayerId === null });
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

  const nextRow = await getNextPendingPlayer(id);
  if (!nextRow) {
    await db.update(auctions).set({ status: "completed", completedAt: new Date() }).where(eq(auctions.id, id));
  }

  res.json({ next_player_id: nextRow?.playerId ?? null, auction_completed: nextRow === null });
});

// ─── POST /auctions/:id/pause ────────────────────────────

router.post("/auctions/:id/pause", async (req, res): Promise<void> => {
  const params = PauseAuctionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [auction] = await db.update(auctions).set({ status: "paused" }).where(eq(auctions.id, params.data.id)).returning();
  if (!auction) { res.status(404).json({ error: "Asta non trovata" }); return; }
  res.json(mapAuction(auction));
});

// ─── POST /auctions/:id/resume ───────────────────────────

router.post("/auctions/:id/resume", async (req, res): Promise<void> => {
  const params = ResumeAuctionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [auction] = await db.update(auctions).set({ status: "running" }).where(eq(auctions.id, params.data.id)).returning();
  if (!auction) { res.status(404).json({ error: "Asta non trovata" }); return; }
  res.json(mapAuction(auction));
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
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(auctions.id, params.data.id))
    .returning();
  if (!auction) { res.status(404).json({ error: "Asta non trovata" }); return; }
  res.json(mapAuction(auction));
});

export default router;
