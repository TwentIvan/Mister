/**
 * Algoritmo Voto Mister v0.
 * Produce 4 varianti di voto per ogni riga player_giornata_stats:
 *   - votoStatsOnly:      anchor + contributi performance (no rating API)
 *   - votoRatingStripped: rating API depurato degli eventi bonus/malus
 *   - votoBlend:          α × stats + β × stripped
 *   - votoSynthesis:      canonico (blend se rating disponibile, stats altrimenti)
 */

import type { VotoMisterConfig } from "./config.js";

export interface StatsJson {
  games: {
    minutes: number | null;
    rating: string | null;
    position: string | null;
    substitute: boolean;
    captain: boolean;
    number: number | null;
  };
  goals: {
    total: number | null;
    assists: number | null;
    conceded: number | null;
    saves: number | null;
  };
  shots: {
    total: number | null;
    on: number | null;
  };
  passes: {
    total: number | null;
    key: number | null;
    accuracy: string | null;
  };
  tackles: {
    total: number | null;
    blocks: number | null;
    interceptions: number | null;
  };
  duels: {
    total: number | null;
    won: number | null;
  };
  dribbles: {
    attempts: number | null;
    success: number | null;
    past: number | null;
  };
  fouls: {
    drawn: number | null;
    committed: number | null;
  };
  cards: {
    yellow: number | null;
    red: number | null;
  };
  penalty: {
    won: number | null;
    scored: number | null;
    missed: number | null;
    saved: number | null;
    commited: number | null;
  };
  offsides: number | null;
}

export interface ComputedVoti {
  votoStatsOnly: number | null;
  votoRatingStripped: number | null;
  votoBlend: number | null;
  votoSynthesis: number | null;
}

