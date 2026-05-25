import {
  useGetFederation, getGetFederationQueryKey,
  useUpdateFederation, FederationUpdateMode
} from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription, FormMessage } from "@/components/ui/form";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { BookOpen, Save } from "lucide-react";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

type FlagType = "bool" | "int" | "float";
type FlagCategory = "contracts" | "market" | "economy" | "tactics" | "scouting";

interface FlagDef {
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

const FLAG_CATEGORY_LABELS: Record<FlagCategory, string> = {
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

const FLAG_CATEGORIES_ORDERED: FlagCategory[] = [
  "contracts", "market", "economy", "tactics", "scouting",
];

const ALL_FLAGS: FlagDef[] = [
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

const FLAGS_BY_KEY = Object.fromEntries(ALL_FLAGS.map((f) => [f.key, f]));

const FLAGS_BY_CATEGORY = FLAG_CATEGORIES_ORDERED.reduce<Record<FlagCategory, FlagDef[]>>(
  (acc, cat) => {
    acc[cat] = ALL_FLAGS.filter((f) => f.category === cat);
    return acc;
  },
  {} as Record<FlagCategory, FlagDef[]>,
);

const PARENT_CHILDREN: Record<string, string[]> = {
  multi_season_contracts: ["max_contract_length", "contract_renewal", "preemption_right"],
  carryover_budget: ["carryover_percentage"],
  release_clauses: ["clause_default_factor", "rescission_penalty", "rescission_recovery_pct"],
};

const CHILD_PARENT: Record<string, string> = Object.fromEntries(
  Object.entries(PARENT_CHILDREN).flatMap(([parent, children]) =>
    children.map((child) => [child, parent]),
  ),
);

const federationSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  description: z.string().optional(),
  mode: z.nativeEnum(FederationUpdateMode),
  feature_flags: z.record(z.union([z.boolean(), z.number()])).optional(),
});

type FormValues = z.infer<typeof federationSchema>;

export default function FederationRules() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: federation, isLoading } = useGetFederation(
    id,
    { query: { enabled: !!id, queryKey: getGetFederationQueryKey(id) } },
  );

  const updateMutation = useUpdateFederation();

  const form = useForm<FormValues>({
    resolver: zodResolver(federationSchema),
    defaultValues: {
      name: "",
      description: "",
      mode: FederationUpdateMode.classic,
      feature_flags: Object.fromEntries(ALL_FLAGS.map((f) => [f.key, f.defaultValue])),
    },
  });

  const isInitialized = useRef(false);

  useEffect(() => {
    if (federation && !isInitialized.current) {
      form.reset({
        name: federation.name,
        description: federation.description ?? "",
        mode: federation.mode as FederationUpdateMode,
        feature_flags: (federation.feature_flags as Record<string, boolean | number>) ?? {},
      });
      isInitialized.current = true;
    }
  }, [federation, form]);

  const onSubmit = (values: FormValues) => {
    if (!federation) return;
    updateMutation.mutate(
      { leagueId: id, data: values },
      {
        onSuccess: (updated) => {
          toast({ title: "Regolamento aggiornato" });
          queryClient.setQueryData(getGetFederationQueryKey(id), updated);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Aggiornamento fallito" });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!federation) {
    return <div className="text-destructive">Regolamento non trovato</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold font-serif text-primary flex items-center gap-3">
          <BookOpen className="h-8 w-8" />
          Regolamento Federazione
        </h1>
        <p className="text-muted-foreground mt-1">Configura le regole e le meccaniche della lega</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* ─── IMPOSTAZIONI GENERALI ───────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Impostazioni generali</CardTitle>
              <CardDescription>Identità della federazione e modalità di gioco.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome regolamento</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-fed-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modalità di gioco</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-fed-mode">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={FederationUpdateMode.classic}>Classico</SelectItem>
                          <SelectItem value={FederationUpdateMode.mantra}>Mantra</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrizione</FormLabel>
                    <FormControl>
                      <Textarea {...field} className="min-h-[100px]" data-testid="input-fed-desc" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ─── FEATURE FLAG PER CATEGORIA ──────────────────────── */}
          {FLAG_CATEGORIES_ORDERED.map((category) => (
            <CategoryFlagCard
              key={category}
              category={category}
              flags={FLAGS_BY_CATEGORY[category]}
              form={form}
            />
          ))}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              data-testid="button-save-fed"
            >
              {updateMutation.isPending ? "Salvataggio..." : "Salva regolamento"}
              <Save className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

function CategoryFlagCard({
  category,
  flags,
  form,
}: {
  category: FlagCategory;
  flags: FlagDef[];
  form: ReturnType<typeof useForm<FormValues>>;
}) {
  const watchedFlags = useWatch({ control: form.control, name: "feature_flags" }) as
    | Record<string, boolean | number>
    | undefined;

  function isDisabled(flagKey: string): boolean {
    const parentKey = CHILD_PARENT[flagKey];
    if (!parentKey) return false;
    const parentVal = watchedFlags?.[parentKey];
    return !parentVal;
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
                      control={form.control}
                      name={`feature_flags.${flag.key}` as `feature_flags.${string}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              className="w-24 font-mono text-right"
                              min={flag.minValue}
                              max={flag.maxValue}
                              step={flag.step ?? (flag.type === "int" ? 1 : 0.01)}
                              value={field.value as number ?? (flag.defaultValue as number)}
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
                      control={form.control}
                      name={`feature_flags.${flag.key}` as `feature_flags.${string}`}
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
