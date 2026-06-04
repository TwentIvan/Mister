import {
  useGetFederation, getGetFederationQueryKey,
  useUpdateFederation, FederationUpdateMode
} from "@workspace/api-client-react";
import { useCurrentUser } from "@/contexts/AuthContext";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BookOpen, Save, AlertTriangle, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FlagsEditor, DEFAULT_FLAG_VALUES } from "@/components/FlagsEditor";
import { RulesEditor, DEFAULT_RULES, type FederationRules } from "@/components/RulesEditor";

const federationSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  description: z.string().optional(),
  mode: z.nativeEnum(FederationUpdateMode),
  feature_flags: z.record(z.union([z.boolean(), z.number()])).optional(),
});

type FormValues = z.infer<typeof federationSchema>;

function mergeRules(defaults: FederationRules, live: unknown): FederationRules {
  if (!live || typeof live !== "object") return defaults;
  const l = live as Partial<FederationRules>;
  return {
    bonusMalus: { ...defaults.bonusMalus, ...(l.bonusMalus ?? {}) },
    goalThresholds: { ...defaults.goalThresholds, ...(l.goalThresholds ?? {}) },
    defenseModifier: {
      ...defaults.defenseModifier,
      ...(l.defenseModifier ?? {}),
      table: {
        ...defaults.defenseModifier.table,
        ...((l.defenseModifier as { table?: Record<string, number> })?.table ?? {}),
      },
    },
    midfieldModifier: {
      ...defaults.midfieldModifier,
      ...(l.midfieldModifier ?? {}),
      table: {
        ...defaults.midfieldModifier.table,
        ...((l.midfieldModifier as { table?: Record<string, number> })?.table ?? {}),
      },
    },
    homeAdvantage: { ...defaults.homeAdvantage, ...(l.homeAdvantage ?? {}) },
    substitutions: { ...defaults.substitutions, ...(l.substitutions ?? {}) },
  };
}

export default function FederationPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

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
      feature_flags: { ...DEFAULT_FLAG_VALUES },
    },
  });

  const [rules, setRules] = useState<FederationRules>(DEFAULT_RULES);

  const isInitialized = useRef(false);

  useEffect(() => {
    if (federation && !isInitialized.current) {
      form.reset({
        name: federation.name,
        description: federation.description ?? "",
        mode: federation.mode as FederationUpdateMode,
        feature_flags: {
          ...DEFAULT_FLAG_VALUES,
          ...((federation.feature_flags as Record<string, boolean | number>) ?? {}),
        },
      });
      setRules(mergeRules(DEFAULT_RULES, federation.rules));
      isInitialized.current = true;
    }
  }, [federation, form]);

  const onSubmit = (values: FormValues) => {
    if (!federation) return;
    updateMutation.mutate(
      {
        leagueId: id,
        data: {
          ...values,
          rules: rules as unknown as Parameters<typeof updateMutation.mutate>[0]["data"]["rules"],
        },
      },
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
        <p className="text-muted-foreground mt-1">Configura le regole e le meccaniche condivise tra tutte le leghe di questa federazione.</p>
      </div>

      {/* ─── AVVISO SNAPSHOT ─────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium text-amber-800 dark:text-amber-400">Le modifiche valgono per nuove leghe e nuove stagioni</p>
          <p className="text-amber-700 dark:text-amber-500">
            Le leghe già avviate usano il regolamento congelato al momento del primo avvio dell'asta.
            Modificare flag o regole di punteggio qui non cambia le regole di nessuna lega in corso.
          </p>
        </div>
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

              {/* Proprietario */}
              <div className="flex items-center gap-2 pt-2 border-t">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Proprietario:</span>
                <span className="text-sm font-mono text-foreground">
                  {user?.display_name ?? "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ─── FEATURE FLAG ────────────────────────────────────── */}
          <FlagsEditor control={form.control} />

          {/* ─── REGOLE DI PUNTEGGIO ─────────────────────────────── */}
          <RulesEditor rules={rules} onChange={setRules} />

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