function round2(v: number | null): number | null {
  if (v === null) return null;
  return Math.round(v * 100) / 100;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Stripping: quantifica quanti punti di rating gli eventi bonus/malus
 * hanno aggiunto/sottratto al rating grezzo API-Football.
 * Sottrarre questo valore dal rating grezzo restituisce la "performance pura".
 *
 * Convenzione segni:
 *   evento positivo (gol, assist, rigore parato)  → stripping POSITIVO (lo togliamo)
 *   evento negativo (rigorino, rosso)              → stripping NEGATIVO (lo riaggiungiamo)
 */
function computeStripping(s: StatsJson, cfg: VotoMisterConfig["stripping"]): number {
  const goals       = s.goals.total ?? 0;
  const assists     = s.goals.assists ?? 0;
  const penScored   = s.penalty.scored ?? 0;
  const penMissed   = s.penalty.missed ?? 0;
  const penComm     = s.penalty.commited ?? 0;
  const penSaved    = s.penalty.saved ?? 0;
  const red         = s.cards.red ?? 0;

  let strip = 0;

  // Gol: primo gol vale goalFirst, successivi goalIncremental
  if (goals >= 1) strip += cfg.goalFirst;
  if (goals >= 2) strip += cfg.goalIncremental * (goals - 1);

  // Rigore segnato: vale il gol (già contato sopra) + extra
  strip += cfg.penaltyExtraOverGoal * penScored;

  // Assist
  strip += cfg.assist * assists;

  // Rigore sbagliato (malus → stripping negativo: lo riaggiungiamo)
  strip -= cfg.penaltyMissed * penMissed;

  // Fallo da rigore (malus → riaggiungiamo)
  strip -= cfg.penaltyCommitted * penComm;

  // Rosso (malus → riaggiungiamo)
  strip -= cfg.redCardPrior * red;

  // Rigore parato (bonus portiere → togliamo)
  strip += cfg.savePrior * penSaved;

  return strip;
}

/**
 * Contributi statistici: somma di qualità + volume, con estrapolazione
 * sui count per chi ha giocato meno di 60' (capped at extrapolationCap).
 */
function computeStatsContributions(
  s: StatsJson,
  cfg: VotoMisterConfig["stats"],
  extrap: number,
): number {
  let contrib = 0;

  // --- Qualità (percentuali/rate: NON moltiplicate per extrap) ---

  // passes.accuracy in API-Football è un COUNT (passaggi riusciti), non una percentuale.
  // La percentuale vera va calcolata come ratio: accurate / total × 100.
  const passesTotal    = s.passes.total    !== null ? s.passes.total    : 0;
  const passesAccurate = s.passes.accuracy !== null ? parseFloat(s.passes.accuracy) : 0;
  if (passesTotal >= cfg.passAccuracy.minPasses) {
    const passAccuracyPct = (passesAccurate / passesTotal) * 100;
    contrib += (passAccuracyPct - cfg.passAccuracy.neutral) * cfg.passAccuracy.weightPerPoint;
  }

  const duelTotal = s.duels.total ?? 0;
  const duelWon   = s.duels.won ?? 0;
  if (duelTotal >= cfg.duelWinRate.minDuels) {
    const winRate = (duelWon / duelTotal) * 100;
    contrib += (winRate - cfg.duelWinRate.neutral) * cfg.duelWinRate.weightPerPoint;
  }

  const dribAttempts = s.dribbles.attempts ?? 0;
  const dribSuccess  = s.dribbles.success ?? 0;
  if (dribAttempts >= cfg.dribbleSuccessRate.minAttempts) {
    const rate = (dribSuccess / dribAttempts) * 100;
    contrib += (rate - cfg.dribbleSuccessRate.neutral) * cfg.dribbleSuccessRate.weightPerPoint;
  }

  // --- Volume positivo (count × extrap, poi cap) ---

  const kp  = Math.min(cfg.keyPass.cap,       (s.passes.key         ?? 0) * extrap * cfg.keyPass.perUnit);
  const tkl = Math.min(cfg.tackle.cap,         (s.tackles.total      ?? 0) * extrap * cfg.tackle.perUnit);
  const blk = Math.min(cfg.block.cap,          (s.tackles.blocks     ?? 0) * extrap * cfg.block.perUnit);
  const int = Math.min(cfg.interception.cap,   (s.tackles.interceptions ?? 0) * extrap * cfg.interception.perUnit);

  // shot on target = shots.on  (esclude fuori)
  const shotOn = s.shots.on ?? 0;
  const so  = Math.min(cfg.shotOn.cap,         shotOn * extrap * cfg.shotOn.perUnit);

  const sv  = Math.min(cfg.save.cap,           (s.goals.saves        ?? 0) * extrap * cfg.save.perUnit);
  const fd  = Math.min(cfg.foulDrawn.cap,      (s.fouls.drawn        ?? 0) * extrap * cfg.foulDrawn.perUnit);

  contrib += kp + tkl + blk + int + so + sv + fd;

  // --- Volume negativo (count × extrap, poi cap, perUnit già negativo) ---

  // shots off target = shots.total - shots.on
  const shotTotal  = s.shots.total ?? 0;
  const shotOff    = Math.max(0, shotTotal - shotOn);
  const sot = clamp(shotOff * extrap * cfg.shotOffTarget.perUnit, cfg.shotOffTarget.cap, 0);

  const fc  = clamp((s.fouls.committed  ?? 0) * extrap * cfg.foulCommitted.perUnit, cfg.foulCommitted.cap, 0);
  const dp  = clamp((s.dribbles.past    ?? 0) * extrap * cfg.dribbledPast.perUnit,  cfg.dribbledPast.cap,  0);

  contrib += sot + fc + dp;

  return contrib;
}

export function computeVoti(
  stats: StatsJson,
  config: VotoMisterConfig,
): ComputedVoti {
  const minutes = stats.games.minutes;

  if (minutes === null || minutes < config.minutes.threshold) {
    return { votoStatsOnly: null, votoRatingStripped: null, votoBlend: null, votoSynthesis: null };
  }

  const extrap =
    minutes >= config.minutes.fullSample
      ? 1.0
      : Math.min(config.minutes.extrapolationCap, config.minutes.fullSample / minutes);

  // 1) voto_stats_only
  const statsContrib = computeStatsContributions(stats, config.stats, extrap);
  const votoStatsOnly = config.anchor + statsContrib;

  // 2) voto_rating_stripped
  const rawRating = stats.games.rating !== null ? parseFloat(stats.games.rating) : null;
  const votoRatingStripped =
    rawRating === null ? null : rawRating - computeStripping(stats, config.stripping);

  // 3) voto_blend
  const votoBlend =
    votoRatingStripped === null
      ? null
      : config.blend.alphaStats * votoStatsOnly + config.blend.betaRating * votoRatingStripped;

  // 4) voto_synthesis (canonico)
  const votoSynthesis = votoBlend !== null ? votoBlend : votoStatsOnly;

  return {
    votoStatsOnly:      round2(votoStatsOnly),
    votoRatingStripped: round2(votoRatingStripped),
    votoBlend:          round2(votoBlend),
    votoSynthesis:      round2(votoSynthesis),
  };
}
