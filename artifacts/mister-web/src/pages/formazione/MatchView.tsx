import { useGetLineups } from "@workspace/api-client-react";
import {
  PLAYER_BY_ID,
  ATLETICO_CAFFEINA_PLAYER_BY_ID,
  MATCH_GIORNATA_2,
  MY_TEAM_INFO,
  TEAM_COLORS,
  TEAM_CODE,
  TEAM_LOGO_URL,
  type RosterPlayer,
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

function getStarterRows(
  players: Array<{ playerId: number; slotPosition: string; slotIndex: number; isStarter: boolean }>,
  map: Map<number, RosterPlayer>,
): StarterRows {
  const rows = emptyRows();
  [...players]
    .filter(p => p.isStarter)
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .forEach(s => {
      const p = map.get(s.playerId);
      if (!p) return;
      // "T" (trequartista) trattato come MID per il layout visivo
      const pos = (s.slotPosition === "T" ? "MID" : s.slotPosition) as keyof StarterRows;
      if (pos in rows) rows[pos].push(p);
    });
  return rows;
}

// X percentuali per N giocatori, distribuiti uniformemente sulla larghezza campo
// Il campo copre ~20%–93% della larghezza del container
function xPositions(n: number): number[] {
  const L = 20, R = 93;
  return Array.from({ length: n }, (_, i) => L + ((i + 1) / (n + 1)) * (R - L));
}

// ─── MatchPlayerToken (~63% delle dimensioni del token "field" del builder) ──

interface MatchTokenProps {
  player: RosterPlayer;
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
  const code    = TEAM_CODE[player.realTeam] ?? "???";
  const hasVoto = player.votoMister !== null;
  const logoUrl = TEAM_LOGO_URL[player.realTeam];

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
    }}>
      {/* Ring + foto */}
      <div style={{ position: "relative", width: OUTER, height: OUTER, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: RING, borderRadius: "50%", overflow: "hidden", background: "rgba(0,0,0,0.35)" }}>
          {(player.photoCartoonUrl ?? player.photoUrl) && (
            <img
              src={player.photoCartoonUrl ?? player.photoUrl!}
              alt={player.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>

        {/* Ring verde */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: `${RING}px solid ${affinityColor}`,
          boxShadow: `0 0 5px ${affinityColor}55`,
          pointerEvents: "none",
        }} />

        {/* Badge voto — top right */}
        <div style={{
          position: "absolute", top: -2, right: -2,
          width: VBADGE, height: VBADGE, borderRadius: "50%",
          background: hasVoto ? "#1f4733" : "rgba(0,0,0,0.45)",
          border: hasVoto ? "none" : "1px solid rgba(239,230,211,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
            {hasVoto ? player.votoMister!.toFixed(1) : "—"}
          </span>
        </div>

        {/* Badge capitano — bottom right */}
        {isCaptain && (
          <div style={{
            position: "absolute", bottom: -2, right: -2,
            width: 14, height: 14, borderRadius: "50%",
            background: "#F4C430",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 800, color: "#333" }}>C</span>
          </div>
        )}
      </div>

      {/* Pill bicolor squadra reale */}
      <div style={{
        width: PILL_W, height: PILL_H, borderRadius: 4, overflow: "hidden",
        position: "relative", flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
      }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: colors.primary }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", background: colors.secondary }} />
        {logoUrl ? (
          <img
            src={logoUrl} alt={code}
            style={{ position: "absolute", inset: 0, margin: "auto", width: 9, height: 9, objectFit: "contain", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>
            {code}
          </span>
        )}
      </div>

      {/* Cognome */}
      <span style={{
        fontSize: 10, fontWeight: 600,
        color: "rgba(239,230,211,0.92)", fontFamily: "var(--font-sans)",
        textAlign: "center", lineHeight: 1.2,
        maxWidth: Math.max(OUTER, PILL_W) + 6,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        textShadow: "0 1px 3px rgba(0,0,0,0.7)",
      }}>
        {lastName(player.name)}
      </span>
    </div>
  );
}

// ─── PitchHalf — posiziona i token di una squadra sulla propria metà ──────────

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
          <div
            key={player.id}
            style={{ position: "absolute", left: `${xs[i]}%`, top: `${y}%`, zIndex: 2 }}
          >
            <MatchPlayerToken player={player} isCaptain={player.id === captainId} />
          </div>
        ));
      })}
    </>
  );
}

