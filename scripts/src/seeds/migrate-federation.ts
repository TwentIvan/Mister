/**
 * Migrazione: assegna una federazione a ogni lega che ne è priva.
 *
 * Eseguire DOPO il primo `pnpm --filter @workspace/db run push` e PRIMA
 * del secondo push che rende federation_id NOT NULL.
 *
 * Comportamento:
 *   • Per ogni lega con federationId = NULL: crea una Federation con
 *     DEFAULT_RULES + defaultFlagValues() e la collega alla lega.
 *   • Idempotente: se la lega ha già una federazione, la salta.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run migrate:federation
 */

import { eq, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, leagues, federations, defaultFlagValues } from "@workspace/db";
import { DEFAULT_RULES } from "@workspace/db/schema";

async function main() {
  console.log("[migrate-federation] Inizio migrazione…");

  const legheOrfane = await db
    .select({ id: leagues.id, name: leagues.name })
    .from(leagues)
    .where(isNull(leagues.federationId));

  if (legheOrfane.length === 0) {
    console.log("[migrate-federation] Nessuna lega senza federazione — nulla da fare.");
    return;
  }

  console.log(`[migrate-federation] Trovate ${legheOrfane.length} leghe senza federazione:`);
  for (const lega of legheOrfane) {
    console.log(`  - ${lega.id} («${lega.name}»)`);
  }

  for (const lega of legheOrfane) {
    const fedId = `fed-${randomBytes(4).toString("hex")}`;
    await db.transaction(async (tx) => {
      await tx.insert(federations).values({
        id: fedId,
        name: `Regolamento ${lega.name}`,
        description: "Federazione generata automaticamente dalla migrazione.",
        templateId: "classico",
        mode: "classic",
        featureFlags: defaultFlagValues() as Record<string, boolean | number>,
        rules: DEFAULT_RULES,
      });
      await tx
        .update(leagues)
        .set({ federationId: fedId })
        .where(eq(leagues.id, lega.id));
    });
    console.log(`[migrate-federation] Lega «${lega.name}» → federation ${fedId} ✓`);
  }

  console.log("[migrate-federation] Migrazione completata.");
}

main().catch((err) => {
  console.error("[migrate-federation] ERRORE:", err);
  process.exit(1);
});
