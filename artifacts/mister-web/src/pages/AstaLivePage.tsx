import { useEffect, useRef, useState } from "react";
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
  useUndoAuction,
  useCallPlayer,
  useGetAuctionQueue,
  getGetAuctionQueueQueryKey,
} from "@workspace/api-client-react";
import type { PlayerVoice } from "@/hooks/useVoiceBidder";
import { AstaHero } from "@/components/asta/AstaHero";
import { TabelloneSquadre } from "@/components/asta/TabelloneSquadre";
import { CorreggiPanel } from "@/components/asta/CorreggiPanel";
import { useVoiceBidder } from "@/hooks/useVoiceBidder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Gavel, Mic, Pencil, Phone } from "lucide-react";

export default function AstaLivePage() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const { data, isLoading: isLoadingAuction, isError, refetch } = useGetAuction(
    auctionId!,
    { query: { enabled: !!auctionId, queryKey: getGetAuctionQueryKey(auctionId!), refetchInterval: 5000 } },
  );

  // ── INTERVENTO 1: timer su deadline assoluto ─────────────────────────────
  const [deadlineTs, setDeadlineTs] = useState<number | null>(null);
  const timerSeconds = data?.auction.timer_seconds ?? 8;
  const [remaining, setRemaining] = useState(timerSeconds);
  const remainingMsOnPauseRef = useRef<number>(0);

  // ── Transition lock ───────────────────────────────────────────────────────
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isTransitioningRef = useRef(false);

  const [bidError, setBidError] = useState<string | null>(null);
  const [aggiudicatoVisible, setAggiudicatoVisible] = useState(false);

  // ── Chiamata mode: ricerca giocatore ─────────────────────────────────────
  const [callSearch, setCallSearch] = useState("");
  const [disambCandidates, setDisambCandidates] = useState<PlayerVoice[] | null>(null);

  const bidMutation    = useCreateAuctionBid();
  const assignMutation = useAssignAuction();
  const skipMutation   = useSkipAuction();
  const pauseMutation  = usePauseAuction();
  const resumeMutation = useResumeAuction();
  const endMutation    = useEndAuction();
  const undoMutation   = useUndoAuction();
  const callMutation   = useCallPlayer();

  // ── Correggi panel ────────────────────────────────────────────────────────
  const [correggiOpen, setCorreggiOpen] = useState(false);

  // ── canUndo: server-authoritative (lastUndoableAction != null) ───────────
  const canUndo = data?.auction.undoable ?? false;

  const auctionStatus = data?.auction.status;
  const callMode      = data?.auction.call_mode ?? "listone";
  const isPaused      = auctionStatus === "paused";
  const isCompleted   = auctionStatus === "completed";

  // ── Timer tick ───────────────────────────────────────────────────────────
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

  // ── placeBid: unica entry-point per i bid (tasti + voce) ─────────────────
  // Contiene il guard isTransitioningRef, la mutation e l'estensione del timer.
  // handleBid (delta) e la voce (assoluto) la chiamano entrambi: nessun path parallelo.
  const placeBid = async (fantaTeamId: string, amountAbsoluto: number) => {
    if (!auctionId || !data?.current_player || isTransitioningRef.current) return;
    const targetPlayerId = data.current_player.player_id;
    setBidError(null);
    try {
      await bidMutation.mutateAsync({
        id: auctionId,
        data: { player_id: targetPlayerId, fanta_team_id: fantaTeamId, amount_fm: amountAbsoluto },
      });
      setDeadlineTs(Date.now() + timerSeconds * 1000);
      refetch();
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string } })?.data;
      setBidError(body?.error ?? "Offerta non registrata. Riprova.");
    }
  };

  // handleBid: wrapper usato dai tasti +N del tabellone
  const handleBid = async (fantaTeamId: string, delta: number) => {
    const currentAmount = data?.current_bid?.amount_fm ?? 0;
    await placeBid(fantaTeamId, currentAmount + delta);
  };

  // ── handleAggiudica ──────────────────────────────────────────────────────
  const handleAggiudica = async () => {
    if (!auctionId || !data?.current_player) return;
    isTransitioningRef.current = true;
    setIsTransitioning(true);
    setDeadlineTs(null);
    try {
      await assignMutation.mutateAsync({
        id: auctionId,
        data: { player_id: data.current_player.player_id },
      });
      setAggiudicatoVisible(true);
      await refetch();
      setTimeout(() => setAggiudicatoVisible(false), 1500);
    } finally {
      isTransitioningRef.current = false;
      setIsTransitioning(false);
    }
  };

  // ── handleSalta ──────────────────────────────────────────────────────────
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

  // ── handleUndo ────────────────────────────────────────────────────────────
  const handleUndo = async () => {
    if (!auctionId || !canUndo || isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsTransitioning(true);
    setDeadlineTs(null);
    try {
      await undoMutation.mutateAsync({ id: auctionId });
      await refetch();
    } finally {
      isTransitioningRef.current = false;
      setIsTransitioning(false);
    }
  };

  // ── handlePauseResume ────────────────────────────────────────────────────
  const handlePauseResume = async () => {
    if (!auctionId) return;
    if (isPaused) {
      const savedMs = remainingMsOnPauseRef.current;
      await resumeMutation.mutateAsync({ id: auctionId });
      await refetch();
      if (savedMs > 0) setDeadlineTs(Date.now() + savedMs);
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

  // ── handleCall: chiama un giocatore svincolato in modalità chiamata ───────
  const handleCall = async (playerId: number) => {
    if (!auctionId || isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsTransitioning(true);
    setDisambCandidates(null);
    try {
      await callMutation.mutateAsync({ id: auctionId, data: { player_id: playerId } });
      setCallSearch("");
      await refetch();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error;
      setBidError(msg ?? "Impossibile chiamare il giocatore.");
    } finally {
      isTransitioningRef.current = false;
      setIsTransitioning(false);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const isMutating =
    bidMutation.isPending ||
    assignMutation.isPending ||
    skipMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    endMutation.isPending ||
    undoMutation.isPending ||
    callMutation.isPending;

  const timerActive  = deadlineTs !== null && !isPaused;
  const canAssign    = !!(data?.current_bid) && !isMutating && !isTransitioning && !isPaused;
  const bidsDisabled = isMutating || isTransitioning;

  // ── PARTE 3: voce ─────────────────────────────────────────────────────────
  // squadreForVoice viene calcolato sempre (anche prima dei data checks) per evitare
  // chiamate hook condizionali; se data non è ancora disponibile la lista è vuota.
  const squadreForVoice = (data?.squadre ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    name_auction: t.name_auction ?? null,
  }));

  // In chiamata mode: lista giocatori pending nella coda dell'asta (non dal catalogo globale)
  const queueSearchParams = callMode === "chiamata"
    ? { search: callSearch.length >= 2 ? callSearch : undefined }
    : undefined;
  const { data: queueData } = useGetAuctionQueue(
    auctionId!,
    queueSearchParams,
    { query: { enabled: callMode === "chiamata" && !!auctionId, staleTime: 10_000, queryKey: getGetAuctionQueueQueryKey(auctionId!, queueSearchParams) } },
  );

  // Lista NON filtrata per il riconoscimento vocale: indipendente dalla ricerca UI.
  // Se usassimo queueData (filtrata), un callSearch attivo (es. "berardi") azzererebbe
  // svincolati → parseIntent salterebbe silenziosamente il branch "chiamo".
  const { data: queueVoiceData } = useGetAuctionQueue(
    auctionId!,
    undefined,
    { query: { enabled: callMode === "chiamata" && !!auctionId, staleTime: 30_000, queryKey: getGetAuctionQueueQueryKey(auctionId!, undefined) } },
  );

  const assignedPlayerIds = new Set((data?.assignments ?? []).map((a) => a.player_id));
  const allFetchedPlayers = (queueData?.players ?? []);
  const svincolatiForVoice = (queueVoiceData?.players ?? []).map((p) => ({ id: p.id, name: p.name, real_team: p.real_team }));

  const voice = useVoiceBidder({
    squadre: squadreForVoice,
    onPlaceBid: placeBid,
    onAggiudica: handleAggiudica,
    onSalta: handleSalta,
    // Voce pausa/riprendi: chiamano handlePauseResume solo se il flag corrisponde,
    // così "mister pausa" non fa riprendi se già in pausa e viceversa.
    onPausa:    () => { if (!isPaused) void handlePauseResume(); },
    onRiprendi: () => { if (isPaused)  void handlePauseResume(); },
    svincolati:           callMode === "chiamata" ? svincolatiForVoice : undefined,
    onChiama:             callMode === "chiamata" ? handleCall : undefined,
    onChiamaAmbiguous:    callMode === "chiamata" ? (candidates) => setDisambCandidates(candidates) : undefined,
    onSeleziona:          callMode === "chiamata" ? (n) => {
      const p = disambCandidates?.[n - 1];
      if (p) void handleCall(p.id);
      else setDisambCandidates(null);
    } : undefined,
  });

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
            <Badge variant="outline" className="border-green-400 text-green-700">Completata</Badge>
          )}
          <p className="text-sm text-muted-foreground font-mono">
            {data.progress.current}/{data.progress.total}
            {" · "}
            <span className="font-bold text-foreground">{data.progress.sold}</span> aggiudicati
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-primary"
            onClick={() => setCorreggiOpen(true)}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Correggi
          </Button>
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

      {/* ── CHIAMA IL PROSSIMO (solo in modalità chiamata, quando nessun giocatore è in asta) ── */}
      {callMode === "chiamata" && !data?.current_player && !isCompleted && !isPaused && (
        <div className="rounded-xl border-2 border-dashed border-primary/30 bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <span className="font-semibold font-serif text-primary text-sm">Chiama il prossimo giocatore</span>
            <span className="text-xs text-muted-foreground font-mono ml-auto">
              Voce: «chiamo [nome] [squadra]»
            </span>
          </div>
          <input
            type="text"
            placeholder="Cerca per nome o squadra…"
            value={callSearch}
            onChange={(e) => setCallSearch(e.target.value)}
            className="w-full h-9 rounded-md border bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {callSearch.length >= 2 && (
            <div className="max-h-52 overflow-y-auto rounded-md border divide-y">
              {allFetchedPlayers.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground font-mono">Nessun giocatore trovato</p>
              ) : (
                allFetchedPlayers.map((p) => {
                  const isAssigned = assignedPlayerIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      disabled={isAssigned || isTransitioning}
                      onClick={() => !isAssigned && void handleCall(p.id)}
                      className={[
                        "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                        isAssigned
                          ? "opacity-30 cursor-not-allowed"
                          : "hover:bg-muted cursor-pointer",
                      ].join(" ")}
                    >
                      <span className={[
                        "font-mono text-[10px] uppercase font-bold w-6 text-center",
                        p.role_classic === "GK"  ? "text-amber-700" :
                        p.role_classic === "DEF" ? "text-blue-700"  :
                        p.role_classic === "MID" ? "text-green-700" :
                                                   "text-red-700",
                      ].join(" ")}>
                        {p.role_classic === "GK" ? "P" : p.role_classic === "DEF" ? "D" : p.role_classic === "MID" ? "C" : "A"}
                      </span>
                      <span className="font-mono font-semibold flex-1">{p.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{p.real_team}</span>
                      {isAssigned && (
                        <span className="text-xs text-muted-foreground font-mono">già assegnato</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ── FASCIA HERO ─────────────────────────────────────────── */}
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
          micActive={voice.isActive}
          micSupported={voice.supported}
          onMicToggle={voice.toggle}
          onAggiudica={handleAggiudica}
          onPauseResume={handlePauseResume}
          onSalta={handleSalta}
          canUndo={canUndo}
          onUndo={handleUndo}
        />
      )}

      {/* ── AVVISO NOMI VOCE SIMILI (VV4) ───────────────────────── */}
      {voice.voiceNameConflicts.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-mono text-amber-800 space-y-0.5">
          <p className="font-semibold">Nomi voce troppo simili — rischio confusione:</p>
          {voice.voiceNameConflicts.map(({ a, b }) => (
            <p key={`${a}-${b}`}>• «{a}» e «{b}» — modifica uno dei due nomi voce per renderli distinti.</p>
          ))}
        </div>
      )}

      {/* ── FEEDBACK VOCE ────────────────────────────────────────── */}
      {!isCompleted && (voice.isActive || !!voice.lastCommand) && (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-2 text-sm font-mono min-h-[40px]">
          {voice.isActive && (
            <Mic className="h-3.5 w-3.5 text-red-500 animate-pulse shrink-0" />
          )}
          {voice.transcript ? (
            <span className="text-muted-foreground italic truncate flex-1">
              {voice.transcript}
            </span>
          ) : voice.isActive ? (
            <span className="text-muted-foreground/60 italic flex-1">In ascolto…</span>
          ) : (
            <span className="flex-1" />
          )}
          {voice.lastCommand && (
            <span className="text-green-700 font-bold shrink-0 ml-auto">
              {voice.lastCommand}
            </span>
          )}
        </div>
      )}

      {/* ── TABELLONE ────────────────────────────────────────────── */}
      <TabelloneSquadre
        squadre={squadreForComponents}
        assignments={(data.assignments ?? []).map((a) => ({
          player_id:      a.player_id,
          player_name:    a.player_name,
          role_classic:   a.role_classic,
          fanta_team_id:  a.fanta_team_id,
          final_price_fm: a.final_price_fm,
        }))}
        rosterP={data.auction.roster_p}
        rosterD={data.auction.roster_d}
        rosterC={data.auction.roster_c}
        rosterA={data.auction.roster_a}
        currentPlayerRole={data.current_player?.role_classic ?? null}
        currentBidTeamId={data.current_bid?.fanta_team_id ?? null}
        currentBidAmount={data.current_bid?.amount_fm ?? 0}
        isPaused={isPaused || isCompleted}
        isLoading={bidsDisabled}
        onBid={handleBid}
      />

      {/* ── MODALE DISAMBIGUAZIONE CHIAMATA ─────────────────────── */}
      <Dialog open={!!disambCandidates} onOpenChange={(open) => { if (!open) setDisambCandidates(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-primary">Quale giocatore?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground font-mono mb-2">
            Dì «seleziona il numero» seguito dal numero, oppure clicca.
          </p>
          <div className="divide-y rounded-md border overflow-hidden">
            {(disambCandidates ?? []).map((p, i) => (
              <button
                key={p.id}
                onClick={() => void handleCall(p.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors"
              >
                <span className="font-mono text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                <span className="font-mono font-semibold flex-1">{p.name}</span>
                <span className="text-xs text-muted-foreground font-mono">{p.real_team}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CORREGGI PANEL ───────────────────────────────────────── */}
      {correggiOpen && (
        <CorreggiPanel
          auctionId={auctionId!}
          squadre={squadreForComponents}
          assignments={(data.assignments ?? []).map((a) => ({
            player_id:      a.player_id,
            player_name:    a.player_name,
            role_classic:   a.role_classic,
            fanta_team_id:  a.fanta_team_id,
            final_price_fm: a.final_price_fm,
          }))}
          onClose={() => setCorreggiOpen(false)}
          onRefetch={() => void refetch()}
        />
      )}
    </div>
  );
}
