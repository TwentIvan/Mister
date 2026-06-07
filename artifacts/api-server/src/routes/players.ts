import { Router, type IRouter } from "express";
import { eq, ilike, or, and, count, SQL, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  playersTable,
  contractsTable,
  fantaTeamsTable,
  leaguesTable,
  playerGiornataStats,
  societa,
  auctionAssignments,
  auctions,
} from "@workspace/db";
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

// ─── GET /players/:playerId/scheda ─────────────────────────────────────────
// Aggregatore sola lettura: anagrafica + contesto lega + rendimento fanta + stats

const ROLE_DISPLAY: Record<string, string> = {
  GK: "Portiere", DEF: "Difensore", MID: "Centrocampista", ATT: "Attaccante",
};
const ROLE_CODE: Record<string, string> = {
  GK: "P", DEF: "D", MID: "C", ATT: "A",
};

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

router.get("/players/:playerId/scheda", async (req, res): Promise<void> => {
  const playerId = parseInt(req.params.playerId, 10);
  if (isNaN(playerId)) {
    res.status(400).json({ error: "playerId non valido" });
    return;
  }
  const fantaTeamId = typeof req.query.fantaTeamId === "string" ? req.query.fantaTeamId : undefined;

  // 1. Anagrafica
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  if (!player) {
    res.status(404).json({ error: "Giocatore non trovato" });
    return;
  }

  // 2. Contesto lega (contratto nella squadra fanta specificata)
  let ligaContext = null;
  if (fantaTeamId) {
    const [ctxRow] = await db
      .select({
        fantaTeamId: contractsTable.fantaTeamId,
        purchasePrice: contractsTable.purchasePrice,
        purchasePriceFm: contractsTable.purchasePriceFm,
        season: contractsTable.seasonStart,
        societaName: societa.name,
        jerseyPrimary: societa.jersey,
        leagueName: leaguesTable.name,
        leagueId: leaguesTable.id,
      })
      .from(contractsTable)
      .innerJoin(fantaTeamsTable, eq(fantaTeamsTable.id, contractsTable.fantaTeamId))
      .leftJoin(societa, eq(societa.id, fantaTeamsTable.societaId))
      .innerJoin(leaguesTable, eq(leaguesTable.id, fantaTeamsTable.leagueId))
      .where(and(
        eq(contractsTable.playerId, playerId),
        eq(contractsTable.fantaTeamId, fantaTeamId),
      ));

    if (ctxRow) {
      const jersey = ctxRow.jerseyPrimary as { primaryColor?: string; secondaryColor?: string } | null;
      ligaContext = {
        fantaTeamId: ctxRow.fantaTeamId,
        fantaTeamName: ctxRow.societaName ?? ctxRow.fantaTeamId,
        leagueId: ctxRow.leagueId,
        leagueName: ctxRow.leagueName,
        jerseyPrimary: jersey?.primaryColor ?? null,
        jerseySecondary: jersey?.secondaryColor ?? null,
        purchasePrice: ctxRow.purchasePrice ?? null,
        purchasePriceFm: ctxRow.purchasePriceFm ?? null,
        currentValue: player.currentValue ?? null,
        season: ctxRow.season,
      };
    }
  }

  // 3. Stats giornata (stagione corrente 2024)
  const statsRows = await db
    .select()
    .from(playerGiornataStats)
    .where(and(
      eq(playerGiornataStats.playerId, playerId),
      eq(playerGiornataStats.season, 2024),
    ))
    .orderBy(playerGiornataStats.round);

  let rendimento = null;
  let statsAggregate = null;

  if (statsRows.length > 0) {
    let titolare = 0, subentrato = 0, minuti = 0;
    let sumVoto = 0, sumRating = 0, votoCnt = 0, ratingCnt = 0;
    let parate = 0, golSubiti = 0, gol = 0, assist = 0, gialli = 0, rossi = 0;

    for (const r of statsRows) {
      const s = r.statsJson as Record<string, unknown>;
      const games = s["games"] as Record<string, unknown> | undefined;
      const goals = s["goals"] as Record<string, unknown> | undefined;
      const cards = s["cards"] as Record<string, unknown> | undefined;

      if (games?.["substitute"] === false) titolare++; else subentrato++;
      const mins = Number(games?.["minutes"]);
      if (!isNaN(mins)) minuti += mins;
      if (r.votoMister != null) { sumVoto += r.votoMister; votoCnt++; }
      const rating = parseFloat(games?.["rating"] as string ?? "");
      if (!isNaN(rating)) { sumRating += rating; ratingCnt++; }

      parate += Number(goals?.["saves"] ?? 0) || 0;
      golSubiti += Number(goals?.["conceded"] ?? 0) || 0;
      gol += Number(goals?.["total"] ?? 0) || 0;
      assist += Number(goals?.["assists"] ?? 0) || 0;
      gialli += Number(cards?.["yellow"] ?? 0) || 0;
      rossi += Number(cards?.["red"] ?? 0) || 0;
    }

    const ultimeGiornate = statsRows.slice(-6).map((r) => ({
      round: r.round,
      votoMister: r.votoMister ?? null,
      ratingApi: parseFloat((r.statsJson as Record<string, unknown>)?.["games"] != null
        ? ((r.statsJson as Record<string, Record<string, string>>)?.["games"]?.["rating"] ?? "")
        : "") || null,
    }));

    rendimento = {
      presenze: statsRows.length,
      titolare,
      subentrato,
      fantamedia: votoCnt > 0 ? Math.round((sumVoto / votoCnt) * 100) / 100 : null,
      mediaVoto: ratingCnt > 0 ? Math.round((sumRating / ratingCnt) * 100) / 100 : null,
      minuti,
      ultimeGiornate,
    };

    statsAggregate = { parate, golSubiti, gol, assist, gialli, rossi };
  }

  // 4. Storico acquisti in lega (scoped alla lega corrente via auction_assignments → auctions)
  let storicoLega: Array<{ evento: string; prezzoFm: number | null; data: string }> = [];
  if (ligaContext) {
    const currentLeagueId = ligaContext.leagueId;
    if (currentLeagueId) {
      const storicoRows = await db
        .select({
          finalPriceFm: auctionAssignments.finalPriceFm,
          assignedAt: auctionAssignments.assignedAt,
        })
        .from(auctionAssignments)
        .innerJoin(auctions, eq(auctions.id, auctionAssignments.auctionId))
        .where(and(
          eq(auctionAssignments.playerId, playerId),
          eq(auctions.leagueId, currentLeagueId),
        ))
        .orderBy(desc(auctionAssignments.assignedAt));

      storicoLega = storicoRows.map((r) => ({
        evento: "Asta",
        prezzoFm: r.finalPriceFm,
        data: r.assignedAt.toISOString(),
      }));
    }
  }

  // 5. Note dataset
  const noteDataset =
    statsRows.length === 0
      ? "Nessuna statistica sincronizzata per questa stagione."
      : statsRows.length < 5
      ? `Solo ${statsRows.length} giornate sincronizzate (dati di avviamento).`
      : null;

  res.json({
    id: player.id,
    name: player.name,
    fullName: player.fullName,
    roleClassic: ROLE_CODE[player.roleClassic] ?? player.roleClassic,
    roleDisplay: ROLE_DISPLAY[player.roleClassic] ?? player.roleClassic,
    realTeam: player.realTeam,
    nationality: player.nationality ?? null,
    age: calcAge(player.birthDate),
    heightCm: player.heightCm ?? null,
    weightKg: player.weightKg ?? null,
    foot: player.foot ?? null,
    injured: player.injured,
    photoUrl: player.photoUrl ?? null,
    photoCartoonUrl: player.photoCartoonUrl ?? null,
    ligaContext,
    rendimento,
    statsAggregate,
    storicoLega,
    noteDataset,
  });
});

export default router;
