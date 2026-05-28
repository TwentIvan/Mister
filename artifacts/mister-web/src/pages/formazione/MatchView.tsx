import { Home, Plane } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useGetLineups, useGetMatches, useGetRoster, type RosterPlayer as ApiRosterPlayer } from "@workspace/api-client-react";
import { computeFantaTeamScore, type SlotPosition } from "@workspace/scoring";
import {
  ATLETICO_CAFFEINA_COACH,
  COACH_MARIO,
  MATCH_GIORNATA_2,
  MY_TEAM_INFO,
  TEAM_COLORS,
  TEAM_CODE,
  TEAM_LOGO_URL,
  type HeadCoach,
} from "./team-constants";

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

const MY_PARAMS = { fantaTeamId: "ft-mvp-1", season: 2024, round: 2 };
const AC_PARAMS = { fantaTeamId: "ft-mvp-7", season: 2024, round: 2 };

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
      const r = await fetch(`/api/coach-voto?fantaTeamId=${fantaTeamId}&season=${season}&round=${round}`);
      if (!r.ok) throw new Error("coach-voto fetch failed");
      return r.json() as Promise<CoachVotoData>;
    },
    staleTime: 60_000,
  });
}

const AFFINITY_GREEN = "#4ade80";

// Stessi colori di sfondo del builder (Task 105)
const ROLE_ROW_BG: Record<string, string> = {
  GK:  "#7a5012",
  DEF: "#1a3d2b",
  MID: "#19305c",
  ATT: "#6b1f1f",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? name;
  return last.length > 10 ? last.slice(0, 9) + "." : last;
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

// X% per N giocatori equidistribuiti sul campo (campo: ~20%→93% del container)
function xPositions(n: number): number[] {
  const L = 20, R = 93;
  return Array.from({ length: n }, (_, i) => L + ((i + 1) / (n + 1)) * (R - L));
}

// Fallback img: prova cartoon, se 404 prova la foto reale, altrimenti nascondi
function photoSrc(player: MatchPlayer): string {
  return (player.photoCartoonUrl ?? player.photoUrl) ?? "";
}

function photoOnError(player: MatchPlayer) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (player.photoCartoonUrl && player.photoUrl && img.src !== player.photoUrl) {
      img.src = player.photoUrl;
    } else {
      img.style.display = "none";
    }
  };
}

// ─── MatchPlayerToken (~63% del token "field" del builder) ───────────────────

function MatchPlayerToken({ player, isCaptain = false }: { player: MatchPlayer; isCaptain?: boolean }) {
  const PHOTO = 46, RING = 2, OUTER = PHOTO + RING * 2, PILL_W = 40, PILL_H = 10, VBADGE = 18;
  const affinityColor = "rgba(74,222,128,0.9)";
  const colors  = player.colors;
  const code    = player.teamCode;
  const hasVoto = player.votoMister !== null;
  const logoUrl = player.logoUrl;
  const src     = photoSrc(player);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
      <div style={{ position: "relative", width: OUTER, height: OUTER, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: RING, borderRadius: "50%", overflow: "hidden", background: "rgba(0,0,0,0.35)" }}>
          {src && <img src={src} alt={player.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={photoOnError(player)} />}
        </div>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `${RING}px solid ${affinityColor}`, boxShadow: `0 0 5px ${affinityColor}55`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: -2, right: -2, width: VBADGE, height: VBADGE, borderRadius: "50%", background: hasVoto ? "#1f4733" : "rgba(0,0,0,0.45)", border: hasVoto ? "none" : "1px solid rgba(239,230,211,0.3)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
            {hasVoto ? player.votoMister!.toFixed(1) : "—"}
          </span>
        </div>
        {isCaptain && (
          <div style={{ position: "absolute", bottom: -2, right: -2, width: 14, height: 14, borderRadius: "50%", background: "#F4C430", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 800, color: "#333" }}>C</span>
          </div>
        )}
      </div>
      <div style={{ width: PILL_W, height: PILL_H, borderRadius: 4, overflow: "hidden", position: "relative", flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: colors.primary }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", background: colors.secondary }} />
        {logoUrl ? (
          <img src={logoUrl} alt={code} style={{ position: "absolute", inset: 0, margin: "auto", width: 9, height: 9, objectFit: "contain", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>{code}</span>
        )}
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(239,230,211,0.92)", fontFamily: "var(--font-sans)", textAlign: "center", lineHeight: 1.2, maxWidth: Math.max(OUTER, PILL_W) + 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
        {lastName(player.name)}
      </span>
      {player.opponentCode && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "1px 4px", borderRadius: 3, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(4px)", boxShadow: "0 1px 3px rgba(0,0,0,0.45)" }}>
          {player.opponentIsHome
            ? <Home  size={7} color="rgba(239,230,211,0.75)" />
            : <Plane size={7} color="rgba(239,230,211,0.75)" />}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 600, color: "rgba(239,230,211,0.85)", lineHeight: 1, letterSpacing: "0.04em" }}>
            {player.opponentCode}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── MatchMiniCoachToken — piccolo, per area tecnica in pitch ─────────────────

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
        <div style={{ position: "absolute", inset: RING, borderRadius: "50%", overflow: "hidden", background: "rgba(0,0,0,0.4)" }}>
          {coach.photoCartoonUrl && <img src={coach.photoCartoonUrl} alt={coach.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
        </div>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `${RING}px solid rgba(244,196,48,0.82)`, boxShadow: "0 0 6px rgba(244,196,48,0.25)", pointerEvents: "none" }} />
        {/* Badge voto — top right */}
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
          <div key={player.id} style={{ position: "absolute", left: `${xs[i]}%`, top: `${y}%`, zIndex: 2 }}>
            <MatchPlayerToken player={player} isCaptain={player.id === captainId} />
          </div>
        ));
      })}
    </>
  );
}

