/**
 * sync:players — sincronizza anagrafica giocatori da API-Football.
 *
 * CLI: pnpm sync:players [--live] [--max-requests=N]
 */

import { createClient, getLiveRequestCount } from "./lib/client.js";
import { mapRoleClassic } from "./lib/role-mapper.js";
import { loadCheckpoint, saveCheckpoint, clearCheckpoint } from "./lib/checkpoint.js";
import { pool } from "@workspace/db";
import type { PlayerRoleClassic } from "@workspace/db/schema";

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
  birthDate: string | null;
  nationality: string | null;
  heightCm: number | null;
  photoUrl: string | null;
}

function parseHeightCm(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function buildRecord(item: ApiPlayer): PlayerRecord | null {
  const { player, statistics } = item;
  const stats = statistics[0];
  if (!stats) return null;
  const roleClassic = mapRoleClassic(stats.games.position);
  if (roleClassic === null) return null;
  return {
    id: player.id,
    name: player.name,
    fullName: `${player.firstname} ${player.lastname}`.trim(),
    realTeam: stats.team.name,
    roleClassic,
    birthDate: player.birth?.date ?? null,
    nationality: player.nationality ?? null,
    heightCm: parseHeightCm(player.height),
    photoUrl: player.photo ?? null,
  };
}

export type SyncCounts = {
  scanned: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
};

export type ErrorEntry = { playerId: number; reason: string };

export async function run(opts: {
  live: boolean;
  maxRequests: number;
}): Promise<{ counts: SyncCounts; errors: ErrorEntry[] }> {
  const { live, maxRequests } = opts;
  const client = createClient(live ? "live" : "mock");
  const checkpoint = loadCheckpoint("players") as { lastPage?: number } | null;
  const startPage = checkpoint?.lastPage ?? 1;

  const counts: SyncCounts = { scanned: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  const errorLog: ErrorEntry[] = [];

  let page = startPage;
  let totalPages = 1;
  let budgetStop = false;

  do {
    if (live && getLiveRequestCount() >= maxRequests) {
      console.log(`[STOP] budget limit raggiunto (${getLiveRequestCount()}/${maxRequests})`);
      budgetStop = true;
      break;
    }

    const resp = await client.get<ApiPlayer>("players", {
      league: "135",
      season: "2024",
      page: String(page),
    });

    totalPages = resp.paging.total;

    for (const item of resp.response) {
      counts.scanned++;
      try {
        const record = buildRecord(item);
        if (record === null) {
          counts.skipped++;
          const pos = item.statistics[0]?.games?.position ?? "nessuna statistica";
          const reason = `posizione sconosciuta o statistica mancante: "${pos}"`;
          console.warn(`[SKIP] player_id=${item.player.id}: ${reason}`);
          errorLog.push({ playerId: item.player.id, reason });
          continue;
        }

        const result = await pool.query<{ xmax: string }>(
          `INSERT INTO players
            (id, name, full_name, real_team, role_classic, roles_mantra,
             birth_date, nationality, height_cm, photo_url, injured, last_synced_at)
           VALUES ($1, $2, $3, $4, $5, '[]'::jsonb, $6, $7, $8, $9, false, NOW())
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             real_team = EXCLUDED.real_team,
             role_classic = EXCLUDED.role_classic,
             last_synced_at = NOW()
           RETURNING xmax::text`,
          [
            record.id,
            record.name,
            record.fullName,
            record.realTeam,
            record.roleClassic,
            record.birthDate,
            record.nationality,
            record.heightCm,
            record.photoUrl,
          ],
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
        console.error(`[ERRORE] player_id=${item.player.id}: ${reason}`);
        errorLog.push({ playerId: item.player.id, reason });
      }
    }

    saveCheckpoint("players", { lastPage: page });
    page++;
  } while (page <= totalPages && !budgetStop);

  if (!budgetStop) {
    clearCheckpoint("players");
  }

  console.log("\n=== sync:players riepilogo ===");
  console.log(JSON.stringify(counts, null, 2));
  if (errorLog.length > 0) {
    console.log("\n--- Errori/skip ---");
    for (const e of errorLog) {
      console.log(`  player_id=${e.playerId}: ${e.reason}`);
    }
  }

  return { counts, errors: errorLog };
}

// Esecuzione standalone
if (process.argv[1]?.endsWith("players.ts") || process.argv[1]?.endsWith("players.js")) {
  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const maxRequestsArg = args.find((a) => a.startsWith("--max-requests="));
  const maxRequests = maxRequestsArg
    ? parseInt(maxRequestsArg.replace("--max-requests=", ""), 10)
    : Infinity;

  run({ live, maxRequests })
    .then(() => pool.end())
    .catch((err) => {
      console.error("[FATAL]", (err as Error).message);
      pool.end().finally(() => process.exit(1));
    });
}
