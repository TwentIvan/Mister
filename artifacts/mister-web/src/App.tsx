import Dashboard from "@/pages/dashboard";
import LeaguesList from "@/pages/leagues-list";
import { PlayersList } from "@/pages/players-list";
import CreateLeague from "@/pages/create-league";
import LeagueDetail from "@/pages/league-detail";
import FederationRules from "@/pages/federation";
import CompetitionDetail from "@/pages/competition-detail";
import TemplatesManager from "@/pages/templates-manager";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/app-layout";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/leagues" component={LeaguesList} />
        <Route path="/leagues/new" component={CreateLeague} />
        <Route path="/leagues/:id" component={LeagueDetail} />
        <Route path="/leagues/:id/federation" component={FederationRules} />
        <Route path="/leagues/:leagueId/competitions/:id" component={CompetitionDetail} />
        <Route path="/players" component={PlayersList} />
        <Route path="/superadmin/templates" component={TemplatesManager} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
