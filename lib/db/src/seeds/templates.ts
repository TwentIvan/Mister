/**
 * Seed dei tre template profili di sistema.
 *
 * Questi sono i Classico / Esploratore / Manageriale che l'admin vede in
 * onboarding quando crea una nuova lega. Da eseguire all'avvio dell'app
 * o tramite `pnpm --filter @workspace/db run seed`.
 *
 * Il superadmin può:
 *   • Modificare i valori dei flag in qualsiasi template
 *   • Modificare suggestedMarkets e suggestedCompetitions
 *   • Disattivare un template (isActive=false)
 *   • Aggiungere nuovi template oltre questi tre
 *   • NON può cancellare i template di sistema (isSystem=true)
 */

import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  templateProfiles,
  type NewTemplateProfile,
} from "../schema/template-profiles";

// ============================================================
// 1. CLASSICO
// ============================================================

const CLASSICO: NewTemplateProfile = {
  id: "classico",
  name: "Classico",
  tagline: "Per chi ama il fantacalcio di sempre",
  description:
    "L'esperienza fantacalcio tradizionale: asta a inizio stagione, formazioni settimanali, classifica. Niente contratti pluriennali, niente clausole, niente trattative tra manager. Ogni stagione riparte da zero.",
  complexityLevel: 1,
  estimatedWeeklyMinutes: 10,
  icon: "ball-football",
  featureFlags: {
    multi_season_contracts: false,
    max_contract_length: 1,
    contract_renewal: false,
    preemption_right: false,
    repair_auction_january: true,
    free_agent_pool: true,
    direct_trades: false,
    always_on_markets: false,
    carryover_budget: false,
    carryover_percentage: 0.0,
    player_value_dynamic: false,
    amortization: false,
    release_clauses: false,
    clause_default_factor: 0.8,
    rescission_penalty: false,
    rescission_recovery_pct: 50.0,
    no_schema_tactics: false,
    scouting_enabled: false,
  },
  suggestedMarkets: [
    {
      name: "Asta Iniziale",
      type: "auction",
      mode: "live",
      windowHint: "metà agosto, 4-6 serate",
      description: "Asta dal vivo col battitore AI di Mister.",
    },
    {
      name: "Pool Svincolati",
      type: "free_agent",
      windowHint: "sempre attivo da settembre a maggio",
      description:
        "Giocatori non acquistati restano in pool, prezzo base per ruolo.",
    },
    {
      name: "Riparazione Gennaio",
      type: "auction",
      mode: "async",
      windowHint: "30 gennaio - 2 febbraio",
      description: "Asta di riparazione sui nuovi acquisti reali di gennaio.",
    },
  ],
  suggestedCompetitions: [
    {
      name: "Campionato",
      type: "campionato",
      description:
        "Girone all'italiana ripetuto 5 volte sulle giornate Serie A.",
    },
  ],
  isSystem: true,
  isActive: true,
};

// ============================================================
// 2. ESPLORATORE
// ============================================================

const ESPLORATORE: NewTemplateProfile = {
  id: "esploratore",
  name: "Esploratore",
  tagline: "Per chi vuole più profondità, senza complicarsi la vita",
  description:
    "Il ponte verso il manageriale. Contratti di 1-2 stagioni, trattative dirette tra manager, budget che si tramanda nel tempo. Niente clausole rescissorie ancora. La tua squadra inizia a diventare una storia, non una tabula rasa annuale.",
  complexityLevel: 2,
  estimatedWeeklyMinutes: 25,
  icon: "compass",
  featureFlags: {
    multi_season_contracts: true,
    max_contract_length: 2,
    contract_renewal: true,
    preemption_right: true,
    repair_auction_january: true,
    free_agent_pool: true,
    direct_trades: true,
    always_on_markets: true,
    carryover_budget: true,
    carryover_percentage: 50.0,
    player_value_dynamic: true,
    amortization: true,
    release_clauses: false,
    clause_default_factor: 0.8,
    rescission_penalty: true,
    rescission_recovery_pct: 50.0,
    no_schema_tactics: false,
    scouting_enabled: false,
  },
  suggestedMarkets: [
    {
      name: "Asta Iniziale",
      type: "auction",
      mode: "live",
      windowHint: "metà agosto",
      description:
        "Asta dal vivo. Per ogni acquisto, finestra post-asta per durata contratto.",
    },
    {
      name: "Scambi Sempre Attivi",
      type: "trade",
      windowHint: "sempre da settembre a maggio",
      description: "Scambi bilaterali con approvazione admin.",
    },
    {
      name: "Pool Svincolati",
      type: "free_agent",
      windowHint: "sempre attivo",
      description:
        "Include anche giocatori svincolati attivamente da altri manager.",
    },
    {
      name: "Riparazione Gennaio",
      type: "auction",
      mode: "async",
      windowHint: "30 gennaio - 2 febbraio",
      description:
        "Riparazione async sui nuovi acquisti reali, con scelta contratto.",
    },
  ],
  suggestedCompetitions: [
    {
      name: "Campionato",
      type: "campionato",
      description: "Girone all'italiana ripetuto 5 volte.",
    },
    {
      name: "Coppa Manager",
      type: "coppa",
      description:
        "Eliminazione diretta a gara secca, bracket configurato dall'admin.",
    },
  ],
  isSystem: true,
  isActive: true,
};

