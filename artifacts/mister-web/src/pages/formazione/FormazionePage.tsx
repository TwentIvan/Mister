import { useState, useMemo } from "react";
import { Home, Plane } from "lucide-react";
import {
  ROSA_MARIO, MATCH_GIORNATA_2, PLAYER_BY_ID,
  TEAM_COLORS, TEAM_CODE,
  type RoleClassic,
} from "./mock-data";

// ─── Costanti ────────────────────────────────────────────────────────────────

const MODULI = [
  "4-3-3", "4-4-2", "3-5-2", "3-4-3", "5-3-2",
  "4-2-3-1", "4-3-1-2", "3-4-1-2", "3-4-2-1",
];

const BENCH_SLOTS = 14;

// Ring verde (affinità Classic mode)
const AFFINITY_GREEN = "#4ade80";

// Ring colorato per ruolo (panchina)
const ROLE_RING: Record<RoleClassic, string> = {
  GK:  "#f59e0b",
  DEF: "#34d399",
  MID: "#60a5fa",
  ATT: "#f87171",
};

const ROLE_BADGE: Record<RoleClassic, { label: string; bg: string }> = {
  GK:  { label: "P", bg: "#a06820" },
  DEF: { label: "D", bg: "#1f4733" },
  MID: { label: "C", bg: "#2d6b4f" },
  ATT: { label: "A", bg: "#8b2c2c" },
};

type RoleFilter = "tutti" | RoleClassic;

const ROLE_FILTERS: { label: string; value: RoleFilter }[] = [
  { label: "Tutti", value: "tutti" },
  { label: "P",     value: "GK"   },
  { label: "D",     value: "DEF"  },
  { label: "C",     value: "MID"  },
  { label: "A",     value: "ATT"  },
];

// ─── Helpers formazione ────────────────────────────────────────────────────────

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

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  return last.length > 9 ? last.slice(0, 8) + "." : last;
}

function rowPositionsForFormation(formation: number[]): number[] {
  const n = formation.length;
  if (n === 4) return [9, 30, 55, 78];
  if (n === 5) return [9, 25, 42, 58, 78];
  return formation.map((_, i) => 9 + (i / (n - 1)) * 69);
}

// ─── Panchina iniziale (auto-popolata, ordinata per ruolo poi nome) ─────────

function initialBenchSlots(): Record<string, number> {
  const ROLE_PRIO: Record<RoleClassic, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 };
  const sorted = [...ROSA_MARIO].sort((a, b) => {
    const d = ROLE_PRIO[a.roleClassic] - ROLE_PRIO[b.roleClassic];
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });
  const bench: Record<string, number> = {};
  sorted.slice(0, BENCH_SLOTS).forEach((p, i) => { bench[`bench-${i}`] = p.id; });
  return bench;
}

// ─── Migrazione lineup al cambio modulo ─────────────────────────────────────

