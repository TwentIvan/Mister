import { useWatch } from "react-hook-form";
import type { Control } from "react-hook-form";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export type FlagType = "bool" | "int" | "float";
export type FlagCategory = "contracts" | "market" | "economy" | "tactics" | "scouting";

export interface FlagDef {
  key: string;
  category: FlagCategory;
  type: FlagType;
  label: string;
  description: string;
  minValue?: number;
  maxValue?: number;
  defaultValue: boolean | number;
  step?: number;
}

export const FLAG_CATEGORY_LABELS: Record<FlagCategory, string> = {
  contracts: "Contratti",
  market: "Mercato",
  economy: "Economia",
  tactics: "Tattica",
  scouting: "Scouting",
};

const FLAG_CATEGORY_DESCRIPTIONS: Record<FlagCategory, string> = {
  contracts: "Durata, rinnovo, prelazione del detentore uscente.",
  market: "Tipologie e finestre di mercato.",
  economy: "Ammortamento, clausole rescissorie, carryover, recovery.",
  tactics: "Moduli, formazioni senza schema predefinito.",
  scouting: "Scoperta e sviluppo di giocatori giovani o emergenti.",
};

export const FLAG_CATEGORIES_ORDERED: FlagCategory[] = [
  "contracts", "market", "economy", "tactics", "scouting",
];

export const ALL_FLAGS: FlagDef[] = [
  // ─── CONTRATTI ────────────────────────────────────────────────
  {
    key: "multi_season_contracts",
    category: "contracts",
    type: "bool",
    defaultValue: false,
    label: "Contratti pluriennali",
    description: "Permette contratti di durata maggiore di 1 stagione. Se off, ogni stagione riparte con rosa azzerata.",
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
    description: "Alla scadenza naturale, il detentore uscente può pareggiare in tempo reale i rilanci nell'asta di re-acquisto.",
  },
  // ─── MERCATO ──────────────────────────────────────────────────
  {
    key: "repair_auction_january",
    category: "market",
    type: "bool",
    defaultValue: true,
    label: "Riparazione di gennaio",
    description: "Asta di riparazione invernale (async) sui nuovi acquisti reali della finestra di gennaio.",
  },
  {
    key: "free_agent_pool",
    category: "market",
    type: "bool",
    defaultValue: true,
    label: "Pool svincolati permanente",
    description: "I giocatori non acquistati restano disponibili come free agent. In modalità avanzata include anche svincolati attivamente da altri manager.",
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
  // ─── ECONOMIA ─────────────────────────────────────────────────
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
    minValue: 0,
    maxValue: 100,
    step: 1,
    label: "Percentuale di carryover",
    description: "Percentuale del residuo che viene mantenuta. Solo se Carryover Budget è on.",
  },
  {
    key: "player_value_dynamic",
    category: "economy",
    type: "bool",
    defaultValue: false,
    label: "Valore giocatore dinamico",
    description: "Il sistema traccia un valore di mercato del giocatore che si aggiorna in base a performance, età, minutaggio.",
  },
  {
    key: "amortization",
    category: "economy",
    type: "bool",
    defaultValue: false,
    label: "Ammortamento del prezzo d'acquisto",
    description: "Il prezzo pagato all'asta viene spalmato sugli anni di contratto come ingaggio annuo. Richiede Contratti Pluriennali.",
  },
  {
    key: "release_clauses",
    category: "economy",
    type: "bool",
    defaultValue: false,
    label: "Clausole rescissorie",
    description: "Ogni giocatore ha una clausola rescissoria che altri manager possono pagare per acquistarlo. Default = ammortamento residuo × 0.8.",
  },
  {
    key: "clause_default_factor",
    category: "economy",
    type: "float",
    defaultValue: 0.8,
    minValue: 0.5,
    maxValue: 1.0,
    step: 0.05,
    label: "Fattore default clausola",
    description: "Moltiplicatore applicato all'ammortamento residuo per ottenere il default della clausola.",
  },
  {
    key: "rescission_penalty",
    category: "economy",
    type: "bool",
    defaultValue: false,
    label: "Penale di rescissione",
    description: "Quando un manager svincola un giocatore prima della scadenza, paga una penale proporzionale al residuo. Richiede Ammortamento.",
  },
  {
    key: "rescission_recovery_pct",
    category: "economy",
    type: "float",
    defaultValue: 50.0,
    minValue: 0,
    maxValue: 100,
    step: 1,
    label: "Recupero crediti su svincolo (%)",
    description: "Percentuale di crediti recuperata quando il manager svincola un giocatore.",
  },
  // ─── TATTICA ──────────────────────────────────────────────────
  {
    key: "no_schema_tactics",
    category: "tactics",
    type: "bool",
    defaultValue: false,
    label: "Tattica no-schema",
    description: "Permette di schierare una formazione senza vincoli di modulo predefinito, con sistema di penalità tattica configurabile.",
  },
  // ─── SCOUTING ─────────────────────────────────────────────────
  {
    key: "scouting_enabled",
    category: "scouting",
    type: "bool",
    defaultValue: false,
    label: "Scouting attivo",
    description: "Sistema di scoperta e sviluppo di giocatori giovani o emergenti.",
  },
];

