/**
 * T124c — Round 1: lineups STRICT su contracts + scoring + update competition_matches
 *
 * CAUSA BUG T122 (documentata):
 *   Il vecchio script usava pool globali shufflati con seed=41.
 *   I contratti (T113) erano stati assegnati con seed=42 → shuffle diverso
 *   → player ID nei lineup round 1 NON corrispondevano ai contracts di quel team.
 *   Solo i player che per coincidenza atterravano nello stesso slot entrambe le
 *   volte (es. Ballo-Touré #105, Kabasele #18797) erano visibili nella UI.
 *
 * FIX:
 *   Per ogni team, il pool player viene letto STRICT dai contracts (source of truth),
 *   non da array globali. Zero dipendenza da shuffle di pool globali.
 *
 * PATTERN STRUTTURALE (vedi replit.md):
 *   Ogni script che genera lineup DEVE filtrare via contracts table.
 *   Mai assumere che un pool globale equivalga alla rosa di una fanta-team.
 *
 * PRNG seed: 41 (usato per shuffle interno alla rosa di ogni team)
 */

import { db } from "@workspace/db";
import {
  lineups,
  lineupPlayers,
  playerGiornataStats,
  players as playersTable,
  contracts,
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

// ─── PRNG (mulberry32) ────────────────────────────────────────────────────────

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

// ─── Tipi ─────────────────────────────────────────────────────────────────────

type SlotEntry = {
  playerId: number;
  slotPosition: string;
  slotIndex: number;
  isStarter: boolean;
  benchOrder: number | null;
};

const BENCH_ROLE_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 };

// ─── buildLineup ─────────────────────────────────────────────────────────────
// Riceve i player della squadra divisi per ruolo, con i loro voti.
// Costruisce lineup 4-3-3 con 1 SV starter DEF deliberato.

