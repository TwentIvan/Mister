/**
 * Catalogo canonico dei feature flag di Mister.
 *
 * Source of truth di "cosa il sistema sa esprimere". Aggiungere un flag qui
 * richiede:
 *   1. Implementare il comportamento corrispondente (match engine, mercati, UI)
 *   2. Aggiornare i seed dei template profili in seeds/templates.ts
 *   3. Aggiornare openapi.yaml se il flag entra nelle API esposte
 *   4. Eventualmente migrare le leghe esistenti (default-off, di norma)
 *
 * I valori di default qui sono i "valori conservativi": cosa fa il sistema
 * se nessuno tocca nulla. I template profili sovrascrivono con valori
 * specifici di profilo.
 */

export type FlagCategory =
  | "contracts" // contratti pluriennali, rinnovi, prelazione
  | "market" // tipologie e finestre di mercato
  | "economy" // ammortamento, clausole, carryover, recovery
  | "tactics" // moduli, no-schema
  | "scouting"; // discovery e sviluppo giocatori

export type FlagType = "bool" | "int" | "float" | "string";

export type FlagValue = boolean | number | string;

export interface FlagSpec {
  key: string;
  category: FlagCategory;
  type: FlagType;
  defaultValue: FlagValue;
  label: string;
  description: string;
  /** Solo per type=int/float */
  minValue?: number;
  maxValue?: number;
  /** Solo per type=string */
  allowedValues?: readonly string[];
}

// ============================================================
// CATALOGO COMPLETO (18 flag, ordinati come appaiono nel pannello superadmin)
// ============================================================

export const FLAGS = [
  // --- CONTRATTI E PERSISTENZA ---
  {
    key: "multi_season_contracts",
    category: "contracts",
    type: "bool",
    defaultValue: false,
    label: "Contratti pluriennali",
    description:
      "Permette contratti di durata maggiore di 1 stagione. Se off, ogni stagione riparte con rosa azzerata.",
  },
  {
    key: "max_contract_length",
    category: "contracts",
    type: "int",
    defaultValue: 1,
    minValue: 1,
    maxValue: 10,
    label: "Durata massima contratto (stagioni)",
    description: "Numero massimo di stagioni per cui un manager può vincolarsi a un giocatore.",
  },
  {
    key: "contract_renewal",
    category: "contracts",
    type: "bool",
    defaultValue: false,
    label: "Rinnovo contrattuale",
    description: "Abilita il flusso esplicito di rinnovo prima della scadenza.",
  },
  {
    key: "preemption_right",
    category: "contracts",
    type: "bool",
    defaultValue: false,
    label: "Diritto di pareggio in asta",
    description:
      "Alla scadenza naturale, il detentore uscente può pareggiare in tempo reale i rilanci nell'asta di re-acquisto.",
  },

  // --- MERCATO ---
  {
    key: "repair_auction_january",
    category: "market",
    type: "bool",
    defaultValue: true,
    label: "Riparazione di gennaio",
    description:
      "Asta di riparazione invernale (async) sui nuovi acquisti reali della finestra di gennaio.",
  },
  {
    key: "free_agent_pool",
    category: "market",
    type: "bool",
    defaultValue: true,
    label: "Pool svincolati permanente",
    description:
      "I giocatori non acquistati restano disponibili come free agent. In modalità avanzata include anche svincolati attivamente da altri manager.",
  },
  {
    key: "direct_trades",
    category: "market",
    type: "bool",
    defaultValue: false,
    label: "Scambi diretti tra manager",
    description: "Permette scambi 1-1 tra manager, con o senza crediti.",
  },
  {
    key: "always_on_markets",
    category: "market",
    type: "bool",
    defaultValue: false,
    label: "Mercati sempre attivi in stagione",
    description: "Scambi e free agent disponibili in continuativa, non solo in finestre.",
  },

  // --- ECONOMIA ---
  {
    key: "carryover_budget",
    category: "economy",
    type: "bool",
    defaultValue: false,
    label: "Carryover del budget tra stagioni",
    description: "A fine stagione i crediti residui vengono mantenuti per quella successiva.",
  },
  {
    key: "carryover_percentage",
    category: "economy",
    type: "float",
    defaultValue: 0.0,
    minValue: 0.0,
    maxValue: 100.0,
    label: "Percentuale di carryover",
    description: "Percentuale del residuo che viene mantenuta. Solo se Carryover Budget è on.",
  },
  {
    key: "player_value_dynamic",
    category: "economy",
    type: "bool",
    defaultValue: false,
    label: "Valore giocatore dinamico",
    description:
      "Il sistema traccia un valore di mercato del giocatore che si aggiorna in base a performance, età, minutaggio.",
  },
  {
    key: "amortization",
    category: "economy",
    type: "bool",
    defaultValue: false,
    label: "Ammortamento del prezzo d'acquisto",
    description:
      "Il prezzo pagato all'asta viene spalmato sugli anni di contratto come ingaggio annuo. Richiede Contratti Pluriennali.",
  },
  {
    key: "release_clauses",
    category: "economy",
    type: "bool",
    defaultValue: false,
    label: "Clausole rescissorie",
    description:
      "Ogni giocatore ha una clausola rescissoria che altri manager possono pagare per acquistarlo. Default = ammortamento residuo × 0.8.",
  },
  {
    key: "clause_default_factor",
    category: "economy",
    type: "float",
    defaultValue: 0.8,
    minValue: 0.5,
    maxValue: 1.0,
    label: "Fattore default clausola",
    description:
      "Moltiplicatore applicato all'ammortamento residuo per ottenere il default della clausola.",
  },
  {
    key: "rescission_penalty",
    category: "economy",
    type: "bool",
    defaultValue: false,
    label: "Penale di rescissione",
    description:
      "Quando un manager svincola un giocatore prima della scadenza, paga una penale proporzionale al residuo. Richiede Ammortamento.",
  },
  {
    key: "rescission_recovery_pct",
    category: "economy",
    type: "float",
    defaultValue: 50.0,
    minValue: 0.0,
    maxValue: 100.0,
    label: "Recupero crediti su svincolo (%)",
    description: "Percentuale di crediti recuperata quando il manager svincola un giocatore.",
  },

  // --- TATTICA ---
  {
    key: "no_schema_tactics",
    category: "tactics",
    type: "bool",
    defaultValue: false,
    label: "Tattica no-schema",
    description:
      "Permette di schierare una formazione senza vincoli di modulo predefinito, con sistema di penalità tattica configurabile.",
  },

  // --- SCOUTING ---
  {
    key: "scouting_enabled",
    category: "scouting",
    type: "bool",
    defaultValue: false,
    label: "Scouting attivo",
    description: "Sistema di scoperta e sviluppo di giocatori giovani o emergenti.",
  },
] as const satisfies readonly FlagSpec[];

