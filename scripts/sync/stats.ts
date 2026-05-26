/**
 * sync:stats — sincronizza statistiche giocatore per partita.
 *
 * Legge /fixtures per ottenere i fixture_id per round, poi chiama
 * /fixtures/players per ogni partita. Upsert in player_giornata_stats.
 * voto_mister resta NULL — non implementato in questa task.
 *
 * CLI: pnpm sync:stats [--live] [--rounds=1,2,3,4] [--max-requests=N]
 */

import { createClient, getLiveRequestCount } from "./lib/client.js";
import { loadCheckpoint, saveCheckpoint, clearCheckpoint } from "./lib/checkpoint.js";
import { pool } from "@workspace/db";
import { parseRoundNumber } from "./fixtures.js";

interface ApiFixture {
  fixture: { id: number };
  league: { round: string; season: number };
}

interface ApiFixturePlayerStats {
  games: {
    minutes: number | null;
    number: number | null;
    position: string;
    rating: string | null;
    captain: boolean;
    substitute: boolean;
  };
  goals: { total: number | null; conceded: number | null; assists: number | null; saves: number | null };
  shots: { total: number | null; on: number | null };
  passes: { total: number | null; key: number | null; accuracy: string | null };
  tackles: { total: number | null; blocks: number | null; interceptions: number | null };
  duels: { total: number | null; won: number | null };
  dribbles: { attempts: number | null; success: number | null; past: number | null };
  fouls: { drawn: number | null; committed: number | null };
  cards: { yellow: number; red: number };
  penalty: {
    won: number | null;
    commited: number | null;
    scored: number | null;
    missed: number | null;
    saved: number | null;
  };
}

interface ApiFixturePlayers {
  team: { id: number; name: string };
  players: Array<{
    player: { id: number; name: string };
    statistics: ApiFixturePlayerStats[];
  }>;
}

export type SyncCounts = {
  scanned: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
};

export type ErrorEntry = { playerId: number; fixtureId: number; reason: string };

