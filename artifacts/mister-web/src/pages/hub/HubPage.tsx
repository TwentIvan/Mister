import { useParams, useSearch, useLocation } from "wouter";
import {
  useGetLeagueHub,
  type HubCompetition,
  type HubCompetitionPhase,
  type HubStandingsRow,
} from "@workspace/api-client-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function leagueMonogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function teamCode(name: string): string {
  const words = name.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconLista() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={19} height={19}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconForcella() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={19} height={19}>
      <path d="M7 4v6a3 3 0 0 0 3 3h7M7 20v-6M17 13l3-3-3-3" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} width={16} height={16}>
      <rect x={3} y={4} width={18} height={17} rx={2} />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={17} height={17}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={13} height={13}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} width={15} height={15}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconClassificaSmall() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={17} height={17}>
      <path d="M4 6h16M4 12h11M4 18h7" />
    </svg>
  );
}

// ─── Componente DiscoSquadra ──────────────────────────────────────────────────

function DiscoSquadra({ name, color }: { name: string; color: string | null | undefined }) {
  const bg = color ?? "#1f4733";
  return (
    <span
      style={{
        width: 21,
        height: 21,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--disp)",
        fontWeight: 700,
        fontSize: 8,
        color: "#efe6d3",
        flexShrink: 0,
        boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.18)",
      }}
    >
      {teamCode(name)}
    </span>
  );
}

// ─── C-guida-fasi ─────────────────────────────────────────────────────────────
// Nodi uniti da connettori con regola di qualificazione.

