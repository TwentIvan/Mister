import { TimerCircular } from "./TimerCircular";

interface CurrentBidPanelProps {
  currentBid: {
    amount_fm: number;
    fanta_team_id: string;
  } | null;
  squadre: Array<{ id: string; name: string; name_auction?: string | null }>;
  timerRemaining: number;
  timerTotal: number;
  timerActive: boolean;
}

export function CurrentBidPanel({
  currentBid,
  squadre,
  timerRemaining,
  timerTotal,
  timerActive,
}: CurrentBidPanelProps) {
  const winningTeam = currentBid
    ? squadre.find((t) => t.id === currentBid.fanta_team_id)
    : null;

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4 rounded-xl border bg-card">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Offerta attuale</p>
        {currentBid ? (
          <>
            <p className="text-5xl font-bold font-mono text-primary leading-none">
              {currentBid.amount_fm}
              <span className="text-xl font-normal text-muted-foreground ml-1">FM</span>
            </p>
            <p className="text-sm font-mono text-muted-foreground mt-1">
              {winningTeam?.name_auction ?? winningTeam?.name ?? currentBid.fanta_team_id}
            </p>
          </>
        ) : (
          <>
            <p className="text-5xl font-bold font-mono text-muted-foreground leading-none">—</p>
            <p className="text-sm text-muted-foreground mt-1">Nessuna offerta</p>
          </>
        )}
      </div>
      <TimerCircular remaining={timerRemaining} total={timerTotal} active={timerActive} />
    </div>
  );
}
