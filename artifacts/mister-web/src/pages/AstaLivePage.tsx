import { useCallback, useEffect, useRef, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Gavel } from "lucide-react";

const TIMER_SECONDS = 8;

export default function AstaLivePage() {
  const { auctionId } = useParams<{ auctionId: string }>();

  const { data, isLoading: isLoadingAuction, isError, refetch } = useGetAuction(
    auctionId!,
    { query: { enabled: !!auctionId, queryKey: getGetAuctionQueryKey(auctionId!), refetchInterval: 5000 } },
  );

  const [timerRemaining, setTimerRemaining] = useState(TIMER_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const [aggiudicatoVisible, setAggiudicatoVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevBidCountRef = useRef(0);

  const bidMutation = useCreateAuctionBid();
  const assignMutation = useAssignAuction();
  const skipMutation = useSkipAuction();
  const pauseMutation = usePauseAuction();
  const resumeMutation = useResumeAuction();
  const endMutation = useEndAuction();

  const isMutating =
    bidMutation.isPending ||
    assignMutation.isPending ||
    skipMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    endMutation.isPending;

  const auctionStatus = data?.auction.status;
  const isPaused = auctionStatus === "paused";
  const isCompleted = auctionStatus === "completed";

  useEffect(() => {
    if (!timerActive || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, isPaused]);

  const currentPlayerId = data?.current_player?.player_id;
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);
    setTimerRemaining(TIMER_SECONDS);
    prevBidCountRef.current = 0;
  }, [currentPlayerId]);

  useEffect(() => {
    const bidCount = data?.bids_history.length ?? 0;
    if (bidCount > prevBidCountRef.current && !timerActive) {
      setTimerActive(true);
    }
    prevBidCountRef.current = bidCount;
  }, [data?.bids_history.length, timerActive]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRemaining(TIMER_SECONDS);
    setTimerActive(true);
  }, []);

  const handleBid = async (fantaTeamId: string, delta: number) => {
    if (!auctionId || !data?.current_player) return;
    const currentAmount = data.current_bid?.amount_fm ?? 0;
    await bidMutation.mutateAsync({
      id: auctionId,
      data: {
        player_id: data.current_player.player_id,
        fanta_team_id: fantaTeamId,
        amount_fm: currentAmount + delta,
      },
    });
    resetTimer();
    refetch();
  };

  const handleAggiudica = async () => {
    if (!auctionId || !data?.current_player) return;
    await assignMutation.mutateAsync({
      id: auctionId,
      data: { player_id: data.current_player.player_id },
    });
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);
    setTimerRemaining(TIMER_SECONDS);
    setAggiudicatoVisible(true);
    setTimeout(() => {
      setAggiudicatoVisible(false);
      refetch();
    }, 1500);
  };

  const handleSalta = async () => {
    if (!auctionId || !data?.current_player) return;
    await skipMutation.mutateAsync({
      id: auctionId,
      data: { player_id: data.current_player.player_id },
    });
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);
    setTimerRemaining(TIMER_SECONDS);
    refetch();
  };

  const handlePauseResume = async () => {
    if (!auctionId) return;
    if (isPaused) {
      await resumeMutation.mutateAsync({ id: auctionId });
    } else {
      await pauseMutation.mutateAsync({ id: auctionId });
    }
    refetch();
  };

  const handleTermina = async () => {
    if (!auctionId) return;
    await endMutation.mutateAsync({ id: auctionId });
    refetch();
  };

  const canAssign = !!(data?.current_bid) && !isMutating && !isPaused;
  const timerExpired = timerActive && timerRemaining === 0;

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
                  timerRemaining={timerRemaining}
                  timerTotal={TIMER_SECONDS}
                  timerActive={timerActive}
                />
                <AstaControls
                  canAssign={canAssign}
                  isPaused={isPaused}
                  timerExpired={timerExpired}
                  isLoading={isMutating}
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
                isLoading={isMutating}
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
      )}
    </div>
  );
}
