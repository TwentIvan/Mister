import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetCompetitionMatches,
  useGetCompetitionStandings,
  type CompetitionMatch,
  type StandingsEntry,
} from "@workspace/api-client-react";

const DEFAULT_COMPETITION_ID = "comp-mvp-campionato-2024";
const MY_TEAM_ID = "ft-mvp-1";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

function sign(n: number): string {
  if (n > 0) return `+${n.toFixed(2)}`;
  if (n < 0) return n.toFixed(2);
  return "0.00";
}

function nullish(v: string | null | undefined): string | null {
  return v ?? null;
}

function score(v: number | null | undefined): number | null {
  return v ?? null;
}

// ─── TeamBadge ───────────────────────────────────────────────────────────────

function TeamBadge({
  code3, colorPrimary, colorSecondary, logoUrl, size = 26,
}: {
  code3: string | null | undefined;
  colorPrimary: string;
  colorSecondary: string;
  logoUrl: string | null | undefined;
  size?: number;
}) {
  const text = (code3 ?? "???").slice(0, 3);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: colorPrimary,
      border: "1.5px solid rgba(0,0,0,0.1)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      {logoUrl ? (
        <img
          src={logoUrl} alt={text}
          style={{ width: size * 0.6, height: size * 0.6, objectFit: "contain" }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: size * 0.3, fontWeight: 700, color: colorSecondary, letterSpacing: "0.02em" }}>
          {text}
        </span>
      )}
    </div>
  );
}

// ─── MatchRow ─────────────────────────────────────────────────────────────────

