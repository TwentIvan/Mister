import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Team {
  id: string;
  name: string;
  name_auction?: string | null;
  credits_remaining: number;
}

interface SidebarSquadreProps {
  squadre: Team[];
  currentBidAmount: number;
  isPaused: boolean;
  isLoading: boolean;
  onBid: (fantaTeamId: string, delta: number) => void;
}

const DELTAS = [1, 5, 10] as const;

export function SidebarSquadre({
  squadre,
  currentBidAmount,
  isPaused,
  isLoading,
  onBid,
}: SidebarSquadreProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Squadre ({squadre.length})
      </p>
      <div className="space-y-2">
        {squadre.map((team) => (
          <div key={team.id} className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{team.name}</span>
              <span className="font-mono text-sm font-bold text-primary">
                {team.credits_remaining} FM
              </span>
            </div>
            {team.name_auction && (
              <p className="text-[10px] font-mono text-muted-foreground">{team.name_auction}</p>
            )}
            <div className="flex gap-1">
              {DELTAS.map((delta) => {
                const newAmount = currentBidAmount + delta;
                const canAfford = team.credits_remaining >= newAmount;
                const disabled = isPaused || isLoading || !canAfford;
                return (
                  <Button
                    key={delta}
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1 text-xs h-7 px-1 font-mono"
                    disabled={disabled}
                    onClick={() => onBid(team.id, delta)}
                    title={!canAfford ? `Crediti insufficienti (serve ${newAmount} FM)` : `Offri ${newAmount} FM`}
                  >
                    <Plus className="h-3 w-3" />
                    {delta}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
