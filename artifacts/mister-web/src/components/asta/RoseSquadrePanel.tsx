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

interface RoseSquadrePanelProps {
  squadre: Squadra[];
  assignments: AssignmentItem[];
}

const ROLE_LABEL: Record<string, string> = { GK: "P", DEF: "D", MID: "C", ATT: "A" };
const ROLE_ORDER = ["GK", "DEF", "MID", "ATT"];
const ROLE_COLOR: Record<string, string> = {
  GK: "text-amber-700",
  DEF: "text-blue-700",
  MID: "text-green-700",
  ATT: "text-red-700",
};

export function RoseSquadrePanel({ squadre, assignments }: RoseSquadrePanelProps) {
  const byTeam = new Map<string, AssignmentItem[]>();
  for (const a of assignments) {
    if (!byTeam.has(a.fanta_team_id)) byTeam.set(a.fanta_team_id, []);
    byTeam.get(a.fanta_team_id)!.push(a);
  }

  return (
    <div className="border-t border-border pt-6 mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Rose e budget ({assignments.length} acquisti)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {squadre.map((team) => {
          const teamAssignments = byTeam.get(team.id) ?? [];
          const byRole: Record<string, AssignmentItem[]> = { GK: [], DEF: [], MID: [], ATT: [] };
          for (const a of teamAssignments) {
            (byRole[a.role_classic] ??= []).push(a);
          }

          return (
            <div key={team.id} className="rounded-lg border bg-card p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold truncate leading-tight">
                  {team.name_auction ?? team.name}
                </span>
                <span className="font-mono font-bold text-primary shrink-0">
                  {team.credits_remaining} FM
                </span>
              </div>

              {teamAssignments.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">Nessun acquisto</p>
              ) : (
                <div className="space-y-1.5 pt-0.5">
                  {ROLE_ORDER.map((role) => {
                    const ps = byRole[role];
                    if (!ps || ps.length === 0) return null;
                    return (
                      <div key={role}>
                        <p className={`text-[10px] font-mono font-bold uppercase mb-0.5 ${ROLE_COLOR[role]}`}>
                          {ROLE_LABEL[role]}
                        </p>
                        {ps.map((p) => (
                          <div key={p.player_id} className="flex justify-between items-baseline text-[11px] font-mono gap-1">
                            <span className="truncate text-foreground">{p.player_name}</span>
                            <span className="text-muted-foreground shrink-0">{p.final_price_fm}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
