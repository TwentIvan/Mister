import { 
  useGetLeague, getGetLeagueQueryKey,
  useGetLeagueStats, getGetLeagueStatsQueryKey,
  useListCompetitions, getListCompetitionsQueryKey,
  useListFantaTeams, getListFantaTeamsQueryKey,
  useCreateAuction,
} from "@workspace/api-client-react";
import { useState, useMemo } from "react";
import { AstaConfigModal } from "@/components/asta/AstaConfigModal";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Trophy, Users, Calendar, Activity, BookOpen, Gavel, ArrowLeft } from "lucide-react";

export default function LeagueDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const createAuction = useCreateAuction();
  const [astaError, setAstaError] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

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
      const body = (err as { data?: { existing_auction_id?: string; error?: string } })?.data;
      if (body?.existing_auction_id) {
        navigate(`/asta/${body.existing_auction_id}`);
        return;
      }
      setAstaError(body?.error ?? "Impossibile avviare l'asta.");
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

  const modalTeams = useMemo(
    () => (teams ?? []).map((t) => ({ id: t.id, name: t.name, name_auction: t.name_auction })),
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
          {league.admin_user_id === "demo-user" && (
            <Link href={`/leagues/${league.id}/federation`}>
              <Button variant="outline" className="gap-2 border-primary/20 text-primary">
                <BookOpen className="h-4 w-4" />
                Regolamento
              </Button>
            </Link>
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

        <Card className="bg-card border-primary/20">
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Competizioni</CardTitle>
                <CardDescription>Tornei attivi</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoadingComps ? (
                  <Skeleton className="h-16 w-full" />
                ) : competitions?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessuna competizione creata.</p>
                ) : competitions?.map((comp) => (
                  <Link key={comp.id} href={`/leagues/${league.id}/competitions/${comp.id}`}>
                    <div className="p-3 border rounded-lg hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors group">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold group-hover:text-primary transition-colors">{comp.name}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">{comp.type.replace(/_/g, ' ')}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Giornate {comp.start_giornata}–{comp.end_giornata}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

    <AstaConfigModal
      open={isConfigOpen}
      onOpenChange={setIsConfigOpen}
      teams={modalTeams}
      isLoading={createAuction.isPending}
      onConfirm={handleAvviaAsta}
    />
    </>
  );
}
