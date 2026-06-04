/**
 * MarketEditor — editor dei mercati a livello lega.
 *
 * PRINCIPIO CARDINE: quali tipi di mercato sono disponibili lo decide la
 * FEDERAZIONE via feature_flags. La lega può solo configurare finestre/
 * parametri dei tipi già abilitati. I tipi con flag spento sono mostrati
 * come non disponibili (col motivo) senza alcun controllo per attivarli.
 * Abilitare un tipo vietato è impossibile per costruzione: non esiste il
 * controllo per farlo.
 *
 * M4 ANNOTAZIONE FUTURA:
 *   - I tipi disponibili seguiranno lo SNAPSHOT della federazione della
 *     lega (flag congelati all'avvio stagione), NON i flag live. Stesso
 *     meccanismo di leagues.snapshot_rules per la federazione. Il check
 *     attuale usa i flag live — al momento opportuno, leggere lo snapshot.
 *   - Il MOTORE DI ESECUZIONE si aggancerà qui: ogni MarketEvent ha già
 *     status (scheduled/active/completed/cancelled) e config tipo-specifica
 *     pronta. Il motore leggerà gli eventi scheduled, aprirà la finestra
 *     a starts_at, chiuderà a ends_at, eseguirà il tipo corrispondente.
 */

import { useState } from "react";
import {
  useGetLeagueMarkets, getGetLeagueMarketsQueryKey,
  useCreateMarketEvent,
  useUpdateMarketEvent,
  useDeleteMarketEvent,
} from "@workspace/api-client-react";
import type { MarketEvent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Lock, Plus, Pencil, Trash2, CalendarRange, Infinity } from "lucide-react";

// ── Tipi e costanti ─────────────────────────────────────────────────────────

type MarketType = "auction" | "trade" | "release" | "free_agent";
type AuctionMode = "live" | "async" | "blind" | "token";

interface TypeSpec {
  flag: string | null;
  label: string;
  sublabel: string;
  description: string;
  flagLabel: string;
}

const TYPE_SPECS: Record<MarketType, TypeSpec> = {
  auction: {
    flag: "repair_auction_january",
    label: "Aste di riparazione",
    sublabel: "Asta async su nuovi acquisti reali",
    description:
      "Finestra d'asta invernale sui giocatori acquistati nel mercato reale di gennaio. Modalità default: async (offerte segrete).",
    flagLabel: "Riparazione di gennaio",
  },
  trade: {
    flag: "direct_trades",
    label: "Scambi diretti",
    sublabel: "Scambi 1-1 tra manager",
    description: "Permette scambi bilaterali tra manager, con o senza crediti allegati.",
    flagLabel: "Scambi diretti tra manager",
  },
  release: {
    flag: null,
    label: "Svincoli",
    sublabel: "Svincoli con o senza cieco",
    description: "Finestre di svincolo giocatori. Sempre disponibile: non richiede flag federazione.",
    flagLabel: "",
  },
  free_agent: {
    flag: "free_agent_pool",
    label: "Pool svincolati",
    sublabel: "Giocatori non acquistati all'asta",
    description: "Rende disponibili i giocatori non acquistati (e i re-svincolati) in una finestra dedicata.",
    flagLabel: "Pool svincolati permanente",
  },
};

const TYPE_ORDER: MarketType[] = ["auction", "trade", "release", "free_agent"];

// ── Helper finestre ──────────────────────────────────────────────────────────

function toDatetimeLocal(iso: string) {
  return iso.slice(0, 16);
}

function toDatetimeLocalNow() {
  return toDatetimeLocal(new Date().toISOString());
}

function toDatetimeLocalPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDatetimeLocal(d.toISOString());
}

// ── Stato form ───────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  starts_at: string;
  ends_at: string;
  alwaysOn: boolean;
  // auction specifics
  auctionMode: AuctionMode;
  // trade specifics
  requiresApproval: boolean;
  includeCredits: boolean;
  // release specifics
  releaseMode: "open" | "blind";
  recoveryPercentage: number;
  // free_agent specifics
  waitingPeriodHours: number;
}

function defaultForm(): FormState {
  return {
    name: "",
    description: "",
    starts_at: toDatetimeLocalNow(),
    ends_at: toDatetimeLocalPlusDays(7),
    alwaysOn: false,
    auctionMode: "async",
    requiresApproval: false,
    includeCredits: true,
    releaseMode: "open",
    recoveryPercentage: 0,
    waitingPeriodHours: 24,
  };
}

