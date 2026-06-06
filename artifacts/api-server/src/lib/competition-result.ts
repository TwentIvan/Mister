/**
 * Unica sorgente di risoluzione del risultato di una partita fantacalcio
 * in formato calcistico classico.
 *
 * Feed, Classifica e Partita devono leggere QUESTA funzione — non ricalcolare.
 */

import type { GoalThresholds } from "@workspace/db";

export const DEFAULT_THRESHOLDS: GoalThresholds = {
  base: 66,
  step: 6,
  maxGoals: 8,
};

/**
 * Converte un punteggio fantacalcio in gol classici secondo le soglie
 * della federazione.
 *
 * Formula: score < base → 0; altrimenti min(maxGoals, floor((score − (base − step)) / step))
 * Esempio (base=66, step=6): 65→0  66→1  72→2  78→3  84→4 …
 */
export function scoreToGol(score: number, thresholds: GoalThresholds = DEFAULT_THRESHOLDS): number {
  if (score < thresholds.base) return 0;
  return Math.min(
    thresholds.maxGoals,
    Math.floor((score - (thresholds.base - thresholds.step)) / thresholds.step),
  );
}

export type MatchOutcome = "home" | "away" | "draw";

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  outcome: MatchOutcome;
  homePoints: number;
  awayPoints: number;
}

/**
 * Risolve il risultato ufficiale di una partita in formato calcistico classico.
 *
 * Il vincitore è determinato dai GOL CLASSICI (conversione tramite soglie),
 * non dal confronto diretto dei punti assoluti. Se i gol classici sono pari,
 * il risultato è pareggio (entrambe le squadre ottengono 1 punto).
 */
export function resolveMatchResult(
  homeScore: number,
  awayScore: number,
  thresholds: GoalThresholds = DEFAULT_THRESHOLDS,
): MatchResult {
  const homeGoals = scoreToGol(homeScore, thresholds);
  const awayGoals = scoreToGol(awayScore, thresholds);

  let outcome: MatchOutcome;
  let homePoints: number;
  let awayPoints: number;

  if (homeGoals > awayGoals) {
    outcome = "home";
    homePoints = 3;
    awayPoints = 0;
  } else if (awayGoals > homeGoals) {
    outcome = "away";
    homePoints = 0;
    awayPoints = 3;
  } else {
    outcome = "draw";
    homePoints = 1;
    awayPoints = 1;
  }

  return { homeGoals, awayGoals, outcome, homePoints, awayPoints };
}
