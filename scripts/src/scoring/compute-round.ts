/**
 * Calcola i punteggi fanta di una giornata e aggiorna competition_matches.
 *
 * Uso:
 *   pnpm --filter @workspace/scripts run scoring:round -- --round 2
 *   pnpm --filter @workspace/scripts run scoring:round -- --round 2 --season 2024 --competition-id comp-mvp-campionato-2024
 */

import { db } from "@workspace/db";
import {
  lineups,
  lineupPlayers,
  playerGiornataStats,
  players as playersTable,
  competitionMatches,
  fantaTeams,
  coaches,
  serieAFixtures,
} from "@workspace/db";
import { computeFantaTeamScore, computeCoachVoto, type SlotPosition } from "@workspace/scoring";
import { eq, and, inArray } from "drizzle-orm";

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const round = parseInt(get("--round") ?? "2", 10);
  const season = parseInt(get("--season") ?? "2024", 10);
  const competitionId = get("--competition-id") ?? "comp-mvp-campionato-2024";
  return { round, season, competitionId };
}

async function main() {
  const { round, season, competitionId } = parseArgs();
  console.log(`\nCalcolo punteggi — competition: ${competitionId}, stagione: ${season}, giornata: ${round}\n`);

  // 1. Carica voto_mister per tutti i giocatori in questa giornata
  const stats = await db
    .select({
      playerId: playerGiornataStats.playerId,
      votoMister: playerGiornataStats.votoMister,
    })
    .from(playerGiornataStats)
    .where(
      and(
        eq(playerGiornataStats.season, season),
        eq(playerGiornataStats.round, round),
      ),
    );

  const playerVoti = new Map<number, number | null>(
    stats.map((s) => [s.playerId, s.votoMister ?? null]),
  );
  console.log(`Voti caricati: ${playerVoti.size} giocatori`);

  // 2. Carica ruoli Classico di tutti i giocatori
  const allPlayers = await db
    .select({ id: playersTable.id, roleClassic: playersTable.roleClassic })
    .from(playersTable);

  const playerRoles = new Map<number, SlotPosition>(
    allPlayers.map((p) => [p.id, p.roleClassic as SlotPosition]),
  );

  // 3. Carica i match della giornata
  const matches = await db
    .select()
    .from(competitionMatches)
    .where(
      and(
        eq(competitionMatches.competitionId, competitionId),
        eq(competitionMatches.giornata, round),
      ),
    );

  if (matches.length === 0) {
    console.error(`Nessun match trovato per giornata ${round} in ${competitionId}`);
    process.exit(1);
  }

  const allTeamIds = [
    ...new Set(matches.flatMap((m) => [m.homeFantaTeamId, m.awayFantaTeamId])),
  ];

  // 4. Carica lineup e giocatori per tutti i team
  const lineupRows = await db
    .select()
    .from(lineups)
    .where(
      and(
        eq(lineups.season, season),
        eq(lineups.round, round),
        inArray(lineups.fantaTeamId, allTeamIds),
      ),
    );

  if (lineupRows.length === 0) {
    console.error(`Nessuna formazione trovata per giornata ${round}`);
    process.exit(1);
  }

  const lineupPlayerRows = await db
    .select()
    .from(lineupPlayers)
    .where(
      inArray(
        lineupPlayers.lineupId,
        lineupRows.map((l) => l.id),
      ),
    );

  // 5. Carica dati allenatori per tutti i fanta-team
  const teamRows = await db
    .select({ id: fantaTeams.id, headCoachId: fantaTeams.headCoachId })
    .from(fantaTeams)
    .where(inArray(fantaTeams.id, allTeamIds));

  const coachIds = teamRows
    .map(t => t.headCoachId)
    .filter((id): id is number => id !== null);

  const coachRows = coachIds.length > 0
    ? await db.select().from(coaches).where(inArray(coaches.id, coachIds))
    : [];

  const coachById = new Map(coachRows.map(c => [c.id, c]));
  const headCoachByTeam = new Map(
    teamRows
      .filter(t => t.headCoachId !== null)
      .map(t => [t.id, coachById.get(t.headCoachId!)]),
  );

  // 6. Carica fixture Serie A per questa giornata
  const fixtures = await db
    .select()
    .from(serieAFixtures)
    .where(
      and(
        eq(serieAFixtures.season, season),
        eq(serieAFixtures.round, round),
      ),
    );

  // Mappa teamId → { goalsFor, goalsAgainst }
  const fixtureResultByTeamId = new Map<number, { goalsFor: number; goalsAgainst: number }>();
  for (const fx of fixtures) {
    if (fx.homeGoals !== null && fx.awayGoals !== null) {
      fixtureResultByTeamId.set(fx.homeTeamId, { goalsFor: fx.homeGoals, goalsAgainst: fx.awayGoals });
      fixtureResultByTeamId.set(fx.awayTeamId, { goalsFor: fx.awayGoals, goalsAgainst: fx.homeGoals });
    }
  }

  // Mappa: fantaTeamId → { lineup, slotPlayers }
  type TeamData = {
    lineup: (typeof lineupRows)[0];
    slotPlayers: (typeof lineupPlayerRows);
  };
  const lineupsByTeam = new Map<string, TeamData>();
  for (const l of lineupRows) {
    const slotPlayers = lineupPlayerRows.filter((p) => p.lineupId === l.id);
    lineupsByTeam.set(l.fantaTeamId, { lineup: l, slotPlayers });
  }

  // 7. Calcola punteggio per ogni team (con fattore allenatore)
  const teamScores = new Map<string, number>();

  console.log("─── Dettaglio per team ───────────────────────────────────────────");

  for (const [teamId, { lineup, slotPlayers }] of lineupsByTeam) {
    const coach = headCoachByTeam.get(teamId);
    const coachTeamId = coach?.currentTeamId ?? null;
    const fixtureResult = coachTeamId !== null ? (fixtureResultByTeamId.get(coachTeamId) ?? null) : null;
    const coachVoto = computeCoachVoto(fixtureResult);
    const coachDelta = Math.round((coachVoto - 6.0) / 0.5) * 0.5;

    const result = computeFantaTeamScore({
      lineup: {
        module: lineup.module,
        captainPlayerId: lineup.captainPlayerId ?? null,
        players: slotPlayers.map((p) => ({
          playerId: p.playerId,
          slotPosition: p.slotPosition as SlotPosition,
          slotIndex: p.slotIndex,
          isStarter: p.isStarter,
          benchOrder: p.benchOrder ?? null,
        })),
      },
      playerVoti,
      playerRoles,
      config: { captainMultiplier: 1.5 },
      coachVoto,
    });

    teamScores.set(teamId, result.totalScore);

    const coachName = coach?.name ?? "(nessun allenatore)";
    const risultato = fixtureResult
      ? `${fixtureResult.goalsFor}:${fixtureResult.goalsAgainst}`
      : "—";
    const baseScore = result.totalScore - result.coachDelta;

    console.log(`${teamId}`);
    console.log(`  Allenatore: ${coachName}  |  Risultato squadra: ${risultato}`);
    console.log(`  VotoCoach: ${coachVoto.toFixed(1)}  |  CoachDelta: ${coachDelta >= 0 ? "+" : ""}${coachDelta.toFixed(1)}`);
    console.log(`  Totale prima: ${baseScore.toFixed(2)}  →  Totale dopo: ${result.totalScore.toFixed(2)}`);
    if (result.captainBonus > 0) {
      console.log(`  Bonus capitano: +${result.captainBonus.toFixed(2)}`);
    }
    for (const sub of result.substitutions) {
      console.log(`  Sostituzione: ${sub.out} → ${sub.inId}`);
    }
    console.log();
  }

  // 8. Aggiorna competition_matches con i nuovi punteggi
  const now = new Date();
  let updated = 0;

  console.log("─── Aggiornamento partite ────────────────────────────────────────");

  for (const match of matches) {
    const homeScore = teamScores.get(match.homeFantaTeamId);
    const awayScore = teamScores.get(match.awayFantaTeamId);

    if (homeScore === undefined || awayScore === undefined) {
      console.warn(
        `Match ${match.id}: formazione mancante (home=${match.homeFantaTeamId}, away=${match.awayFantaTeamId})`,
      );
      continue;
    }

    await db
      .update(competitionMatches)
      .set({
        homeScore: homeScore.toFixed(2),
        awayScore: awayScore.toFixed(2),
        playedAt: now,
      })
      .where(eq(competitionMatches.id, match.id));

    updated++;
    console.log(
      `Partita ${match.matchOrder}: ${match.homeFantaTeamId} ${homeScore.toFixed(2)} – ${awayScore.toFixed(2)} ${match.awayFantaTeamId}`,
    );
  }

  console.log(`\n✓ ${updated}/${matches.length} partite aggiornate.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
