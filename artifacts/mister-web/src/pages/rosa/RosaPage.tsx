import { useRouteId, RouteIdLoading } from "@/hooks/useRouteId";
import { useGetFantaTeamRosa } from "@workspace/api-client-react";
import type { FantaTeamRosaPlayer, FantaTeamRosaTotals } from "@workspace/api-client-react";
import { PlayerBenchRow } from "@/components/player-chip";
import type { ChipPlayer, ChipRole } from "@/components/player-chip";
import "@/components/player-chip.css";

// ─── Adattatore ──────────────────────────────────────────────────────────────

const CLASSIC_TO_CHIP: Record<string, ChipRole> = {
  P: "GK", D: "DEF", C: "MID", A: "ATT",
};

const ROLE_LETTER: Record<string, string> = {
  P: "P", D: "D", C: "C", A: "A",
};

function toChipPlayer(p: FantaTeamRosaPlayer): ChipPlayer {
  return {
    id: p.id,
    name: p.name,
    role: CLASSIC_TO_CHIP[p.roleClassic] ?? "MID",
    cartoonUrl: p.photoCartoonUrl ?? null,
    photoUrl: p.photoUrl ?? null,
    logoUrl: p.logoUrl ?? null,
  };
}

// ─── Slot libero ─────────────────────────────────────────────────────────────

function SlotLibero({ role }: { role: string }) {
  return (
    <div className="rr empty" style={{ minHeight: 42 }}>
      <span className="pos">{ROLE_LETTER[role] ?? role}</span>
      <span className="rn">slot libero</span>
      <span className="rpr-dash">—</span>
    </div>
  );
}

// ─── Riepilogo (.summ) ────────────────────────────────────────────────────────

const ROLE_DOT: Record<string, string> = {
  P: "#c79a4e", D: "#6aa07f", C: "#6aa6b8", A: "#cf8a6a",
};

