/**
 * JoinSlotPage (T171) — atterraggio dell'invito NOMINALE: /js/:token
 *
 * Chi apre il link vede la SUA squadra ("Sei stato invitato a guidare X"),
 * si registra/accede, e con un tap prende possesso di QUELLO slot — niente
 * liste, niente scelte, niente claim sbagliati. Il token è monouso: il
 * claim lo consuma; scaduto o revocato, la pagina lo dice chiaramente.
 */

import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  useGetSlotInvite,
  getGetSlotInviteQueryKey,
  useClaimSlotInvite,
} from "@workspace/api-client-react";
import { useCurrentUser } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, LogIn, UserPlus, CircleAlert } from "lucide-react";

export default function JoinSlotPage() {
  const [, params] = useRoute("/js/:token");
  const token = params?.token ?? "";
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useCurrentUser();
  const [claimError, setClaimError] = useState<string | null>(null);

  const { data, isLoading, isError } = useGetSlotInvite(token, {
    query: { enabled: !!token, queryKey: getGetSlotInviteQueryKey(token) },
  });
  const claim = useClaimSlotInvite();

  const next = encodeURIComponent(`/js/${token}`);

  const doClaim = () => {
    setClaimError(null);
    claim.mutate(
      { token },
      {
        onSuccess: (r) => navigate(`/leagues/${r.league_id}`),
        onError: (e: unknown) => {
          const err = e as { data?: { error?: string } };
          setClaimError(err?.data?.error ?? "Rivendicazione non riuscita");
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-[#efe6d3] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-[#1f4733]/20">
        <CardContent className="pt-8 pb-6 space-y-5 text-center">
          <p className="font-serif text-4xl font-bold text-[#1f4733]">Mister</p>

          {isLoading || authLoading ? (
            <p className="font-mono text-sm text-muted-foreground">Caricamento invito…</p>
          ) : isError || !data ? (
            <div className="space-y-2">
              <CircleAlert className="h-8 w-8 mx-auto text-destructive" />
              <p className="font-medium">Invito inesistente o revocato</p>
              <p className="text-sm text-muted-foreground">
                Chiedi all'admin della lega un nuovo link personale.
              </p>
            </div>
          ) : data.expired ? (
            <div className="space-y-2">
              <CircleAlert className="h-8 w-8 mx-auto text-amber-600" />
              <p className="font-medium">Invito scaduto</p>
              <p className="text-sm text-muted-foreground">
                Chiedi all'admin di rigenerare il tuo link.
              </p>
            </div>
          ) : data.claimed ? (
            <div className="space-y-2">
              <Trophy className="h-8 w-8 mx-auto text-[#1f4733]" />
              <p className="font-medium">Questa squadra ha già un manager</p>
              <p className="text-sm text-muted-foreground">
                Se sei tu, <a className="underline" href={`/leagues/${data.league_id}`}>entra nella lega</a>;
                altrimenti contatta l'admin.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Sei stato invitato a guidare</p>
                <p className="font-serif text-3xl font-bold text-[#1f4733]">
                  {data.team_name ?? "la tua squadra"}
                </p>
                <p className="text-sm text-muted-foreground">in «{data.league_name}»</p>
              </div>

              {claimError && (
                <p className="text-sm text-destructive font-mono">{claimError}</p>
              )}

              {user ? (
                <Button
                  className="w-full gap-2 bg-[#1f4733] text-[#efe6d3] hover:bg-[#1f4733]/90 text-base py-6"
                  onClick={doClaim}
                  disabled={claim.isPending}
                  data-testid="button-claim-slot"
                >
                  <Trophy className="h-5 w-5" />
                  {claim.isPending ? "Un attimo…" : `Prendi possesso di ${data.team_name ?? "questa squadra"}`}
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button
                    className="w-full gap-2 bg-[#1f4733] text-[#efe6d3] hover:bg-[#1f4733]/90"
                    onClick={() => navigate(`/register?next=${next}`)}
                  >
                    <UserPlus className="h-4 w-4" />
                    Registrati e prendi la squadra
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-[#1f4733]/30"
                    onClick={() => navigate(`/login?next=${next}`)}
                  >
                    <LogIn className="h-4 w-4" />
                    Ho già un account
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
