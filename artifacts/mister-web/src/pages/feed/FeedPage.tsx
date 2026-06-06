import { useParams } from "wouter";
import { useGetFeed } from "@workspace/api-client-react";
import type { FeedEvent, FeedTeamInfo } from "@workspace/api-client-react";

// ─── Helpers tempo relativo ────────────────────────────────────────────────────

function tempoRelativo(iso: string): string {
  const now = Date.now();
  const ts = new Date(iso).getTime();
  const diffMs = now - ts;
  if (diffMs < 0) return "ora";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "ora";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m fa`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h fa`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "ieri";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── C-crest ──────────────────────────────────────────────────────────────────

function Crest({
  team,
  size = 26,
}: {
  team: FeedTeamInfo;
  size?: number;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 7,
        flexShrink: 0,
        background: `linear-gradient(135deg, ${team.colorPrimary} 0 49%, ${team.colorSecondary} 51% 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "var(--mono)",
        fontSize: size * 0.29 + "px",
        fontWeight: 700,
        boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.25)",
        letterSpacing: ".02em",
      }}
    >
      {team.code.slice(0, 2)}
    </span>
  );
}

// ─── Mini scoreboard partita ───────────────────────────────────────────────────

function MiniScoreboard({ event }: { event: FeedEvent }) {
  const m = event.matchData;
  if (!m) return null;
  const homeWin = m.homeScore > m.awayScore;
  const awayWin = m.awayScore > m.homeScore;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 9,
        background: "rgba(31,71,51,.06)",
        borderRadius: 10,
        padding: "8px 11px",
      }}
    >
      <Crest team={m.homeTeam} size={24} />
      <span
        style={{
          fontFamily: "var(--disp)",
          fontWeight: 600,
          fontSize: 12.5,
          color: "var(--green)",
          flex: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {m.homeTeam.name}
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontWeight: 700,
          fontSize: 13,
          color: homeWin ? "var(--green)" : "var(--muted)",
          minWidth: 38,
          textAlign: "right",
        }}
      >
        {m.homeScore.toFixed(2)}
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--muted)",
          padding: "0 3px",
        }}
      >
        ·
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontWeight: 700,
          fontSize: 13,
          color: awayWin ? "var(--green)" : "var(--muted)",
          minWidth: 38,
          textAlign: "left",
        }}
      >
        {m.awayScore.toFixed(2)}
      </span>
      <span
        style={{
          fontFamily: "var(--disp)",
          fontWeight: 600,
          fontSize: 12.5,
          color: "var(--green)",
          flex: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textAlign: "right",
        }}
      >
        {m.awayTeam.name}
      </span>
      <Crest team={m.awayTeam} size={24} />
    </div>
  );
}

// ─── Accenti per tipo card ─────────────────────────────────────────────────────

const TYPE_ACCENT: Record<string, { border: string; tagColor: string; borderStyle?: string }> = {
  live: { border: "var(--live)", tagColor: "var(--live)" },
  colpo: { border: "var(--gold)", tagColor: "var(--gold)" },
  rumor: { border: "var(--muted)", tagColor: "var(--muted)", borderStyle: "dashed" },
  risultato: { border: "var(--green-l)", tagColor: "var(--green-l)" },
  finestra: { border: "var(--green)", tagColor: "var(--green)" },
  albo: { border: "var(--gold)", tagColor: "var(--gold)" },
};

// ─── C-card-evento ────────────────────────────────────────────────────────────

function CardEvento({
  event,
  onTap,
}: {
  event: FeedEvent;
  onTap: (ev: FeedEvent) => void;
}) {
  const accent = TYPE_ACCENT[event.type] ?? TYPE_ACCENT["risultato"]!;
  const isAlbo = event.type === "albo";

  return (
    <div
      onClick={() => onTap(event)}
      style={{
        background: isAlbo
          ? "linear-gradient(180deg,#f4ead2,var(--paper))"
          : "var(--paper)",
        border: "1px solid var(--line)",
        borderLeft: `3px ${accent.borderStyle ?? "solid"} ${accent.border}`,
        borderRadius: 14,
        padding: "13px 15px",
        cursor: event.competitionId ? "pointer" : "default",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Kick — tag · lega · tempo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: ".09em",
          color: "var(--muted)",
          marginBottom: 6,
          fontFamily: "var(--mono)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: accent.tagColor, fontWeight: 700 }}>
          {event.type === "live" && "● "}
          {event.tag}
        </span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>{event.leagueName}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>{tempoRelativo(event.timestamp)}</span>
      </div>

      {/* Headline */}
      <h2
        style={{
          fontFamily: "var(--disp)",
          fontWeight: 600,
          fontSize: 16,
          lineHeight: 1.15,
          color: "var(--green)",
          margin: 0,
          fontStyle: isAlbo ? "italic" : "normal",
        }}
      >
        {event.headline}
      </h2>

      {/* Body */}
      {event.body && (
        <p
          style={{
            fontSize: 11.5,
            color: "var(--green-l)",
            margin: "5px 0 0",
            lineHeight: 1.45,
            fontFamily: "var(--mono)",
          }}
        >
          {event.body}
        </p>
      )}

      {/* Mini scoreboard per risultato */}
      {event.type === "risultato" && <MiniScoreboard event={event} />}

      {/* CTA per finestre/live — SOLO se ha contesto */}
      {event.type === "finestra" && event.competitionId && (
        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 10,
            background: "var(--green)",
            color: "var(--cream)",
            border: "none",
            borderRadius: 10,
            padding: "9px 14px",
            fontFamily: "var(--mono)",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Vedi il calendario →
        </button>
      )}
    </div>
  );
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

const IcoHamburger = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.9}
    style={{ width: 22, height: 22 }}
  >
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const IcoSearch = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    style={{ width: 19, height: 19 }}
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const IcoBell = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    style={{ width: 19, height: 19 }}
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </svg>
);

const IcoHome = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    style={{ width: 21, height: 21 }}
  >
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v10h14V10" />
  </svg>
);

const IcoLeghe = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    style={{ width: 21, height: 21 }}
  >
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

const IcoNotifiche = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    style={{ width: 21, height: 21 }}
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </svg>
);

const IcoProfilo = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    style={{ width: 21, height: 21 }}
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

// ─── FeedPage ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const params = useParams<{ leagueId?: string }>();
  const leagueId = params.leagueId;

  const { data, isLoading, isError } = useGetFeed(
    leagueId ? { leagueId } : {},
  );

  function handleTap(event: FeedEvent) {
    if (event.competitionId) {
      window.location.href = `/classifica/${event.competitionId}`;
    }
  }

  // Data per masthead
  const oggi = new Date();
  const GIORNI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
  const MESI = [
    "gen", "feb", "mar", "apr", "mag", "giu",
    "lug", "ago", "set", "ott", "nov", "dic",
  ];
  const dataStr = `${GIORNI[oggi.getDay()]} · ${oggi.getDate()} ${MESI[oggi.getMonth()]}`;

  // ── Outer shell ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#cfc6ad",
        display: "flex",
        justifyContent: "center",
        padding: "24px 12px 48px",
        fontFamily: "var(--mono)",
      }}
    >
      {/* Phone frame */}
      <div
        style={{
          width: 390,
          maxWidth: "100%",
          background: "var(--cream)",
          border: "9px solid #2a2a2a",
          borderRadius: 36,
          overflow: "hidden",
          boxShadow: "0 18px 50px rgba(0,0,0,.25)",
          position: "relative",
        }}
      >
        {/* ── Masthead ── */}
        <div
          style={{
            padding: "16px 16px 10px",
            borderBottom: "2px solid var(--green)",
          }}
        >
          {/* Row 1: hamburger + mark + wordmark + icone */}
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <button
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--green)",
                display: "flex",
                cursor: "pointer",
              }}
            >
              <IcoHamburger />
            </button>

            {/* Segno M */}
            <div style={{ width: 22, flexShrink: 0 }}>
              <svg viewBox="0 0 512 512" style={{ width: 22, height: 22 }}>
                <defs>
                  <clipPath id="ff-t1">
                    <rect width="512" height="512" rx="112" />
                  </clipPath>
                </defs>
                <g clipPath="url(#ff-t1)">
                  <rect width="512" height="512" fill="#1f4733" />
                  <g transform="translate(106,121) scale(2.5)">
                    <polyline
                      points="6,100 34,8 60,100 86,8 114,100"
                      fill="none"
                      stroke="#e6b84d"
                      strokeWidth="13.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {[
                      [6, 100],
                      [34, 8],
                      [60, 100],
                      [86, 8],
                      [114, 100],
                    ].map(([cx, cy], i) => (
                      <circle
                        key={i}
                        cx={cx}
                        cy={cy}
                        r="9.6"
                        fill="#c8922b"
                      />
                    ))}
                  </g>
                </g>
              </svg>
            </div>

            {/* Wordmark "mister" — testo stilizzato */}
            <span
              style={{
                fontFamily: "var(--disp)",
                fontWeight: 800,
                fontSize: 18,
                color: "var(--green)",
                letterSpacing: "-.02em",
              }}
            >
              mister
            </span>

            {/* Icone destra */}
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 14,
                color: "var(--green)",
              }}
            >
              <IcoSearch />
              <div style={{ position: "relative" }}>
                <IcoBell />
                <span
                  style={{
                    position: "absolute",
                    top: -1,
                    right: -1,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--live)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Row 2: sottotitolo + data */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginTop: 7,
            }}
          >
            <span
              style={{
                fontFamily: "var(--disp)",
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              l'almanacco delle tue leghe
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: ".1em",
                fontFamily: "var(--mono)",
              }}
            >
              {dataStr}
            </span>
          </div>
        </div>

        {/* ── Feed ── */}
        <div
          style={{
            padding: "12px 14px 90px",
            display: "flex",
            flexDirection: "column",
            gap: 11,
            overflowY: "auto",
            maxHeight: "calc(780px - 80px)",
          }}
        >
          {isLoading && (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: "var(--muted)",
                fontFamily: "var(--mono)",
                fontSize: 12,
              }}
            >
              Caricamento…
            </div>
          )}

          {isError && (
            <div
              style={{
                padding: "24px 16px",
                background: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                color: "var(--muted)",
                fontSize: 12,
                fontFamily: "var(--mono)",
              }}
            >
              Errore nel caricamento del feed. Riprova.
            </div>
          )}

          {!isLoading &&
            !isError &&
            data?.events.map((ev) => (
              <CardEvento key={ev.id} event={ev} onTap={handleTap} />
            ))}

          {!isLoading && !isError && data?.events.length === 0 && (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: "var(--muted)",
                fontFamily: "var(--mono)",
                fontSize: 12,
              }}
            >
              Nessun evento disponibile.
              <br />
              <span style={{ color: "var(--green-l)" }}>
                Le prime giornate appariranno qui.
              </span>
            </div>
          )}

          {data?.hasMore && (
            <div style={{ textAlign: "center", paddingTop: 4 }}>
              <button
                style={{
                  background: "none",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: "9px 18px",
                  fontFamily: "var(--mono)",
                  fontSize: 11.5,
                  color: "var(--green-l)",
                  cursor: "pointer",
                }}
              >
                Carica altri →
              </button>
            </div>
          )}
        </div>

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
            padding: "9px 6px 18px",
          }}
        >
          {[
            { icon: <IcoHome />, label: "Home", active: true },
            { icon: <IcoLeghe />, label: "Leghe", active: false },
            { icon: <IcoNotifiche />, label: "Notifiche", active: false },
            { icon: <IcoProfilo />, label: "Profilo", active: false },
          ].map(({ icon, label, active }) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                fontSize: 9,
                color: active ? "var(--green)" : "var(--muted)",
                fontFamily: "var(--mono)",
              }}
            >
              <span
                style={{
                  color: active ? "var(--gold)" : "currentColor",
                }}
              >
                {icon}
              </span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
