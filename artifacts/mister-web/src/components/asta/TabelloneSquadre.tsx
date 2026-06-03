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
  GK:  { label: "PORTIERI",    abbr: "P", color: "text-amber-700" },
  DEF: { label: "DIFENSORI",   abbr: "D", color: "text-blue-700"  },
  MID: { label: "CENTROC.",    abbr: "C", color: "text-green-700" },
  ATT: { label: "ATTACC.",     abbr: "A", color: "text-red-700"   },
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

  // group assignments by team × role
  const byTeam = new Map<string, Map<RoleKey, AssignmentItem[]>>();
  for (const a of assignments) {
    if (!byTeam.has(a.fanta_team_id)) {
      byTeam.set(a.fanta_team_id, new Map());
    }
    const byRole = byTeam.get(a.fanta_team_id)!;
    const rk = a.role_classic as RoleKey;
    if (!byRole.has(rk)) byRole.set(rk, []);
    byRole.get(rk)!.push(a);
  }

  const canBid = !isPaused && !isLoading;

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Rose &amp; budget
        </p>
        <p className="text-[10px] font-mono text-muted-foreground">
          {rosterP}P · {rosterD}D · {rosterC}C · {rosterA}A
          {" · "}{assignments.length} acquisti
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <div
          className="grid gap-px bg-border"
          style={{ gridTemplateColumns: `repeat(${squadre.length}, minmax(148px, 1fr))` }}
        >
          {squadre.map((team) => {
            const isLead = team.id === currentBidTeamId;
            const teamRoles = byTeam.get(team.id) ?? new Map<RoleKey, AssignmentItem[]>();

            return (
              <div
                key={team.id}
                className={`bg-card flex flex-col p-3 gap-2 ${isLead ? "ring-2 ring-inset ring-amber-400" : ""}`}
              >
                {/* Header squadra */}
                <div className="border-b border-border pb-2 mb-0.5">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="font-serif font-semibold text-[13px] leading-tight truncate">
                        {team.name_auction ?? team.name}
                      </p>
                      {team.name_auction && (
                        <p className="text-[9.5px] font-mono text-muted-foreground truncate">{team.name}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-mono font-bold text-[15px] text-primary">{team.credits_remaining}</span>
                      <span className="font-mono text-[9px] text-muted-foreground ml-0.5">FM</span>
                    </div>
                  </div>
                </div>

                {/* Role groups */}
                <div className="flex flex-col gap-2 flex-1">
                  {ROLE_ORDER.map((role) => {
                    const cfg = ROLE_CONFIG[role];
                    const filled = teamRoles.get(role) ?? [];
                    const total = rosterByRole[role];
                    const emptyCount = Math.max(0, total - filled.length);

                    return (
                      <div key={role}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-[9px] font-mono font-bold uppercase tracking-wide ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-[9px] font-mono text-muted-foreground">
                            {filled.length}/{total}
                          </span>
                        </div>
                        {filled.map((p) => (
                          <div key={p.player_id} className="flex items-baseline justify-between text-[11px] py-px">
                            <span className="truncate font-mono text-foreground max-w-[80px]">{p.player_name}</span>
                            <span className="font-mono font-bold text-amber-600 text-[10.5px] ml-1 shrink-0">{p.final_price_fm}</span>
                          </div>
                        ))}
                        {Array.from({ length: emptyCount }).map((_, i) => (
                          <div key={i} className="flex items-center text-[10px] py-px">
                            <span className="flex-1 border-b border-dashed border-border/50 h-[1px] mr-1.5" />
                            <span className={`font-mono ${cfg.color} opacity-40`}>{cfg.abbr}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                {/* Bid buttons */}
                <div className="flex gap-1 pt-2 border-t border-border mt-auto">
                  {[1, 5, 10].map((delta) => (
                    <button
                      key={delta}
                      onClick={() => onBid(team.id, delta)}
                      disabled={!canBid}
                      className="flex-1 border border-border rounded-lg py-1.5 font-mono font-bold text-[11px] text-primary/80 bg-card hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
