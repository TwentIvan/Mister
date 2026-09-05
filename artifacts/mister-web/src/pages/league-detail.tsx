import { 
  useGetLeague, getGetLeagueQueryKey,
  useGetLeagueStats, getGetLeagueStatsQueryKey,
  useListCompetitions, getListCompetitionsQueryKey,
  useListFantaTeams, getListFantaTeamsQueryKey,
  useCreateAuction,
  useCreateCompetition,
  useGetLeagueInvite, getGetLeagueInviteQueryKey,
} from "@workspace/api-client-react";
import { useCurrentUser } from "@/contexts/AuthContext";
import { isDevSuperadmin } from "@/lib/dev-superadmin";
import { useEconomyConfig } from "@/lib/economy-api";
import { useState, useMemo } from "react";
import { AstaConfigModal } from "@/components/asta/AstaConfigModal";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Trophy, Users, Calendar, Activity, BookOpen, Gavel, ArrowLeft, Settings, Plus, Copy, Link2, Wallet } from "lucide-react";

export default function LeagueDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: economyConfig } = useEconomyConfig(id!);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createAuction = useCreateAuction();
  const createComp = useCreateCompetition();
  const [astaError, setAstaError] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isCompOpen, setIsCompOpen] = useState(false);
  const [newCompName, setNewCompName] = useState("");
  const [newCompType, setNewCompType] = useState("campionato");
  const [newCompSeason, setNewCompSeason] = useState(new Date().getFullYear());
  const [newCompStart, setNewCompStart] = useState(1);
  const [newCompEnd, setNewCompEnd] = useState(38);

  const handleAvviaAsta = async (
    timerSeconds: number,
    teamNames: Record<string, string>,
    rosterP: number,
    rosterD: number,
    rosterC: number,
    rosterA: number,
    callMode: "listone" | "chiamata" = "listone",
    roleOrder: boolean = false,
  ) => {
    if (!id) return;
    setAstaError(null);
    setIsConfigOpen(false);
    try {
      const result = await createAuction.mutateAsync({
        data: {
          league_id: id,
          timer_seconds: timerSeconds,
          team_names: teamNames,
          roster_p: rosterP,
          roster_d: rosterD,
          roster_c: rosterC,
          roster_a: rosterA,
          call_mode: callMode,
          role_order: roleOrder,
        },
      });
      navigate(`/asta/${result.auction.id}`);
    } catch (err: unknown) {
      const e = err as { data?: { existing_auction_id?: string; error?: unknown }; status?: number };
      if (e?.data?.existing_auction_id) {
        navigate(`/asta/${e.data.existing_auction_id}`);
        return;
      }
      const msg =
        typeof e?.data?.error === "string" ? e.data.error
        : e?.data?.error ? "Dati non validi: controlla la configurazione dell'asta."
        : e?.status ? `Errore server (${e.status}).`
        : "Server non raggiungibile: verifica che l'API sia avviata.";
      setAstaError(msg);
    }
  };

  const handleCreateComp = async () => {
    if (!id || !newCompName.trim()) return;
    try {
      const result = await createComp.mutateAsync({
        leagueId: id,
        data: {
          name: newCompName.trim(),
          type: newCompType as "campionato" | "coppa" | "battle_royale" | "sprint_race" | "formula_uno" | "punteggio_assoluto",
          season: newCompSeason,
          start_giornata: newCompStart,
          end_giornata: newCompEnd,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListCompetitionsQueryKey(id) });
      setIsCompOpen(false);
      setNewCompName("");
      toast({ title: "Competizione creata" });
      navigate(`/leagues/${id}/competitions/${result.id}`);
    } catch {
      toast({ variant: "destructive", title: "Creazione fallita" });
    }
  };

  const { data: league, isLoading: isLoadingLeague } = useGetLeague(
    id,
    { query: { enabled: !!id, queryKey: getGetLeagueQueryKey(id) } }
  );

  const { data: stats } = useGetLeagueStats(
    id,
    { query: { enabled: !!id, queryKey: getGetLeagueStatsQueryKey(id) } }
  );

  const { data: teams, isLoading: isLoadingTeams } = useListFantaTeams(
    id,
    { query: { enabled: !!id, queryKey: getListFantaTeamsQueryKey(id) } }
  );

  const { data: competitions, isLoading: isLoadingComps } = useListCompetitions(
    id,
    { query: { enabled: !!id, queryKey: getListCompetitionsQueryKey(id) } }
  );

  const { user } = useCurrentUser();
  // ⚠️ TEMPORANEO: isDevSuperadmin — vedi lib/dev-superadmin.ts e TECH_DEBT.md
  const isAdmin = !!league && !!user && (league.admin_user_id === user.id || isDevSuperadmin(user.email));

  const { data: inviteInfo } = useGetLeagueInvite(
    id!,
    { query: { enabled: isAdmin, queryKey: getGetLeagueInviteQueryKey(id!) } }
  );

  const modalTeams = useMemo(
    () => (teams ?? []).map((t) => ({ id: t.id, name: t.name ?? "", name_auction: t.name_auction })),
    [teams],
  );

  if (isLoadingLeague) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!league) {
    return <div className="text-destructive">Lega non trovata</div>;
  }

  const isReadyForAuction = !league.started && (stats?.team_count ?? 0) >= 4;

  return (
    <>
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <Badge variant="outline" className="font-mono text-primary border-primary/20 bg-primary/5">
              Stagione {league.season}
            </Badge>
            {league.started ? (
              <Badge variant="default">In corso</Badge>
            ) : isReadyForAuction ? (
              <Badge className="bg-[#1f4733] text-[#efe6d3] border-0">Pronta per l'asta</Badge>
            ) : (
              <Badge variant="secondary">Iscrizioni</Badge>
            )}
            <Badge variant="outline" className="capitalize">{league.visibility}</Badge>
            {league.auction_mode && (
              <Badge variant="outline" className="capitalize">{league.auction_mode}</Badge>
            )}
          </div>
          <h1 className="text-4xl font-bold font-serif text-primary tracking-tight" data-testid="text-league-name">
            {league.name}
          </h1>
          {league.budget_initial != null && (
            <p className="text-sm text-muted-foreground mt-1 font-mono">
              {league.budget_initial} FM · {league.timer_seconds}s timer ·{" "}
              {league.roster_p}P {league.roster_d}D {league.roster_c}C {league.roster_a}A
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/leagues">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              Tutte le leghe
            </Button>
          </Link>
          {economyConfig?.realMoneyEnabled && (
            <Link href={`/leagues/${league.id}/cassa`}>
              <Button variant="outline" className="gap-2 border-primary/20 text-primary">
                <Wallet className="h-4 w-4" />
                Cassa
              </Button>
            </Link>
          )}
          {(user?.id === league.admin_user_id || (league.co_admin_user_ids ?? []).includes(user?.id ?? "") || isDevSuperadmin(user?.email)) && (
            <>
              <Link href={`/leagues/${league.id}/config`}>
                <Button variant="outline" className="gap-2 border-primary/20 text-primary">
                  <Settings className="h-4 w-4" />
                  Configurazione
                </Button>
              </Link>
              <Link href={`/leagues/${league.id}/federation`}>
                <Button variant="outline" className="gap-2 border-primary/20 text-primary">
                  <BookOpen className="h-4 w-4" />
                  Regolamento
                </Button>
              </Link>
            </>
          )}
          {isReadyForAuction ? (
            <Button
              className="gap-2 bg-[#1f4733] text-[#efe6d3] hover:bg-[#1f4733]/90"
              onClick={() => setIsConfigOpen(true)}
              disabled={createAuction.isPending}
            >
              <Gavel className="h-4 w-4" />
              {createAuction.isPending ? "Avvio in corso..." : "Avvia asta"}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    disabled
                    className="gap-2 bg-[#1f4733] text-[#efe6d3] opacity-40 cursor-not-allowed"
                  >
                    <Gavel className="h-4 w-4" />
                    Avvia asta
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Servono almeno 4 squadre</TooltipContent>
            </Tooltip>
          )}
          {astaError && (
            <p className="text-destructive text-sm mt-1">{astaError}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Manager</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {stats?.team_count ?? 0} / {league.max_managers}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Competizioni</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {stats?.competition_count ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contratti attivi</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {stats?.contract_count ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card
          className="bg-card border-primary/20 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate(`/leagues/${id}/markets`)}
        >
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-primary">Mercati attivi</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-primary">
              {stats?.active_market_count ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-1 lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Squadre iscritte</CardTitle>
              <CardDescription>Manager partecipanti, nome asta e crediti residui</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Squadra</TableHead>
                    <TableHead>Asta</TableHead>
                    <TableHead>Colori</TableHead>
                    <TableHead className="text-right">Crediti</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTeams ? (
                    <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ) : teams?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                        Nessuna squadra registrata.{" "}
                        <Link href="/lega/nuova" className="text-primary underline underline-offset-2">
                          Crea una lega con squadre
                        </Link>
                      </TableCell>
                    </TableRow>
                  ) : teams?.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">
                        {team.name_auction ?? "—"}
                      </TableCell>
                      <TableCell>
                        {(team.color_primary || team.color_secondary) ? (
                          <div className="flex gap-1">
                            {team.color_primary && (
                              <div
                                className="w-4 h-4 rounded-full ring-1 ring-border"
                                style={{ backgroundColor: team.color_primary }}
                                title={team.color_primary}
                              />
                            )}
                            {team.color_secondary && (
                              <div
                                className="w-4 h-4 rounded-full ring-1 ring-border"
                                style={{ backgroundColor: team.color_secondary }}
                                title={team.color_secondary}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">{team.credits_remaining}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1 space-y-8">
          {league.budget_initial != null && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Configurazione asta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Budget</span>
                  <span className="font-mono font-bold">{league.budget_initial} FM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timer</span>
                  <span className="font-mono">{league.timer_seconds}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rosa</span>
                  <span className="font-mono">
                    {league.roster_p}P {league.roster_d}D {league.roster_c}C {league.roster_a}A
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modalità</span>
                  <span className="capitalize">{league.auction_mode ?? "—"}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Competizioni</CardTitle>
                <CardDescription>Tornei attivi in questa lega</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-primary/20 text-primary shrink-0"
                onClick={() => setIsCompOpen(true)}
                data-testid="button-crea-competizione"
              >
                <Plus className="h-3.5 w-3.5" /> Crea
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {isLoadingComps ? (
                  <Skeleton className="h-16 w-full" />
                ) : competitions?.length === 0 ? (
                  <div className="flex items-center justify-between py-2">
                    <p className="text-sm text-muted-foreground">Nessuna competizione.</p>
                    <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground text-xs" onClick={() => setIsCompOpen(true)}>
                      <Plus className="h-3 w-3" /> Crea la prima
                    </Button>
                  </div>
                ) : competitions?.map((comp) => (
                  <Link key={comp.id} href={`/leagues/${league.id}/competitions/${comp.id}`}>
                    <div className="p-3 border rounded-lg hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors group">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold group-hover:text-primary transition-colors">{comp.name}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">{comp.type.replace(/_/g, ' ')}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                        <span>Stagione {comp.season}</span>
                        <span>G{comp.start_giornata}–G{comp.end_giornata}</span>
                        {comp.scope_type && comp.scope_type !== "league" && (
                          <Badge variant="outline" className="text-[9px] uppercase">{comp.scope_type}</Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {isAdmin && (
        <div className="space-y-4" data-testid="section-inviti">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-[#1f4733]" />
            <h2 className="text-xl font-serif font-bold text-[#1f4733]">Inviti</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Codice invito</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {inviteInfo?.invitation_code ? (
                  <>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-lg font-bold bg-muted px-3 py-1.5 rounded text-[#1f4733]" data-testid="text-invite-code">
                        {inviteInfo.invitation_code}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(inviteInfo.invitation_code ?? "");
                          toast({ title: "Codice copiato" });
                        }}
                        data-testid="button-copy-invite-code"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    {inviteInfo.invite_link && (
                      <div className="flex items-center gap-2">
                        <p className="flex-1 text-xs text-muted-foreground font-mono truncate" data-testid="text-invite-link">
                          {inviteInfo.invite_link}
                        </p>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(inviteInfo.invite_link ?? "");
                            toast({ title: "Link copiato" });
                          }}
                          data-testid="button-copy-invite-link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Condividi questo codice o il link. Ogni partecipante entra e sceglie uno slot.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Nessun codice invito disponibile.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Stato slot</span>
                  {inviteInfo && (
                    <span className="font-mono text-xs text-muted-foreground font-normal">
                      {inviteInfo.free_slots}/{inviteInfo.total_slots} liberi
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {inviteInfo ? (
                  <div className="space-y-1.5" data-testid="list-slots">
                    {inviteInfo.slots.map((slot) => (
                      <div
                        key={slot.id}
                        className={[
                          "flex items-center justify-between px-2.5 py-2 rounded text-sm border",
                          slot.is_claimed
                            ? "border-border bg-muted/30"
                            : "border-dashed border-border/50 bg-transparent",
                        ].join(" ")}
                        data-testid={`slot-row-${slot.id}`}
                      >
                        <span className={slot.is_claimed ? "font-medium" : "text-muted-foreground text-xs"}>
                          {slot.is_claimed
                            ? (slot.name ?? slot.name_auction ?? "Slot occupato")
                            : "Slot libero"}
                        </span>
                        <Badge
                          variant={slot.is_claimed ? "default" : "outline"}
                          className={slot.is_claimed
                            ? "bg-[#1f4733] text-[#efe6d3] text-[10px]"
                            : "text-[10px]"}
                        >
                          {slot.is_claimed ? "occupato" : "libero"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>

    <AstaConfigModal
      open={isConfigOpen}
      onOpenChange={setIsConfigOpen}
      teams={modalTeams}
      isLoading={createAuction.isPending}
      initialTimer={league?.timer_seconds ?? undefined}
      initialRosterP={league?.roster_p ?? undefined}
      initialRosterD={league?.roster_d ?? undefined}
      initialRosterC={league?.roster_c ?? undefined}
      initialRosterA={league?.roster_a ?? undefined}
      onConfirm={handleAvviaAsta}
    />

    <Dialog open={isCompOpen} onOpenChange={setIsCompOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Nuova competizione</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Nome</Label>
            <Input
              value={newCompName}
              onChange={e => setNewCompName(e.target.value)}
              placeholder="Es. Campionato 2025-26"
              data-testid="input-new-comp-name"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Formato</Label>
            <Select value={newCompType} onValueChange={setNewCompType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="campionato">Campionato (girone all'italiana)</SelectItem>
                <SelectItem value="coppa">Coppa (eliminazione diretta)</SelectItem>
                <SelectItem value="battle_royale">Battle Royale (tutti contro tutti)</SelectItem>
                <SelectItem value="sprint_race">Sprint Race (eliminazione giornaliera)</SelectItem>
                <SelectItem value="formula_uno">Formula 1 (punteggio F1)</SelectItem>
                <SelectItem value="punteggio_assoluto">Punteggio Assoluto (somma cumulativa)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Stagione</Label>
              <Input
                type="number"
                value={newCompSeason}
                onChange={e => setNewCompSeason(Number(e.target.value))}
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">G. inizio</Label>
              <Input
                type="number"
                min={1} max={38}
                value={newCompStart}
                onChange={e => setNewCompStart(Number(e.target.value))}
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">G. fine</Label>
              <Input
                type="number"
                min={1} max={38}
                value={newCompEnd}
                onChange={e => setNewCompEnd(Number(e.target.value))}
                className="font-mono"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Nome e formato non sono modificabili dopo la creazione. Le altre impostazioni si configurano nell'editor.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsCompOpen(false)}>Annulla</Button>
          <Button
            onClick={handleCreateComp}
            disabled={!newCompName.trim() || createComp.isPending}
            data-testid="button-confirm-new-comp"
          >
            {createComp.isPending ? "Creazione..." : "Crea e configura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
