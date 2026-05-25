import {
  useListTemplates, getListTemplatesQueryKey,
  useCreateTemplate, useUpdateTemplate, useDeleteTemplate,
} from "@workspace/api-client-react";
import type { TemplateProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Plus, Copy, Pencil, PowerOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FlagsEditor,
  ALL_FLAGS,
  FLAG_CATEGORIES_ORDERED,
  FLAG_CATEGORY_LABELS,
  FLAGS_BY_CATEGORY,
  DEFAULT_FLAG_VALUES,
} from "@/components/FlagsEditor";
import type { FlagDef, FlagCategory } from "@/components/FlagsEditor";

// ─── SCHEMA FORM ─────────────────────────────────────────────────────────────

const templateSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  tagline: z.string().optional(),
  description: z.string().optional(),
  complexity_level: z.coerce.number().int().min(1).max(3),
  estimated_weekly_minutes: z.coerce.number().min(0),
  feature_flags: z.record(z.union([z.boolean(), z.number()])).optional(),
  is_active: z.boolean().default(true),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

const EMPTY_FORM: TemplateFormValues = {
  name: "",
  tagline: "",
  description: "",
  complexity_level: 1,
  estimated_weekly_minutes: 60,
  feature_flags: { ...DEFAULT_FLAG_VALUES },
  is_active: true,
};

// ─── CHIP HELPERS ─────────────────────────────────────────────────────────────

function getChipLabel(flag: FlagDef, value: boolean | number): string {
  if (flag.key === "max_contract_length") return `contratti ${value} anni`;
  if (flag.key === "carryover_percentage") return `carryover ${value}%`;
  if (flag.key === "clause_default_factor") return `clausola ×${value}`;
  if (flag.key === "rescission_recovery_pct") return `recupero ${value}%`;
  return flag.label;
}

interface ActiveChip {
  flag: FlagDef;
  value: boolean | number;
  label: string;
}

function computeActiveChips(featureFlags: Record<string, boolean | number> | undefined): ActiveChip[] {
  if (!featureFlags) return [];
  return ALL_FLAGS.filter((flag) => {
    const val = featureFlags[flag.key];
    if (val === undefined || val === null) return false;
    if (flag.type === "bool") return val === true;
    return val !== flag.defaultValue;
  }).map((flag) => ({
    flag,
    value: featureFlags[flag.key] as boolean | number,
    label: getChipLabel(flag, featureFlags[flag.key] as boolean | number),
  }));
}

// ─── COMPLEXITY LABELS ────────────────────────────────────────────────────────

const COMPLEXITY_LABEL: Record<number, string> = {
  1: "Base",
  2: "Intermedio",
  3: "Avanzato",
};

// ─── TEMPLATE FORM (create / edit) ───────────────────────────────────────────

