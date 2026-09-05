import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetLeague,
  useListFantaTeams, getListFantaTeamsQueryKey,
  useJoinLeague,
  useClaimSlot,
} from "@workspace/api-client-react";
import { useCurrentUser } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Check, ArrowRight, Loader2 } from "lucide-react";

type JoinStep = "welcome" | "choose-slot" | "societa-form";

export default function JoinLegaPage() {
  const { leagueId, code } = useParams<{ leagueId: string; code: string }>();
  const [, navigate] = useLocation();
  const { user, isLoading: isAuthLoading } = useCurrentUser();

  const [step, setStep] = useState<JoinStep>("welcome");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [societaName, setSocietaName] = useState("");
  const [societaNameAuction, setSocietaNameAuction] = useState("");
  const [societaColorPrimary, setSocietaColorPrimary] = useState("#1f4733");
  const [societaColorSecondary, setSocietaColorSecondary] = useState("#efe6d3");

  const { data: league, isLoading: isLeagueLoading } = useGetLeague(leagueId!);

  const { data: teams, refetch: refetchTeams } = useListFantaTeams(leagueId!, {
    query: {
      enabled: step === "choose-slot" || step === "societa-form",
      queryKey: getListFantaTeamsQueryKey(leagueId!),
    },
  });

  const joinLeague = useJoinLeague();
  const claimSlot = useClaimSlot();

  const freeSlots = (teams ?? []).filter(t => t.manager_user_id === null);

  const handleJoin = async () => {
    if (!leagueId || !code) return;
    setJoinError(null);
    try {
      await joinLeague.mutateAsync({ id: leagueId, data: { invitation_code: code } });
      await refetchTeams();
      setStep("choose-slot");
    } catch (err: unknown) {
      const data = (err as { data?: { error?: string; code?: string } })?.data;
      if (data?.code === "LEAGUE_FULL") {
        setJoinError("Lega al completo: tutti gli slot sono occupati.");
      } else {
        setJoinError(data?.error ?? "Errore durante l'ingresso. Verifica il codice invito.");
      }
    }
  };

  const handleSelectSlot = (slotId: string) => {
    setSelectedSlotId(slotId);
    setStep("societa-form");
  };

  const handleClaim = async () => {
    if (!leagueId || !selectedSlotId || !societaName.trim() || !societaNameAuction.trim()) return;
    setClaimError(null);
    try {
      await claimSlot.mutateAsync({
        id: leagueId,
        data: {
          slot_id: selectedSlotId,
          societa: {
            name: societaName.trim(),
            name_auction: societaNameAuction.trim(),
            color_primary: societaColorPrimary,
            color_secondary: societaColorSecondary,
          },
        },
      });
      navigate(`/leagues/${leagueId}`);
    } catch (err: unknown) {
      const data = (err as { data?: { error?: string; code?: string } })?.data;
      if (data?.code === "SLOT_TAKEN") {
        setClaimError("Slot già preso da un altro partecipante. Scegli un altro slot.");
        setStep("choose-slot");
        refetchTeams();
      } else if (data?.code === "SLOT_CONFLICT") {
        setClaimError("Hai già una squadra in questa lega.");
      } else {
        setClaimError(data?.error ?? "Errore durante il claim. Riprova.");
      }
    }
  };

  if (isLeagueLoading || isAuthLoading) {
    return (
      <div className="max-w-lg mx-auto py-16 space-y-4 px-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center px-4">
        <p className="text-destructive font-medium">Lega non trovata o codice invito non valido.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-10 space-y-6 px-4">
      <div>
        <Badge variant="outline" className="mb-2 font-mono">Stagione {league.season}</Badge>
        <h1 className="text-3xl font-serif font-bold text-[#1f4733]">{league.name}</h1>
        {league.max_managers && (
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Fino a {league.max_managers} manager
            {league.budget_initial != null && <> · {league.budget_initial} FM budget</>}
          </p>
        )}
      </div>

      {step === "welcome" && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {!user ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Sei stato invitato a questa lega. Accedi per partecipare.
                </p>
                <Button
                  className="w-full bg-[#1f4733] hover:bg-[#1f4733]/90 text-[#efe6d3]"
                  onClick={() => navigate("/login")}
                >
                  Accedi per partecipare
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Sei invitato a partecipare. Entra nella lega e scegli uno slot per la tua squadra.
                </p>
                {joinError && (
                  <p
                    className="text-sm text-destructive border border-destructive/20 bg-destructive/5 rounded px-3 py-2"
                    data-testid="text-join-error"
                  >
                    {joinError}
                  </p>
                )}
                <Button
                  className="w-full bg-[#1f4733] hover:bg-[#1f4733]/90 text-[#efe6d3]"
                  onClick={handleJoin}
                  disabled={joinLeague.isPending}
                  data-testid="button-join-league"
                >
                  {joinLeague.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ingresso in corso...</>
                  ) : (
                    <>Entra nella lega <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === "choose-slot" && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-[#1f4733]">Scegli uno slot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {claimError && (
              <p className="text-sm text-destructive border border-destructive/20 bg-destructive/5 rounded px-3 py-2 mb-2">
                {claimError}
              </p>
            )}
            {freeSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nessuno slot libero disponibile. La lega potrebbe essere al completo.
              </p>
            ) : (
              freeSlots.map((slot, i) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => handleSelectSlot(slot.id)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-dashed border-border/60 hover:border-[#1f4733]/60 hover:bg-[#1f4733]/5 transition-colors"
                  data-testid={`slot-choice-${i}`}
                >
                  <span className="font-serif font-bold text-base text-[#1f4733]">
                    {slot.name ?? `Slot #${i + 1}`}
                  </span>
                  {slot.name_auction && slot.name_auction !== slot.name && (
                    <span className="ml-2 text-xs font-mono text-muted-foreground">
                      voce asta: {slot.name_auction}
                    </span>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {step === "societa-form" && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-[#1f4733]">La tua società</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome squadra</Label>
              <Input
                value={societaName}
                onChange={e => setSocietaName(e.target.value)}
                placeholder="es. I Gladiatori di Roma"
                maxLength={50}
                data-testid="input-societa-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome all'asta</Label>
              <Input
                value={societaNameAuction}
                onChange={e => setSocietaNameAuction(e.target.value)}
                placeholder="es. Gladiatori"
                maxLength={30}
                data-testid="input-societa-name-auction"
              />
              <p className="text-[10px] text-muted-foreground">
                Pronunciato dal battitore durante l'asta. Breve e distintivo.
              </p>
            </div>
            <div className="flex gap-6">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Colore primario</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={societaColorPrimary}
                    onChange={e => setSocietaColorPrimary(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-border"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{societaColorPrimary}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Colore secondario</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={societaColorSecondary}
                    onChange={e => setSocietaColorSecondary(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-border"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{societaColorSecondary}</span>
                </div>
              </div>
            </div>

            {claimError && (
              <p
                className="text-sm text-destructive border border-destructive/20 bg-destructive/5 rounded px-3 py-2"
                data-testid="text-claim-error"
              >
                {claimError}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={() => { setStep("choose-slot"); setClaimError(null); }}
                disabled={claimSlot.isPending}
              >
                Indietro
              </Button>
              <Button
                className="flex-1 bg-[#1f4733] hover:bg-[#1f4733]/90 text-[#efe6d3]"
                onClick={handleClaim}
                disabled={!societaName.trim() || !societaNameAuction.trim() || claimSlot.isPending}
                data-testid="button-claim-slot"
              >
                {claimSlot.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Rivendica slot...</>
                ) : (
                  <><Check className="mr-2 h-4 w-4" />Entra nella lega</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
