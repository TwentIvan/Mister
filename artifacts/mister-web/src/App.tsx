import Dashboard from "@/pages/dashboard";
import LeaguesList from "@/pages/leagues-list";
import { PlayersList } from "@/pages/players-list";
import SetupLegaPage from "@/pages/SetupLegaPage";
import LeagueDetail from "@/pages/league-detail";
import LeagueConfig from "@/pages/league-config";
import FederationRules from "@/pages/federation";
import CompetitionDetail from "@/pages/competition-detail";
import MarketList from "@/pages/market-list";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import { AuthProvider } from "@/contexts/AuthContext";
import TemplatesManager from "@/pages/templates-manager";
import VotoAlgorithm from "@/pages/voto-algorithm";
import FormazionePage from "@/pages/formazione/FormazionePage";
import CompetizionePage from "@/pages/competizione/CompetizionePage";
import MatchDetailPage from "@/pages/competizione/MatchDetailPage";
import AstaLivePage from "@/pages/AstaLivePage";
import AstaMobilePage from "@/pages/AstaMobilePage";
import JoinLegaPage from "@/pages/JoinLegaPage";
import BrandPage from "@/pages/brand";
import ClassificaPage from "@/pages/classifica/ClassificaPage";
import HubPage from "@/pages/hub/HubPage";
import FeedPage from "@/pages/feed/FeedPage";
import RosaPage from "@/pages/rosa/RosaPage";
import SchedaPage from "@/pages/scheda/SchedaPage";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/app-layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* ── Auth — senza sidebar ─────────────────────────────── */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />

      {/* ── Mobile player view — fuori da AppLayout ─────────── */}
      <Route path="/m/:auctionId" component={AstaMobilePage} />

      {/* ── Classifica mobile (S-classifica, design spec) ────── */}
      <Route path="/classifica/:competitionId" component={ClassificaPage} />

      {/* ── Hub lega mobile (S-hub, design spec) ─────────────── */}
      <Route path="/hub/:leagueId" component={HubPage} />

      {/* ── Feed mobile (S-feed, design spec) ────────────────── */}
      <Route path="/feed/:leagueId" component={FeedPage} />
      <Route path="/feed" component={FeedPage} />

      {/* ── Rosa mobile (S-rosa, design spec) ─────────────────── */}
      <Route path="/rosa/:fantaTeamId" component={RosaPage} />

      {/* ── Scheda giocatore mobile (S-scheda, design spec) ───── */}
      <Route path="/scheda/:playerId" component={SchedaPage} />

      {/* ── Invito lega — accessibile senza autenticazione ──── */}
      <Route path="/join/:leagueId/:code" component={JoinLegaPage} />

      {/* ── Tutte le altre pagine con sidebar ───────────────── */}
      <Route>
        {() => (
          <ProtectedRoute>
          <AppLayout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/leagues" component={LeaguesList} />
              <Route path="/leagues/new" component={SetupLegaPage} />
              <Route path="/lega/nuova" component={SetupLegaPage} />
              <Route path="/leagues/:id" component={LeagueDetail} />
              <Route path="/leagues/:id/config" component={LeagueConfig} />
              <Route path="/leagues/:id/federation" component={FederationRules} />
              <Route path="/leagues/:leagueId/competitions/:id" component={CompetitionDetail} />
              <Route path="/leagues/:id/markets" component={MarketList} />
              <Route path="/squadra/formazione" component={FormazionePage} />
              <Route path="/competizione/:competitionId" component={CompetizionePage} />
              <Route path="/partita/:matchId" component={MatchDetailPage} />
              <Route path="/asta/:auctionId" component={AstaLivePage} />
              <Route path="/players" component={PlayersList} />
              <Route path="/superadmin/templates" component={TemplatesManager} />
              <Route path="/superadmin/algoritmo-voto" component={VotoAlgorithm} />
              <Route path="/brand" component={BrandPage} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
          </ProtectedRoute>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