function migrateLineup(
  oldAllSlots: Record<string, number>,
  oldFormation: number[],
  newFormation: number[],
): { newAllSlots: Record<string, number>; message: string } {
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

  if (oldGKs.length > 0) newSlots["0-0"] = oldGKs[0];
  surplus.push(...oldGKs.slice(1));

  const newDEFSlots = getNewSlotIds(l => l === "D");
  oldDEFs.forEach((pid, i) => { if (i < newDEFSlots.length) newSlots[newDEFSlots[i]] = pid; else surplus.push(pid); });

  const newMIDSlots = getNewSlotIds(l => l === "C" || l === "T");
  oldMIDs.forEach((pid, i) => { if (i < newMIDSlots.length) newSlots[newMIDSlots[i]] = pid; else surplus.push(pid); });

  const newATTSlots = getNewSlotIds(l => l === "A");
  oldATTs.forEach((pid, i) => { if (i < newATTSlots.length) newSlots[newATTSlots[i]] = pid; else surplus.push(pid); });

  const newBench = { ...oldBench };
  let toBench = 0;
  let toRosa = 0;
  for (const pid of surplus) {
    let placed = false;
    for (let i = 0; i < BENCH_SLOTS; i++) {
      if (newBench[`bench-${i}`] === undefined) {
        newBench[`bench-${i}`] = pid;
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
  return { newAllSlots, message: message + "." };
}

// ─── PlayerToken ──────────────────────────────────────────────────────────────
// Anatomia completa: ring · foto · badge casa/volo · badge voto · pill colori · nome · (C capitano)

interface PlayerTokenProps {
  player: { id: number; name: string; realTeam: string; roleClassic: RoleClassic; photoUrl: string | null; votoMister: number | null; nextIsHome: boolean | null };
  variant: "field" | "bench";
  affinityColor: string;
  isCaptain?: boolean;
  isSelected?: boolean;
}

function PlayerToken({ player, variant, affinityColor, isCaptain = false, isSelected = false }: PlayerTokenProps) {
  const isField = variant === "field";
  const PHOTO   = isField ? 76 : 40;
  const RING    = isField ? 3  : 2;
  const OUTER   = PHOTO + RING * 2;
  const PILL_W  = isField ? 66 : 36;
  const PILL_H  = isField ? 16 : 12;
  const VBADGE  = isField ? 22 : 16;
  const HBADGE  = isField ? 20 : 15;
  const CBADGE  = 18;

  const colors = TEAM_COLORS[player.realTeam] ?? { primary: "#444", secondary: "#888" };
  const code   = TEAM_CODE[player.realTeam] ?? "???";
  const hasVoto = player.votoMister !== null;
  const name = lastName(player.name);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: isField ? 5 : 3,
        width: Math.max(OUTER, PILL_W) + 8,
      }}
    >
      {/* ── Ring + foto + badge sovrapposti ── */}
      <div style={{ position: "relative", width: OUTER, height: OUTER, flexShrink: 0 }}>
        {/* Foto (dentro il ring) */}
        <div
          style={{
            position: "absolute",
            inset: RING,
            borderRadius: "50%",
            overflow: "hidden",
            background: "rgba(0,0,0,0.35)",
          }}
        >
          {player.photoUrl && (
            <img
              src={player.photoUrl}
              alt={player.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>

        {/* Ring di affinità */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `${RING}px solid ${isSelected ? "rgba(255,255,255,0.95)" : affinityColor}`,
            boxShadow: isSelected
              ? `0 0 0 3px rgba(255,255,255,0.3), 0 0 12px ${affinityColor}88`
              : `0 0 6px ${affinityColor}66`,
            pointerEvents: "none",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        />

        {/* Badge casa/trasferta — top left */}
        <div
          style={{
            position: "absolute",
            top: -2,
            left: -2,
            width: HBADGE,
            height: HBADGE,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          }}
        >
          {player.nextIsHome
            ? <Home  size={isField ? 11 : 9} color="#1f4733" />
            : <Plane size={isField ? 11 : 9} color="#1f4733" />
          }
        </div>

        {/* Badge voto — top right */}
        <div
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            width: VBADGE,
            height: VBADGE,
            borderRadius: "50%",
            background: hasVoto ? "#1f4733" : "rgba(0,0,0,0.45)",
            border: hasVoto ? "none" : "1px solid rgba(239,230,211,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: isField ? 8 : 7,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1,
            }}
          >
            {hasVoto ? player.votoMister!.toFixed(1) : "—"}
          </span>
        </div>

        {/* Badge capitano — bottom right */}
        {isCaptain && (
          <div
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: CBADGE,
              height: CBADGE,
              borderRadius: "50%",
              background: "#F4C430",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 800, color: "#333" }}>C</span>
          </div>
        )}
      </div>

      {/* ── Pill colori squadra (split left/right) ── */}
      <div
        style={{
          width: PILL_W,
          height: PILL_H,
          borderRadius: 6,
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
          boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: colors.primary }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", background: colors.secondary }} />
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: isField ? 9 : 7,
            fontWeight: 700,
            color: "#fff",
            textShadow: "0 1px 3px rgba(0,0,0,0.8)",
            letterSpacing: "0.04em",
          }}
        >
          {code}
        </span>
      </div>

      {/* ── Cognome ── */}
      <span
        style={{
          fontSize: isField ? 11 : 10,
          fontWeight: 600,
          color: "rgba(239,230,211,0.92)",
          fontFamily: "var(--font-sans)",
          textAlign: "center",
          lineHeight: 1.2,
          maxWidth: Math.max(OUTER, PILL_W) + 8,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textShadow: "0 1px 3px rgba(0,0,0,0.7)",
        }}
      >
        {name}
      </span>
    </div>
  );
}

