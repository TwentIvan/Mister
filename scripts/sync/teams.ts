/**
 * sync:teams — sincronizza le squadre Serie A da API-Football.
 *
 * Non esiste una tabella `teams` separata nello schema corrente: il team
 * è denormalizzato come `real_team` (text) su `players`. Questo script
 * logga la mappa team_id → team_name come riferimento per altri script.
 *
 * CLI: pnpm sync:teams --dry-run
 *      pnpm sync:teams --live   (bloccato in task 5b)
 */

import { createClient } from "./lib/client.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const live = args.includes("--live");

if (live) {
  createClient("live");
  process.exit(1);
}

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

async function main() {
  const client = createClient("mock");
  const counts = { scanned: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };

  const resp = client.get<ApiTeam>("teams", {
    league: "135",
    season: "2024",
  });

  const teamMap: Record<number, string> = {};

  for (const item of resp.response) {
    counts.scanned++;
    try {
      const { team, venue } = item;
      teamMap[team.id] = team.name;

      if (dryRun) {
        console.log(
          `[DRY-RUN] team id=${team.id} name="${team.name}" ` +
            `code="${team.code}" stadium="${venue.name}" city="${venue.city}"`,
        );
        counts.inserted++;
      } else {
        throw new Error(
          "Modalità live non disponibile in task 5b — usa --dry-run",
        );
      }
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
}

main().catch((err) => {
  console.error("[FATAL]", (err as Error).message);
  process.exit(1);
});