export const FLAGS_BY_CATEGORY = FLAG_CATEGORIES_ORDERED.reduce<Record<FlagCategory, FlagDef[]>>(
  (acc, cat) => {
    acc[cat] = ALL_FLAGS.filter((f) => f.category === cat);
    return acc;
  },
  {} as Record<FlagCategory, FlagDef[]>,
);

export const PARENT_CHILDREN: Record<string, string[]> = {
  multi_season_contracts: ["max_contract_length", "contract_renewal", "preemption_right"],
  carryover_budget: ["carryover_percentage"],
  release_clauses: ["clause_default_factor", "rescission_penalty", "rescission_recovery_pct"],
};

export const CHILD_PARENT: Record<string, string> = Object.fromEntries(
  Object.entries(PARENT_CHILDREN).flatMap(([parent, children]) =>
    children.map((child) => [child, parent]),
  ),
);

export const DEFAULT_FLAG_VALUES: Record<string, boolean | number> = Object.fromEntries(
  ALL_FLAGS.map((f) => [f.key, f.defaultValue]),
);

// ─── EDITOR COMPONENT ────────────────────────────────────────────────────────

export function FlagsEditor({ control }: { control: Control<any> }) {
  return (
    <div className="space-y-6">
      {FLAG_CATEGORIES_ORDERED.map((category) => (
        <CategoryFlagCard
          key={category}
          category={category}
          flags={FLAGS_BY_CATEGORY[category]}
          control={control}
        />
      ))}
    </div>
  );
}

function CategoryFlagCard({
  category,
  flags,
  control,
}: {
  category: FlagCategory;
  flags: FlagDef[];
  control: Control<any>;
}) {
  const watchedFlags = useWatch({ control, name: "feature_flags" }) as
    | Record<string, boolean | number>
    | undefined;

  function isDisabled(flagKey: string): boolean {
    const parentKey = CHILD_PARENT[flagKey];
    if (!parentKey) return false;
    return !watchedFlags?.[parentKey];
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{FLAG_CATEGORY_LABELS[category]}</CardTitle>
        <CardDescription>{FLAG_CATEGORY_DESCRIPTIONS[category]}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {flags.map((flag) => {
            const disabled = isDisabled(flag.key);
            const isNumeric = flag.type === "int" || flag.type === "float";

            return (
              <div
                key={flag.key}
                className="flex items-center justify-between gap-4 px-6 py-4 transition-opacity"
                style={{
                  opacity: disabled ? 0.4 : 1,
                  pointerEvents: disabled ? "none" : "auto",
                }}
              >
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="text-sm font-medium leading-none">{flag.label}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed mt-1">
                    {flag.description}
                  </div>
                </div>

                <div className="shrink-0">
                  {isNumeric ? (
                    <FormField
                      control={control}
                      name={`feature_flags.${flag.key}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              className="w-24 font-mono text-right"
                              min={flag.minValue}
                              max={flag.maxValue}
                              step={flag.step ?? (flag.type === "int" ? 1 : 0.01)}
                              value={(field.value as number) ?? (flag.defaultValue as number)}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              data-testid={`input-flag-${flag.key}`}
                              disabled={disabled}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={control}
                      name={`feature_flags.${flag.key}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Switch
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                              disabled={disabled}
                              data-testid={`switch-flag-${flag.key}`}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
