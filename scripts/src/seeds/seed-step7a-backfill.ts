/**
 * T126 — Seed / Backfill Step 7.A: Schema Asta Live
 *
 * Idempotente: rieseguibile senza duplicare dati.
 *
 * A) INSERT leagues: id='lg-mvp' (ON CONFLICT DO NOTHING)
 * B) UPDATE competitions: comp-mvp-campionato-2024 → league_id='lg-mvp'
 * C) UPDATE fanta_teams: setta name_auction (short) e credits_remaining=500
 *
 * NON tocca contracts.purchase_price_fm (rimane NULL per i 200 esistenti).
 */

import { db, defaultFlagValues } from "@workspace/db";
import {
  leagues,
  federations,
  competitions,
  fantaTeams,
  societa,
  auctions,
  contracts,
  DEFAULT_RULES,
} from "@workspace/db/schema";
import { eq, count, isNotNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import type { LeagueConfig } from "@workspace/db/schema";

// ─── Configurazione lega MVP ───────────────────────────────────────────────

const LEAGUE_ID = "lg-mvp";

const MVP_CONFIG: LeagueConfig = {
  squad: {
    startersTotal: 11,
    allowedModules: ["3-4-3", "3-5-2", "4-3-3", "4-4-2", "4-5-1", "5-3-2", "5-4-1"],
  },
  captain: {
    enabled: true,
    multiplier: 1.0,
    useVice: true,
  },
  budget: {
    minimumBid: 1,
    allowNegativeBalance: false,
    reserveForUnfilledRoles: true,
  },
  postAcquisitionWindow: {
    enabled: true,
    liveSeconds: 45,
    asyncHours: 12,
    defaultContractYears: 1,
    defaultClauseAction: "leave_default",
  },
};

// Nome corto in asta per ogni fanta-team
const AUCTION_NAMES: Record<string, string> = {
  "ft-mvp-1": "Mario",
  "ft-mvp-2": "Magnifici",
  "ft-mvp-3": "Trastevere",
  "ft-mvp-4": "Pancho",
  "ft-mvp-5": "Sandhagen",
  "ft-mvp-6": "Pelati",
  "ft-mvp-7": "Atletico",
  "ft-mvp-8": "Bomber",
};

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== T126 — Backfill Step 7.A: Schema Asta Live ===\n");

  await db.transaction(async (tx) => {

    // ── A) INSERT leagues lg-mvp ──────────────────────────────────────────
    const existing = await tx
      .select({ id: leagues.id })
      .from(leagues)
      .where(eq(leagues.id, LEAGUE_ID));

    if (existing.length > 0) {
      console.log(`[A] leagues '${LEAGUE_ID}' già presente — skip INSERT.`);
    } else {
      // Ogni lega richiede una federazione (FK NOT NULL).
      const fedId = `fed-${randomBytes(4).toString("hex")}`;
      await tx.insert(federations).values({
        id: fedId,
        name: "Regolamento Lega MVP",
        description: "Federazione seed per la Lega MVP.",
        templateId: null,
        mode: "classic",
        featureFlags: defaultFlagValues() as Record<string, boolean | number>,
        rules: DEFAULT_RULES,
      });
      await tx.insert(leagues).values({
        id: LEAGUE_ID,
        name: "Lega MVP",
        federationId: fedId,
        adminUserId: "system",
        season: 2024,
        maxManagers: 8,
        config: MVP_CONFIG,
        timerSeconds: 8,
        budgetInitial: 500,
        rosterP: 3,
        rosterD: 8,
        rosterC: 8,
        rosterA: 6,
        auctionMode: "manageriale",
      });
      console.log(`[A] INSERT federations '${fedId}' + leagues '${LEAGUE_ID}' ✓`);
    }

    // ── B) UPDATE competitions ────────────────────────────────────────────
    const COMP_ID = "comp-mvp-campionato-2024";
    await tx
      .update(competitions)
      .set({ leagueId: LEAGUE_ID })
      .where(eq(competitions.id, COMP_ID));
    console.log(`[B] UPDATE competitions '${COMP_ID}' → league_id='${LEAGUE_ID}' ✓`);

    // ── C) UPDATE fanta_teams + societa ──────────────────────────────────
    // name_auction vive ora su societa; credits_remaining resta su fanta_teams.
    let updated = 0;
    for (const [teamId, auctionName] of Object.entries(AUCTION_NAMES)) {
      await tx
        .update(fantaTeams)
        .set({ creditsRemaining: 500 })
        .where(eq(fantaTeams.id, teamId));
      // Aggiorna nome_asta sulla società collegata (se esiste)
      const [ft] = await tx
        .select({ societaId: fantaTeams.societaId })
        .from(fantaTeams)
        .where(eq(fantaTeams.id, teamId));
      if (ft?.societaId) {
        await tx.update(societa).set({ nameAuction: auctionName }).where(eq(societa.id, ft.societaId));
      }
      updated++;
    }
    console.log(`[C] UPDATE fanta_teams + societa: ${updated} squadre → auction_name + credits_remaining=500 ✓`);

  });

  console.log("\nBackfill completato ✓\n");

  // ── Sanity check ──────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════");
  console.log("SANITY CHECK POST-BACKFILL");
  console.log("═══════════════════════════════════════════════════════════");

  // 1. COUNT leagues
  const [{ leagueCount }] = await db
    .select({ leagueCount: count() })
    .from(leagues);
  console.log(`\n[1] SELECT COUNT(*) FROM leagues → ${leagueCount} (atteso: ≥1)`);

  // 2. leagues WHERE id='lg-mvp'
  const [mvpLeague] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, LEAGUE_ID));

  if (mvpLeague) {
    console.log(`\n[2] leagues WHERE id='lg-mvp':`);
    console.log(`    id:            ${mvpLeague.id}`);
    console.log(`    name:          ${mvpLeague.name}`);
    console.log(`    federation_id: ${mvpLeague.federationId ?? "NULL"}`);
    console.log(`    budget_initial: ${mvpLeague.budgetInitial}`);
    console.log(`    timer_seconds: ${mvpLeague.timerSeconds}`);
    console.log(`    roster_p:      ${mvpLeague.rosterP}`);
    console.log(`    roster_d:      ${mvpLeague.rosterD}`);
    console.log(`    roster_c:      ${mvpLeague.rosterC}`);
    console.log(`    roster_a:      ${mvpLeague.rosterA}`);
    console.log(`    auction_mode:  ${mvpLeague.auctionMode}`);
  } else {
    console.error(`\n[2] ERRORE: leagues '${LEAGUE_ID}' non trovata!`);
  }

  // 3. competitions
  const comps = await db
    .select({ id: competitions.id, leagueId: competitions.leagueId })
    .from(competitions);
  console.log(`\n[3] SELECT id, league_id FROM competitions:`);
  comps.forEach(c => console.log(`    ${c.id} → league_id=${c.leagueId}`));
  const mvpComp = comps.find(c => c.id === "comp-mvp-campionato-2024");
  if (mvpComp?.leagueId === LEAGUE_ID) {
    console.log(`    ✓ comp-mvp-campionato-2024 punta a '${LEAGUE_ID}'`);
  } else {
    console.error(`    ✗ comp-mvp-campionato-2024 league_id=${mvpComp?.leagueId} — atteso '${LEAGUE_ID}'`);
  }

  // 4. fanta_teams + societa (name_auction ora su societa)
  const teams = await db
    .select({
      id: fantaTeams.id,
      creditsRemaining: fantaTeams.creditsRemaining,
      nameAuction: societa.nameAuction,
    })
    .from(fantaTeams)
    .leftJoin(societa, eq(fantaTeams.societaId, societa.id))
    .orderBy(fantaTeams.id);
  console.log(`\n[4] fanta_teams (${teams.length} righe, atteso: ≥8):`);
  teams.forEach(t =>
    console.log(`    ${t.id.padEnd(12)} name_auction=${String(t.nameAuction).padEnd(12)} credits_remaining=${t.creditsRemaining}`)
  );
  const allOk = teams
    .filter(t => Object.keys(AUCTION_NAMES).includes(t.id))
    .every(t => t.creditsRemaining === 500);
  console.log(`    ${allOk ? "✓ tutti e 8 corretti" : "✗ alcuni valori errati"}`);

  // 5. contracts con purchase_price_fm NOT NULL
  const [{ notNullCount }] = await db
    .select({ notNullCount: count() })
    .from(contracts)
    .where(isNotNull(contracts.purchasePriceFm));
  console.log(`\n[5] SELECT COUNT(*) FROM contracts WHERE purchase_price_fm IS NOT NULL → ${notNullCount} (atteso: 0)`);
  if (notNullCount > 0) console.error(`    ✗ Trovati ${notNullCount} contracts con purchase_price_fm valorizzato — non atteso!`);
  else console.log(`    ✓`);

  // 6. auctions count
  const [{ auctionCount }] = await db
    .select({ auctionCount: count() })
    .from(auctions);
  console.log(`\n[6] SELECT COUNT(*) FROM auctions → ${auctionCount} (atteso: 0)`);
  if (auctionCount === 0) console.log(`    ✓`);
  else console.error(`    ✗ Trovate ${auctionCount} aste — non atteso!`);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("Sanity check completato.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
