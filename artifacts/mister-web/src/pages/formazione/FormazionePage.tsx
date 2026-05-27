import { useState, useMemo } from "react";
import { Home, Plane } from "lucide-react";
import {
  ROSA_MARIO, MATCH_GIORNATA_2, PLAYER_BY_ID,
  TEAM_COLORS, TEAM_CODE, COACH_MARIO,
  type RoleClassic, type HeadCoach,
} from "./mock-data";

// ─── Costanti ────────────────────────────────────────────────────────────────

const MODULI = [
  "4-3-3", "4-4-2", "3-5-2", "3-4-3", "5-3-2",
  "4-2-3-1", "4-3-1-2", "3-4-1-2", "3-4-2-1",
];

const AFFINITY_GREEN = "#4ade80";

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

// ─── Selezione attiva ─────────────────────────────────────────────────────────

type Selection =
  | { kind: "field"; slotId: string }
  | { kind: "bench"; playerId: number }
  | null;

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

// ─── Panchina iniziale: tutti i 25, per ruolo poi nome ────────────────────────

function initialBench(): number[] {
  const ROLE_PRIO: Record<RoleClassic, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 };
  return [...ROSA_MARIO]
    .sort((a, b) => {
      const d = ROLE_PRIO[a.roleClassic] - ROLE_PRIO[b.roleClassic];
      return d !== 0 ? d : a.name.localeCompare(b.name);
    })
    .map(p => p.id);
}

// ─── Migrazione lineup al cambio modulo ─────────────────────────────────────

