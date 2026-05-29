import { useState, useMemo, useRef, useEffect } from "react";
import { Home, Plane, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetLineups,
  usePutLineup,
  getGetLineupsQueryKey,
  useGetRoster,
  type RosterPlayer,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  MY_TEAM_INFO, MATCH_GIORNATA_2, TEAM_CODE, TEAM_COLORS, TEAM_LOGO_URL, COACH_MARIO,
  type HeadCoach,
} from "./team-constants";
import { MatchView } from "./MatchView";

// ─── Tipi locali ──────────────────────────────────────────────────────────────

type RoleClassic = "GK" | "DEF" | "MID" | "ATT";

type LocalRosterPlayer = {
  id: number;
  name: string;
  realTeam: string;
  roleClassic: RoleClassic;
  photoUrl: string | null;
  photoCartoonUrl: string | null;
  votoMister: number | null;
  colors: { primary: string; secondary: string };
  teamCode: string;
  logoUrl: string | null;
  opponentCode: string | null;
  opponentIsHome: boolean | null;
};

function adaptPlayer(p: RosterPlayer): LocalRosterPlayer {
  const teamName = p.realTeamName ?? "";
  return {
    id: p.id,
    name: p.name,
    realTeam: teamName,
    roleClassic: p.roleClassic as RoleClassic,
    photoUrl: p.photoUrl,
    photoCartoonUrl: p.photoCartoonUrl,
    votoMister: p.votoMister,
    colors: {
      primary: p.realTeamColorPrimary ?? "#444",
      secondary: p.realTeamColorSecondary ?? "#888",
    },
    teamCode: TEAM_CODE[teamName] ?? "???",
    logoUrl: p.logoUrl ?? null,
    opponentCode: p.opponentCode ?? null,
    opponentIsHome: p.opponentIsHome ?? null,
  };
}

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

// Colori per i badge filtro ruolo (inattivo / attivo) — multi-selezione, no "tutti"
const ROLE_FILTER_COLORS: Record<RoleClassic, { bg: string; bgActive: string; border: string; text: string }> = {
  GK:   { bg: "rgba(122,80,18,0.18)",    bgActive: "#7a5012",           border: "rgba(122,80,18,0.55)", text: "#8c6220" },
  DEF:  { bg: "rgba(26,61,43,0.22)",     bgActive: "#1a3d2b",           border: "rgba(26,61,43,0.55)",  text: "#2d6b4f" },
  MID:  { bg: "rgba(25,48,92,0.22)",     bgActive: "#19305c",           border: "rgba(25,48,92,0.6)",   text: "#2a4a8c" },
  ATT:  { bg: "rgba(107,31,31,0.22)",    bgActive: "#6b1f1f",           border: "rgba(107,31,31,0.55)", text: "#8b2c2c" },
};

// Background colorato per riga del roster — leggermente desaturati per non essere "loud"
const ROLE_ROW_BG: Record<RoleClassic, string> = {
  GK:  "#7a5012",
  DEF: "#1a3d2b",
  MID: "#19305c",
  ATT: "#6b1f1f",
};

const ROLE_FILTERS: { label: string; value: RoleClassic }[] = [
  { label: "P", value: "GK"  },
  { label: "D", value: "DEF" },
  { label: "C", value: "MID" },
  { label: "A", value: "ATT" },
];

// ─── Selezione attiva ─────────────────────────────────────────────────────────

type Selection =
  | { kind: "field";  slotId: string }
  | { kind: "roster"; rosterIdx: number; playerId: number }
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
  // Orientamento: ATT in alto (~22%), P in basso (~91%)
  if (n === 4) return [91, 70, 45, 22];
  if (n === 5) return [91, 75, 58, 42, 22];
  return formation.map((_, i) => 91 - (i / (n - 1)) * 69);
}

// ─── Helpers payload API ──────────────────────────────────────────────────────

/** Mappa slotIndex (1-11) → slotId campo (es. "2-1") dalla formazione */
function buildSlotIndexToSlotId(formation: number[]): Map<number, string> {
  const map = new Map<number, string>();
  let idx = 1;
  formation.forEach((count, rowIdx) => {
    for (let si = 0; si < count; si++) {
      map.set(idx, `${rowIdx}-${si}`);
      idx++;
    }
  });
  return map;
}

function labelToSlotPosition(label: string): "GK" | "DEF" | "MID" | "T" | "ATT" {
  switch (label) {
    case "P": return "GK";
    case "D": return "DEF";
    case "T": return "T";
    case "A": return "ATT";
    default:  return "MID";
  }
}

function roleToSlotPosition(role: RoleClassic): "GK" | "DEF" | "MID" | "T" | "ATT" {
  switch (role) {
    case "GK":  return "GK";
    case "DEF": return "DEF";
    case "ATT": return "ATT";
    default:    return "MID";
  }
}

