import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useRouteId, RouteIdLoading } from "@/hooks/useRouteId";
import {
  useGetCompetitionStandings,
  type StandingsEntry,
} from "@workspace/api-client-react";

// ─── C-crest (bicolore split diagonale 135°, monogramma) ─────────────────────

function Crest({
  colorPrimary,
  colorSecondary,
  code,
}: {
  colorPrimary: string;
  colorSecondary: string;
  code: string;
}) {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        flexShrink: 0,
        background: `linear-gradient(135deg, ${colorPrimary} 0 49%, ${colorSecondary} 51% 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "var(--mono)",
        fontSize: "7.5px",
        fontWeight: 700,
        boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.25)",
        letterSpacing: ".02em",
      }}
    >
      {code.slice(0, 2)}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function teamInitials(entry: StandingsEntry): string {
  const name = entry.fantaTeam.name;
  if (name) {
    return name
      .split(/\s+/)
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (entry.fantaTeam.id ?? "??")
    .replace(/^ft-/, "")
    .slice(0, 2)
    .toUpperCase();
}

function teamDisplayName(entry: StandingsEntry): string {
  return entry.fantaTeam.name ?? `Squadra ${entry.position}`;
}

// movimento freccia — placeholder (nessun dato storico disponibile)
function MovArrow() {
  return (
    <span style={{ fontSize: "6.5px", marginTop: 1, color: "var(--muted)" }}>
      —
    </span>
  );
}

// ─── Colonne header ───────────────────────────────────────────────────────────
// Grid: 22px · 1fr · 14px · 38px · 30px · 30px · 22px · 38px
//        #  · Sq  ·  G  · V·N·P · GF  · GS  · Pt  · PF
// GF/GS a 30px perché i valori attuali (punteggio fanta, non gol classico) sono a 3 cifre

const GRID = "22px 1fr 14px 38px 30px 30px 22px 38px";
const GAP = 3;

const monoSm: React.CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10.5,
  textAlign: "center",
  color: "var(--green)",
};

// ─── ClassificaPage ───────────────────────────────────────────────────────────

export default function ClassificaPage() {
  const competitionId = useRouteId("competitionId");
  const [, navigate] = useLocation();

  const navRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useGetCompetitionStandings(competitionId ?? "");
  const standings = data?.standings ?? [];

  if (!competitionId) return <RouteIdLoading />;

  const maxGiornata =
    standings.length > 0 ? Math.max(...standings.map((s) => s.playedMatches)) : 0;

  // Scrolla il subnav in modo che la pill attiva "Classifica" sia visibile
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>("[data-active='true']");
    if (active) {
      active.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" });
    }
  }, []);

  return (
    /*
     * Wrapper esterno: sfondo grigio warm come nel mockup.
     * Il "phone" è centrato — in produzione questa schermata
     * sarà integrata nella nav mobile; per ora appare come
     * standalone nel contenuto dell'app.
     */
    <div
      style={{
        background: "#cfc6ad",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "24px 12px 64px",
        overflowX: "auto",
      }}
    >
      {/* ── Phone frame ── */}
      <div
        style={{
          width: 390,
          background: "var(--cream)",
          border: "9px solid #2a2a2a",
          borderRadius: 36,
          overflow: "hidden",
          boxShadow: "0 18px 50px rgba(0,0,0,.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 800,
            position: "relative",
          }}
        >
          {/* ── Barra superiore ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "13px 15px 9px",
            }}
          >
            <button
              onClick={() => window.history.back()}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--green)",
                display: "flex",
                cursor: "pointer",
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--disp)",
                  fontWeight: 600,
                  fontSize: 15,
                  lineHeight: 1.05,
                  color: "var(--green)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                Campionato 2024
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: ".07em",
                  fontFamily: "var(--mono)",
                }}
              >
                Federazione · Classic
              </div>
            </div>
            <button
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--green)",
                display: "flex",
                cursor: "pointer",
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>
          </div>

          {/* ── Sub-nav pills ── */}
          <div
            ref={navRef}
            style={{
              display: "flex",
              gap: 7,
              padding: "4px 15px 10px",
              overflowX: "auto",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            } as React.CSSProperties}
          >
            {(
              [
                "Panoramica",
                "Rosa",
                "Formazione",
                "Mercato",
                "Classifica",
                "Società",
              ] as const
            ).map((pill) => {
              const active = pill === "Classifica";
              return (
                <span
                  key={pill}
                  data-active={active ? "true" : undefined}
                  style={{
                    flexShrink: 0,
                    fontSize: 11,
                    fontFamily: "var(--mono)",
                    border: `1px solid ${active ? "var(--green)" : "var(--line)"}`,
                    background: active ? "var(--green)" : "var(--paper)",
                    color: active ? "var(--cream)" : "var(--green-l)",
                    borderRadius: 20,
                    padding: "6px 13px",
                    cursor: "pointer",
                  }}
                >
                  {pill}
                </span>
              );
            })}
          </div>

          {/* ── Context row ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "2px 16px 12px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--disp)",
                fontWeight: 600,
                fontSize: 13,
                color: "var(--green)",
              }}
            >
              Serie A · Giornata {maxGiornata}
            </span>
            <span
              style={{
                fontSize: 9,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: ".07em",
                fontFamily: "var(--mono)",
              }}
            >
              {isLoading ? "caricamento" : "aggiornata"}
            </span>
          </div>

          {/* ── Tabella ── */}
          <div
            style={{
              margin: "0 11px",
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {/* Intestazione */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                alignItems: "center",
                gap: GAP,
                padding: "7px 10px",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span
                style={{
                  textAlign: "center",
                  fontSize: 8,
                  textTransform: "uppercase",
                  letterSpacing: ".02em",
                  color: "var(--muted)",
                  fontFamily: "var(--mono)",
                }}
              >
                #
              </span>
              <span
                style={{
                  fontFamily: "var(--disp)",
                  fontWeight: 600,
                  fontSize: 9,
                  letterSpacing: ".04em",
                  color: "var(--green)",
                }}
              >
                Squadra
              </span>
              {(["G", "V·N·P", "GF", "GS", "Pt", "PF"] as const).map((h) => (
                <span
                  key={h}
                  style={{
                    textAlign: "center",
                    fontSize: 8,
                    textTransform: "uppercase",
                    letterSpacing: ".02em",
                    color: "var(--muted)",
                    fontFamily: "var(--mono)",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Righe */}
            {isLoading ? (
              <div
                style={{
                  padding: "32px",
                  textAlign: "center",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--muted)",
                }}
              >
                Caricamento…
              </div>
            ) : standings.length === 0 ? (
              <div
                style={{
                  padding: "32px",
                  textAlign: "center",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--muted)",
                }}
              >
                Nessun dato — nessuna partita giocata
              </div>
            ) : (
              standings.map((s, idx) => {
                const isFirst = idx === 0;
                const code = teamInitials(s);
                const cp = s.fantaTeam.colorPrimary ?? "#1f4733";
                const cs = s.fantaTeam.colorSecondary ?? "#efe6d3";
                return (
                  <div
                    key={s.fantaTeam.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: GRID,
                      alignItems: "center",
                      gap: GAP,
                      padding: "7px 10px",
                      borderBottom:
                        idx < standings.length - 1
                          ? "1px solid rgba(216,204,174,.5)"
                          : "none",
                      // Capolista: filo verde a sinistra (R-oro: non oro)
                      boxShadow: isFirst
                        ? "inset 3px 0 0 var(--green-l)"
                        : "none",
                    }}
                  >
                    {/* Posizione + freccia */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        lineHeight: 1,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--disp)",
                          fontWeight: 600,
                          fontSize: 15,
                          color: "var(--green)",
                        }}
                      >
                        {s.position}
                      </span>
                      <MovArrow />
                    </div>

                    {/* C-crest + nome squadra */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        minWidth: 0,
                      }}
                    >
                      <Crest
                        colorPrimary={cp}
                        colorSecondary={cs}
                        code={code}
                      />
                      <span
                        style={{
                          fontFamily: "var(--disp)",
                          fontWeight: 600,
                          fontSize: 11,
                          color: "var(--green)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {teamDisplayName(s)}
                      </span>
                    </div>

                    {/* G — partite giocate */}
                    <span style={monoSm}>{s.playedMatches}</span>

                    {/* V·N·P */}
                    <span
                      style={{
                        ...monoSm,
                        fontSize: 9,
                        letterSpacing: "-.02em",
                        color: "var(--green-l)",
                      }}
                    >
                      {s.wins}·{s.draws}·{s.losses}
                    </span>

                    {/* GF — gol fatti classico (soglie federazione, per-partita) */}
                    <span
                      style={{
                        ...monoSm,
                        color: "var(--green-l)",
                        fontWeight: 500,
                      }}
                    >
                      {s.gf}
                    </span>

                    {/* GS — gol subiti classico */}
                    <span style={{ ...monoSm, color: "var(--muted)" }}>
                      {s.gs}
                    </span>

                    {/* Pt — punti classifica (non FM → inchiostro, non oro) */}
                    <span
                      style={{
                        ...monoSm,
                        fontWeight: 700,
                        fontSize: 12.5,
                        color: "var(--green)",
                      }}
                    >
                      {s.points}
                    </span>

                    {/* PF — punti fantacalcio cumulati (spareggio) */}
                    <span
                      style={{
                        ...monoSm,
                        fontSize: 8.5,
                        color: "var(--muted)",
                        letterSpacing: "-.02em",
                      }}
                    >
                      {s.pf.toFixed(1)}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Legenda ── */}
          <p
            style={{
              fontSize: 9.5,
              color: "var(--muted)",
              textAlign: "center",
              margin: "11px 16px 70px",
              lineHeight: 1.6,
              fontFamily: "var(--mono)",
            }}
          >
            <b style={{ color: "var(--green)" }}>Pt</b> punti classifica ·{" "}
            <b style={{ color: "var(--green)" }}>GF/GS</b> gol classico ·{" "}
            <b style={{ color: "var(--green)" }}>PF</b> punti fanta (spareggio)
          </p>

          {/* ── Bottom tab bar ── */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              background: "var(--paper)",
              borderTop: "1px solid var(--line)",
              padding: "9px 6px 11px",
            }}
          >
            {(
              [
                { label: "Home", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
                { label: "Lega", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M12 7a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" },
                { label: "Mercato", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-10 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" },
                { label: "Feed", icon: "M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10l6 6v8a2 2 0 0 1-2 2z" },
              ] as const
            ).map(({ label, icon }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 9,
                  color: label === "Lega" ? "var(--green)" : "var(--muted)",
                  cursor: "pointer",
                  fontFamily: "var(--mono)",
                }}
              >
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  style={{
                    color:
                      label === "Lega"
                        ? "var(--gold)"
                        : "var(--muted)",
                  }}
                >
                  <path d={icon} />
                </svg>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
