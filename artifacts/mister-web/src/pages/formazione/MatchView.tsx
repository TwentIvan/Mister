import { useQuery } from "@tanstack/react-query";
import { useGetLineups, useGetRoster, type RosterPlayer as ApiRosterPlayer } from "@workspace/api-client-react";
import { apiUrl } from "@workspace/api-client-react";
import { computeFantaTeamScore, type SlotPosition } from "@workspace/scoring";
import { PlayerFieldChip, PlayerBenchRow, type ChipRole } from "@/components/player-chip";
import "./match-view.css";
import {
  ATLETICO_CAFFEINA_COACH,
  COACH_MARIO,
  TEAM_COLORS,
  TEAM_CODE,
  TEAM_LOGO_URL,
  type HeadCoach,
} from "./team-constants";

// ─── Coach registry per team fanta ───────────────────────────────────────────

const COACH_BY_TEAM: Record<string, HeadCoach> = {
  "ft-mvp-1": COACH_MARIO,
  "ft-mvp-7": ATLETICO_CAFFEINA_COACH,
};

function resolveCoach(teamId: string, coachName: string | null): HeadCoach {
  return (
    COACH_BY_TEAM[teamId] ?? {
      id: 0,
      name: coachName ?? "Allenatore",
      photoCartoonUrl: null,
      nationality: null,
      currentTeamName: null,
    }
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface MatchViewProps {
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamCode3: string;
  awayTeamCode3: string;
  homeTeamPrimary: string;
  homeTeamSecondary: string;
  awayTeamPrimary: string;
  awayTeamSecondary: string;
  round: number;
  season: number;
  homeScore: number | null;
  awayScore: number | null;
}

// ─── Tipi locali ─────────────────────────────────────────────────────────────

type MatchPlayer = {
  id: number;
  name: string;
  realTeam: string;
  roleClassic: string;
  photoUrl: string | null;
  photoCartoonUrl: string | null;
  votoMister: number | null;
  colors: { primary: string; secondary: string };
  teamCode: string;
  logoUrl: string | null;
  opponentCode: string | null;
  opponentIsHome: boolean | null;
};

function adaptPlayer(p: ApiRosterPlayer): MatchPlayer {
  const teamName = p.realTeamName ?? "";
  return {
    id: p.id,
    name: p.name,
    realTeam: teamName,
    roleClassic: p.roleClassic,
    photoUrl: p.photoUrl,
    photoCartoonUrl: p.photoCartoonUrl,
    votoMister: p.votoMister,
    colors: {
      primary: p.realTeamColorPrimary ?? TEAM_COLORS[teamName]?.primary ?? "#444",
      secondary: p.realTeamColorSecondary ?? TEAM_COLORS[teamName]?.secondary ?? "#888",
    },
    teamCode: TEAM_CODE[teamName] ?? "???",
    logoUrl: p.logoUrl ?? (TEAM_LOGO_URL[teamName] ?? null),
    opponentCode: p.opponentCode ?? null,
    opponentIsHome: p.opponentIsHome ?? null,
  };
}

type CoachVotoData = {
  coachName: string | null;
  coachVoto: number;
  coachDelta: number;
  goalsFor: number | null;
  goalsAgainst: number | null;
};

function useCoachVoto(fantaTeamId: string, season: number, round: number) {
  return useQuery<CoachVotoData>({
    queryKey: ["coach-voto", fantaTeamId, season, round],
    queryFn: async () => {
      const r = await fetch(apiUrl(`/api/coach-voto?fantaTeamId=${fantaTeamId}&season=${season}&round=${round}`));
      if (!r.ok) throw new Error("coach-voto fetch failed");
      return r.json() as Promise<CoachVotoData>;
    },
    staleTime: 60_000,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? name;
  return last.length > 10 ? last.slice(0, 9) + "." : last;
}

function toChipPlayer(p: MatchPlayer) {
  return {
    id: p.id,
    name: p.name,
    cartoonUrl: p.photoCartoonUrl,
    photoUrl: p.photoUrl,
    logoUrl: p.logoUrl,
    role: p.roleClassic as ChipRole,
  };
}

type StarterRows = { GK: MatchPlayer[]; DEF: MatchPlayer[]; MID: MatchPlayer[]; ATT: MatchPlayer[] };

function emptyRows(): StarterRows { return { GK: [], DEF: [], MID: [], ATT: [] }; }

type LineupSlot = {
  playerId:     number;
  slotPosition: string;
  slotIndex:    number;
  isStarter:    boolean;
  benchOrder?:  number | null;
};

function getStarterRows(players: LineupSlot[], map: Map<number, MatchPlayer>): StarterRows {
  const rows = emptyRows();
  [...players]
    .filter(p => p.isStarter)
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .forEach(s => {
      const p = map.get(s.playerId);
      if (!p) return;
      const pos = (s.slotPosition === "T" ? "MID" : s.slotPosition) as keyof StarterRows;
      if (pos in rows) rows[pos].push(p);
    });
  return rows;
}

function getBenchPlayers(players: LineupSlot[], map: Map<number, MatchPlayer>): MatchPlayer[] {
  return [...players]
    .filter(p => !p.isStarter)
    .sort((a, b) => (a.benchOrder ?? 999) - (b.benchOrder ?? 999))
    .flatMap(s => { const p = map.get(s.playerId); return p ? [p] : []; });
}

function xPositions(n: number): number[] {
  const L = 20, R = 93;
  return Array.from({ length: n }, (_, i) => L + ((i + 1) / (n + 1)) * (R - L));
}


// ─── MatchMiniCoachToken ──────────────────────────────────────────────────────

function MatchMiniCoachToken({ coach, coachVoto }: { coach: HeadCoach; coachVoto?: number }) {
  const PHOTO = 46, RING = 2, OUTER = PHOTO + RING * 2, VBADGE = 18;
  const teamKey = coach.currentTeamName ?? "";
  const colors  = TEAM_COLORS[teamKey] ?? { primary: "#444", secondary: "#888" };
  const logoUrl = TEAM_LOGO_URL[teamKey];

  const shortName = (() => {
    const parts = coach.name.trim().split(/\s+/);
    const last = parts[parts.length - 1]!;
    return last.length > 8 ? last.slice(0, 7) + "." : last;
  })();

  const hasVoto = coachVoto !== undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, pointerEvents: "none" }}>
      <div style={{ position: "relative", width: OUTER, height: OUTER, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: RING, borderRadius: "50%", overflow: "hidden", background: "var(--token-avatar-bg, #2d5848)" }}>
          {coach.photoCartoonUrl && <img src={coach.photoCartoonUrl} alt={coach.name} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.08)", transformOrigin: "center" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
        </div>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `${RING}px solid rgba(244,196,48,0.82)`, boxShadow: "0 0 6px rgba(244,196,48,0.25)", pointerEvents: "none" }} />
        {hasVoto && (
          <div style={{ position: "absolute", top: -2, right: -2, width: VBADGE, height: VBADGE, borderRadius: "50%", background: "#1f4733", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 1.5px rgba(244,196,48,0.75), 0 1px 3px rgba(0,0,0,0.6)", zIndex: 2 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
              {coachVoto!.toFixed(1)}
            </span>
          </div>
        )}
      </div>
      <div style={{ width: 30, height: 8, borderRadius: 3, overflow: "hidden", position: "relative", boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: colors.primary }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", background: colors.secondary }} />
        {logoUrl && <img src={logoUrl} alt="" style={{ position: "absolute", inset: 0, margin: "auto", width: 7, height: 7, objectFit: "contain", filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.9))" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
      </div>
      <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(239,230,211,0.88)", fontFamily: "var(--font-sans)", textShadow: "0 1px 3px rgba(0,0,0,0.8)", whiteSpace: "nowrap" }}>
        {shortName}
      </span>
    </div>
  );
}

// ─── PitchHalf ────────────────────────────────────────────────────────────────

const ROLE_ORDER = ["GK", "DEF", "MID", "ATT"] as const;

function PitchHalf({ rows, captainId, rowY }: { rows: StarterRows; captainId: number | null; rowY: Record<(typeof ROLE_ORDER)[number], number> }) {
  return (
    <>
      {ROLE_ORDER.map(role => {
        const players = rows[role];
        if (players.length === 0) return null;
        const y = rowY[role], xs = xPositions(players.length);
        return players.map((player, i) => (
          <div
            key={player.id}
            style={{ position: "absolute", left: `${xs[i]}%`, top: `${y}%`, zIndex: 2, transform: "translate(-50%,-50%)", pointerEvents: "none" }}
          >
            <PlayerFieldChip
              player={toChipPlayer(player)}
              role={player.roleClassic as ChipRole}
              isCaptain={player.id === captainId}
              avgScore={player.votoMister}
              isLocked
            />
          </div>
        ));
      })}
    </>
  );
}

// ─── DugoutPanel ──────────────────────────────────────────────────────────────

function DugoutPanel({ sigla, bgColor, fgColor, players }: { sigla: string; bgColor: string; fgColor: string; players: MatchPlayer[] }) {
  return (
    <div style={{ flex: "1 1 0", minHeight: 0, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(10,24,20,0.75)", backdropFilter: "blur(4px)", overflow: "hidden", display: "flex", flexDirection: "row" }}>
      <div style={{ width: 12, flexShrink: 0, background: `linear-gradient(180deg, ${bgColor}80 0%, ${bgColor}30 60%, ${bgColor}12 100%)`, borderRight: "1px solid rgba(255,255,255,0.06)", boxShadow: "inset -3px 0 8px rgba(0,0,0,0.45), 3px 0 6px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 5, gap: 3 }}>
        <div style={{ width: 9, height: 9, borderRadius: "50%", background: bgColor, border: "1px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 4.5, fontWeight: 800, color: fgColor, lineHeight: 1 }}>{sigla}</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px", display: "flex", flexDirection: "column", gap: 3 }}>
        {players.map(p => (
          <PlayerBenchRow
            key={p.id}
            player={toChipPlayer(p)}
            voto={p.votoMister}
            isLocked
          />
        ))}
        {players.length === 0 && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)", padding: "6px 4px" }}>Nessun panchinaro</span>
        )}
      </div>
    </div>
  );
}

// ─── VotiSection ─────────────────────────────────────────────────────────────

const ROLE_ORDER_ARR = ["GK", "DEF", "MID", "ATT"] as const;
const ROLE_LETTER: Record<string, string> = { GK: "P", DEF: "D", MID: "C", ATT: "A" };
const ROLE_CHIP_COLOR: Record<string, string> = {
  GK:  "#f59e0b",
  DEF: "#60a5fa",
  MID: "#4ade80",
  ATT: "#f87171",
};

function getStartersOrdered(rows: StarterRows, captainId: number | null) {
  return ROLE_ORDER_ARR.flatMap(role =>
    rows[role].map(p => ({
      player: p,
      role:   role as keyof StarterRows,
      isCap:  p.id === captainId,
    }))
  );
}

interface SubEntry { out: number; inId: number }

function VotiSection({
  label, sigla, bgColor, fgColor, starters, totalScore, substitutions, benchById, coachName, coachVoto, coachDelta,
}: {
  label: string; sigla: string; bgColor: string; fgColor: string;
  starters: ReturnType<typeof getStartersOrdered>;
  totalScore?: number | null;
  substitutions?: SubEntry[];
  benchById?: Map<number, MatchPlayer>;
  coachName?: string | null;
  coachVoto?: number;
  coachDelta?: number;
}) {
  const subsMap = new Map((substitutions ?? []).map(s => [s.out, s.inId]));
  const hasRealScore = totalScore !== null && totalScore !== undefined;
  const hasCoach = coachVoto !== undefined;

  return (
    <div style={{ flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "5px 8px 4px", background: `linear-gradient(90deg, ${bgColor}55 0%, ${bgColor}18 100%)`, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: bgColor, border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 6.5, fontWeight: 800, color: fgColor }}>{sigla}</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: "rgba(239,230,211,0.6)", letterSpacing: "0.1em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "2px 0" }}>
        {starters.map(({ player, role, isCap }) => {
          const isSv = player.votoMister === null;
          const subId = subsMap.get(player.id);
          const subPlayer = (subId !== undefined && benchById) ? benchById.get(subId) : undefined;
          return (
            <div key={player.id}>
              <div style={{ display: "flex", alignItems: "center", padding: "2px 8px", gap: 4, opacity: (isSv && subPlayer) ? 0.45 : 1 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: ROLE_CHIP_COLOR[role], width: 8, flexShrink: 0 }}>
                  {ROLE_LETTER[role]}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 10, fontWeight: 500, color: "rgba(239,230,211,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--font-sans)", textDecoration: (isSv && subPlayer) ? "line-through" : "none" }}>
                  {lastName(player.name)}
                  {isCap && <span style={{ marginLeft: 3, fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 800, color: "#F4C430", verticalAlign: "middle" }}>C</span>}
                </span>
                <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: player.votoMister !== null ? "#4ade80" : "rgba(239,230,211,0.28)", minWidth: 28, textAlign: "right" }}>
                  {player.votoMister !== null ? player.votoMister.toFixed(1) : "S.V."}
                </span>
              </div>
              {subPlayer && (
                <div style={{ display: "flex", alignItems: "center", padding: "1px 8px 2px 16px", gap: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#60a5fa", flexShrink: 0 }}>↑</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 9, fontWeight: 500, color: "rgba(239,230,211,0.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--font-sans)" }}>
                    {lastName(subPlayer.name)}
                  </span>
                  <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "#4ade80", minWidth: 28, textAlign: "right" }}>
                    {subPlayer.votoMister !== null ? subPlayer.votoMister.toFixed(1) : "S.V."}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {hasCoach && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", padding: "3px 8px", gap: 4, borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.12)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: "rgba(244,196,48,0.7)", width: 8, flexShrink: 0 }}>M</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 10, fontWeight: 500, color: "rgba(239,230,211,0.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--font-sans)" }}>
            {coachName ? lastName(coachName) : "Allenatore"}
          </span>
          <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "#4ade80", minWidth: 28, textAlign: "right" }}>
            {coachVoto!.toFixed(1)}
          </span>
        </div>
      )}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", padding: "4px 8px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.18)", gap: 4 }}>
        <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(239,230,211,0.38)", letterSpacing: "0.04em" }}>
          {hasRealScore ? "Totale" : "Totale (prov.)"}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: hasRealScore ? "rgba(239,230,211,0.88)" : "rgba(239,230,211,0.42)" }}>
          {hasRealScore ? totalScore!.toFixed(2) : "—"}
        </span>
      </div>
    </div>
  );
}

function VotiTabellino({
  awayStarters, homeStarters,
  awayScore, homeScore,
  awaySubs, homeSubs,
  awayBenchById, homeBenchById,
  awayCoach, homeCoach,
  awayLabel, homeLabel,
  awaySigla, homeSigla,
  awayBgColor, homeBgColor,
  awayFgColor, homeFgColor,
}: {
  awayStarters:   ReturnType<typeof getStartersOrdered>;
  homeStarters:   ReturnType<typeof getStartersOrdered>;
  awayScore:      number | null | undefined;
  homeScore:      number | null | undefined;
  awaySubs:       SubEntry[];
  homeSubs:       SubEntry[];
  awayBenchById:  Map<number, MatchPlayer>;
  homeBenchById:  Map<number, MatchPlayer>;
  awayCoach?:     CoachVotoData | null;
  homeCoach?:     CoachVotoData | null;
  awayLabel:      string;
  homeLabel:      string;
  awaySigla:      string;
  homeSigla:      string;
  awayBgColor:    string;
  homeBgColor:    string;
  awayFgColor:    string;
  homeFgColor:    string;
}) {
  return (
    <div style={{ width: 170, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6, height: "100%" }}>
      <div style={{ flex: "1 1 0", minHeight: 0, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(10,24,20,0.75)", backdropFilter: "blur(4px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <VotiSection
          label={awayLabel} sigla={awaySigla} bgColor={awayBgColor} fgColor={awayFgColor}
          starters={awayStarters} totalScore={awayScore}
          substitutions={awaySubs} benchById={awayBenchById}
          coachName={awayCoach?.coachName} coachVoto={awayCoach?.coachVoto} coachDelta={awayCoach?.coachDelta}
        />
      </div>
      <div style={{ flex: "1 1 0", minHeight: 0, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(10,24,20,0.75)", backdropFilter: "blur(4px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <VotiSection
          label={homeLabel} sigla={homeSigla} bgColor={homeBgColor} fgColor={homeFgColor}
          starters={homeStarters} totalScore={homeScore}
          substitutions={homeSubs} benchById={homeBenchById}
          coachName={homeCoach?.coachName} coachVoto={homeCoach?.coachVoto} coachDelta={homeCoach?.coachDelta}
        />
      </div>
    </div>
  );
}

// ─── Helpers scoring ─────────────────────────────────────────────────────────

function buildPlayerVoti(map: Map<number, MatchPlayer>): Map<number, number | null> {
  return new Map(Array.from(map.entries()).map(([id, p]) => [id, p.votoMister]));
}

function buildBenchById(lineup: { players: LineupSlot[] } | null | undefined, playerMap: Map<number, MatchPlayer>): Map<number, MatchPlayer> {
  if (!lineup) return new Map();
  return new Map(
    lineup.players
      .filter(p => !p.isStarter)
      .flatMap(p => { const rp = playerMap.get(p.playerId); return rp ? [[p.playerId, rp] as [number, MatchPlayer]] : []; })
  );
}

function computeSubs(
  lineup: { players: LineupSlot[]; module: string; captainPlayerId?: number | null } | null | undefined,
  playerMap: Map<number, MatchPlayer>,
): SubEntry[] {
  if (!lineup) return [];
  const result = computeFantaTeamScore({
    lineup: {
      module: lineup.module,
      captainPlayerId: lineup.captainPlayerId ?? null,
      players: lineup.players.map(p => ({
        playerId: p.playerId,
        slotPosition: p.slotPosition as SlotPosition,
        slotIndex: p.slotIndex,
        isStarter: p.isStarter,
        benchOrder: p.benchOrder ?? null,
      })),
    },
    playerVoti: buildPlayerVoti(playerMap),
    playerRoles: new Map(),
    config: { captainMultiplier: 1.5 },
  });
  return result.substitutions;
}

// ─── MatchView ────────────────────────────────────────────────────────────────

export function MatchView({
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  homeTeamCode3,
  awayTeamCode3,
  homeTeamPrimary,
  homeTeamSecondary,
  awayTeamPrimary,
  awayTeamSecondary,
  round,
  season,
  homeScore,
  awayScore,
}: MatchViewProps) {
  const homeParams = { fantaTeamId: homeTeamId, season, round };
  const awayParams = { fantaTeamId: awayTeamId, season, round };

  const { data: homeLineup, isLoading: homeLoading } = useGetLineups(homeParams);
  const { data: awayLineup, isLoading: awayLoading } = useGetLineups(awayParams);
  const { data: homeRosterData, isLoading: homeRosterLoading } = useGetRoster({ fantaTeamId: homeTeamId, season, round });
  const { data: awayRosterData, isLoading: awayRosterLoading } = useGetRoster({ fantaTeamId: awayTeamId, season, round });
  const { data: homeCoachData } = useCoachVoto(homeTeamId, season, round);
  const { data: awayCoachData } = useCoachVoto(awayTeamId, season, round);

  const homeCoach = resolveCoach(homeTeamId, homeCoachData?.coachName ?? null);
  const awayCoach = resolveCoach(awayTeamId, awayCoachData?.coachName ?? null);

  const homeSigla = homeTeamCode3.slice(0, 2);
  const awaySigla = awayTeamCode3.slice(0, 2);

  const homePlayerById: Map<number, MatchPlayer> = new Map((homeRosterData ?? []).map(adaptPlayer).map(p => [p.id, p]));
  const awayPlayerById: Map<number, MatchPlayer> = new Map((awayRosterData ?? []).map(adaptPlayer).map(p => [p.id, p]));

  if (homeLoading || awayLoading || homeRosterLoading || awayRosterLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 220px)", color: "var(--ink-mid)", fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.06em" }}>
        Caricamento formazioni…
      </div>
    );
  }

  const homeRows    = homeLineup ? getStarterRows(homeLineup.players, homePlayerById) : emptyRows();
  const awayRows    = awayLineup ? getStarterRows(awayLineup.players, awayPlayerById) : emptyRows();
  const homeBench   = homeLineup ? getBenchPlayers(homeLineup.players, homePlayerById) : [];
  const awayBench   = awayLineup ? getBenchPlayers(awayLineup.players, awayPlayerById) : [];
  const homeCapId   = homeLineup?.captainPlayerId ?? null;
  const awayCapId   = awayLineup?.captainPlayerId ?? null;
  const homeStarters = getStartersOrdered(homeRows, homeCapId);
  const awayStarters = getStartersOrdered(awayRows, awayCapId);

  const homeSubs      = computeSubs(homeLineup, homePlayerById);
  const awaySubs      = computeSubs(awayLineup, awayPlayerById);
  const homeBenchById = buildBenchById(homeLineup, homePlayerById);
  const awayBenchById = buildBenchById(awayLineup, awayPlayerById);

  return (
    <div className="mv" style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Header match ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "var(--surface)", borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: homeTeamPrimary, border: "1.5px solid rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: homeTeamSecondary }}>{homeSigla}</span>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.04em" }}>{homeTeamName}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.14em" }}>
            {homeScore !== null && homeScore !== undefined ? homeScore.toFixed(2) : "—"}
            {" : "}
            {awayScore !== null && awayScore !== undefined ? awayScore.toFixed(2) : "—"}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-mid)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
            Giornata {round}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.04em" }}>{awayTeamName}</span>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: awayTeamPrimary, border: "1.5px solid rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: awayTeamSecondary }}>{awaySigla}</span>
          </div>
        </div>
      </div>

      {/* ── Layout: [dugout] [pitch] [tabellino] ── */}
      <div style={{ display: "flex", gap: 8, height: "calc(100vh - 248px)", alignItems: "stretch" }}>

        {/* Dugout: away (alto) + home (basso) */}
        <div style={{ width: 196, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <DugoutPanel sigla={awaySigla} bgColor={awayTeamPrimary} fgColor={awayTeamSecondary} players={awayBench} />
          <DugoutPanel sigla={homeSigla} bgColor={homeTeamPrimary} fgColor={homeTeamSecondary} players={homeBench} />
        </div>

        {/* Pitch */}
        <div style={{ flex: "0 0 auto", height: "100%", aspectRatio: "100 / 140", position: "relative", borderRadius: "var(--r-lg)", overflow: "hidden", border: "1px solid rgba(239,230,211,0.12)", userSelect: "none" }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 100 140" preserveAspectRatio="none">
            <defs>
              <pattern id="match-stripes" x="0" y="0" width="100" height="8.75" patternUnits="userSpaceOnUse">
                <rect x="0" y="0"     width="100" height="4.375" fill="#1f4733" />
                <rect x="0" y="4.375" width="100" height="4.375" fill="#234e38" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="100" height="140" fill="url(#match-stripes)" />
            <rect x="18" y="5"  width="77" height="130" fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <line x1="18" y1="70" x2="95" y2="70" stroke="#ffffff" strokeWidth="0.6" />
            <circle cx="56.5" cy="70" r="11"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <circle cx="56.5" cy="70" r="0.8" fill="#ffffff" />
            <rect x="31" y="5"   width="51" height="20" fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <rect x="44" y="5"   width="25" height="9"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <circle cx="56.5" cy="17"  r="0.8" fill="#ffffff" />
            <rect x="31" y="115" width="51" height="20" fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <rect x="44" y="126" width="25" height="9"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <circle cx="56.5" cy="123" r="0.8" fill="#ffffff" />
            <path d="M 47 25 A 12.5 12.5 0 0 0 66 25"   fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <path d="M 66 115 A 12.5 12.5 0 0 0 47 115"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <path d="M 18 6.25 A 1.25 1.25 0 0 0 19.25 5"     fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <path d="M 93.75 5 A 1.25 1.25 0 0 0 95 6.25"     fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <path d="M 19.25 135 A 1.25 1.25 0 0 0 18 133.75"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <path d="M 95 133.75 A 1.25 1.25 0 0 0 93.75 135"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <line x1="0"  y1="21" x2="16" y2="21" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.4" />
            <line x1="0"  y1="55" x2="16" y2="55" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.4" />
            <line x1="16" y1="21" x2="16" y2="55" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.6" />
            <polyline points="14,21 16,21 16,23"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <polyline points="14,55 16,55 16,53"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <line x1="0"  y1="85"  x2="16" y2="85"  stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.4" />
            <line x1="0"  y1="119" x2="16" y2="119" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.4" />
            <line x1="16" y1="85"  x2="16" y2="119" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.6" />
            <polyline points="14,85  16,85  16,87"   fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <polyline points="14,119 16,119 16,117"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
          </svg>

          {/* Coach away — area tecnica superiore */}
          <div style={{ position: "absolute", left: "0%", top: "15%", width: "16%", height: "24.3%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 2 }}>
            <MatchMiniCoachToken coach={awayCoach} coachVoto={awayCoachData?.coachVoto} />
          </div>
          {/* Coach home — area tecnica inferiore */}
          <div style={{ position: "absolute", left: "0%", top: "60.7%", width: "16%", height: "24.3%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 2 }}>
            <MatchMiniCoachToken coach={homeCoach} coachVoto={homeCoachData?.coachVoto} />
          </div>

          {/* Away — metà alta */}
          <PitchHalf rows={awayRows} captainId={awayCapId} rowY={{ GK: 8, DEF: 21, MID: 31, ATT: 41 }} />
          {/* Home — metà bassa */}
          <PitchHalf rows={homeRows} captainId={homeCapId} rowY={{ GK: 92, DEF: 79, MID: 69, ATT: 59 }} />
        </div>

        {/* Tabellino */}
        <VotiTabellino
          awayStarters={awayStarters} homeStarters={homeStarters}
          awayScore={awayScore} homeScore={homeScore}
          awaySubs={awaySubs} homeSubs={homeSubs}
          awayBenchById={awayBenchById} homeBenchById={homeBenchById}
          awayCoach={awayCoachData ?? null} homeCoach={homeCoachData ?? null}
          awayLabel={awayTeamName} homeLabel={homeTeamName}
          awaySigla={awaySigla} homeSigla={homeSigla}
          awayBgColor={awayTeamPrimary} homeBgColor={homeTeamPrimary}
          awayFgColor={awayTeamSecondary} homeFgColor={homeTeamSecondary}
        />
      </div>
    </div>
  );
}

// Backward-compat: default export per chi importa direttamente
export default MatchView;
