import { Badge } from "@/components/ui/badge";

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  GK: { bg: "bg-amber-100", text: "text-amber-800", label: "P" },
  DEF: { bg: "bg-blue-100", text: "text-blue-800", label: "D" },
  MID: { bg: "bg-green-100", text: "text-green-800", label: "C" },
  ATT: { bg: "bg-red-100", text: "text-red-800", label: "A" },
};

interface PlayerHeroProps {
  player: {
    player_id: number;
    position: number;
    name: string;
    full_name: string;
    role_classic: string;
    real_team: string;
    photo_url?: string | null;
  };
  total: number;
}

export function PlayerHero({ player, total }: PlayerHeroProps) {
  const role = ROLE_COLORS[player.role_classic] ?? ROLE_COLORS.ATT;

  return (
    <div className="flex flex-col items-center text-center py-6 gap-4">
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center justify-center w-12 h-12 rounded-full text-2xl font-bold font-mono ${role.bg} ${role.text}`}>
          {role.label}
        </span>
        <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
          #{player.position + 1} di {total}
        </Badge>
      </div>

      <div className="relative">
        {player.photo_url ? (
          <img
            src={player.photo_url}
            alt={player.full_name}
            className="w-28 h-28 rounded-full object-cover ring-4 ring-border bg-muted"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-28 h-28 rounded-full bg-muted ring-4 ring-border flex items-center justify-center">
            <span className="text-4xl font-bold text-muted-foreground font-mono">
              {player.name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-3xl font-bold font-serif text-primary tracking-tight">
          {player.full_name}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 font-mono">{player.real_team}</p>
      </div>

      <div className="text-xs text-muted-foreground font-mono">
        Base d'asta: <span className="font-bold text-foreground">1 FM</span>
      </div>
    </div>
  );
}
