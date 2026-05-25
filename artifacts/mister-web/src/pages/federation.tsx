import { 
  useGetFederation, getGetFederationQueryKey,
  useUpdateFederation, FederationUpdateMode
} from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { BookOpen, Shield, Save } from "lucide-react";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const ALL_FLAGS = [
  { key: "multi_season_contracts", label: "Contratti pluriennali", desc: "Contratti che durano più di una stagione" },
  { key: "contract_renewal", label: "Rinnovo contratto", desc: "Flusso esplicito di rinnovo a scadenza" },
  { key: "preemption_right", label: "Diritto di pareggio", desc: "Il detentore può pareggiare in tempo reale all'asta" },
  { key: "repair_auction_january", label: "Asta riparazione gennaio", desc: "Asta sui nuovi acquisti di mercato invernale" },
  { key: "free_agent_pool", label: "Pool svincolati", desc: "Giocatori non assegnati disponibili tutto l'anno" },
  { key: "direct_trades", label: "Scambi diretti", desc: "Trattative 1-a-1 tra manager" },
  { key: "always_on_markets", label: "Mercati sempre attivi", desc: "Mercato aperto durante tutta la stagione" },
  { key: "carryover_budget", label: "Carryover budget", desc: "Crediti residui portati alla stagione successiva" },
  { key: "player_value_dynamic", label: "Valore dinamico", desc: "Quotazione aggiornata in base alle prestazioni" },
  { key: "amortization", label: "Ammortamento", desc: "Prezzo d'acquisto suddiviso sugli anni di contratto" },
  { key: "release_clauses", label: "Clausole rescissorie", desc: "Buyout attivabile da altri manager" },
  { key: "rescission_penalty", label: "Penale rescissione", desc: "Penale se il manager svincola prima della scadenza" },
  { key: "no_schema_tactics", label: "Tattiche libere", desc: "Formazione senza vincoli di modulo predefinito" },
  { key: "scouting_enabled", label: "Scouting", desc: "Sistema di scoperta giocatori emergenti" },
];

const federationSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  description: z.string().optional(),
  mode: z.nativeEnum(FederationUpdateMode),
  feature_flags: z.record(z.union([z.boolean(), z.number()])).optional()
});

export default function FederationRules() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: federation, isLoading } = useGetFederation(
    id,
    { query: { enabled: !!id, queryKey: getGetFederationQueryKey(id) } }
  );

  const updateMutation = useUpdateFederation();

  const form = useForm<z.infer<typeof federationSchema>>({
    resolver: zodResolver(federationSchema),
    defaultValues: {
      name: "",
      description: "",
      mode: FederationUpdateMode.classic,
      feature_flags: {}
    }
  });

  const isInitialized = useRef(false);

  useEffect(() => {
    if (federation && !isInitialized.current) {
      form.reset({
        name: federation.name,
        description: federation.description || "",
        mode: federation.mode as FederationUpdateMode,
        feature_flags: federation.feature_flags as Record<string, boolean | number>
      });
      isInitialized.current = true;
    }
  }, [federation, form]);

  const onSubmit = (values: z.infer<typeof federationSchema>) => {
    if (!federation) return;

    updateMutation.mutate({
      leagueId: id,
      data: values
    }, {
      onSuccess: (updated) => {
        toast({ title: "Regolamento aggiornato" });
        queryClient.setQueryData(getGetFederationQueryKey(id), updated);
      },
      onError: () => {
        toast({ variant: "destructive", title: "Aggiornamento fallito" });
      }
    });
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-[400px]" /></div>;
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
          <Card>
            <CardHeader>
              <CardTitle>Impostazioni generali</CardTitle>
              <CardDescription>Proprietà base del regolamento</CardDescription>
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
                          <SelectItem value={FederationUpdateMode.classic}>Classic</SelectItem>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Feature flag — tutti i 18
              </CardTitle>
              <CardDescription>Attiva o disattiva le meccaniche avanzate di questa lega</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ALL_FLAGS.map(({ key, label, desc }) => (
                  <FormField
                    key={key}
                    control={form.control}
                    name={`feature_flags.${key}`}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-card hover:bg-muted/10 transition-colors">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base font-semibold">{label}</FormLabel>
                          <FormDescription>{desc}</FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                            data-testid={`switch-flag-${key}`}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-fed">
              {updateMutation.isPending ? "Salvataggio..." : "Salva regolamento"}
              <Save className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