function MatchRow({
  match, onNavigate,
}: {
  match: CompetitionMatch;
  onNavigate: (matchId: number) => void;
}) {
  const played = match.status === "played";
  const hs = score(match.homeScore);
  const as_ = score(match.awayScore);
  const homeWon = played && hs !== null && as_ !== null && hs > as_;
  const awayWon = played && hs !== null && as_ !== null && as_ > hs;

  return (
    <div
      onClick={() => played && onNavigate(match.id)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 12px",
        borderRadius: 6,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(31,71,51,0.1)",
        cursor: played ? "pointer" : "default",
        opacity: played ? 1 : 0.45,
        transition: "background 0.1s",
      }}
      onMouseEnter={e => { if (played) (e.currentTarget as HTMLDivElement).style.background = "rgba(31,71,51,0.1)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }}
    >
      {/* Home */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", minWidth: 0 }}>
        <span style={{
          fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: homeWon ? 700 : 500,
          color: homeWon ? "var(--ink)" : "var(--ink-mid)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {match.homeTeam.name}
        </span>
        <TeamBadge
          code3={match.homeTeam.code3}
          colorPrimary={match.homeTeam.colorPrimary}
          colorSecondary={match.homeTeam.colorSecondary}
          logoUrl={match.homeTeam.logoUrl}
          size={22}
        />
      </div>

      {/* Score */}
      <div style={{ width: 88, flexShrink: 0, textAlign: "center" }}>
        {played && hs !== null && as_ !== null ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.08em" }}>
            {hs.toFixed(2)}&nbsp;—&nbsp;{as_.toFixed(2)}
          </span>
        ) : (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-dim)", letterSpacing: "0.05em" }}>vs</span>
        )}
      </div>

      {/* Away */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <TeamBadge
          code3={match.awayTeam.code3}
          colorPrimary={match.awayTeam.colorPrimary}
          colorSecondary={match.awayTeam.colorSecondary}
          logoUrl={match.awayTeam.logoUrl}
          size={22}
        />
        <span style={{
          fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: awayWon ? 700 : 500,
          color: awayWon ? "var(--ink)" : "var(--ink-mid)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {match.awayTeam.name}
        </span>
      </div>
    </div>
  );
}

// ─── CALENDARIO ──────────────────────────────────────────────────────────────

function TabCalendario({ matches, onNavigate }: { matches: CompetitionMatch[]; onNavigate: (id: number) => void }) {
  const rounds = useMemo(() => {
    const map = new Map<number, CompetitionMatch[]>();
    for (const m of matches) {
      if (!map.has(m.round)) map.set(m.round, []);
      map.get(m.round)!.push(m);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [matches]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {rounds.map(([round, roundMatches]) => {
        const played = roundMatches.some(m => m.status === "played");
        const date = roundMatches.find(m => m.playedAt)?.playedAt;
        return (
          <div key={round}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid rgba(31,71,51,0.12)" }}>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.01em" }}>
                Giornata {round}
              </span>
              <span style={{
                padding: "2px 8px", borderRadius: 99,
                fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase" as const,
                background: played ? "rgba(31,71,51,0.12)" : "rgba(0,0,0,0.06)",
                color: played ? "var(--green-deep)" : "var(--ink-dim)",
              }}>
                {played ? "Giocata" : "Da giocare"}
              </span>
              {date && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)", marginLeft: "auto" }}>
                  {formatDate(date)}
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {roundMatches.map(m => (
                <MatchRow key={m.id} match={m} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

function MatchCard({ match, onNavigate }: { match: CompetitionMatch; onNavigate: (id: number) => void }) {
  const hs = score(match.homeScore);
  const as_ = score(match.awayScore);
  const homeWon = hs !== null && as_ !== null && hs > as_;
  const awayWon = hs !== null && as_ !== null && as_ > hs;

  return (
    <div
      onClick={() => onNavigate(match.id)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px",
        borderRadius: 8,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        cursor: "pointer",
        transition: "border-color 0.1s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(31,71,51,0.4)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}
    >
      {/* Home */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end", minWidth: 0 }}>
        <div style={{ minWidth: 0, textAlign: "right" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: homeWon ? 700 : 500, color: homeWon ? "var(--ink)" : "var(--ink-mid)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {match.homeTeam.name}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-dim)", letterSpacing: "0.05em" }}>
            {nullish(match.homeTeam.code3) ?? "—"}
          </div>
        </div>
        <TeamBadge
          code3={match.homeTeam.code3}
          colorPrimary={match.homeTeam.colorPrimary}
          colorSecondary={match.homeTeam.colorSecondary}
          logoUrl={match.homeTeam.logoUrl}
          size={32}
        />
      </div>

      {/* Score centrale */}
      <div style={{ width: 120, flexShrink: 0, textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.1em", lineHeight: 1 }}>
          {hs !== null ? hs.toFixed(2) : "—"}
          <span style={{ color: "var(--ink-dim)", margin: "0 4px" }}>:</span>
          {as_ !== null ? as_.toFixed(2) : "—"}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-dim)", marginTop: 4 }}>
          {formatDate(match.playedAt)}
        </div>
      </div>

      {/* Away */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <TeamBadge
          code3={match.awayTeam.code3}
          colorPrimary={match.awayTeam.colorPrimary}
          colorSecondary={match.awayTeam.colorSecondary}
          logoUrl={match.awayTeam.logoUrl}
          size={32}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: awayWon ? 700 : 500, color: awayWon ? "var(--ink)" : "var(--ink-mid)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {match.awayTeam.name}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-dim)", letterSpacing: "0.05em" }}>
            {nullish(match.awayTeam.code3) ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RISULTATI ───────────────────────────────────────────────────────────────

function TabRisultati({ matches, onNavigate }: { matches: CompetitionMatch[]; onNavigate: (id: number) => void }) {
  const playedRounds = useMemo(() => {
    const rs = new Set(matches.filter(m => m.status === "played").map(m => m.round));
    return [...rs].sort((a, b) => a - b);
  }, [matches]);

  const allRounds = useMemo(() => {
    const rs = new Set(matches.map(m => m.round));
    return [...rs].sort((a, b) => a - b);
  }, [matches]);

  const defaultRound = playedRounds[playedRounds.length - 1] ?? allRounds[0] ?? 1;
  const [selectedRound, setSelectedRound] = useState<number>(defaultRound);

  const roundMatches = useMemo(
    () => matches.filter(m => m.round === selectedRound && m.status === "played"),
    [matches, selectedRound],
  );

  if (allRounds.length === 0) return (
    <div style={{ padding: "40px 0", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink-dim)" }}>
      Nessuna partita disponibile
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {allRounds.map(r => {
          const isPlayed = playedRounds.includes(r);
          const isSelected = r === selectedRound;
          return (
            <button
              key={r}
              onClick={() => isPlayed && setSelectedRound(r)}
              disabled={!isPlayed}
              style={{
                padding: "5px 12px", borderRadius: 6,
                fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
                cursor: isPlayed ? "pointer" : "not-allowed",
                border: isSelected ? "2px solid var(--green-deep)" : "1px solid var(--border)",
                background: isSelected ? "rgba(31,71,51,0.12)" : "transparent",
                color: isSelected ? "var(--green-deep)" : isPlayed ? "var(--ink-mid)" : "var(--ink-dim)",
                opacity: isPlayed ? 1 : 0.38,
                transition: "all 0.1s",
              }}
            >
              {r}
            </button>
          );
        })}
      </div>

      {roundMatches.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink-dim)" }}>
          Giornata {selectedRound} non ancora giocata
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {roundMatches.map(m => <MatchCard key={m.id} match={m} onNavigate={onNavigate} />)}
        </div>
      )}
    </div>
  );
}

// ─── CLASSIFICA ──────────────────────────────────────────────────────────────

function TabClassifica({ standings }: { standings: StandingsEntry[] }) {
  if (standings.length === 0) return (
    <div style={{ padding: "40px 0", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink-dim)" }}>
      Classifica non disponibile
    </div>
  );

  const COL_MONO: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    textAlign: "right",
    whiteSpace: "nowrap",
    padding: "0 6px",
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid rgba(31,71,51,0.2)" }}>
            {["#", "Squadra", "G", "V", "P", "S", "GF", "GS", "DR", "PT"].map(h => (
              <th
                key={h}
                style={{
                  ...COL_MONO,
                  textAlign: h === "Squadra" ? "left" : "right",
                  paddingBottom: 8,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--ink-dim)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {standings.map((s, idx) => {
            const isFirst = idx === 0;
            const isMyTeam = s.fantaTeam.id === MY_TEAM_ID;
            return (
              <tr
                key={s.fantaTeam.id}
                style={{
                  background: isFirst
                    ? "rgba(31,71,51,0.08)"
                    : isMyTeam
                    ? "rgba(31,71,51,0.04)"
                    : "transparent",
                  borderBottom: "1px solid rgba(31,71,51,0.1)",
                }}
              >
                <td style={{ ...COL_MONO, paddingLeft: 8, paddingTop: 8, paddingBottom: 8, color: isFirst ? "var(--green-deep)" : "var(--ink-mid)", fontWeight: isFirst ? 700 : 400, width: 32 }}>
                  {s.position}
                </td>
                <td style={{ padding: "8px 8px 8px 6px", textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <TeamBadge
                      code3={s.fantaTeam.code3}
                      colorPrimary={s.fantaTeam.colorPrimary}
                      colorSecondary={s.fantaTeam.colorSecondary}
                      logoUrl={s.fantaTeam.logoUrl}
                      size={24}
                    />
                    <div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: isMyTeam ? 700 : 500, color: "var(--ink)", whiteSpace: "nowrap" }}>
                        {s.fantaTeam.name}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-dim)", letterSpacing: "0.04em" }}>
                        {nullish(s.fantaTeam.code3) ?? "—"}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ ...COL_MONO, color: "var(--ink-mid)", paddingTop: 8, paddingBottom: 8 }}>{s.playedMatches}</td>
                <td style={{ ...COL_MONO, color: "var(--ink-mid)", paddingTop: 8, paddingBottom: 8 }}>{s.wins}</td>
                <td style={{ ...COL_MONO, color: "var(--ink-mid)", paddingTop: 8, paddingBottom: 8 }}>{s.draws}</td>
                <td style={{ ...COL_MONO, color: "var(--ink-mid)", paddingTop: 8, paddingBottom: 8 }}>{s.losses}</td>
                <td style={{ ...COL_MONO, color: "var(--ink-mid)", paddingTop: 8, paddingBottom: 8 }}>{s.gf.toFixed(2)}</td>
                <td style={{ ...COL_MONO, color: "var(--ink-mid)", paddingTop: 8, paddingBottom: 8 }}>{s.gs.toFixed(2)}</td>
                <td style={{ ...COL_MONO, color: s.gd >= 0 ? "var(--green-deep)" : "#b91c1c", paddingTop: 8, paddingBottom: 8 }}>
                  {sign(s.gd)}
                </td>
                <td style={{ ...COL_MONO, fontWeight: 700, fontSize: 14, color: "var(--ink)", paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}>
                  {s.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── TopNav ───────────────────────────────────────────────────────────────────

function TopNav({ activePath }: { activePath: "formazione" | "competizione" }) {
  const [, navigate] = useLocation();
  const COMP_ID = DEFAULT_COMPETITION_ID;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 20, paddingBottom: 12,
      borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 700, color: "var(--green-deep)", letterSpacing: "-0.01em" }}>
        Mister
      </span>
      <div style={{ display: "flex", gap: 4, padding: "3px", borderRadius: 8, background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
        {(["formazione", "competizione"] as const).map(item => {
          const isActive = activePath === item;
          const label = item === "formazione" ? "Formazione" : "Competizione";
          const href = item === "formazione" ? "/squadra/formazione" : `/competizione/${COMP_ID}`;
          return (
            <button
              key={item}
              onClick={() => navigate(href)}
              style={{
                padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
                letterSpacing: "0.04em",
                background: isActive ? "var(--green-deep)" : "transparent",
                color: isActive ? "#fff" : "var(--ink-mid)",
                transition: "background 0.12s, color 0.12s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── CompetizionePage ─────────────────────────────────────────────────────────

type Tab = "calendario" | "risultati" | "classifica";

export default function CompetizionePage() {
  const params = useParams<{ competitionId: string }>();
  const competitionId = params.competitionId ?? DEFAULT_COMPETITION_ID;
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("calendario");

  const { data: matchesData, isLoading: matchesLoading } = useGetCompetitionMatches(competitionId);
  const { data: standingsData, isLoading: standingsLoading } = useGetCompetitionStandings(competitionId);

  const matches = matchesData?.matches ?? [];
  const standings = standingsData?.standings ?? [];

  function handleNavigateToMatch(matchId: number) {
    navigate(`/partita/${matchId}`);
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "calendario", label: "Calendario" },
    { key: "risultati",  label: "Risultati" },
    { key: "classifica", label: "Classifica" },
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", fontFamily: "var(--font-sans)" }}>
      <TopNav activePath="competizione" />

      {/* Tabbar */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid rgba(31,71,51,0.12)" }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "10px 20px", border: "none", background: "transparent",
                fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--green-deep)" : "var(--ink-mid)",
                cursor: "pointer",
                borderBottom: isActive ? "2px solid var(--green-deep)" : "2px solid transparent",
                marginBottom: -2,
                transition: "color 0.1s",
                letterSpacing: "0.01em",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {(matchesLoading || standingsLoading) ? (
        <div style={{ padding: "60px 0", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink-dim)", letterSpacing: "0.06em" }}>
          Caricamento…
        </div>
      ) : (
        <>
          {activeTab === "calendario"  && <TabCalendario  matches={matches}   onNavigate={handleNavigateToMatch} />}
          {activeTab === "risultati"   && <TabRisultati   matches={matches}   onNavigate={handleNavigateToMatch} />}
          {activeTab === "classifica"  && <TabClassifica  standings={standings} />}
        </>
      )}
    </div>
  );
}
