export type VotoMisterConfig = {
  anchor: number;
  minutes: {
    threshold: number;
    fullSample: number;
    extrapolationCap: number;
  };
  stripping: {
    goalFirst: number;
    goalIncremental: number;
    penaltyExtraOverGoal: number;
    assist: number;
    penaltyMissed: number;
    penaltyCommitted: number;
    redCardPrior: number;
    savePrior: number;
  };
  blend: {
    alphaStats: number;
    betaRating: number;
  };
  stats: {
    passAccuracy: { neutral: number; weightPerPoint: number; minPasses: number };
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
