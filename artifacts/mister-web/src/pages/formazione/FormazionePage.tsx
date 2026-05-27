import { useState, useMemo } from "react";
import { Home, Plane } from "lucide-react";
import { ROSA_MARIO, MATCH_GIORNATA_2, PLAYER_BY_ID, type RoleClassic } from "./mock-data";

// ─── Moduli disponibili ───────────────────────────────────────────────────────

const MODULI = [
  "4-3-3", "4-4-2", "3-5-2", "3-4-3", "5-3-2",
  "4-2-3-1", "4-3-1-2", "3-4-1-2", "3-4-2-1",
];

// ─── Parsing e helpers formazione ────────────────────────────────────────────

function parseFormation(modulo: string): number[] {
  return [1, ...modulo.split("-").map(Number)];
}

function getRowLabel(rowIdx: number, totalRows: number): string {
  if (rowIdx === 0) return "P";
  if (rowIdx === 1) return "D";
  if (rowIdx === totalRows - 1) return "A";
  if (rowIdx === totalRows - 2 && totalRows >= 5) return "T";
  return "C";
}

function labelToRole(label: string): RoleClassic {
  switch (label) {
    case "P": return "GK";
    case "D": return "DEF";
    case "A": return "ATT";
    default:  return "MID";
  }
}

function getSlotRole(slotId: string, formation: number[]): RoleClassic {
  const rowIdx = parseInt(slotId.split("-")[0], 10);
  return labelToRole(getRowLabel(rowIdx, formation.length));
}

function isBenchSlot(slotId: string): boolean {
  return slotId.startsWith("bench-");
}

// Abbrevia cognome per i token sul pitch
function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  return last.length > 9 ? last.slice(0, 8) + "." : last;
}

// ─── Posizioni verticali delle righe sul pitch ────────────────────────────────
// Percentuali (top) dentro il container del pitch (inset 4% top/bottom)

function rowPositionsForFormation(formation: number[]): number[] {
  const n = formation.length;
  if (n === 4) return [9, 30, 55, 78];
  if (n === 5) return [9, 25, 42, 58, 78];
  // fallback distribuzione uniforme per n diverso
  return formation.map((_, i) => 9 + (i / (n - 1)) * 69);
}

// ─── Migrazione lineup al cambio modulo (Task 87) ────────────────────────────

function migrateLineup(
  oldAllSlots: Record<string, number>,
  oldFormation: number[],
  newFormation: number[],
): { newAllSlots: Record<string, number>; message: string } {
  // Estrae giocatori per gruppo di ruolo dalla lineup titolari
  const getFieldPlayers = (labelFilter: (l: string) => boolean): number[] => {
    const result: number[] = [];
    oldFormation.forEach((count, rowIdx) => {
      const label = getRowLabel(rowIdx, oldFormation.length);
      if (labelFilter(label)) {
        for (let si = 0; si < count; si++) {
          const pid = oldAllSlots[`${rowIdx}-${si}`];
          if (pid !== undefined) result.push(pid);
        }
      }
    });
    return result;
  };

  const oldGKs  = getFieldPlayers(l => l === "P");
  const oldDEFs = getFieldPlayers(l => l === "D");
  const oldMIDs = getFieldPlayers(l => l === "C" || l === "T");
  const oldATTs = getFieldPlayers(l => l === "A");

  // Panchina vecchia: preservata invariata
  const oldBench: Record<string, number> = {};
  for (const [id, pid] of Object.entries(oldAllSlots)) {
    if (isBenchSlot(id)) oldBench[id] = pid;
  }

  const newSlots: Record<string, number> = {};
  const surplus: number[] = [];

  const getNewSlotIds = (labelFilter: (l: string) => boolean): string[] => {
    const result: string[] = [];
    newFormation.forEach((count, rowIdx) => {
      const label = getRowLabel(rowIdx, newFormation.length);
      if (labelFilter(label)) {
        for (let si = 0; si < count; si++) result.push(`${rowIdx}-${si}`);
      }
    });
    return result;
  };

  // GK (sempre 1)
  if (oldGKs.length > 0) newSlots["0-0"] = oldGKs[0];
  surplus.push(...oldGKs.slice(1));

  // DEF
  const newDEFSlots = getNewSlotIds(l => l === "D");
  oldDEFs.forEach((pid, i) => {
    if (i < newDEFSlots.length) newSlots[newDEFSlots[i]] = pid;
    else surplus.push(pid);
  });

  // MID + T (interscambiabili)
  const newMIDSlots = getNewSlotIds(l => l === "C" || l === "T");
  oldMIDs.forEach((pid, i) => {
    if (i < newMIDSlots.length) newSlots[newMIDSlots[i]] = pid;
    else surplus.push(pid);
  });

  // ATT
  const newATTSlots = getNewSlotIds(l => l === "A");
  oldATTs.forEach((pid, i) => {
    if (i < newATTSlots.length) newSlots[newATTSlots[i]] = pid;
    else surplus.push(pid);
  });

  // Surplus → panchina (primo slot libero), altrimenti rosa
  const newBench = { ...oldBench };
  let toBench = 0;
  let toRosa = 0;
  for (const pid of surplus) {
    let placed = false;
    for (let i = 0; i < 7; i++) {
      const bId = `bench-${i}`;
      if (newBench[bId] === undefined) {
        newBench[bId] = pid;
        placed = true;
        toBench++;
        break;
      }
    }
    if (!placed) toRosa++;
  }

  const newAllSlots = { ...newSlots, ...newBench };
  const titolariCount = Object.keys(newSlots).length;

  let message = `Modulo cambiato. ${titolariCount} giocatori mantenuti`;
  if (toBench > 0) message += `, ${toBench} in panchina`;
  if (toRosa > 0) message += `, ${toRosa} in rosa`;
  message += ".";

  return { newAllSlots, message };
}

