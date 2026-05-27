import { useState, useMemo } from "react";
import { Home, Plane } from "lucide-react";
import { ROSA_MARIO, MATCH_GIORNATA_2, PLAYER_BY_ID, type RoleClassic } from "./mock-data";

// ─── Moduli disponibili ───────────────────────────────────────────────────────

const MODULI = [
  "4-3-3", "4-4-2", "3-5-2", "3-4-3", "5-3-2",
  "4-2-3-1", "4-3-1-2", "3-4-1-2", "3-4-2-1",
];

// ─── Parsing formazione ───────────────────────────────────────────────────────

function parseFormation(modulo: string): number[] {
  return [1, ...modulo.split("-").map(Number)];
}

// row 0→"P", row 1→"D", row last→"A", row (last-1) se ≥5 righe→"T", resto→"C"
function getRowLabel(rowIdx: number, totalRows: number): string {
  if (rowIdx === 0) return "P";
  if (rowIdx === 1) return "D";
  if (rowIdx === totalRows - 1) return "A";
  if (rowIdx === totalRows - 2 && totalRows >= 5) return "T";
  return "C";
}

// Mappa label → RoleClassic per compatibilità giocatore
function labelToRole(label: string): RoleClassic {
  switch (label) {
    case "P": return "GK";
    case "D": return "DEF";
    case "A": return "ATT";
    default:  return "MID"; // C e T
  }
}

function getSlotRole(slotId: string, formation: number[]): RoleClassic {
  const rowIdx = parseInt(slotId.split("-")[0], 10);
  return labelToRole(getRowLabel(rowIdx, formation.length));
}

// Abbrevia cognome per i token nel pitch
function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  return last.length > 9 ? last.slice(0, 8) + "." : last;
}

// ─── Costanti badge ruolo ─────────────────────────────────────────────────────

type RoleFilter = "tutti" | RoleClassic;

const ROLE_FILTERS: { label: string; value: RoleFilter }[] = [
  { label: "Tutti", value: "tutti" },
  { label: "P",     value: "GK"   },
  { label: "D",     value: "DEF"  },
  { label: "C",     value: "MID"  },
  { label: "A",     value: "ATT"  },
];

const ROLE_BADGE: Record<RoleClassic, { label: string; bg: string }> = {
  GK:  { label: "P", bg: "#a06820" },
  DEF: { label: "D", bg: "#1f4733" },
  MID: { label: "C", bg: "#2d6b4f" },
  ATT: { label: "A", bg: "#8b2c2c" },
};

const SLOT_PX = 62; // dimensione slot in pixel — STESSA per width e height → cerchio perfetto

// ─── Componente Pitch ─────────────────────────────────────────────────────────

interface PitchProps {
  modulo: string;
  slots: Record<string, number>;
  selectedSlot: string | null;
  onSlotClick: (slotId: string) => void;
  onSlotDoubleClick: (slotId: string) => void;
}

