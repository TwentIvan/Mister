/**
 * MieSocietaPage (T173.b) — /societa: tutte le società dell'utente,
 * una card per lega, con colori sociali e link alla pagina di gestione.
 */

import { Link } from "wouter";
import { useListMySocieta, getListMySocietaQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Shirt, ChevronRight } from "lucide-react";

export default function MieSocietaPage() {
  const { data, isLoading } = useListMySocieta({
    query: { queryKey: getListMySocietaQueryKey() },
  });
  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="font-serif text-2xl font-bold">Le mie società</h1>
        <p className="text-sm text-muted-foreground">I tuoi club, in tutte le leghe.</p>
      </div>

      {isLoading && <Skeleton className="h-24 w-full" />}
      {!isLoading && items.length === 0 && (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          Nessuna società ancora: entra in una lega con un invito e prendi la tua squadra.
        </CardContent></Card>
      )}

      {items.map((s) => (
        <Link key={s.fanta_team_id} href={`/leagues/${s.league_id}/societa`}>
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 py-4">
              <div
                className="w-12 h-12 rounded-lg shrink-0 border"
                style={{
                  background: `linear-gradient(135deg, ${s.color_primary ?? "#1f4733"} 50%, ${s.color_secondary ?? "#efe6d3"} 50%)`,
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="font-serif font-bold text-lg truncate">{s.societa_name ?? "Società senza nome"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {s.league_name} · <span className="font-mono">{s.credits_remaining} FM</span>
                </p>
              </div>
              <Shirt className="h-4 w-4 text-muted-foreground shrink-0" />
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
