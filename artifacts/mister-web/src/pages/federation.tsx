import { 
  useGetFederation, getGetFederationQueryKey,
  useUpdateFederation, FederationUpdateMode, FederationUpdateVotoSource
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

const federationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  mode: z.nativeEnum(FederationUpdateMode),
  voto_source: z.nativeEnum(FederationUpdateVotoSource),
  feature_flags: z.record(z.boolean().or(z.number())).optional()
});

export default function FederationRules() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get federation for the given league
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
      voto_source: FederationUpdateVotoSource.italia,
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
        voto_source: federation.voto_source as FederationUpdateVotoSource,
        feature_flags: federation.feature_flags as Record<string, boolean | number>
      });
      isInitialized.current = true;
    }
  }, [federation, form]);

  const onSubmit = (values: z.infer<typeof federationSchema>) => {
    if (!federation) return;

    updateMutation.mutate({
      id: federation.id,
      data: values
    }, {
      onSuccess: (updated) => {
        toast({ title: "Federation updated" });
        queryClient.setQueryData(getGetFederationQueryKey(id), updated);
      },
      onError: () => {
        toast({ variant: "destructive", title: "Failed to update federation" });
      }
    });
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-[400px]" /></div>;
  }

  if (!federation) {
    return <div className="text-destructive">Federation not found</div>;
  }

  const featureFlags = form.watch("feature_flags") || {};

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold font-serif text-primary flex items-center gap-3">
          <BookOpen className="h-8 w-8" />
          Federation Rules
        </h1>
        <p className="text-muted-foreground mt-1">Configure league regulations and mechanics</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Core properties of your federation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Federation Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-fed-name" />
                      </FormControl>
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} className="min-h-[100px]" data-testid="input-fed-desc" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Game Mode</FormLabel>
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

                <FormField
                  control={form.control}
                  name="voto_source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voto Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-fed-voto">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={FederationUpdateVotoSource.italia}>Italia</SelectItem>
                          <SelectItem value={FederationUpdateVotoSource.gazzetta}>Gazzetta</SelectItem>
                          <SelectItem value={FederationUpdateVotoSource.fantacalcio_it}>Fantacalcio.it</SelectItem>
                          <SelectItem value={FederationUpdateVotoSource.consensus}>Consensus</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Advanced Mechanics
              </CardTitle>
              <CardDescription>Toggle specific features for this federation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { key: "multi_season_contracts", label: "Multi-season Contracts", desc: "Allow contracts that span multiple seasons" },
                  { key: "free_agent_pool", label: "Free Agent Pool", desc: "Enable signing unassigned players at any time" },
                  { key: "direct_trades", label: "Direct Trades", desc: "Managers can trade directly with each other" },
                  { key: "carryover_budget", label: "Carryover Budget", desc: "Unspent credits carry over to next season" },
                  { key: "scouting_enabled", label: "Scouting System", desc: "Enable advanced player discovery features" },
                  { key: "release_clauses", label: "Release Clauses", desc: "Contracts can include buyout clauses" }
                ].map(({ key, label, desc }) => (
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
              {updateMutation.isPending ? "Saving..." : "Save Federation Rules"}
              <Save className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}