function TemplateFormInner({
  form,
  onSubmit,
  isPending,
  submitLabel,
}: {
  form: ReturnType<typeof useForm<TemplateFormValues>>;
  onSubmit: (values: TemplateFormValues) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <ScrollArea className="h-[65vh] pr-4">
          <div className="space-y-6 pb-4">
            {/* ─── Campi base ─── */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="complexity_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complessità</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(parseInt(v))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">1 — Base</SelectItem>
                        <SelectItem value="2">2 — Intermedio</SelectItem>
                        <SelectItem value="3">3 — Avanzato</SelectItem>
                      </SelectContent>
                    </Select>
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
                  <FormControl>
                    <Input {...field} placeholder="Una frase breve che sintetizza il profilo" />
                  </FormControl>
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
                  <FormControl>
                    <Textarea {...field} className="min-h-[80px]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="estimated_weekly_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tempo stimato settimanale (minuti)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} className="w-32 font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ─── Flag editor ─── */}
            <div>
              <p className="text-sm font-medium mb-4">Feature flag</p>
              <FlagsEditor control={form.control} />
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-4 border-t mt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvataggio..." : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── TEMPLATE CARD ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onEdit,
  onDuplicate,
  onToggleActive,
  onDelete,
}: {
  template: TemplateProfile;
  onEdit: (t: TemplateProfile) => void;
  onDuplicate: (t: TemplateProfile) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const flags = template.feature_flags as Record<string, boolean | number> | undefined;
  const allChips = computeActiveChips(flags);
  const MAX_VISIBLE = 8;
  const visibleChips = allChips.slice(0, MAX_VISIBLE);
  const remainingCount = allChips.length - visibleChips.length;

  // Group visible chips by category (in canonical order)
  const chipsByCategory: { category: FlagCategory; chips: ActiveChip[] }[] = [];
  for (const cat of FLAG_CATEGORIES_ORDERED) {
    const inCat = visibleChips.filter((c) => c.flag.category === cat);
    if (inCat.length > 0) chipsByCategory.push({ category: cat, chips: inCat });
  }

  const activeCount = allChips.length;
  const marketsCount = template.suggested_markets?.length ?? 0;
  const compsCount = template.suggested_competitions?.length ?? 0;

  const isSystem = template.is_system;

  return (
    <article
      className="rounded-lg border bg-card flex flex-col"
      style={{
        borderColor: template.is_active ? undefined : "var(--border)",
        opacity: template.is_active ? 1 : 0.7,
      }}
    >
      {/* ─── HEADER ─── */}
      <header className="flex justify-between items-start p-5 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="text-lg font-semibold leading-tight"
              style={{ fontFamily: "Fraunces, Georgia, serif" }}
            >
              {template.name}
            </h3>
            {isSystem && (
              <Badge
                variant="outline"
                className="text-xs font-mono uppercase tracking-wide"
                style={{
                  background: "var(--cream, #efe6d3)",
                  borderColor: "#d9cdb5",
                  color: "#6b5c3e",
                }}
              >
                di sistema
              </Badge>
            )}
            <Badge variant={template.is_active ? "default" : "secondary"} className="text-xs">
              {template.is_active ? "Attivo" : "Disattivo"}
            </Badge>
          </div>
          <div
            className="mt-1 uppercase tracking-wider"
            style={{
              fontFamily: "JetBrains Mono, SF Mono, monospace",
              fontSize: "11px",
              color: "var(--ink-dim, #8a9591)",
            }}
          >
            livello {template.complexity_level} · ~{template.estimated_weekly_minutes} min/sett.
          </div>
        </div>
      </header>

      {/* ─── TAGLINE / DESCRIZIONE ─── */}
      <div className="px-5 pb-3 flex-1">
        {template.tagline && (
          <p className="text-xs text-muted-foreground italic mb-2">{template.tagline}</p>
        )}
        {template.description && (
          <p className="text-sm" style={{ color: "var(--ink-mid, #4a5550)" }}>
            {template.description}
          </p>
        )}
      </div>

      {/* ─── FLAG CHIPS ─── */}
      {chipsByCategory.length > 0 && (
        <div className="px-5 pb-4">
          {chipsByCategory.map(({ category, chips }) => (
            <div key={category} className="mb-2">
              <div
                className="uppercase tracking-widest mb-1"
                style={{
                  fontFamily: "JetBrains Mono, SF Mono, monospace",
                  fontSize: "10px",
                  color: "var(--ink-dim, #8a9591)",
                }}
              >
                {FLAG_CATEGORY_LABELS[category]}
              </div>
              <div className="flex flex-wrap gap-1">
                {chips.map((chip) => (
                  <span
                    key={chip.flag.key}
                    className="rounded-sm px-2 py-0.5"
                    style={{
                      fontFamily: "JetBrains Mono, SF Mono, monospace",
                      fontSize: "11px",
                      background: "var(--green-pale, #e8f0eb)",
                      color: "var(--green-deep, #1f4733)",
                    }}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {remainingCount > 0 && (
            <span
              className="text-xs cursor-default"
              style={{
                fontFamily: "JetBrains Mono, SF Mono, monospace",
                fontSize: "11px",
                color: "var(--green-mid, #2d6b4f)",
              }}
            >
              +{remainingCount} altri →
            </span>
          )}
        </div>
      )}

      {/* ─── FOOTER ─── */}
      <footer
        className="flex items-center justify-between px-5 py-3 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="flex gap-4 text-sm"
          style={{ color: "var(--ink-mid, #4a5550)" }}
        >
          <span>
            <span style={{ fontFamily: "JetBrains Mono, SF Mono, monospace" }}>{compsCount}</span>{" "}
            competizioni suggerite
          </span>
          <span>
            <span style={{ fontFamily: "JetBrains Mono, SF Mono, monospace" }}>{marketsCount}</span>{" "}
            mercati suggeriti
          </span>
          <span>
            <span style={{ fontFamily: "JetBrains Mono, SF Mono, monospace" }}>{activeCount}</span>{" "}
            voci attive
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Duplica — sempre disponibile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDuplicate(template)}
            title="Duplica profilo"
          >
            <Copy className="h-4 w-4" />
          </Button>

          {/* Modifica — disabilitato per is_system */}
          {isSystem ? (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="ghost" size="sm" disabled>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>I profili di sistema non si modificano</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onEdit(template)} title="Modifica">
              <Pencil className="h-4 w-4" />
            </Button>
          )}

          {/* Disattiva/Attiva — sempre disponibile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleActive(template.id, !template.is_active)}
            title={template.is_active ? "Disattiva" : "Attiva"}
          >
            <PowerOff className="h-4 w-4" />
          </Button>

          {/* Elimina — solo per template custom */}
          {!isSystem && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(template.id)}
              title="Elimina"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>
    </article>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function TemplatesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateProfile | null>(null);

  const { data: templates, isLoading } = useListTemplates(
    {},
    { query: { queryKey: getListTemplatesQueryKey({}) } },
  );

  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  // ─── Create form ───
  const createForm = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: { ...EMPTY_FORM },
  });

  // ─── Edit form ───
  const editForm = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: { ...EMPTY_FORM },
  });

  const handleCreate = (values: TemplateFormValues) => {
    createMutation.mutate(
      {
        data: {
          name: values.name,
          tagline: values.tagline ?? "",
          description: values.description ?? "",
          complexity_level: values.complexity_level,
          estimated_weekly_minutes: values.estimated_weekly_minutes,
          feature_flags: (values.feature_flags ?? DEFAULT_FLAG_VALUES) as Record<string, boolean | number>,
          is_active: values.is_active,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Profilo creato" });
          setCreateOpen(false);
          createForm.reset({ ...EMPTY_FORM });
          queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey({}) });
        },
        onError: () => toast({ variant: "destructive", title: "Creazione fallita" }),
      },
    );
  };

  const handleEdit = (values: TemplateFormValues) => {
    if (!editingTemplate) return;
    updateMutation.mutate(
      {
        id: editingTemplate.id,
        data: {
          name: values.name,
          tagline: values.tagline,
          description: values.description,
          complexity_level: values.complexity_level,
          estimated_weekly_minutes: values.estimated_weekly_minutes,
          feature_flags: (values.feature_flags ?? DEFAULT_FLAG_VALUES) as Record<string, boolean | number>,
          is_active: values.is_active,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Profilo aggiornato" });
          setEditingTemplate(null);
          queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey({}) });
        },
        onError: () => toast({ variant: "destructive", title: "Aggiornamento fallito" }),
      },
    );
  };

  const openEdit = (template: TemplateProfile) => {
    editForm.reset({
      name: template.name,
      tagline: template.tagline ?? "",
      description: template.description ?? "",
      complexity_level: template.complexity_level,
      estimated_weekly_minutes: template.estimated_weekly_minutes,
      feature_flags: (template.feature_flags as Record<string, boolean | number>) ?? { ...DEFAULT_FLAG_VALUES },
      is_active: template.is_active,
    });
    setEditingTemplate(template);
  };

  const handleDuplicate = (template: TemplateProfile) => {
    createMutation.mutate(
      {
        data: {
          name: `${template.name} (copia)`,
          tagline: template.tagline ?? "",
          description: template.description ?? "",
          complexity_level: template.complexity_level,
          estimated_weekly_minutes: template.estimated_weekly_minutes,
          feature_flags: template.feature_flags as Record<string, boolean | number>,
          is_active: false,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Profilo duplicato" });
          queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey({}) });
        },
        onError: () => toast({ variant: "destructive", title: "Duplicazione fallita" }),
      },
    );
  };

  const handleToggleActive = (id: string, active: boolean) => {
    updateMutation.mutate(
      { id, data: { is_active: active } },
      {
        onSuccess: () => {
          toast({ title: active ? "Profilo attivato" : "Profilo disattivato" });
          queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey({}) });
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm("Eliminare questo profilo? Le leghe già create non verranno influenzate.")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Profilo eliminato" });
          queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey({}) });
        },
      },
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ─── PAGE HEADER ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold text-primary flex items-center gap-3"
            style={{ fontFamily: "Fraunces, Georgia, serif" }}
          >
            <ShieldAlert className="h-8 w-8 text-destructive" />
            Profili di gioco
          </h1>
          <p className="text-muted-foreground mt-1">
            Modelli pre-confezionati che la Federazione può clonare in regolamento.
          </p>
        </div>

        <Button className="gap-2" onClick={() => { createForm.reset({ ...EMPTY_FORM }); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" /> Nuovo profilo
        </Button>
      </div>

      {/* ─── GRID CARDS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <>
            <Skeleton className="h-[300px] rounded-lg" />
            <Skeleton className="h-[300px] rounded-lg" />
            <Skeleton className="h-[300px] rounded-lg" />
          </>
        ) : templates?.length === 0 ? (
          <div
            className="col-span-2 flex justify-between items-center p-6 rounded-lg border-dashed border-2"
            style={{ background: "var(--paper, #fafaf7)" }}
          >
            <div>
              <p className="font-medium">Nessun profilo ancora</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crea il primo profilo per permettere alla Federazione di configurare la lega in modo guidato.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nuovo profilo
            </Button>
          </div>
        ) : (
          templates?.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={openEdit}
              onDuplicate={handleDuplicate}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* ─── MODAL CREA ─── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Fraunces, Georgia, serif" }}>
              Nuovo profilo
            </DialogTitle>
          </DialogHeader>
          <TemplateFormInner
            form={createForm}
            onSubmit={handleCreate}
            isPending={createMutation.isPending}
            submitLabel="Crea profilo"
          />
        </DialogContent>
      </Dialog>

      {/* ─── MODAL MODIFICA ─── */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => { if (!open) setEditingTemplate(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Fraunces, Georgia, serif" }}>
              Modifica profilo{editingTemplate ? ` — ${editingTemplate.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <TemplateFormInner
            form={editForm}
            onSubmit={handleEdit}
            isPending={updateMutation.isPending}
            submitLabel="Salva modifiche"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
