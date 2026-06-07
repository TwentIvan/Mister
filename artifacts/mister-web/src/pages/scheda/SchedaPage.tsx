import { useParams, useSearch } from "wouter";
import { useGetPlayerScheda } from "@workspace/api-client-react";
import type { PlayerSchedaGiornata } from "@workspace/api-client-react";

// ─── Mappa colori club bicolore (fonte unica: componenti.py) ──────────────────

const CLUBS: Record<string, [string, string]> = {
  "Inter":       ["#0a0f1a", "#0a63b0"],
  "Milan":       ["#c8102e", "#0a0a0a"],
  "Juventus":    ["#0a0a0a", "#ededed"],
  "Napoli":      ["#1278c8", "#0c2340"],
  "Roma":        ["#7e1626", "#dca93a"],
  "Lazio":       ["#5aa6d8", "#f2f2f2"],
  "Atalanta":    ["#1a3a6b", "#0c0c0c"],
  "Lecce":       ["#e6b800", "#b81e2c"],
  "Cagliari":    ["#9b1b30", "#16224a"],
  "Como":        ["#1f5fae", "#f2f2f2"],
  "Fiorentina":  ["#5a2d82", "#f2f2f2"],
  "Torino":      ["#6e1f2b", "#3a0f16"],
  "Genoa":       ["#b81e2c", "#0a2342"],
  "Bologna":     ["#9b1b30", "#16224a"],
};

function normalizeClub(name: string): string {
  return name.replace(/^AC\s+/i, "").replace(/^AS\s+/i, "").replace(/^FC\s+/i, "").trim();
}

function clubColors(realTeam: string): [string, string] {
  return CLUBS[normalizeClub(realTeam)] ?? ["#6a6a6a", "#9a9a9a"];
}

// ─── Colori per ruolo ─────────────────────────────────────────────────────────

const ROLE_BG: Record<string, string> = {
  P: "#7e5a26", D: "#2b5740", C: "#234c5e", A: "#6b2c24",
};
const ROLE_RING: Record<string, string> = {
  P: "#c79a4e", D: "#6aa07f", C: "#6aa6b8", A: "#cf8a6a",
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 22, height: 22 }}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);
const IcoHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ width: 21, height: 21 }}>
    <path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" />
  </svg>
);
const IcoLeghe = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ width: 21, height: 21 }}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);
const IcoNotifiche = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ width: 21, height: 21 }}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" />
  </svg>
);
const IcoProfilo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ width: 21, height: 21 }}>
    <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

// ─── Silhouette placeholder ───────────────────────────────────────────────────

function Silhouette({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }}>
      <circle cx="12" cy="12" r="12" fill="#e7dcc4" />
      <path
        d="M12 12.6c2.2 0 3.6-1.8 3.6-4S14.2 5 12 5 8.4 6.6 8.4 8.6s1.4 4 3.6 4Zm0 1.3c-3.2 0-6.4 1.7-6.4 4.3V24h12.8v-5.8c0-2.6-3.2-4.3-6.4-4.3Z"
        fill="#9a9078"
      />
    </svg>
  );
}

// ─── C-crest bicolore (hero, grande) ─────────────────────────────────────────

function CrestHero({ realTeam }: { realTeam: string }) {
  const normalized = normalizeClub(realTeam);
  const known = normalized in CLUBS;
  const [a, b] = clubColors(realTeam);
  return (
    <span
      style={{
        position: "absolute",
        right: -4,
        bottom: -2,
        width: 26,
        height: 29,
        borderRadius: "5px 5px 9px 9px",
        background: `linear-gradient(135deg, ${a} 0 49%, ${b} 51% 100%)`,
        boxShadow: "0 1px 4px rgba(0,0,0,.4), inset 0 0 0 .6px rgba(255,255,255,.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {known ? (
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,.92)", display: "block" }} />
      ) : (
        <span style={{ fontSize: 6, fontFamily: "var(--mono)", fontWeight: 700, color: "#fff", lineHeight: 1 }}>
          {normalized.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}

// ─── Disco-squadra fanta (proprietario) ──────────────────────────────────────

function DiscoSquadra({ primary, secondary, size = 20 }: { primary: string; secondary: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: `linear-gradient(135deg, ${primary} 0 49%, ${secondary} 51% 100%)`,
        boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.25)",
        display: "inline-block",
      }}
    />
  );
}

// ─── Sparkline voti ──────────────────────────────────────────────────────────

