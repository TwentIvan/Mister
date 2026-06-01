import { useEffect, useRef } from "react";

interface BidItem {
  id: string;
  fanta_team_id: string;
  amount_fm: number;
  created_at: string | Date;
}

interface BidFeedProps {
  bids: BidItem[];
  squadre: Array<{ id: string; name: string; name_auction?: string | null }>;
}

function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffS = Math.round((now - then) / 1000);
  if (diffS < 5) return "ora";
  if (diffS < 60) return `${diffS}s fa`;
  const diffM = Math.round(diffS / 60);
  return `${diffM}m fa`;
}

export function BidFeed({ bids, squadre }: BidFeedProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [bids.length]);

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Offerte
      </p>
      <div ref={listRef} className="space-y-1 max-h-64 overflow-y-auto">
        {bids.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            In attesa della prima offerta...
          </p>
        ) : (
          bids.map((bid, idx) => {
            const team = squadre.find((t) => t.id === bid.fanta_team_id);
            const teamLabel = team?.name_auction ?? team?.name ?? bid.fanta_team_id;
            return (
              <div
                key={bid.id}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
                  idx === 0 ? "bg-primary/10 border border-primary/20" : "bg-muted/30"
                }`}
                style={{
                  animation: idx === 0 ? "fadeIn 0.3s ease" : undefined,
                }}
              >
                <span className="font-mono text-muted-foreground truncate max-w-[110px]">{teamLabel}</span>
                <span className="font-mono font-bold text-primary ml-2">{bid.amount_fm} FM</span>
                <span className="font-mono text-muted-foreground ml-2 shrink-0">{timeAgo(bid.created_at)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