// ─── Pitch ───────────────────────────────────────────────────────────────────

interface PitchProps {
  modulo: string;
  allSlots: Record<string, number>;
  selectedSlot: string | null;
  captainId: number | null;
  onSlotClick: (slotId: string) => void;
  onSlotDoubleClick: (slotId: string) => void;
}

function Pitch({ modulo, allSlots, selectedSlot, captainId, onSlotClick, onSlotDoubleClick }: PitchProps) {
  const formation = parseFormation(modulo);
  const rowPositions = rowPositionsForFormation(formation);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "5 / 7",
        borderRadius: "var(--r-lg) var(--r-lg) 0 0",
        overflow: "hidden",
        border: "1px solid rgba(239,230,211,0.12)",
        borderBottom: "none",
        userSelect: "none",
      }}
    >
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        viewBox="0 0 100 140"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="pitch-stripes" x="0" y="0" width="100" height="8.75" patternUnits="userSpaceOnUse">
            <rect x="0" y="0"     width="100" height="4.375" fill="#1f4733" />
            <rect x="0" y="4.375" width="100" height="4.375" fill="#234e38" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="100" height="140" fill="url(#pitch-stripes)" />
        <rect x="5"  y="5"   width="90" height="130" fill="none" stroke="rgba(239,230,211,0.28)" strokeWidth="0.6" />
        <line x1="5" y1="70" x2="95"   y2="70"       stroke="rgba(239,230,211,0.28)" strokeWidth="0.6" />
        <circle cx="50" cy="70" r="12"  fill="none" stroke="rgba(239,230,211,0.28)" strokeWidth="0.6" />
        <circle cx="50" cy="70" r="0.8" fill="rgba(239,230,211,0.45)" />
        <rect x="22" y="5"   width="56" height="20" fill="none" stroke="rgba(239,230,211,0.28)" strokeWidth="0.6" />
        <rect x="36" y="5"   width="28" height="9"  fill="none" stroke="rgba(239,230,211,0.28)" strokeWidth="0.6" />
        <circle cx="50" cy="17"  r="0.8" fill="rgba(239,230,211,0.45)" />
        <rect x="22" y="115" width="56" height="20" fill="none" stroke="rgba(239,230,211,0.28)" strokeWidth="0.6" />
        <rect x="36" y="126" width="28" height="9"  fill="none" stroke="rgba(239,230,211,0.28)" strokeWidth="0.6" />
        <circle cx="50" cy="123" r="0.8" fill="rgba(239,230,211,0.45)" />
      </svg>

      <div style={{ position: "absolute", inset: "4% 0" }}>
        {formation.map((slotsInRow, rowIdx) => {
          const topPct = rowPositions[rowIdx];
          const roleLabel = getRowLabel(rowIdx, formation.length);

          return (
            <div
              key={rowIdx}
              style={{
                position: "absolute",
                left: "4%",
                right: "4%",
                top: `${topPct}%`,
                transform: "translateY(-50%)",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                gap: 10,
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
                    onClick={() => onSlotClick(slotId)}
                    onDoubleClick={() => onSlotDoubleClick(slotId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") onSlotClick(slotId); }}
                    title={isOccupied ? `${player!.name} — doppio click per spostare in panchina` : `Slot ${roleLabel}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                      outline: "none",
                    }}
                  >
                    {isOccupied ? (
                      <PlayerToken
                        player={player!}
                        variant="field"
                        affinityColor={AFFINITY_GREEN}
                        isCaptain={captainId === player!.id}
                        isSelected={isSelected}
                      />
                    ) : (
                      /* slot vuoto */
                      <div
                        style={{
                          width: "clamp(72px, 9vh, 92px)",
                          height: "clamp(72px, 9vh, 92px)",
                          borderRadius: "50%",
                          border: `2px dashed ${isSelected ? "rgba(239,230,211,0.9)" : "rgba(239,230,211,0.35)"}`,
                          background: isSelected ? "rgba(239,230,211,0.15)" : "rgba(239,230,211,0.04)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: isSelected ? "0 0 0 3px rgba(74,222,128,0.45)" : "none",
                          transition: "box-shadow 0.15s, border-color 0.15s",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 13,
                            fontWeight: 700,
                            color: isSelected ? "rgba(239,230,211,0.9)" : "rgba(239,230,211,0.4)",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {roleLabel}
                        </span>
                      </div>
                    )}
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

// ─── Bench ────────────────────────────────────────────────────────────────────

interface BenchProps {
  allSlots: Record<string, number>;
  selectedSlot: string | null;
  onSlotClick: (slotId: string) => void;
  onSlotDoubleClick: (slotId: string) => void;
}

function Bench({ allSlots, selectedSlot, onSlotClick, onSlotDoubleClick }: BenchProps) {
  const rows = [[0, 1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12, 13]];

  return (
    <div style={{ padding: "16px 12px 20px" }}>
      {/* Separatore + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(239,230,211,0.12)" }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(239,230,211,0.45)", fontFamily: "var(--font-sans)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
          Panchina
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(239,230,211,0.12)" }} />
      </div>

      {/* 2 righe × 7 slot */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((row, rowI) => (
          <div key={rowI} style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            {row.map(i => {
              const slotId = `bench-${i}`;
              const playerId = allSlots[slotId];
              const player = playerId !== undefined ? PLAYER_BY_ID.get(playerId) : undefined;
              const isSelected = selectedSlot === slotId;
              const isOccupied = player !== undefined;

              return (
                <div
                  key={slotId}
                  onClick={() => onSlotClick(slotId)}
                  onDoubleClick={() => onSlotDoubleClick(slotId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") onSlotClick(slotId); }}
                  title={isOccupied ? `${player!.name} — doppio click per rimuovere` : `Panchina ${i + 1}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    cursor: "pointer",
                    flexShrink: 0,
                    outline: "none",
                  }}
                >
                  {isOccupied ? (
                    <PlayerToken
                      player={player!}
                      variant="bench"
                      affinityColor={ROLE_RING[player!.roleClassic]}
                      isSelected={isSelected}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        border: `2px dashed ${isSelected ? "rgba(239,230,211,0.8)" : "rgba(239,230,211,0.22)"}`,
                        background: isSelected ? "rgba(239,230,211,0.1)" : "rgba(239,230,211,0.03)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: isSelected ? "0 0 0 2px rgba(74,222,128,0.4)" : "none",
                        transition: "box-shadow 0.15s",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "rgba(239,230,211,0.3)" }}>
                        {i + 1}
                      </span>
                    </div>
                  )}
                  {/* Numero priorità sotto il token (anche se vuoto, mantiene layout) */}
                  {!isOccupied && (
                    <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "rgba(239,230,211,0.25)", height: 10 }}>
                      {i + 1}
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

// ─── Riga giocatore nel roster ────────────────────────────────────────────────

type PlayerStatus = "titolare" | { bench: number } | "disponibile";

function getPlayerStatus(playerId: number, allSlots: Record<string, number>): PlayerStatus {
  for (const [slotId, pid] of Object.entries(allSlots)) {
    if (pid !== playerId) continue;
    if (isBenchSlot(slotId)) return { bench: parseInt(slotId.split("-")[1], 10) + 1 };
    return "titolare";
  }
  return "disponibile";
}

interface PlayerRowProps {
  player: typeof ROSA_MARIO[0];
  status: PlayerStatus;
  isCompatible: boolean;
  hasSlotSelected: boolean;
  selectedSlotIsBench: boolean;
  onClick: () => void;
}

function PlayerRow({ player, status, isCompatible, hasSlotSelected, selectedSlotIsBench, onClick }: PlayerRowProps) {
  const badge = ROLE_BADGE[player.roleClassic];
  const isTitolare = status === "titolare";
  // Titolari non sono clickabili dal roster (si spostano dal campo)
  const clickable = !isTitolare && (!hasSlotSelected || selectedSlotIsBench || isCompatible);
  const dimmed = isTitolare ? 0.4 : hasSlotSelected && !selectedSlotIsBench && !isCompatible ? 0.42 : 1;

  const statusLabel = isTitolare
    ? "TIT"
    : typeof status === "object"
      ? `#${status.bench}`
      : "";

  const statusColor = isTitolare ? "#4ade80" : typeof status === "object" ? "rgba(239,230,211,0.45)" : undefined;

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "6px 12px",
        borderBottom: "1px solid var(--border)",
        cursor: clickable ? "pointer" : "default",
        opacity: dimmed,
        background: "transparent",
        transition: "background 0.1s, opacity 0.15s",
      }}
      onMouseEnter={(e) => { if (clickable) (e.currentTarget as HTMLDivElement).style.background = "var(--green-pale)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      {/* Foto */}
      <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {player.photoUrl ? (
          <img src={player.photoUrl} alt={player.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <span style={{ fontSize: 10, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>{player.name[0]}</span>
        )}
      </div>

      {/* Nome + info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {player.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 1 }}>
          <span style={{ fontSize: 10, color: "var(--ink-dim)" }}>{player.realTeam}</span>
          {player.nextOpponentShort !== null && (
            <>
              <span style={{ fontSize: 10, color: "var(--ink-dim)" }}>·</span>
              {player.nextIsHome ? <Home size={9} style={{ color: "var(--ink-dim)" }} /> : <Plane size={9} style={{ color: "var(--ink-dim)" }} />}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "var(--ink-dim)" }}>{player.nextOpponentShort}</span>
            </>
          )}
        </div>
      </div>

      {/* Badge ruolo */}
      <span style={{ flexShrink: 0, padding: "1px 5px", borderRadius: "var(--r-sm)", background: badge.bg, color: "#fff", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.04em" }}>
        {badge.label}
      </span>

      {/* Voto */}
      <span style={{ flexShrink: 0, width: 32, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: player.votoMister !== null ? "var(--green-deep)" : "var(--ink-dim)" }}>
        {player.votoMister !== null ? player.votoMister.toFixed(2) : "—"}
      </span>

      {/* Status */}
      {statusLabel && (
        <span style={{ flexShrink: 0, width: 26, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: statusColor }}>
          {statusLabel}
        </span>
      )}
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function FormazionePage() {
  const [modulo, setModulo] = useState("4-3-3");
  const [allSlots, setAllSlots] = useState<Record<string, number>>(initialBenchSlots);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [manualRoleFilter, setManualRoleFilter] = useState<RoleFilter>("tutti");
  const [moduleChangeMsg, setModuleChangeMsg] = useState<string | null>(null);
  const captainId: number | null = null; // TODO: selezione capitano (step futuro)

  const formation = useMemo(() => parseFormation(modulo), [modulo]);

  // Set di tutti i giocatori schierati (campo + panchina)
  const assignedIds = useMemo(() => new Set(Object.values(allSlots)), [allSlots]);

  // Giocatori schierati in campo (titolari)
  const fieldPlayerIds = useMemo(() => {
    const s = new Set<number>();
    for (const [id, pid] of Object.entries(allSlots)) {
      if (!isBenchSlot(id)) s.add(pid);
    }
    return s;
  }, [allSlots]);

  const starterCount = fieldPlayerIds.size;

  const selectedSlotRole: RoleClassic | null = useMemo(() => {
    if (!selectedSlot || isBenchSlot(selectedSlot)) return null;
    return getSlotRole(selectedSlot, formation);
  }, [selectedSlot, formation]);

  const selectedSlotIsBench = selectedSlot !== null && isBenchSlot(selectedSlot);
  const effectiveFilter: RoleFilter = selectedSlotRole ?? manualRoleFilter;

  const filteredRosa = useMemo(() => {
    if (effectiveFilter === "tutti") return ROSA_MARIO;
    return ROSA_MARIO.filter(p => p.roleClassic === effectiveFilter);
  }, [effectiveFilter]);

  // ── Cambio modulo con migrazione ─────────────────────────────────────────────
  function handleModuloChange(newModulo: string) {
    if (newModulo === modulo) return;
    const { newAllSlots, message } = migrateLineup(allSlots, formation, parseFormation(newModulo));
    setModulo(newModulo);
    setAllSlots(newAllSlots);
    setSelectedSlot(null);
    setModuleChangeMsg(message);
    setTimeout(() => setModuleChangeMsg(null), 3500);
  }

  // ── Click su slot (campo o panchina) ─────────────────────────────────────────
  function handleSlotClick(slotId: string) {
    if (slotId === selectedSlot) { setSelectedSlot(null); return; }

    if (selectedSlot !== null) {
      const sourcePid = allSlots[selectedSlot];
      if (sourcePid !== undefined) {
        const targetPid = allSlots[slotId];
        setAllSlots(prev => {
          const next = { ...prev };
          if (targetPid !== undefined) {
            next[selectedSlot] = targetPid;
            next[slotId] = sourcePid;
          } else {
            delete next[selectedSlot];
            next[slotId] = sourcePid;
          }
          return next;
        });
        setSelectedSlot(null);
        return;
      }
      setSelectedSlot(slotId);
      return;
    }
    setSelectedSlot(slotId);
  }

  // ── Doppio click su slot campo → sposta in panchina (primo posto libero) ────
  function handleSlotDoubleClick(slotId: string) {
    const playerId = allSlots[slotId];
    setAllSlots(prev => {
      const next = { ...prev };
      delete next[slotId];
      if (playerId !== undefined) {
        if (!isBenchSlot(slotId)) {
          // Auto-move a panchina
          for (let i = 0; i < BENCH_SLOTS; i++) {
            if (next[`bench-${i}`] === undefined) {
              next[`bench-${i}`] = playerId;
              break;
            }
          }
        }
      }
      return next;
    });
    if (selectedSlot === slotId) setSelectedSlot(null);
  }

  // ── Click su giocatore nel roster ────────────────────────────────────────────
  function handlePlayerClick(playerId: number) {
    if (selectedSlot === null) return;
    const player = PLAYER_BY_ID.get(playerId);
    if (!player) return;

    // I titolari non si spostano dal roster (interagire con il loro slot campo)
    if (fieldPlayerIds.has(playerId)) return;

    // Controllo ruolo per slot campo
    if (!isBenchSlot(selectedSlot)) {
      const requiredRole = getSlotRole(selectedSlot, formation);
      if (player.roleClassic !== requiredRole) return;
    }

    setAllSlots(prev => {
      const next = { ...prev };
      // Rimuovi da dove era (bench)
      for (const [id, pid] of Object.entries(next)) {
        if (pid === playerId) { delete next[id]; break; }
      }
      next[selectedSlot] = playerId;
      return next;
    });
    setSelectedSlot(null);
  }

  const { avversario, fieldStatus } = MATCH_GIORNATA_2;
  const salvaEnabled = starterCount === 11;
  const hasSlotSelected = selectedSlot !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>

      {/* ── Intestazione ── */}
      <div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-2xl)", fontWeight: 600, color: "var(--green-deep)", lineHeight: "var(--leading-tight)", marginBottom: 4 }}>
          Formazione
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "var(--ink-mid)" }}>
            Mario&apos;s Squad · Giornata <span style={{ fontFamily: "var(--font-mono)" }}>{MATCH_GIORNATA_2.giornata}</span> · vs {avversario}
          </span>
          <span style={{ padding: "2px 10px", borderRadius: 99, background: fieldStatus === "casa" ? "var(--green-deep)" : "var(--ink-mid)", color: "#fff", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {fieldStatus === "casa" ? "Casa" : "Trasferta"}
          </span>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap", padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-card)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label htmlFor="modulo-select" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-mid)", whiteSpace: "nowrap" }}>Modulo</label>
          <select
            id="modulo-select"
            value={modulo}
            onChange={e => handleModuloChange(e.target.value)}
            style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--ink)", background: "var(--paper)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", padding: "4px 8px", cursor: "pointer", outline: "none" }}
          >
            {MODULI.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />

        <div style={{ fontSize: 13, color: "var(--ink-mid)" }}>
          Titolari: <span style={{ fontFamily: "var(--font-mono)", color: starterCount === 11 ? "var(--green-deep)" : "var(--ink)", fontWeight: 600 }}>{starterCount}</span><span style={{ color: "var(--ink-dim)" }}>/11</span>
        </div>

        <div style={{ fontSize: 13, color: "var(--ink-mid)" }}>
          Voto previsto: <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-dim)" }}>—</span>
        </div>

        {moduleChangeMsg && (
          <div style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(45,107,79,0.1)", border: "1px solid var(--green-mid)", fontSize: 12, color: "var(--green-deep)" }}>
            {moduleChangeMsg}
          </div>
        )}

        {hasSlotSelected && (
          <div style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.4)", fontSize: 12, color: "var(--green-deep)", fontWeight: 500 }}>
            {selectedSlotIsBench
              ? "Scegli un giocatore dalla rosa"
              : <>Scegli un <strong style={{ fontFamily: "var(--font-mono)" }}>{selectedSlotRole && ROLE_BADGE[selectedSlotRole].label}</strong> dalla rosa</>
            }
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: 8 }}>
          <button
            disabled={!salvaEnabled}
            style={{ padding: "6px 16px", borderRadius: "var(--r-sm)", border: "none", background: "var(--green-deep)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: salvaEnabled ? "pointer" : "not-allowed", opacity: salvaEnabled ? 1 : 0.45, transition: "opacity 0.2s" }}
          >
            Salva
          </button>
          <button
            onClick={() => { setAllSlots(initialBenchSlots()); setSelectedSlot(null); }}
            style={{ padding: "6px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--ink-mid)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Layout pitch+panchina / roster ── */}
      <div className="formazione-grid" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "var(--sp-5)", alignItems: "start" }}>

        {/* Colonna sinistra: pitch + panchina */}
        <div style={{ background: "#17332a", borderRadius: "var(--r-lg)", border: "1px solid rgba(239,230,211,0.1)", overflow: "hidden" }}>
          <Pitch
            modulo={modulo}
            allSlots={allSlots}
            selectedSlot={selectedSlot}
            captainId={captainId}
            onSlotClick={handleSlotClick}
            onSlotDoubleClick={handleSlotDoubleClick}
          />
          <Bench
            allSlots={allSlots}
            selectedSlot={selectedSlot}
            onSlotClick={handleSlotClick}
            onSlotDoubleClick={handleSlotDoubleClick}
          />
        </div>

        {/* Pannello roster */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-card)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-dim)" }}>Rosa</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)" }}>{ROSA_MARIO.length} giocatori</span>
          </div>

          <div style={{ display: "flex", gap: 4, padding: "8px 12px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
            {ROLE_FILTERS.map(rf => (
              <button
                key={rf.value}
                onClick={() => { if (!hasSlotSelected || selectedSlotIsBench) setManualRoleFilter(rf.value); }}
                style={{
                  padding: "3px 10px", borderRadius: 99, border: "1px solid",
                  borderColor: effectiveFilter === rf.value ? "var(--green-deep)" : "var(--border-strong)",
                  background: effectiveFilter === rf.value ? "var(--green-deep)" : "transparent",
                  color: effectiveFilter === rf.value ? "#fff" : "var(--ink-mid)",
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                  cursor: (hasSlotSelected && !selectedSlotIsBench) ? "default" : "pointer",
                  opacity: (hasSlotSelected && !selectedSlotIsBench && effectiveFilter !== rf.value) ? 0.38 : 1,
                  transition: "all 0.12s",
                }}
              >
                {rf.label}
              </button>
            ))}
          </div>

          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 300px)", minHeight: 300 }}>
            {filteredRosa.map(player => (
              <PlayerRow
                key={player.id}
                player={player}
                status={getPlayerStatus(player.id, allSlots)}
                isCompatible={!hasSlotSelected || selectedSlotIsBench || player.roleClassic === selectedSlotRole}
                hasSlotSelected={hasSlotSelected}
                selectedSlotIsBench={selectedSlotIsBench}
                onClick={() => handlePlayerClick(player.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) { .formazione-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
