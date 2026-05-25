import { useGetDashboard, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Trophy, CalendarClock, Activity, ArrowRight, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard(
    { user_id: "demo-user" },
    { query: { queryKey: getGetDashboardQueryKey({ user_id: "demo-user" }) } }
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-serif text-primary tracking-tight">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return <div className="text-destructive">Failed to load dashboard</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary tracking-tight" data-testid="text-dashboard-title">
            Mister Cockpit
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-dashboard-subtitle">
            Overview of your active seasons and markets.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/leagues/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2" data-testid="link-create-league">
            New League
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Leagues Summary */}
        <Card className="col-span-1 md:col-span-2 border-primary/20 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle className="text-xl font-serif flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Active Leagues
              </CardTitle>
              <CardDescription>Your current fantasy management roles</CardDescription>
            </div>
            <Link href="/leagues" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {dashboard.my_leagues.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-lg bg-muted/20">
                <p className="text-sm text-muted-foreground mb-2">No active leagues yet</p>
                <Link href="/leagues/new" className="text-sm font-medium text-primary hover:underline">
                  Create your first league
                </Link>
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                {dashboard.my_leagues.map(league => (
                  <div key={league.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors" data-testid={`card-league-${league.id}`}>
                    <div>
                      <Link href={`/leagues/${league.id}`} className="font-semibold text-lg hover:underline decoration-primary">
                        {league.name}
                      </Link>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="font-mono text-xs">Season {league.season}</Badge>
                        <span>{league.max_managers} managers</span>
                      </div>
                    </div>
                    <Badge variant={league.started ? "default" : "secondary"}>
                      {league.started ? "In Progress" : "Drafting"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Stats */}
        <div className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                System Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Leagues</span>
                  <span className="text-2xl font-bold font-mono">{dashboard.total_league_count || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Active Templates</span>
                  <span className="text-2xl font-bold font-mono">{dashboard.template_count || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm bg-sidebar text-sidebar-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-sidebar-foreground/70 flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Active Markets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.active_markets.length === 0 ? (
                <p className="text-sm text-sidebar-foreground/50 italic">No markets currently open</p>
              ) : (
                <div className="space-y-3">
                  {dashboard.active_markets.slice(0, 3).map(market => (
                    <div key={market.id} className="flex flex-col gap-1 border-b border-sidebar-border pb-2 last:border-0">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium">{market.name}</span>
                        <Badge variant="outline" className="text-[10px] bg-sidebar-accent text-sidebar-accent-foreground border-0">
                          {market.type.replace('_', ' ')}
                        </Badge>
                      </div>
                      <span className="text-xs text-sidebar-foreground/60 font-mono">
                        Ends {new Date(market.window_ends_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}