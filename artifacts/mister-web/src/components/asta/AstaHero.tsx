import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  GK:  { bg: "bg-amber-100",  text: "text-amber-800",  label: "P" },
  DEF: { bg: "bg-blue-100",   text: "text-blue-800",   label: "D" },
  MID: { bg: "bg-green-100",  text: "text-green-800",  label: "C" },
  ATT: { bg: "bg-red-100",    text: "text-red-800",    label: "A" },
};

const CIRC = 251; // 2π × r40

interface AstaHeroProps {
  currentPlayer: {
    player_id: number;
    position: number;
    name: string;
    full_name: string;
    role_classic: string;
    real_team: string;
  } | null;
  currentBid: {
    id: string;
    fanta_team_id: string;
    amount_fm: number;
    created_at: string | Date;
  } | null;
  squadre: Array<{ id: string; name: string; name_auction?: string | null }>;
  timerRemaining: number;
  timerTotal: number;
  timerActive: boolean;
  isPaused: boolean;
  canAssign: boolean;
  bidsDisabled: boolean;
  progress: { current: number; total: number; sold: number };
  // Voce
  micActive: boolean;
  micSupported: boolean;
  onMicToggle: () => void;
  // Azioni
  onAggiudica: () => void;
  onPauseResume: () => void;
  onSalta: () => void;
}

export function AstaHero({
  currentPlayer,
  currentBid,
  squadre,
  timerRemaining,
  timerTotal,
  timerActive,
  isPaused,
  canAssign,
  bidsDisabled,
  progress,
  micActive,
  micSupported,
  onMicToggle,
  onAggiudica,
  onPauseResume,
  onSalta,
}: AstaHeroProps) {
  const role = currentPlayer ? (ROLE_COLORS[currentPlayer.role_classic] ?? ROLE_COLORS.ATT) : null;

  const leadingTeam = currentBid
    ? (squadre.find((t) => t.id === currentBid.fanta_team_id)?.name_auction
        ?? squadre.find((t) => t.id === currentBid.fanta_team_id)?.name
        ?? "—")
    : null;

  // Timer ring — r=40, CIRC ≈ 251
  const fraction    = (timerActive || isPaused) ? timerRemaining / timerTotal : 1;
  const dashOffset  = CIRC * (1 - fraction);
  const ringColor   =
    !timerActive && !isPaused ? "#d1c5a8"
    : timerRemaining <= 3     ? "#e2554e"
    : "#c8922b";

  const timerDisplay: number | string =
    timerActive   ? timerRemaining
    : isPaused    ? timerRemaining
    : "—";

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "1.15fr 0.9fr 1fr" }}>

      {/* ── SINISTRA: Giocatore corrente ─── */}
      <div className="rounded-xl border bg-card p-4 flex flex-col gap-2 min-w-0">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">
          In asta
        </p>
        {currentPlayer ? (
          <>
            <div className="flex items-center gap-2">
              {role && (
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold font-mono text-sm shrink-0 ${role.bg} ${role.text}`}>
                  {role.label}
                </span>
              )}
              <span className="text-[11px] font-mono text-muted-foreground bg-muted/40 rounded-full px-2 py-0.5 truncate">
                #{currentPlayer.position + 1} di {progress.total}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="font-serif font-semibold text-[28px] leading-tight text-primary tracking-tight truncate">
                {currentPlayer.full_name}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5 font-mono truncate">{currentPlayer.real_team}</p>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono mt-auto">
              Base d'asta: <span className="font-bold text-foreground">1 FM</span>
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground font-mono">In attesa del prossimo giocatore…</p>
        )}
      </div>

      {/* ── CENTRO: Timer + Offerta corrente ─── */}
      <div className="rounded-xl border bg-card p-4 flex flex-col items-center justify-center gap-2 text-center">
        <div className="relative w-[92px] h-[92px] shrink-0">
          <svg width="92" height="92" viewBox="0 0 92 92" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="46" cy="46" r="40" fill="none" stroke="#e0d4b6" strokeWidth="6" />
            <circle
              cx="46" cy="46" r="40" fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${CIRC} ${CIRC}`}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.5s linear, stroke 0.3s" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif font-semibold text-[30px] leading-none text-foreground">
              {timerDisplay}
            </span>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
            Offerta attuale
          </p>
          {currentBid ? (
            <>
              <p className="font-serif font-semibold text-[23px] leading-tight text-primary">
                {currentBid.amount_fm}{" "}
                <span className="text-sm font-mono font-normal">FM</span>
              </p>
              <p className="text-[12px] font-mono text-muted-foreground">
                da <span className="font-bold text-amber-700">{leadingTeam}</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground font-mono">Nessuna offerta</p>
          )}
        </div>
      </div>

      {/* ── DESTRA: Controlli ─── */}
      <div className="rounded-xl border bg-card p-4 flex flex-col gap-3 justify-center">

        {/* ── Toggle microfono (Parte 3) ── */}
        <button
          onClick={onMicToggle}
          disabled={!micSupported}
          className={[
            "flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5",
            "font-mono font-bold text-sm transition-colors",
            micActive
              ? "bg-[#1f4733] text-[#efe6d3] hover:bg-[#1f4733]/90"
              : "bg-muted/40 text-foreground hover:bg-muted/70",
            !micSupported ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
          ].join(" ")}
        >
          {micActive ? (
            <>
              {/* Indicatore pulsante rosso quando attivo */}
              <span className="relative shrink-0 w-4 h-4 flex items-center justify-center">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span>Microfono attivo</span>
              <span className="ml-auto text-[10px] font-normal opacity-70">in ascolto…</span>
            </>
          ) : (
            <>
              <MicOff className="h-4 w-4 shrink-0" />
              <span>Microfono</span>
              {!micSupported && (
                <span className="ml-auto text-[10px] font-normal opacity-60">non supportato</span>
              )}
            </>
          )}
        </button>

        <div className="flex gap-2">
          <Button
            className="flex-1 bg-[#1f4733] text-[#efe6d3] hover:bg-[#1f4733]/90 text-sm h-9"
            onClick={onAggiudica}
            disabled={!canAssign}
          >
            Aggiudica
          </Button>
          <Button
            variant="outline"
            className="flex-1 text-sm h-9"
            onClick={onPauseResume}
            disabled={bidsDisabled}
          >
            {isPaused ? "Riprendi" : "Pausa"}
          </Button>
        </div>

        <Button
          variant="ghost"
          className="w-full text-muted-foreground text-sm h-9"
          onClick={onSalta}
          disabled={bidsDisabled || !currentPlayer}
        >
          Salta
        </Button>
      </div>
    </div>
  );
}
