import { useParams } from "wouter";
import { useGetFantaTeamRosa } from "@workspace/api-client-react";
import type { FantaTeamRosaPlayer } from "@workspace/api-client-react";

// ─── Mappa colori club bicolore (da componenti.py — fonte unica) ─────────────

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

// Normalizzazione: "AC Milan" → "Milan", "AS Roma" → "Roma"
function normalizeClub(name: string): string {
  return name.replace(/^AC\s+/i, "").replace(/^AS\s+/i, "").replace(/^FC\s+/i, "").trim();
}

function clubColors(realTeam: string): [string, string] {
  const normalized = normalizeClub(realTeam);
  return CLUBS[normalized] ?? ["#6a6a6a", "#9a9a9a"];
}

function clubGrad(realTeam: string): string {
  const [a, b] = clubColors(realTeam);
  return `linear-gradient(135deg, ${a} 0 49%, ${b} 51% 100%)`;
}

// ─── Colori per ruolo ──────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, { bg: string; dot: string; label: string }> = {
  P: { bg: "#7e5a26", dot: "#c8922b", label: "Portieri" },
  D: { bg: "#2b5740", dot: "#6aa07f", label: "Difensori" },
  C: { bg: "#234c5e", dot: "#6aa6b8", label: "Centrocampisti" },
  A: { bg: "#6b2c24", dot: "#cf8a6a", label: "Attaccanti" },
};

const SLOT_MAX: Record<string, number> = { P: 3, D: 8, C: 8, A: 6 };

// ─── C-crest (crest bicolore del club reale) ─────────────────────────────────
// DISTINTO dal disco-squadra fanta (che va solo in testa).

function Crest({ realTeam }: { realTeam: string }) {
  const normalized = normalizeClub(realTeam);
  const known = normalized in CLUBS;
  const [a, b] = clubColors(realTeam);

  return (
    <span
      style={{
        width: 17,
        height: 19,
        borderRadius: 3,
        flexShrink: 0,
        background: `linear-gradient(135deg, ${a} 0 49%, ${b} 51% 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.3)",
      }}
    >
      {!known && (
        <span
          style={{
            fontSize: 6,
            fontFamily: "var(--mono)",
            fontWeight: 700,
            color: "#fff",
            textShadow: "0 1px 2px rgba(0,0,0,.8)",
            lineHeight: 1,
          }}
        >
          {normalized.slice(0, 2).toUpperCase()}
        </span>
      )}
      {known && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "rgba(255,255,255,.9)",
            display: "block",
          }}
        />
      )}
    </span>
  );
}

// ─── Silhouette volto (segnaposto — no avatar reali) ──────────────────────────

function Silhouette() {
  return (
    <span
      style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        background: "#e7dcc4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg viewBox="0 0 24 24" style={{ width: "100%", height: "100%" }}>
        <circle cx="12" cy="12" r="12" fill="#e7dcc4" />
        <path
          d="M12 12.6c2.2 0 3.6-1.8 3.6-4S14.2 5 12 5 8.4 6.6 8.4 8.6s1.4 4 3.6 4Zm0 1.3c-3.2 0-6.4 1.7-6.4 4.3V24h12.8v-5.8c0-2.6-3.2-4.3-6.4-4.3Z"
          fill="#9a9078"
        />
      </svg>
    </span>
  );
}

// ─── Badge-giocatore per ruolo (riga rosa) ─────────────────────────────────

function BadgeGiocatore({ player }: { player: FantaTeamRosaPlayer }) {
  const rs = ROLE_STYLE[player.roleClassic] ?? ROLE_STYLE["C"]!;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderRadius: 9,
        padding: "7px 11px",
        background: rs.bg,
        color: "var(--cream)",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)",
      }}
    >
      <Crest realTeam={player.realTeam} />
      <span
        style={{
          flex: 1,
          fontWeight: 500,
          fontSize: 13.5,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          letterSpacing: ".2px",
          fontFamily: "var(--mono)",
        }}
      >
        {player.name}
      </span>
      {/* Pagato (prezzo d'asta) in oro — R-oro: solo denaro */}
      <span
        style={{
          fontWeight: 700,
          fontSize: 14,
          color: "#e6b84d",
          fontFamily: "var(--mono)",
          minWidth: 28,
          textAlign: "right",
        }}
      >
        {player.quotazione != null ? player.quotazione : "—"}
      </span>
    </div>
  );
}

// ─── Slot vuoto ────────────────────────────────────────────────────────────

function SlotVuoto({ role }: { role: string }) {
  const rs = ROLE_STYLE[role] ?? ROLE_STYLE["C"]!;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderRadius: 9,
        padding: "7px 11px",
        background: "#e7dcc4",
        color: "#8a8266",
        boxShadow: `inset 0 0 0 1px #d8ccae`,
      }}
    >
      <span
        style={{
          width: 17,
          height: 19,
          borderRadius: 3,
          background: "transparent",
          boxShadow: "inset 0 0 0 1px #d8ccae",
        }}
      />
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "#d8ccae",
        }}
      />
      <span
        style={{
          flex: 1,
          fontSize: 11.5,
          fontStyle: "italic",
          fontFamily: "var(--mono)",
        }}
      >
        Slot {role} vuoto
      </span>
    </div>
  );
}

