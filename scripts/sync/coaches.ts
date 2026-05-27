/**
 * coaches.ts
 * Sincronizza i 20 head-coach Serie A 2024-25 da API-Football.
 *
 * Uso:
 *   pnpm --filter @workspace/scripts run sync:coaches
 */

import { db } from "@workspace/db";
import { coaches, teamColors } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const API_KEY = process.env.API_FOOTBALL_KEY;
if (!API_KEY) {
  console.error("Variabile API_FOOTBALL_KEY mancante");
  process.exit(1);
}

const HEADERS = {
  "x-rapidapi-key": API_KEY,
  "x-rapidapi-host": "v3.football.api-sports.io",
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface ApiCoach {
  id: number;
  name: string;
  firstname: string;
  lastname: string;
  photo: string;
  nationality: string;
  birth: { date: string | null };
}

async function fetchHeadCoach(teamId: number): Promise<ApiCoach | null> {
  const url = `https://v3.football.api-sports.io/coachs?team=${teamId}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    console.warn(`  HTTP ${res.status} per team ${teamId}`);
    return null;
  }
  const json = (await res.json()) as { response: ApiCoach[] };
  if (!json.response || json.response.length === 0) return null;
  return json.response[0];
}

async function main() {
  // Legge tutti i team dal DB (team_colors ha i 20 team Serie A)
  const teams = await db.select({ teamId: teamColors.teamId, teamName: teamColors.teamName }).from(teamColors);
  console.log(`\n─── Sync coaches: ${teams.length} team ───\n`);

  let ok = 0;
  let skipped = 0;

  for (const team of teams) {
    process.stdout.write(`  [${team.teamName}] (${team.teamId}) — fetch…`);
    const coach = await fetchHeadCoach(team.teamId);

    if (!coach) {
      console.log(" nessun coach");
      skipped++;
    } else {
      await db
        .insert(coaches)
        .values({
          id: coach.id,
          name: coach.name,
          firstname: coach.firstname || null,
          lastname: coach.lastname || null,
          photoUrl: coach.photo || null,
          nationality: coach.nationality || null,
          birthDate: coach.birth?.date || null,
          currentTeamId: team.teamId,
        })
        .onConflictDoUpdate({
          target: coaches.id,
          set: {
            name: coach.name,
            firstname: coach.firstname || null,
            lastname: coach.lastname || null,
            photoUrl: coach.photo || null,
            nationality: coach.nationality || null,
            birthDate: coach.birth?.date || null,
            currentTeamId: team.teamId,
            updatedAt: new Date(),
          },
        });
      console.log(` ✓ ${coach.name} (id: ${coach.id})`);
      ok++;
    }

    await sleep(220); // rispetta il rate limit free/Pro API-Football
  }

  console.log(`\n─── Sommario: ${ok} upsert, ${skipped} skipped ───\n`);
}

main().catch((err) => {
  console.error("Errore fatale:", err);
  process.exit(1);
});