function GuidaFasi({ phases }: { phases: HubCompetitionPhase[] }) {
  if (phases.length === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", padding: "13px 15px 6px" }}>
      {phases.map((phase, i) => {
        const isDone = phase.status === "conclusa";
        const isNow = phase.status === "in_corso";
        const isNext = !isDone && !isNow;
        const nextPhase = phases[i + 1];

        return (
          <div key={phase.id} style={{ display: "flex", alignItems: "center", flex: i < phases.length - 1 ? undefined : undefined }}>
            {/* Nodo fase */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isDone ? "#2e6047" : isNow ? "#1f4733" : "rgba(216,204,174,.6)",
                  color: isDone || isNow ? "#efe6d3" : "#8a8266",
                  flexShrink: 0,
                  boxShadow: isNow ? "0 0 0 3px rgba(31,71,51,.13)" : undefined,
                }}
              >
                {isDone ? <IconCheck /> : phase.struttura === "tabellone" ? <IconForcella /> : <IconLista />}
              </span>
              <span
                style={{
                  fontFamily: "var(--disp)",
                  fontWeight: 600,
                  fontSize: 11,
                  color: isDone ? "#2e6047" : "#1f4733",
                  whiteSpace: "nowrap",
                }}
              >
                {phase.name}
              </span>
              <span
                style={{
                  fontSize: 8,
                  color: "#8a8266",
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                  whiteSpace: "nowrap",
                  marginTop: -2,
                }}
              >
                {phase.status === "conclusa" ? "conclusi" : phase.status === "in_corso" ? "in corso" : "programmata"}
              </span>
            </div>

            {/* Connettore verso la fase successiva */}
            {nextPhase && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "0 4px",
                  marginTop: -14,
                  minWidth: 40,
                }}
              >
                {phase.qualification_label && (
                  <span
                    style={{
                      fontSize: 8,
                      color: "#8a8266",
                      letterSpacing: ".03em",
                      marginBottom: 3,
                      whiteSpace: "nowrap",
                      textAlign: "center",
                    }}
                  >
                    {phase.qualification_label}
                  </span>
                )}
                <div
                  style={{
                    width: "100%",
                    height: 0,
                    borderTop: "1.5px dashed #d8ccae",
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      right: -1,
                      top: -3.5,
                      width: 0,
                      height: 0,
                      borderLeft: "6px solid #d8ccae",
                      borderTop: "3.5px solid transparent",
                      borderBottom: "3.5px solid transparent",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Card competizione ────────────────────────────────────────────────────────

function CompCard({
  comp,
  fantaTeamId,
  onNavigate,
}: {
  comp: HubCompetition;
  fantaTeamId: string | null;
  onNavigate: (path: string) => void;
}) {
  const isCampionato = comp.tipo_struttura === "classifica" && comp.n_phases === 1;
  const extract = comp.standings_extract;

  const statusLabel =
    comp.stato === "in_corso"
      ? "in corso"
      : comp.stato === "conclusa"
        ? "conclusa"
        : "programmata";

  const descLabel =
    comp.n_phases > 1
      ? `${comp.n_phases} fasi · a eliminazione`
      : comp.stato === "in_corso" && extract
        ? `in corso · giornata ${extract.giornata_max} / 38`
        : comp.stato === "programmata"
          ? "programmata"
          : "conclusa";

  return (
    <div
      style={{
        margin: "0 16px 13px",
        background: "#f7f1e4",
        border: "1px solid #d8ccae",
        borderRadius: 15,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 14px 12px" }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: "#2e6047",
            color: "#efe6d3",
          }}
        >
          {comp.tipo_struttura === "tabellone" ? <IconForcella /> : <IconLista />}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--disp)",
              fontWeight: 600,
              fontSize: 17,
              color: "#1f4733",
            }}
          >
            {comp.name}
          </div>
          <div style={{ fontSize: 10, color: "#8a8266", marginTop: 2, letterSpacing: ".02em" }}>
            {comp.stato === "in_corso" ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "#2e6047",
                  }}
                />
                <span style={{ fontSize: 9, color: "#2e6047", fontWeight: 500 }}>{statusLabel}</span>
                {" · "}
                {extract ? `giornata ${extract.giornata_max} / 38` : ""}
              </span>
            ) : (
              descLabel
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            style={{
              width: 31,
              height: 31,
              borderRadius: 9,
              border: "1px solid #d8ccae",
              background: "#efe6d3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2e6047",
              cursor: "pointer",
            }}
          >
            <IconCalendar />
          </button>
        </div>
      </div>

      {/* Divisore */}
      <div style={{ height: 1, background: "rgba(216,204,174,.7)", margin: "0 15px" }} />

      {/* Contenuto campionato — standings extract */}
      {isCampionato && extract && (
        <>
          <div style={{ padding: "9px 15px 4px" }}>
            {/* Capolista */}
            <StandingsRow
              row={extract.top1}
              isMe={fantaTeamId !== null && extract.top1.fanta_team_id === fantaTeamId}
            />
            {/* Stacco visivo se la riga utente non è adiacente al capolista */}
            {extract.my_row && extract.my_row.fanta_team_id !== extract.top1.fanta_team_id && extract.my_row.pos > 2 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "2px 0 2px 20px",
                }}
              >
                <span style={{ fontSize: 11, color: "#b8ac94", letterSpacing: ".05em", lineHeight: 1 }}>· · ·</span>
              </div>
            )}
            {/* Riga utente (se diversa dal capolista) */}
            {extract.my_row && extract.my_row.fanta_team_id !== extract.top1.fanta_team_id && (
              <StandingsRow row={extract.my_row} isMe={true} />
            )}
          </div>

          {/* Prossima partita */}
          {extract.next_opponent && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 15px 14px",
                fontSize: 11,
                color: "#8a8266",
              }}
            >
              <IconArrowRight />
              <span style={{ color: "#8a8266" }}>Prossima:</span>{" "}
              <span
                style={{
                  fontFamily: "var(--disp)",
                  fontWeight: 600,
                  color: "#1f4733",
                  fontSize: 12.5,
                }}
              >
                vs {extract.next_opponent}
              </span>
              <span style={{ color: "#8a8266" }}>· G{extract.next_giornata}</span>
            </div>
          )}
        </>
      )}

      {/* Contenuto coppa — C-guida-fasi */}
      {!isCampionato && comp.phases.length > 0 && (
        <GuidaFasi phases={comp.phases} />
      )}

      {/* Footer link */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 15px",
          borderTop: "1px solid rgba(216,204,174,.7)",
          cursor: "pointer",
          background: "rgba(31,71,51,.035)",
        }}
        onClick={() => {
          if (isCampionato) {
            onNavigate(`/classifica/${comp.id}`);
          } else {
            onNavigate(`/coppa/${comp.id}`);
          }
        }}
      >
        <span style={{ width: 17, height: 17, color: "#2e6047", flexShrink: 0 }}>
          <IconClassificaSmall />
        </span>
        <span
          style={{
            fontFamily: "var(--disp)",
            fontWeight: 600,
            fontSize: 13.5,
            color: "#1f4733",
          }}
        >
          {isCampionato ? "Classifica completa" : "Vai al tabellone"}
        </span>
        <span style={{ marginLeft: "auto", color: "#2e6047", display: "flex" }}>
          <IconChevronRight />
        </span>
      </div>
    </div>
  );
}

function StandingsRow({ row, isMe }: { row: HubStandingsRow; isMe: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: isMe ? "6px 15px" : "5px 0",
        margin: isMe ? "2px -15px" : undefined,
        background: isMe ? "#e7dcc4" : undefined,
      }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: isMe ? "#1f4733" : "#8a8266",
          width: 20,
          flexShrink: 0,
        }}
      >
        {row.pos}°
      </span>
      <DiscoSquadra name={row.team_name} color={row.color_primary} />
      <span
        style={{
          fontFamily: "var(--disp)",
          fontWeight: 600,
          fontSize: 13.5,
          color: "#1f4733",
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {row.team_name}
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontWeight: 500,
          fontSize: 12,
          color: "#1f4733",
          flexShrink: 0,
        }}
      >
        <strong style={{ fontWeight: 700 }}>{row.points}</strong> pt
      </span>
    </div>
  );
}

// ─── Bottom Tabs ──────────────────────────────────────────────────────────────

