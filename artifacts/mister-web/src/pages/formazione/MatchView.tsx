import { MATCH_GIORNATA_2, MY_TEAM_INFO, ATLETICO_CAFFEINA_ROSTER, ATLETICO_CAFFEINA_COACH } from "./mock-data";

// TODO: replace both rosters with /api/match/{matchId} endpoint

export function MatchView() {
  const { avversario, giornata, competizione } = MATCH_GIORNATA_2;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: 400, borderRadius: "var(--r-md)",
      background: "var(--surface)", border: "1px solid var(--border)",
      flexDirection: "column", gap: 8,
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink-mid)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {competizione} · Giornata {giornata}
      </span>
      <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
        Mario&apos;s Squad vs {avversario}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.05em" }}>
        Vista Match — in costruzione ({ATLETICO_CAFFEINA_ROSTER.length + 25} giocatori · coach: {ATLETICO_CAFFEINA_COACH.name})
      </span>
    </div>
  );
}
