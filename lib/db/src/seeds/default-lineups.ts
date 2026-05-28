import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, inArray, sql } from "drizzle-orm";
import { contracts } from "../schema/contracts";
import { players, playerGiornataStats } from "../schema/players";
import { lineups } from "../schema/lineups";
import { lineupPlayers } from "../schema/lineup-players";

// ─── PRNG deterministica (mulberry32) ─────────────────────────────────────────

function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (Math.imul(h, 0x01000193) >>> 0);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const RIVAL_TEAM_IDS = [
  "ft-mvp-2", "ft-mvp-3", "ft-mvp-4", "ft-mvp-5",
  "ft-mvp-6", "ft-mvp-7", "ft-mvp-8",
];

const MODULE = "4-3-3";
const SEASON = 2024;
const ROUND = 2;

// 4-3-3: quanti titolari per ruolo
const STARTERS_BY_ROLE: Record<string, number> = {
  GK: 1,
  DEF: 4,
  MID: 3,
  ATT: 3,
};

const ROLE_ORDER = ["GK", "DEF", "MID", "ATT"] as const;

// ─── Seed principale ───────────────────────────────────────────────────────────

export async function seedDefaultLineups(db: NodePgDatabase<Record<string, never>>) {
  console.log("Seed default-lineups...");
  let seeded = 0;

  for (const fantaTeamId of RIVAL_TEAM_IDS) {
    // ── Idempotenza ──────────────────────────────────────────────────────────
    const [existing] = await db
      .select({ id: lineups.id })
      .from(lineups)
      .where(and(
        eq(lineups.fantaTeamId, fantaTeamId),
        eq(lineups.season, SEASON),
        eq(lineups.round, ROUND),
      ))
      .limit(1);

    if (existing) {
      console.log(`  ${fantaTeamId}: lineup già presente, skip.`);
      continue;
    }

    // ── Leggi rosa dai contratti attivi ──────────────────────────────────────
    const contractRows = await db
      .select({ playerId: contracts.playerId })
      .from(contracts)
      .where(and(
        eq(contracts.fantaTeamId, fantaTeamId),
        eq(contracts.state, "active"),
      ));

    const rosterIds = contractRows.map(c => c.playerId);
    if (rosterIds.length === 0) {
      console.log(`  ${fantaTeamId}: nessun contratto attivo, skip.`);
      continue;
    }

    // ── Fetch ruoli ───────────────────────────────────────────────────────────
    const playerRows = await db
      .select({ id: players.id, roleClassic: players.roleClassic })
      .from(players)
      .where(inArray(players.id, rosterIds));

    const byRole: Record<string, number[]> = { GK: [], DEF: [], MID: [], ATT: [] };
    for (const p of playerRows) {
      if (p.roleClassic in byRole) byRole[p.roleClassic].push(p.id);
    }
    // Ordina per id prima dello shuffle — garanzia di determinismo
    for (const role of ROLE_ORDER) {
      byRole[role].sort((a, b) => a - b);
    }

    // ── Shuffle deterministico seedato per questo team ────────────────────────
    const rng = mulberry32(hashSeed(`default-lineup-${fantaTeamId}`));
    const shuffled: Record<string, number[]> = {};
    for (const role of ROLE_ORDER) {
      shuffled[role] = shuffle(byRole[role], rng);
    }

    // ── Titolari: primi N per ruolo ───────────────────────────────────────────
    const startersByRole: Record<string, number[]> = {};
    for (const role of ROLE_ORDER) {
      startersByRole[role] = shuffled[role].slice(0, STARTERS_BY_ROLE[role]);
    }

    // ── Panchina: restanti, ordinati per ruolo poi per posizione nello shuffle ─
    const benchByRole: Record<string, number[]> = {};
    for (const role of ROLE_ORDER) {
      benchByRole[role] = shuffled[role].slice(STARTERS_BY_ROLE[role]);
    }

    // ── Capitano: ATT con voto_mister round 2 più alto ───────────────────────
    const attStarters = startersByRole["ATT"];
    let captainPlayerId: number | null = null;

    if (attStarters.length > 0) {
      const votiRows = await db
        .select({
          playerId: playerGiornataStats.playerId,
          maxVoto: sql<number>`MAX(${playerGiornataStats.votoMister})`,
        })
        .from(playerGiornataStats)
        .where(and(
          eq(playerGiornataStats.season, SEASON),
          eq(playerGiornataStats.round, ROUND),
          inArray(playerGiornataStats.playerId, attStarters),
        ))
        .groupBy(playerGiornataStats.playerId)
        .orderBy(sql`MAX(${playerGiornataStats.votoMister}) DESC NULLS LAST`)
        .limit(1);

      captainPlayerId = votiRows.length > 0
        ? votiRows[0].playerId
        : attStarters[0];
    }

    // ── Costruisci righe lineup_players ───────────────────────────────────────
    // slotIndex sequenziale: 0=GK, 1-4=DEF, 5-7=MID, 8-10=ATT, 11-24=panchina
    type LPRow = {
      playerId: number;
      slotPosition: string;
      slotIndex: number;
      isStarter: boolean;
      benchOrder: number | null;
    };
    const lpRows: LPRow[] = [];
    let slotIdx = 0;

    // Titolari
    for (const role of ROLE_ORDER) {
      for (const pid of startersByRole[role]) {
        lpRows.push({
          playerId: pid,
          slotPosition: role,
          slotIndex: slotIdx++,
          isStarter: true,
          benchOrder: null,
        });
      }
    }

    // Panchina
    let benchOrder = 1;
    for (const role of ROLE_ORDER) {
      for (const pid of benchByRole[role]) {
        lpRows.push({
          playerId: pid,
          slotPosition: role,
          slotIndex: slotIdx++,
          isStarter: false,
          benchOrder: benchOrder++,
        });
      }
    }

    // ── Inserimento transazionale ─────────────────────────────────────────────
    await db.transaction(async (tx) => {
      const [lineup] = await tx
        .insert(lineups)
        .values({
          fantaTeamId,
          season: SEASON,
          round: ROUND,
          module: MODULE,
          captainPlayerId,
          submittedAt: new Date(),
          lockedAt: null,
        })
        .returning();

      await tx.insert(lineupPlayers).values(
        lpRows.map(p => ({
          lineupId: lineup.id,
          playerId: p.playerId,
          slotPosition: p.slotPosition,
          slotIndex: p.slotIndex,
          isStarter: p.isStarter,
          benchOrder: p.benchOrder,
        }))
      );
    });

    const stCount = lpRows.filter(r => r.isStarter).length;
    const bnCount = lpRows.filter(r => !r.isStarter).length;
    console.log(`  ${fantaTeamId}: inserito (${stCount} titolari, ${bnCount} panchina, cap=${captainPlayerId}).`);
    seeded++;
  }

  console.log(`default-lineups: ${seeded} lineup inseriti.`);
}