function buildPutPayload(
  modulo: string,
  fieldSlots: Record<string, number>,
  roster: number[],
  captainPlayerId: number | null,
  formation: number[],
  playerById: Map<number, LocalRosterPlayer>,
) {
  type SlotPos = "GK" | "DEF" | "MID" | "T" | "ATT";
  const players: Array<{
    playerId: number;
    slotPosition: SlotPos;
    slotIndex: number;
    isStarter: boolean;
    benchOrder: number | null;
  }> = [];

  let slotIndex = 1;
  formation.forEach((count, rowIdx) => {
    const label = getRowLabel(rowIdx, formation.length);
    const slotPosition = labelToSlotPosition(label);
    for (let si = 0; si < count; si++) {
      const playerId = fieldSlots[`${rowIdx}-${si}`];
      if (playerId !== undefined) {
        players.push({ playerId, slotPosition, slotIndex, isStarter: true, benchOrder: null });
      }
      slotIndex++;
    }
  });

  roster.forEach((playerId, idx) => {
    const player = playerById.get(playerId);
    if (!player) return;
    players.push({
      playerId,
      slotPosition: roleToSlotPosition(player.roleClassic),
      slotIndex: 12 + idx,
      isStarter: false,
      benchOrder: idx + 1,
    });
  });

  return {
    fantaTeamId: "ft-mvp-1" as const,
    season: 2024,
    round: 2,
    module: modulo,
    captainPlayerId,
    players,
  };
}

// ─── Migrazione lineup al cambio modulo ──────────────────────────────────────

function migrateLineup(
  oldFieldSlots: Record<string, number>,
  oldRoster: number[],
  oldFormation: number[],
  newFormation: number[],
): { newFieldSlots: Record<string, number>; newRoster: number[]; message: string } {
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

  const newRoster = [...oldRoster, ...surplus];
  const titolariCount = Object.keys(newSlots).length;
  let message = `Modulo cambiato. ${titolariCount} giocatori mantenuti`;
  if (surplus.length > 0) message += `, ${surplus.length} in lista`;
  return { newFieldSlots: newSlots, newRoster, message: message + "." };
}

// ─── PlayerToken ──────────────────────────────────────────────────────────────

interface PlayerTokenProps {
  player: LocalRosterPlayer;
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

  const colors = player.colors;
  const code   = player.teamCode;
  const hasVoto = player.votoMister !== null;
  const name = lastName(player.name);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: isField ? 5 : 3 }}>
      {/* ── Ring + foto + badge sovrapposti ── */}
      <div style={{ position: "relative", width: OUTER, height: OUTER, flexShrink: 0 }}>
        {/* Foto */}
        <div style={{ position: "absolute", inset: RING, borderRadius: "50%", overflow: "hidden", background: "var(--token-avatar-bg, #2d5848)" }}>
          {(player.photoCartoonUrl ?? player.photoUrl) && (
            <img
              src={player.photoCartoonUrl ?? player.photoUrl!} alt={player.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.08)", transformOrigin: "center" }}
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

      {/* Pill colori squadra (split left/right) + logo */}
      <div style={{
        width: PILL_W, height: PILL_H, borderRadius: 6, overflow: "hidden",
        position: "relative", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
      }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: colors.primary }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", background: colors.secondary }} />
        {player.logoUrl ? (
          <img
            src={player.logoUrl} alt={code}
            style={{ position: "absolute", inset: 0, margin: "auto", width: isField ? 12 : 9, height: isField ? 12 : 9, objectFit: "contain", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <span style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-mono)", fontSize: isField ? 9 : 7, fontWeight: 700,
            color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.8)", letterSpacing: "0.04em",
          }}>
            {code}
          </span>
        )}
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

      {/* Pill avversario */}
      {player.opponentCode && (
        <div style={{
          display: "flex", alignItems: "center", gap: 2,
          padding: isField ? "2px 5px" : "1px 4px",
          borderRadius: 3,
          background: "rgba(0,0,0,0.62)",
          backdropFilter: "blur(4px)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.45)",
        }}>
          {player.opponentIsHome
            ? <Home  size={isField ? 8 : 7} color="rgba(239,230,211,0.75)" />
            : <Plane size={isField ? 8 : 7} color="rgba(239,230,211,0.75)" />}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: isField ? 8 : 7, fontWeight: 600, color: "rgba(239,230,211,0.85)", lineHeight: 1, letterSpacing: "0.04em" }}>
            {player.opponentCode}
          </span>
        </div>
      )}

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
  avversario?: string;
  nextIsHome?: boolean;
}