// ─── MatchView ────────────────────────────────────────────────────────────────

export function MatchView() {
  // Due hook separati — React Query li batcha automaticamente se stesso tick
  const { data: myLineup, isLoading: myLoading } = useGetLineups(MY_PARAMS);
  const { data: acLineup, isLoading: acLoading } = useGetLineups(AC_PARAMS);

  const { avversario, giornata, competizione } = MATCH_GIORNATA_2;

  if (myLoading || acLoading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "calc(100vh - 220px)",
        color: "var(--ink-mid)", fontFamily: "var(--font-mono)", fontSize: 13,
        letterSpacing: "0.06em",
      }}>
        Caricamento formazioni…
      </div>
    );
  }

  const myRows  = myLineup  ? getStarterRows(myLineup.players,  PLAYER_BY_ID)                   : emptyRows();
  const acRows  = acLineup  ? getStarterRows(acLineup.players,  ATLETICO_CAFFEINA_PLAYER_BY_ID) : emptyRows();
  const myCapId = myLineup?.captainPlayerId ?? null;
  const acCapId = acLineup?.captainPlayerId ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Header match ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px",
        background: "var(--surface)", borderRadius: "var(--r-md)",
        border: "1px solid var(--border)",
      }}>
        {/* Mario's Squad */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: MY_TEAM_INFO.logoColori.bg, border: "1.5px solid var(--green-mid)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: MY_TEAM_INFO.logoColori.fg }}>
              {MY_TEAM_INFO.sigla}
            </span>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.04em" }}>
            Mario&apos;s Squad
          </span>
        </div>

        {/* Risultato placeholder + info partita */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.14em" }}>
            — : —
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-mid)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
            {competizione} · Giornata {giornata}
          </span>
        </div>

        {/* Atletico Caffeina */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.04em" }}>
            {avversario}
          </span>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "#C8102E", border: "1.5px solid rgba(0,0,0,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "#fff" }}>AC</span>
          </div>
        </div>
      </div>

      {/* ── Pitch — altezza viewport-bound, larghezza determinata dall'aspect ratio ── */}
      <div style={{ height: "calc(100vh - 220px)", display: "flex", justifyContent: "center" }}>
        <div style={{
          position: "relative",
          height: "100%",
          aspectRatio: "100 / 140",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
          border: "1px solid rgba(239,230,211,0.12)",
          userSelect: "none",
        }}>
          {/* SVG linee campo */}
          <svg
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
            viewBox="0 0 100 140"
            preserveAspectRatio="none"
          >
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
            {/* Aree di rigore */}
            <rect x="31" y="5"   width="51" height="20" fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <rect x="44" y="5"   width="25" height="9"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <circle cx="56.5" cy="17"  r="0.8" fill="#ffffff" />
            <rect x="31" y="115" width="51" height="20" fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <rect x="44" y="126" width="25" height="9"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <circle cx="56.5" cy="123" r="0.8" fill="#ffffff" />
            {/* Archi D */}
            <path d="M 47 25 A 12.5 12.5 0 0 0 66 25"   fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <path d="M 66 115 A 12.5 12.5 0 0 0 47 115"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            {/* Archi d'angolo */}
            <path d="M 18 6.25 A 1.25 1.25 0 0 0 19.25 5"     fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <path d="M 93.75 5 A 1.25 1.25 0 0 0 95 6.25"     fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <path d="M 19.25 135 A 1.25 1.25 0 0 0 18 133.75"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
            <path d="M 95 133.75 A 1.25 1.25 0 0 0 93.75 135"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
          </svg>

          {/* Atletico Caffeina — metà alta (GK in cima, ATT verso centrocampo) */}
          <PitchHalf
            rows={acRows}
            captainId={acCapId}
            rowY={{ GK: 7, DEF: 17, MID: 28, ATT: 40 }}
          />

          {/* Mario's Squad — metà bassa (ATT verso centrocampo, GK in fondo) */}
          <PitchHalf
            rows={myRows}
            captainId={myCapId}
            rowY={{ GK: 93, DEF: 83, MID: 72, ATT: 60 }}
          />
        </div>
      </div>
    </div>
  );
}
