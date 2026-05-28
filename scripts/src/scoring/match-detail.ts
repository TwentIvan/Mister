import { db } from "@workspace/db";
import { lineups, lineupPlayers, playerGiornataStats } from "@workspace/db";
import { computeFantaTeamScore, type SlotPosition } from "@workspace/scoring";
import { eq, and, inArray } from "drizzle-orm";

const TEAMS = ["ft-mvp-1", "ft-mvp-7"] as const;
const ROUND  = 2;
const SEASON = 2024;

async function main() {
  // 1. Voti giornata 2 per tutti i giocatori
  const allStats = await db
    .select({ playerId: playerGiornataStats.playerId, voto: playerGiornataStats.votoMister })
    .from(playerGiornataStats)
    .where(and(eq(playerGiornataStats.season, SEASON), eq(playerGiornataStats.round, ROUND)));

  const votiMap = new Map<number, number | null>(
    allStats.map(s => [s.playerId, s.voto !== null ? Number(s.voto) : null]),
  );

  // 2. Lineup delle due squadre
  const lineupRows = await db
    .select()
    .from(lineups)
    .where(
      and(
        eq(lineups.season, SEASON),
        eq(lineups.round, ROUND),
        inArray(lineups.fantaTeamId, [...TEAMS]),
      ),
    );

  const lineupIds = lineupRows.map(l => l.id);
  const slotRows  = await db
    .select()
    .from(lineupPlayers)
    .where(inArray(lineupPlayers.lineupId, lineupIds));

  // 3. Raggruppa per squadra
  function getTeam(fantaTeamId: string) {
    const lineup = lineupRows.find(l => l.fantaTeamId === fantaTeamId);
    if (!lineup) return null;
    const players = slotRows.filter(p => p.lineupId === lineup.id);
    return { lineup, players };
  }

  const myData = getTeam("ft-mvp-1");
  const acData = getTeam("ft-mvp-7");
  if (!myData || !acData) { console.log("Lineup mancante"); process.exit(1); }

  function printTeam(label: string, data: NonNullable<typeof myData>) {
    const { lineup, players } = data;

    const inputPlayers = players.map(p => ({
      playerId: p.playerId,
      slotPosition: p.slotPosition as SlotPosition,
      slotIndex: p.slotIndex,
      isStarter: p.isStarter,
      benchOrder: p.benchOrder ?? null,
    }));

    const result = computeFantaTeamScore({
      lineup: { module: lineup.module, captainPlayerId: lineup.captainPlayerId ?? null, players: inputPlayers },
      playerVoti: votiMap,
      playerRoles: new Map(),
      config: { captainMultiplier: 1.5 },
    });

    const starters  = inputPlayers.filter(p => p.isStarter).sort((a, b) => a.slotIndex - b.slotIndex);
    const bench     = inputPlayers.filter(p => !p.isStarter).sort((a, b) => (a.benchOrder ?? 99) - (b.benchOrder ?? 99));
    const subOutMap = new Map(result.substitutions.map(s => [s.out, s.inId]));
    const subInSet  = new Set(result.substitutions.map(s => s.inId));

    let svSenzaSub = 0;

    console.log(`\n${"═".repeat(58)}`);
    console.log(`  ${label}  (${lineup.module})`);
    console.log(`${"═".repeat(58)}`);
    console.log("\n  TITOLARI:");
    for (const p of starters) {
      const v     = votiMap.get(p.playerId) ?? null;
      const subId = subOutMap.get(p.playerId);
      const cap   = lineup.captainPlayerId === p.playerId ? "[C]" : "   ";
      const vStr  = v !== null ? v.toFixed(2) : "S.V.";
      if (v === null && !subId) svSenzaSub++;
      const vIn      = subId !== undefined ? (votiMap.get(subId) ?? null) : null;
      const subNote  = subId
        ? `  →  IN ${subId} (${vIn !== null ? vIn.toFixed(2) : "S.V."})`
        : "";
      console.log(`    [${p.slotPosition.padEnd(3)}] ${cap} id=${String(p.playerId).padStart(7)}  ${vStr.padStart(5)}${subNote}`);
    }

    console.log("\n  PANCHINA:");
    for (const p of bench) {
      const v    = votiMap.get(p.playerId) ?? null;
      const used = subInSet.has(p.playerId);
      const vStr = v !== null ? v.toFixed(2) : "S.V.";
      console.log(`    [${p.slotPosition.padEnd(3)}] ord=${p.benchOrder ?? "-"}  id=${String(p.playerId).padStart(7)}  ${vStr.padStart(5)}${used ? "  ← SUBENTRATO" : ""}`);
    }

    console.log("\n  SOSTITUZIONI:");
    if (result.substitutions.length === 0) console.log("    (nessuna)");
    for (const s of result.substitutions) {
      const vIn = votiMap.get(s.inId) ?? null;
      console.log(`    OUT id=${s.out} (S.V.)  →  IN id=${s.inId} (${vIn !== null ? vIn.toFixed(2) : "S.V."})`);
    }

    const effSum = result.effectiveEleven.reduce((acc, p) => acc + (p.voto ?? 0), 0);
    console.log(`\n  S.V. senza sub eligibile  : ${svSenzaSub}  (contano 0)`);
    console.log(`  Somma voti effettivi       : ${effSum.toFixed(2)}`);
    console.log(`  Bonus capitano             : +${result.captainBonus.toFixed(2)}`);
    console.log(`  ${"─".repeat(38)}`);
    console.log(`  TOTALE                     : ${result.totalScore.toFixed(2)}`);
  }

  printTeam("Mario's Squad", myData);
  printTeam("Atletico Caffeina", acData);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
