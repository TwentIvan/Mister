/**
 * sync:teams — sincronizza le squadre Serie A da API-Football.
 *
 * Non esiste una tabella `teams` separata nello schema corrente: il team
 * è denormalizzato come `real_team` (text) su `players`. Questo script
 * logga la mappa team_id → team_name come riferimento per altri script.
 *
 * CLI: pnpm sync:teams [--live] [--max-requests=N]
 */

import { createClient, getLiveRequestCount } from "./lib/client.js";

interface ApiTeam {
  team: {
    id: number;
    name: string;
    code: string;
    country: string;
    founded: number;
    logo: string;
  };
  venue: {
    id: number;
    name: string;
    city: string;
    capacity: number;
  };
}

export type SyncCounts = {
  scanned: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
};

export async function run(opts: {
  live: boolean;
  maxRequests: number;
}): Promise<{ counts: SyncCounts }> {
  const { live, maxRequests } = opts;
  const client = createClient(live ? "live" : "mock");
  const counts: SyncCounts = { scanned: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };

  if (live && getLiveRequestCount() >= maxRequests) {
    console.log(`[STOP] budget limit raggiunto (${getLiveRequestCount()}/${maxRequests})`);
    console.log("\n=== sync:teams riepilogo ===");
    console.log(JSON.stringify(counts, null, 2));
    return { counts };
  }

  const resp = await client.get<ApiTeam>("teams", {
    league: "135",
    season: "2024",
  });

  const teamMap: Record<number, string> = {};

  for (const item of resp.response) {
    counts.scanned++;
    try {
      const { team, venue } = item;
      teamMap[team.id] = team.name;
      console.log(
        `[INFO] team id=${team.id} name="${team.name}" ` +
          `code="${team.code}" stadium="${venue.name}" city="${venue.city}"`,
      );
      counts.inserted++;
    } catch (err) {
      counts.errors++;
      console.error(`[ERRORE] team_id=${item.team.id}: ${(err as Error).message}`);
    }
  }

  console.log("\n=== Mappa team_id → team_name (riferimento) ===");
  for (const [id, name] of Object.entries(teamMap)) {
    console.log(`  ${id}: "${name}"`);
  }

  console.log("\n=== sync:teams riepilogo ===");
  console.log(JSON.stringify(counts, null, 2));
  return { counts };
}

// Esecuzione standalone
if (process.argv[1]?.endsWith("teams.ts") || process.argv[1]?.endsWith("teams.js")) {
  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const maxRequestsArg = args.find((a) => a.startsWith("--max-requests="));
  const maxRequests = maxRequestsArg
    ? parseInt(maxRequestsArg.replace("--max-requests=", ""), 10)
    : Infinity;

  run({ live, maxRequests }).catch((err) => {
    console.error("[FATAL]", (err as Error).message);
    process.exit(1);
  });
}