function Sparkline({ giornate }: { giornate: PlayerSchedaGiornata[] }) {
  if (giornate.length === 0) {
    return (
      <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", padding: "8px 0" }}>
        Nessun dato disponibile
      </div>
    );
  }

  const W = 280;
  const H = 36;
  const PAD = 4;
  const values = giornate.map((g) => g.votoMister ?? g.ratingApi ?? 5);
  const min = Math.min(...values, 4);
  const max = Math.max(...values, 8);
  const range = max - min || 1;

  const toX = (i: number) => PAD + (i / Math.max(giornate.length - 1, 1)) * (W - PAD * 2);
  const toY = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2);

  const pts = values.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const lastX = toX(values.length - 1);
  const lastY = toY(values[values.length - 1]!);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--muted)", marginBottom: 4 }}>
        <span>ultime {giornate.length} giornate (voto)</span>
        <span>media {avg.toFixed(2)}</span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <polyline
          points={pts}
          fill="none"
          stroke="#1f4733"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        <circle cx={lastX} cy={lastY} r={3} fill="#c8922b" />
      </svg>
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  gold = false,
}: {
  value: number | string | null | undefined;
  label: string;
  gold?: boolean;
}) {
  const display = value == null ? "—" : String(value);
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 11,
        padding: "10px 6px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "var(--disp)",
          fontWeight: 600,
          fontSize: 17,
          color: gold ? "#c8922b" : "var(--green)",
        }}
      >
        {display}
      </div>
      <div
        style={{
          fontSize: 8.5,
          color: "var(--muted)",
          marginTop: 2,
          textTransform: "uppercase",
          letterSpacing: ".03em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── SchedaPage ───────────────────────────────────────────────────────────────

export default function SchedaPage() {
  const params = useParams<{ playerId?: string }>();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const fantaTeamId = searchParams.get("fantaTeamId") ?? undefined;

  const playerId = parseInt(params.playerId ?? "312", 10);

  const { data, isLoading, isError } = useGetPlayerScheda(
    playerId,
    fantaTeamId ? { fantaTeamId } : undefined,
  );

  const roleBg = data ? (ROLE_BG[data.roleClassic] ?? "#234c5e") : "#234c5e";
  const roleRing = data ? (ROLE_RING[data.roleClassic] ?? "#6aa6b8") : "#6aa6b8";

  const jerseyPrim = data?.ligaContext?.jerseyPrimary ?? "#1f4733";
  const jerseySecond = data?.ligaContext?.jerseySecondary ?? "#efe6d3";

  const isGK = data?.roleClassic === "P";

  // Build stats grid by role
  const statsItems: Array<{ value: number | null | undefined; label: string }> = data
    ? isGK
      ? [
          { value: data.statsAggregate?.parate, label: "parate" },
          { value: data.statsAggregate?.golSubiti, label: "gol subiti" },
          { value: data.statsAggregate?.gialli, label: "ammonizioni" },
          { value: data.statsAggregate?.rossi, label: "espulsioni" },
        ]
      : [
          { value: data.statsAggregate?.gol, label: "gol" },
          { value: data.statsAggregate?.assist, label: "assist" },
          { value: data.statsAggregate?.gialli, label: "ammonizioni" },
          { value: data.statsAggregate?.rossi, label: "espulsioni" },
        ]
    : [];

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
          height: 780,
          maxWidth: "100%",
          background: "var(--cream)",
          border: "9px solid #2a2a2a",
          borderRadius: 36,
          overflow: "hidden",
          boxShadow: "0 18px 50px rgba(0,0,0,.25)",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Hero (colorato per ruolo) ── */}
        {isLoading ? (
          <div
            style={{
              background: "#234c5e",
              padding: "13px 16px 18px",
              color: "rgba(239,230,211,.6)",
              fontSize: 12,
            }}
          >
            <button style={{ background: "none", border: "none", padding: 0, color: "rgba(239,230,211,.85)", display: "flex", cursor: "pointer" }}>
              <IcoBack />
            </button>
            <div style={{ marginTop: 24, textAlign: "center" }}>Caricamento…</div>
          </div>
        ) : isError || !data ? (
          <div style={{ background: "#234c5e", padding: "13px 16px 18px", color: "rgba(239,230,211,.6)", fontSize: 12 }}>
            <button style={{ background: "none", border: "none", padding: 0, color: "rgba(239,230,211,.85)", display: "flex", cursor: "pointer" }}>
              <IcoBack />
            </button>
            <div style={{ marginTop: 24, textAlign: "center" }}>Giocatore non trovato.</div>
          </div>
        ) : (
          <div style={{ background: roleBg, color: "var(--cream)", padding: "12px 16px 18px", flexShrink: 0 }}>
            {/* Top bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <button style={{ background: "none", border: "none", padding: 0, color: "rgba(239,230,211,.85)", display: "flex", cursor: "pointer" }}>
                <IcoBack />
              </button>
              <span
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: ".1em",
                  color: "rgba(239,230,211,.65)",
                }}
              >
                Scheda giocatore
              </span>
            </div>

            {/* Identità */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* Foto + crest club sovrapposto */}
              <div style={{ position: "relative", width: 66, height: 66, flexShrink: 0 }}>
                <div
                  style={{
                    width: 66,
                    height: 66,
                    borderRadius: "50%",
                    border: `2.5px solid ${roleRing}`,
                    overflow: "hidden",
                    background: "#e7dcc4",
                  }}
                >
                  {data.photoCartoonUrl ? (
                    <img
                      src={data.photoCartoonUrl}
                      alt={data.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        const el = e.currentTarget as HTMLImageElement;
                        el.style.display = "none";
                        if (el.nextSibling) (el.nextSibling as HTMLElement).style.display = "block";
                      }}
                    />
                  ) : null}
                  <div style={{ display: data.photoCartoonUrl ? "none" : "block", width: "100%", height: "100%" }}>
                    <Silhouette size={66} />
                  </div>
                </div>
                <CrestHero realTeam={data.realTeam} />
              </div>

              {/* Nome e ruolo */}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 9.5,
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    color: "rgba(239,230,211,.72)",
                  }}
                >
                  {data.roleDisplay}
                </div>
                <div
                  style={{
                    fontFamily: "var(--disp)",
                    fontWeight: 600,
                    fontSize: 26,
                    lineHeight: 1.04,
                    margin: "1px 0 4px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {data.fullName}
                </div>
                <div style={{ fontSize: 12, color: "rgba(239,230,211,.92)" }}>
                  {data.realTeam} · Serie A
                </div>
              </div>
            </div>

            {/* Bio */}
            <div
              style={{
                fontSize: 10.5,
                color: "rgba(239,230,211,.65)",
                marginTop: 9,
                letterSpacing: ".2px",
              }}
            >
              {[
                data.age != null ? `${data.age} anni` : null,
                data.nationality ?? null,
                data.heightCm != null ? `${data.heightCm} cm` : null,
                data.foot ? `piede ${data.foot}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Dati anagrafici non disponibili"}
            </div>
          </div>
        )}

        {/* ── Corpo scrollabile ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 14px 90px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {data && (
            <>
              {/* ── Contesto lega (3 card) ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
                {/* Quotazione listino */}
                <div
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    padding: "11px 12px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--disp)",
                      fontWeight: 600,
                      fontSize: 21,
                      color: data.ligaContext?.currentValue != null ? "#c8922b" : "var(--muted)",
                    }}
                  >
                    {data.ligaContext?.currentValue ?? "—"}
                  </div>
                  <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", marginTop: 2 }}>
                    quotazione
                  </div>
                </div>

                {/* Prezzo pagato */}
                <div
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    padding: "11px 12px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--disp)",
                      fontWeight: 600,
                      fontSize: 21,
                      color: data.ligaContext?.purchasePrice != null ? "#c8922b" : "var(--muted)",
                    }}
                  >
                    {data.ligaContext?.purchasePrice ?? "—"}
                  </div>
                  <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", marginTop: 2 }}>
                    pagato
                  </div>
                </div>

                {/* Proprietario */}
                <div
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    padding: "11px 12px",
                    textAlign: "center",
                  }}
                >
                  {data.ligaContext ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <DiscoSquadra primary={jerseyPrim} secondary={jerseySecond} size={20} />
                        <span
                          style={{
                            fontFamily: "var(--disp)",
                            fontWeight: 600,
                            fontSize: 11,
                            color: "var(--green)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 60,
                          }}
                        >
                          {data.ligaContext.fantaTeamName}
                        </span>
                      </div>
                      <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", marginTop: 6 }}>
                        in rosa
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 21, color: "var(--muted)" }}>—</div>
                      <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", marginTop: 2 }}>
                        proprietario
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ── Rendimento fanta ── */}
              <div>
                <h3
                  style={{
                    fontFamily: "var(--disp)",
                    fontWeight: 600,
                    fontSize: 15,
                    margin: "0 2px 9px",
                    color: "var(--green)",
                  }}
                >
                  Rendimento{" "}
                  <span style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 400, fontFamily: "var(--mono)" }}>
                    · fantamedia da algoritmo lega
                  </span>
                </h3>
                <div
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderRadius: 13,
                    padding: "13px 15px",
                  }}
                >
                  {data.rendimento ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 7 }}>
                        {/* Fantamedia in oro (R-oro: no, questa è prestazione non denaro → verde) */}
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 18, color: "var(--green)" }}>
                            {data.rendimento.fantamedia?.toFixed(2) ?? "—"}
                          </div>
                          <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)" }}>fantam.</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 18, color: "var(--green)" }}>
                            {data.rendimento.mediaVoto?.toFixed(2) ?? "—"}
                          </div>
                          <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)" }}>media voto</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 18, color: "var(--green)" }}>
                            {data.rendimento.presenze}
                          </div>
                          <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)" }}>presenze</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 18, color: "var(--green)" }}>
                            {data.rendimento.minuti}
                          </div>
                          <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)" }}>minuti</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 9, color: "var(--muted)", textAlign: "center", marginBottom: 11 }}>
                        {data.rendimento.presenze} presenze · {data.rendimento.titolare} da titolare · {data.rendimento.subentrato} da subentrato
                      </div>
                      {data.rendimento.ultimeGiornate.length > 0 && (
                        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                          <Sparkline giornate={data.rendimento.ultimeGiornate} />
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", padding: "12px 0" }}>
                      Nessun dato di rendimento disponibile.
                    </div>
                  )}
                </div>
              </div>

              {/* ── Statistiche per ruolo ── */}
              <div>
                <h3
                  style={{
                    fontFamily: "var(--disp)",
                    fontWeight: 600,
                    fontSize: 15,
                    margin: "0 2px 9px",
                    color: "var(--green)",
                  }}
                >
                  Statistiche{" "}
                  <span style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 400, fontFamily: "var(--mono)" }}>
                    · stagione, via API-Sports
                  </span>
                </h3>
                {data.statsAggregate ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {statsItems.map((s) => (
                      <StatCard key={s.label} value={s.value} label={s.label} />
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      background: "var(--paper)",
                      border: "1px solid var(--line)",
                      borderRadius: 11,
                      padding: "14px",
                      fontSize: 11,
                      color: "var(--muted)",
                      textAlign: "center",
                    }}
                  >
                    Statistiche non disponibili · nessuna giornata sincronizzata.
                  </div>
                )}
              </div>

              {/* ── Storico stagioni ── */}
              <div>
                <h3
                  style={{
                    fontFamily: "var(--disp)",
                    fontWeight: 600,
                    fontSize: 15,
                    margin: "0 2px 9px",
                    color: "var(--green)",
                  }}
                >
                  Storico stagioni{" "}
                  <span style={{ fontSize: 8.5, color: "var(--muted)", fontWeight: 400, fontFamily: "var(--mono)" }}>
                    · via API-Sports
                  </span>
                </h3>
                <div
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderRadius: 13,
                    padding: "14px",
                    fontSize: 11,
                    color: "var(--muted)",
                    textAlign: "center",
                  }}
                >
                  Storico stagioni non ancora sincronizzato (dati di avviamento).
                </div>
              </div>

              {/* ── Storico in lega ── */}
              {data.storicoLega.length > 0 && (
                <div>
                  <h3
                    style={{
                      fontFamily: "var(--disp)",
                      fontWeight: 600,
                      fontSize: 15,
                      margin: "0 2px 9px",
                      color: "var(--green)",
                    }}
                  >
                    Storico in lega
                  </h3>
                  <div
                    style={{
                      background: "var(--paper)",
                      border: "1px solid var(--line)",
                      borderRadius: 13,
                      padding: "6px 14px",
                    }}
                  >
                    {data.storicoLega.map((ev, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 0",
                          fontSize: 11.5,
                          borderBottom: i < data.storicoLega.length - 1 ? "1px solid var(--line)" : "none",
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: "#c8922b",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ flex: 1, color: "var(--green)" }}>
                          Acquistato all'<b>{ev.evento}</b>{" "}
                          · {new Date(ev.data).getFullYear()}/{String(new Date(ev.data).getFullYear() + 1).slice(2)}
                        </span>
                        {ev.prezzoFm != null && (
                          <span
                            style={{
                              fontFamily: "var(--mono)",
                              fontWeight: 700,
                              color: "#c8922b",
                            }}
                          >
                            {ev.prezzoFm} FM
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Note dataset ── */}
              {data.noteDataset && (
                <p
                  style={{
                    fontSize: 9.5,
                    color: "var(--muted)",
                    textAlign: "center",
                    margin: "0 18px",
                    lineHeight: 1.5,
                  }}
                >
                  {data.noteDataset}
                </p>
              )}
            </>
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
            { icon: <IcoHome />,      label: "Home",      active: false },
            { icon: <IcoLeghe />,     label: "Leghe",     active: true  },
            { icon: <IcoNotifiche />, label: "Notifiche", active: false },
            { icon: <IcoProfilo />,   label: "Profilo",   active: false },
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
              <span style={{ color: active ? "var(--gold)" : "currentColor" }}>{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
