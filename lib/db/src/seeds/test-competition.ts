import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, asc, sql } from "drizzle-orm";
import { competitions } from "../schema/competitions";
import { competitionMatches } from "../schema/competition-matches";
import { fantaTeams } from "../schema/fanta-teams";
import { leagues } from "../schema/leagues";
import type { CompetitionConfig } from "../schema/competitions";

// ─── Algoritmo round-robin (circle method) ────────────────────────────────────

function generateRoundRobin(teamIds: string[]): [string, string][][] {
  const n = teamIds.length;
  if (n % 2 !== 0) throw new Error("Il numero di squadre deve essere pari");

  const arr = [...teamIds];
  const rounds: [string, string][][] = [];

  for (let r = 0; r < n - 1; r++) {
    const matches: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      matches.push([arr[i], arr[n - 1 - i]]);
    }
    rounds.push(matches);
    // Ruota: arr[0] fisso, gli altri avanzano di una posizione
    const last = arr.pop()!;
    arr.splice(1, 0, last);
  }

  return rounds; // 7 giornate, 4 matches per giornata = 28 matches
}

// ─── Seed principale ──────────────────────────────────────────────────────────

export async function seedTestCompetition(
  db: NodePgDatabase<Record<string, never>>,
) {
  console.log("Seed test-competition...");

  // 1. Trova la lega
  const [league] = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(eq(leagues.name, "Lega Test MVP"))
    .limit(1);

  if (!league) {
    console.log("test-competition: lega 'Lega Test MVP' non trovata, skip.");
    return;
  }

  // 2. Idempotenza: se esiste già una competizione campionato in questa lega, skip
  const [existing] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.leagueId, league.id))
    .limit(1);

  if (existing) {
    console.log(
      `test-competition: competizione già presente (${existing.id}), skip.`,
    );
    return;
  }

  // 3. Costruisce il config campionato
  const config: CompetitionConfig = {
    campionato: {
      giornatePerGirone: 7,
      numeroGironi: 1,
      homeAdvantageEnabled: false,
      homeAdvantageBonus: 0,
      gironeNeutro: [],
    },
    scoring: { win: 3, draw: 1, loss: 0 },
    tiebreakers: [
      "scontri_diretti",
      "differenza_reti",
      "gol_fatti",
      "sorteggio",
    ],
    prizes: {},
    participantTeamIds: [],
  };

  // 4. Crea la competizione
  const [competition] = await db
    .insert(competitions)
    .values({
      id: "comp-mvp-campionato-2024",
      leagueId: league.id,
      name: "Campionato 2024-25",
      description: "",
      type: "campionato",
      season: 2024,
      startGiornata: 1,
      endGiornata: 7,
      config,
      active: true,
      completed: false,
    })
    .returning();

  // 5. Carica gli 8 fanta_team ordinati per id (determinismo)
  const teams = await db
    .select({ id: fantaTeams.id, name: fantaTeams.name })
    .from(fantaTeams)
    .where(eq(fantaTeams.leagueId, league.id))
    .orderBy(asc(fantaTeams.id));

  if (teams.length !== 8) {
    throw new Error(
      `test-competition: attesi 8 team, trovati ${teams.length}`,
    );
  }

  // 6. Genera calendario round-robin (7 giornate, 4 matches/giornata)
  const calendar = generateRoundRobin(teams.map((t) => t.id));

  // 7. Insert matches (28 totali)
  const rows: {
    competitionId: string;
    giornata: number;
    matchOrder: number;
    homeFantaTeamId: string;
    awayFantaTeamId: string;
  }[] = [];

  for (let g = 0; g < 7; g++) {
    const matches = calendar[g];
    for (let i = 0; i < matches.length; i++) {
      rows.push({
        competitionId: competition.id,
        giornata: g + 1,
        matchOrder: i + 1,
        homeFantaTeamId: matches[i][0],
        awayFantaTeamId: matches[i][1],
      });
    }
  }

  await db.insert(competitionMatches).values(rows).onConflictDoNothing();

  console.log(
    `test-competition: competizione '${competition.name}' creata, ${rows.length} matches inseriti.`,
  );
}
