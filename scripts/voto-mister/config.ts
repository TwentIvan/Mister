/**
 * Configurazione algoritmo Voto Mister.
 * Tutti i pesi sono stimati sui dati empirici backtest Serie A 2024 round 1-2.
 * Modificare solo questa struttura per iterare sui parametri — non toccare compute.ts.
 */

export type VotoMisterConfig = {
  anchor: number;
  minutes: {
    threshold: number;       // sotto = NULL
    fullSample: number;      // sopra = no estrapolazione
    extrapolationCap: number; // moltiplicatore max sui count
  };
  stripping: {
    goalFirst: number;
    goalIncremental: number;
    penaltyExtraOverGoal: number;
    assist: number;
    penaltyMissed: number;     // sign +
    penaltyCommitted: number;  // sign +
    redCardPrior: number;      // sign +
    savePrior: number;         // sign -
  };
  blend: {
    alphaStats: number;
    betaRating: number;
  };
  stats: {
    passAccuracy: { neutral: number; weightPerPoint: number };
    duelWinRate: { neutral: number; weightPerPoint: number; minDuels: number };
    dribbleSuccessRate: { neutral: number; weightPerPoint: number; minAttempts: number };
    keyPass: { perUnit: number; cap: number };
    tackle: { perUnit: number; cap: number };
    block: { perUnit: number; cap: number };
    interception: { perUnit: number; cap: number };
    shotOn: { perUnit: number; cap: number };
    save: { perUnit: number; cap: number };
    foulDrawn: { perUnit: number; cap: number };
    shotOffTarget: { perUnit: number; cap: number };
    foulCommitted: { perUnit: number; cap: number };
    dribbledPast: { perUnit: number; cap: number };
  };
};

export const defaultVotoConfig: VotoMisterConfig = {
  anchor: 6.0,
  minutes: { threshold: 15, fullSample: 60, extrapolationCap: 1.5 },
  stripping: {
    goalFirst: 0.79,
    goalIncremental: 0.83,
    penaltyExtraOverGoal: 0.13,
    assist: 0.60,
    penaltyMissed: 0.60,
    penaltyCommitted: 0.57,
    redCardPrior: 1.0,
    savePrior: 1.0,
  },
  blend: { alphaStats: 0.35, betaRating: 0.65 },
  stats: {
    passAccuracy: { neutral: 28, weightPerPoint: 0.012 },
    duelWinRate: { neutral: 51, weightPerPoint: 0.008, minDuels: 5 },
    dribbleSuccessRate: { neutral: 57, weightPerPoint: 0.005, minAttempts: 2 },
    keyPass: { perUnit: 0.12, cap: 0.60 },
    tackle: { perUnit: 0.08, cap: 0.48 },
    block: { perUnit: 0.10, cap: 0.40 },
    interception: { perUnit: 0.10, cap: 0.50 },
    shotOn: { perUnit: 0.10, cap: 0.50 },
    save: { perUnit: 0.15, cap: 1.05 },
    foulDrawn: { perUnit: 0.05, cap: 0.20 },
    shotOffTarget: { perUnit: -0.03, cap: -0.15 },
    foulCommitted: { perUnit: -0.04, cap: -0.20 },
    dribbledPast: { perUnit: -0.10, cap: -0.40 },
  },
};
