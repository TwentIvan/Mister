/**
 * load-config.ts — Carica la configurazione algoritmo voto attiva dal DB.
 *
 * Ordine di risoluzione:
 *   1. Config attiva per la federation specifica (se federationId è dato)
 *   2. System default (federation_id NULL, status=active)
 *   3. Errore esplicito se nessuna config attiva trovata (seed non eseguito)
 */

import { eq, and, isNull } from "drizzle-orm";
import { db, votoAlgorithmConfig } from "@workspace/db";
import type { VotoMisterConfig } from "./config.js";

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
