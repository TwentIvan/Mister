import { useState } from "react";
import { cn } from "@/lib/utils";
import { ROSA_MARIO, MATCH_GIORNATA_2, type RoleClassic } from "./mock-data";

// ─── Moduli disponibili ───────────────────────────────────────────────────────

const MODULI = [
  "4-3-3",
  "4-4-2",
  "3-5-2",
  "3-4-3",
  "5-3-2",
  "4-2-3-1",
  "4-3-1-2",
  "3-4-1-2",
  "3-4-2-1",
];

// ─── Parsing formazione ───────────────────────────────────────────────────────
// "4-3-3" → [1, 4, 3, 3]   "4-3-1-2" → [1, 4, 3, 1, 2]

function parseFormation(modulo: string): number[] {
  return [1, ...modulo.split("-").map(Number)];
}

// Etichette ruolo per riga:  row 0 → "P", row 1 → "D", row last → "A",
// row (last-1) se totalRows ≥ 5 → "T", resto → "C"
function getRowLabel(rowIdx: number, totalRows: number): string {
  if (rowIdx === 0) return "P";
  if (rowIdx === 1) return "D";
  if (rowIdx === totalRows - 1) return "A";
  if (rowIdx === totalRows - 2 && totalRows >= 5) return "T";
  return "C";
}

// ─── Filtri ruolo ─────────────────────────────────────────────────────────────

type RoleFilter = "tutti" | RoleClassic;

const ROLE_FILTERS: { label: string; value: RoleFilter }[] = [
  { label: "Tutti", value: "tutti" },
  { label: "P", value: "GK" },
  { label: "D", value: "DEF" },
  { label: "C", value: "MID" },
  { label: "A", value: "ATT" },
];

const ROLE_BADGE: Record<RoleClassic, { label: string; color: string }> = {
  GK:  { label: "P", color: "#a06820" },
  DEF: { label: "D", color: "#1f4733" },
  MID: { label: "C", color: "#2d6b4f" },
  ATT: { label: "A", color: "#8b2c2c" },
};

// ─── Componente Pitch ─────────────────────────────────────────────────────────

