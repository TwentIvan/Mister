import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useResolveAuctionToken,
  getResolveAuctionTokenQueryKey,
  useGetAuction,
  getGetAuctionQueryKey,
  useCreateAuctionBid,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Helpers ──────────────────────────────────────────────────────────────

function roleBadge(role: string | undefined) {
  if (!role) return null;
  const labels: Record<string, string> = { GK: "P", DEF: "D", MID: "C", ATT: "A" };
  return labels[role] ?? role;
}

function formatRemaining(secs: number): string {
  if (secs <= 0) return "0";
  return String(secs);
}

// ─── Component ────────────────────────────────────────────────────────────

export default function AstaMobilePage() {
  const { token } = useParams<{ token: string }>();

  // 1. Risolvi il token → {auction_id, fanta_team_id, team_name}
  const { data: ctx, isLoading: loadingCtx, isError: errorCtx } =
    useResolveAuctionToken(token ?? "", {
      query: { enabled: !!token, queryKey: getResolveAuctionTokenQueryKey(token ?? "") },
    });

  const auctionId   = ctx?.auction_id;
  const myTeamId    = ctx?.fanta_team_id;

  const queryClient = useQueryClient();

  // 2. Fetch stato asta (polling + SSE)
  const { data, isLoading: loadingAuction, isError: errorAuction } = useGetAuction(
    auctionId!,
    { query: { enabled: !!auctionId, queryKey: getGetAuctionQueryKey(auctionId!), refetchInterval: 30_000 } },
  );

  // 3. SSE — real-time
  useEffect(() => {
    if (!auctionId) return;
    const es = new EventSource(`/api/auctions/${auctionId}/stream`);
    es.onmessage = (e: MessageEvent<string>) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        queryClient.setQueryData(getGetAuctionQueryKey(auctionId), JSON.parse(e.data) as any);
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [auctionId, queryClient]);

  // 4. Timer countdown (deadline server-authoritative)
  const timerSeconds  = data?.auction.timer_seconds ?? 8;
  const deadlineTs    = (data?.auction.deadline_ts ?? null) as number | null;
  const [remaining, setRemaining] = useState(timerSeconds);
  const currentPlayerId = data?.current_player?.player_id;

  useEffect(() => {
    if (deadlineTs === null) return;
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadlineTs - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [deadlineTs]);

  useEffect(() => {
    setRemaining(timerSeconds);
  }, [currentPlayerId, timerSeconds]);

  // 5. Bid mutation
  const bidMutation = useCreateAuctionBid();
  const [bidError, setBidError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isTransitioningRef = useRef(false);

  // Dati derivati
  const currentPlayer    = data?.current_player;
  const currentBid       = data?.current_bid;
  const isPaused         = data?.auction.status === "paused";
  const isCompleted      = data?.auction.status === "completed";
  const myTeam           = data?.squadre.find((t) => t.id === myTeamId);
  const currentAmount    = currentBid?.amount_fm ?? 0;
  const myCredits        = myTeam?.credits_remaining ?? 0;

  // Verifica ruolo pieno
  const roleMap: Record<string, number> = {
    GK:  data?.auction.roster_p ?? 3,
    DEF: data?.auction.roster_d ?? 8,
    MID: data?.auction.roster_c ?? 8,
    ATT: data?.auction.roster_a ?? 6,
  };
  const myRoleCount = data?.assignments.filter(
    (a) => a.fanta_team_id === myTeamId && a.role_classic === currentPlayer?.role_classic
  ).length ?? 0;
  const roleLimit = roleMap[currentPlayer?.role_classic ?? ""] ?? 0;
  const roleFull  = !!currentPlayer && myRoleCount >= roleLimit;

  // Chi è in testa
  const leadingTeam = data?.squadre.find((t) => t.id === currentBid?.fanta_team_id);
  const imInLead    = !!currentBid && currentBid.fanta_team_id === myTeamId;

  async function placeBid(delta: number) {
    if (!auctionId || !myTeamId || !currentPlayer || isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsTransitioning(true);
    setBidError(null);
    try {
      await bidMutation.mutateAsync({
        id: auctionId,
        data: {
          player_id: currentPlayer.player_id,
          fanta_team_id: myTeamId,
          amount_fm: currentAmount + delta,
        },
      });
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string } })?.data;
      setBidError(body?.error ?? "Offerta non inviata. Riprova.");
    } finally {
      isTransitioningRef.current = false;
      setIsTransitioning(false);
    }
  }

  // ─── Loading / error ────────────────────────────────────────────────────
  if (loadingCtx || loadingAuction) {
    return (
      <div className="min-h-screen bg-[#0d1f1a] flex flex-col items-center justify-center gap-4 p-6">
        <Skeleton className="h-6 w-40 bg-white/10" />
        <Skeleton className="h-32 w-full max-w-sm bg-white/10" />
      </div>
    );
  }

  if (errorCtx || errorAuction || !ctx || !data) {
    return (
      <div className="min-h-screen bg-[#0d1f1a] flex items-center justify-center p-6">
        <p className="text-red-400 font-mono text-sm text-center">
          Collegamento non valido o asta non trovata.
        </p>
      </div>
    );
  }

  // ─── Constraint per ogni tasto +N ───────────────────────────────────────
  const deltas = [1, 2, 3, 5, 10];

  function btnDisabled(delta: number): boolean {
    if (!currentPlayer || isPaused || isCompleted || isTransitioning) return true;
    if (roleFull && !imInLead) return true;  // ruolo pieno, non posso acquisirlo
    if (roleFull && imInLead) return false;  // sto già vincendo — posso auto-rilanciare
    if (currentAmount + delta > myCredits) return true;
    return false;
  }

  function btnReason(delta: number): string | null {
    if (!currentPlayer) return "Nessun giocatore in asta";
    if (isPaused) return "Asta sospesa";
    if (isCompleted) return "Asta completata";
    if (roleFull && !imInLead) return "Ruolo pieno";
    if (currentAmount + delta > myCredits) return "Budget insufficiente";
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0d1f1a] flex flex-col text-[#efe6d3]">

      {/* ─── TOP: asta compatta ─────────────────────────────────────────── */}
      <div className="flex-none px-4 pt-5 pb-4 space-y-4">

        {/* Header squadra */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#efe6d3]/50 uppercase tracking-wider font-mono">La tua squadra</p>
            <p className="font-bold font-serif text-[#efe6d3] text-lg leading-tight">
              {ctx.team_name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#efe6d3]/50 font-mono uppercase tracking-wider">Budget</p>
            <p className="font-mono text-2xl font-bold text-[#efe6d3]">
              {myCredits} <span className="text-sm font-normal text-[#efe6d3]/60">FM</span>
            </p>
          </div>
        </div>

        {/* Giocatore in asta */}
        {currentPlayer ? (
          <div className="rounded-xl bg-[#1f4733]/60 border border-[#1f4733] p-4 space-y-3">
            <div className="flex items-start gap-3">
              {/* Role badge */}
              <span className="mt-0.5 inline-flex items-center justify-center rounded-md bg-[#1f4733] border border-[#efe6d3]/20 w-7 h-7 text-xs font-bold font-mono text-[#efe6d3]/80">
                {roleBadge(currentPlayer.role_classic)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-serif font-bold text-xl text-[#efe6d3] leading-tight truncate">
                  {currentPlayer.full_name}
                </p>
                <p className="text-xs text-[#efe6d3]/50 font-mono">{currentPlayer.real_team}</p>
              </div>

              {/* Timer */}
              <div className="text-right shrink-0">
                {deadlineTs !== null && !isPaused ? (
                  <p
                    className={`font-mono text-3xl font-bold tabular-nums leading-none ${
                      remaining <= 3 ? "text-red-400" : "text-[#efe6d3]"
                    }`}
                  >
                    {formatRemaining(remaining)}
                  </p>
                ) : isPaused ? (
                  <p className="font-mono text-xs text-[#efe6d3]/40 uppercase tracking-wider">Sospesa</p>
                ) : (
                  <p className="font-mono text-xs text-[#efe6d3]/40">—</p>
                )}
                <p className="text-[10px] text-[#efe6d3]/30 font-mono">sec</p>
              </div>
            </div>

            {/* Offerta corrente */}
            <div className="flex items-center justify-between border-t border-[#efe6d3]/10 pt-3">
              <div>
                <p className="text-xs text-[#efe6d3]/40 font-mono uppercase tracking-wider mb-0.5">
                  Offerta attuale
                </p>
                {currentBid ? (
                  <p className="font-mono text-2xl font-bold text-[#efe6d3]">
                    {currentBid.amount_fm}{" "}
                    <span className="text-sm font-normal text-[#efe6d3]/50">FM</span>
                  </p>
                ) : (
                  <p className="font-mono text-sm text-[#efe6d3]/40">Nessuna offerta</p>
                )}
              </div>
              {leadingTeam && (
                <div className="text-right">
                  <p className="text-xs text-[#efe6d3]/40 font-mono uppercase tracking-wider mb-0.5">
                    In testa
                  </p>
                  <p
                    className={`text-sm font-semibold font-serif truncate max-w-[120px] ${
                      imInLead ? "text-green-400" : "text-[#efe6d3]/80"
                    }`}
                  >
                    {imInLead ? "Tu" : (leadingTeam.name_auction ?? leadingTeam.name)}
                  </p>
                </div>
              )}
            </div>

            {/* Bid error */}
            {bidError && (
              <p className="text-red-400 text-xs font-mono text-center">{bidError}</p>
            )}

            {/* Tasti +N */}
            <div className="grid grid-cols-5 gap-2 pt-1">
              {deltas.map((delta) => {
                const disabled = btnDisabled(delta);
                const reason   = btnReason(delta);
                return (
                  <button
                    key={delta}
                    disabled={disabled}
                    onClick={() => void placeBid(delta)}
                    title={reason ?? undefined}
                    className={`
                      flex flex-col items-center justify-center rounded-lg py-3
                      font-mono font-bold text-base leading-none
                      border transition-all select-none active:scale-95
                      ${disabled
                        ? "border-[#efe6d3]/10 bg-transparent text-[#efe6d3]/20 cursor-not-allowed"
                        : "border-[#1f4733] bg-[#1f4733] text-[#efe6d3] hover:bg-[#2a5c45] active:bg-[#163322]"
                      }
                    `}
                  >
                    +{delta}
                    {disabled && reason && (
                      <span className="text-[8px] leading-tight text-[#efe6d3]/25 font-normal mt-0.5 text-center px-0.5">
                        {reason.length > 10 ? reason.slice(0, 9) + "…" : reason}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : isCompleted ? (
          <div className="rounded-xl bg-green-900/30 border border-green-700/40 p-4 text-center">
            <p className="font-serif text-lg text-green-400 font-bold">Asta completata</p>
            <p className="text-xs text-[#efe6d3]/40 font-mono mt-1">{data.progress.sold} aggiudicati</p>
          </div>
        ) : (
          <div className="rounded-xl bg-[#1f4733]/30 border border-dashed border-[#1f4733] p-6 text-center">
            <p className="text-[#efe6d3]/40 font-mono text-sm">Nessun giocatore in asta</p>
          </div>
        )}

        {/* Progress minibar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-[#efe6d3]/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1f4733] rounded-full transition-all"
              style={{ width: `${data.progress.total > 0 ? (data.progress.sold / data.progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[10px] font-mono text-[#efe6d3]/30 shrink-0">
            {data.progress.sold}/{data.progress.total}
          </p>
        </div>
      </div>

      {/* ─── BOTTOM: Suggerimenti AI ────────────────────────────────────────── */}
      <div className="flex-1 mx-4 mb-4 rounded-xl border border-[#efe6d3]/8 bg-[#1f4733]/10 flex flex-col items-center justify-center gap-2 min-h-[160px]">
        <p className="font-serif text-[#efe6d3]/30 text-base">Suggerimenti AI</p>
        <p className="font-mono text-[10px] text-[#efe6d3]/20 uppercase tracking-widest">Prossimamente</p>
      </div>
    </div>
  );
}