// ─── BenchRow — riga panchina fedele al design builder (Task 105), ~77% ──────
// Stessa struttura di PlayerRow: banda colori sinistra + foto + nome + avversario + voto

function BenchRow({ player }: { player: MatchPlayer }) {
  const bg      = ROLE_ROW_BG[player.roleClassic] ?? "#1a3d2b";
  const colors  = player.colors;
  const code    = player.teamCode;
  const logoUrl = player.logoUrl;
  const src     = photoSrc(player);

  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      borderRadius: 6,
      border: "1.5px solid transparent",
      background: bg,
      overflow: "hidden",
      flexShrink: 0,
    }}>
      {/* Banda verticale sinistra: colori squadra + logo */}
      <div style={{ width: 17, flexShrink: 0, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", background: colors.primary }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%", background: colors.secondary }} />
        {logoUrl ? (
          <img src={logoUrl} alt={code} style={{ position: "absolute", inset: 0, margin: "auto", width: 12, height: 12, objectFit: "contain", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.85))" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: "var(--font-mono)", fontSize: 5, fontWeight: 800, color: "rgba(255,255,255,0.92)", letterSpacing: "0.14em" }}>
            {code}
          </div>
        )}
      </div>

      {/* Contenuto: foto + nome + avversario + voto */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 6px 3px 5px", flex: 1, minWidth: 0 }}>
        {/* Foto circolare con ring verde affinità */}
        <div style={{ position: "relative", width: 26, height: 26, flexShrink: 0 }}>
          <div style={{ position: "absolute", inset: 1, borderRadius: "50%", overflow: "hidden", background: "rgba(0,0,0,0.4)" }}>
            {src ? (
              <img src={src} alt={player.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={photoOnError(player)} />
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 9, color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-mono)" }}>
                {player.name[0]}
              </span>
            )}
          </div>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `1.5px solid ${AFFINITY_GREEN}`, pointerEvents: "none" }} />
        </div>

        {/* Cognome */}
        <div style={{ flex: 1, minWidth: 0, fontSize: 10, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1 }}>
          {lastName(player.name)}
        </div>

        {/* Voto */}
        <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: player.votoMister !== null ? "#4ade80" : "rgba(255,255,255,0.28)" }}>
          {player.votoMister !== null ? player.votoMister.toFixed(1) : "—"}
        </span>
      </div>
    </div>
  );
}

// ─── DugoutPanel — contenitore "pensilina" con header tettoia ─────────────────

interface DugoutPanelProps {
  sigla:    string;
  bgColor:  string;
  fgColor:  string;
  players:  MatchPlayer[];
}

