/**
 * Seed rose attive + lineup giornata 2 — Task 113
 *
 * PRNG seed: 42 (mulberry32) — deterministico, riproducibile
 *
 * Distribuzione per squadra (25 giocatori, 200 contratti totali):
 *   3 GK / 8 DEF / 8 MID / 6 ATT
 *
 * Lineup 4-3-3 per ogni squadra:
 *   Slot 0      GK   titolare  (attivo)
 *   Slot 1-2,4  DEF  titolari  (attivi)
 *   Slot 3      DEF  titolare  *** S.V. deliberato → scatta sostituzione
 *   Slot 5-7    MID  titolari  (attivi)
 *   Slot 8-10   ATT  titolari  (attivi)  — slot 8 = capitano
 *   Slot 11-12  GK   panchina
 *   Slot 13-16  DEF  panchina  (slot 13 benchOrder=1 → entra per slot 3)
 *   Slot 17-21  MID  panchina
 *   Slot 22-24  ATT  panchina
 */

import { db } from "@workspace/db";
import {
  contracts,
  lineups,
  lineupPlayers,
  fantaTeams,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── PRNG ────────────────────────────────────────────────────────────────────

const PRNG_SEED = 42;

function makePrng(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
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

// ─── COSTANTI ────────────────────────────────────────────────────────────────

const LEAGUE_ID = "league-juve";
const SEASON = 2024;
const ROUND = 2;

const TEAMS = [
  "ft-mvp-1",
  "ft-mvp-2",
  "ft-mvp-3",
  "ft-mvp-4",
  "ft-mvp-5",
  "ft-mvp-6",
  "ft-mvp-7",
  "ft-mvp-8",
];

// ─── POOL GIOCATORI ──────────────────────────────────────────────────────────
// Tutti ordinati per votoMister DESC (giornata 2, stagione 2024)
// Fonte: SELECT id FROM players JOIN player_giornata_stats ... ORDER BY voto_mister DESC

const GK_ACTIVE = [
  1282, 31156, 2802, 30394, 81012, 143648, 1624, 50054,
  30418, 199578, 30417, 30670, 556, 22221, 2998, 312,
  31037, 56459, 31566, 30611,
]; // 20 attivi

const GK_SV = [46988, 30392, 31717, 237268, 342071, 162445, 462227, 30704]; // 8 senza voto

const DEF_ACTIVE = [
  26828, 30497, 1627, 45826, 1836, 31042, 47254, 31226,
  30425, 200, 134, 31010, 1632, 180510, 30501, 180763,
  30421, 46792, 887, 40582, 26095, 31642, 7090, 30396,
  37604, 36916, 128338, 382452, 31009, 30775, 2725, 1807,
  122468, 15909, 22007, 181806, 227, 14329, 31751, 319,
  30553, 136087, 268341, 162141, 288, 32034, 127035, 30822,
  1566, 18799, 2484, 47300, 25914, 137976, 833, 127631,
  291589, 125674, 6931, 41144, 296560, 30708, 19209, 31099,
  342063, 396637, 25353, 31543, 162012, 30736, 30827, 37,
  1314, 30428, 226, 37651, 349232, 348568, 91358, 35544,
  30770, 162907, 30615, 31521, 31390, 6050, 1844, 1929,
  31137, 30420, 1841, 30921, 10238, 8586, 18797, 30526,
  31079, 30737, 30845, 22222, 711, 127011,
]; // 102 attivi

const DEF_SV = [105, 30427, 61808, 128498, 196843, 2107, 37250, 154799]; // 8 senza voto — titolari S.V. deliberati

const MID_ACTIVE = [
  30533, 178749, 628, 30866, 56207, 20638, 30932, 89520,
  876, 266813, 30803, 30780, 1640, 1322, 383018, 951,
  30937, 271, 314231, 31056, 25349, 36902, 340700, 203474,
  194837, 31555, 30558, 30436, 30432, 288699, 190958, 74,
  1850, 162106, 47439, 48047, 6383, 288769, 137, 10097,
  2763, 211, 778, 350037, 1639, 786, 2292, 31871,
  2118, 15673, 15881, 333116, 22174, 15905, 17, 161859,
  3009, 46170, 30505, 47522, 22169, 782, 203, 136016,
  2286, 1454, 1938, 881, 2807, 118956, 30431, 6409,
  162266, 22254, 31173, 128353, 1457, 30532, 541, 3406,
  7591, 37437, 2822, 56560, 30561, 1014, 36980, 144740,
  309388,
]; // 89 attivi

const ATT_ACTIVE = [
  483, 877, 147859, 31624, 30789, 875, 275651, 215,
  19524, 30543, 9975, 48648, 30460, 22015, 56396, 22236,
  2495, 39271, 31507, 30509, 30603, 134926, 3430, 312985,
  48193, 30879, 50856, 1922, 15811, 339883, 31094, 140831,
  177745, 19185, 47182, 21509, 199089, 6420, 346866, 2738,
  30790, 219, 135519, 31692, 42315, 43056, 30440, 43036,
]; // 48 — usiamo i primi 48 (6 × 8)

// ─── UTILITY ─────────────────────────────────────────────────────────────────

function priceFromRank(rank: number, total: number): number {
  // rank 0 = migliore, prezzi tra 50 e 8 credits
  const frac = rank / Math.max(total - 1, 1);
  return Math.max(8, Math.round((50 - frac * 42) / 1) * 1);
}

function svPrice(): number {
  return 5;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Seed rose + lineup giornata 2 (PRNG seed 42) ===\n");

  // 1. Cancella contratti e lineup esistenti per ft-mvp-*
  console.log("Cancello dati esistenti…");

  const lineupRows = await db
    .select({ id: lineups.id })
    .from(lineups)
    .where(inArray(lineups.fantaTeamId, TEAMS));

  if (lineupRows.length > 0) {
    await db.delete(lineupPlayers).where(
      inArray(lineupPlayers.lineupId, lineupRows.map((l) => l.id)),
    );
    await db.delete(lineups).where(inArray(lineups.fantaTeamId, TEAMS));
  }

  await db.delete(contracts).where(inArray(contracts.fantaTeamId, TEAMS));

  console.log(
    `Rimossi ${lineupRows.length} lineup e relativi giocatori, + contratti ft-mvp-*.\n`,
  );

  // 2. Shuffle dei pool con PRNG seed 42
  const rng = makePrng(PRNG_SEED);

  // GK pool: 20 active + 8 SV = 28 — prendo i primi 24 (3 per squadra)
  const gkPool = shuffle([...GK_ACTIVE, ...GK_SV], rng).slice(0, 24);

  // DEF active pool: shuffle, prendo i primi 56 (7 per squadra)
  const defActive = shuffle(DEF_ACTIVE, rng).slice(0, 56);

  // DEF SV: già 8, uno per squadra (non mescolo — li assegno in ordine)
  const defSv = [...DEF_SV];

  // MID pool: shuffle, prendo i primi 64 (8 per squadra)
  const midPool = shuffle(MID_ACTIVE, rng).slice(0, 64);

  // ATT pool: shuffle, prendo i primi 48 (6 per squadra)
  const attPool = shuffle(ATT_ACTIVE, rng).slice(0, 48);

  // Controllo no duplicati
  const allIds = [
    ...gkPool,
    ...defActive,
    ...defSv,
    ...midPool,
    ...attPool,
  ];
  const unique = new Set(allIds);
  if (unique.size !== allIds.length) {
    throw new Error(
      `DUPLICATI rilevati: ${allIds.length} slot ma solo ${unique.size} ID unici`,
    );
  }
  console.log(`Pool assegnati: ${allIds.length} giocatori unici ✓\n`);

  // 3. Costruisci contratti e lineup per ogni squadra
  const contractRows = [];
  const lineupInserts = [];

  for (let t = 0; t < 8; t++) {
    const teamId = TEAMS[t];

    // Giocatori di questa squadra
    const teamGks = gkPool.slice(t * 3, t * 3 + 3);
    const teamDefsActive = defActive.slice(t * 7, t * 7 + 7);
    const teamDefSv = defSv[t];
    const teamMids = midPool.slice(t * 8, t * 8 + 8);
    const teamAtts = attPool.slice(t * 6, t * 6 + 6);

    // -- Contratti --
    // GK
    for (let i = 0; i < teamGks.length; i++) {
      const pid = teamGks[i];
      const isActive = GK_ACTIVE.includes(pid);
      const price = isActive ? priceFromRank(GK_ACTIVE.indexOf(pid), GK_ACTIVE.length) : svPrice();
      contractRows.push({
        id: randomUUID(),
        leagueId: LEAGUE_ID,
        fantaTeamId: teamId,
        playerId: pid,
        seasonStart: SEASON,
        durationSeasons: 1,
        purchasePrice: price,
        clauseDefault: Math.max(1, Math.round(price * 0.8)),
        clauseInvestment: 0,
        state: "active" as const,
      });
    }
    // DEF active
    for (let i = 0; i < teamDefsActive.length; i++) {
      const pid = teamDefsActive[i];
      const rank = DEF_ACTIVE.indexOf(pid);
      const price = priceFromRank(rank, DEF_ACTIVE.length);
      contractRows.push({
        id: randomUUID(),
        leagueId: LEAGUE_ID,
        fantaTeamId: teamId,
        playerId: pid,
        seasonStart: SEASON,
        durationSeasons: 1,
        purchasePrice: price,
        clauseDefault: Math.max(1, Math.round(price * 0.8)),
        clauseInvestment: 0,
        state: "active" as const,
      });
    }
    // DEF SV
    contractRows.push({
      id: randomUUID(),
      leagueId: LEAGUE_ID,
      fantaTeamId: teamId,
      playerId: teamDefSv,
      seasonStart: SEASON,
      durationSeasons: 1,
      purchasePrice: svPrice(),
      clauseDefault: Math.max(1, Math.round(svPrice() * 0.8)),
      clauseInvestment: 0,
      state: "active" as const,
    });
    // MID
    for (let i = 0; i < teamMids.length; i++) {
      const pid = teamMids[i];
      const rank = MID_ACTIVE.indexOf(pid);
      const price = priceFromRank(rank, MID_ACTIVE.length);
      contractRows.push({
        id: randomUUID(),
        leagueId: LEAGUE_ID,
        fantaTeamId: teamId,
        playerId: pid,
        seasonStart: SEASON,
        durationSeasons: 1,
        purchasePrice: price,
        clauseDefault: Math.max(1, Math.round(price * 0.8)),
        clauseInvestment: 0,
        state: "active" as const,
      });
    }
    // ATT
    for (let i = 0; i < teamAtts.length; i++) {
      const pid = teamAtts[i];
      const rank = ATT_ACTIVE.indexOf(pid);
      const price = priceFromRank(rank, ATT_ACTIVE.length);
      contractRows.push({
        id: randomUUID(),
        leagueId: LEAGUE_ID,
        fantaTeamId: teamId,
        playerId: pid,
        seasonStart: SEASON,
        durationSeasons: 1,
        purchasePrice: price,
        clauseDefault: Math.max(1, Math.round(price * 0.8)),
        clauseInvestment: 0,
        state: "active" as const,
      });
    }

    // -- Lineup 4-3-3 --
    // Capitano = ATT[0] (titolare con voto più alto della squadra)
    const captainPlayerId = teamAtts[0];

    lineupInserts.push({
      teamId,
      module: "4-3-3",
      captainPlayerId,
      players: buildLineupPlayers(teamGks, teamDefsActive, teamDefSv, teamMids, teamAtts),
    });
  }

  // 4. Inserisci contratti
  console.log(`Inserisco ${contractRows.length} contratti…`);
  await db.insert(contracts).values(contractRows);
  console.log("Contratti inseriti ✓\n");

  // 5. Inserisci lineup
  console.log("Inserisco 8 lineup…");
  for (const { teamId, module, captainPlayerId, players } of lineupInserts) {
    const [lineup] = await db
      .insert(lineups)
      .values({
        fantaTeamId: teamId,
        season: SEASON,
        round: ROUND,
        module,
        captainPlayerId,
      })
      .returning();

    await db.insert(lineupPlayers).values(
      players.map((p) => ({ ...p, lineupId: lineup.id })),
    );

    const starters = players.filter((p) => p.isStarter);
    const svStarter = players.find((p) => p.isStarter && DEF_SV.includes(p.playerId));
    console.log(
      `  ${teamId}: 4-3-3, cap=${captainPlayerId}, ` +
        `SV starter DEF=${svStarter?.playerId ?? "?"}, ` +
        `${starters.length} titolari, ${players.length - starters.length} panchina`,
    );
  }

  console.log("\nLineup inseriti ✓\n");
  console.log("=== Seed completato. Ora esegui scoring:round ===");
}

// ─── BUILDER SLOT LINEUP ─────────────────────────────────────────────────────
// Slot layout 4-3-3 (25 slot totali):
//  0      GK  titolare
//  1-2,4  DEF titolari (attivi)
//  3      DEF titolare *** S.V. deliberato (DEF_SV)
//  5-7    MID titolari
//  8-10   ATT titolari  (slot 8 = capitano)
//  11-12  GK  panchina  (benchOrder 1-2)
//  13-16  DEF panchina  (benchOrder 1-4; slot 13 = primo sub per slot 3)
//  17-21  MID panchina  (benchOrder 1-5)
//  22-24  ATT panchina  (benchOrder 1-3)

type SlotEntry = {
  playerId: number;
  slotPosition: string;
  slotIndex: number;
  isStarter: boolean;
  benchOrder: number | null;
};

function buildLineupPlayers(
  gks: number[],
  defsActive: number[],
  defSv: number,
  mids: number[],
  atts: number[],
): SlotEntry[] {
  // gks[0] = titolare, gks[1-2] = panchina
  // defsActive[0-2] = titolari (slots 1,2,4), defsActive[3-6] = panchina
  // defSv = titolare SV (slot 3)
  // mids[0-2] = titolari, mids[3-7] = panchina
  // atts[0-2] = titolari, atts[3-5] = panchina

  const slots: SlotEntry[] = [];

  // Titolari
  slots.push({ playerId: gks[0],          slotPosition: "GK",  slotIndex: 0,  isStarter: true, benchOrder: null });
  slots.push({ playerId: defsActive[0],   slotPosition: "DEF", slotIndex: 1,  isStarter: true, benchOrder: null });
  slots.push({ playerId: defsActive[1],   slotPosition: "DEF", slotIndex: 2,  isStarter: true, benchOrder: null });
  slots.push({ playerId: defSv,           slotPosition: "DEF", slotIndex: 3,  isStarter: true, benchOrder: null }); // *** SV
  slots.push({ playerId: defsActive[2],   slotPosition: "DEF", slotIndex: 4,  isStarter: true, benchOrder: null });
  slots.push({ playerId: mids[0],         slotPosition: "MID", slotIndex: 5,  isStarter: true, benchOrder: null });
  slots.push({ playerId: mids[1],         slotPosition: "MID", slotIndex: 6,  isStarter: true, benchOrder: null });
  slots.push({ playerId: mids[2],         slotPosition: "MID", slotIndex: 7,  isStarter: true, benchOrder: null });
  slots.push({ playerId: atts[0],         slotPosition: "ATT", slotIndex: 8,  isStarter: true, benchOrder: null }); // capitano
  slots.push({ playerId: atts[1],         slotPosition: "ATT", slotIndex: 9,  isStarter: true, benchOrder: null });
  slots.push({ playerId: atts[2],         slotPosition: "ATT", slotIndex: 10, isStarter: true, benchOrder: null });

  // Panchina
  slots.push({ playerId: gks[1],          slotPosition: "GK",  slotIndex: 11, isStarter: false, benchOrder: 1 });
  slots.push({ playerId: gks[2],          slotPosition: "GK",  slotIndex: 12, isStarter: false, benchOrder: 2 });
  slots.push({ playerId: defsActive[3],   slotPosition: "DEF", slotIndex: 13, isStarter: false, benchOrder: 1 }); // entra per DEF SV
  slots.push({ playerId: defsActive[4],   slotPosition: "DEF", slotIndex: 14, isStarter: false, benchOrder: 2 });
  slots.push({ playerId: defsActive[5],   slotPosition: "DEF", slotIndex: 15, isStarter: false, benchOrder: 3 });
  slots.push({ playerId: defsActive[6],   slotPosition: "DEF", slotIndex: 16, isStarter: false, benchOrder: 4 });
  slots.push({ playerId: mids[3],         slotPosition: "MID", slotIndex: 17, isStarter: false, benchOrder: 1 });
  slots.push({ playerId: mids[4],         slotPosition: "MID", slotIndex: 18, isStarter: false, benchOrder: 2 });
  slots.push({ playerId: mids[5],         slotPosition: "MID", slotIndex: 19, isStarter: false, benchOrder: 3 });
  slots.push({ playerId: mids[6],         slotPosition: "MID", slotIndex: 20, isStarter: false, benchOrder: 4 });
  slots.push({ playerId: mids[7],         slotPosition: "MID", slotIndex: 21, isStarter: false, benchOrder: 5 });
  slots.push({ playerId: atts[3],         slotPosition: "ATT", slotIndex: 22, isStarter: false, benchOrder: 1 });
  slots.push({ playerId: atts[4],         slotPosition: "ATT", slotIndex: 23, isStarter: false, benchOrder: 2 });
  slots.push({ playerId: atts[5],         slotPosition: "ATT", slotIndex: 24, isStarter: false, benchOrder: 3 });

  return slots;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