// ─── Gruppo reparto ─────────────────────────────────────────────────────────

function GruppoReparto({
  role,
  players,
  slotMax,
  isFirst,
}: {
  role: string;
  players: FantaTeamRosaPlayer[];
  slotMax: number;
  isFirst?: boolean;
}) {
  const vuoti = slotMax - players.length;

  return (
    <div style={{ marginTop: isFirst ? 8 : 14 }}>
      {/* Righe giocatori — il colore di fondo marca il reparto */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {players.map((p) => (
          <BadgeGiocatore key={p.id} player={p} />
        ))}
        {Array.from({ length: Math.max(0, vuoti) }).map((_, i) => (
          <SlotVuoto key={`vuoto-${role}-${i}`} role={role} />
        ))}
      </div>
    </div>
  );
}

// ─── Disco squadra fanta (tondo, team.jersey — SOLO in testa) ─────────────

function DiscoSquadra({
  primary,
  secondary,
  size = 34,
}: {
  primary: string;
  secondary: string;
  size?: number;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: `linear-gradient(135deg, ${primary} 0 49%, ${secondary} 51% 100%)`,
        boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.25)",
      }}
    />
  );
}

// ─── SVG icons ────────────────────────────────────────────────────────────

const IcoHamburger = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} style={{ width: 22, height: 22 }}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
const IcoSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ width: 20, height: 20 }}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-3.8l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h3.8l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1Z" />
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

// ─── RosaPage ─────────────────────────────────────────────────────────────────