function MiniCoachToken({ coach, avversario, nextIsHome }: MiniCoachTokenProps) {
  const PHOTO  = 72;
  const RING   = 3;
  const OUTER  = PHOTO + RING * 2;
  const PILL_W = 66;
  const PILL_H = 16;

  const teamKey = coach.currentTeamName ?? "";
  const colors  = TEAM_COLORS[teamKey] ?? { primary: "#444", secondary: "#888" };
  const code    = TEAM_CODE[teamKey] ?? "???";
  const logoUrl = TEAM_LOGO_URL[teamKey];

  const shortName = (() => {
    const parts = coach.name.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    return last.length > 9 ? last.slice(0, 8) + "." : last;
  })();

  const oppCode = avversario
    ? avversario.trim().split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 3)
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, pointerEvents: "none" }}>
      {/* Ring + foto (stessa struttura di PlayerToken field) */}
      <div style={{ position: "relative", width: OUTER, height: OUTER, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: RING, borderRadius: "50%", overflow: "hidden", background: "var(--token-avatar-bg, #2d5848)" }}>
          {coach.photoCartoonUrl && (
            <img
              src={coach.photoCartoonUrl} alt={coach.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.08)", transformOrigin: "center" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>
        {/* Ring dorato (distingue il mister dai giocatori) */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: `${RING}px solid rgba(244,196,48,0.75)`,
          boxShadow: "0 0 8px rgba(244,196,48,0.25)",
          pointerEvents: "none",
        }} />
        {/* Pill avversario — top left */}
        {oppCode && (
          <div style={{
            position: "absolute", top: -4, left: -4,
            display: "flex", alignItems: "center", gap: 2,
            padding: "3px 5px", borderRadius: 4,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(4px)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
            zIndex: 1,
          }}>
            {nextIsHome !== undefined && (
              nextIsHome
                ? <Home  size={10} color="#fff" />
                : <Plane size={10} color="#fff" />
            )}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "#fff", letterSpacing: "0.02em", lineHeight: 1 }}>
              {oppCode}
            </span>
          </div>
        )}
      </div>

      {/* Pill bicolor con logo — stesso formato PlayerToken field */}
      <div style={{
        width: PILL_W, height: PILL_H, borderRadius: 6, overflow: "hidden",
        position: "relative", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
      }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: colors.primary }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", background: colors.secondary }} />
        {logoUrl ? (
          <img
            src={logoUrl} alt={code}
            style={{ position: "absolute", inset: 0, margin: "auto", width: 12, height: 12, objectFit: "contain", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.8)", letterSpacing: "0.04em" }}>
            {code}
          </span>
        )}
      </div>

      {/* Cognome */}
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: "rgba(239,230,211,0.92)", fontFamily: "var(--font-sans)",
        textAlign: "center", lineHeight: 1.2,
        maxWidth: Math.max(OUTER, PILL_W) + 8,
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
  playerById: Map<number, LocalRosterPlayer>;
  selection: Selection;
  captainId: number | null;
  onSlotClick: (slotId: string) => void;
  onSlotDoubleClick: (slotId: string) => void;
  coach?: HeadCoach | null;
  avversario?: string;
  nextIsHome?: boolean;
  fieldRoles?: Set<RoleClassic>;
  fieldTeams?: Set<string>;
}

