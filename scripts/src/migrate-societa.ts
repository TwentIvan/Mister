/**
 * migrate-societa.ts — Fase 1 Inviti: migrazione dati identità → società.
 *
 * Per ogni fanta_team senza società:
 *   1. Crea una società con i campi identità presenti sul record legacy.
 *   2. Aggiorna fanta_team.societa_id → la nuova società.
 *
 * owner_user_id = manager_user_id (oggi tutti admin per legacy single-account).
 * La regola una-per-lega sarà imposta al claim in Fase 2, non qui.
 * Idempotente: fanta_team già con societa_id vengono saltate.
 */

import { db, fantaTeams, societa } from "@workspace/db";
import { isNull, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

async function main() {
  const teams = await db
    .select()
    .from(fantaTeams)
    .where(isNull(fantaTeams.societaId));

  console.log(`Fanta-team senza società: ${teams.length}`);

  let created = 0;

  for (const team of teams) {
    // I campi identità sono ancora presenti sul record (colonne legacy non ancora
    // rimosse). Li leggiamo come "any" perché dopo la Fase 1 saranno droppati.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = team as any;
    const name: string        = raw.name        ?? "Squadra senza nome";
    const nameAuction: string = raw.name_auction ?? raw.nameAuction ?? null;
    const logoUrl: string     = raw.logo_url     ?? raw.logoUrl      ?? null;
    const jersey              = raw.jersey       ?? null;

    const socId = `soc-${randomUUID().slice(0, 8)}`;

    await db.transaction(async (tx) => {
      await tx.insert(societa).values({
        id:           socId,
        ownerUserId:  team.managerUserId ?? "unknown",
        name,
        nameAuction:  nameAuction  ?? undefined,
        logoUrl:      logoUrl      ?? undefined,
        jersey:       jersey       ?? undefined,
      });

      await tx.update(fantaTeams).set({ societaId: socId }).where(eq(fantaTeams.id, team.id));
    });

    created++;
    console.log(`  ${created}. ${name} → ${socId}`);
  }

  console.log(`\nSocietà create: ${created}`);

  const orphans = await db
    .select()
    .from(fantaTeams)
    .where(isNull(fantaTeams.societaId));

  if (orphans.length > 0) {
    console.error(`ERRORE: ${orphans.length} fanta_team ancora senza società.`);
    process.exit(1);
  }
  console.log("Migrazione completata. Tutte le fanta_team hanno una società collegata.");
}

main().catch((e) => { console.error(e); process.exit(1); });