function Pitch({ modulo }: { modulo: string }) {
  const formation = parseFormation(modulo);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "5 / 7",
        backgroundColor: "#1f4733",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        border: "1px solid rgba(239, 230, 211, 0.15)",
      }}
    >
      {/* ── Linee campo (SVG overlay) ── */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        viewBox="0 0 100 140"
        preserveAspectRatio="none"
      >
        {/* Rettangolo esterno */}
        <rect x="5" y="5" width="90" height="130" fill="none" stroke="rgba(239,230,211,0.25)" strokeWidth="0.6" />
        {/* Linea di centrocampo */}
        <line x1="5" y1="70" x2="95" y2="70" stroke="rgba(239,230,211,0.25)" strokeWidth="0.6" />
        {/* Cerchio centrale */}
        <circle cx="50" cy="70" r="12" fill="none" stroke="rgba(239,230,211,0.25)" strokeWidth="0.6" />
        {/* Punto centrale */}
        <circle cx="50" cy="70" r="0.8" fill="rgba(239,230,211,0.4)" />
        {/* Area di rigore alto (nostra porta) */}
        <rect x="22" y="5" width="56" height="20" fill="none" stroke="rgba(239,230,211,0.25)" strokeWidth="0.6" />
        {/* Area piccola alto */}
        <rect x="36" y="5" width="28" height="9" fill="none" stroke="rgba(239,230,211,0.25)" strokeWidth="0.6" />
        {/* Punto rigore alto */}
        <circle cx="50" cy="17" r="0.8" fill="rgba(239,230,211,0.4)" />
        {/* Area di rigore basso (porta avversaria) */}
        <rect x="22" y="115" width="56" height="20" fill="none" stroke="rgba(239,230,211,0.25)" strokeWidth="0.6" />
        {/* Area piccola basso */}
        <rect x="36" y="126" width="28" height="9" fill="none" stroke="rgba(239,230,211,0.25)" strokeWidth="0.6" />
        {/* Punto rigore basso */}
        <circle cx="50" cy="123" r="0.8" fill="rgba(239,230,211,0.4)" />
      </svg>

      {/* ── Righe formazione (overlay sopra il campo) ── */}
      <div
        style={{
          position: "absolute",
          inset: "6% 4%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-evenly",
          alignItems: "stretch",
        }}
      >
        {formation.map((slots, rowIdx) => (
          <div
            key={rowIdx}
            style={{
              display: "flex",
              justifyContent: "space-evenly",
              alignItems: "center",
            }}
          >
            {Array.from({ length: slots }).map((_, slotIdx) => {
              const slotId = `${rowIdx}-${slotIdx}`;
              const isSelected = selectedSlot === slotId;
              const roleLabel = getRowLabel(rowIdx, formation.length);
              return (
                <button
                  key={slotIdx}
                  onClick={() => setSelectedSlot(isSelected ? null : slotId)}
                  style={{
                    width: "clamp(44px, 9%, 64px)",
                    height: "clamp(44px, 9%, 64px)",
                    borderRadius: "50%",
                    border: isSelected
                      ? "2px solid rgba(239, 230, 211, 0.9)"
                      : "2px dashed rgba(239, 230, 211, 0.4)",
                    background: isSelected
                      ? "rgba(239, 230, 211, 0.15)"
                      : "rgba(239, 230, 211, 0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239, 230, 211, 0.7)";
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(239, 230, 211, 0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239, 230, 211, 0.4)";
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(239, 230, 211, 0.05)";
                    }
                  }}
                  aria-label={`Slot ${roleLabel} riga ${rowIdx + 1}`}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: isSelected ? "rgba(239, 230, 211, 0.95)" : "rgba(239, 230, 211, 0.55)",
                      userSelect: "none",
                    }}
                  >
                    {roleLabel}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Riga giocatore nel pannello rosa ─────────────────────────────────────────

function PlayerRow({ player }: { player: typeof ROSA_MARIO[0] }) {
  const badge = ROLE_BADGE[player.roleClassic];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 12px",
        borderBottom: "1px solid var(--border)",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--green-pale)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "";
      }}
    >
      {/* Foto */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          background: "var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt={player.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <span style={{ fontSize: 11, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
            {player.name[0]}
          </span>
        )}
      </div>

      {/* Nome + squadra */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--ink)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {player.name}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>{player.realTeam}</div>
      </div>

      {/* Badge ruolo */}
      <span
        style={{
          flexShrink: 0,
          padding: "2px 6px",
          borderRadius: "var(--r-sm)",
          background: badge.color,
          color: "#fff",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        {badge.label}
      </span>

      {/* Voto */}
      <span
        style={{
          flexShrink: 0,
          width: 38,
          textAlign: "right",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          fontWeight: 600,
          color: player.votoMister !== null ? "var(--green-deep)" : "var(--ink-dim)",
        }}
      >
        {player.votoMister !== null ? player.votoMister.toFixed(2) : "—"}
      </span>
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function FormazionePage() {
  const [modulo, setModulo] = useState("4-3-3");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("tutti");

  const filteredRosa = roleFilter === "tutti"
    ? ROSA_MARIO
    : ROSA_MARIO.filter((p) => p.roleClassic === roleFilter);

  const { avversario, fieldStatus } = MATCH_GIORNATA_2;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>

      {/* ── Intestazione pagina ── */}
      <div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-2xl)",
            fontWeight: 600,
            color: "var(--green-deep)",
            lineHeight: "var(--leading-tight)",
            marginBottom: 4,
          }}
        >
          Formazione
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "var(--ink-mid)" }}>
            Mario&apos;s Squad · Giornata{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>
              {MATCH_GIORNATA_2.giornata}
            </span>{" "}
            · vs {avversario}
          </span>
          <span
            style={{
              padding: "2px 10px",
              borderRadius: 99,
              background: fieldStatus === "casa" ? "var(--green-deep)" : "var(--ink-mid)",
              color: "#fff",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {fieldStatus === "casa" ? "Casa" : "Trasferta"}
          </span>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-4)",
          flexWrap: "wrap",
          padding: "10px 14px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Modulo selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label
            htmlFor="modulo-select"
            style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-mid)", whiteSpace: "nowrap" }}
          >
            Modulo
          </label>
          <select
            id="modulo-select"
            value={modulo}
            onChange={(e) => setModulo(e.target.value)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink)",
              background: "var(--paper)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--r-sm)",
              padding: "4px 8px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {MODULI.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div
          style={{
            width: 1,
            height: 20,
            background: "var(--border)",
            flexShrink: 0,
          }}
        />

        {/* Capitano placeholder */}
        <div style={{ fontSize: 13, color: "var(--ink-mid)" }}>
          Capitano:{" "}
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-dim)" }}>—</span>
        </div>

        {/* Voto previsto placeholder */}
        <div style={{ fontSize: 13, color: "var(--ink-mid)" }}>
          Voto previsto:{" "}
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-dim)" }}>—</span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Bottoni */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            disabled
            style={{
              padding: "6px 16px",
              borderRadius: "var(--r-sm)",
              border: "none",
              background: "var(--green-deep)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "not-allowed",
              opacity: 0.45,
            }}
          >
            Salva
          </button>
          <button
            disabled
            style={{
              padding: "6px 16px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border-strong)",
              background: "transparent",
              color: "var(--ink-mid)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "not-allowed",
              opacity: 0.45,
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Layout principale: pitch + rosa ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: "var(--sp-5)",
          alignItems: "start",
        }}
        className="formazione-grid"
      >
        {/* Pitch */}
        <div>
          <Pitch modulo={modulo} />
        </div>

        {/* Pannello rosa */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header pannello */}
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-dim)",
              }}
            >
              Rosa
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink-dim)",
              }}
            >
              {filteredRosa.length} / {ROSA_MARIO.length}
            </span>
          </div>

          {/* Filtri ruolo */}
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: "8px 12px",
              borderBottom: "1px solid var(--border)",
              flexWrap: "wrap",
            }}
          >
            {ROLE_FILTERS.map((rf) => (
              <button
                key={rf.value}
                onClick={() => setRoleFilter(rf.value)}
                style={{
                  padding: "3px 10px",
                  borderRadius: 99,
                  border: "1px solid",
                  borderColor: roleFilter === rf.value ? "var(--green-deep)" : "var(--border-strong)",
                  background: roleFilter === rf.value ? "var(--green-deep)" : "transparent",
                  color: roleFilter === rf.value ? "#fff" : "var(--ink-mid)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.12s",
                }}
              >
                {rf.label}
              </button>
            ))}
          </div>

          {/* Lista giocatori */}
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 340px)", minHeight: 300 }}>
            {filteredRosa.length === 0 ? (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  fontSize: 13,
                  color: "var(--ink-dim)",
                }}
              >
                Nessun giocatore per questo filtro.
              </div>
            ) : (
              filteredRosa.map((player) => (
                <PlayerRow key={player.id} player={player} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Responsive: stacked su mobile */}
      <style>{`
        @media (max-width: 768px) {
          .formazione-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