function Pitch({ modulo, fieldSlots, playerById, selection, captainId, onSlotClick, onSlotDoubleClick, coach, avversario, nextIsHome, fieldRoles = new Set<RoleClassic>(), fieldTeams = new Set<string>() }: PitchProps) {
  const formation = parseFormation(modulo);
  const rowPositions = rowPositionsForFormation(formation);

  const isFilterActive = fieldRoles.size > 0 || fieldTeams.size > 0;
  const playerMatchesFilter = (p: LocalRosterPlayer) =>
    (fieldRoles.size === 0 || fieldRoles.has(p.roleClassic)) &&
    (fieldTeams.size === 0 || fieldTeams.has(p.realTeam));

  return (
    <div style={{
      position: "relative", width: "100%", height: "100%",
      borderRadius: "var(--r-lg)", overflow: "hidden",
      border: "1px solid rgba(239,230,211,0.12)",
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
        {/* Campo verde — bordo sinistro a x=18 */}
        <rect x="18" y="5" width="77" height="130" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <line x1="18" y1="70" x2="95" y2="70" stroke="#ffffff" strokeWidth="0.6" />
        <circle cx="56.5" cy="70" r="11" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <circle cx="56.5" cy="70" r="0.8" fill="#ffffff" />
        {/* Area di rigore in alto */}
        <rect x="31" y="5" width="51" height="20" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <rect x="44" y="5" width="25" height="9" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <circle cx="56.5" cy="17" r="0.8" fill="#ffffff" />
        {/* Area di rigore in basso */}
        <rect x="31" y="115" width="51" height="20" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <rect x="44" y="126" width="25" height="9" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <circle cx="56.5" cy="123" r="0.8" fill="#ffffff" />
        {/* Archi D delle aree di rigore — sweep=0 → centro sul dischetto, arco verso centrocampo; corda +30% */}
        <path d="M 47 25 A 12.5 12.5 0 0 0 66 25"   fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <path d="M 66 115 A 12.5 12.5 0 0 0 47 115"  fill="none" stroke="#ffffff" strokeWidth="0.6" />
        {/* Archi d'angolo — sweep=0 → centro sul vertice del campo, arco dentro il campo (r≈1m) */}
        <path d="M 18 6.25 A 1.25 1.25 0 0 0 19.25 5"    fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <path d="M 93.75 5 A 1.25 1.25 0 0 0 95 6.25"    fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <path d="M 19.25 135 A 1.25 1.25 0 0 0 18 133.75" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <path d="M 95 133.75 A 1.25 1.25 0 0 0 93.75 135" fill="none" stroke="#ffffff" strokeWidth="0.6" />
        {/* Area tecnica — ampliata: x=0→16, y=85→119; 5 tratti sui lati corti, 10 sul lato lungo */}
        <line x1="0" y1="85"  x2="16" y2="85"  stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.4" />
        <line x1="0" y1="119" x2="16" y2="119" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.4" />
        <line x1="16" y1="85" x2="16" y2="119" stroke="#ffffff" strokeWidth="0.6" strokeDasharray="1.8 1.6" />
        {/* Marcatori angolari ai 2 vertici dell'area tecnica — L solida sul bordo */}
        <polyline points="14,85 16,85 16,87"   fill="none" stroke="#ffffff" strokeWidth="0.6" />
        <polyline points="14,119 16,119 16,117" fill="none" stroke="#ffffff" strokeWidth="0.6" />
      </svg>

      {/* MiniCoachToken — area tecnica ampliata: x=0→16%, y=60.7→85% */}
      {coach && (
        <div style={{
          position: "absolute",
          left: "0%", top: "60%",
          width: "16%", height: "26%",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
          zIndex: 2,
        }}>
          <MiniCoachToken coach={coach} avversario={avversario} nextIsHome={nextIsHome} />
        </div>
      )}

      <div style={{ position: "absolute", inset: "4% 0" }}>
        {formation.map((slotsInRow, rowIdx) => {
          const topPct = rowPositions[rowIdx];
          const roleLabel = getRowLabel(rowIdx, formation.length);

          return (
            <div key={rowIdx} style={{
              position: "absolute", left: "19%", right: "5%", top: `${topPct}%`,
              transform: "translateY(-50%)",
              display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 10,
            }}>
              {Array.from({ length: slotsInRow }).map((_, slotIdx) => {
                const slotId = `${rowIdx}-${slotIdx}`;
                const playerId = fieldSlots[slotId];
                const player = playerId !== undefined ? playerById.get(playerId) : undefined;
                const isOccupied = player !== undefined;
                const isFieldSelected = selection?.kind === "field" && selection.slotId === slotId;
                const hasRosterSelected = selection?.kind === "roster";
                const isFilteredOut = isFilterActive && isOccupied && !playerMatchesFilter(player!);

                return (
                  <div
                    key={slotId}
                    onClick={() => onSlotClick(slotId)}
                    onDoubleClick={() => onSlotDoubleClick(slotId)}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") onSlotClick(slotId); }}
                    title={isOccupied ? `${player!.name} — doppio click per togliere` : `Slot ${roleLabel}`}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      cursor: "pointer", flexShrink: 0, outline: "none",
                      opacity: isFilteredOut ? 0.18 : 1,
                      transition: "opacity 0.18s",
                    }}
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
                        border: `2px dashed ${(isFieldSelected || hasRosterSelected) ? "rgba(239,230,211,0.8)" : "rgba(239,230,211,0.32)"}`,
                        background: (isFieldSelected || hasRosterSelected) ? "rgba(239,230,211,0.1)" : "rgba(239,230,211,0.04)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: isFieldSelected ? "0 0 0 3px rgba(74,222,128,0.4)" : "none",
                        transition: "box-shadow 0.15s, border-color 0.15s",
                      }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: (isFieldSelected || hasRosterSelected) ? "rgba(239,230,211,0.8)" : "rgba(239,230,211,0.38)", letterSpacing: "0.05em" }}>
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

// ─── Riga giocatore nel roster ────────────────────────────────────────────────

interface PlayerRowProps {
  player: LocalRosterPlayer;
  priority: number;
  isSelected: boolean;
  isCompatible: boolean;
  hasFieldSelected: boolean;
  onClick: () => void;
}

function PlayerRow({ player, isSelected, isCompatible, hasFieldSelected, onClick }: PlayerRowProps) {
  const bg = ROLE_ROW_BG[player.roleClassic];
  const dimmed = hasFieldSelected && !isCompatible;
  const colors = player.colors;
  const code = player.teamCode;
  const logoUrl = player.logoUrl;

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "stretch",
        borderRadius: 8,
        border: isSelected ? "2px solid rgba(255,255,255,0.72)" : "2px solid transparent",
        cursor: "pointer",
        opacity: dimmed ? 0.32 : 1,
        background: bg,
        overflow: "hidden",
        transition: "opacity 0.15s, filter 0.1s",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!dimmed) (e.currentTarget as HTMLDivElement).style.filter = "brightness(1.15)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.filter = "none";
      }}
    >
      {/* ── Banda verticale sinistra: colori squadra + logo/sigla ── */}
      <div style={{ width: 22, flexShrink: 0, position: "relative", overflow: "hidden" }}>
        {/* Metà superiore: colore primario */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", background: colors.primary }} />
        {/* Metà inferiore: colore secondario */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%", background: colors.secondary }} />
        {/* Logo squadra (o sigla verticale come fallback) */}
        {logoUrl ? (
          <img
            src={logoUrl} alt={code}
            style={{
              position: "absolute", inset: 0, margin: "auto",
              width: 16, height: 16, objectFit: "contain",
              filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.85))",
            }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            writingMode: "vertical-rl", transform: "rotate(180deg)",
            fontFamily: "var(--font-mono)", fontSize: 6, fontWeight: 800,
            color: "rgba(255,255,255,0.92)",
            textShadow: "0 1px 2px rgba(0,0,0,0.9)",
            letterSpacing: "0.14em",
          }}>
            {code}
          </div>
        )}
      </div>

      {/* ── Contenuto: foto + nome + avversario + voto — tutto su una riga ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 8px 5px 7px", flex: 1, minWidth: 0 }}>
        {/* Foto con ring verde affinità */}
        <div style={{ position: "relative", width: 34, height: 34, flexShrink: 0 }}>
          <div style={{
            position: "absolute", inset: 1, borderRadius: "50%",
            overflow: "hidden", background: "rgba(0,0,0,0.4)",
          }}>
            {(player.photoCartoonUrl ?? player.photoUrl) ? (
              <img
                src={player.photoCartoonUrl ?? player.photoUrl!} alt={player.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 10, color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-mono)" }}>
                {player.name[0]}
              </span>
            )}
          </div>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: `2px solid ${AFFINITY_GREEN}`,
            pointerEvents: "none",
          }} />
        </div>

        {/* Nome */}
        <div style={{
          flex: 1, minWidth: 0,
          fontSize: 12, fontWeight: 500, color: "#fff",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          lineHeight: 1,
        }}>
          {lastName(player.name)}
        </div>

        {/* Pill avversario */}
        {player.opponentCode && (
          <div style={{
            display: "flex", alignItems: "center", gap: 2,
            padding: "1px 4px", borderRadius: 3, flexShrink: 0,
            background: "rgba(0,0,0,0.45)",
          }}>
            {player.opponentIsHome
              ? <Home  size={8} color="rgba(239,230,211,0.65)" />
              : <Plane size={8} color="rgba(239,230,211,0.65)" />}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "rgba(239,230,211,0.75)", lineHeight: 1, letterSpacing: "0.04em" }}>
              {player.opponentCode}
            </span>
          </div>
        )}

        {/* Voto */}
        <span style={{
          flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
          color: player.votoMister !== null ? "#4ade80" : "rgba(255,255,255,0.28)",
        }}>
          {player.votoMister !== null ? player.votoMister.toFixed(1) : "—"}
        </span>
      </div>
    </div>
  );
}