// ============================================================
// TYPE-SAFE LOOKUP
// ============================================================

export type FlagKey = (typeof FLAGS)[number]["key"];

export const FLAGS_BY_KEY: Readonly<Record<string, FlagSpec>> = Object.freeze(
  FLAGS.reduce<Record<string, FlagSpec>>((acc, f) => {
    acc[f.key] = f;
    return acc;
  }, {}),
);

// ============================================================
// HELPERS
// ============================================================

/** Ritorna tutti i flag con i loro valori di default conservativi. */
export function defaultFlagValues(): Record<FlagKey, FlagValue> {
  return Object.fromEntries(FLAGS.map((f) => [f.key, f.defaultValue])) as Record<
    FlagKey,
    FlagValue
  >;
}

/** Valida che un valore sia accettabile per un flag specifico. */
export function validateFlagValue(key: string, value: unknown): boolean {
  const spec = FLAGS_BY_KEY[key];
  if (!spec) return false;
  switch (spec.type) {
    case "bool":
      return typeof value === "boolean";
    case "int":
      if (typeof value !== "number" || !Number.isInteger(value)) return false;
      if (spec.minValue !== undefined && value < spec.minValue) return false;
      if (spec.maxValue !== undefined && value > spec.maxValue) return false;
      return true;
    case "float":
      if (typeof value !== "number" || Number.isNaN(value)) return false;
      if (spec.minValue !== undefined && value < spec.minValue) return false;
      if (spec.maxValue !== undefined && value > spec.maxValue) return false;
      return true;
    case "string":
      if (typeof value !== "string") return false;
      if (spec.allowedValues && !spec.allowedValues.includes(value)) return false;
      return true;
  }
}

/** Ritorna tutti i flag di una categoria, nell'ordine in cui appaiono in FLAGS. */
export function flagsByCategory(category: FlagCategory): readonly FlagSpec[] {
  return FLAGS.filter((f) => f.category === category);
}

/** Categorie nell'ordine in cui devono apparire nel pannello superadmin / Federation Rules. */
export const FLAG_CATEGORIES_ORDERED: readonly FlagCategory[] = [
  "contracts",
  "market",
  "economy",
  "tactics",
  "scouting",
];

/** Etichetta umana per ciascuna categoria, da usare come titolo di sezione nel pannello. */
export const FLAG_CATEGORY_LABELS: Readonly<Record<FlagCategory, string>> = {
  contracts: "Contratti",
  market: "Mercato",
  economy: "Economia",
  tactics: "Tattica",
  scouting: "Scouting",
};