function Summ({
  creditsRemaining,
  totalPlayers,
  slotTotal,
  totals,
  slotMax,
  primary,
  secondary,
}: {
  creditsRemaining: number;
  totalPlayers: number;
  slotTotal: number;
  totals: FantaTeamRosaTotals;
  slotMax: FantaTeamRosaTotals;
  primary: string;
  secondary: string;
}) {
  const roles = ["P", "D", "C", "A"] as const;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      margin: "0 0 8px",
      background: "#15301f",
      color: "var(--cream)",
      borderRadius: 13,
      padding: "12px 15px",
      flexShrink: 0,
    }}>
      {/* Disco-squadra fanta */}
      <span style={{
        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
        background: `linear-gradient(135deg, ${primary} 0 49%, ${secondary} 51% 100%)`,
        boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.25)",
        display: "block",
      }} />

      {/* FM liberi */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 19, color: "var(--gold-l)" }}>
          {creditsRemaining}
        </div>
        <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".07em", color: "rgba(239,230,211,.6)" }}>
          FM liberi
        </div>
      </div>

      <div style={{ width: 1, alignSelf: "stretch", background: "rgba(239,230,211,.18)" }} />

      {/* Rosa X/25 */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 19, color: "var(--gold-l)" }}>
          {totalPlayers}/{slotTotal}
        </div>
        <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".07em", color: "rgba(239,230,211,.6)" }}>
          rosa
        </div>
      </div>

      {/* Contatori per ruolo */}
      <div style={{ display: "flex", gap: 9, marginLeft: "auto", fontSize: 10, flexWrap: "wrap" }}>
        {roles.map(r => (
          <span key={r} style={{ display: "flex", alignItems: "center", gap: 4, color: "rgba(239,230,211,.85)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: ROLE_DOT[r], display: "inline-block" }} />
            {totals[r] ?? 0}/{slotMax[r] ?? 0}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Subnav pills ─────────────────────────────────────────────────────────────

function Subnav() {
  const pills = ["Panoramica", "Rosa", "Formazione", "Mercato", "Classifica", "Società"];
  return (
    <div style={{ display: "flex", gap: 7, padding: "4px 0 10px", overflowX: "auto", scrollbarWidth: "none", flexShrink: 0 }}>
      {pills.map(pill => (
        <span
          key={pill}
          style={{
            flexShrink: 0, fontSize: 11,
            background: pill === "Rosa" ? "var(--green)" : "var(--paper)",
            color: pill === "Rosa" ? "var(--cream)" : "var(--green-l)",
            border: pill === "Rosa" ? "1px solid var(--green)" : "1px solid var(--line)",
            borderRadius: 20, padding: "6px 13px", cursor: "pointer", fontFamily: "var(--mono)",
          }}
        >
          {pill}
        </span>
      ))}
    </div>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

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

const ROLES = ["P", "D", "C", "A"] as const;

export default function RosaPage() {
  const fantaTeamId = useRouteId("fantaTeamId");
  const { data, isLoading, isError } = useGetFantaTeamRosa(fantaTeamId ?? "");

  if (!fantaTeamId) return <RouteIdLoading />;

  const primary   = data?.jersey?.primaryColor  ?? "#1f4733";
  const secondary = data?.jersey?.secondaryColor ?? "#efe6d3";

  const players   = data?.players ?? [];
  const slotMax   = data?.slotMax ?? { P: 3, D: 8, C: 8, A: 6 };
  const totals    = data?.totals  ?? { P: 0, D: 0, C: 0, A: 0 };

  const totalPlayers = players.length;
  const slotTotal    = ROLES.reduce((s, r) => s + (slotMax[r] ?? 0), 0);

  const byRole = (role: string): FantaTeamRosaPlayer[] =>
    players.filter(p => p.roleClassic === role);

  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: "var(--cream)",
      fontFamily: "var(--mono)",
      overflow: "hidden",
    }}>
      {/* ── Top bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 15px 4px", flexShrink: 0 }}>
        <button style={{ background: "none", border: "none", padding: 0, color: "var(--green)", display: "flex", cursor: "pointer" }}>
          <IcoHamburger />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: 15 }}>Rosa</div>
          <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em" }}>
            {isLoading ? "…" : `${data?.teamName ?? ""} · ${data?.leagueName ?? ""}`}
          </div>
        </div>
        <button style={{ background: "none", border: "none", padding: 0, color: "var(--green)", display: "flex", cursor: "pointer" }}>
          <IcoSettings />
        </button>
      </div>

      {/* ── Body scrollabile ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 90px", display: "flex", flexDirection: "column" }}>
        {/* Subnav */}
        <Subnav />

        {/* Riepilogo */}
        {!isLoading && !isError && data && (
          <Summ
            creditsRemaining={data.creditsRemaining}
            totalPlayers={totalPlayers}
            slotTotal={slotTotal}
            totals={totals}
            slotMax={slotMax}
            primary={primary}
            secondary={secondary}
          />
        )}

        {/* Loading */}
        {isLoading && (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
            Caricamento…
          </div>
        )}

        {/* Error */}
        {isError && (
          <div style={{
            padding: "24px 16px", background: "var(--paper)", border: "1px solid var(--line)",
            borderRadius: 12, color: "var(--muted)", fontSize: 12, marginTop: 12,
          }}>
            Errore nel caricamento della rosa. Riprova.
          </div>
        )}

        {/* Lista piatta — P→D→C→A, niente intestazioni, slot vuoti interleaved */}
        {!isLoading && !isError && data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ROLES.flatMap(role => {
              const rPlayers = byRole(role);
              const vuoti    = Math.max(0, (slotMax[role] ?? 0) - rPlayers.length);
              return [
                ...rPlayers.map(p => (
                  <PlayerBenchRow
                    key={p.id}
                    player={toChipPlayer(p)}
                    voto={p.votoMister ?? null}
                    prezzo={p.purchasePriceFm ?? null}
                  />
                )),
                ...Array.from({ length: vuoti }, (_, i) => (
                  <SlotLibero key={`${role}-vuoto-${i}`} role={role} />
                )),
              ];
            })}
          </div>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        display: "flex", justifyContent: "space-around", alignItems: "center",
        background: "var(--paper)", borderTop: "1px solid var(--line)",
        padding: "9px 6px 18px",
      }}>
        {[
          { icon: <IcoHome />,      label: "Home",      active: false },
          { icon: <IcoLeghe />,     label: "Leghe",     active: true  },
          { icon: <IcoNotifiche />, label: "Notifiche", active: false },
          { icon: <IcoProfilo />,   label: "Profilo",   active: false },
        ].map(({ icon, label, active }) => (
          <div key={label} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            fontSize: 9, color: active ? "var(--green)" : "var(--muted)", fontFamily: "var(--mono)",
          }}>
            <span style={{ color: active ? "var(--gold)" : "currentColor" }}>{icon}</span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