export async function run(opts: {
  live: boolean;
  maxRequests: number;
  requestedRounds?: number[];
}): Promise<{ counts: SyncCounts; errors: ErrorEntry[] }> {
  const { live, maxRequests, requestedRounds = [] } = opts;
  const client = createClient(live ? "live" : "mock");
  const counts: SyncCounts = { scanned: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  const errorLog: ErrorEntry[] = [];

  const checkpoint = loadCheckpoint("stats") as { processedFixtures?: number[] } | null;
  const processedFixtures = new Set<number>(checkpoint?.processedFixtures ?? []);

  if (live && getLiveRequestCount() >= maxRequests) {
    console.log(`[STOP] budget limit raggiunto prima di /fixtures`);
    return { counts, errors: errorLog };
  }

  const fixturesResp = await client.get<ApiFixture>("fixtures", {
    league: "135",
    season: "2024",
  });

  const fixturesByRound = new Map<number, number[]>();
  const fixtureSeasonMap = new Map<number, number>();

  for (const item of fixturesResp.response) {
    const roundNum = parseRoundNumber(item.league.round);
    if (roundNum === null) continue;
    if (!fixturesByRound.has(roundNum)) fixturesByRound.set(roundNum, []);
    fixturesByRound.get(roundNum)!.push(item.fixture.id);
    fixtureSeasonMap.set(item.fixture.id, item.league.season);
  }

  const roundsToProcess =
    requestedRounds.length > 0
      ? requestedRounds
      : [...fixturesByRound.keys()].sort((a, b) => a - b);

  let budgetStop = false;

  for (const round of roundsToProcess) {
    if (budgetStop) break;

    const fixtureIds = fixturesByRound.get(round);
    if (!fixtureIds || fixtureIds.length === 0) {
      console.log(`[INFO] Round ${round}: nessuna partita, salto`);
      continue;
    }

    console.log(`\n--- Round ${round}: ${fixtureIds.length} partite ---`);

    for (const fixtureId of fixtureIds) {
      if (budgetStop) break;

      if (processedFixtures.has(fixtureId)) {
        console.log(`[CHECKPOINT] fixture_id=${fixtureId} già processata, salto`);
        continue;
      }

      if (live && getLiveRequestCount() >= maxRequests) {
        console.log(`[STOP] budget limit raggiunto (${getLiveRequestCount()}/${maxRequests})`);
        budgetStop = true;
        break;
      }

      const playersResp = await client.get<ApiFixturePlayers>("fixtures/players", {
        fixture: String(fixtureId),
      });

      const season = fixtureSeasonMap.get(fixtureId) ?? 2024;

      for (const teamData of playersResp.response) {
        for (const playerEntry of teamData.players) {
          counts.scanned++;
          try {
            const stats = playerEntry.statistics[0];
            if (!stats) {
              counts.skipped++;
              const reason = "nessuna statistica nel payload";
              console.warn(`[SKIP] player_id=${playerEntry.player.id} fixture=${fixtureId}: ${reason}`);
              errorLog.push({ playerId: playerEntry.player.id, fixtureId, reason });
              continue;
            }

            if (stats.games.minutes === null || stats.games.minutes === 0) {
              counts.skipped++;
              const reason = `minuti=${stats.games.minutes ?? "null"} — giocatore non entrato`;
              console.warn(`[SKIP] player_id=${playerEntry.player.id} fixture=${fixtureId}: ${reason}`);
              errorLog.push({ playerId: playerEntry.player.id, fixtureId, reason });
              continue;
            }

            // Upsert stub del giocatore se non esiste — evita FK violation.
            // I campi obbligatori vengono aggiornati dal sync:players completo.
            await pool.query(
              `INSERT INTO players
                (id, name, full_name, real_team, role_classic, roles_mantra, injured)
               VALUES ($1, $2, $2, 'N/D', 'ATT', '[]'::jsonb, false)
               ON CONFLICT (id) DO NOTHING`,
              [playerEntry.player.id, playerEntry.player.name],
            );

            const result = await pool.query<{ xmax: string }>(
              `INSERT INTO player_giornata_stats
                (season, round, player_id, fixture_id, voto_mister, stats_json, synced_at)
               VALUES ($1, $2, $3, $4, NULL, $5::jsonb, NOW())
               ON CONFLICT (season, round, fixture_id, player_id) DO UPDATE SET
                 stats_json = EXCLUDED.stats_json,
                 synced_at = NOW()
               RETURNING xmax::text`,
              [season, round, playerEntry.player.id, fixtureId, JSON.stringify(stats)],
            );

            const xmax = result.rows[0]?.xmax ?? "0";
            if (xmax === "0") {
              counts.inserted++;
            } else {
              counts.updated++;
            }
          } catch (err) {
            counts.errors++;
            const reason = (err as Error).message;
            console.error(`[ERRORE] player_id=${playerEntry.player.id} fixture=${fixtureId}: ${reason}`);
            errorLog.push({ playerId: playerEntry.player.id, fixtureId, reason });
          }
        }
      }

      processedFixtures.add(fixtureId);
      saveCheckpoint("stats", { processedFixtures: [...processedFixtures] });
    }
  }

  if (!budgetStop) {
    clearCheckpoint("stats");
  }

  console.log("\n=== sync:stats riepilogo ===");
  console.log(JSON.stringify(counts, null, 2));
  if (errorLog.length > 0) {
    console.log("\n--- Errori/skip ---");
    for (const e of errorLog) {
      console.log(`  player_id=${e.playerId} fixture_id=${e.fixtureId}: ${e.reason}`);
    }
  }

  return { counts, errors: errorLog };
}

// Esecuzione standalone
if (process.argv[1]?.endsWith("stats.ts") || process.argv[1]?.endsWith("stats.js")) {
  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const maxRequestsArg = args.find((a) => a.startsWith("--max-requests="));
  const maxRequests = maxRequestsArg
    ? parseInt(maxRequestsArg.replace("--max-requests=", ""), 10)
    : Infinity;
  const roundsArg = args.find((a) => a.startsWith("--rounds="));
  const requestedRounds: number[] = roundsArg
    ? roundsArg.replace("--rounds=", "").split(",").map((r) => parseInt(r.trim(), 10)).filter((r) => !isNaN(r))
    : [];

  run({ live, maxRequests, requestedRounds })
    .then(() => pool.end())
    .catch((err) => {
      console.error("[FATAL]", (err as Error).message);
      pool.end().finally(() => process.exit(1));
    });
}
