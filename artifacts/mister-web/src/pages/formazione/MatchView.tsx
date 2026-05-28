import { Home, Plane } from "lucide-react";
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
  TEAM_LOGO_BY_CODE,
  type RosterPlayer,
  type HeadCoach,
} from "./mock-data";

// TODO: replace both rosters with /api/match/{matchId} endpoint

const MY_PARAMS = { fantaTeamId: "ft-mvp-1", season: 2024, round: 2 };
const AC_PARAMS = { fantaTeamId: "ft-mvp-7", season: 2024, round: 2 };

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

type StarterRows = { GK: RosterPlayer[]; DEF: RosterPlayer[]; MID: RosterPlayer[]; ATT: RosterPlayer[] };

function emptyRows(): StarterRows { return { GK: [], DEF: [], MID: [], ATT: [] }; }

type LineupSlot = {
  playerId:     number;
  slotPosition: string;
  slotIndex:    number;
  isStarter:    boolean;
  benchOrder?:  number | null;
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

// X% per N giocatori equidistribuiti sul campo (campo: ~20%→93% del container)
function xPositions(n: number): number[] {
  const L = 20, R = 93;
  return Array.from({ length: n }, (_, i) => L + ((i + 1) / (n + 1)) * (R - L));
}

// Fallback img: prova cartoon, se 404 prova la foto reale, altrimenti nascondi
function photoSrc(player: RosterPlayer): string {
  return (player.photoCartoonUrl ?? player.photoUrl) ?? "";
}

function photoOnError(player: RosterPlayer) {
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

function MatchPlayerToken({ player, isCaptain = false }: { player: RosterPlayer; isCaptain?: boolean }) {
  const PHOTO = 46, RING = 2, OUTER = PHOTO + RING * 2, PILL_W = 40, PILL_H = 10, VBADGE = 14;
  const affinityColor = "rgba(74,222,128,0.9)";
  const colors  = TEAM_COLORS[player.realTeam] ?? { primary: "#444", secondary: "#888" };
  const code    = TEAM_CODE[player.realTeam] ?? "???";
  const hasVoto = player.votoMister !== null;
  const logoUrl = TEAM_LOGO_URL[player.realTeam];
  const src     = photoSrc(player);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
      <div style={{ position: "relative", width: OUTER, height: OUTER, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: RING, borderRadius: "50%", overflow: "hidden", background: "rgba(0,0,0,0.35)" }}>
          {src && <img src={src} alt={player.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={photoOnError(player)} />}
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
  const PHOTO = 34, RING = 2, OUTER = PHOTO + RING * 2;
  const teamKey = coach.currentTeamName ?? "";
  const colors  = TEAM_COLORS[teamKey] ?? { primary: "#444", secondary: "#888" };
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
          {coach.photoCartoonUrl && <img src={coach.photoCartoonUrl} alt={coach.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
        </div>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `${RING}px solid rgba(244,196,48,0.82)`, boxShadow: "0 0 6px rgba(244,196,48,0.25)", pointerEvents: "none" }} />
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

function BenchRow({ player }: { player: RosterPlayer }) {
  const bg      = ROLE_ROW_BG[player.roleClassic] ?? "#1a3d2b";
  const colors  = TEAM_COLORS[player.realTeam] ?? { primary: "#444", secondary: "#888" };
  const code    = TEAM_CODE[player.realTeam] ?? "???";
  const logoUrl = TEAM_LOGO_URL[player.realTeam];
  const oppLogo = player.nextOpponentShort ? TEAM_LOGO_BY_CODE[player.nextOpponentShort] : undefined;
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

        {/* Avversario */}
        {player.nextOpponentShort && (
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
            {player.nextIsHome ? <Home size={7} color="rgba(255,255,255,0.5)" /> : <Plane size={7} color="rgba(255,255,255,0.5)" />}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em" }}>
              {player.nextOpponentShort}
            </span>
            {oppLogo && (
              <img src={oppLogo} alt="" style={{ width: 10, height: 10, objectFit: "contain", filter: "grayscale(100%) brightness(1.6)", opacity: 0.7 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            )}
          </div>
        )}

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
  players:  RosterPlayer[];
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
      flexDirection: "column",
    }}>
      {/* ── Tettoia: striscia sottile colorata con il colore squadra, solo crest ── */}
      <div style={{
        flexShrink: 0,
        height: 14,
        background: `linear-gradient(90deg, ${bgColor}70 0%, ${bgColor}28 100%)`,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", paddingLeft: 5,
        boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
      }}>
        <div style={{ width: 11, height: 11, borderRadius: "50%", background: bgColor, border: "1px solid rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 5.5, fontWeight: 800, color: fgColor, lineHeight: 1 }}>{sigla}</span>
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

interface VotiSectionProps {
  label:     string;
  sigla:     string;
  bgColor:   string;
  fgColor:   string;
  starters:  ReturnType<typeof getStartersOrdered>;
}

function VotiSection({ label, sigla, bgColor, fgColor, starters }: VotiSectionProps) {
  const validVoti = starters.filter(s => s.player.votoMister !== null).map(s => s.player.votoMister!);
  const somma     = validVoti.reduce((a, b) => a + b, 0);
  const hasSomma  = validVoti.length > 0;

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

      {/* Righe titolari */}
      <div style={{ flex: 1, overflowY: "auto", padding: "2px 0" }}>
        {starters.map(({ player, role, isCap }) => (
          <div key={player.id} style={{ display: "flex", alignItems: "center", padding: "2px 8px", gap: 4 }}>
            {/* Lettera ruolo */}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: ROLE_CHIP_COLOR[role], width: 8, flexShrink: 0 }}>
              {ROLE_LETTER[role]}
            </span>

            {/* Cognome + capitano */}
            <span style={{ flex: 1, minWidth: 0, fontSize: 10, fontWeight: 500, color: "rgba(239,230,211,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--font-sans)" }}>
              {lastName(player.name)}
              {isCap && (
                <span style={{ marginLeft: 3, fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 800, color: "#F4C430", verticalAlign: "middle" }}>C</span>
              )}
            </span>

            {/* Voto */}
            <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: player.votoMister !== null ? "#4ade80" : "rgba(239,230,211,0.28)", minWidth: 28, textAlign: "right" }}>
              {player.votoMister !== null ? player.votoMister.toFixed(1) : "S.V."}
            </span>
          </div>
        ))}
      </div>

      {/* Riga somma */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center",
        padding: "4px 8px",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(0,0,0,0.18)",
        gap: 4,
      }}>
        <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(239,230,211,0.38)", letterSpacing: "0.04em" }}>Totale*</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: hasSomma ? "rgba(239,230,211,0.75)" : "rgba(239,230,211,0.25)" }}>
          {hasSomma ? somma.toFixed(1) : "—"}
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
  acStarters, myStarters, acCapId, myCapId,
}: {
  acStarters: ReturnType<typeof getStartersOrdered>;
  myStarters: ReturnType<typeof getStartersOrdered>;
  acCapId:    number | null;
  myCapId:    number | null;
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
        <VotiSection label="Atletico Caffeina" sigla="AC" bgColor="#C8102E" fgColor="#fff" starters={acStarters} />
      </div>
      {/* Nota asterisco */}
      <span style={{ flexShrink: 0, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(239,230,211,0.25)", lineHeight: 1.3 }}>
        * somma provvisoria<br />calcolo completo allo step 5
      </span>
      {/* MS section */}
      <div style={{ flex: "1 1 0", minHeight: 0, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(10,24,20,0.75)", backdropFilter: "blur(4px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <VotiSection label="Mario's Squad" sigla={MY_TEAM_INFO.sigla} bgColor={MY_TEAM_INFO.logoColori.bg} fgColor={MY_TEAM_INFO.logoColori.fg} starters={myStarters} />
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

  const myRows     = myLineup ? getStarterRows(myLineup.players, PLAYER_BY_ID)                   : emptyRows();
  const acRows     = acLineup ? getStarterRows(acLineup.players, ATLETICO_CAFFEINA_PLAYER_BY_ID) : emptyRows();
  const myBench    = myLineup ? getBenchPlayers(myLineup.players, PLAYER_BY_ID)                  : [];
  const acBench    = acLineup ? getBenchPlayers(acLineup.players, ATLETICO_CAFFEINA_PLAYER_BY_ID): [];
  const myCapId    = myLineup?.captainPlayerId ?? null;
  const acCapId    = acLineup?.captainPlayerId ?? null;
  const myStarters = getStartersOrdered(myRows, myCapId);
  const acStarters = getStartersOrdered(acRows, acCapId);

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
            <MatchMiniCoachToken coach={ATLETICO_CAFFEINA_COACH} />
          </div>

          {/* Coach Mario's — area tecnica inferiore: y=85→119 / 140 = 60.7%→85% */}
          <div style={{ position: "absolute", left: "0%", top: "60.7%", width: "16%", height: "24.3%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 2 }}>
            <MatchMiniCoachToken coach={COACH_MARIO} />
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
          acCapId={acCapId}
          myCapId={myCapId}
        />
      </div>
    </div>
  );
}
