/**
 * sync:players — sincronizza anagrafica giocatori da API-Football.
 *
 * CLI: pnpm sync:players --dry-run
 *      pnpm sync:players --live   (bloccato in task 5b)
 */

import { createClient } from "./lib/client.js";
import { mapRoleClassic } from "./lib/role-mapper.js";
import { loadCheckpoint, saveCheckpoint } from "./lib/checkpoint.js";
import type { PlayerRoleClassic } from "@workspace/db/schema";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const live = args.includes("--live");

if (live) {
  createClient("live");
  process.exit(1);
}

interface ApiPlayer {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
    birth?: { date?: string };
    nationality?: string;
    height?: string;
    photo?: string;
  };
  statistics: Array<{
    team: { id: number; name: string };
    games: { position: string };
  }>;
}

interface PlayerRecord {
  id: number;
  name: string;
  fullName: string;
  realTeam: string;
  roleClassic: PlayerRoleClassic;
  rolesMantra: [];
  birthDate: string | null;
  nationality: string | null;
  heightCm: number | null;
  photoUrl: string | null;
  injured: boolean;
}

function parseHeightCm(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function buildRecord(item: ApiPlayer): PlayerRecord {
  const { player, statistics } = item;
  const stats = statistics[0];
  if (!stats) {
    throw new Error(`Nessuna statistica per player_id=${player.id}`);
  }
  return {
    id: player.id,
    name: player.name,
    fullName: `${player.firstname} ${player.lastname}`.trim(),
    realTeam: stats.team.name,
    roleClassic: mapRoleClassic(stats.games.position),
    rolesMantra: [],
    birthDate: player.birth?.date ?? null,
    nationality: player.nationality ?? null,
    heightCm: parseHeightCm(player.height),
    photoUrl: player.photo ?? null,
    injured: false,
  };
}

async function main() {
  const checkpoint = loadCheckpoint("players") as { lastPage?: number } | null;
  const startPage = checkpoint?.lastPage ?? 1;

  const client = createClient("mock");

  const counts = { scanned: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };

  let page = startPage;
  let totalPages = 1;

  do {
    const resp = client.get<ApiPlayer>("players", {
      league: "135",
      season: "2024",
      page: String(page),
    });

    totalPages = resp.paging.total;

    for (const item of resp.response) {
      counts.scanned++;
      try {
        const record = buildRecord(item);

        if (dryRun) {
          console.log(
            `[DRY-RUN] upsert player id=${record.id} ` +
              `name="${record.name}" team="${record.realTeam}" ` +
              `role=${record.roleClassic}`,
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
          `[ERRORE] player_id=${item.player.id}: ${(err as Error).message}`,
        );
      }
    }

    if (dryRun) {
      saveCheckpoint("players", { lastPage: page });
    }

    page++;
  } while (page <= totalPages);

  console.log("\n=== sync:players riepilogo ===");
  console.log(JSON.stringify(counts, null, 2));
}

main().catch((err) => {
  console.error("[FATAL]", (err as Error).message);
  process.exit(1);
});