function formFromEvent(ev: MarketEvent): FormState {
  const cfg = ev.config as Record<string, unknown>;
  const auction = cfg.auction as Record<string, unknown> | undefined;
  const trade = cfg.trade as Record<string, unknown> | undefined;
  const release = cfg.release as Record<string, unknown> | undefined;
  const fa = cfg.freeAgent as Record<string, unknown> | undefined;
  return {
    name: ev.name,
    description: ev.description ?? "",
    starts_at: toDatetimeLocal(ev.starts_at),
    ends_at: toDatetimeLocal(ev.ends_at),
    alwaysOn: false,
    auctionMode: (auction?.mode as AuctionMode) ?? "async",
    requiresApproval: Boolean(trade?.requiresAdminApproval),
    includeCredits: trade?.includeCredits !== false,
    releaseMode: (release?.mode as "open" | "blind") ?? "open",
    recoveryPercentage: Number(release?.recoveryPercentage ?? 0),
    waitingPeriodHours: Number(fa?.waitingPeriodHours ?? 24),
  };
}

function buildConfig(type: MarketType, form: FormState) {
  switch (type) {
    case "auction":
      return {
        labelColor: "#1f4733",
        auction: {
          mode: form.auctionMode,
          rolePool: ["GK", "DEF", "MID", "ATT"],
          baseBid: 1,
          bidIncrements: [1, 5, 10],
          secondsPerPlayer: 30,
          timeshift: { enabled: true, thresholdSeconds: 10, extensionSeconds: 30 },
          autobid: { enabled: false, allowAiStrategy: false, visibleMaxToOthers: false },
          showBestBidder: true,
          voiceRecognition: false,
          auctioneerAi: false,
          bidsPerPlayer: 1,
          revealAllAfter: true,
          allowPreemption: false,
        },
      };
    case "trade":
      return {
        labelColor: "#1f4733",
        trade: {
          bilateralOnly: true,
          includeCredits: form.includeCredits,
          requiresAdminApproval: form.requiresApproval,
          coolDownDays: 3,
        },
      };
    case "release":
      return {
        labelColor: "#1f4733",
        release: {
          mode: form.releaseMode,
          recoveryPercentage: form.recoveryPercentage,
          blockRebuy: false,
          rebuyCooldownDays: 0,
          blindCompetingBids: form.releaseMode === "blind",
          applyRescissionPenalty: false,
        },
      };
    case "free_agent":
      return {
        labelColor: "#1f4733",
        freeAgent: {
          basePricePerRole: { GK: 1, DEF: 1, MID: 1, ATT: 1 },
          allowBlindCompeting: false,
          waitingPeriodHours: form.waitingPeriodHours,
          includeRescindedPlayers: false,
        },
      };
  }
}

// ── Props principali ─────────────────────────────────────────────────────────

interface MarketEditorProps {
  leagueId: string;
  federationFlags: Record<string, boolean | number | string>;
  alwaysOnEnabled: boolean;
}

// ── Componente dialogo crea/modifica ─────────────────────────────────────────

interface EventDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: MarketType;
  initial: FormState;
  onSave: (form: FormState) => void;
  isSaving: boolean;
  alwaysOnEnabled: boolean;
  mode: "create" | "edit";
}