// ─── JerseyIcon — maglia stilizzata SVG ───────────────────────────────────────

function JerseyIcon({ primary, secondary, size = 24 }: { primary: string; secondary: string; size?: number }) {
  return (
    <svg viewBox="0 0 20 22" width={size} height={Math.round(size * 22 / 20)} style={{ flexShrink: 0, display: "block" }}>
      {/* Corpo + maniche */}
      <path d="M4,7 L0,11 L4,13.5 L4,21 L16,21 L16,13.5 L20,11 L16,7 C15,10 5,10 4,7 Z" fill={primary} />
      {/* Colletto */}
      <path d="M4,7 C5,10 15,10 16,7 C15,5 13,4 10,4 C7,4 5,5 4,7 Z" fill={secondary} />
    </svg>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

const LINEUP_PARAMS = { fantaTeamId: "ft-mvp-1", season: 2024, round: 2 } as const;

export default function FormazionePage() {
  const [modulo, setModulo] = useState("4-3-3");
  const [fieldSlots, setFieldSlots] = useState<Record<string, number>>({});
  const [roster, setRoster] = useState<number[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [selectedRoles, setSelectedRoles] = useState<Set<RoleClassic>>(new Set());
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [moduleChangeMsg, setModuleChangeMsg] = useState<string | null>(null);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'builder' | 'match'>('builder');

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: lineupData, isLoading: lineupLoading } = useGetLineups(LINEUP_PARAMS);
  const { data: rosterData, isLoading: rosterLoading } = useGetRoster({ fantaTeamId: "ft-mvp-1", season: 2024, round: 2 });
  const saveMutation = usePutLineup();

  const allPlayers = useMemo(() => (rosterData ?? []).map(adaptPlayer), [rosterData]);
  const playerById = useMemo(() => new Map(allPlayers.map(p => [p.id, p])), [allPlayers]);

  // Hydra stato da API al primo caricamento — non si riesegue dopo modifiche locali
  const hasHydrated = useRef(false);
  useEffect(() => {
    if (hasHydrated.current || lineupData === undefined || allPlayers.length === 0) return;
    hasHydrated.current = true;
    if (lineupData === null) {
      // nessun lineup salvato — init roster dalla rosa completa, ordinata per ruolo poi nome
      const ROLE_PRIO: Record<RoleClassic, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 };
      setRoster([...allPlayers]
        .sort((a, b) => {
          const d = ROLE_PRIO[a.roleClassic] - ROLE_PRIO[b.roleClassic];
          return d !== 0 ? d : a.name.localeCompare(b.name);
        })
        .map(p => p.id),
      );
      return;
    }
    const savedFormation = parseFormation(lineupData.module);
    setModulo(lineupData.module);
    setCaptainId(lineupData.captainPlayerId ?? null);
    const slotMap = buildSlotIndexToSlotId(savedFormation);
    const newFieldSlots: Record<string, number> = {};
    for (const p of lineupData.players) {
      if (p.isStarter) {
        const slotId = slotMap.get(p.slotIndex);
        if (slotId) newFieldSlots[slotId] = p.playerId;
      }
    }
    setFieldSlots(newFieldSlots);
    const bench = lineupData.players
      .filter(p => !p.isStarter)
      .sort((a, b) => (a.benchOrder ?? 999) - (b.benchOrder ?? 999));
    setRoster(bench.map(p => p.playerId));
  }, [lineupData, allPlayers]);

  const formation = useMemo(() => parseFormation(modulo), [modulo]);
  const starterCount = useMemo(() => Object.keys(fieldSlots).length, [fieldSlots]);

  // Ruolo richiesto dallo slot campo selezionato
  const selectedFieldSlotRole: RoleClassic | null = useMemo(() => {
    if (!selection || selection.kind !== "field") return null;
    return getSlotRole(selection.slotId, formation);
  }, [selection, formation]);

  const effectiveRoles: Set<RoleClassic> = selectedFieldSlotRole
    ? new Set([selectedFieldSlotRole])
    : selectedRoles;

  // Mappa inversa: playerId → slotId (per sapere chi è in campo)
  const fieldPlayerIdx = useMemo(() => {
    const m = new Map<number, string>();
    for (const [slotId, pid] of Object.entries(fieldSlots)) m.set(pid, slotId);
    return m;
  }, [fieldSlots]);

  // Logo per squadra — ricavato dall'elenco dei giocatori
  const teamLogoUrl = useMemo(() => {
    const m = new Map<string, string>();
    allPlayers.forEach(p => { if (p.logoUrl && !m.has(p.realTeam)) m.set(p.realTeam, p.logoUrl); });
    return m;
  }, [allPlayers]);

  // Conteggio ruoli nel roster (per i filtri)
  const rosterRoleCounts = useMemo(() => {
    const counts: Record<RoleClassic, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
    roster.forEach(pid => {
      const p = playerById.get(pid);
      if (p) counts[p.roleClassic]++;
    });
    return counts;
  }, [roster, playerById]);

  // Squadre uniche nella rosa (ordine prima apparizione)
  const uniqueTeams = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    allPlayers.forEach(p => { if (!seen.has(p.realTeam)) { seen.add(p.realTeam); result.push(p.realTeam); } });
    return result;
  }, [allPlayers]);

  // Conteggio giocatori in panchina per squadra
  const rosterTeamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    roster.forEach(pid => {
      const p = playerById.get(pid);
      if (p) counts[p.realTeam] = (counts[p.realTeam] ?? 0) + 1;
    });
    return counts;
  }, [roster, playerById]);

  // Roster filtrato per ruolo + squadra + con priorità
  const filteredRosterRows = useMemo(() => {
    return roster
      .map((pid, idx) => ({ player: playerById.get(pid)!, rosterIdx: idx, priority: idx + 1 }))
      .filter(({ player }) => player
        && (effectiveRoles.size === 0 || effectiveRoles.has(player.roleClassic))
        && (selectedTeams.size === 0 || selectedTeams.has(player.realTeam))
      );
  }, [roster, effectiveRoles, selectedTeams, playerById]);

  // ── Cambio modulo ────────────────────────────────────────────────────────────
  function handleModuloChange(newModulo: string) {
    if (newModulo === modulo) return;
    const { newFieldSlots, newRoster, message } = migrateLineup(
      fieldSlots, roster, formation, parseFormation(newModulo),
    );
    setModulo(newModulo);
    setFieldSlots(newFieldSlots);
    setRoster(newRoster);
    setSelection(null);
    setModuleChangeMsg(message);
    setTimeout(() => setModuleChangeMsg(null), 3500);
  }

  // ── Click su slot campo ───────────────────────────────────────────────────────
  function handleFieldSlotClick(slotId: string) {
    if (selection?.kind === "field" && selection.slotId === slotId) {
      setSelection(null); return;
    }

    if (selection === null) {
      setSelection({ kind: "field", slotId }); return;
    }

    if (selection.kind === "roster") {
      const pid = selection.playerId;
      const player = playerById.get(pid)!;
      const requiredRole = getSlotRole(slotId, formation);
      if (player.roleClassic !== requiredRole) {
        if (fieldSlots[slotId] === undefined) setSelection({ kind: "field", slotId });
        return;
      }
      const oldOccupant = fieldSlots[slotId];
      setFieldSlots(prev => ({ ...prev, [slotId]: pid }));
      setRoster(prev => {
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
        setSelection({ kind: "field", slotId });
      }
    }
  }

  // ── Doppio click su slot campo → torna in lista ───────────────────────────────
  function handleFieldSlotDoubleClick(slotId: string) {
    const pid = fieldSlots[slotId];
    if (pid === undefined) return;
    setFieldSlots(prev => { const n = { ...prev }; delete n[slotId]; return n; });
    setRoster(prev => [...prev, pid]);
    if (selection?.kind === "field" && selection.slotId === slotId) setSelection(null);
  }

  // ── Click su riga roster ──────────────────────────────────────────────────────
  function handleRosterRowClick(playerId: number, rosterIdx: number) {
    // Deseleziona stessa riga
    if (selection?.kind === "roster" && selection.playerId === playerId) {
      setSelection(null); return;
    }

    if (selection === null) {
      setSelection({ kind: "roster", rosterIdx, playerId }); return;
    }

    if (selection.kind === "roster") {
      // Swap posizioni nel roster
      setRoster(prev => {
        const next = [...prev];
        const a = next.indexOf(selection.playerId);
        const b = next.indexOf(playerId);
        if (a !== -1 && b !== -1) [next[a], next[b]] = [next[b], next[a]];
        return next;
      });
      setSelection(null); return;
    }

    if (selection.kind === "field") {
      // Assegna questo giocatore allo slot campo selezionato
      const slotId = selection.slotId;
      const player = playerById.get(playerId)!;
      const requiredRole = getSlotRole(slotId, formation);
      if (player.roleClassic !== requiredRole) {
        setSelection({ kind: "roster", rosterIdx, playerId }); return;
      }
      const oldOccupant = fieldSlots[slotId];
      setFieldSlots(prev => ({ ...prev, [slotId]: playerId }));
      setRoster(prev => {
        const next = prev.filter(id => id !== playerId);
        if (oldOccupant !== undefined) next.push(oldOccupant);
        return next;
      });
      setSelection(null);
    }
  }

  // Altezza colonne: viewport meno offset (padding + header senza toolbar)
  const COLUMN_HEIGHT = "calc(100vh - 160px)";

  const hasFieldSelected = selection?.kind === "field";
  const { avversario, avversarioSigla, avversarioColori, fieldStatus, competizione, stadio } = MATCH_GIORNATA_2;
  const salvaEnabled = starterCount === 11;

  if (lineupLoading || rosterLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ height: 28, width: 180, borderRadius: "var(--r-sm)", background: "var(--border)", marginBottom: 6 }} />
          <div style={{ height: 16, width: 200, borderRadius: "var(--r-sm)", background: "var(--border)" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "var(--sp-5)" }}>
          <div style={{ height: 620, borderRadius: "var(--r-md)", background: "var(--surface)", border: "1px solid var(--border)" }} />
          <div style={{ height: 620, borderRadius: "var(--r-md)", background: "#17332a", border: "1px solid rgba(239,230,211,0.1)" }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Intestazione ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Logo squadra — tondo */}
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: MY_TEAM_INFO.logoColori.bg, border: "2px solid var(--green-mid)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: MY_TEAM_INFO.logoColori.fg, letterSpacing: "0.04em" }}>{MY_TEAM_INFO.sigla}</span>
          </div>
          {/* Maglia */}
          <JerseyIcon primary={MY_TEAM_INFO.magliaPrimary} secondary={MY_TEAM_INFO.magliaSecondary} size={26} />
          {/* Nome — stessa riga, stesso font mono */}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
            Mario&apos;s Squad
          </span>
          <span style={{ padding: "2px 8px", borderRadius: 99, background: fieldStatus === "casa" ? "var(--green-deep)" : "var(--ink-mid)", color: "#fff", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {fieldStatus === "casa" ? "Casa" : "Trasferta"}
          </span>
        </div>

        {/* Toggle Formazione | Partita */}
        <div style={{ display: "flex", alignItems: "center", padding: 3, gap: 1, borderRadius: 99, background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
          {(["builder", "match"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{ padding: "4px 14px", borderRadius: 99, border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", background: viewMode === mode ? "var(--green-deep)" : "transparent", color: viewMode === mode ? "#fff" : "var(--ink-mid)", transition: "background 0.15s, color 0.15s" }}
            >
              {mode === 'builder' ? "Formazione" : "Partita"}
            </button>
          ))}
        </div>

        {/* Messaggi + azioni (solo in modalità builder) */}
        {viewMode === 'builder' && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {moduleChangeMsg && (
            <div style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(45,107,79,0.1)", border: "1px solid var(--green-mid)", fontSize: 12, color: "var(--green-deep)" }}>
              {moduleChangeMsg}
            </div>
          )}
          {selection !== null && (
            <div style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.4)", fontSize: 12, color: "var(--green-deep)", fontWeight: 500 }}>
              {selection.kind === "roster"
                ? `${lastName(playerById.get(selection.playerId)?.name ?? "")} — scegli uno slot`
                : <>Slot <strong style={{ fontFamily: "var(--font-mono)" }}>{selectedFieldSlotRole && ROLE_BADGE[selectedFieldSlotRole].label}</strong> — scegli dal roster</>
              }
            </div>
          )}
          <button
            disabled={!salvaEnabled || saveMutation.isPending}
            onClick={() => {
              const payload = buildPutPayload(modulo, fieldSlots, roster, captainId, formation, playerById);
              saveMutation.mutate({ data: payload }, {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: getGetLineupsQueryKey(LINEUP_PARAMS) });
                  toast({ title: "Formazione salvata" });
                },
                onError: () => {
                  toast({ variant: "destructive", title: "Salvataggio fallito" });
                },
              });
            }}
            style={{ padding: "6px 14px", borderRadius: "var(--r-sm)", border: "none", background: "var(--green-deep)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: (salvaEnabled && !saveMutation.isPending) ? "pointer" : "not-allowed", opacity: (salvaEnabled && !saveMutation.isPending) ? 1 : 0.45, transition: "opacity 0.2s", whiteSpace: "nowrap" }}
          >
            {saveMutation.isPending ? "Salvataggio…" : "Salva"}
          </button>
          <button
            onClick={() => { setFieldSlots({}); setRoster(allPlayers.map(p => p.id)); setSelection(null); setCaptainId(null); setSelectedRoles(new Set()); setSelectedTeams(new Set()); }}
            title="Reset formazione"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--ink-mid)", cursor: "pointer", padding: 0 }}
          >
            <RotateCcw size={14} />
          </button>
        </div>}
      </div>

      {viewMode === 'match' && <MatchView />}
      {viewMode === 'builder' && (<>

      {/* ── Layout: [Filtri+Roster | Pitch] ── */}
      <div className="formazione-grid" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "var(--sp-5)", alignItems: "start" }}>

        {/* ── Colonna sinistra: filtri + lista ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, height: COLUMN_HEIGHT }}>

          {/* Filtri ruolo — multi-selezione, colorati per ruolo */}
          <div style={{ display: "flex", gap: 4, flexShrink: 0, justifyContent: "center" }}>
            {ROLE_FILTERS.map(rf => {
              const count = rosterRoleCounts[rf.value];
              const colors = ROLE_FILTER_COLORS[rf.value];
              const isActive = effectiveRoles.has(rf.value);
              return (
                <button
                  key={rf.value}
                  onClick={() => {
                    if (!hasFieldSelected) {
                      setSelectedRoles(prev => {
                        const next = new Set(prev);
                        if (next.has(rf.value)) next.delete(rf.value);
                        else next.add(rf.value);
                        return next;
                      });
                    }
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 3,
                    padding: "4px 12px", borderRadius: 99,
                    border: `1px solid ${isActive ? colors.bgActive : colors.border}`,
                    background: isActive ? colors.bgActive : colors.bg,
                    color: isActive ? "#fff" : colors.text,
                    fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                    cursor: hasFieldSelected ? "default" : "pointer",
                    opacity: hasFieldSelected && !isActive ? 0.38 : 1,
                    transition: "all 0.12s",
                  }}
                >
                  {rf.label}
                  <span style={{ fontSize: 10, opacity: 0.75 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Filtri squadra: count sopra il badge, centrati — multi-selezione */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", flexShrink: 0, justifyContent: "center" }}>
            {uniqueTeams.map(team => {
              const count = rosterTeamCounts[team] ?? 0;
              const isActive = selectedTeams.has(team);
              const logoUrl = teamLogoUrl.get(team);
              return (
                <button
                  key={team}
                  onClick={() => setSelectedTeams(prev => {
                    const next = new Set(prev);
                    if (next.has(team)) next.delete(team);
                    else next.add(team);
                    return next;
                  })}
                  title={team}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                    background: "none", border: "none", padding: 0, cursor: "pointer", outline: "none",
                    opacity: count === 0 ? 0.22 : 1, transition: "opacity 0.12s",
                  }}
                >
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 800, lineHeight: 1,
                    color: isActive ? "var(--green-deep)" : "var(--ink-dim)",
                  }}>
                    {count}
                  </span>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    border: isActive ? "2px solid var(--green-deep)" : "2px solid var(--border-strong)",
                    background: isActive ? "rgba(31,71,51,0.12)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "border-color 0.12s, background 0.12s",
                  }}>
                    {logoUrl && <img src={logoUrl} alt={team} style={{ width: 15, height: 15, objectFit: "contain" }} />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Lista roster */}
          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 }}>
            {filteredRosterRows.length === 0 ? (
              <div style={{ padding: "24px 12px", textAlign: "center", fontSize: 12, color: "var(--ink-dim)" }}>
                {starterCount === 11 ? "Tutti i giocatori sono in campo" : "Nessun giocatore in questa posizione"}
              </div>
            ) : (
              filteredRosterRows.map(({ player, rosterIdx, priority }) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  priority={priority}
                  isSelected={selection?.kind === "roster" && selection.playerId === player.id}
                  isCompatible={!hasFieldSelected || player.roleClassic === selectedFieldSlotRole}
                  hasFieldSelected={!!hasFieldSelected}
                  onClick={() => handleRosterRowClick(player.id, rosterIdx)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Colonna destra: info partita + pitch con modulo select sovrapposto ── */}
        <div style={{ width: "min(100%, calc((100vh - 160px) * 100 / 140))" }}>
          {/* Barra info partita — sopra il campo, allineata sull'area verde (18% → 95%) */}
          <div style={{
            marginLeft: "18%", marginRight: "5%", marginBottom: 8,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            {/* Sx: competizione (regular) + giornata (bold), stessa riga, stesso font */}
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 13,
              color: "var(--ink)", letterSpacing: "0.07em", textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}>
              {competizione}{" "}
              <span style={{ fontWeight: 700 }}>Giornata {MATCH_GIORNATA_2.giornata}</span>
            </div>
            {/* Dx: icona casa/trasferta · stadio · avversario · logo · maglia */}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {fieldStatus === "casa"
                ? <Home size={13} style={{ color: "var(--ink-mid)", flexShrink: 0 }} />
                : <Plane size={13} style={{ color: "var(--ink-mid)", flexShrink: 0 }} />
              }
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-mid)", whiteSpace: "nowrap" }}>{stadio}</span>
              <span style={{ color: "var(--ink-mid)", fontSize: 11, lineHeight: 1 }}>·</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{avversario}</span>
              {/* Logo avversario — tondo */}
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: avversarioColori.primary, border: "1.5px solid rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: avversarioColori.secondary, letterSpacing: "0.03em" }}>{avversarioSigla}</span>
              </div>
              {/* Maglia avversario */}
              <JerseyIcon primary={avversarioColori.primary} secondary={avversarioColori.secondary} size={20} />
            </div>
          </div>

          {/* Pitch + modulo select — position:relative isolato dal wrapper giornata */}
          <div style={{ position: "relative" }}>
            <div style={{ background: "#17332a", borderRadius: "var(--r-lg)", border: "1px solid rgba(239,230,211,0.1)", overflow: "hidden", aspectRatio: "100/140" }}>
              <Pitch
                modulo={modulo}
                fieldSlots={fieldSlots}
                playerById={playerById}
                selection={selection}
                captainId={captainId}
                onSlotClick={handleFieldSlotClick}
                onSlotDoubleClick={handleFieldSlotDoubleClick}
                coach={COACH_MARIO}
                avversario={avversario}
                nextIsHome={fieldStatus === "casa"}
                fieldRoles={selectedRoles}
                fieldTeams={selectedTeams}
              />
            </div>
            {/* Modulo select — sopra il badge allenatore (x:0-16%, y≈56%) */}
            <select
              value={modulo}
              onChange={e => handleModuloChange(e.target.value)}
              style={{
                position: "absolute",
                left: "0%", top: "62%",
                width: "16%",
                fontFamily: "var(--font-mono)",
                fontSize: 16, fontWeight: 700,
                color: "#F4C430",
                background: "transparent",
                border: "none",
                outline: "none",
                cursor: "pointer",
                textAlign: "center",
                appearance: "none",
                WebkitAppearance: "none",
                zIndex: 10,
              }}
            >
              {MODULI.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .formazione-grid { grid-template-columns: 1fr !important; }
          .formazione-grid > :first-child { order: 1; }
          .formazione-grid > :last-child  { order: 2; }
        }
      `}</style>
      </>)}
    </div>
  );
}
