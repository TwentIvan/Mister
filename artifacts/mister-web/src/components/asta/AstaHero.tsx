import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  GK:  { bg: "bg-amber-100",  text: "text-amber-800",  label: "P" },
  DEF: { bg: "bg-blue-100",   text: "text-blue-800",   label: "D" },
  MID: { bg: "bg-green-100",  text: "text-green-800",  label: "C" },
  ATT: { bg: "bg-red-100",    text: "text-red-800",    label: "A" },
};

const CIRC = 264; // 2π × r42

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

  // Timer ring
  const fraction = (timerActive || isPaused) ? timerRemaining / timerTotal : 1;
  const dashOffset = CIRC * (1 - fraction);
  const ringColor =
    !timerActive && !isPaused ? "#d1c5a8"
    : timerRemaining <= 3 ? "#e2554e"
    : "#c8922b";

  const timerDisplay: number | string =
    timerActive ? timerRemaining
    : isPaused ? timerRemaining
    : "—";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr_1fr] gap-3">
      {/* ── SINISTRA: Giocatore corrente ─── */}
      <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">
          In asta
        </p>
        {currentPlayer ? (
          <>
            <div className="flex items-center gap-2.5">
              {role && (
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold font-mono text-sm ${role.bg} ${role.text}`}>
                  {role.label}
                </span>
              )}
              <span className="text-xs font-mono text-muted-foreground bg-muted/40 rounded-full px-2.5 py-0.5">
                #{currentPlayer.position + 1} di {progress.total}
              </span>
            </div>
            <div>
              <h2 className="font-serif font-semibold text-[26px] leading-tight text-primary tracking-tight">
                {currentPlayer.full_name}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5 font-mono">{currentPlayer.real_team}</p>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-auto">
              Base d'asta: <span className="font-bold text-foreground">1 FM</span>
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">In attesa del prossimo giocatore…</p>
        )}
      </div>

      {/* ── CENTRO: Timer + Offerta corrente ─── */}
      <div className="rounded-xl border bg-card p-4 flex flex-col items-center justify-center gap-2 text-center">
        {/* Timer ring */}
        <div className="relative w-24 h-24">
          <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="48" cy="48" r="42" fill="none" stroke="#e0d4b6" strokeWidth="6" />
            <circle
              cx="48" cy="48" r="42" fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${CIRC} ${CIRC}`}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.5s linear, stroke 0.3s" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif font-semibold text-[32px] leading-none text-foreground">
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
              <p className="font-serif font-semibold text-2xl text-primary">
                {currentBid.amount_fm} <span className="text-base font-mono font-normal">FM</span>
              </p>
              <p className="text-xs font-mono text-muted-foreground">
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
        {/* Mic toggle — cablato nella Parte 3 */}
        <button
          disabled
          className="flex items-center gap-2.5 w-full bg-[#1f4733] text-[#efe6d3] rounded-lg px-3 py-2.5 font-mono font-bold text-sm opacity-40 cursor-not-allowed"
        >
          <MicOff className="h-4 w-4 shrink-0" />
          <span>Microfono</span>
          <span className="ml-auto text-[10px] font-normal opacity-70">Parte 3</span>
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
