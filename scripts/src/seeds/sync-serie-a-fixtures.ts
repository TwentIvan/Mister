/**
 * sync-serie-a-fixtures — fetcha giornate 1-2 Serie A 2024 da API-Football e persiste in serie_a_fixtures.
 *
 * CLI: pnpm --filter @workspace/scripts run sync:fixtures-persist [--live] [--rounds=1,2]
 */

import { db, serieAFixtures } from "@workspace/db";
import { run as fetchFixtures } from "../../sync/fixtures.js";
import { inArray } from "drizzle-orm";

const args = process.argv.slice(2);
const live = args.includes("--live");
const roundsArg = args.find(a => a.startsWith("--rounds="));
const requestedRounds: number[] = roundsArg
  ? roundsArg.replace("--rounds=", "").split(",").map(r => parseInt(r.trim(), 10)).filter(r => !isNaN(r))
  : [1, 2];

console.log(`=== sync-serie-a-fixtures | live=${live} | rounds=${requestedRounds.join(",")} ===\n`);

const { byRound } = await fetchFixtures({ live, maxRequests: 5, season: "2024", requestedRounds });

const rows = [];
for (const round of requestedRounds) {
  const fixtures = byRound.get(round) ?? [];
  for (const f of fixtures) {
    rows.push({
      id:           f.fixture.id,
      season:       f.league.season ?? 2024,
      round,
      homeTeamId:   f.teams.home.id,
      awayTeamId:   f.teams.away.id,
      homeTeamName: f.teams.home.name,
      awayTeamName: f.teams.away.name,
      homeGoals:    f.goals.home ?? null,
      awayGoals:    f.goals.away ?? null,
      status:       f.fixture.status.short ?? "NS",
      date:         f.fixture.date ? new Date(f.fixture.date) : null,
    });
  }
}

if (rows.length === 0) {
  console.log("Nessuna fixture da persistere. Uscita.");
  process.exit(0);
}

console.log(`\nPersisto ${rows.length} fixture in DB (upsert)…`);

await db
  .insert(serieAFixtures)
  .values(rows)
  .onConflictDoUpdate({
    target: serieAFixtures.id,
    set: {
      homeGoals:    serieAFixtures.homeGoals,
      awayGoals:    serieAFixtures.awayGoals,
      status:       serieAFixtures.status,
      homeTeamName: serieAFixtures.homeTeamName,
      awayTeamName: serieAFixtures.awayTeamName,
    },
  });

console.log("Fixture persistite ✓");

// Verifica
const persisted = await db.select().from(serieAFixtures)
  .where(inArray(serieAFixtures.round, requestedRounds));
const byR = new Map<number, typeof persisted>();
for (const f of persisted) {
  if (!byR.has(f.round)) byR.set(f.round, []);
  byR.get(f.round)!.push(f);
}
for (const r of requestedRounds) {
  const fs = byR.get(r) ?? [];
  console.log(`\nGiornata ${r} (${fs.length} partite):`);
  for (const f of fs) {
    console.log(`  id=${f.id}  ${f.homeTeamName} ${f.homeGoals ?? "-"}:${f.awayGoals ?? "-"} ${f.awayTeamName}  (${f.status})`);
  }
}

process.exit(0);