// ============================================================
// 3. MANAGERIALE
// ============================================================

const MANAGERIALE: NewTemplateProfile = {
  id: "manageriale",
  name: "Manageriale",
  tagline: "Per chi vuole gestire un vero club nel tempo",
  description:
    "Il prodotto pieno. Contratti fino a 5 stagioni, ammortamento, clausole rescissorie, mercato sempre attivo, scouting per scoprire giovani, tattica no-schema attivabile. La tua squadra è un'impresa da gestire stagione dopo stagione.",
  complexityLevel: 3,
  estimatedWeeklyMinutes: 50,
  icon: "briefcase",
  featureFlags: {
    multi_season_contracts: true,
    max_contract_length: 5,
    contract_renewal: true,
    preemption_right: true,
    repair_auction_january: true,
    free_agent_pool: true,
    direct_trades: true,
    always_on_markets: true,
    carryover_budget: true,
    carryover_percentage: 100.0,
    player_value_dynamic: true,
    amortization: true,
    release_clauses: true,
    clause_default_factor: 0.8,
    rescission_penalty: true,
    rescission_recovery_pct: 50.0,
    no_schema_tactics: false, // default off ma visibile nel pannello
    scouting_enabled: true,
  },
  suggestedMarkets: [
    {
      name: "Asta Iniziale",
      type: "auction",
      mode: "live",
      windowHint: "metà agosto",
      description:
        "Asta dal vivo. Decisione contratto + clausola in finestra post-asta.",
    },
    {
      name: "Scambi Sempre Attivi",
      type: "trade",
      windowHint: "sempre attivo",
      description:
        "Scambi bilaterali e triangolari, con o senza crediti.",
    },
    {
      name: "Pool Svincolati",
      type: "free_agent",
      windowHint: "sempre attivo",
      description: "Include svincolati e giocatori con contratto scaduto.",
    },
    {
      name: "Riparazione Gennaio",
      type: "auction",
      mode: "async",
      windowHint: "30 gennaio - 2 febbraio",
      description:
        "Riparazione strutturata su nuovi acquisti reali e scambi.",
    },
    {
      name: "Finestra Svincoli Autunno",
      type: "release",
      mode: "blind",
      windowHint: "metà novembre, 48h",
      description: "Finestra dedicata per svincoli con penale, recovery 50%.",
    },
  ],
  suggestedCompetitions: [
    {
      name: "Campionato",
      type: "campionato",
      description: "Girone all'italiana ripetuto 5 volte.",
    },
    {
      name: "Coppa Manager",
      type: "coppa",
      description: "Eliminazione diretta a gara secca o andata/ritorno.",
    },
    {
      name: "Punteggio Assoluto",
      type: "punteggio_assoluto",
      description:
        "Classifica per somma cumulativa, rimuove la fortuna del calendario.",
    },
  ],
  isSystem: true,
  isActive: true,
};

// ============================================================
// REGISTRO
// ============================================================

export const SYSTEM_TEMPLATES: readonly NewTemplateProfile[] = [
  CLASSICO,
  ESPLORATORE,
  MANAGERIALE,
];

export const DEFAULT_TEMPLATE_ID = "classico";

// ============================================================
// SEEDER (idempotente)
// ============================================================

/**
 * Popola/aggiorna i tre template di sistema nel DB.
 *
 * Comportamento:
 *   • Se NON esistono: li crea
 *   • Se esistono come isSystem=true: lascia stare (il superadmin
 *     potrebbe averli ritarati, rispettiamo le sue modifiche)
 *   • Con forceOverwrite=true: li sovrascrive ai valori del file
 *     (utile dopo un deploy che aggiorna i preset)
 */
export async function seedSystemTemplates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>,
  options: { forceOverwrite?: boolean } = {},
): Promise<void> {
  const { forceOverwrite = false } = options;

  for (const template of SYSTEM_TEMPLATES) {
    const existing = await db
      .select()
      .from(templateProfiles)
      .where(eq(templateProfiles.id, template.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(templateProfiles).values(template);
      console.log(`[seed] Template "${template.id}" creato`);
    } else if (forceOverwrite) {
      await db
        .update(templateProfiles)
        .set({
          name: template.name,
          tagline: template.tagline,
          description: template.description,
          complexityLevel: template.complexityLevel,
          estimatedWeeklyMinutes: template.estimatedWeeklyMinutes,
          icon: template.icon,
          featureFlags: template.featureFlags,
          suggestedMarkets: template.suggestedMarkets,
          suggestedCompetitions: template.suggestedCompetitions,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(templateProfiles.id, template.id));
      console.log(`[seed] Template "${template.id}" sovrascritto (forceOverwrite)`);
    } else {
      const row = existing[0];
      if (!row.isSystem) {
        console.warn(
          `[seed] Template "${template.id}" esiste ma isSystem=false. ` +
            "Qualcuno l'ha modificato, lo lascio stare.",
        );
      }
    }
  }
}