// ─── Costanti UI ──────────────────────────────────────────────────────────────

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

const SLOT_SIZE  = "clamp(72px, 9vh, 96px)";  // titolari
const BENCH_SIZE = 56;                          // px, panchina più piccola

// ─── Componente Pitch (Task 85) ────────────────────────────────────────────────

interface PitchProps {
  modulo: string;
  allSlots: Record<string, number>;
  selectedSlot: string | null;
  onSlotClick: (slotId: string) => void;
  onSlotDoubleClick: (slotId: string) => void;
}

function Pitch({ modulo, allSlots, selectedSlot, onSlotClick, onSlotDoubleClick }: PitchProps) {
  const formation = parseFormation(modulo);
  const rowPositions = rowPositionsForFormation(formation);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "5 / 7",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        border: "1px solid rgba(239, 230, 211, 0.15)",
        userSelect: "none",
      }}
    >
      {/* ── Campo SVG: strisce + linee ── */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        viewBox="0 0 100 140"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Strisce orizzontali alternanti — effetto campo pro */}
          <pattern id="pitch-stripes" x="0" y="0" width="100" height="8.75" patternUnits="userSpaceOnUse">
            <rect x="0" y="0"     width="100" height="4.375" fill="#1f4733" />
            <rect x="0" y="4.375" width="100" height="4.375" fill="#234e38" />
          </pattern>
        </defs>
        {/* Sfondo a strisce */}
        <rect x="0" y="0" width="100" height="140" fill="url(#pitch-stripes)" />

        {/* Linee campo */}
        <rect x="5"  y="5"   width="90" height="130" fill="none" stroke="rgba(239,230,211,0.28)" strokeWidth="0.6" />
        <line x1="5" y1="70" x2="95"   y2="70"       stroke="rgba(239,230,211,0.28)" strokeWidth="0.6" />
        <circle cx="50" cy="70" r="12"  fill="none" stroke="rgba(239,230,211,0.28)" strokeWidth="0.6" />
        <circle cx="50" cy="70" r="0.8" fill="rgba(239,230,211,0.45)" />
        {/* Area rigore nostra (alto) */}
        <rect x="22" y="5"   width="56" height="20" fill="none" stroke="rgba(239,230,211,0.28)" strokeWidth="0.6" />
        <rect x="36" y="5"   width="28" height="9"  fill="none" stroke="rgba(239,230,211,0.28)" strokeWidth="0.6" />
        <circle cx="50" cy="17" r="0.8" fill="rgba(239,230,211,0.45)" />
        {/* Area rigore avversaria (basso) */}
        <rect x="22" y="115" width="56" height="20" fill="none" stroke="rgba(239,230,211,0.28)" strokeWidth="0.6" />
        <rect x="36" y="126" width="28" height="9"  fill="none" stroke="rgba(239,230,211,0.28)" strokeWidth="0.6" />
        <circle cx="50" cy="123" r="0.8" fill="rgba(239,230,211,0.45)" />
      </svg>

      {/* ── Overlay righe formazione (posizionamento assoluto per righe) ── */}
      <div style={{ position: "absolute", inset: "4% 0" }}>
        {formation.map((slotsInRow, rowIdx) => {
          const topPct = rowPositions[rowIdx];
          const roleLabel = getRowLabel(rowIdx, formation.length);

          return (
            <div
              key={rowIdx}
              style={{
                position: "absolute",
                left: "6%",
                right: "6%",
                top: `${topPct}%`,
                transform: "translateY(-50%)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 16,
              }}
            >
              {Array.from({ length: slotsInRow }).map((_, slotIdx) => {
                const slotId = `${rowIdx}-${slotIdx}`;
                const playerId = allSlots[slotId];
                const player = playerId !== undefined ? PLAYER_BY_ID.get(playerId) : undefined;
                const isSelected = selectedSlot === slotId;
                const isOccupied = player !== undefined;

                return (
                  <div
                    key={slotId}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <button
                      onClick={() => onSlotClick(slotId)}
                      onDoubleClick={() => onSlotDoubleClick(slotId)}
                      title={isOccupied ? `${player!.name} — doppio click per rimuovere` : `Slot ${roleLabel}`}
                      style={{
                        width: SLOT_SIZE,
                        height: SLOT_SIZE,
                        flexShrink: 0,
                        borderRadius: "50%",
                        border: `2px ${isOccupied ? "solid" : "dashed"} ${
                          isSelected
                            ? "rgba(239,230,211,1)"
                            : isOccupied
                              ? "rgba(239,230,211,0.75)"
                              : "rgba(239,230,211,0.38)"
                        }`,
                        background: isSelected
                          ? "rgba(239,230,211,0.2)"
                          : isOccupied
                            ? "rgba(0,0,0,0.25)"
                            : "rgba(239,230,211,0.05)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        overflow: "hidden",
                        padding: 0,
                        boxShadow: isSelected ? "0 0 0 3px rgba(45,107,79,0.65)" : "none",
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
                            fontSize: isOccupied ? 10 : 13,
                            fontWeight: 700,
                            color: isSelected
                              ? "rgba(239,230,211,0.95)"
                              : "rgba(239,230,211,0.55)",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {isOccupied ? player!.name[0] : roleLabel}
                        </span>
                      )}
                    </button>

                    {/* Nome giocatore sotto il cerchio — solo quando occupato */}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "rgba(239,230,211,0.9)",
                        fontFamily: "var(--font-sans)",
                        textAlign: "center",
                        lineHeight: 1.2,
                        maxWidth: 80,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                        pointerEvents: "none",
                        visibility: isOccupied ? "visible" : "hidden",
                        height: 14,
                      }}
                    >
                      {isOccupied ? lastName(player!.name) : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Componente Panchina (Task 86) ────────────────────────────────────────────

interface BenchProps {
  allSlots: Record<string, number>;
  selectedSlot: string | null;
  onSlotClick: (slotId: string) => void;
  onSlotDoubleClick: (slotId: string) => void;
}

function Bench({ allSlots, selectedSlot, onSlotClick, onSlotDoubleClick }: BenchProps) {
  return (
    <div>
      {/* Separatore + label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ flex: 1, height: 1, background: "rgba(239,230,211,0.12)" }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "rgba(239,230,211,0.5)",
            fontFamily: "var(--font-sans)",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
          }}
        >
          Panchina
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(239,230,211,0.12)" }} />
      </div>

      {/* 7 slot panchina */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        {Array.from({ length: 7 }).map((_, i) => {
          const slotId = `bench-${i}`;
          const playerId = allSlots[slotId];
          const player = playerId !== undefined ? PLAYER_BY_ID.get(playerId) : undefined;
          const isSelected = selectedSlot === slotId;
          const isOccupied = player !== undefined;

          return (
            <div
              key={slotId}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <button
                onClick={() => onSlotClick(slotId)}
                onDoubleClick={() => onSlotDoubleClick(slotId)}
                title={isOccupied ? `${player!.name} (panchina ${i + 1}) — doppio click per rimuovere` : `Panchina ${i + 1}`}
                style={{
                  width: BENCH_SIZE,
                  height: BENCH_SIZE,
                  flexShrink: 0,
                  borderRadius: "50%",
                  border: `2px ${isOccupied ? "solid" : "dashed"} ${
                    isSelected
                      ? "rgba(239,230,211,0.95)"
                      : isOccupied
                        ? "rgba(239,230,211,0.6)"
                        : "rgba(239,230,211,0.28)"
                  }`,
                  background: isSelected
                    ? "rgba(239,230,211,0.18)"
                    : isOccupied
                      ? "rgba(0,0,0,0.22)"
                      : "rgba(239,230,211,0.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  overflow: "hidden",
                  padding: 0,
                  boxShadow: isSelected ? "0 0 0 2px rgba(45,107,79,0.55)" : "none",
                  transition: "box-shadow 0.15s, border-color 0.15s",
                }}
                aria-label={`Panchina ${i + 1}${isOccupied ? ` — ${player!.name}` : ""}`}
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
                      fontSize: 10,
                      fontWeight: 700,
                      color: isSelected ? "rgba(239,230,211,0.95)" : "rgba(239,230,211,0.4)",
                    }}
                  >
                    {isOccupied ? player!.name[0] : String(i + 1)}
                  </span>
                )}
              </button>

              {/* Nome sotto */}
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: isOccupied ? "rgba(239,230,211,0.8)" : "rgba(239,230,211,0.3)",
                  fontFamily: "var(--font-sans)",
                  textAlign: "center",
                  maxWidth: BENCH_SIZE + 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                }}
              >
                {isOccupied ? lastName(player!.name) : "—"}
              </span>
            </div>
          );
        })}
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
        opacity: isAssigned ? 0.35 : hasSlotSelected && !isCompatible ? 0.4 : 1,
        background: "transparent",
        transition: "background 0.1s, opacity 0.15s",
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
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--ink-dim)" }}>
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
  // Stato unificato: slot campo ("rowIdx-slotIdx") + panchina ("bench-N")
  const [allSlots, setAllSlots] = useState<Record<string, number>>({});
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [manualRoleFilter, setManualRoleFilter] = useState<RoleFilter>("tutti");
  const [moduleChangeMsg, setModuleChangeMsg] = useState<string | null>(null);

  const formation = useMemo(() => parseFormation(modulo), [modulo]);

  // Set di tutti i giocatori già schierati (titolari + panchina)
  const assignedIds = useMemo(() => new Set(Object.values(allSlots)), [allSlots]);

  // Conteggio titolari (slot campo, non panchina)
  const starterCount = useMemo(
    () => Object.keys(allSlots).filter(id => !isBenchSlot(id)).length,
    [allSlots],
  );

  // Ruolo richiesto dallo slot selezionato (null per bench → nessun vincolo)
  const selectedSlotRole: RoleClassic | null = useMemo(() => {
    if (!selectedSlot || isBenchSlot(selectedSlot)) return null;
    return getSlotRole(selectedSlot, formation);
  }, [selectedSlot, formation]);

  const effectiveFilter: RoleFilter = selectedSlotRole ?? manualRoleFilter;

  const filteredRosa = useMemo(() => {
    if (effectiveFilter === "tutti") return ROSA_MARIO;
    return ROSA_MARIO.filter(p => p.roleClassic === effectiveFilter);
  }, [effectiveFilter]);

  // ── Cambio modulo con migrazione intelligente ────────────────────────────────
  function handleModuloChange(newModulo: string) {
    if (newModulo === modulo) return;
    const { newAllSlots, message } = migrateLineup(allSlots, formation, parseFormation(newModulo));
    setModulo(newModulo);
    setAllSlots(newAllSlots);
    setSelectedSlot(null);
    setModuleChangeMsg(message);
    setTimeout(() => setModuleChangeMsg(null), 3500);
  }

  // ── Click su slot (campo o panchina) ────────────────────────────────────────
  function handleSlotClick(slotId: string) {
    if (slotId === selectedSlot) {
      setSelectedSlot(null);
      return;
    }

    if (selectedSlot !== null) {
      const sourcePlayerId = allSlots[selectedSlot];
      if (sourcePlayerId !== undefined) {
        const targetPlayerId = allSlots[slotId];
        setAllSlots(prev => {
          const next = { ...prev };
          if (targetPlayerId !== undefined) {
            next[selectedSlot] = targetPlayerId;
            next[slotId] = sourcePlayerId;
          } else {
            delete next[selectedSlot];
            next[slotId] = sourcePlayerId;
          }
          return next;
        });
        setSelectedSlot(null);
        return;
      }
      // Sorgente vuota → sposta selezione al nuovo slot
      setSelectedSlot(slotId);
      return;
    }

    setSelectedSlot(slotId);
  }

  // ── Doppio click su slot → rimuove giocatore ─────────────────────────────────
  function handleSlotDoubleClick(slotId: string) {
    setAllSlots(prev => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
    if (selectedSlot === slotId) setSelectedSlot(null);
  }

  // ── Click su giocatore nella rosa ────────────────────────────────────────────
  function handlePlayerClick(playerId: number) {
    if (selectedSlot === null) return;
    if (assignedIds.has(playerId)) return;

    const player = PLAYER_BY_ID.get(playerId);
    if (!player) return;

    // Bench: nessun vincolo di ruolo. Campo: ruolo deve corrispondere.
    if (!isBenchSlot(selectedSlot)) {
      const requiredRole = getSlotRole(selectedSlot, formation);
      if (player.roleClassic !== requiredRole) return;
    }

    setAllSlots(prev => ({ ...prev, [selectedSlot]: playerId }));
    setSelectedSlot(null);
  }

  const hasSlotSelected = selectedSlot !== null;
  const { avversario, fieldStatus } = MATCH_GIORNATA_2;
  const salvaEnabled = starterCount === 11;

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
          Titolari:{" "}
          <span style={{ fontFamily: "var(--font-mono)", color: starterCount === 11 ? "var(--green-deep)" : "var(--ink)" }}>
            {starterCount}
          </span>
          <span style={{ color: "var(--ink-dim)" }}>/11</span>
        </div>

        <div style={{ fontSize: 13, color: "var(--ink-mid)" }}>
          Voto previsto:{" "}
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-dim)" }}>—</span>
        </div>

        {/* Toast cambio modulo */}
        {moduleChangeMsg && (
          <div
            style={{
              padding: "3px 10px",
              borderRadius: 99,
              background: "rgba(45,107,79,0.1)",
              border: "1px solid var(--green-mid)",
              fontSize: 12,
              color: "var(--green-deep)",
            }}
          >
            {moduleChangeMsg}
          </div>
        )}

        {/* Feedback selezione slot attiva */}
        {hasSlotSelected && (
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
            {isBenchSlot(selectedSlot!)
              ? "Scegli un giocatore dalla rosa"
              : <>Scegli un <strong style={{ fontFamily: "var(--font-mono)" }}>{selectedSlotRole && ROLE_BADGE[selectedSlotRole].label}</strong> dalla rosa</>
            }
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: 8 }}>
          <button
            disabled={!salvaEnabled}
            style={{
              padding: "6px 16px",
              borderRadius: "var(--r-sm)",
              border: "none",
              background: "var(--green-deep)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: salvaEnabled ? "pointer" : "not-allowed",
              opacity: salvaEnabled ? 1 : 0.45,
              transition: "opacity 0.2s",
            }}
          >
            Salva
          </button>
          <button
            onClick={() => { setAllSlots({}); setSelectedSlot(null); }}
            style={{
              padding: "6px 16px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border-strong)",
              background: "transparent",
              color: "var(--ink-mid)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Layout principale: pitch+panchina / rosa ── */}
      <div
        className="formazione-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: "var(--sp-5)",
          alignItems: "start",
        }}
      >
        {/* Colonna sinistra: pitch + panchina */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            background: "#17332a",
            borderRadius: "var(--r-lg)",
            padding: "0 0 24px",
            border: "1px solid rgba(239,230,211,0.12)",
            overflow: "hidden",
          }}
        >
          <Pitch
            modulo={modulo}
            allSlots={allSlots}
            selectedSlot={selectedSlot}
            onSlotClick={handleSlotClick}
            onSlotDoubleClick={handleSlotDoubleClick}
          />
          <div style={{ padding: "0 20px" }}>
            <Bench
              allSlots={allSlots}
              selectedSlot={selectedSlot}
              onSlotClick={handleSlotClick}
              onSlotDoubleClick={handleSlotDoubleClick}
            />
          </div>
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
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)" }}>
              {assignedIds.size} / {ROSA_MARIO.length} schierati
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
            {ROLE_FILTERS.map(rf => (
              <button
                key={rf.value}
                onClick={() => {
                  if (!hasSlotSelected || isBenchSlot(selectedSlot!)) setManualRoleFilter(rf.value);
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
                  cursor: (hasSlotSelected && !isBenchSlot(selectedSlot!)) ? "default" : "pointer",
                  opacity: (hasSlotSelected && !isBenchSlot(selectedSlot!) && effectiveFilter !== rf.value) ? 0.38 : 1,
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
                  isCompatible={
                    !hasSlotSelected
                    || isBenchSlot(selectedSlot!)
                    || player.roleClassic === selectedSlotRole
                  }
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
