import { useGetLineups } from "@workspace/api-client-react";
import {
  PLAYER_BY_ID,
  ATLETICO_CAFFEINA_PLAYER_BY_ID,
  ATLETICO_CAFFEINA_COACH,
  COACH_MARIO,
  MATCH_GIORNATA_2,
  MY_TEAM_INFO,
  TEAM_COLORS,
  TEAM_CODE,
  TEAM_LOGO_URL,
  type RosterPlayer,
  type HeadCoach,
} from "./mock-data";

// TODO: replace both rosters with /api/match/{matchId} endpoint

const MY_PARAMS = { fantaTeamId: "ft-mvp-1", season: 2024, round: 2 };
const AC_PARAMS = { fantaTeamId: "ft-mvp-7", season: 2024, round: 2 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? name;
  return last.length > 10 ? last.slice(0, 9) + "." : last;
}

type StarterRows = {
  GK:  RosterPlayer[];
  DEF: RosterPlayer[];
  MID: RosterPlayer[];
  ATT: RosterPlayer[];
};

function emptyRows(): StarterRows {
  return { GK: [], DEF: [], MID: [], ATT: [] };
}

type LineupSlot = {
  playerId:      number;
  slotPosition:  string;
  slotIndex:     number;
  isStarter:     boolean;
  benchOrder?:   number | null;
};