function DugoutPanel({ sigla, bgColor, fgColor, players }: DugoutPanelProps) {
  return (
    <div style={{
      flex: "1 1 0",
      minHeight: 0,
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(10,24,20,0.75)",
      backdropFilter: "blur(4px)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "row",   // layout orizzontale: tettoia sinistra | giocatori destra
    }}>
      {/* ── Tettoia verticale: fascia sul lato sinistro (spalle al campo), tutta l'altezza ── */}
      <div style={{
        width: 12,
        flexShrink: 0,
        background: `linear-gradient(180deg, ${bgColor}80 0%, ${bgColor}30 60%, ${bgColor}12 100%)`,
        borderRight: "1px solid rgba(255,255,255,0.06)",
        // Ombra sul bordo destro che evoca curvatura/profondità della pensilina
        boxShadow: "inset -3px 0 8px rgba(0,0,0,0.45), 3px 0 6px rgba(0,0,0,0.3)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 5,
        gap: 3,
      }}>
        {/* Crest in cima alla fascia */}
        <div style={{ width: 9, height: 9, borderRadius: "50%", background: bgColor, border: "1px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 4.5, fontWeight: 800, color: fgColor, lineHeight: 1 }}>{sigla}</span>
        </div>
      </div>

      {/* ── Lista panchinari (scrollabile) ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "3px", display: "flex", flexDirection: "column", gap: 2 }}>
        {players.map(p => <BenchRow key={p.id} player={p} />)}
        {players.length === 0 && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)", padding: "6px 4px" }}>Nessun panchinaro</span>
        )}
      </div>
    </div>
  );
}

// ─── VotiTabellino — colonna destra: voti dei titolari ───────────────────────

const ROLE_LETTER: Record<string, string> = { GK: "P", DEF: "D", MID: "C", ATT: "A" };

function getStartersOrdered(rows: StarterRows, captainId: number | null) {
  return ROLE_ORDER.flatMap(role =>
    rows[role].map(p => ({
      player: p,
      role:   role as keyof StarterRows,
      isCap:  p.id === captainId,
    }))
  );
}

interface SubEntry { out: number; inId: number }

interface VotiSectionProps {
  label:           string;
  sigla:           string;
  bgColor:         string;
  fgColor:         string;
  starters:        ReturnType<typeof getStartersOrdered>;
  totalScore?:     number | null;
  substitutions?:  SubEntry[];
  benchById?:      Map<number, MatchPlayer>;
  coachName?:      string | null;
  coachVoto?:      number;
  coachDelta?:     number;
}

function VotiSection({ label, sigla, bgColor, fgColor, starters, totalScore, substitutions, benchById, coachName, coachVoto, coachDelta }: VotiSectionProps) {
  const subsMap = new Map((substitutions ?? []).map(s => [s.out, s.inId]));
  const hasRealScore = totalScore !== null && totalScore !== undefined;
  const hasCoach = coachVoto !== undefined;

  return (
    <div style={{ flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header sezione */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 8px 4px",
        background: `linear-gradient(90deg, ${bgColor}55 0%, ${bgColor}18 100%)`,
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: bgColor, border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 6.5, fontWeight: 800, color: fgColor }}>{sigla}</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: "rgba(239,230,211,0.6)", letterSpacing: "0.1em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </div>

      {/* Righe titolari (+ righe sostituzione) */}
      <div style={{ flex: 1, overflowY: "auto", padding: "2px 0" }}>
        {starters.map(({ player, role, isCap }) => {
          const isSv    = player.votoMister === null;
          const subId   = subsMap.get(player.id);
          const subPlayer = (subId !== undefined && benchById) ? benchById.get(subId) : undefined;

          return (
            <div key={player.id}>
              {/* Riga titolare */}
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

              {/* Riga sostituto (solo se S.V. con sub) */}
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

      {/* Riga allenatore */}
      {hasCoach && (
        <div style={{
          flexShrink: 0,
          display: "flex", alignItems: "center",
          padding: "3px 8px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(244,196,48,0.06)",
          gap: 4,
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, color: "rgba(244,196,48,0.55)", letterSpacing: "0.04em", flexShrink: 0 }}>MGR</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 9, fontWeight: 500, color: "rgba(239,230,211,0.65)", fontFamily: "var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {coachName ?? "—"}
          </span>
          <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "rgba(244,196,48,0.85)", minWidth: 24, textAlign: "right" }}>
            {coachVoto!.toFixed(1)}
          </span>
          <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: (coachDelta ?? 0) >= 0 ? "#4ade80" : "#f87171", minWidth: 28, textAlign: "right" }}>
            {(coachDelta ?? 0) >= 0 ? "+" : ""}{(coachDelta ?? 0).toFixed(1)}
          </span>
        </div>
      )}

      {/* Riga totale */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center",
        padding: "4px 8px",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(0,0,0,0.18)",
        gap: 4,
      }}>
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

// Colori accento per lettera ruolo nel tabellino
const ROLE_CHIP_COLOR: Record<string, string> = {
  GK:  "#f59e0b",
  DEF: "#60a5fa",
  MID: "#4ade80",
  ATT: "#f87171",
};

function VotiTabellino({
  acStarters, myStarters,
  acScore, myScore,
  acSubs, mySubs,
  acBenchById, myBenchById,
  acCoach, myCoach,
}: {
  acStarters:   ReturnType<typeof getStartersOrdered>;
  myStarters:   ReturnType<typeof getStartersOrdered>;
  acScore:      number | null | undefined;
  myScore:      number | null | undefined;
  acSubs:       SubEntry[];
  mySubs:       SubEntry[];
  acBenchById:  Map<number, MatchPlayer>;
  myBenchById:  Map<number, MatchPlayer>;
  acCoach?:     CoachVotoData | null;
  myCoach?:     CoachVotoData | null;
}) {
  return (
    <div style={{
      width: 170,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: 6,
      height: "100%",
    }}>
      {/* AC section */}
      <div style={{ flex: "1 1 0", minHeight: 0, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(10,24,20,0.75)", backdropFilter: "blur(4px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <VotiSection
          label="Atletico Caffeina" sigla="AC" bgColor="#C8102E" fgColor="#fff"
          starters={acStarters}
          totalScore={acScore}
          substitutions={acSubs}
          benchById={acBenchById}
          coachName={acCoach?.coachName}
          coachVoto={acCoach?.coachVoto}
          coachDelta={acCoach?.coachDelta}
        />
      </div>
      {/* MS section */}
      <div style={{ flex: "1 1 0", minHeight: 0, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(10,24,20,0.75)", backdropFilter: "blur(4px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <VotiSection
          label="Mario's Squad" sigla={MY_TEAM_INFO.sigla} bgColor={MY_TEAM_INFO.logoColori.bg} fgColor={MY_TEAM_INFO.logoColori.fg}
          starters={myStarters}
          totalScore={myScore}
          substitutions={mySubs}
          benchById={myBenchById}
          coachName={myCoach?.coachName}
          coachVoto={myCoach?.coachVoto}
          coachDelta={myCoach?.coachDelta}
        />
      </div>
    </div>
  );
}

// ─── MatchView ────────────────────────────────────────────────────────────────

const COMPETITION_ID = "comp-mvp-campionato-2024";
const MY_TEAM_ID = "ft-mvp-1";
const AC_TEAM_ID = "ft-mvp-7";

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

export function MatchView() {
  const { data: myLineup, isLoading: myLoading } = useGetLineups(MY_PARAMS);
  const { data: acLineup, isLoading: acLoading } = useGetLineups(AC_PARAMS);
  const { data: matchList } = useGetMatches({ competitionId: COMPETITION_ID, giornata: 2 });
  const { data: myRosterData, isLoading: myRosterLoading } = useGetRoster({ fantaTeamId: MY_TEAM_ID, season: 2024, round: 2 });
  const { data: acRosterData, isLoading: acRosterLoading } = useGetRoster({ fantaTeamId: AC_TEAM_ID, season: 2024, round: 2 });
  const { data: myCoachData } = useCoachVoto(MY_TEAM_ID, 2024, 2);
  const { data: acCoachData } = useCoachVoto(AC_TEAM_ID, 2024, 2);

  const { avversario, giornata, competizione } = MATCH_GIORNATA_2;

  const myPlayerById: Map<number, MatchPlayer> = new Map((myRosterData ?? []).map(adaptPlayer).map(p => [p.id, p]));
  const acPlayerById: Map<number, MatchPlayer> = new Map((acRosterData ?? []).map(adaptPlayer).map(p => [p.id, p]));

  if (myLoading || acLoading || myRosterLoading || acRosterLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 220px)", color: "var(--ink-mid)", fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.06em" }}>
        Caricamento formazioni…
      </div>
    );
  }

  const myRows     = myLineup ? getStarterRows(myLineup.players, myPlayerById) : emptyRows();
  const acRows     = acLineup ? getStarterRows(acLineup.players, acPlayerById) : emptyRows();
  const myBench    = myLineup ? getBenchPlayers(myLineup.players, myPlayerById) : [];
  const acBench    = acLineup ? getBenchPlayers(acLineup.players, acPlayerById) : [];
  const myCapId    = myLineup?.captainPlayerId ?? null;
  const acCapId    = acLineup?.captainPlayerId ?? null;
  const myStarters = getStartersOrdered(myRows, myCapId);
  const acStarters = getStartersOrdered(acRows, acCapId);

  // Score reale dall'API
  const match = matchList?.find(
    m => (m.homeFantaTeamId === MY_TEAM_ID && m.awayFantaTeamId === AC_TEAM_ID) ||
         (m.homeFantaTeamId === AC_TEAM_ID && m.awayFantaTeamId === MY_TEAM_ID),
  );
  const isHome = match?.homeFantaTeamId === MY_TEAM_ID;
  const myScore = match ? (isHome ? match.homeScore : match.awayScore) : null;
  const acScore = match ? (isHome ? match.awayScore : match.homeScore) : null;

  // Sostituzioni calcolate client-side per il tabellino
  const mySubs      = computeSubs(myLineup, myPlayerById);
  const acSubs      = computeSubs(acLineup, acPlayerById);
  const myBenchById = buildBenchById(myLineup, myPlayerById);
  const acBenchById = buildBenchById(acLineup, acPlayerById);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Header match ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "var(--surface)", borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: MY_TEAM_INFO.logoColori.bg, border: "1.5px solid var(--green-mid)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: MY_TEAM_INFO.logoColori.fg }}>{MY_TEAM_INFO.sigla}</span>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.04em" }}>Mario&apos;s Squad</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.14em" }}>
            {myScore !== null && myScore !== undefined ? myScore.toFixed(2) : "—"}
            {" : "}
            {acScore !== null && acScore !== undefined ? acScore.toFixed(2) : "—"}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-mid)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
            {competizione} · Giornata {giornata}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.04em" }}>{avversario}</span>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#C8102E", border: "1.5px solid rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "#fff" }}>AC</span>
          </div>
        </div>
      </div>

      {/* ── Layout: [dugout panchine] [pitch] [tabellino voti] ── */}
      <div style={{ display: "flex", gap: 8, height: "calc(100vh - 248px)", alignItems: "stretch" }}>

        {/* ── Colonna sinistra: dugout AC (metà alta) + dugout Mario's (metà bassa) ── */}
        <div style={{ width: 196, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <DugoutPanel sigla="AC" bgColor="#C8102E" fgColor="#fff" players={acBench} />
          <DugoutPanel sigla={MY_TEAM_INFO.sigla} bgColor={MY_TEAM_INFO.logoColori.bg} fgColor={MY_TEAM_INFO.logoColori.fg} players={myBench} />
        </div>

        {/* ── Pitch ── */}
        <div style={{
          flex: "0 0 auto",
          height: "100%",
          aspectRatio: "100 / 140",
          position: "relative",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
          border: "1px solid rgba(239,230,211,0.12)",
          userSelect: "none",
        }}>
          {/* SVG campo */}
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
            {/* Area tecnica AC (top-left): x=0→16, y=21→55 */}
            <line x1="0"  y1="21" x2="16" y2="21" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.4" />
            <line x1="0"  y1="55" x2="16" y2="55" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.4" />
            <line x1="16" y1="21" x2="16" y2="55" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.6" />
            <polyline points="14,21 16,21 16,23"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <polyline points="14,55 16,55 16,53"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            {/* Area tecnica Mario's (bottom-left): x=0→16, y=85→119 */}
            <line x1="0"  y1="85"  x2="16" y2="85"  stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.4" />
            <line x1="0"  y1="119" x2="16" y2="119" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.4" />
            <line x1="16" y1="85"  x2="16" y2="119" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.6" />
            <polyline points="14,85  16,85  16,87"   fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <polyline points="14,119 16,119 16,117"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
          </svg>

          {/* Coach AC — area tecnica superiore: y=21→55 / 140 = 15%→39.3% */}
          <div style={{ position: "absolute", left: "0%", top: "15%", width: "16%", height: "24.3%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 2 }}>
            <MatchMiniCoachToken coach={ATLETICO_CAFFEINA_COACH} coachVoto={acCoachData?.coachVoto} />
          </div>

          {/* Coach Mario's — area tecnica inferiore: y=85→119 / 140 = 60.7%→85% */}
          <div style={{ position: "absolute", left: "0%", top: "60.7%", width: "16%", height: "24.3%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 2 }}>
            <MatchMiniCoachToken coach={COACH_MARIO} coachVoto={myCoachData?.coachVoto} />
          </div>

          {/* Atletico Caffeina — metà alta */}
          <PitchHalf rows={acRows} captainId={acCapId} rowY={{ GK: 8, DEF: 21, MID: 31, ATT: 41 }} />

          {/* Mario's Squad — metà bassa */}
          <PitchHalf rows={myRows} captainId={myCapId} rowY={{ GK: 92, DEF: 79, MID: 69, ATT: 59 }} />
        </div>

        {/* ── Colonna destra: tabellino voti ── */}
        <VotiTabellino
          acStarters={acStarters}
          myStarters={myStarters}
          acScore={acScore}
          myScore={myScore}
          acSubs={acSubs}
          mySubs={mySubs}
          acBenchById={acBenchById}
          myBenchById={myBenchById}
          acCoach={acCoachData ?? null}
          myCoach={myCoachData ?? null}
        />
      </div>
    </div>
  );
}
