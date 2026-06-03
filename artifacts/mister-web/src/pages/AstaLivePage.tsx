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
import { AstaHero } from "@/components/asta/AstaHero";
import { TabelloneSquadre } from "@/components/asta/TabelloneSquadre";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const currentPlayerId = data?.current_player?.player_id;
  useEffect(() => {
    setDeadlineTs(null);
    setRemaining(timerSeconds);
    setBidError(null);
  }, [currentPlayerId]);

  // ── INTERVENTO 3a: handleBid — try/catch + errore visibile ───────────────
  const handleBid = async (fantaTeamId: string, delta: number) => {
    if (!auctionId || !data?.current_player || isTransitioningRef.current) return;
    const targetPlayerId = data.current_player.player_id;
    const currentAmount = data?.current_bid?.amount_fm ?? 0;
    setBidError(null);
    try {
      await bidMutation.mutateAsync({
        id: auctionId,
        data: { player_id: targetPlayerId, fanta_team_id: fantaTeamId, amount_fm: currentAmount + delta },
      });
      // Ogni offerta riuscita: estende la deadline di timerSeconds da adesso (BUG 1 risolto)
      setDeadlineTs(Date.now() + timerSeconds * 1000);
      refetch();
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string } })?.data;
      setBidError(body?.error ?? "Offerta non registrata. Riprova.");
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
    isTransitioningRef.current = true;
    setIsTransitioning(true);
    setDeadlineTs(null);
    try {
      await skipMutation.mutateAsync({
        id: auctionId,
        data: { player_id: data.current_player.player_id },
      });
      await refetch();
    } finally {
      isTransitioningRef.current = false;
      setIsTransitioning(false);
    }
  };

  // ── handlePauseResume — salva/ripristina remaining ms ────────────────────
  const handlePauseResume = async () => {
    if (!auctionId) return;
    if (isPaused) {
      const savedMs = remainingMsOnPauseRef.current;
      await resumeMutation.mutateAsync({ id: auctionId });
      await refetch();
      if (savedMs > 0) {
        setDeadlineTs(Date.now() + savedMs);
      }
    } else {
      const savedMs = deadlineTs ? Math.max(0, deadlineTs - Date.now()) : 0;
      remainingMsOnPauseRef.current = savedMs;
      setDeadlineTs(null);
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

  const timerActive = deadlineTs !== null && !isPaused;
  const canAssign = !!(data?.current_bid) && !isMutating && !isTransitioning && !isPaused;
  const bidsDisabled = isMutating || isTransitioning;

  // ── Loading / error ───────────────────────────────────────────────────────
  if (isLoadingAuction) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40" />
        <Skeleton className="h-96" />
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
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Gavel className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold font-serif text-primary">Asta live</h1>
          {isPaused && <Badge variant="secondary">Sospesa</Badge>}
          {isCompleted && (
            <Badge variant="outline" className="border-green-400 text-green-700">
              Completata
            </Badge>
          )}
          <p className="text-sm text-muted-foreground font-mono">
            {data.progress.current}/{data.progress.total}
            {" · "}
            <span className="font-bold text-foreground">{data.progress.sold}</span> aggiudicati
          </p>
        </div>
        {!isCompleted && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleTermina}
            disabled={isMutating}
          >
            Termina asta
          </Button>
        )}
      </div>

      {/* ── Flash "Aggiudicato!" ─────────────────────────────────── */}
      {aggiudicatoVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-[#1f4733] text-[#efe6d3] rounded-2xl px-12 py-8 shadow-2xl animate-in zoom-in duration-200">
            <p className="text-4xl font-bold font-serif tracking-tight">Aggiudicato!</p>
          </div>
        </div>
      )}

      {/* ── Asta completata ──────────────────────────────────────── */}
      {isCompleted && (
        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
          <h2 className="text-xl font-bold font-serif text-green-800 mb-1">Asta completata</h2>
          <p className="text-green-700 font-mono text-sm">
            {data.progress.sold} giocatori aggiudicati
            {" · "}
            {data.progress.total - data.progress.sold} non assegnati
          </p>
        </div>
      )}

      {/* ── Bid error inline ────────────────────────────────────── */}
      {bidError && (
        <p className="text-destructive text-sm text-center font-mono">{bidError}</p>
      )}

      {/* ── FASCIA HERO (solo quando l'asta è attiva) ───────────── */}
      {!isCompleted && (
        <AstaHero
          currentPlayer={data.current_player ?? null}
          currentBid={data.current_bid ?? null}
          squadre={squadreForComponents}
          timerRemaining={remaining}
          timerTotal={timerSeconds}
          timerActive={timerActive}
          isPaused={isPaused}
          canAssign={canAssign}
          bidsDisabled={bidsDisabled}
          progress={data.progress}
          onAggiudica={handleAggiudica}
          onPauseResume={handlePauseResume}
          onSalta={handleSalta}
        />
      )}

      {/* ── TABELLONE (sempre visibile, read-only quando completata) */}
      <TabelloneSquadre
        squadre={squadreForComponents}
        assignments={(data.assignments ?? []).map((a) => ({
          player_id: a.player_id,
          player_name: a.player_name,
          role_classic: a.role_classic,
          fanta_team_id: a.fanta_team_id,
          final_price_fm: a.final_price_fm,
        }))}
        rosterP={data.auction.roster_p}
        rosterD={data.auction.roster_d}
        rosterC={data.auction.roster_c}
        rosterA={data.auction.roster_a}
        currentBidTeamId={data.current_bid?.fanta_team_id ?? null}
        currentBidAmount={data.current_bid?.amount_fm ?? 0}
        isPaused={isPaused || isCompleted}
        isLoading={bidsDisabled}
        onBid={handleBid}
      />
    </div>
  );
}