export default function RosaPage() {
  const params = useParams<{ fantaTeamId?: string }>();
  const fantaTeamId = params.fantaTeamId ?? "ft-mvp-1";

  const { data, isLoading, isError } = useGetFantaTeamRosa(fantaTeamId);

  const primary  = data?.jersey?.primaryColor  ?? "#1f4733";
  const secondary = data?.jersey?.secondaryColor ?? "#efe6d3";

  const roles: Array<"P" | "D" | "C" | "A"> = ["P", "D", "C", "A"];

  const playersByRole = (role: string) =>
    (data?.players ?? []).filter((p) => p.roleClassic === role);

  const totalPlayers = data?.players.length ?? 0;
  const slotTotal = (data?.slotMax.P ?? 3) + (data?.slotMax.D ?? 8) + (data?.slotMax.C ?? 8) + (data?.slotMax.A ?? 6);

  // Controlla se purchase_price_fm è sempre nullo (nota dati)
  const hasPriceFm = (data?.players ?? []).some((p) => p.purchasePriceFm != null && p.purchasePriceFm > 0);

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
        {/* ── Top bar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "13px 15px 9px",
          }}
        >
          <button
            style={{ background: "none", border: "none", padding: 0, color: "var(--green)", display: "flex", cursor: "pointer" }}
          >
            <IcoHamburger />
          </button>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: "var(--disp)",
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              Rosa
            </div>
            <div
              style={{
                fontSize: 9,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: ".07em",
              }}
            >
              {isLoading ? "…" : `${data?.teamName ?? ""} · ${data?.leagueName ?? ""}`}
            </div>
          </div>
          <button
            style={{ background: "none", border: "none", padding: 0, color: "var(--green)", display: "flex", cursor: "pointer" }}
          >
            <IcoSettings />
          </button>
        </div>

        {/* ── Sub-nav ── */}
        <div
          style={{
            display: "flex",
            gap: 7,
            padding: "4px 15px 10px",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {["Panoramica", "Rosa", "Formazione", "Mercato", "Classifica", "Società"].map((pill) => (
            <span
              key={pill}
              style={{
                flexShrink: 0,
                fontSize: 11,
                border: "1px solid var(--line)",
                background: pill === "Rosa" ? "var(--green)" : "var(--paper)",
                color: pill === "Rosa" ? "var(--cream)" : "var(--green-l)",
                borderColor: pill === "Rosa" ? "var(--green)" : "var(--line)",
                borderRadius: 20,
                padding: "6px 13px",
                cursor: "pointer",
                fontFamily: "var(--mono)",
              }}
            >
              {pill}
            </span>
          ))}
        </div>

        {/* ── Identity + Summary ── */}
        {!isLoading && !isError && data && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "0 14px 6px",
              background: "#15301f",
              color: "var(--cream)",
              borderRadius: 13,
              padding: "12px 15px",
            }}
          >
            {/* Disco-squadra fanta (tondo, team.jersey) — SOLO qui */}
            <DiscoSquadra primary={primary} secondary={secondary} size={34} />

            {/* FM liberi — in oro (R-oro: solo denaro) */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--disp)",
                  fontWeight: 600,
                  fontSize: 19,
                  color: "#e6b84d",
                }}
              >
                {data.creditsRemaining}
              </div>
              <div
                style={{
                  fontSize: 8,
                  textTransform: "uppercase",
                  letterSpacing: ".07em",
                  color: "rgba(239,230,211,.6)",
                }}
              >
                FM liberi
              </div>
            </div>

            <div
              style={{
                width: 1,
                alignSelf: "stretch",
                background: "rgba(239,230,211,.18)",
              }}
            />

            {/* Slot rosa */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--disp)",
                  fontWeight: 600,
                  fontSize: 19,
                  color: "#e6b84d",
                }}
              >
                {totalPlayers}/{slotTotal}
              </div>
              <div
                style={{
                  fontSize: 8,
                  textTransform: "uppercase",
                  letterSpacing: ".07em",
                  color: "rgba(239,230,211,.6)",
                }}
              >
                rosa
              </div>
            </div>

            {/* Contatori per ruolo */}
            <div
              style={{
                display: "flex",
                gap: 9,
                marginLeft: "auto",
                fontSize: 10,
              }}
            >
              {roles.map((r) => (
                <span
                  key={r}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "rgba(239,230,211,.85)",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: ROLE_STYLE[r]!.dot,
                      display: "inline-block",
                    }}
                  />
                  {data.totals[r]}/{data.slotMax[r]}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Body — gruppi per reparto ── */}
        <div
          style={{
            padding: "2px 14px 90px",
            overflowY: "auto",
            maxHeight: "calc(780px - 200px)",
          }}
        >
          {isLoading && (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: "var(--muted)",
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
                marginTop: 12,
              }}
            >
              Errore nel caricamento della rosa. Riprova.
            </div>
          )}

          {!isLoading && !isError && data && (
            <>
              {roles.map((role, i) => (
                <GruppoReparto
                  key={role}
                  role={role}
                  players={playersByRole(role)}
                  slotMax={data.slotMax[role]}
                  isFirst={i === 0}
                />
              ))}

              {/* Nota sui dati mancanti */}
              {!hasPriceFm && (
                <p
                  style={{
                    fontSize: 9.5,
                    color: "var(--muted)",
                    textAlign: "center",
                    margin: "14px 18px 0",
                    lineHeight: 1.5,
                  }}
                >
                  Pagato = prezzo versato all'asta FM.
                  <br />
                  Quotazione di listino non ancora disponibile (dati di avviamento).
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
