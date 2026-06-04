import { useParams, useLocation } from "wouter";
import { useGetLeague, getGetLeagueQueryKey, useGetFederation, getGetFederationQueryKey } from "@workspace/api-client-react";
import { MarketEditor } from "@/components/MarketEditor";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart } from "lucide-react";

export default function MarketList() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: league, isLoading: isLoadingLeague } = useGetLeague(id, {
    query: { queryKey: getGetLeagueQueryKey(id) },
  });

  const { data: federation, isLoading: isLoadingFed } = useGetFederation(id, {
    query: { queryKey: getGetFederationQueryKey(id), enabled: !!id },
  });

  const isLoading = isLoadingLeague || isLoadingFed;

  const flags = (federation?.feature_flags ?? {}) as Record<string, boolean | number | string>;
  const alwaysOnEnabled = Boolean(flags["always_on_markets"]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground mb-4 -ml-2"
          onClick={() => navigate(`/leagues/${id}`)}
        >
          <ArrowLeft className="h-4 w-4" /> Torna alla lega
        </Button>

        {isLoadingLeague ? (
          <Skeleton className="h-8 w-64" />
        ) : (
          <div className="flex items-start gap-3">
            <ShoppingCart className="h-6 w-6 text-primary mt-1 shrink-0" />
            <div>
              <h1 className="font-serif text-2xl font-bold text-primary leading-tight">
                Mercati
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {league?.name} — finestre e parametri degli eventi di mercato
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Nota federazione */}
      {!isLoading && (
        <div className="text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
          I tipi di mercato disponibili sono determinati dai flag del regolamento federazione.
          La lega configura solo le finestre e i parametri dei tipi già abilitati.
          {alwaysOnEnabled && (
            <span className="ml-1 font-medium text-foreground/70">
              Flag <span className="font-mono">always_on_markets</span> attivo — è disponibile l'opzione "finestra permanente".
            </span>
          )}
        </div>
      )}

      {/* Editor */}
      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <MarketEditor
          leagueId={id}
          federationFlags={flags}
          alwaysOnEnabled={alwaysOnEnabled}
        />
      )}
    </div>
  );
}