function migrateLineup(
  oldFieldSlots: Record<string, number>,
  oldBench: number[],
  oldFormation: number[],
  newFormation: number[],
): { newFieldSlots: Record<string, number>; newBench: number[]; message: string } {
  const getFieldPlayers = (labelFilter: (l: string) => boolean): number[] => {
    const result: number[] = [];
    oldFormation.forEach((count, rowIdx) => {
      const label = getRowLabel(rowIdx, oldFormation.length);
      if (labelFilter(label)) {
        for (let si = 0; si < count; si++) {
          const pid = oldFieldSlots[`${rowIdx}-${si}`];
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

  // Surplus → in coda alla panchina
  const newBench = [...oldBench, ...surplus];
  const titolariCount = Object.keys(newSlots).length;
  let message = `Modulo cambiato. ${titolariCount} giocatori mantenuti`;
  if (surplus.length > 0) message += `, ${surplus.length} in panchina`;
  return { newFieldSlots: newSlots, newBench, message: message + "." };
}

// ─── PlayerToken ──────────────────────────────────────────────────────────────

interface PlayerTokenProps {
  player: typeof ROSA_MARIO[0];
  variant: "field" | "bench";
  affinityColor: string;
  isCaptain?: boolean;
  isSelected?: boolean;
  benchPriority?: number;
}

function PlayerToken({
  player, variant, affinityColor,
  isCaptain = false, isSelected = false, benchPriority,
}: PlayerTokenProps) {
  const isField = variant === "field";
  const PHOTO   = isField ? 76 : 40;
  const RING    = isField ? 3  : 2;
  const OUTER   = PHOTO + RING * 2;
  const PILL_W  = isField ? 66 : 36;
  const PILL_H  = isField ? 16 : 12;
  const VBADGE  = isField ? 22 : 16;
  const CBADGE  = 18;

  const colors = TEAM_COLORS[player.realTeam] ?? { primary: "#444", secondary: "#888" };
  const code   = TEAM_CODE[player.realTeam] ?? "???";
  const hasVoto = player.votoMister !== null;
  const name = lastName(player.name);
  const oppCode = player.nextOpponentShort;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: isField ? 5 : 3 }}>
      {/* ── Ring + foto + badge sovrapposti ── */}
      <div style={{ position: "relative", width: OUTER, height: OUTER, flexShrink: 0 }}>
        {/* Foto */}
        <div style={{ position: "absolute", inset: RING, borderRadius: "50%", overflow: "hidden", background: "rgba(0,0,0,0.35)" }}>
          {(player.photoCartoonUrl ?? player.photoUrl) && (
            <img
              src={player.photoCartoonUrl ?? player.photoUrl!} alt={player.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>

        {/* Ring affinità */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: `${RING}px solid ${isSelected ? "rgba(255,255,255,0.97)" : affinityColor}`,
          boxShadow: isSelected
            ? `0 0 0 3px rgba(255,255,255,0.25), 0 0 14px ${affinityColor}99`
            : `0 0 6px ${affinityColor}55`,
          pointerEvents: "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }} />

        {/* Pill avversario (casa/trasferta + 3 lettere) — top left */}
        <div style={{
          position: "absolute",
          top: -4, left: -4,
          display: "flex", alignItems: "center", gap: 2,
          padding: isField ? "3px 5px" : "2px 3px",
          borderRadius: 4,
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(4px)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
          zIndex: 1,
        }}>
          {player.nextIsHome
            ? <Home  size={isField ? 10 : 8} color="#fff" />
            : <Plane size={isField ? 10 : 8} color="#fff" />
          }
          {oppCode && (
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: isField ? 9 : 7,
              fontWeight: 600,
              color: "#fff",
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}>
              {oppCode}
            </span>
          )}
        </div>

        {/* Badge voto — top right */}
        <div style={{
          position: "absolute", top: -2, right: -2,
          width: VBADGE, height: VBADGE, borderRadius: "50%",
          background: hasVoto ? "#1f4733" : "rgba(0,0,0,0.45)",
          border: hasVoto ? "none" : "1px solid rgba(239,230,211,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: isField ? 8 : 7, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
            {hasVoto ? player.votoMister!.toFixed(1) : "—"}
          </span>
        </div>

        {/* Badge capitano — bottom right */}
        {isCaptain && (
          <div style={{
            position: "absolute", bottom: -2, right: -2,
            width: CBADGE, height: CBADGE, borderRadius: "50%",
            background: "#F4C430", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 800, color: "#333" }}>C</span>
          </div>
        )}
      </div>

      {/* Pill colori squadra (split left/right) */}
      <div style={{
        width: PILL_W, height: PILL_H, borderRadius: 6, overflow: "hidden",
        position: "relative", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
      }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: colors.primary }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", background: colors.secondary }} />
        <span style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: isField ? 9 : 7, fontWeight: 700,
          color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.8)", letterSpacing: "0.04em",
        }}>
          {code}
        </span>
      </div>

      {/* Cognome */}
      <span style={{
        fontSize: isField ? 11 : 10, fontWeight: 600,
        color: "rgba(239,230,211,0.92)", fontFamily: "var(--font-sans)",
        textAlign: "center", lineHeight: 1.2,
        maxWidth: Math.max(OUTER, PILL_W) + 8,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        textShadow: "0 1px 3px rgba(0,0,0,0.7)",
      }}>
        {name}
      </span>

      {/* Numero priorità (solo bench) */}
      {benchPriority !== undefined && (
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 500,
          color: "rgba(239,230,211,0.3)", lineHeight: 1, marginTop: -1,
        }}>
          {benchPriority}
        </span>
      )}
    </div>
  );
}

// ─── MiniCoachToken (dentro il pitch, area tecnica) ───────────────────────────

interface MiniCoachTokenProps {
  coach: HeadCoach;
}

function MiniCoachToken({ coach }: MiniCoachTokenProps) {
  const PHOTO = 34;
  const RING  = 2;
  const OUTER = PHOTO + RING * 2;

  const colors = TEAM_COLORS[coach.currentTeamName ?? ""] ?? { primary: "#444", secondary: "#888" };
  const code   = TEAM_CODE[coach.currentTeamName ?? ""] ?? "???";

  const shortName = (() => {
    const parts = coach.name.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    return last.length > 8 ? last.slice(0, 7) + "." : last;
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, pointerEvents: "none" }}>
      {/* MISTER pill */}
      <div style={{
        padding: "1px 5px", borderRadius: 2,
        background: "rgba(244,196,48,0.18)", border: "1px solid rgba(244,196,48,0.45)",
        fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 700,
        color: "#F4C430", letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1.4,
      }}>
        Mister
      </div>

      {/* Ring + foto */}
      <div style={{ position: "relative", width: OUTER, height: OUTER }}>
        <div style={{ position: "absolute", inset: RING, borderRadius: "50%", overflow: "hidden", background: "rgba(0,0,0,0.35)" }}>
          {coach.photoCartoonUrl && (
            <img
              src={coach.photoCartoonUrl} alt={coach.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: `${RING}px solid rgba(244,196,48,0.75)`,
          boxShadow: "0 0 6px rgba(244,196,48,0.22)",
          pointerEvents: "none",
        }} />
      </div>

      {/* Pill colori squadra */}
      <div style={{
        width: 28, height: 10, borderRadius: 3, overflow: "hidden",
        position: "relative", flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
      }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: colors.primary }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", background: colors.secondary }} />
        <span style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: 6, fontWeight: 700,
          color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.8)", letterSpacing: "0.04em",
        }}>
          {code}
        </span>
      </div>

      {/* Cognome */}
      <span style={{
        fontSize: 8, fontWeight: 600,
        color: "rgba(239,230,211,0.92)", fontFamily: "var(--font-sans)",
        textAlign: "center", lineHeight: 1.1,
        maxWidth: OUTER + 6,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        textShadow: "0 1px 3px rgba(0,0,0,0.7)",
      }}>
        {shortName}
      </span>
    </div>
  );
}

