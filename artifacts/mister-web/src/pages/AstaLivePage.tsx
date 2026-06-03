import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  useGetAuction,
  getGetAuctionQueryKey,
  useCreateAuctionBid,
  useAssignAuction,
  useSkipAuction,
  usePauseAuction,
  useResumeAuction,
  useEndAuction,
} from "@workspace/api-client-react";
import { PlayerHero } from "@/components/asta/PlayerHero";
import { CurrentBidPanel } from "@/components/asta/CurrentBidPanel";
import { AstaControls } from "@/components/asta/AstaControls";
import { SidebarSquadre } from "@/components/asta/SidebarSquadre";
import { BidFeed } from "@/components/asta/BidFeed";
import { RoseSquadrePanel } from "@/components/asta/RoseSquadrePanel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Gavel } from "lucide-react";

export default function AstaLivePage() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading: isLoadingAuction, isError, refetch } = useGetAuction(
    auctionId!,
    { query: { enabled: !!auctionId, queryKey: getGetAuctionQueryKey(auctionId!), refetchInterval: 5000 } },
  );

  // ── INTERVENTO 1: timer su deadline assoluto ─────────────────────────────
  // deadlineTs: epoch ms della scadenza. null = idle (nessuna offerta per questo giocatore).
  // remaining è stato derivato, calcolato nel tick — NON più source of truth.
  const [deadlineTs, setDeadlineTs] = useState<number | null>(null);
  const timerSeconds = data?.auction.timer_seconds ?? 8;
  const [remaining, setRemaining] = useState(timerSeconds);
  // Remaining ms al momento della pausa, per riprendere esattamente da lì
  const remainingMsOnPauseRef = useRef<number>(0);

  // ── Transition lock ───────────────────────────────────────────────────────
  // Disabilita i tasti offerta mentre skip/aggiudica è in volo + attende il refetch
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Ref sincrono: aggiornato PRIMA di qualsiasi await — blocca handleBid nel tick stesso del click
  const isTransitioningRef = useRef(false);

  // ── Errore bid inline ─────────────────────────────────────────────────────
  const [bidError, setBidError] = useState<string | null>(null);

  // ── Flash "Aggiudicato!" ─────────────────────────────────────────────────
  const [aggiudicatoVisible, setAggiudicatoVisible] = useState(false);

  const bidMutation = useCreateAuctionBid();
  const assignMutation = useAssignAuction();
  const skipMutation = useSkipAuction();
  const pauseMutation = usePauseAuction();
  const resumeMutation = useResumeAuction();
  const endMutation = useEndAuction();

  const auctionStatus = data?.auction.status;
  const isPaused = auctionStatus === "paused";
  const isCompleted = auctionStatus === "completed";

  // ── Un solo intervallo, dipendenze [deadlineTs, isPaused] ─────────────────
  useEffect(() => {
    if (deadlineTs === null || isPaused) return;
    const captured = deadlineTs;
    const id = setInterval(() => {
      const rem = Math.max(0, Math.ceil((captured - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [deadlineTs, isPaused]);

  // ── INTERVENTO 2: reset a idle al cambio giocatore ───────────────────────
  // Ogni cambio di currentPlayerId azzera il timer. Nessun path secondario via bids_history.
  const currentPlayerId = data?.current_player?.player_id;
  useEffect(() => {
    setDeadlineTs(null);
    setRemaining(timerSeconds);
    setBidError(null);
  }, [currentPlayerId]);

  // ── INTERVENTO 3a: handleBid — try/catch + errore visibile ───────────────
  const handleBid = async (fantaTeamId: string, delta: number) => {
    if (!auctionId || !data?.current_player) return;
    // Guard primario (ref sincrono): blocca nel tick stesso di handleAggiudica/handleSalta
    if (isTransitioningRef.current) return;
    const targetPlayerId = data.current_player.player_id;
    const currentAmount = data.current_bid?.amount_fm ?? 0;
    setBidError(null);
    try {
      // Guard secondario: verifica freschezza cache (auto-poll 5s)
      const freshData = queryClient.getQueryData(
        getGetAuctionQueryKey(auctionId!)
      ) as typeof data;
      if (freshData?.current_player?.player_id !== targetPlayerId) return;
      await bidMutation.mutateAsync({
        id: auctionId,
        data: { player_id: targetPlayerId, fanta_team_id: fantaTeamId, amount_fm: currentAmount + delta },
      });
      // Ogni offerta riuscita: estende la deadline di TIMER_SECONDS da adesso (BUG 1 risolto)
      setDeadlineTs(Date.now() + timerSeconds * 1000);
      refetch();
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string } })?.data;
      setBidError(body?.error ?? "Offerta non registrata. Riprova.");
      refetch(); // risincronizza lo stato dopo l'errore
    }
  };

  // ── INTERVENTO 3b: handleAggiudica — await refetch prima di sbloccare ────
  const handleAggiudica = async () => {
    if (!auctionId || !data?.current_player) return;
    isTransitioningRef.current = true; // sincrono — blocca handleBid prima del re-render
    setIsTransitioning(true);
    setDeadlineTs(null);
    try {
      await assignMutation.mutateAsync({
        id: auctionId,
        data: { player_id: data.current_player.player_id },
      });
      setAggiudicatoVisible(true);
      await refetch(); // attende che current_player avanzi
      setTimeout(() => setAggiudicatoVisible(false), 1500);
    } finally {
      isTransitioningRef.current = false;
      setIsTransitioning(false); // bottoni offerta sbloccati solo dopo refetch
    }
  };

  // ── INTERVENTO 3b: handleSalta — await refetch prima di sbloccare ─────────
  const handleSalta = async () => {
    if (!auctionId || !data?.current_player) return;
    isTransitioningRef.current = true; // sincrono — blocca handleBid prima del re-render
    setIsTransitioning(true);
    setDeadlineTs(null);
    try {
      await skipMutation.mutateAsync({
        id: auctionId,
        data: { player_id: data.current_player.player_id },
      });
      await refetch(); // attende che current_player avanzi: nessun bid stale possibile
    } finally {
      isTransitioningRef.current = false;
      setIsTransitioning(false);
    }
  };

  // ── handlePauseResume — salva/ripristina remaining ms ────────────────────
  const handlePauseResume = async () => {
    if (!auctionId) return;
    if (isPaused) {
      // Riprendi: recupera ms salvati, poi aspetta isPaused=false, infine riavvia il timer
      const savedMs = remainingMsOnPauseRef.current;
      await resumeMutation.mutateAsync({ id: auctionId });
      await refetch(); // isPaused diventa false dopo questo
      if (savedMs > 0) {
        setDeadlineTs(Date.now() + savedMs); // deadline corretta: now + ms rimasti alla pausa
      }
    } else {
      // Pausa: salva i ms rimasti, azzera subito il timer (mostra "—"), poi mutation
      const savedMs = deadlineTs ? Math.max(0, deadlineTs - Date.now()) : 0;
      remainingMsOnPauseRef.current = savedMs;
      setDeadlineTs(null); // Congela display: "—"
      await pauseMutation.mutateAsync({ id: auctionId });
      await refetch();
    }
  };

  const handleTermina = async () => {
    if (!auctionId) return;
    await endMutation.mutateAsync({ id: auctionId });
    await refetch();
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const isMutating =
    bidMutation.isPending ||
    assignMutation.isPending ||
    skipMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    endMutation.isPending;

  // Durante la pausa il timer è congelato: mostriamo "—" nel cerchio (active=false)
  const timerActive = deadlineTs !== null && !isPaused;
  const timerExpired = deadlineTs !== null && !isPaused && remaining === 0;
  const canAssign = !!(data?.current_bid) && !isMutating && !isTransitioning && !isPaused;
  const bidsDisabled = isMutating || isTransitioning;

  // ── Loading / error ───────────────────────────────────────────────────────
  if (isLoadingAuction) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-72" />
            <Skeleton className="h-24" />
            <Skeleton className="h-12" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Asta non trovata o errore di caricamento.</AlertDescription>
      </Alert>
    );
  }

  const squadreForComponents = data.squadre.map((t) => ({
    id: t.id,
    name: t.name,
    name_auction: t.name_auction ?? null,
    credits_remaining: t.credits_remaining,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Gavel className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold font-serif text-primary">Asta live</h1>
          {isPaused && <Badge variant="secondary">Sospesa</Badge>}
          {isCompleted && (
            <Badge className="bg-green-100 text-green-800 border border-green-200">Completata</Badge>
          )}
        </div>
        <p className="font-mono text-sm text-muted-foreground tabular-nums">
          Giocatore{" "}
          <span className="font-bold text-foreground">{data.progress.current}</span>
          {" / "}
          <span className="font-bold text-foreground">{data.progress.total}</span>
          {" · "}
          <span className="font-bold text-foreground">{data.progress.sold}</span> aggiudicati
        </p>
      </div>

      {isCompleted && (
        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <h2 className="text-2xl font-bold font-serif text-green-800 mb-2">Asta completata</h2>
          <p className="text-green-700 font-mono text-sm">
            {data.progress.sold} giocatori aggiudicati{" "}
            · {data.progress.total - data.progress.sold} non assegnati
          </p>
          <div className="mt-8 max-w-md mx-auto">
            <SidebarSquadre
              squadre={squadreForComponents}
              currentBidAmount={0}
              isPaused
              isLoading={false}
              onBid={() => {}}
            />
          </div>
        </div>
      )}

      {aggiudicatoVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-[#1f4733] text-[#efe6d3] rounded-2xl px-12 py-8 shadow-2xl animate-in zoom-in duration-200">
            <p className="text-4xl font-bold font-serif tracking-tight">Aggiudicato!</p>
          </div>
        </div>
      )}

      {!isCompleted && (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {data.current_player ? (
              <>
                <div className="rounded-xl border bg-card shadow-sm">
                  <PlayerHero player={data.current_player} total={data.progress.total} />
                </div>
                <CurrentBidPanel
                  currentBid={data.current_bid ?? null}
                  squadre={squadreForComponents}
                  timerRemaining={remaining}
                  timerTotal={timerSeconds}
                  timerActive={timerActive}
                />
                {bidError && (
                  <p className="text-destructive text-sm text-center font-mono">{bidError}</p>
                )}
                <AstaControls
                  canAssign={canAssign}
                  isPaused={isPaused}
                  timerExpired={timerExpired}
                  isLoading={isMutating || isTransitioning}
                  onAggiudica={handleAggiudica}
                  onPauseResume={handlePauseResume}
                  onSalta={handleSalta}
                  onTermina={handleTermina}
                />
              </>
            ) : (
              <div className="rounded-xl border bg-card p-16 text-center text-muted-foreground text-sm">
                In attesa del prossimo giocatore...
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border bg-card shadow-sm p-4">
              <SidebarSquadre
                squadre={squadreForComponents}
                currentBidAmount={data.current_bid?.amount_fm ?? 0}
                isPaused={isPaused}
                isLoading={bidsDisabled}
                onBid={handleBid}
              />
            </div>
            <div className="rounded-xl border bg-card shadow-sm p-4">
              <BidFeed
                bids={(data.bids_history ?? []).map((b) => ({
                  id: b.id,
                  fanta_team_id: b.fanta_team_id,
                  amount_fm: b.amount_fm,
                  created_at: b.created_at,
                }))}
                squadre={squadreForComponents}
              />
            </div>
          </div>
        </div>

        {/* ── FASCIA INFERIORE: rose e budget ──────────────────────────── */}
        <RoseSquadrePanel
          squadre={data.squadre.map((s) => ({
            id: s.id,
            name: s.name,
            name_auction: s.name_auction,
            credits_remaining: s.credits_remaining,
          }))}
          assignments={(data.assignments ?? []).map((a) => ({
            player_id: a.player_id,
            player_name: a.player_name,
            role_classic: a.role_classic,
            fanta_team_id: a.fanta_team_id,
            final_price_fm: a.final_price_fm,
          }))}
        />
        </>
      )}
    </div>
  );
}
