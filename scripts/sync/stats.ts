/**
 * sync:stats — sincronizza statistiche giocatore per partita.
 *
 * Legge fixtures-players.json mock. Per ciascun giocatore: estrae
 * player.id, statistics complete e prepara l'upsert in player_giornata_stats.
 *
 * Nota: player_giornata_stats non ha una unique constraint su (player_id,
 * fixture_id). In live mode sarà necessario aggiungere tale constraint prima
 * di eseguire upsert idempotenti. Segnalato senza toccare lo schema.
 *
 * CLI: pnpm sync:stats --dry-run --rounds=1
 *      pnpm sync:stats --live   (bloccato in task 5b)
 */

import { createClient } from "./lib/client.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const live = args.includes("--live");

const roundsArg = args.find((a) => a.startsWith("--rounds="));
const requestedRounds: number[] = roundsArg
  ? roundsArg
      .replace("--rounds=", "")
      .split(",")
      .map((r) => parseInt(r.trim(), 10))
      .filter((r) => !isNaN(r))
  : [];

if (live) {
  createClient("live");
  process.exit(1);
}

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

function parseRoundNumber(round: string): number | null {
  const m = round.match(/Regular Season\s*-\s*(\d+)/i);
  if (!m) return null;
  return parseInt(m[1], 10);
}

interface PlayerGiornataRecord {
  season: number;
  round: number;
  playerId: number;
  fixtureId: number;
  votoMister: null;
  statsJson: unknown;
}

async function main() {
  const client = createClient("mock");
  const counts = { scanned: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };

  const fixturesResp = client.get<ApiFixture>("fixtures", {
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

  for (const round of roundsToProcess) {
    const fixtureIds = fixturesByRound.get(round);
    if (!fixtureIds || fixtureIds.length === 0) {
      console.log(`[INFO] Round ${round}: nessuna partita nel mock, salto`);
      continue;
    }

    console.log(`\n--- Round ${round}: ${fixtureIds.length} partite ---`);

    for (const fixtureId of fixtureIds) {
      const playersResp = client.get<ApiFixturePlayers>("fixtures/players", {
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
              console.warn(
                `[WARN] player_id=${playerEntry.player.id} fixture=${fixtureId}: nessuna statistica`,
              );
              continue;
            }

            const record: PlayerGiornataRecord = {
              season,
              round,
              playerId: playerEntry.player.id,
              fixtureId,
              votoMister: null,
              statsJson: stats,
            };

            if (dryRun) {
              console.log(
                `[DRY-RUN] upsert player_giornata_stats ` +
                  `player_id=${record.playerId} ` +
                  `fixture_id=${record.fixtureId} ` +
                  `season=${record.season} round=${record.round} ` +
                  `minuti=${stats.games.minutes ?? "N/A"} ` +
                  `gol=${stats.goals.total ?? 0} ` +
                  `assist=${stats.goals.assists ?? 0} ` +
                  `rating_raw=${stats.games.rating ?? "N/A"} ` +
                  `voto_mister=NULL`,
              );
              counts.inserted++;
            } else {
              throw new Error(
                "Modalità live non disponibile in task 5b — usa --dry-run",
              );
            }
          } catch (err) {
            counts.errors++;
            console.error(
              `[ERRORE] player_id=${playerEntry.player.id} fixture=${fixtureId}: ${(err as Error).message}`,
            );
          }
        }
      }
    }
  }

  console.log("\n=== sync:stats riepilogo ===");
  console.log(JSON.stringify(counts, null, 2));
}

main().catch((err) => {
  console.error("[FATAL]", (err as Error).message);
  process.exit(1);
});
