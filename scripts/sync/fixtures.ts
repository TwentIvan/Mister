/**
 * sync:fixtures — sincronizza il calendario partite Serie A da API-Football.
 *
 * Non scrive in nessuna tabella (la tabella fixtures/matchdays non esiste
 * ancora nello schema). Stampa un report: partite per round, range date,
 * fixture_id list per i round richiesti.
 *
 * CLI: pnpm sync:fixtures [--live] [--season=2024] [--rounds=1,2,3,4] [--max-requests=N]
 */

import { createClient, getLiveRequestCount } from "./lib/client.js";

export interface ApiFixture {
  fixture: {
    id: number;
    referee: string;
    date: string;
    status: { short: string; elapsed: number | null };
  };
  league: {
    id: number;
    name: string;
    round: string;
    season: number;
  };
  teams: {
    home: { id: number; name: string; winner: boolean | null };
    away: { id: number; name: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
}

export type SyncCounts = {
  scanned: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
};

export function parseRoundNumber(round: string): number | null {
  const m = round.match(/Regular Season\s*-\s*(\d+)/i);
  if (!m) return null;
  return parseInt(m[1], 10);
}

export async function run(opts: {
  live: boolean;
  maxRequests: number;
  season?: string;
  requestedRounds?: number[];
}): Promise<{ counts: SyncCounts; byRound: Map<number, ApiFixture[]>; fixtureSeasonMap: Map<number, number> }> {
  const { live, maxRequests, season = "2024", requestedRounds = [] } = opts;
  const client = createClient(live ? "live" : "mock");
  const counts: SyncCounts = { scanned: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };

  if (live && getLiveRequestCount() >= maxRequests) {
    console.log(`[STOP] budget limit raggiunto (${getLiveRequestCount()}/${maxRequests})`);
    return { counts, byRound: new Map(), fixtureSeasonMap: new Map() };
  }

  const resp = await client.get<ApiFixture>("fixtures", {
    league: "135",
    season,
  });

  const byRound = new Map<number, ApiFixture[]>();
  const fixtureSeasonMap = new Map<number, number>();
  let minDate = "";
  let maxDate = "";

  for (const item of resp.response) {
    counts.scanned++;
    const roundNum = parseRoundNumber(item.league.round);
    if (roundNum === null) {
      counts.skipped++;
      console.warn(`[WARN] round non parsabile: "${item.league.round}"`);
      continue;
    }
    if (!byRound.has(roundNum)) byRound.set(roundNum, []);
    byRound.get(roundNum)!.push(item);
    fixtureSeasonMap.set(item.fixture.id, item.league.season ?? parseInt(season, 10));
    const d = item.fixture.date.slice(0, 10);
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  }

  console.log("\n=== Report fixtures ===");
  console.log(`Stagione: ${season}  |  Range date: ${minDate} → ${maxDate}`);
  console.log(`Totale partite scansionate: ${counts.scanned}`);
  console.log(`Round disponibili: ${[...byRound.keys()].sort((a, b) => a - b).join(", ")}`);

  const roundsToShow =
    requestedRounds.length > 0
      ? requestedRounds
      : [...byRound.keys()].sort((a, b) => a - b);

  console.log("\n--- Dettaglio per round ---");
  for (const r of roundsToShow) {
    const fixtures = byRound.get(r);
    if (!fixtures) {
      console.log(`  Round ${r}: nessuna partita`);
      continue;
    }
    const ids = fixtures.map((f) => f.fixture.id).join(", ");
    console.log(`  Round ${r}: ${fixtures.length} partite | fixture_id: [${ids}]`);
    for (const f of fixtures) {
      console.log(
        `    fixture_id=${f.fixture.id} ` +
          `${f.teams.home.name} vs ${f.teams.away.name} ` +
          `${f.goals.home ?? "-"}:${f.goals.away ?? "-"} ` +
          `(${f.fixture.status.short}) date=${f.fixture.date.slice(0, 10)}`,
      );
      counts.inserted++;
    }
  }

  console.log("\n=== sync:fixtures riepilogo ===");
  console.log(JSON.stringify(counts, null, 2));
  return { counts, byRound, fixtureSeasonMap };
}

// Esecuzione standalone
if (process.argv[1]?.endsWith("fixtures.ts") || process.argv[1]?.endsWith("fixtures.js")) {
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
  const seasonArg = args.find((a) => a.startsWith("--season="));
  const season = seasonArg?.replace("--season=", "") ?? "2024";

  run({ live, maxRequests, season, requestedRounds }).catch((err) => {
    console.error("[FATAL]", (err as Error).message);
    process.exit(1);
  });
}
