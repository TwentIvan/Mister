/**
 * T122 Step 6.A — Round 1: lineups (seed 41) + scoring + update competition_matches + classifica
 *
 * Differenze da T113:
 *   - PRNG seed 41 (vs 42) → shuffle diverso → lineup diverse
 *   - ROUND = 1, played_at = '2024-08-25'
 *   - NON tocca i contratti esistenti
 *   - Alla fine stampa classifica round 1+2
 */

import { db } from "@workspace/db";
import {
  lineups,
  lineupPlayers,
  playerGiornataStats,
  players as playersTable,
  competitionMatches,
  fantaTeams,
  coaches,
  serieAFixtures,
} from "@workspace/db";
import {
  computeFantaTeamScore,
  computeCoachVoto,
  type SlotPosition,
} from "@workspace/scoring";
import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── PRNG ─────────────────────────────────────────────────────────────────────

const PRNG_SEED = 41;

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

// ─── COSTANTI ─────────────────────────────────────────────────────────────────

const COMPETITION_ID = "comp-mvp-campionato-2024";
const SEASON = 2024;
const ROUND = 1;
const PLAYED_AT = new Date("2024-08-25");

const TEAMS = [
  "ft-mvp-1", "ft-mvp-2", "ft-mvp-3", "ft-mvp-4",
  "ft-mvp-5", "ft-mvp-6", "ft-mvp-7", "ft-mvp-8",
];

// ─── POOL IDENTICO A T113 ─────────────────────────────────────────────────────

const GK_ACTIVE = [
  1282, 31156, 2802, 30394, 81012, 143648, 1624, 50054,
  30418, 199578, 30417, 30670, 556, 22221, 2998, 312,
  31037, 56459, 31566, 30611,
];

const GK_SV = [46988, 30392, 31717, 237268, 342071, 162445, 462227, 30704];

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
];

const DEF_SV = [105, 30427, 61808, 128498, 196843, 2107, 37250, 154799];

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
];

const ATT_ACTIVE = [
  483, 877, 147859, 31624, 30789, 875, 275651, 215,
  19524, 30543, 9975, 48648, 30460, 22015, 56396, 22236,
  2495, 39271, 31507, 30509, 30603, 134926, 3430, 312985,
  48193, 30879, 50856, 1922, 15811, 339883, 31094, 140831,
  177745, 19185, 47182, 21509, 199089, 6420, 346866, 2738,
  30790, 219, 135519, 31692, 42315, 43056, 30440, 43036,
];

// ─── BUILDER SLOT LINEUP (identico a T113) ────────────────────────────────────

