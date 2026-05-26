/**
 * sync:fixtures — sincronizza il calendario partite Serie A da API-Football.
 *
 * Non scrive in nessuna tabella (la tabella fixtures/matchdays non esiste
 * ancora nello schema). Stampa un report: partite per round, range date,
 * fixture_id list per i round richiesti.
 *
 * CLI: pnpm sync:fixtures --dry-run --rounds=1,2,3,4
 *      pnpm sync:fixtures --live   (bloccato in task 5b)
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
  };
  teams: {
    home: { id: number; name: string; winner: boolean | null };
    away: { id: number; name: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
}

function parseRoundNumber(round: string): number | null {
  const m = round.match(/Regular Season\s*-\s*(\d+)/i);
  if (!m) return null;
  return parseInt(m[1], 10);
}

async function main() {
  const client = createClient("mock");
  const counts = { scanned: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };

  const resp = client.get<ApiFixture>("fixtures", {
    league: "135",
    season: "2024",
  });

  const byRound = new Map<number, ApiFixture[]>();
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

    const d = item.fixture.date.slice(0, 10);
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  }

  console.log("\n=== Report fixtures ===");
  console.log(`Stagione: 2024/25  |  Range date: ${minDate} → ${maxDate}`);
  console.log(`Totale partite scansionate: ${counts.scanned}`);
  console.log(`Round nel mock: ${[...byRound.keys()].sort((a, b) => a - b).join(", ")}`);

  const roundsToShow =
    requestedRounds.length > 0
      ? requestedRounds
      : [...byRound.keys()].sort((a, b) => a - b);

  console.log("\n--- Dettaglio per round ---");
  for (const r of roundsToShow) {
    const fixtures = byRound.get(r);
    if (!fixtures) {
      console.log(`  Round ${r}: nessuna partita nel mock`);
      continue;
    }
    const ids = fixtures.map((f) => f.fixture.id).join(", ");
    console.log(`  Round ${r}: ${fixtures.length} partite | fixture_id: [${ids}]`);
    if (dryRun) {
      for (const f of fixtures) {
        console.log(
          `    [DRY-RUN] fixture_id=${f.fixture.id} ` +
            `${f.teams.home.name} vs ${f.teams.away.name} ` +
            `${f.goals.home ?? "-"}:${f.goals.away ?? "-"} ` +
            `(${f.fixture.status.short}) date=${f.fixture.date.slice(0, 10)}`,
        );
        counts.inserted++;
      }
    }
  }

  console.log("\n=== sync:fixtures riepilogo ===");
  console.log(JSON.stringify(counts, null, 2));
}

main().catch((err) => {
  console.error("[FATAL]", (err as Error).message);
  process.exit(1);
});
