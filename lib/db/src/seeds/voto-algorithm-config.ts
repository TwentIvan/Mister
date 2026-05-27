import { eq, and, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../schema/index";
import { votoAlgorithmConfig } from "../schema/voto-algorithm-config";

const defaultVotoConfig = {
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
    passAccuracy: { neutral: 80, weightPerPoint: 0.012, minPasses: 10 },
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

export async function seedVotoAlgorithmConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
) {
  const existing = await database
    .select()
    .from(votoAlgorithmConfig)
    .where(
      and(
        isNull(votoAlgorithmConfig.federationId),
        eq(votoAlgorithmConfig.version, "v1.0"),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    console.log("[seed] voto_algorithm_config v1.0 system default già presente, skip");
    return;
  }

  await database.insert(votoAlgorithmConfig).values({
    federationId: null,
    version: "v1.0",
    configJson: defaultVotoConfig,
    status: "active",
    isProtected: true,
    notes:
      "Configurazione algoritmo voto Mister v1.0. Calibrata su backtest Serie A 2024-25 round 1-2 (623 record). Neutri empirici applicati (duelWinRate=51, dribbleSuccessRate=57). Correzione interpretazione passes.accuracy applicata.",
    createdBy: "system",
  });

  console.log("[seed] voto_algorithm_config v1.0 system default inserito");
}
