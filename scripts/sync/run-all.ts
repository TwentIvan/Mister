/**
 * sync:all — orchestratore completo sync Serie A.
 *
 * Esegue in ordine: teams → players → fixtures → stats
 * Tutti gli step girano nello stesso processo, condividendo rate limiter e pool.
 *
 * CLI: pnpm sync:all [--live] [--max-requests=80] [--rounds=1,2,3,4]
 */

import { getLiveRequestCount } from "./lib/client.js";
import { pool } from "@workspace/db";
import { run as runTeams } from "./teams.js";
import { run as runPlayers } from "./players.js";
import { run as runFixtures } from "./fixtures.js";
import { run as runStats } from "./stats.js";

const args = process.argv.slice(2);
const live = args.includes("--live");
const maxRequestsArg = args.find((a) => a.startsWith("--max-requests="));
const maxRequests = maxRequestsArg
  ? parseInt(maxRequestsArg.replace("--max-requests=", ""), 10)
  : Infinity;

const roundsArg = args.find((a) => a.startsWith("--rounds="));
const requestedRounds: number[] = roundsArg
  ? roundsArg.replace("--rounds=", "").split(",").map((r) => parseInt(r.trim(), 10)).filter((r) => !isNaN(r))
  : [1, 2, 3, 4];

const seasonArg = args.find((a) => a.startsWith("--season="));
const season = seasonArg?.replace("--season=", "") ?? "2024";

const SEPARATOR = "═".repeat(60);
const STEP_SEP = "─".repeat(60);

function separator(label: string) {
  console.log(`\n${SEPARATOR}`);
  console.log(`  ${label}`);
  console.log(SEPARATOR);
}

function stepSep(label: string) {
  console.log(`\n${STEP_SEP}`);
  console.log(`  ${label}`);
  console.log(STEP_SEP);
}

function budgetStatus(label: string) {
  if (live) {
    const used = getLiveRequestCount();
    const pct = maxRequests === Infinity ? "" : ` / budget ${maxRequests}`;
    console.log(`\n[BUDGET] Dopo ${label}: ${used} request consumate${pct}`);
  }
}

async function getDbCounts(): Promise<{
  players: number;
  stats: number;
  statsByRound: Array<{ round: number; count: number }>;
  roleDistrib: Array<{ role: string; count: number }>;
}> {
  const [pCount, sCount, sRound, rDist] = await Promise.all([
    pool.query<{ count: string }>(`SELECT COUNT(*) as count FROM players`),
    pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM player_giornata_stats WHERE season = $1`,
      [parseInt(season, 10)],
    ),
    pool.query<{ round: number; count: string }>(
      `SELECT round, COUNT(*) as count
       FROM player_giornata_stats
       WHERE season = $1
       GROUP BY round ORDER BY round`,
      [parseInt(season, 10)],
    ),
    pool.query<{ role: string; count: string }>(
      `SELECT role_classic as role, COUNT(*) as count
       FROM players GROUP BY role_classic ORDER BY role_classic`,
    ),
  ]);

  return {
    players: parseInt(pCount.rows[0]?.count ?? "0", 10),
    stats: parseInt(sCount.rows[0]?.count ?? "0", 10),
    statsByRound: sRound.rows.map((r) => ({ round: r.round, count: parseInt(r.count, 10) })),
    roleDistrib: rDist.rows.map((r) => ({ role: r.role, count: parseInt(r.count, 10) })),
  };
}

async function main() {
  separator("MISTER — Sync Serie A 2024");
  console.log(`Modalità : ${live ? "LIVE" : "MOCK"}`);
  console.log(`Budget   : ${maxRequests === Infinity ? "nessun limite" : maxRequests}`);
  console.log(`Rounds   : ${requestedRounds.join(", ")}`);
  console.log(`Stagione : ${season}`);

  // Valida la connessione al DB
  try {
    await pool.query(`SELECT 1`);
    console.log("[OK] Connessione DB attiva");
  } catch (err) {
    console.error("[FATAL] Impossibile connettersi al DB:", (err as Error).message);
    await pool.end();
    process.exit(1);
  }

  // ── STEP 1: teams ──
  stepSep("STEP 1/4 — sync:teams");
  try {
    await runTeams({ live, maxRequests });
  } catch (err) {
    console.error("[FATAL] sync:teams fallito:", (err as Error).message);
    await pool.end();
    process.exit(1);
  }
  budgetStatus("sync:teams");

  // ── STEP 2: players ──
  stepSep("STEP 2/4 — sync:players");
  try {
    await runPlayers({ live, maxRequests });
  } catch (err) {
    console.error("[FATAL] sync:players fallito:", (err as Error).message);
    await pool.end();
    process.exit(1);
  }
  budgetStatus("sync:players");

  // ── STEP 3: fixtures ──
  stepSep("STEP 3/4 — sync:fixtures");
  try {
    await runFixtures({ live, maxRequests, season, requestedRounds: [] });
  } catch (err) {
    console.error("[FATAL] sync:fixtures fallito:", (err as Error).message);
    await pool.end();
    process.exit(1);
  }
  budgetStatus("sync:fixtures");

  // ── STEP 4: stats ──
  stepSep("STEP 4/4 — sync:stats");
  try {
    await runStats({ live, maxRequests, requestedRounds });
  } catch (err) {
    console.error("[FATAL] sync:stats fallito:", (err as Error).message);
    await pool.end();
    process.exit(1);
  }
  budgetStatus("sync:stats");

  // ── RIEPILOGO FINALE ──
  separator("RIEPILOGO FINALE");

  const counts = await getDbCounts();
  const requestsUsed = live ? getLiveRequestCount() : 0;

  console.log(`\nRequest API consumate : ${requestsUsed}${maxRequests !== Infinity ? `/${maxRequests}` : ""}`);
  console.log(`Giocatori in DB       : ${counts.players}`);
  console.log(`Righe player_giornata_stats (stagione ${season}): ${counts.stats}`);

  if (counts.roleDistrib.length > 0) {
    console.log("\nDistribuzione ruoli:");
    for (const { role, count } of counts.roleDistrib) {
      console.log(`  ${role.padEnd(4, " ")}: ${count}`);
    }
  }

  if (counts.statsByRound.length > 0) {
    console.log("\nStatistiche per round:");
    for (const { round, count } of counts.statsByRound) {
      console.log(`  Round ${String(round).padStart(2, " ")}: ${count} righe`);
    }
  }

  await pool.end();
  console.log("\n[OK] sync:all completato.");
}

main().catch(async (err) => {
  console.error("[FATAL]", (err as Error).message);
  await pool.end().catch(() => {});
  process.exit(1);
});
