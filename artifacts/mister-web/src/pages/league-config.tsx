import { useState, useMemo, useCallback } from "react";
import { useParams, Link } from "wouter";
import {
  useGetLeague, getGetLeagueQueryKey,
  useUpdateLeague,
  useListFantaTeams, getListFantaTeamsQueryKey,
  useUpdateFantaTeam,
} from "@workspace/api-client-react";
import type { FantaTeam, LeagueUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListListoni, useResetLeagueRosters } from "@workspace/api-client-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Settings, Users, Eye, Bell, Clock, Gavel, Shield,
  Save, ArrowLeft, AlertTriangle, Lock, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── UTILS ────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (j === 0 ? i : 0)),
  );
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function NumberField({
  label, value, onChange, min, max, step = 1, locked = false,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; locked?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
        {locked && <Lock className="h-3 w-3 text-muted-foreground/60" />}
        {label}
      </Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={locked}
        onChange={e => {
          const v = Number(e.target.value);
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className="font-mono text-right"
      />
    </div>
  );
}

// ─── TEAM EDIT CARD ───────────────────────────────────────────

interface TeamEditCardProps {
  team: FantaTeam;
  allAuctionNames: string[];
  leagueId: string;
  onSaved: () => void;
}

function TeamEditCard({ team, allAuctionNames, leagueId, onSaved }: TeamEditCardProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(team.name ?? "");
  const [nameAuction, setNameAuction] = useState(team.name_auction ?? "");
  const [logoUrl, setLogoUrl] = useState(team.logo_url ?? "");
  const [colorPrimary, setColorPrimary] = useState(team.color_primary ?? "#1f4733");
  const [colorSecondary, setColorSecondary] = useState(team.color_secondary ?? "#efe6d3");
  const [coachName, setCoachName] = useState(team.coach_name ?? "");
  const { toast } = useToast();
  const updateTeam = useUpdateFantaTeam();

  const otherAuctionNames = allAuctionNames.filter(n => n !== team.name_auction);
  const similarNames = useMemo(
    () =>
      otherAuctionNames.filter(
        other =>
          other &&
          nameAuction &&
          levenshtein(nameAuction.toLowerCase(), other.toLowerCase()) <= 2 &&
          nameAuction.toLowerCase() !== other.toLowerCase(),
      ),
    [nameAuction, otherAuctionNames],
  );

  const handleSave = () => {
    updateTeam.mutate(
      {
        leagueId,
        id: team.id,
        data: {
          name: name || undefined,
          name_auction: nameAuction || undefined,
          logo_url: logoUrl || null,
          color_primary: colorPrimary || undefined,
          color_secondary: colorSecondary || undefined,
          coach_name: coachName || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: `Squadra "${name}" aggiornata` });
          onSaved();
          setOpen(false);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Aggiornamento squadra fallito" });
        },
      },
    );
  };

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div
              className="w-5 h-5 rounded-full ring-1 ring-border"
              style={{ backgroundColor: team.color_primary ?? "#1f4733" }}
            />
            <div
              className="w-5 h-5 rounded-full ring-1 ring-border"
              style={{ backgroundColor: team.color_secondary ?? "#efe6d3" }}
            />
          </div>
          <div>
            <p className="font-medium text-sm">{team.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{team.name_auction ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">{team.credits_remaining} FM</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {open && (
        <CardContent className="pt-0 pb-4 border-t space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome squadra</Label>
              <Input value={name} onChange={e => setName(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome in asta (voce battitore)</Label>
              <Input
                value={nameAuction}
                onChange={e => setNameAuction(e.target.value)}
                maxLength={30}
                className={similarNames.length > 0 ? "border-amber-400 focus-visible:ring-amber-400" : ""}
                data-testid={`input-auction-name-${team.id}`}
              />
              {similarNames.length > 0 && (
                <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <p className="text-xs">
                    Nome simile a: <span className="font-medium">{similarNames.join(", ")}</span>.
                    Differenziali per evitare ambiguità in asta.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">URL logo (opzionale)</Label>
              <Input
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                placeholder="https://..."
                type="url"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Allenatore (opzionale)</Label>
              <Input
                value={coachName}
                onChange={e => setCoachName(e.target.value)}
                maxLength={60}
                placeholder="Nome allenatore"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Colori maglia</Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorPrimary}
                  onChange={e => setColorPrimary(e.target.value)}
                  className="h-8 w-10 rounded cursor-pointer border border-border bg-transparent"
                  title="Colore primario"
                />
                <span className="text-xs font-mono text-muted-foreground">Primario</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorSecondary}
                  onChange={e => setColorSecondary(e.target.value)}
                  className="h-8 w-10 rounded cursor-pointer border border-border bg-transparent"
                  title="Colore secondario"
                />
                <span className="text-xs font-mono text-muted-foreground">Secondario</span>
              </div>
              <div
                className="h-8 w-16 rounded ring-1 ring-border flex-shrink-0"
                style={{
                  background: `linear-gradient(to right, ${colorPrimary} 50%, ${colorSecondary} 50%)`,
                }}
                title="Anteprima"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={handleSave} disabled={updateTeam.isPending}>
              {updateTeam.isPending ? "Salvataggio..." : "Salva squadra"}
              <Save className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────

export default function LeagueConfig() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: league, isLoading: isLoadingLeague } = useGetLeague(
    id,
    { query: { enabled: !!id, queryKey: getGetLeagueQueryKey(id) } },
  );
  const { data: teams, isLoading: isLoadingTeams } = useListFantaTeams(
    id,
    { query: { enabled: !!id, queryKey: getListFantaTeamsQueryKey(id) } },
  );
  const updateLeague = useUpdateLeague();

  // Form state — inizializzato da league
  const [formData, setFormData] = useState<LeagueUpdate>({});
  const [initialized, setInitialized] = useState(false);
  const [guardError, setGuardError] = useState<string | null>(null);

  const patch = useCallback(<K extends keyof LeagueUpdate>(key: K, value: LeagueUpdate[K]) => {
    setFormData(f => ({ ...f, [key]: value }));
    setGuardError(null);
  }, []);

  // Inizializza dal modello (una sola volta)
  if (!initialized && league) {
    setFormData({
      name: league.name,
      max_managers: league.max_managers,
      visibility: league.visibility as LeagueUpdate["visibility"],
      lineup_visibility: league.lineup_visibility as LeagueUpdate["lineup_visibility"],
      roster_visibility: league.roster_visibility as LeagueUpdate["roster_visibility"],
      notify_email: league.notify_email,
      notify_push: league.notify_push,
      timer_seconds: league.timer_seconds,
      budget_initial: league.budget_initial ?? undefined,
      roster_p: league.roster_p ?? undefined,
      roster_d: league.roster_d ?? undefined,
      roster_c: league.roster_c ?? undefined,
      roster_a: league.roster_a ?? undefined,
      auction_mode: (league.auction_mode as LeagueUpdate["auction_mode"]) ?? undefined,
      // price_source_listone_id NON inizializzato: entra nel PATCH solo se
      // l'utente cambia il selettore, altrimenti ogni save diventerebbe 'guarded'
      price_source_listone_id: undefined,
      post_acquisition_window: league.post_acquisition_window
        ? {
            enabled: league.post_acquisition_window.enabled,
            async_hours: league.post_acquisition_window.async_hours,
            live_seconds: league.post_acquisition_window.live_seconds,
            default_clause_action: league.post_acquisition_window.default_clause_action as
              | "leave_default"
              | "trigger_clause"
              | "no_clause",
            default_contract_years: league.post_acquisition_window.default_contract_years,
          }
        : undefined,
    });
    setInitialized(true);
  }

  const handleSaveLeague = () => {
    if (!id) return;
    setGuardError(null);
    updateLeague.mutate(
      { id, data: formData },
      {
        onSuccess: updated => {
          toast({ title: "Configurazione lega aggiornata" });
          queryClient.setQueryData(getGetLeagueQueryKey(id), updated);
        },
        onError: (err: unknown) => {
          const body = (err as { data?: { error?: string } })?.data;
          if (body?.error?.includes("asta è in corso")) {
            setGuardError(body.error);
          } else {
            toast({ variant: "destructive", title: "Aggiornamento fallito" });
          }
        },
      },
    );
  };

  const allAuctionNames = useMemo(
    () => (teams ?? []).map(t => t.name_auction ?? ""),
    [teams],
  );

  const handleTeamSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListFantaTeamsQueryKey(id) });
  }, [id, queryClient]);

  if (isLoadingLeague) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  if (!league) {
    return <div className="text-destructive">Lega non trovata</div>;
  }

  const hasSnapshotLocked = !!league.snapshot_locked_at;
  const paw = formData.post_acquisition_window;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Intestazione */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/leagues/${id}`}>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground -ml-2">
                <ArrowLeft className="h-4 w-4" />
                {league.name}
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold font-serif text-primary flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Configurazione lega
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">{id}</p>
        </div>
        <Badge variant="outline" className="font-mono mt-1">
          Stagione {league.season}
        </Badge>
      </div>

      {/* Guard warning (asta avviata, campi critici potrebbero essere bloccati) */}
      {hasSnapshotLocked && !guardError && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-amber-700 dark:text-amber-500">
            Almeno un'asta è stata avviata per questa lega. Composizione rosa, budget e timer{" "}
            <strong>non possono essere modificati durante un'asta in corso</strong>.
          </p>
        </div>
      )}

      {/* Guard error dall'API */}
      {guardError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
          <Lock className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-destructive">{guardError}</p>
        </div>
      )}

      <Tabs defaultValue="lega">
        <TabsList className="grid grid-cols-2 w-[280px]">
          <TabsTrigger value="lega" className="flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Lega
          </TabsTrigger>
          <TabsTrigger value="squadre" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Squadre
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB LEGA ─────────────────────────────────────── */}
        <TabsContent value="lega" className="space-y-6 mt-6">

          {/* Identità */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Identità</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome lega</Label>
                <Input
                  value={formData.name ?? ""}
                  onChange={e => patch("name", e.target.value)}
                  maxLength={50}
                  data-testid="input-config-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Modalità asta</Label>
                <Select
                  value={formData.auction_mode ?? ""}
                  onValueChange={v => patch("auction_mode", v as LeagueUpdate["auction_mode"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona modalità" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classico">Classico</SelectItem>
                    <SelectItem value="manageriale">Manageriale</SelectItem>
                    <SelectItem value="manageriale_pro">Manageriale Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Asta — campi GUARDED */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gavel className="h-4 w-4" /> Parametri asta
                </CardTitle>
                {hasSnapshotLocked && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    bloccati durante asta in corso
                  </div>
                )}
              </div>
              <CardDescription>
                Questi valori diventano parte dello snapshot alla prima asta.
                Non modificabili se un'asta è in corso.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <NumberField
                  label="Budget iniziale (FM)"
                  value={formData.budget_initial ?? 500}
                  onChange={v => patch("budget_initial", v)}
                  min={100} max={2000} step={10}
                  data-testid="input-config-budget"
                />
                <NumberField
                  label="Timer (secondi)"
                  value={formData.timer_seconds ?? 8}
                  onChange={v => patch("timer_seconds", v)}
                  min={3} max={30}
                  data-testid="input-config-timer"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Sorgente prezzi asta</Label>
                <PriceSourceSelect
                  value={formData.price_source_listone_id !== undefined ? formData.price_source_listone_id : (league?.price_source_listone_id ?? null)}
                  onChange={v => patch("price_source_listone_id", v)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Con un listone selezionato, il pool d'asta sono i suoi giocatori matchati e la base d'asta è la quotazione (Qt.A).
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Composizione rosa</Label>
                <div className="grid grid-cols-4 gap-3">
                  <NumberField
                    label="P" value={formData.roster_p ?? 3}
                    onChange={v => patch("roster_p", v)} min={1} max={15}
                  />
                  <NumberField
                    label="D" value={formData.roster_d ?? 8}
                    onChange={v => patch("roster_d", v)} min={1} max={15}
                  />
                  <NumberField
                    label="C" value={formData.roster_c ?? 8}
                    onChange={v => patch("roster_c", v)} min={1} max={15}
                  />
                  <NumberField
                    label="A" value={formData.roster_a ?? 6}
                    onChange={v => patch("roster_a", v)} min={1} max={15}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  Totale:{" "}
                  {(formData.roster_p ?? 0) + (formData.roster_d ?? 0) +
                    (formData.roster_c ?? 0) + (formData.roster_a ?? 0)}{" "}
                  giocatori per squadra
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Accesso */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Accesso
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Visibilità</Label>
                <Select
                  value={formData.visibility ?? "private"}
                  onValueChange={v => patch("visibility", v as LeagueUpdate["visibility"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Privata</SelectItem>
                    <SelectItem value="unlisted">Non elencata</SelectItem>
                    <SelectItem value="public">Pubblica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Max manager</Label>
                <Input
                  type="number"
                  value={formData.max_managers ?? 12}
                  min={2} max={20}
                  onChange={e => patch("max_managers", Number(e.target.value))}
                  className="font-mono text-right"
                />
              </div>
              {league.invitation_code && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Codice invito</Label>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-muted px-3 py-1.5 rounded border flex-1">
                      {league.invitation_code}
                    </code>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => navigator.clipboard.writeText(league.invitation_code!)}
                    >
                      Copia
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visibilità */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" /> Visibilità formazioni e rose
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Visibilità formazioni</Label>
                <Select
                  value={formData.lineup_visibility ?? "always"}
                  onValueChange={v => patch("lineup_visibility", v as LeagueUpdate["lineup_visibility"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">Sempre visibili</SelectItem>
                    <SelectItem value="after_deadline">Dopo la deadline</SelectItem>
                    <SelectItem value="hidden_all_season">Nascoste tutta la stagione</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Visibilità rose</Label>
                <Select
                  value={formData.roster_visibility ?? "always"}
                  onValueChange={v => patch("roster_visibility", v as LeagueUpdate["roster_visibility"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">Sempre visibili</SelectItem>
                    <SelectItem value="after_deadline">Dopo la deadline</SelectItem>
                    <SelectItem value="hidden_all_season">Nascoste tutta la stagione</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notifiche */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" /> Notifiche
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Notifiche email</p>
                  <p className="text-xs text-muted-foreground">Aggiornamenti asta, mercato e giornate</p>
                </div>
                <Switch
                  checked={formData.notify_email ?? true}
                  onCheckedChange={v => patch("notify_email", v)}
                  data-testid="switch-notify-email"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Notifiche push</p>
                  <p className="text-xs text-muted-foreground">Avvisi in tempo reale (app mobile)</p>
                </div>
                <Switch
                  checked={formData.notify_push ?? true}
                  onCheckedChange={v => patch("notify_push", v)}
                  data-testid="switch-notify-push"
                />
              </div>
            </CardContent>
          </Card>

          {/* Finestra post-acquisto */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Finestra post-acquisto
              </CardTitle>
              <CardDescription>
                Periodo entro cui i manager possono reclamare un giocatore dopo l'acquisto in asta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Attiva</p>
                  <p className="text-xs text-muted-foreground">Abilita la finestra di reclamo post-acquisto</p>
                </div>
                <Switch
                  checked={paw?.enabled ?? true}
                  onCheckedChange={v =>
                    patch("post_acquisition_window", { ...paw, enabled: v })
                  }
                />
              </div>
              {(paw?.enabled ?? true) && (
                <div className="grid grid-cols-2 gap-4">
                  <NumberField
                    label="Ore finestra asincrona"
                    value={paw?.async_hours ?? 12}
                    onChange={v => patch("post_acquisition_window", { ...paw, async_hours: v })}
                    min={1} max={72}
                  />
                  <NumberField
                    label="Secondi finestra live"
                    value={paw?.live_seconds ?? 45}
                    onChange={v => patch("post_acquisition_window", { ...paw, live_seconds: v })}
                    min={10} max={120}
                  />
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Azione clausola default</Label>
                    <Select
                      value={paw?.default_clause_action ?? "leave_default"}
                      onValueChange={v =>
                        patch("post_acquisition_window", {
                          ...paw,
                          default_clause_action: v as
                            | "leave_default"
                            | "trigger_clause"
                            | "no_clause",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leave_default">Lascia default</SelectItem>
                        <SelectItem value="trigger_clause">Attiva clausola</SelectItem>
                        <SelectItem value="no_clause">Nessuna clausola</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <NumberField
                    label="Anni contratto default"
                    value={paw?.default_contract_years ?? 1}
                    onChange={v =>
                      patch("post_acquisition_window", { ...paw, default_contract_years: v })
                    }
                    min={1} max={5}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sicurezza */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" /> Federazione
              </CardTitle>
            </CardHeader>
            <CardContent>
              {league.federation_id ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Federazione collegata</p>
                    <p className="font-mono text-sm">{league.federation_id}</p>
                  </div>
                  <Link href={`/leagues/${id}/federation`}>
                    <Button variant="outline" size="sm">Modifica regolamento</Button>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nessuna federazione collegata.</p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveLeague}
              disabled={updateLeague.isPending}
              data-testid="button-save-league-config"
            >
              {updateLeague.isPending ? "Salvataggio..." : "Salva configurazione"}
              <Save className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* ─── ZONA PERICOLOSA (T163) ─────────────────────── */}
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Zona pericolosa</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Azzera rose e budget</p>
                <p className="text-xs text-muted-foreground">
                  Svuota le rose di tutte le squadre, cancella le formazioni e ripristina il budget iniziale
                  ({league.budget_initial ?? 500} FM). Le aste concluse e il loro storico restano.
                </p>
              </div>
              <ResetRosterButton leagueId={id} onDone={handleTeamSaved} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB SQUADRE ──────────────────────────────────── */}
        <TabsContent value="squadre" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Squadre iscritte</h2>
              <p className="text-sm text-muted-foreground">
                Clicca una squadra per modificarne nome, voce asta, colori e allenatore.
              </p>
            </div>
            <Badge variant="outline" className="font-mono">
              {teams?.length ?? 0} / {league.max_managers}
            </Badge>
          </div>

          {isLoadingTeams ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : teams?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nessuna squadra iscritta.{" "}
                <Link href="/lega/nuova" className="text-primary underline underline-offset-2">
                  Crea una lega con squadre
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {teams?.map(team => (
                <TeamEditCard
                  key={team.id}
                  team={team}
                  allAuctionNames={allAuctionNames}
                  leagueId={id}
                  onSaved={handleTeamSaved}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}


// ─── Sorgente prezzi asta (T151): anagrafica o listone importato ──────────────

function PriceSourceSelect({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const { data, isLoading } = useListListoni();
  const items = data?.items ?? [];
  return (
    <Select
      value={value === null ? "anagrafica" : String(value)}
      onValueChange={v => onChange(v === "anagrafica" ? null : Number(v))}
      disabled={isLoading}
    >
      <SelectTrigger data-testid="select-price-source">
        <SelectValue placeholder="Anagrafica completa" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="anagrafica">Anagrafica completa (storico)</SelectItem>
        {items.map(l => (
          <SelectItem key={l.id} value={String(l.id)}>
            {l.label} — {l.season} ({l.report.total - l.report.none} matchati)
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


// ─── Reset rose e budget (T163): azione distruttiva con conferma ─────────────

function ResetRosterButton({ leagueId, onDone }: { leagueId: string; onDone: () => void }) {
  const { toast } = useToast();
  const reset = useResetLeagueRosters();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={reset.isPending} data-testid="button-reset-rosters">
          {reset.isPending ? "Azzeramento…" : "Azzera rose e budget"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Azzerare rose e budget?</AlertDialogTitle>
          <AlertDialogDescription>
            Questa azione svuota le rose di TUTTE le squadre della lega, cancella le formazioni
            e ripristina i budget iniziali. Non si può annullare. Le aste già concluse e le loro
            assegnazioni restano nello storico.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              reset.mutate(
                { id: leagueId },
                {
                  onSuccess: r => {
                    toast({
                      title: "Rose azzerate",
                      description: `${r.contracts_deleted} contratti e ${r.lineups_deleted} formazioni rimossi, ${r.teams_reset} squadre a ${r.budget_restored} FM`,
                    });
                    onDone();
                  },
                  onError: (e: unknown) => {
                    const msg = (e as { data?: { error?: string } })?.data?.error ?? "Reset fallito";
                    toast({ title: "Errore", description: msg, variant: "destructive" });
                  },
                },
              );
            }}
          >
            Sì, azzera tutto
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
