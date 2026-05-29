import { useParams, useLocation } from "wouter";
import { useGetMatch } from "@workspace/api-client-react";
import { MatchView } from "@/pages/formazione/MatchView";

const DEFAULT_COMPETITION_ID = "comp-mvp-campionato-2024";
const SEASON = 2024;

export default function MatchDetailPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = parseInt(params.matchId ?? "0", 10);
  const [, navigate] = useLocation();

  const { data: match, isLoading, isError } = useGetMatch(matchId);

  if (isLoading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "calc(100vh - 220px)",
        fontFamily: "var(--font-mono)", fontSize: 13,
        color: "var(--ink-mid)", letterSpacing: "0.06em",
      }}>
        Caricamento partita…
      </div>
    );
  }

  if (isError || !match) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "calc(100vh - 220px)", gap: 16,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ink-mid)" }}>
          Partita non trovata
        </span>
        <button
          onClick={() => navigate(`/competizione/${DEFAULT_COMPETITION_ID}`)}
          style={{
            padding: "7px 16px", borderRadius: 6, border: "1px solid var(--green-deep)",
            background: "transparent", color: "var(--green-deep)",
            fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Torna alla competizione
        </button>
      </div>
    );
  }

  if (match.status !== "played") {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "calc(100vh - 220px)", gap: 24,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
            Partita non ancora giocata
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink-mid)" }}>
            Giornata {match.round} · {match.homeTeam.name} vs {match.awayTeam.name}
          </div>
        </div>
        <button
          onClick={() => navigate(`/competizione/${DEFAULT_COMPETITION_ID}`)}
          style={{
            padding: "8px 20px", borderRadius: 6,
            border: "1px solid var(--green-deep)",
            background: "transparent", color: "var(--green-deep)",
            fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
            cursor: "pointer", letterSpacing: "0.04em",
            transition: "background 0.1s, color 0.1s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--green-deep)";
            (e.currentTarget as HTMLButtonElement).style.color = "#fff";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--green-deep)";
          }}
        >
          Torna alla competizione
        </button>
      </div>
    );
  }

  const home = match.homeTeam;
  const away = match.awayTeam;

  function code3(team: typeof home): string {
    return (team.code3 ?? team.name.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 3));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Back link */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => navigate(`/competizione/${DEFAULT_COMPETITION_ID}`)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "none", border: "none", padding: 0,
            fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-dim)",
            cursor: "pointer", letterSpacing: "0.04em",
          }}
        >
          ← Competizione · Giornata {match.round}
        </button>
      </div>

      <MatchView
        homeTeamId={home.id}
        awayTeamId={away.id}
        homeTeamName={home.name}
        awayTeamName={away.name}
        homeTeamCode3={code3(home)}
        awayTeamCode3={code3(away)}
        homeTeamPrimary={home.colorPrimary ?? "#1f4733"}
        homeTeamSecondary={home.colorSecondary ?? "#efe6d3"}
        awayTeamPrimary={away.colorPrimary ?? "#1f4733"}
        awayTeamSecondary={away.colorSecondary ?? "#efe6d3"}
        round={match.round}
        season={SEASON}
        homeScore={match.homeScore ?? null}
        awayScore={match.awayScore ?? null}
      />
    </div>
  );
}
