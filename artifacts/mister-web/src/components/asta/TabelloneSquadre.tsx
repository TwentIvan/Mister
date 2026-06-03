interface AssignmentItem {
  player_id: number;
  player_name: string;
  role_classic: string;
  fanta_team_id: string;
  final_price_fm: number;
}

interface Squadra {
  id: string;
  name: string;
  name_auction?: string | null;
  credits_remaining: number;
}

interface TabelloneSquadreProps {
  squadre: Squadra[];
  assignments: AssignmentItem[];
  rosterP: number;
  rosterD: number;
  rosterC: number;
  rosterA: number;
  currentBidTeamId: string | null;
  currentBidAmount: number;
  isPaused: boolean;
  isLoading: boolean;
  onBid: (fantaTeamId: string, delta: number) => void;
}

type RoleKey = "GK" | "DEF" | "MID" | "ATT";

const ROLE_CONFIG: Record<RoleKey, { label: string; abbr: string; color: string }> = {
  GK:  { label: "PORTIERI",  abbr: "P", color: "text-amber-700" },
  DEF: { label: "DIFENSORI", abbr: "D", color: "text-blue-700"  },
  MID: { label: "CENTROC.",  abbr: "C", color: "text-green-700" },
  ATT: { label: "ATTACC.",   abbr: "A", color: "text-red-700"   },
};
const ROLE_ORDER: RoleKey[] = ["GK", "DEF", "MID", "ATT"];

export function TabelloneSquadre({
  squadre,
  assignments,
  rosterP,
  rosterD,
  rosterC,
  rosterA,
  currentBidTeamId,
  isPaused,
  isLoading,
  onBid,
}: TabelloneSquadreProps) {
  const rosterByRole: Record<RoleKey, number> = {
    GK: rosterP, DEF: rosterD, MID: rosterC, ATT: rosterA,
  };

  const byTeam = new Map<string, Map<RoleKey, AssignmentItem[]>>();
  for (const a of assignments) {
    if (!byTeam.has(a.fanta_team_id)) byTeam.set(a.fanta_team_id, new Map());
    const byRole = byTeam.get(a.fanta_team_id)!;
    const rk = a.role_classic as RoleKey;
    if (!byRole.has(rk)) byRole.set(rk, []);
    byRole.get(rk)!.push(a);
  }

  const canBid = !isPaused && !isLoading;
  const n = squadre.length || 1;

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline gap-3 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Rose &amp; budget
        </p>
        <p className="text-[11px] font-mono text-muted-foreground">
          {n} squadre · {rosterP}P · {rosterD}D · {rosterC}C · {rosterA}A
          {" · "}{assignments.length} acquisti
        </p>
      </div>

      {/* Board: fluid grid, no horizontal scroll, all columns fit */}
      <div className="w-full rounded-xl border bg-card overflow-hidden">
        <div
          className="grid bg-border"
          style={{
            gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
            gap: "1px",
          }}
        >
          {squadre.map((team) => {
            const isLead = team.id === currentBidTeamId;
            const teamRoles = byTeam.get(team.id) ?? new Map<RoleKey, AssignmentItem[]>();
            const displayName = team.name_auction ?? team.name;

            return (
              <div
                key={team.id}
                className={[
                  "bg-card flex flex-col min-w-0",
                  "px-2 pt-2.5 pb-2",
                  isLead ? "ring-2 ring-inset ring-amber-400" : "",
                ].join(" ")}
              >
                {/* Header squadra */}
                <div className="flex items-baseline justify-between gap-1 border-b border-border pb-1.5 mb-1.5 min-w-0">
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="font-serif font-semibold text-[12px] leading-tight truncate text-primary">
                      {displayName}
                    </p>
                    {team.name_auction && (
                      <p className="text-[9px] font-mono text-muted-foreground truncate uppercase tracking-wide">
                        {team.name}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right pl-1">
                    <span className="font-mono font-bold text-[16px] leading-tight text-primary">
                      {team.credits_remaining}
                    </span>
                    <span className="font-mono text-[8.5px] text-muted-foreground ml-0.5">FM</span>
                  </div>
                </div>

                {/* Role groups */}
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  {ROLE_ORDER.map((role) => {
                    const cfg = ROLE_CONFIG[role];
                    const filled = teamRoles.get(role) ?? [];
                    const total = rosterByRole[role];
                    const emptyCount = Math.max(0, total - filled.length);

                    return (
                      <div key={role} className="min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-[8.5px] font-mono font-bold uppercase tracking-wide ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-[8.5px] font-mono text-muted-foreground">
                            {filled.length}/{total}
                          </span>
                        </div>

                        {filled.map((p) => (
                          <div
                            key={p.player_id}
                            className="flex items-baseline justify-between min-w-0 py-px gap-1"
                          >
                            <span className="flex-1 min-w-0 truncate font-mono text-[10px] text-foreground">
                              {p.player_name}
                            </span>
                            <span className="shrink-0 font-mono font-bold text-amber-600 text-[9.5px]">
                              {p.final_price_fm}
                            </span>
                          </div>
                        ))}

                        {Array.from({ length: emptyCount }).map((_, i) => (
                          <div key={i} className="flex items-center py-px gap-1 min-w-0">
                            <span className="flex-1 border-b border-dashed border-border/40" />
                            <span className={`shrink-0 font-mono text-[9px] ${cfg.color} opacity-40`}>
                              {cfg.abbr}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                {/* Bid buttons */}
                <div className="flex gap-1 pt-2 border-t border-border mt-2">
                  {[1, 5, 10].map((delta) => (
                    <button
                      key={delta}
                      onClick={() => onBid(team.id, delta)}
                      disabled={!canBid}
                      className="flex-1 border border-border rounded-md py-1 font-mono font-bold text-[10px] text-primary/80 bg-card hover:bg-muted/30 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                    >
                      +{delta}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