function buildLineup(
  gks: number[],
  defs: number[],
  mids: number[],
  atts: number[],
  votoMap: Map<number, number | null>,
): { slots: SlotEntry[]; captainId: number } {
  // Per ogni ruolo: separa attivi (voto non null) da SV (voto null)
  const isActive = (id: number) => (votoMap.get(id) ?? null) !== null;

  const gkActive  = gks.filter(isActive);
  const gkSv      = gks.filter(id => !isActive(id));

  const defActive = defs.filter(isActive);
  const defSv     = defs.filter(id => !isActive(id));

  const midActive = mids.filter(isActive);
  const attActive = atts.filter(isActive);

  // Titolari GK: primo attivo, altrimenti SV
  const starterGk = gkActive[0] ?? gkSv[0] ?? gks[0];

  // Titolari DEF: 3 attivi + 1 SV deliberato (se non ci sono SV, usa attivo)
  // Il SV deliberato va a slot 4 (per mostrare sostituzione in UI)
  const starterDefsActive = defActive.slice(0, 3);
  const starterDefSv      = defSv[0] ?? defActive[3] ?? defs[3] ?? defs[0];

  // Titolari MID/ATT: 3 attivi ciascuno
  const starterMids = midActive.slice(0, 3);
  const starterAtts = attActive.slice(0, 3);

  // Capitano = attivo con voto più alto tra i titolari
  const activeTitolari = [starterGk, ...starterDefsActive, ...starterMids, ...starterAtts]
    .filter(id => votoMap.get(id) !== null && votoMap.get(id) !== undefined);

  activeTitolari.sort((a, b) => (votoMap.get(b) ?? 0) - (votoMap.get(a) ?? 0));
  const captainId = activeTitolari[0] ?? starterAtts[0] ?? starterMids[0] ?? starterGk;

  const slots: SlotEntry[] = [];

  // Slot titolari 1-11
  slots.push({ playerId: starterGk,          slotPosition: "GK",  slotIndex: 1,  isStarter: true, benchOrder: null });
  slots.push({ playerId: starterDefsActive[0] ?? defs[0], slotPosition: "DEF", slotIndex: 2,  isStarter: true, benchOrder: null });
  slots.push({ playerId: starterDefsActive[1] ?? defs[1], slotPosition: "DEF", slotIndex: 3,  isStarter: true, benchOrder: null });
  slots.push({ playerId: starterDefSv,        slotPosition: "DEF", slotIndex: 4,  isStarter: true, benchOrder: null }); // SV
  slots.push({ playerId: starterDefsActive[2] ?? defs[2], slotPosition: "DEF", slotIndex: 5,  isStarter: true, benchOrder: null });
  slots.push({ playerId: starterMids[0] ?? mids[0],       slotPosition: "MID", slotIndex: 6,  isStarter: true, benchOrder: null });
  slots.push({ playerId: starterMids[1] ?? mids[1],       slotPosition: "MID", slotIndex: 7,  isStarter: true, benchOrder: null });
  slots.push({ playerId: starterMids[2] ?? mids[2],       slotPosition: "MID", slotIndex: 8,  isStarter: true, benchOrder: null });
  slots.push({ playerId: starterAtts[0] ?? atts[0],       slotPosition: "ATT", slotIndex: 9,  isStarter: true, benchOrder: null });
  slots.push({ playerId: starterAtts[1] ?? atts[1],       slotPosition: "ATT", slotIndex: 10, isStarter: true, benchOrder: null });
  slots.push({ playerId: starterAtts[2] ?? atts[2],       slotPosition: "ATT", slotIndex: 11, isStarter: true, benchOrder: null });

  // Calcola il set di starter per escluderli dalla panchina
  const starterSet = new Set(slots.map(s => s.playerId));

  // Panchina: tutti i player non starter
  const benchCandidates: { playerId: number; slotPosition: string }[] = [
    ...gks.filter(id => !starterSet.has(id)).map(id => ({ playerId: id, slotPosition: "GK" })),
    ...defs.filter(id => !starterSet.has(id)).map(id => ({ playerId: id, slotPosition: "DEF" })),
    ...mids.filter(id => !starterSet.has(id)).map(id => ({ playerId: id, slotPosition: "MID" })),
    ...atts.filter(id => !starterSet.has(id)).map(id => ({ playerId: id, slotPosition: "ATT" })),
  ];

  // Ordina: per ruolo (GK→DEF→MID→ATT), poi voto DESC (SV ultimi)
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

  return { slots, captainId };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== T124c — Round 1: lineups STRICT su contracts + scoring ===\n");

  // ── 0. Verifica match round 1 ──────────────────────────────────────────────
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
    console.log(`  #${m.id} [${m.homeFantaTeamId} vs ${m.awayFantaTeamId}]`);
  }
  if (round1Matches.length !== 4) {
    throw new Error(`Attesi 4 match round 1, trovati ${round1Matches.length}`);
  }
  console.log();

  // ── 1. Cancella lineup round 1 esistenti ──────────────────────────────────
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
    console.log(`Rimossi ${existingLineups.length} lineup round 1 esistenti (player fantasma).\n`);
  }

  // ── 2. Carica voti round 1 ────────────────────────────────────────────────
  const votoRows = await db
    .select({ playerId: playerGiornataStats.playerId, voto: playerGiornataStats.votoMister })
    .from(playerGiornataStats)
    .where(and(eq(playerGiornataStats.season, SEASON), eq(playerGiornataStats.round, ROUND)));

  const votoMap = new Map<number, number | null>(
    votoRows.map(r => [r.playerId, r.voto !== null ? Number(r.voto) : null]),
  );
  console.log(`Voti round 1 caricati: ${votoMap.size} giocatori\n`);

  // ── 3. Per ogni team: leggi contracts, shuffla, costruisci lineup ──────────
  console.log("─── Costruzione lineup da contracts ─────────────────────────────");

  // PRNG unico seed 41 — consumato sequenzialmente per tutti i team
  const rng = makePrng(41);

  // Carica roles per tutti i player
  const allPlayers = await db
    .select({ id: playersTable.id, roleClassic: playersTable.roleClassic })
    .from(playersTable);
  const roleById = new Map<number, string>(allPlayers.map(p => [p.id, p.roleClassic]));

  const lineupsByTeam = new Map<string, { lineup: typeof lineups.$inferSelect; slots: SlotEntry[] }>();

  for (let t = 0; t < TEAMS.length; t++) {
    const teamId = TEAMS[t];

    // Legge i contratti del team (source of truth) ← FIX CORE
    const teamContracts = await db
      .select({ playerId: contracts.playerId })
      .from(contracts)
      .where(
        and(
          eq(contracts.fantaTeamId, teamId),
          eq(contracts.seasonStart, SEASON),
        ),
      );

    if (teamContracts.length === 0) {
      throw new Error(`Nessun contratto trovato per ${teamId} season ${SEASON}`);
    }

    const teamPlayerIds = teamContracts.map(c => c.playerId);

    // Partiziona per ruolo
    const gks:  number[] = [];
    const defs: number[] = [];
    const mids: number[] = [];
    const atts: number[] = [];

    for (const pid of teamPlayerIds) {
      const role = roleById.get(pid) ?? "MID";
      if      (role === "GK")  gks.push(pid);
      else if (role === "DEF") defs.push(pid);
      else if (role === "MID") mids.push(pid);
      else                     atts.push(pid);
    }

    // Shuffla ogni gruppo con PRNG (seed 41 comune, diverso offset per ogni team)
    const gkShuf  = shuffle(gks,  rng);
    const defShuf = shuffle(defs, rng);
    const midShuf = shuffle(mids, rng);
    const attShuf = shuffle(atts, rng);

    // Costruisce il lineup
    const { slots, captainId } = buildLineup(gkShuf, defShuf, midShuf, attShuf, votoMap);

    if (slots.length !== teamPlayerIds.length) {
      throw new Error(`${teamId}: attesi ${teamPlayerIds.length} slot, generati ${slots.length}`);
    }

    // Inserisce
    const [lineup] = await db
      .insert(lineups)
      .values({
        fantaTeamId: teamId,
        season: SEASON,
        round: ROUND,
        module: "4-3-3",
        captainPlayerId: captainId,
      })
      .returning();

    await db.insert(lineupPlayers).values(
      slots.map(p => ({ ...p, lineupId: lineup.id })),
    );

    lineupsByTeam.set(teamId, { lineup, slots });

    const svStarter = slots.find(s => s.isStarter && (votoMap.get(s.playerId) ?? null) === null);
    const starters = slots.filter(s => s.isStarter);
    const bestVoto = Math.max(
      ...starters.map(s => votoMap.get(s.playerId) ?? 0).filter(v => v > 0),
    );
    console.log(
      `  ${teamId}: ${teamPlayerIds.length} contratti → ${starters.length} titolari, ` +
      `${slots.length - starters.length} panchina, cap=${captainId} (${bestVoto.toFixed(2)}), ` +
      `SV starter=${svStarter?.playerId ?? "nessuno"}`,
    );
  }
  console.log();

  // ── 4. Verifica 0 orphan ──────────────────────────────────────────────────
  console.log("─── Verifica orphan ──────────────────────────────────────────────");
  const orphanCheck = await db.execute<{ orphans: string }>(
    `SELECT COUNT(*) AS orphans
     FROM lineup_players lp
     JOIN lineups l ON l.id = lp.lineup_id
     WHERE l.season = ${SEASON} AND l.round = ${ROUND}
     AND NOT EXISTS (
       SELECT 1 FROM contracts c
       WHERE c.player_id = lp.player_id
         AND c.fanta_team_id = l.fanta_team_id
         AND c.season_start = ${SEASON}
     )`,
  );
  const orphans = parseInt((orphanCheck.rows[0] as { orphans: string }).orphans, 10);
  if (orphans !== 0) {
    throw new Error(`ORPHAN CHECK FAILED: ${orphans} player non in contracts. Script ha ancora il bug.`);
  }
  console.log(`Orphan check: 0 ✓  (tutti i player sono in contracts del proprio team)\n`);

  // ── 5. Scoring ────────────────────────────────────────────────────────────
  console.log("─── Scoring round 1 ──────────────────────────────────────────────");

  const playerVoti = new Map<number, number | null>(
    (await db.select({ playerId: playerGiornataStats.playerId, voto: playerGiornataStats.votoMister })
      .from(playerGiornataStats)
      .where(and(eq(playerGiornataStats.season, SEASON), eq(playerGiornataStats.round, ROUND)))
    ).map(s => [s.playerId, s.voto !== null ? Number(s.voto) : null]),
  );

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
      fixtureResultByTeamId.set(fx.homeTeamId, { goalsFor: fx.homeGoals,  goalsAgainst: fx.awayGoals });
      fixtureResultByTeamId.set(fx.awayTeamId, { goalsFor: fx.awayGoals,  goalsAgainst: fx.homeGoals });
    }
  }

  const teamScores = new Map<string, number>();

  for (const [teamId, { lineup, slots }] of lineupsByTeam) {
    const coach = headCoachByTeam.get(teamId);
    const coachTeamId = coach?.currentTeamId ?? null;
    const fixtureResult = coachTeamId !== null ? (fixtureResultByTeamId.get(coachTeamId) ?? null) : null;
    const coachVoto = computeCoachVoto(fixtureResult);

    const result = computeFantaTeamScore({
      lineup: {
        module: lineup.module,
        captainPlayerId: lineup.captainPlayerId ?? null,
        players: slots.map(p => ({
          playerId:     p.playerId,
          slotPosition: p.slotPosition as SlotPosition,
          slotIndex:    p.slotIndex,
          isStarter:    p.isStarter,
          benchOrder:   p.benchOrder ?? null,
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
    console.log(
      `  ${teamId}: base=${baseScore.toFixed(2)}, coach=${result.coachDelta >= 0 ? "+" : ""}${result.coachDelta.toFixed(1)} (${coachName}, ${risultato}), ` +
      `tot=${result.totalScore.toFixed(2)}`,
    );
    if (result.substitutions.length > 0) {
      console.log(`    sub: ${result.substitutions.map(s => `${s.out}→${s.inId}`).join(", ")}`);
    }
  }
  console.log();

  // ── 6. Aggiorna competition_matches round 1 ───────────────────────────────
  console.log("─── Risultati round 1 ────────────────────────────────────────────");
  for (const match of round1Matches) {
    const homeScore = teamScores.get(match.homeFantaTeamId);
    const awayScore = teamScores.get(match.awayFantaTeamId);
    if (homeScore === undefined || awayScore === undefined) {
      throw new Error(`Score mancante per match #${match.id}`);
    }
    await db
      .update(competitionMatches)
      .set({
        homeScore: homeScore.toFixed(2),
        awayScore: awayScore.toFixed(2),
        playedAt: PLAYED_AT,
      })
      .where(eq(competitionMatches.id, match.id));

    console.log(`  [${match.homeFantaTeamId} vs ${match.awayFantaTeamId}]  ${homeScore.toFixed(2)} – ${awayScore.toFixed(2)}`);
  }
  console.log("\n4 partite round 1 aggiornate ✓\n");

  // ── 7. Classifica round 1 + round 2 ──────────────────────────────────────
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

  for (const [, r] of table) {
    r.DR = Math.round((r.GF - r.GS) * 100) / 100;
  }

  const sorted = [...table.entries()].sort(([, a], [, b]) => {
    if (b.PT !== a.PT) return b.PT - a.PT;
    if (b.DR !== a.DR) return b.DR - a.DR;
    if (b.GF !== a.GF) return b.GF - a.GF;
    return 0;
  });

  const H = `${"Team".padEnd(10)} ${"G".padStart(2)} ${"V".padStart(2)} ${"P".padStart(2)} ${"S".padStart(2)} ${"GF".padStart(7)} ${"GS".padStart(7)} ${"DR".padStart(7)} ${"PT".padStart(3)}`;
  console.log(H);
  console.log("─".repeat(H.length));
  for (const [teamId, r] of sorted) {
    console.log(
      `${teamId.padEnd(10)} ${r.G.toString().padStart(2)} ${r.V.toString().padStart(2)} ${r.P.toString().padStart(2)} ${r.S.toString().padStart(2)} ${r.GF.toFixed(2).padStart(7)} ${r.GS.toFixed(2).padStart(7)} ${r.DR.toFixed(2).padStart(7)} ${r.PT.toString().padStart(3)}`,
    );
  }

  console.log("\n=== T124c completato ===");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