function getStarterRows(players: LineupSlot[], map: Map<number, RosterPlayer>): StarterRows {
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

function getBenchPlayers(players: LineupSlot[], map: Map<number, RosterPlayer>): RosterPlayer[] {
  return [...players]
    .filter(p => !p.isStarter)
    .sort((a, b) => (a.benchOrder ?? 999) - (b.benchOrder ?? 999))
    .flatMap(s => { const p = map.get(s.playerId); return p ? [p] : []; });
}

// x% per N giocatori equidistribuiti sul campo (campo: ~20% → 93% del container)
function xPositions(n: number): number[] {
  const L = 20, R = 93;
  return Array.from({ length: n }, (_, i) => L + ((i + 1) / (n + 1)) * (R - L));
}

// ─── MatchPlayerToken (~63% del token "field" del builder) ───────────────────

interface MatchTokenProps {
  player:    RosterPlayer;
  isCaptain?: boolean;
}

function MatchPlayerToken({ player, isCaptain = false }: MatchTokenProps) {
  const PHOTO   = 46;
  const RING    = 2;
  const OUTER   = PHOTO + RING * 2;
  const PILL_W  = 40;
  const PILL_H  = 10;
  const VBADGE  = 14;

  const affinityColor = "rgba(74,222,128,0.9)";
  const colors  = TEAM_COLORS[player.realTeam] ?? { primary: "#444", secondary: "#888" };
  const code    = TEAM_CODE[player.realTeam]   ?? "???";
  const hasVoto = player.votoMister !== null;
  const logoUrl = TEAM_LOGO_URL[player.realTeam];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
      <div style={{ position: "relative", width: OUTER, height: OUTER, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: RING, borderRadius: "50%", overflow: "hidden", background: "rgba(0,0,0,0.35)" }}>
          {(player.photoCartoonUrl ?? player.photoUrl) && (
            <img src={player.photoCartoonUrl ?? player.photoUrl!} alt={player.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          )}
        </div>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `${RING}px solid ${affinityColor}`, boxShadow: `0 0 5px ${affinityColor}55`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: -2, right: -2, width: VBADGE, height: VBADGE, borderRadius: "50%", background: hasVoto ? "#1f4733" : "rgba(0,0,0,0.45)", border: hasVoto ? "none" : "1px solid rgba(239,230,211,0.3)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
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
    </div>
  );
}

// ─── MatchMiniCoachToken — piccolo, per area tecnica in pitch ─────────────────

function MatchMiniCoachToken({ coach }: { coach: HeadCoach }) {
  const PHOTO  = 34;
  const RING   = 2;
  const OUTER  = PHOTO + RING * 2;

  const teamKey = coach.currentTeamName ?? "";
  const colors  = TEAM_COLORS[teamKey] ?? { primary: "#444", secondary: "#888" };
  const code    = TEAM_CODE[teamKey] ?? "—";
  const logoUrl = TEAM_LOGO_URL[teamKey];

  const shortName = (() => {
    const parts = coach.name.trim().split(/\s+/);
    const last = parts[parts.length - 1]!;
    return last.length > 8 ? last.slice(0, 7) + "." : last;
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, pointerEvents: "none" }}>
      <div style={{ position: "relative", width: OUTER, height: OUTER, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: RING, borderRadius: "50%", overflow: "hidden", background: "rgba(0,0,0,0.4)" }}>
          {coach.photoCartoonUrl && (
            <img src={coach.photoCartoonUrl} alt={coach.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          )}
        </div>
        {/* Ring dorato — distingue il mister dai giocatori */}
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `${RING}px solid rgba(244,196,48,0.82)`, boxShadow: "0 0 6px rgba(244,196,48,0.25)", pointerEvents: "none" }} />
      </div>

      {/* Mini pill colori squadra reale */}
      <div style={{ width: 30, height: 8, borderRadius: 3, overflow: "hidden", position: "relative", boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: colors.primary }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", background: colors.secondary }} />
        {logoUrl && (
          <img src={logoUrl} alt={code} style={{ position: "absolute", inset: 0, margin: "auto", width: 7, height: 7, objectFit: "contain", filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.9))" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        )}
      </div>

      <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(239,230,211,0.88)", fontFamily: "var(--font-sans)", textShadow: "0 1px 3px rgba(0,0,0,0.8)", whiteSpace: "nowrap" }}>
        {shortName}
      </span>
    </div>
  );
}

// ─── PitchHalf — una squadra sui propri slot di campo ────────────────────────

const ROLE_ORDER = ["GK", "DEF", "MID", "ATT"] as const;

interface PitchHalfProps {
  rows:      StarterRows;
  captainId: number | null;
  rowY:      Record<(typeof ROLE_ORDER)[number], number>;
}

function PitchHalf({ rows, captainId, rowY }: PitchHalfProps) {
  return (
    <>
      {ROLE_ORDER.map(role => {
        const players = rows[role];
        if (players.length === 0) return null;
        const y  = rowY[role];
        const xs = xPositions(players.length);
        return players.map((player, i) => (
          <div key={player.id} style={{ position: "absolute", left: `${xs[i]}%`, top: `${y}%`, zIndex: 2 }}>
            <MatchPlayerToken player={player} isCaptain={player.id === captainId} />
          </div>
        ));
      })}
    </>
  );
}

// ─── BenchCard — riga compatta per il dugout laterale ────────────────────────

const ROLE_CHIP: Record<string, { label: string; bg: string }> = {
  GK:  { label: "P", bg: "#f59e0b" },
  DEF: { label: "D", bg: "#3b82f6" },
  MID: { label: "C", bg: "#22c55e" },
  ATT: { label: "A", bg: "#ef4444" },
};

function BenchCard({ player, rank }: { player: RosterPlayer; rank: number }) {
  const colors  = TEAM_COLORS[player.realTeam] ?? { primary: "#444", secondary: "#888" };
  const hasVoto = player.votoMister !== null;
  const chip    = ROLE_CHIP[player.roleClassic] ?? { label: "?", bg: "#888" };
  const logoUrl = TEAM_LOGO_URL[player.realTeam];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", borderRadius: "var(--r-sm)", background: "var(--surface)", border: "1px solid var(--border)", flexShrink: 0 }}>
      {/* Numero panchina */}
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-faint)", width: 12, textAlign: "right", flexShrink: 0 }}>{rank}</span>

      {/* Foto */}
      <div style={{ position: "relative", width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "rgba(0,0,0,0.35)", border: "1.5px solid var(--border)" }}>
        {(player.photoCartoonUrl ?? player.photoUrl) && (
          <img src={player.photoCartoonUrl ?? player.photoUrl!} alt={player.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Chip ruolo */}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: "#fff", background: chip.bg, borderRadius: 3, padding: "1px 3px", flexShrink: 0 }}>
            {chip.label}
          </span>
          {/* Cognome */}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lastName(player.name)}
          </span>
        </div>
        {/* Pill bicolor + voto */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
          <div style={{ width: 24, height: 6, borderRadius: 2, overflow: "hidden", position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: colors.primary }} />
            <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", background: colors.secondary }} />
            {logoUrl && (
              <img src={logoUrl} alt="" style={{ position: "absolute", inset: 0, margin: "auto", width: 5, height: 5, objectFit: "contain", filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.9))" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            )}
          </div>
          {hasVoto && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "var(--green-mid)" }}>
              {player.votoMister!.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BenchPanel — colonna laterale dugout ────────────────────────────────────

interface BenchPanelProps {
  sigla:   string;
  bgColor: string;
  fgColor: string;
  players: RosterPlayer[];
  coach:   HeadCoach;
}

function BenchPanel({ sigla, bgColor, fgColor, players, coach }: BenchPanelProps) {
  const shortCoach = (() => {
    const parts = coach.name.trim().split(/\s+/);
    const last = parts[parts.length - 1]!;
    return last.length > 10 ? last.slice(0, 9) + "." : last;
  })();

  return (
    <div style={{ width: 155, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Intestazione panel */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", borderRadius: "var(--r-sm)", background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: fgColor }}>{sigla}</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "var(--ink-mid)", letterSpacing: "0.07em", textTransform: "uppercase" }}>Panchina</span>
      </div>

      {/* Coach info */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", borderRadius: "var(--r-sm)", background: "var(--surface)", border: "1px solid var(--border-strong)" }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "rgba(0,0,0,0.35)", border: "1.5px solid rgba(244,196,48,0.7)", flexShrink: 0 }}>
          {coach.photoCartoonUrl && (
            <img src={coach.photoCartoonUrl} alt={coach.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-faint)", display: "block", letterSpacing: "0.05em", textTransform: "uppercase" }}>Allenatore</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{shortCoach}</span>
        </div>
      </div>

      {/* Lista panchinari */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, overflowY: "auto", flex: 1 }}>
        {players.map((p, i) => <BenchCard key={p.id} player={p} rank={i + 1} />)}
        {players.length === 0 && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)", padding: "8px 6px" }}>Nessun panchinaro</span>
        )}
      </div>
    </div>
  );
}

// ─── MatchView ────────────────────────────────────────────────────────────────

export function MatchView() {
  const { data: myLineup, isLoading: myLoading } = useGetLineups(MY_PARAMS);
  const { data: acLineup, isLoading: acLoading } = useGetLineups(AC_PARAMS);

  const { avversario, giornata, competizione } = MATCH_GIORNATA_2;

  if (myLoading || acLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 220px)", color: "var(--ink-mid)", fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.06em" }}>
        Caricamento formazioni…
      </div>
    );
  }

  const myRows   = myLineup ? getStarterRows(myLineup.players, PLAYER_BY_ID)                   : emptyRows();
  const acRows   = acLineup ? getStarterRows(acLineup.players, ATLETICO_CAFFEINA_PLAYER_BY_ID) : emptyRows();
  const myBench  = myLineup ? getBenchPlayers(myLineup.players, PLAYER_BY_ID)                  : [];
  const acBench  = acLineup ? getBenchPlayers(acLineup.players, ATLETICO_CAFFEINA_PLAYER_BY_ID): [];
  const myCapId  = myLineup?.captainPlayerId ?? null;
  const acCapId  = acLineup?.captainPlayerId ?? null;

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
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.14em" }}>— : —</span>
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

      {/* ── Layout: [dugout AC] [pitch] [dugout Mario's] ── */}
      <div style={{ display: "flex", gap: 8, height: "calc(100vh - 248px)", alignItems: "flex-start" }}>

        {/* Dugout AC Caffeina (sinistra) */}
        <BenchPanel
          sigla="AC"
          bgColor="#C8102E"
          fgColor="#fff"
          players={acBench}
          coach={ATLETICO_CAFFEINA_COACH}
        />

        {/* ── Pitch ── */}
        <div style={{ flex: "0 0 auto", height: "100%", aspectRatio: "100 / 140", position: "relative", borderRadius: "var(--r-lg)", overflow: "hidden", border: "1px solid rgba(239,230,211,0.12)", userSelect: "none" }}>

          {/* SVG campo */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 100 140" preserveAspectRatio="none">
            <defs>
              <pattern id="match-stripes" x="0" y="0" width="100" height="8.75" patternUnits="userSpaceOnUse">
                <rect x="0" y="0"     width="100" height="4.375" fill="#1f4733" />
                <rect x="0" y="4.375" width="100" height="4.375" fill="#234e38" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="100" height="140" fill="url(#match-stripes)" />
            {/* Bordi e linee campo */}
            <rect x="18" y="5"  width="77" height="130" fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <line x1="18" y1="70" x2="95" y2="70" stroke="#ffffff" strokeWidth="0.6" />
            <circle cx="56.5" cy="70" r="11"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <circle cx="56.5" cy="70" r="0.8" fill="#ffffff" />
            {/* Area di rigore superiore */}
            <rect x="31" y="5"   width="51" height="20" fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <rect x="44" y="5"   width="25" height="9"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <circle cx="56.5" cy="17"  r="0.8" fill="#ffffff" />
            {/* Area di rigore inferiore */}
            <rect x="31" y="115" width="51" height="20" fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <rect x="44" y="126" width="25" height="9"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <circle cx="56.5" cy="123" r="0.8" fill="#ffffff" />
            {/* Archi D */}
            <path d="M 47 25 A 12.5 12.5 0 0 0 66 25"   fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <path d="M 66 115 A 12.5 12.5 0 0 0 47 115"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            {/* Angoli */}
            <path d="M 18 6.25 A 1.25 1.25 0 0 0 19.25 5"     fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <path d="M 93.75 5 A 1.25 1.25 0 0 0 95 6.25"     fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <path d="M 19.25 135 A 1.25 1.25 0 0 0 18 133.75"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <path d="M 95 133.75 A 1.25 1.25 0 0 0 93.75 135"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            {/* ── Area tecnica AC (top-left): x=0→16, y=21→55 ── */}
            <line x1="0"  y1="21" x2="16" y2="21" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.4" />
            <line x1="0"  y1="55" x2="16" y2="55" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.4" />
            <line x1="16" y1="21" x2="16" y2="55" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.6" />
            <polyline points="14,21 16,21 16,23"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <polyline points="14,55 16,55 16,53"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            {/* ── Area tecnica Mario's (bottom-left): x=0→16, y=85→119 ── */}
            <line x1="0"  y1="85"  x2="16" y2="85"  stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.4" />
            <line x1="0"  y1="119" x2="16" y2="119" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.4" />
            <line x1="16" y1="85"  x2="16" y2="119" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.6" />
            <polyline points="14,85  16,85  16,87"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <polyline points="14,119 16,119 16,117" fill="none" stroke="#ffffff" strokeWidth="0.6" />
          </svg>

          {/* Coach AC — area tecnica superiore: y=21→55 / 140 = 15%→39.3% */}
          <div style={{ position: "absolute", left: "0%", top: "15%", width: "16%", height: "24.3%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 2 }}>
            <MatchMiniCoachToken coach={ATLETICO_CAFFEINA_COACH} />
          </div>

          {/* Coach Mario's — area tecnica inferiore: y=85→119 / 140 = 60.7%→85% */}
          <div style={{ position: "absolute", left: "0%", top: "60.7%", width: "16%", height: "24.3%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 2 }}>
            <MatchMiniCoachToken coach={COACH_MARIO} />
          </div>

          {/* Atletico Caffeina — metà alta
              GK lontano dall'area (y=8), DEF dopo linea area (y=21), MID/ATT verso centrocampo */}
          <PitchHalf
            rows={acRows}
            captainId={acCapId}
            rowY={{ GK: 8, DEF: 21, MID: 31, ATT: 41 }}
          />

          {/* Mario's Squad — metà bassa (specchiata) */}
          <PitchHalf
            rows={myRows}
            captainId={myCapId}
            rowY={{ GK: 92, DEF: 79, MID: 69, ATT: 59 }}
          />
        </div>

        {/* Dugout Mario's Squad (destra) */}
        <BenchPanel
          sigla={MY_TEAM_INFO.sigla}
          bgColor={MY_TEAM_INFO.logoColori.bg}
          fgColor={MY_TEAM_INFO.logoColori.fg}
          players={myBench}
          coach={COACH_MARIO}
        />
      </div>
    </div>
  );
}