function BottomTabs() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-around",
        background: "#efe6d3",
        borderTop: "1px solid #d8ccae",
        padding: "10px 0 12px",
      }}
    >
      {[
        {
          label: "Home",
          active: false,
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} width={21} height={21}>
              <path d="M3 11l9-7 9 7M5 10v9h14v-9" />
            </svg>
          ),
        },
        {
          label: "Leghe",
          active: true,
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} width={21} height={21}>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          ),
        },
        {
          label: "Notifiche",
          active: false,
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} width={21} height={21}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
          ),
        },
        {
          label: "Profilo",
          active: false,
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} width={21} height={21}>
              <circle cx={12} cy={8} r={4} />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          ),
        },
      ].map((tab) => (
        <div
          key={tab.label}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            fontSize: 9,
            color: tab.active ? "#1f4733" : "#8a8266",
            fontFamily: "var(--ui)",
          }}
        >
          {tab.icon}
          {tab.label}
        </div>
      ))}
    </div>
  );
}

// ─── HubPage ──────────────────────────────────────────────────────────────────

export default function HubPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const search = useSearch();
  const [, navigate] = useLocation();

  const params = new URLSearchParams(search);
  const fantaTeamId = params.get("fantaTeamId") ?? null;

  const { data, isLoading, isError } = useGetLeagueHub(leagueId ?? "", {
    fantaTeamId: fantaTeamId ?? undefined,
  });

  if (!leagueId) return null;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#cfc6ad",
        fontFamily: "var(--mono)",
        padding: "24px 12px 48px",
        overflowX: "auto",
      }}
    >
      <div
        style={{
          width: 390,
          margin: "0 auto",
          background: "#efe6d3",
          border: "9px solid #2a2a2a",
          borderRadius: 36,
          overflow: "hidden",
          boxShadow: "0 18px 50px rgba(0,0,0,.25)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", minHeight: 828, position: "relative" }}>

          {/* ── Top bar ────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", padding: "14px 16px 4px" }}>
            <button
              onClick={() => navigate(-1 as unknown as string)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "#1f4733",
                display: "flex",
                cursor: "pointer",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} width={23} height={23}>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span style={{ marginLeft: "auto", color: "#8a8266", display: "flex" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} width={19} height={19}>
                <circle cx={12} cy={12} r={3} />
                <path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 2.6 14H2.4a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4 7.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.4 4h.2a2 2 0 1 1 4 0v.2A1.6 1.6 0 0 0 17 5.6l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a2 2 0 1 1 0 4h-.2" />
              </svg>
            </span>
          </div>

          {/* ── Skeleton / Error ───────────────────────────────── */}
          {isLoading && (
            <div style={{ padding: "40px 18px", textAlign: "center", color: "#8a8266", fontSize: 13 }}>
              Caricamento…
            </div>
          )}
          {isError && (
            <div style={{ padding: "40px 18px", textAlign: "center", color: "#8a8266", fontSize: 13 }}>
              Errore nel caricamento.
            </div>
          )}

          {/* ── Contenuto hub ──────────────────────────────────── */}
          {data && (
            <>
              {/* Band identità lega */}
              <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "8px 18px 16px" }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: "#1f4733",
                    color: "#efe6d3",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--disp)",
                    fontWeight: 700,
                    fontSize: 20,
                    flexShrink: 0,
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)",
                  }}
                >
                  {leagueMonogram(data.league_name)}
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--disp)",
                      fontWeight: 600,
                      fontSize: 23,
                      color: "#1f4733",
                      lineHeight: 1.05,
                    }}
                  >
                    {data.league_name}
                  </div>
                  <div style={{ fontSize: 10, color: "#8a8266", marginTop: 3, letterSpacing: ".02em" }}>
                    {data.n_managers} squadre · stagione {data.season}/{String(data.season + 1).slice(2)}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--disp)",
                      fontWeight: 600,
                      fontSize: 17,
                      color: "#1f4733",
                    }}
                  >
                    G{data.giornata_corrente}
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      textTransform: "uppercase",
                      letterSpacing: ".09em",
                      color: "#8a8266",
                      marginTop: 1,
                    }}
                  >
                    Giornata
                  </div>
                </div>
              </div>

              {/* Section header */}
              <div
                style={{
                  fontFamily: "var(--ui)",
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".09em",
                  color: "#8a8266",
                  padding: "6px 18px 9px",
                }}
              >
                Competizioni
              </div>

              {/* Competition cards */}
              {data.competitions.length === 0 && (
                <div style={{ padding: "20px 18px", color: "#8a8266", fontSize: 13 }}>
                  Nessuna competizione attiva.{" "}
                  <span style={{ color: "#1f4733", fontWeight: 600, cursor: "pointer" }}>Crea →</span>
                </div>
              )}
              {data.competitions.map((comp) => (
                <CompCard
                  key={comp.id}
                  comp={comp}
                  fantaTeamId={fantaTeamId}
                  onNavigate={navigate}
                />
              ))}
            </>
          )}

          {/* ── Bottom tab nav ─────────────────────────────────── */}
          <div style={{ marginTop: "auto" }}>
            <BottomTabs />
          </div>

        </div>
      </div>
    </div>
  );
}