const BENCH_ROLE_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 };

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
  votoMap: Map<number, number | null>,
): SlotEntry[] {
  const slots: SlotEntry[] = [];

  slots.push({ playerId: gks[0],        slotPosition: "GK",  slotIndex: 1,  isStarter: true, benchOrder: null });
  slots.push({ playerId: defsActive[0], slotPosition: "DEF", slotIndex: 2,  isStarter: true, benchOrder: null });
  slots.push({ playerId: defsActive[1], slotPosition: "DEF", slotIndex: 3,  isStarter: true, benchOrder: null });
  slots.push({ playerId: defSv,         slotPosition: "DEF", slotIndex: 4,  isStarter: true, benchOrder: null }); // S.V.
  slots.push({ playerId: defsActive[2], slotPosition: "DEF", slotIndex: 5,  isStarter: true, benchOrder: null });
  slots.push({ playerId: mids[0],       slotPosition: "MID", slotIndex: 6,  isStarter: true, benchOrder: null });
  slots.push({ playerId: mids[1],       slotPosition: "MID", slotIndex: 7,  isStarter: true, benchOrder: null });
  slots.push({ playerId: mids[2],       slotPosition: "MID", slotIndex: 8,  isStarter: true, benchOrder: null });
  slots.push({ playerId: atts[0],       slotPosition: "ATT", slotIndex: 9,  isStarter: true, benchOrder: null }); // capitano
  slots.push({ playerId: atts[1],       slotPosition: "ATT", slotIndex: 10, isStarter: true, benchOrder: null });
  slots.push({ playerId: atts[2],       slotPosition: "ATT", slotIndex: 11, isStarter: true, benchOrder: null });

  const benchCandidates: { playerId: number; slotPosition: string }[] = [
    ...gks.slice(1).map(id => ({ playerId: id, slotPosition: "GK" })),
    ...defsActive.slice(3).map(id => ({ playerId: id, slotPosition: "DEF" })),
    ...mids.slice(3).map(id => ({ playerId: id, slotPosition: "MID" })),
    ...atts.slice(3).map(id => ({ playerId: id, slotPosition: "ATT" })),
  ];

  benchCandidates.sort((a, b) => {
    const rA = BENCH_ROLE_ORDER[a.slotPosition] ?? 99;
    const rB = BENCH_ROLE_ORDER[b.slotPosition] ?? 99;
    if (rA !== rB) return rA - rB;
    const vA = votoMap.get(a.playerId) ?? null;
    const vB = votoMap.get(b.playerId) ?? null;
    if (vA === null && vB === null) return 0;
    if (vA === null) return 1;
    if (vB === null) return -1;
    return vB - vA;
  });

  benchCandidates.forEach((p, idx) => {
    slots.push({
      playerId: p.playerId,
      slotPosition: p.slotPosition,
      slotIndex: 12 + idx,
      isStarter: false,
      benchOrder: idx + 1,
    });
  });

  return slots;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== T122 Step 6.A — Round 1: lineups + scoring + classifica ===\n");

  // ── 1. Verifica match round 1 ──────────────────────────────────────────────
  const round1Matches = await db
    .select()
    .from(competitionMatches)
    .where(
      and(
        eq(competitionMatches.competitionId, COMPETITION_ID),
        eq(competitionMatches.giornata, ROUND),
      ),
    );

  console.log(`Match round 1 trovati: ${round1Matches.length}`);
  for (const m of round1Matches) {
    console.log(`  #${m.id} [order ${m.matchOrder}] ${m.homeFantaTeamId} vs ${m.awayFantaTeamId}`);
  }
  if (round1Matches.length !== 4) {
    throw new Error(`Attesi 4 match round 1, trovati ${round1Matches.length}`);
  }
  console.log();

  // ── 2. Cancella lineup round 1 esistenti (se ri-eseguiamo) ────────────────
  const existingLineups = await db
    .select({ id: lineups.id })
    .from(lineups)
    .where(
      and(
        eq(lineups.season, SEASON),
        eq(lineups.round, ROUND),
        inArray(lineups.fantaTeamId, TEAMS),
      ),
    );

  if (existingLineups.length > 0) {
    await db.delete(lineupPlayers).where(
      inArray(lineupPlayers.lineupId, existingLineups.map(l => l.id)),
    );
    await db.delete(lineups).where(
      inArray(lineups.id, existingLineups.map(l => l.id)),
    );
    console.log(`Rimossi ${existingLineups.length} lineup round 1 esistenti.\n`);
  }

  // ── 3. Shuffle pool con PRNG seed 41 ──────────────────────────────────────
  const rng = makePrng(PRNG_SEED);

  const gkPool      = shuffle([...GK_ACTIVE, ...GK_SV], rng).slice(0, 24);
  const defActive   = shuffle(DEF_ACTIVE, rng).slice(0, 56);
  const defSv       = [...DEF_SV];
  const midPool     = shuffle(MID_ACTIVE, rng).slice(0, 64);
  const attPool     = shuffle(ATT_ACTIVE, rng).slice(0, 48);

  const allIds = [...gkPool, ...defActive, ...defSv, ...midPool, ...attPool];
  const unique = new Set(allIds);
  if (unique.size !== allIds.length) {
    throw new Error(`Duplicati: ${allIds.length} slot, ${unique.size} unici`);
  }
  console.log(`Pool round 1 (seed 41): ${allIds.length} giocatori unici ✓\n`);

  // ── 4. Recupera voti round 1 per panchina ordinata ─────────────────────────
  const votoRows = await db
    .select({ playerId: playerGiornataStats.playerId, voto: playerGiornataStats.votoMister })
    .from(playerGiornataStats)
    .where(
      and(
        eq(playerGiornataStats.season, SEASON),
        eq(playerGiornataStats.round, ROUND),
        inArray(playerGiornataStats.playerId, allIds),
      ),
    );
  const votoMap = new Map<number, number | null>(
    votoRows.map(r => [r.playerId, r.voto ?? null]),
  );
  console.log(`Voti round 1 caricati: ${votoMap.size} giocatori ✓\n`);

  // ── 5. Costruisci e inserisci lineup per ogni team ─────────────────────────
  console.log("Inserisco 8 lineup round 1…");
  const lineupsByTeam = new Map<string, { lineup: typeof lineups.$inferSelect; slotPlayers: SlotEntry[] }>();

  for (let t = 0; t < 8; t++) {
    const teamId = TEAMS[t];
    const teamGks       = gkPool.slice(t * 3, t * 3 + 3);
    const teamDefsActive = defActive.slice(t * 7, t * 7 + 7);
    const teamDefSv     = defSv[t];
    const teamMids      = midPool.slice(t * 8, t * 8 + 8);
    const teamAtts      = attPool.slice(t * 6, t * 6 + 6);
    const captainPlayerId = teamAtts[0];

    const players = buildLineupPlayers(teamGks, teamDefsActive, teamDefSv, teamMids, teamAtts, votoMap);

    const [lineup] = await db
      .insert(lineups)
      .values({
        fantaTeamId: teamId,
        season: SEASON,
        round: ROUND,
        module: "4-3-3",
        captainPlayerId,
      })
      .returning();

    await db.insert(lineupPlayers).values(
      players.map(p => ({ ...p, lineupId: lineup.id })),
    );

    lineupsByTeam.set(teamId, { lineup, slotPlayers: players });

    const svStarter = players.find(p => p.isStarter && DEF_SV.includes(p.playerId));
    console.log(
      `  ${teamId}: 4-3-3, cap=${captainPlayerId}, SV DEF=${svStarter?.playerId ?? "?"}, ` +
      `${players.filter(p => p.isStarter).length} titolari, ${players.filter(p => !p.isStarter).length} panchina`,
    );
  }
  console.log("\nLineup round 1 inseriti ✓\n");

  // ── 6. Scoring ────────────────────────────────────────────────────────────
  console.log("─── Scoring round 1 ──────────────────────────────────────────────");

  const playerVoti = new Map<number, number | null>(
    (await db.select({ playerId: playerGiornataStats.playerId, voto: playerGiornataStats.votoMister })
      .from(playerGiornataStats)
      .where(and(eq(playerGiornataStats.season, SEASON), eq(playerGiornataStats.round, ROUND)))
    ).map(s => [s.playerId, s.voto ?? null]),
  );

  const allPlayers = await db.select({ id: playersTable.id, roleClassic: playersTable.roleClassic }).from(playersTable);
  const playerRoles = new Map<number, SlotPosition>(
    allPlayers.map(p => [p.id, p.roleClassic as SlotPosition]),
  );

  const teamRows = await db
    .select({ id: fantaTeams.id, headCoachId: fantaTeams.headCoachId })
    .from(fantaTeams)
    .where(inArray(fantaTeams.id, TEAMS));

  const coachIds = teamRows.map(t => t.headCoachId).filter((id): id is number => id !== null);
  const coachRows = coachIds.length > 0
    ? await db.select().from(coaches).where(inArray(coaches.id, coachIds))
    : [];
  const coachById = new Map(coachRows.map(c => [c.id, c]));
  const headCoachByTeam = new Map(
    teamRows.filter(t => t.headCoachId !== null).map(t => [t.id, coachById.get(t.headCoachId!)]),
  );

  const fixtures = await db
    .select()
    .from(serieAFixtures)
    .where(and(eq(serieAFixtures.season, SEASON), eq(serieAFixtures.round, ROUND)));

  const fixtureResultByTeamId = new Map<number, { goalsFor: number; goalsAgainst: number }>();
  for (const fx of fixtures) {
    if (fx.homeGoals !== null && fx.awayGoals !== null) {
      fixtureResultByTeamId.set(fx.homeTeamId, { goalsFor: fx.homeGoals, goalsAgainst: fx.awayGoals });
      fixtureResultByTeamId.set(fx.awayTeamId, { goalsFor: fx.awayGoals, goalsAgainst: fx.homeGoals });
    }
  }

  const teamScores = new Map<string, number>();

  for (const [teamId, { lineup, slotPlayers }] of lineupsByTeam) {
    const coach = headCoachByTeam.get(teamId);
    const coachTeamId = coach?.currentTeamId ?? null;
    const fixtureResult = coachTeamId !== null ? (fixtureResultByTeamId.get(coachTeamId) ?? null) : null;
    const coachVoto = computeCoachVoto(fixtureResult);

    const result = computeFantaTeamScore({
      lineup: {
        module: lineup.module,
        captainPlayerId: lineup.captainPlayerId ?? null,
        players: slotPlayers.map(p => ({
          playerId: p.playerId,
          slotPosition: p.slotPosition as SlotPosition,
          slotIndex: p.slotIndex,
          isStarter: p.isStarter,
          benchOrder: p.benchOrder ?? null,
        })),
      },
      playerVoti,
      playerRoles,
      config: { captainMultiplier: 1.5 },
      coachVoto,
    });

    teamScores.set(teamId, result.totalScore);

    const baseScore = result.totalScore - result.coachDelta;
    const coachName = coach?.name ?? "(nessun allenatore)";
    const risultato = fixtureResult ? `${fixtureResult.goalsFor}:${fixtureResult.goalsAgainst}` : "—";
    console.log(`  ${teamId}: base=${baseScore.toFixed(2)}, coachDelta=${result.coachDelta >= 0 ? "+" : ""}${result.coachDelta.toFixed(1)} (${coachName}, ${risultato}), tot=${result.totalScore.toFixed(2)}`);
    if (result.substitutions.length > 0) {
      console.log(`    sub: ${result.substitutions.map(s => `${s.out}→${s.inId}`).join(", ")}`);
    }
  }
  console.log();

  // ── 7. Aggiorna competition_matches round 1 ───────────────────────────────
  console.log("─── Risultati round 1 ────────────────────────────────────────────");
  for (const match of round1Matches) {
    const homeScore = teamScores.get(match.homeFantaTeamId);
    const awayScore = teamScores.get(match.awayFantaTeamId);
    if (homeScore === undefined || awayScore === undefined) {
      throw new Error(`Score mancante per match ${match.id}`);
    }
    await db
      .update(competitionMatches)
      .set({
        homeScore: homeScore.toFixed(2),
        awayScore: awayScore.toFixed(2),
        playedAt: PLAYED_AT,
      })
      .where(eq(competitionMatches.id, match.id));

    const homeTeam = match.homeFantaTeamId.replace("ft-mvp-", "Team ");
    const awayTeam = match.awayFantaTeamId.replace("ft-mvp-", "Team ");
    console.log(`  [${match.homeFantaTeamId} vs ${match.awayFantaTeamId}]  ${homeScore.toFixed(2)} – ${awayScore.toFixed(2)}`);
  }
  console.log("\n4 partite round 1 aggiornate ✓\n");

  // ── 8. Classifica round 1 + round 2 ──────────────────────────────────────
  console.log("─── Classifica dopo round 1 + round 2 ───────────────────────────");

  const allMatches = await db
    .select()
    .from(competitionMatches)
    .where(
      and(
        eq(competitionMatches.competitionId, COMPETITION_ID),
        inArray(competitionMatches.giornata, [1, 2]),
      ),
    );

  type Row = { G: number; V: number; P: number; S: number; GF: number; GS: number; DR: number; PT: number };
  const table = new Map<string, Row>();
  for (const t of TEAMS) {
    table.set(t, { G: 0, V: 0, P: 0, S: 0, GF: 0, GS: 0, DR: 0, PT: 0 });
  }

  for (const m of allMatches) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const hs = parseFloat(m.homeScore);
    const as_ = parseFloat(m.awayScore);
    const home = table.get(m.homeFantaTeamId)!;
    const away = table.get(m.awayFantaTeamId)!;

    home.G++; home.GF += hs; home.GS += as_;
    away.G++; away.GF += as_; away.GS += hs;

    if (hs > as_) { home.V++; home.PT += 3; away.S++; }
    else if (hs < as_) { away.V++; away.PT += 3; home.S++; }
    else { home.P++; home.PT += 1; away.P++; away.PT += 1; }
  }

  for (const [t, r] of table) {
    r.DR = Math.round((r.GF - r.GS) * 100) / 100;
  }

  const sorted = [...table.entries()].sort(([, a], [, b]) => {
    if (b.PT !== a.PT) return b.PT - a.PT;
    if (b.DR !== a.DR) return b.DR - a.DR;
    if (b.GF !== a.GF) return b.GF - a.GF;
    return 0;
  });

  console.log(
    `${"Team".padEnd(10)} ${"G".padStart(2)} ${"V".padStart(2)} ${"P".padStart(2)} ${"S".padStart(2)} ${"GF".padStart(7)} ${"GS".padStart(7)} ${"DR".padStart(7)} ${"PT".padStart(3)}`,
  );
  console.log("─".repeat(55));
  for (const [teamId, r] of sorted) {
    console.log(
      `${teamId.padEnd(10)} ${r.G.toString().padStart(2)} ${r.V.toString().padStart(2)} ${r.P.toString().padStart(2)} ${r.S.toString().padStart(2)} ${r.GF.toFixed(2).padStart(7)} ${r.GS.toFixed(2).padStart(7)} ${r.DR.toFixed(2).padStart(7)} ${r.PT.toString().padStart(3)}`,
    );
  }

  console.log("\n=== Completato ===");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
