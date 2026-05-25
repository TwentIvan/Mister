import { 
  useListTemplates, getListTemplatesQueryKey,
  useCreateTemplate, useUpdateTemplate, useDeleteTemplate
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Clock, Plus, Zap, Settings2, ShieldAlert, Trash2, Star } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";

const templateSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  tagline: z.string().optional(),
  description: z.string().optional(),
  complexity_level: z.coerce.number().int().min(1).max(3).default(1),
  estimated_weekly_minutes: z.coerce.number().min(0).default(60),
  is_active: z.boolean().default(true),
});

export default function TemplatesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: templates, isLoading } = useListTemplates(
    {},
    { query: { queryKey: getListTemplatesQueryKey({}) } }
  );

  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  const form = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      tagline: "",
      description: "",
      complexity_level: 1,
      estimated_weekly_minutes: 60,
      is_active: true,
    }
  });

  const onCreate = (values: z.infer<typeof templateSchema>) => {
    createMutation.mutate({
      data: {
        name: values.name,
        tagline: values.tagline ?? "",
        description: values.description ?? "",
        complexity_level: values.complexity_level,
        estimated_weekly_minutes: values.estimated_weekly_minutes,
        is_active: values.is_active,
        feature_flags: {
          multi_season_contracts: false,
          max_contract_length: 1,
          contract_renewal: false,
          preemption_right: false,
          repair_auction_january: true,
          free_agent_pool: true,
          direct_trades: false,
          always_on_markets: false,
          carryover_budget: false,
          carryover_percentage: 0,
          player_value_dynamic: false,
          amortization: false,
          release_clauses: false,
          clause_default_factor: 0.8,
          rescission_penalty: false,
          rescission_recovery_pct: 50,
          no_schema_tactics: false,
          scouting_enabled: false,
        }
      }
    }, {
      onSuccess: () => {
        toast({ title: "Template creato" });
        setIsCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey({}) });
        form.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Creazione fallita" })
    });
  };

  const handleToggleActive = (id: string, is_active: boolean) => {
    updateMutation.mutate({
      id,
      data: { is_active }
    }, {
      onSuccess: () => {
        toast({ title: "Stato aggiornato" });
        queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey({}) });
      }
    });
  };

  const handleDelete = (id: string, isSystem: boolean) => {
    if (isSystem) {
      toast({ variant: "destructive", title: "I template di sistema non si eliminano. Disattivali." });
      return;
    }
    if (confirm("Eliminare questo template? Le leghe già create non verranno influenzate.")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Template eliminato" });
          queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey({}) });
        }
      });
    }
  };

  const complexityLabel = (level: number) => {
    if (level === 1) return "Base";
    if (level === 2) return "Intermedio";
    return "Avanzato";
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            Gestione Template
          </h1>
          <p className="text-muted-foreground mt-1">
            Amministrazione dei template di onboarding lega
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Nuovo template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crea template custom</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="complexity_level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complessità (1-3)</FormLabel>
                        <FormControl><Input type="number" min={1} max={3} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="tagline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tagline</FormLabel>
                      <FormControl><Input {...field} placeholder="Una frase breve che sintetizza il template" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrizione</FormLabel>
                      <FormControl><Textarea {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estimated_weekly_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minuti stimati / settimana</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creazione..." : "Crea template"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <>
            <Skeleton className="h-[300px] rounded-xl" />
            <Skeleton className="h-[300px] rounded-xl" />
          </>
        ) : templates?.map((template) => (
          <Card key={template.id} className={`border-2 ${template.is_active ? 'border-primary/20' : 'border-muted opacity-60'}`}>
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    {template.name}
                    {template.is_system && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1 italic">{template.tagline}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={template.is_active ? "default" : "secondary"}>
                    {template.is_active ? "Attivo" : "Disattivo"}
                  </Badge>
                  <Switch 
                    checked={template.is_active} 
                    onCheckedChange={(checked) => handleToggleActive(template.id, checked)} 
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-sm text-foreground/80">{template.description}</p>
              
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground bg-muted/10 p-3 rounded-md border">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  <span className="font-medium">Complessità:</span> {complexityLabel(template.complexity_level)}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Tempo:</span> ~{template.estimated_weekly_minutes} min/sett
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span className="font-medium">Flag:</span> {Object.keys(template.feature_flags || {}).length}/18
                </div>
              </div>

              <div className="flex justify-end pt-2">
                {!template.is_system && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(template.id, template.is_system)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Elimina
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
