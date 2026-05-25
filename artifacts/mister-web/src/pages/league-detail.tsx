import { 
  useGetLeague, getGetLeagueQueryKey,
  useGetLeagueStats, getGetLeagueStatsQueryKey,
  useListCompetitions, getListCompetitionsQueryKey,
  useGetLeagueMarkets, getGetLeagueMarketsQueryKey,
  useListFantaTeams, getListFantaTeamsQueryKey
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Shield, Trophy, Users, Calendar, Activity, BookOpen } from "lucide-react";

export default function LeagueDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: league, isLoading: isLoadingLeague } = useGetLeague(
    id,
    { query: { enabled: !!id, queryKey: getGetLeagueQueryKey(id) } }
  );

  const { data: stats, isLoading: isLoadingStats } = useGetLeagueStats(
    id,
    { query: { enabled: !!id, queryKey: getGetLeagueStatsQueryKey(id) } }
  );

  const { data: teams, isLoading: isLoadingTeams } = useListFantaTeams(
    { league_id: id },
    { query: { enabled: !!id, queryKey: getListFantaTeamsQueryKey({ league_id: id }) } }
  );

  const { data: competitions, isLoading: isLoadingComps } = useListCompetitions(
    { league_id: id },
    { query: { enabled: !!id, queryKey: getListCompetitionsQueryKey({ league_id: id }) } }
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
    return <div className="text-destructive">League not found</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="font-mono text-primary border-primary/20 bg-primary/5">
              Season {league.season}
            </Badge>
            <Badge variant={league.started ? "default" : "secondary"}>
              {league.started ? "Active" : "Registration"}
            </Badge>
            <Badge variant="outline" className="capitalize">{league.visibility}</Badge>
          </div>
          <h1 className="text-4xl font-bold font-serif text-primary tracking-tight" data-testid="text-league-name">
            {league.name}
          </h1>
        </div>
        <div className="flex gap-2">
          {league.admin_user_id === "demo-user" && (
            <Link href={`/leagues/${league.id}/federation`}>
              <Button variant="outline" className="gap-2 border-primary/20 text-primary">
                <BookOpen className="h-4 w-4" />
                Federation Rules
              </Button>
            </Link>
          )}
          <Button className="gap-2">
            <Trophy className="h-4 w-4" />
            My Team
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Managers</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Competitions</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Contracts</CardTitle>
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
            <CardTitle className="text-sm font-medium text-primary">Active Markets</CardTitle>
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
              <CardTitle>Roster Squadre</CardTitle>
              <CardDescription>All participating managers and their teams</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTeams ? (
                    <TableRow><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ) : teams?.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No teams registered yet.</TableCell></TableRow>
                  ) : teams?.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">{team.manager_user_id}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{team.credits_remaining}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1 space-y-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Competitions</CardTitle>
                <CardDescription>Active tournaments</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoadingComps ? (
                  <Skeleton className="h-16 w-full" />
                ) : competitions?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No competitions created.</p>
                ) : competitions?.map((comp) => (
                  <Link key={comp.id} href={`/leagues/${league.id}/competitions/${comp.id}`}>
                    <div className="p-3 border rounded-lg hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors group">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold group-hover:text-primary transition-colors">{comp.name}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">{comp.type.replace('_', ' ')}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Giornate: {comp.start_giornata} - {comp.end_giornata}
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
  );
}