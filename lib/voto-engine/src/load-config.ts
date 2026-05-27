import { eq, and, isNull } from "drizzle-orm";
import { db, votoAlgorithmConfig } from "@workspace/db";
import type { VotoMisterConfig } from "./config";

export async function loadActiveConfig(
  federationId: string | null = null,
): Promise<VotoMisterConfig> {
  if (federationId !== null) {
    const specific = await db
      .select()
      .from(votoAlgorithmConfig)
      .where(
        and(
          eq(votoAlgorithmConfig.federationId, federationId),
          eq(votoAlgorithmConfig.status, "active"),
        ),
      )
      .limit(1);

    if (specific.length > 0) {
      return specific[0]!.configJson as VotoMisterConfig;
    }
  }

  const systemDefault = await db
    .select()
    .from(votoAlgorithmConfig)
    .where(
      and(
        isNull(votoAlgorithmConfig.federationId),
        eq(votoAlgorithmConfig.status, "active"),
      ),
    )
    .limit(1);

  if (systemDefault.length === 0) {
    throw new Error(
      "Nessuna configurazione algoritmo attiva trovata in DB. " +
        "Eseguire `pnpm --filter @workspace/db run seed` per inizializzare il system default.",
    );
  }

  return systemDefault[0]!.configJson as VotoMisterConfig;
}