function EventDialog({ open, onOpenChange, type, initial, onSave, isSaving, alwaysOnEnabled, mode }: EventDialogProps) {
  const [form, setForm] = useState<FormState>(initial);
  const spec = TYPE_SPECS[type];

  const patch = (partial: Partial<FormState>) => setForm(f => ({ ...f, ...partial }));

  const handleAlwaysOnToggle = (v: boolean) => {
    if (v) {
      patch({ alwaysOn: true, starts_at: "1970-01-01T00:00", ends_at: "2099-12-31T23:59" });
    } else {
      patch({ alwaysOn: false, starts_at: toDatetimeLocalNow(), ends_at: toDatetimeLocalPlusDays(7) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {mode === "create" ? "Nuovo evento" : "Modifica evento"} — {spec.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Nome evento</Label>
            <Input
              value={form.name}
              onChange={e => patch({ name: e.target.value })}
              placeholder={`Es. ${spec.label} 2026`}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Descrizione (facoltativa)</Label>
            <Textarea
              value={form.description}
              onChange={e => patch({ description: e.target.value })}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Finestra temporale */}
          {alwaysOnEnabled && (
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Infinity className="h-3.5 w-3.5 text-muted-foreground" />
                  Finestra permanente
                </p>
                <p className="text-xs text-muted-foreground">Mercato sempre attivo in stagione (no scadenza)</p>
              </div>
              <Switch checked={form.alwaysOn} onCheckedChange={handleAlwaysOnToggle} />
            </div>
          )}

          {!form.alwaysOn && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Apertura</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={e => patch({ starts_at: e.target.value })}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Chiusura</Label>
                <Input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={e => patch({ ends_at: e.target.value })}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}

          {/* Parametri tipo-specifici */}
          {type === "auction" && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Modalità asta</Label>
              <Select value={form.auctionMode} onValueChange={v => patch({ auctionMode: v as AuctionMode })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="async">Asincrona (offerte entro scadenza)</SelectItem>
                  <SelectItem value="live">Live (battitore in tempo reale)</SelectItem>
                  <SelectItem value="blind">A buste (un'offerta, reveal finale)</SelectItem>
                  <SelectItem value="token">A gettone (budget separato)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "trade" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Include crediti</p>
                  <p className="text-xs text-muted-foreground">I manager possono allegare FM allo scambio</p>
                </div>
                <Switch checked={form.includeCredits} onCheckedChange={v => patch({ includeCredits: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Richiede approvazione admin</p>
                  <p className="text-xs text-muted-foreground">Ogni scambio passa per convalida manuale</p>
                </div>
                <Switch checked={form.requiresApproval} onCheckedChange={v => patch({ requiresApproval: v })} />
              </div>
            </div>
          )}

          {type === "release" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Modalità svincolo</Label>
                <Select value={form.releaseMode} onValueChange={v => patch({ releaseMode: v as "open" | "blind" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aperto (tutti vedono i rilasci)</SelectItem>
                    <SelectItem value="blind">Al buio (rilasci rivelati a fine finestra)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Recupero crediti (% del valore di acquisto)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.recoveryPercentage}
                    onChange={e => patch({ recoveryPercentage: Number(e.target.value) })}
                    className="font-mono w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          )}

          {type === "free_agent" && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Periodo attesa (ore prima dell'assegnazione)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={168}
                  value={form.waitingPeriodHours}
                  onChange={e => patch({ waitingPeriodHours: Number(e.target.value) })}
                  className="font-mono w-24"
                />
                <span className="text-sm text-muted-foreground">ore</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button
            onClick={() => onSave(form)}
            disabled={!form.name.trim() || isSaving}
          >
            {isSaving ? "Salvataggio..." : mode === "create" ? "Crea evento" : "Salva modifiche"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Riga evento ──────────────────────────────────────────────────────────────

interface EventRowProps {
  event: MarketEvent;
  onEdit: (ev: MarketEvent) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programmato",
  active: "Attivo",
  completed: "Concluso",
  cancelled: "Annullato",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  scheduled: "outline",
  active: "default",
  completed: "secondary",
  cancelled: "secondary",
};

function formatWindow(ev: MarketEvent) {
  const s = new Date(ev.starts_at);
  const e = new Date(ev.ends_at);
  if (e.getFullYear() >= 2099) return "Finestra permanente";
  const fmt = (d: Date) =>
    d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${fmt(s)} → ${fmt(e)}`;
}

function EventRow({ event, onEdit, onDelete, isDeleting }: EventRowProps) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:border-primary/30 transition-colors group">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm truncate">{event.name}</span>
          <Badge
            variant={STATUS_VARIANTS[event.status] ?? "outline"}
            className="text-[10px] shrink-0"
          >
            {STATUS_LABELS[event.status] ?? event.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <CalendarRange className="h-3 w-3" />
          {formatWindow(event)}
        </div>
        {event.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3 shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(event)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(event.id)}
          disabled={isDeleting}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Sezione tipo ─────────────────────────────────────────────────────────────

interface TypeSectionProps {
  type: MarketType;
  isEnabled: boolean;
  events: MarketEvent[];
  alwaysOnEnabled: boolean;
  onCreateSave: (type: MarketType, form: FormState) => void;
  onEditSave: (id: string, form: FormState) => void;
  onDelete: (id: string) => void;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

function TypeSection({
  type, isEnabled, events, alwaysOnEnabled,
  onCreateSave, onEditSave, onDelete,
  isCreating, isUpdating, isDeleting,
}: TypeSectionProps) {
  const spec = TYPE_SPECS[type];
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MarketEvent | null>(null);

  return (
    <div className={`border rounded-lg overflow-hidden ${!isEnabled ? "opacity-60" : ""}`}>
      {/* Header sezione */}
      <div className="flex items-start justify-between px-4 py-3 bg-muted/30 border-b">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{spec.label}</h3>
            {spec.flag === null && (
              <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">
                Sempre disponibile
              </Badge>
            )}
            {!isEnabled && spec.flag !== null && (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{spec.sublabel}</p>
        </div>
        {isEnabled && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-primary/20 text-primary shrink-0 h-7 text-xs"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3 w-3" /> Aggiungi
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {!isEnabled ? (
          /* Tipo non disponibile */
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <div>
              <p className="font-medium text-foreground/70">Tipo non abilitato dal regolamento federazione</p>
              <p className="text-xs mt-0.5">
                Il flag <span className="font-mono text-xs bg-muted px-1 rounded">{spec.flagLabel}</span> è disattivato
                nella configurazione della federazione. Per rendere disponibile questo tipo di mercato, abilitarlo nel
                pannello Regolamento federazione.
              </p>
              <p className="text-xs mt-1 italic text-muted-foreground/70">
                La lega non può abilitare un tipo di mercato vietato dalla federazione.
              </p>
            </div>
          </div>
        ) : events.length === 0 ? (
          /* Empty state con CTA */
          <div className="flex items-center justify-between py-1">
            <p className="text-sm text-muted-foreground">{spec.description}</p>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-muted-foreground text-xs shrink-0 ml-3"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3 w-3" /> Crea il primo
            </Button>
          </div>
        ) : (
          /* Lista eventi */
          <div className="space-y-2">
            {events.map(ev => (
              <EventRow
                key={ev.id}
                event={ev}
                onEdit={target => setEditTarget(target)}
                onDelete={onDelete}
                isDeleting={isDeleting}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog creazione */}
      {createOpen && (
        <EventDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          type={type}
          initial={defaultForm()}
          onSave={form => {
            onCreateSave(type, form);
            setCreateOpen(false);
          }}
          isSaving={isCreating}
          alwaysOnEnabled={alwaysOnEnabled}
          mode="create"
        />
      )}

      {/* Dialog modifica */}
      {editTarget && (
        <EventDialog
          open={!!editTarget}
          onOpenChange={v => { if (!v) setEditTarget(null); }}
          type={type}
          initial={formFromEvent(editTarget)}
          onSave={form => {
            onEditSave(editTarget.id, form);
            setEditTarget(null);
          }}
          isSaving={isUpdating}
          alwaysOnEnabled={alwaysOnEnabled}
          mode="edit"
        />
      )}
    </div>
  );
}

// ── Componente principale ────────────────────────────────────────────────────

export function MarketEditor({ leagueId, federationFlags, alwaysOnEnabled }: MarketEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: markets = [], isLoading } = useGetLeagueMarkets(leagueId, {
    query: { queryKey: getGetLeagueMarketsQueryKey(leagueId) },
  });

  const createMutation = useCreateMarketEvent();
  const updateMutation = useUpdateMarketEvent();
  const deleteMutation = useDeleteMarketEvent();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getGetLeagueMarketsQueryKey(leagueId) });

  const isEnabled = (type: MarketType): boolean => {
    const flag = TYPE_SPECS[type].flag;
    if (flag === null) return true;
    return Boolean(federationFlags[flag]);
  };

  const eventsOf = (type: MarketType) => markets.filter(m => m.type === type);

  const handleCreate = (type: MarketType, form: FormState) => {
    const startsAt = form.alwaysOn ? "1970-01-01T00:00:00Z" : new Date(form.starts_at).toISOString();
    const endsAt = form.alwaysOn ? "2099-12-31T23:59:59Z" : new Date(form.ends_at).toISOString();

    createMutation.mutate(
      {
        leagueId,
        data: {
          name: form.name,
          description: form.description || undefined,
          type,
          window_starts_at: startsAt,
          window_ends_at: endsAt,
          settings: buildConfig(type, form) as Record<string, unknown>,
          label_color: "#1f4733",
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Evento creato" });
          invalidate();
        },
        onError: () => toast({ title: "Errore nella creazione", variant: "destructive" }),
      }
    );
  };

  const handleEdit = (id: string, form: FormState) => {
    const ev = markets.find(m => m.id === id);
    if (!ev) return;
    const startsAt = form.alwaysOn ? "1970-01-01T00:00:00Z" : new Date(form.starts_at).toISOString();
    const endsAt = form.alwaysOn ? "2099-12-31T23:59:59Z" : new Date(form.ends_at).toISOString();

    updateMutation.mutate(
      {
        leagueId,
        id,
        data: {
          name: form.name,
          description: form.description || undefined,
          window_starts_at: startsAt,
          window_ends_at: endsAt,
          settings: buildConfig(ev.type as MarketType, form) as Record<string, unknown>,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Evento aggiornato" });
          invalidate();
        },
        onError: () => toast({ title: "Errore nel salvataggio", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(
      { leagueId, id },
      {
        onSuccess: () => {
          toast({ title: "Evento eliminato" });
          invalidate();
        },
        onError: () => toast({ title: "Errore nell'eliminazione", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {TYPE_ORDER.map(type => (
        <TypeSection
          key={type}
          type={type}
          isEnabled={isEnabled(type)}
          events={eventsOf(type)}
          alwaysOnEnabled={alwaysOnEnabled}
          onCreateSave={handleCreate}
          onEditSave={handleEdit}
          onDelete={handleDelete}
          isCreating={createMutation.isPending}
          isUpdating={updateMutation.isPending}
          isDeleting={deleteMutation.isPending}
        />
      ))}
    </div>
  );
}