function Pitch({ modulo, slots, selectedSlot, onSlotClick, onSlotDoubleClick }: PitchProps) {
  const formation = parseFormation(modulo);

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
        userSelect: "none",
      }}
    >
      {/* ── Linee campo (SVG) ── */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        viewBox="0 0 100 140"
        preserveAspectRatio="none"
      >
        <rect x="5"  y="5"   width="90" height="130" fill="none" stroke="rgba(239,230,211,0.25)" strokeWidth="0.6" />
        <line x1="5" y1="70" x2="95"   y2="70"       stroke="rgba(239,230,211,0.25)" strokeWidth="0.6" />
        <circle cx="50" cy="70" r="12"  fill="none" stroke="rgba(239,230,211,0.25)" strokeWidth="0.6" />
        <circle cx="50" cy="70" r="0.8" fill="rgba(239,230,211,0.4)" />
        {/* Area rigore alto */}
        <rect x="22" y="5"   width="56" height="20" fill="none" stroke="rgba(239,230,211,0.25)" strokeWidth="0.6" />
        <rect x="36" y="5"   width="28" height="9"  fill="none" stroke="rgba(239,230,211,0.25)" strokeWidth="0.6" />
        <circle cx="50" cy="17" r="0.8" fill="rgba(239,230,211,0.4)" />
        {/* Area rigore basso */}
        <rect x="22" y="115" width="56" height="20" fill="none" stroke="rgba(239,230,211,0.25)" strokeWidth="0.6" />
        <rect x="36" y="126" width="28" height="9"  fill="none" stroke="rgba(239,230,211,0.25)" strokeWidth="0.6" />
        <circle cx="50" cy="123" r="0.8" fill="rgba(239,230,211,0.4)" />
      </svg>

      {/* ── Righe formazione ── */}
      <div
        style={{
          position: "absolute",
          inset: "4% 2%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-evenly",
        }}
      >
        {formation.map((slotsInRow, rowIdx) => (
          <div
            key={rowIdx}
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 10,
            }}
          >
            {Array.from({ length: slotsInRow }).map((_, slotIdx) => {
              const slotId = `${rowIdx}-${slotIdx}`;
              const playerId = slots[slotId];
              const player = playerId !== undefined ? PLAYER_BY_ID.get(playerId) : undefined;
              const isSelected = selectedSlot === slotId;
              const isOccupied = player !== undefined;
              const roleLabel = getRowLabel(rowIdx, formation.length);

              // colore bordo: selezionato = verde chiaro, occupato = ruolo, vuoto = cream dashed
              let borderStyle: string;
              let borderColor: string;
              if (isSelected) {
                borderStyle = "solid";
                borderColor = "rgba(239,230,211,1)";
              } else if (isOccupied) {
                borderStyle = "solid";
                borderColor = "rgba(239,230,211,0.7)";
              } else {
                borderStyle = "dashed";
                borderColor = "rgba(239,230,211,0.35)";
              }

              return (
                // wrapper flex-col per nome sotto il cerchio
                <div
                  key={slotId}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={() => onSlotClick(slotId)}
                    onDoubleClick={() => onSlotDoubleClick(slotId)}
                    title={isOccupied ? `${player!.name} — doppio click per rimuovere` : `Slot ${roleLabel}`}
                    style={{
                      width:  SLOT_PX,   // ← stesso valore per width…
                      height: SLOT_PX,   // ← …e height → cerchio perfetto
                      flexShrink: 0,
                      borderRadius: "50%",
                      border: `2px ${borderStyle} ${borderColor}`,
                      background: isSelected
                        ? "rgba(239,230,211,0.18)"
                        : isOccupied
                          ? "rgba(239,230,211,0.08)"
                          : "rgba(239,230,211,0.04)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      overflow: "hidden",
                      padding: 0,
                      boxShadow: isSelected ? "0 0 0 3px rgba(45,107,79,0.6)" : "none",
                      transition: "box-shadow 0.15s, border-color 0.15s, background 0.15s",
                    }}
                    aria-label={`Slot ${roleLabel} riga ${rowIdx + 1}${isOccupied ? ` — ${player!.name}` : ""}`}
                  >
                    {isOccupied && player!.photoUrl ? (
                      <img
                        src={player!.photoUrl}
                        alt={player!.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: isOccupied ? 9 : 11,
                          fontWeight: 700,
                          color: isSelected
                            ? "rgba(239,230,211,0.95)"
                            : "rgba(239,230,211,0.5)",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {isOccupied ? player!.name[0].toUpperCase() : roleLabel}
                      </span>
                    )}
                  </button>

                  {/* Nome giocatore sotto il cerchio */}
                  {isOccupied && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: "rgba(239,230,211,0.85)",
                        fontFamily: "var(--font-sans)",
                        textAlign: "center",
                        lineHeight: 1.2,
                        maxWidth: SLOT_PX + 8,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {lastName(player!.name)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Riga giocatore nel pannello rosa ─────────────────────────────────────────

interface PlayerRowProps {
  player: typeof ROSA_MARIO[0];
  isAssigned: boolean;
  isCompatible: boolean;
  hasSlotSelected: boolean;
  onClick: () => void;
}

function PlayerRow({ player, isAssigned, isCompatible, hasSlotSelected, onClick }: PlayerRowProps) {
  const badge = ROLE_BADGE[player.roleClassic];
  const clickable = !isAssigned && (!hasSlotSelected || isCompatible);

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 12px",
        borderBottom: "1px solid var(--border)",
        cursor: clickable ? "pointer" : "default",
        opacity: isAssigned ? 0.38 : hasSlotSelected && !isCompatible ? 0.45 : 1,
        background: "transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (clickable) (e.currentTarget as HTMLDivElement).style.background = "var(--green-pale)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {/* Foto */}
      <div
        style={{
          width: 36, height: 36,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          background: "var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
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

      {/* Nome + info Serie A */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13, fontWeight: 500, color: "var(--ink)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {player.name}
        </div>
        {/* Riga secondaria: Squadra · icona vs AVVERSARIO */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
          <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>{player.realTeam}</span>
          {player.nextOpponentShort !== null && (
            <>
              <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>·</span>
              {player.nextIsHome ? (
                <Home size={10} style={{ color: "var(--ink-dim)", flexShrink: 0 }} />
              ) : (
                <Plane size={10} style={{ color: "var(--ink-dim)", flexShrink: 0 }} />
              )}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--ink-dim)",
                }}
              >
                {player.nextOpponentShort}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Badge ruolo */}
      <span
        style={{
          flexShrink: 0,
          padding: "2px 6px",
          borderRadius: "var(--r-sm)",
          background: badge.bg,
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
          width: 36,
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
  // slotId → playerId (solo slot occupati sono presenti)
  const [slotMap, setSlotMap] = useState<Record<string, number>>({});
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [manualRoleFilter, setManualRoleFilter] = useState<RoleFilter>("tutti");

  const formation = useMemo(() => parseFormation(modulo), [modulo]);

  // Set di playerId già schierati
  const assignedIds = useMemo(() => new Set(Object.values(slotMap)), [slotMap]);

  // Ruolo richiesto dallo slot selezionato (per auto-filtro rosa)
  const selectedSlotRole: RoleClassic | null = useMemo(() => {
    if (!selectedSlot) return null;
    return getSlotRole(selectedSlot, formation);
  }, [selectedSlot, formation]);

  const effectiveFilter: RoleFilter = selectedSlotRole ?? manualRoleFilter;

  const filteredRosa = useMemo(() => {
    if (effectiveFilter === "tutti") return ROSA_MARIO;
    return ROSA_MARIO.filter(p => p.roleClassic === effectiveFilter);
  }, [effectiveFilter]);

  // ── Cambio modulo: reset tutto ──────────────────────────────────────────────
  function handleModuloChange(newModulo: string) {
    setModulo(newModulo);
    setSlotMap({});
    setSelectedSlot(null);
  }

  // ── Click su slot nel pitch ─────────────────────────────────────────────────
  function handleSlotClick(slotId: string) {
    // Deselect se si clicca lo stesso slot
    if (slotId === selectedSlot) {
      setSelectedSlot(null);
      return;
    }

    if (selectedSlot !== null) {
      const sourcePlayerId = slotMap[selectedSlot];

      if (sourcePlayerId !== undefined) {
        // Slot sorgente occupato → swap/move verso slotId
        const targetPlayerId = slotMap[slotId];
        setSlotMap(prev => {
          const next = { ...prev };
          if (targetPlayerId !== undefined) {
            // Swap: i due si scambiano
            next[selectedSlot] = targetPlayerId;
            next[slotId] = sourcePlayerId;
          } else {
            // Move: sposta il giocatore allo slot vuoto
            delete next[selectedSlot];
            next[slotId] = sourcePlayerId;
          }
          return next;
        });
        setSelectedSlot(null);
        return;
      }

      // Slot sorgente vuoto → cambia selezione al nuovo slot
      setSelectedSlot(slotId);
      return;
    }

    // Nessuna selezione attiva → seleziona questo slot
    setSelectedSlot(slotId);
  }

  // ── Doppio click su slot → rimuove giocatore ────────────────────────────────
  function handleSlotDoubleClick(slotId: string) {
    setSlotMap(prev => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
    if (selectedSlot === slotId) setSelectedSlot(null);
  }

  // ── Click su giocatore nella rosa ───────────────────────────────────────────
  function handlePlayerClick(playerId: number) {
    if (selectedSlot === null) return;
    if (assignedIds.has(playerId)) return; // già schierato

    const player = PLAYER_BY_ID.get(playerId);
    if (!player) return;

    const requiredRole = getSlotRole(selectedSlot, formation);
    if (player.roleClassic !== requiredRole) return; // ruolo incompatibile

    setSlotMap(prev => ({ ...prev, [selectedSlot]: playerId }));
    setSelectedSlot(null);
  }

  const { avversario, fieldStatus } = MATCH_GIORNATA_2;
  const hasSlotSelected = selectedSlot !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>

      {/* ── Intestazione ── */}
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
            <span style={{ fontFamily: "var(--font-mono)" }}>{MATCH_GIORNATA_2.giornata}</span>
            {" · vs "}{avversario}
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
            onChange={e => handleModuloChange(e.target.value)}
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
            {MODULI.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />

        <div style={{ fontSize: 13, color: "var(--ink-mid)" }}>
          Capitano:{" "}
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-dim)" }}>—</span>
        </div>

        <div style={{ fontSize: 13, color: "var(--ink-mid)" }}>
          Voto previsto:{" "}
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-dim)" }}>—</span>
        </div>

        {/* Feedback selezione attiva */}
        {hasSlotSelected && selectedSlotRole && (
          <div
            style={{
              padding: "3px 10px",
              borderRadius: 99,
              background: "rgba(45,107,79,0.12)",
              border: "1px solid var(--green-mid)",
              fontSize: 12,
              color: "var(--green-deep)",
              fontWeight: 500,
            }}
          >
            Scegli un{" "}
            <strong style={{ fontFamily: "var(--font-mono)" }}>
              {ROLE_BADGE[selectedSlotRole].label}
            </strong>
            {" "}dalla rosa
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: 8 }}>
          <button
            disabled
            style={{
              padding: "6px 16px", borderRadius: "var(--r-sm)", border: "none",
              background: "var(--green-deep)", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: "not-allowed", opacity: 0.45,
            }}
          >
            Salva
          </button>
          <button
            disabled
            style={{
              padding: "6px 16px", borderRadius: "var(--r-sm)",
              border: "1px solid var(--border-strong)", background: "transparent",
              color: "var(--ink-mid)", fontSize: 13, fontWeight: 500,
              cursor: "not-allowed", opacity: 0.45,
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Layout pitch + rosa ── */}
      <div
        className="formazione-grid"
        style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "var(--sp-5)", alignItems: "start" }}
      >
        {/* Pitch */}
        <Pitch
          modulo={modulo}
          slots={slotMap}
          selectedSlot={selectedSlot}
          onSlotClick={handleSlotClick}
          onSlotDoubleClick={handleSlotDoubleClick}
        />

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
          {/* Header */}
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-dim)",
              }}
            >
              Rosa
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)" }}>
              {assignedIds.size} / {ROSA_MARIO.length} schierati
            </span>
          </div>

          {/* Filtri ruolo — disabilitati quando uno slot è selezionato (auto-filter attivo) */}
          <div
            style={{
              display: "flex", gap: 4, padding: "8px 12px",
              borderBottom: "1px solid var(--border)", flexWrap: "wrap",
            }}
          >
            {ROLE_FILTERS.map(rf => (
              <button
                key={rf.value}
                onClick={() => {
                  if (!hasSlotSelected) setManualRoleFilter(rf.value);
                }}
                style={{
                  padding: "3px 10px",
                  borderRadius: 99,
                  border: "1px solid",
                  borderColor: effectiveFilter === rf.value ? "var(--green-deep)" : "var(--border-strong)",
                  background: effectiveFilter === rf.value ? "var(--green-deep)" : "transparent",
                  color: effectiveFilter === rf.value ? "#fff" : "var(--ink-mid)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: hasSlotSelected ? "default" : "pointer",
                  opacity: hasSlotSelected && effectiveFilter !== rf.value ? 0.4 : 1,
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
              <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: "var(--ink-dim)" }}>
                Nessun giocatore per questo filtro.
              </div>
            ) : (
              filteredRosa.map(player => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  isAssigned={assignedIds.has(player.id)}
                  isCompatible={selectedSlotRole ? player.roleClassic === selectedSlotRole : true}
                  hasSlotSelected={hasSlotSelected}
                  onClick={() => handlePlayerClick(player.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .formazione-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