// ─── Pitch ───────────────────────────────────────────────────────────────────

interface PitchProps {
  modulo: string;
  fieldSlots: Record<string, number>;
  selection: Selection;
  captainId: number | null;
  onSlotClick: (slotId: string) => void;
  onSlotDoubleClick: (slotId: string) => void;
  coach?: HeadCoach | null;
}

function Pitch({ modulo, fieldSlots, selection, captainId, onSlotClick, onSlotDoubleClick, coach }: PitchProps) {
  const formation = parseFormation(modulo);
  const rowPositions = rowPositionsForFormation(formation);

  return (
    <div style={{
      position: "relative", width: "100%", aspectRatio: "5 / 7",
      borderRadius: "var(--r-lg) var(--r-lg) 0 0", overflow: "hidden",
      border: "1px solid rgba(239,230,211,0.12)", borderBottom: "none",
      userSelect: "none",
    }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 100 140" preserveAspectRatio="none">
        <defs>
          <pattern id="pitch-stripes" x="0" y="0" width="100" height="8.75" patternUnits="userSpaceOnUse">
            <rect x="0" y="0"     width="100" height="4.375" fill="#1f4733" />
            <rect x="0" y="4.375" width="100" height="4.375" fill="#234e38" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="100" height="140" fill="url(#pitch-stripes)" />
        {/* Campo verde — spostato a destra (~14%) per lasciare spazio all'area tecnica */}
        <rect x="14" y="5" width="81" height="130" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <line x1="14" y1="70" x2="95" y2="70" stroke="#ffffff" strokeWidth="0.6" />
        <circle cx="54.5" cy="70" r="11" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <circle cx="54.5" cy="70" r="0.8" fill="#ffffff" />
        {/* Area di rigore in alto */}
        <rect x="29" y="5" width="51" height="20" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <rect x="42" y="5" width="25" height="9" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <circle cx="54.5" cy="17" r="0.8" fill="#ffffff" />
        {/* Area di rigore in basso */}
        <rect x="29" y="115" width="51" height="20" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <rect x="42" y="126" width="25" height="9" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <circle cx="54.5" cy="123" r="0.8" fill="#ffffff" />
        {/* Area tecnica — 3 lati (aperta sul lato sinistro verso panchina), staccata dalla touchline */}
        <line x1="3" y1="28" x2="11" y2="28" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="4 3" />
        <line x1="3" y1="48" x2="11" y2="48" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="4 3" />
        <line x1="11" y1="28" x2="11" y2="48" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="4 3" />
      </svg>

      {/* MiniCoachToken — sovrapposto all'area tecnica (x 5%→14%, y 20%→34.3%) */}
      {coach && (
        <div style={{
          position: "absolute",
          left: "3%", top: "20%",
          width: "8%", height: "14.3%",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
          zIndex: 2,
        }}>
          <MiniCoachToken coach={coach} />
        </div>
      )}

      <div style={{ position: "absolute", inset: "4% 0" }}>
        {formation.map((slotsInRow, rowIdx) => {
          const topPct = rowPositions[rowIdx];
          const roleLabel = getRowLabel(rowIdx, formation.length);

          return (
            <div key={rowIdx} style={{
              position: "absolute", left: "16%", right: "7%", top: `${topPct}%`,
              transform: "translateY(-50%)",
              display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 10,
            }}>
              {Array.from({ length: slotsInRow }).map((_, slotIdx) => {
                const slotId = `${rowIdx}-${slotIdx}`;
                const playerId = fieldSlots[slotId];
                const player = playerId !== undefined ? PLAYER_BY_ID.get(playerId) : undefined;
                const isOccupied = player !== undefined;
                const isFieldSelected = selection?.kind === "field" && selection.slotId === slotId;
                const hasBenchSelected = selection?.kind === "bench";

                return (
                  <div
                    key={slotId}
                    onClick={() => onSlotClick(slotId)}
                    onDoubleClick={() => onSlotDoubleClick(slotId)}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") onSlotClick(slotId); }}
                    title={isOccupied ? `${player!.name} — doppio click per tornare in panchina` : `Slot ${roleLabel}`}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", flexShrink: 0, outline: "none" }}
                  >
                    {isOccupied ? (
                      <PlayerToken
                        player={player!} variant="field" affinityColor={AFFINITY_GREEN}
                        isCaptain={captainId === player!.id} isSelected={isFieldSelected}
                      />
                    ) : (
                      <div style={{
                        width: "clamp(72px, 9vh, 90px)", height: "clamp(72px, 9vh, 90px)",
                        borderRadius: "50%",
                        border: `2px dashed ${(isFieldSelected || hasBenchSelected) ? "rgba(239,230,211,0.8)" : "rgba(239,230,211,0.32)"}`,
                        background: (isFieldSelected || hasBenchSelected) ? "rgba(239,230,211,0.1)" : "rgba(239,230,211,0.04)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: isFieldSelected ? "0 0 0 3px rgba(74,222,128,0.4)" : "none",
                        transition: "box-shadow 0.15s, border-color 0.15s",
                      }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: (isFieldSelected || hasBenchSelected) ? "rgba(239,230,211,0.8)" : "rgba(239,230,211,0.38)", letterSpacing: "0.05em" }}>
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
  bench: number[];
  selection: Selection;
  onPlayerClick: (playerId: number) => void;
}

function Bench({ bench, selection, onPlayerClick }: BenchProps) {
  return (
    <div style={{ padding: "14px 10px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(239,230,211,0.12)" }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(239,230,211,0.4)", fontFamily: "var(--font-sans)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
          Panchina · {bench.length}
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(239,230,211,0.12)" }} />
      </div>

      {/* Flex-wrap: ~7-8 token per riga */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
        {bench.map((playerId, idx) => {
          const player = PLAYER_BY_ID.get(playerId);
          if (!player) return null;
          const isSelected = selection?.kind === "bench" && selection.playerId === playerId;

          return (
            <div
              key={playerId}
              onClick={() => onPlayerClick(playerId)}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") onPlayerClick(playerId); }}
              title={`${player.name} — panchina #${idx + 1}`}
              style={{ cursor: "pointer", outline: "none", minWidth: 76, display: "flex", justifyContent: "center" }}
            >
              <PlayerToken
                player={player} variant="bench"
                affinityColor={ROLE_RING[player.roleClassic]}
                isSelected={isSelected}
                benchPriority={idx + 1}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Riga giocatore nel roster ────────────────────────────────────────────────

interface PlayerRowProps {
  player: typeof ROSA_MARIO[0];
  statusLabel: string;
  statusColor: string;
  isCompatible: boolean;
  hasFieldSelected: boolean;
  hasBenchSelected: boolean;
  onClick: () => void;
}

function PlayerRow({ player, statusLabel, statusColor, isCompatible, hasFieldSelected, hasBenchSelected, onClick }: PlayerRowProps) {
  const badge = ROLE_BADGE[player.roleClassic];
  const isTitolare = statusLabel === "TIT";
  const clickable = !isTitolare && ((!hasFieldSelected && !hasBenchSelected) || isCompatible);

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 9, padding: "6px 12px",
        borderBottom: "1px solid var(--border)",
        cursor: clickable ? "pointer" : "default",
        opacity: hasFieldSelected && !isCompatible && !isTitolare ? 0.38 : 1,
        background: "transparent", transition: "background 0.1s, opacity 0.15s",
      }}
      onMouseEnter={(e) => { if (clickable) (e.currentTarget as HTMLDivElement).style.background = "var(--green-pale)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {(player.photoCartoonUrl ?? player.photoUrl) ? (
          <img src={player.photoCartoonUrl ?? player.photoUrl!} alt={player.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <span style={{ fontSize: 10, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>{player.name[0]}</span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {player.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 1 }}>
          <span style={{ fontSize: 10, color: "var(--ink-dim)" }}>{player.realTeam}</span>
          {player.nextOpponentShort && (
            <>
              <span style={{ fontSize: 10, color: "var(--ink-dim)" }}>·</span>
              {player.nextIsHome ? <Home size={9} style={{ color: "var(--ink-dim)" }} /> : <Plane size={9} style={{ color: "var(--ink-dim)" }} />}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "var(--ink-dim)" }}>{player.nextOpponentShort}</span>
            </>
          )}
        </div>
      </div>

      <span style={{ flexShrink: 0, padding: "1px 5px", borderRadius: "var(--r-sm)", background: badge.bg, color: "#fff", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.04em" }}>
        {badge.label}
      </span>

      <span style={{ flexShrink: 0, width: 32, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: player.votoMister !== null ? "var(--green-deep)" : "var(--ink-dim)" }}>
        {player.votoMister !== null ? player.votoMister.toFixed(2) : "—"}
      </span>

      <span style={{ flexShrink: 0, width: 30, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: statusColor }}>
        {statusLabel}
      </span>
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function FormazionePage() {
  const [modulo, setModulo] = useState("4-3-3");
  // Stato separato: slot campo + panchina (array ordinato)
  const [fieldSlots, setFieldSlots] = useState<Record<string, number>>({});
  const [bench, setBench] = useState<number[]>(initialBench);
  const [selection, setSelection] = useState<Selection>(null);
  const [manualRoleFilter, setManualRoleFilter] = useState<RoleFilter>("tutti");
  const [moduleChangeMsg, setModuleChangeMsg] = useState<string | null>(null);
  const captainId: number | null = null;

  const formation = useMemo(() => parseFormation(modulo), [modulo]);

  const starterCount = useMemo(() => Object.keys(fieldSlots).length, [fieldSlots]);

  // Ruolo richiesto dallo slot campo selezionato (per filtro roster)
  const selectedFieldSlotRole: RoleClassic | null = useMemo(() => {
    if (!selection || selection.kind !== "field") return null;
    return getSlotRole(selection.slotId, formation);
  }, [selection, formation]);

  const effectiveFilter: RoleFilter = selectedFieldSlotRole ?? manualRoleFilter;

  const filteredRosa = useMemo(() => {
    if (effectiveFilter === "tutti") return ROSA_MARIO;
    return ROSA_MARIO.filter(p => p.roleClassic === effectiveFilter);
  }, [effectiveFilter]);

  // Mappa inversa: playerId → posizione in campo (per status)
  const fieldPlayerIdx = useMemo(() => {
    const m = new Map<number, string>();
    for (const [slotId, pid] of Object.entries(fieldSlots)) m.set(pid, slotId);
    return m;
  }, [fieldSlots]);

  // Mappa inversa: playerId → posizione in panchina (per status)
  const benchPlayerIdx = useMemo(() => {
    const m = new Map<number, number>();
    bench.forEach((pid, i) => m.set(pid, i + 1));
    return m;
  }, [bench]);

  // ── Cambio modulo ────────────────────────────────────────────────────────────
  function handleModuloChange(newModulo: string) {
    if (newModulo === modulo) return;
    const { newFieldSlots, newBench, message } = migrateLineup(
      fieldSlots, bench, formation, parseFormation(newModulo),
    );
    setModulo(newModulo);
    setFieldSlots(newFieldSlots);
    setBench(newBench);
    setSelection(null);
    setModuleChangeMsg(message);
    setTimeout(() => setModuleChangeMsg(null), 3500);
  }

  // ── Click su slot campo ───────────────────────────────────────────────────────
  function handleFieldSlotClick(slotId: string) {
    // Deseleziona stesso
    if (selection?.kind === "field" && selection.slotId === slotId) {
      setSelection(null); return;
    }

    if (selection === null) {
      setSelection({ kind: "field", slotId }); return;
    }

    if (selection.kind === "bench") {
      // Bench player → questo slot campo
      const pid = selection.playerId;
      const player = PLAYER_BY_ID.get(pid)!;
      const requiredRole = getSlotRole(slotId, formation);
      if (player.roleClassic !== requiredRole) {
        // Ruolo incompatibile: reseleziona il nuovo slot campo vuoto
        if (fieldSlots[slotId] === undefined) {
          setSelection({ kind: "field", slotId });
        }
        return;
      }
      const oldOccupant = fieldSlots[slotId];
      setFieldSlots(prev => ({ ...prev, [slotId]: pid }));
      setBench(prev => {
        const next = prev.filter(id => id !== pid);
        if (oldOccupant !== undefined) next.push(oldOccupant);
        return next;
      });
      setSelection(null); return;
    }

    if (selection.kind === "field") {
      const srcSlot = selection.slotId;
      const srcPid  = fieldSlots[srcSlot];
      const dstPid  = fieldSlots[slotId];
      if (srcPid !== undefined) {
        // Sposta o scambia
        setFieldSlots(prev => {
          const next = { ...prev };
          if (dstPid !== undefined) {
            next[srcSlot] = dstPid;
            next[slotId]  = srcPid;
          } else {
            delete next[srcSlot];
            next[slotId] = srcPid;
          }
          return next;
        });
        setSelection(null);
      } else {
        // Sorgente vuota: reseleziona destinazione
        setSelection({ kind: "field", slotId });
      }
    }
  }

  // ── Doppio click su slot campo → torna in panchina ───────────────────────────
  function handleFieldSlotDoubleClick(slotId: string) {
    const pid = fieldSlots[slotId];
    if (pid === undefined) return;
    setFieldSlots(prev => { const n = { ...prev }; delete n[slotId]; return n; });
    setBench(prev => [...prev, pid]);
    if (selection?.kind === "field" && selection.slotId === slotId) setSelection(null);
  }

  // ── Click su giocatore in panchina ────────────────────────────────────────────
  function handleBenchPlayerClick(playerId: number) {
    if (selection?.kind === "bench" && selection.playerId === playerId) {
      setSelection(null); return;
    }

    if (selection === null) {
      setSelection({ kind: "bench", playerId }); return;
    }

    if (selection.kind === "bench") {
      // Swap posizioni in panchina
      const selPid = selection.playerId;
      setBench(prev => {
        const next = [...prev];
        const a = next.indexOf(selPid);
        const b = next.indexOf(playerId);
        if (a !== -1 && b !== -1) { [next[a], next[b]] = [next[b], next[a]]; }
        return next;
      });
      setSelection(null); return;
    }

    if (selection.kind === "field") {
      // Bench player → slot campo selezionato
      const slotId = selection.slotId;
      const player = PLAYER_BY_ID.get(playerId)!;
      const requiredRole = getSlotRole(slotId, formation);
      if (player.roleClassic !== requiredRole) {
        // Incompatibile: seleziona il bench player
        setSelection({ kind: "bench", playerId }); return;
      }
      const oldOccupant = fieldSlots[slotId];
      setFieldSlots(prev => ({ ...prev, [slotId]: playerId }));
      setBench(prev => {
        const next = prev.filter(id => id !== playerId);
        if (oldOccupant !== undefined) next.push(oldOccupant);
        return next;
      });
      setSelection(null);
    }
  }

  // ── Click su giocatore nel roster (vista secondaria) ─────────────────────────
  function handleRosterPlayerClick(playerId: number) {
    // Agisce solo se c'è uno slot campo selezionato e il giocatore è in panchina
    if (!benchPlayerIdx.has(playerId)) return;
    if (selection === null) {
      setSelection({ kind: "bench", playerId }); return;
    }
    if (selection.kind === "field") {
      handleBenchPlayerClick(playerId);
    }
  }

  const hasFieldSelected = selection?.kind === "field";
  const hasBenchSelected = selection?.kind === "bench";
  const { avversario, fieldStatus } = MATCH_GIORNATA_2;
  const salvaEnabled = starterCount === 11;

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
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-card)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label htmlFor="modulo-select" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-mid)", whiteSpace: "nowrap" }}>Modulo</label>
          <select
            id="modulo-select" value={modulo}
            onChange={e => handleModuloChange(e.target.value)}
            style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--ink)", background: "var(--paper)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", padding: "4px 8px", cursor: "pointer", outline: "none" }}
          >
            {MODULI.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />

        <div style={{ fontSize: 13, color: "var(--ink-mid)" }}>
          Titolari:{" "}
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: starterCount === 11 ? "var(--green-deep)" : "var(--ink)" }}>{starterCount}</span>
          <span style={{ color: "var(--ink-dim)" }}>/11</span>
        </div>

        <div style={{ fontSize: 13, color: "var(--ink-mid)" }}>
          Voto previsto: <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-dim)" }}>—</span>
        </div>

        {moduleChangeMsg && (
          <div style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(45,107,79,0.1)", border: "1px solid var(--green-mid)", fontSize: 12, color: "var(--green-deep)" }}>
            {moduleChangeMsg}
          </div>
        )}

        {selection !== null && (
          <div style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.4)", fontSize: 12, color: "var(--green-deep)", fontWeight: 500 }}>
            {selection.kind === "bench"
              ? `${lastName(PLAYER_BY_ID.get(selection.playerId)?.name ?? "")} selezionato — scegli uno slot`
              : <>Slot <strong style={{ fontFamily: "var(--font-mono)" }}>{selectedFieldSlotRole && ROLE_BADGE[selectedFieldSlotRole].label}</strong> — scegli dalla panchina</>
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
            onClick={() => { setFieldSlots({}); setBench(initialBench()); setSelection(null); }}
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
            fieldSlots={fieldSlots}
            selection={selection}
            captainId={captainId}
            onSlotClick={handleFieldSlotClick}
            onSlotDoubleClick={handleFieldSlotDoubleClick}
            coach={COACH_MARIO}
          />
          <Bench
            bench={bench}
            selection={selection}
            onPlayerClick={handleBenchPlayerClick}
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
                onClick={() => { if (!hasFieldSelected) setManualRoleFilter(rf.value); }}
                style={{
                  padding: "3px 10px", borderRadius: 99, border: "1px solid",
                  borderColor: effectiveFilter === rf.value ? "var(--green-deep)" : "var(--border-strong)",
                  background: effectiveFilter === rf.value ? "var(--green-deep)" : "transparent",
                  color: effectiveFilter === rf.value ? "#fff" : "var(--ink-mid)",
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                  cursor: hasFieldSelected ? "default" : "pointer",
                  opacity: hasFieldSelected && effectiveFilter !== rf.value ? 0.38 : 1,
                  transition: "all 0.12s",
                }}
              >
                {rf.label}
              </button>
            ))}
          </div>

          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 300px)", minHeight: 300 }}>
            {filteredRosa.map(player => {
              const panIdx = benchPlayerIdx.get(player.id);
              const isTit = fieldPlayerIdx.has(player.id);
              const statusLabel = isTit ? "TIT" : panIdx !== undefined ? `#${panIdx}` : "—";
              const statusColor = isTit ? "#4ade80" : "rgba(239,230,211,0.45)";
              const isCompatible = !hasFieldSelected || player.roleClassic === selectedFieldSlotRole;

              return (
                <PlayerRow
                  key={player.id}
                  player={player}
                  statusLabel={statusLabel}
                  statusColor={statusColor}
                  isCompatible={isCompatible}
                  hasFieldSelected={!!hasFieldSelected}
                  hasBenchSelected={!!hasBenchSelected}
                  onClick={() => handleRosterPlayerClick(player.id)}
                />
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) { .formazione-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
