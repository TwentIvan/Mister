import "./formazione-desktop.css";
import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import {
  useGetCompetitionMatches,
  useGetRoster,
  useGetLineups,
  usePutLineup,
  getGetLineupsQueryKey,
  useGetFantaTeamRosa,
  type RosterPlayer,
  type CompetitionMatch,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouteId } from "@/hooks/useRouteId";
import { ChevronLeft, Lock, Home as HomeIcon, Plane } from "lucide-react";
import { TEAM_CODE } from "./team-constants";
import { PlayerFieldChip, PlayerBenchRow, MisterToyAvatar } from "@/components/player-chip";

// ── Tipi ──────────────────────────────────────────────────────────────────────

type Role = "GK" | "DEF" | "MID" | "ATT";
type Sel =
  | { kind: "field";       slotId: string; playerId: number }
  | { kind: "field-empty"; slotId: string }
  | { kind: "bench";       playerId: number }
  | null;

interface LocalPlayer {
  id: number;
  name: string;
  realTeam: string;
  role: Role;
  photoUrl: string | null;
  cartoonUrl: string | null;
  colors: { primary: string; secondary: string };
  teamCode: string;
  logoUrl: string | null;
}

// ── Costanti ──────────────────────────────────────────────────────────────────

const MODULI = ["4-3-3", "4-4-2", "3-5-2", "3-4-3", "5-3-2", "4-2-3-1", "4-3-1-2"];

const ROLE_RING: Record<Role, string> = {
  GK:  "#7e5a26",
  DEF: "#2b5740",
  MID: "#234c5e",
  ATT: "#6b2c24",
};


const ROLE_LABEL: Record<Role, string> = {
  GK: "P", DEF: "D", MID: "C", ATT: "A",
};

// ── Helper ────────────────────────────────────────────────────────────────────

function parseFormation(mod: string): number[] {
  return [1, ...mod.split("-").map(Number)];
}

function getRowLabel(rowIdx: number, totalRows: number): string {
  if (rowIdx === 0) return "P";
  if (rowIdx === 1) return "D";
  if (rowIdx === totalRows - 1) return "A";
  if (rowIdx === totalRows - 2 && totalRows >= 5) return "T";
  return "C";
}

function labelToRole(label: string): Role {
  switch (label) {
    case "P": return "GK";
    case "D": return "DEF";
    case "A": return "ATT";
    default:  return "MID";
  }
}

function getSlotRole(slotId: string, formation: number[]): Role {
  const rowIdx = parseInt(slotId.split("-")[0], 10);
  return labelToRole(getRowLabel(rowIdx, formation.length));
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  return last.length > 10 ? last.slice(0, 9) + "." : last;
}

function adaptPlayer(p: RosterPlayer): LocalPlayer {
  const teamName = p.realTeamName ?? "";
  return {
    id: p.id,
    name: p.name,
    realTeam: teamName,
    role: p.roleClassic as Role,
    photoUrl: p.photoUrl ?? null,
    cartoonUrl: p.photoCartoonUrl ?? null,
    colors: {
      primary:   p.realTeamColorPrimary  ?? "#444",
      secondary: p.realTeamColorSecondary ?? "#888",
    },
    teamCode: TEAM_CODE[teamName] ?? teamName.slice(0, 3).toUpperCase(),
    logoUrl: p.logoUrl ?? null,
  };
}

function migrateLineup(
  oldField: Record<string, number>,
  oldRoster: number[],
  oldForm: number[],
  newForm: number[],
): { fieldSlots: Record<string, number>; roster: number[] } {
  const byLabel = (fn: (l: string) => boolean): number[] => {
    const res: number[] = [];
    oldForm.forEach((c, ri) => {
      if (fn(getRowLabel(ri, oldForm.length))) {
        for (let si = 0; si < c; si++) { const p = oldField[`${ri}-${si}`]; if (p !== undefined) res.push(p); }
      }
    });
    return res;
  };
  const newIds = (fn: (l: string) => boolean): string[] => {
    const res: string[] = [];
    newForm.forEach((c, ri) => {
      if (fn(getRowLabel(ri, newForm.length))) for (let si = 0; si < c; si++) res.push(`${ri}-${si}`);
    });
    return res;
  };

  const gks  = byLabel(l => l === "P");
  const defs = byLabel(l => l === "D");
  const mids = byLabel(l => l === "C" || l === "T");
  const atts = byLabel(l => l === "A");

  const slots: Record<string, number> = {};
  const surplus: number[] = [];

  if (gks[0] !== undefined) slots["0-0"] = gks[0];
  surplus.push(...gks.slice(1));

  const ds = newIds(l => l === "D");
  defs.forEach((pid, i) => { if (i < ds.length) slots[ds[i]] = pid; else surplus.push(pid); });
  const ms = newIds(l => l === "C" || l === "T");
  mids.forEach((pid, i) => { if (i < ms.length) slots[ms[i]] = pid; else surplus.push(pid); });
  const as_ = newIds(l => l === "A");
  atts.forEach((pid, i) => { if (i < as_.length) slots[as_[i]] = pid; else surplus.push(pid); });

  return { fieldSlots: slots, roster: [...oldRoster, ...surplus] };
}

// ── (DesktopChip e SidebarRow rimossi: usa PlayerFieldChip / PlayerBenchRow da @/components/player-chip) ──

// ── Pagina principale ─────────────────────────────────────────────────────────

export default function FormazioneDesktopPage() {
  const competitionId = useRouteId("competitionId");
  const fantaTeamId   = useRouteId("fantaTeamId");
  const search = useSearch();
  const seasonOverride = parseInt(new URLSearchParams(search).get("season") ?? "0", 10);

  const queryClient = useQueryClient();

  // ── Partite + rounds ─────────────────────────────────────────────────────────
  const { data: matchesData } = useGetCompetitionMatches(competitionId ?? "");

  // season viene dalla competizione, non da un default hardcoded
  const season = seasonOverride > 0 ? seasonOverride : (matchesData?.season ?? 0);

  const rounds = useMemo((): number[] => {
    if (!matchesData) return [];
    return Array.from(new Set(matchesData.matches.map((m: CompetitionMatch) => m.round))).sort((a, b) => a - b);
  }, [matchesData]);

  const isRoundLocked = (r: number) =>
    !!(matchesData?.matches.filter((m: CompetitionMatch) => m.round === r)
      .some((m: CompetitionMatch) => m.playedAt != null));

  const defaultRound = useMemo((): number | null => {
    if (!matchesData || rounds.length === 0) return null;
    return rounds.find(r => !isRoundLocked(r)) ?? rounds[rounds.length - 1];
  }, [matchesData, rounds]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeRound = defaultRound ?? 1;
  const roundLocked = isRoundLocked(activeRound);

  const myMatch = useMemo((): CompetitionMatch | null => {
    if (!matchesData || !fantaTeamId) return null;
    return matchesData.matches.find((m: CompetitionMatch) =>
      m.round === activeRound &&
      (m.homeTeam.id === fantaTeamId || m.awayTeam.id === fantaTeamId)
    ) ?? null;
  }, [matchesData, activeRound, fantaTeamId]);

  const isHome   = myMatch?.homeTeam.id === fantaTeamId;
  const opponent = myMatch ? (isHome ? myMatch.awayTeam : myMatch.homeTeam) : null;

  // ── Dati ─────────────────────────────────────────────────────────────────────
  const { data: rosaData }   = useGetFantaTeamRosa(fantaTeamId ?? "");
  const teamName             = rosaData?.teamName ?? fantaTeamId ?? "Formazione";

  const { data: rosterData } = useGetRoster(
    { fantaTeamId: fantaTeamId ?? "", season, round: activeRound },
  );
  const { data: lineupData } = useGetLineups(
    { fantaTeamId: fantaTeamId ?? "", season, round: activeRound },
  );
  const saveMutation = usePutLineup();

  const allPlayers = useMemo((): LocalPlayer[] => (rosterData ?? []).map(adaptPlayer), [rosterData]);
  const playerById = useMemo((): Map<number, LocalPlayer> => {
    const m = new Map<number, LocalPlayer>();
    allPlayers.forEach(p => m.set(p.id, p));
    return m;
  }, [allPlayers]);

  // ── Stato formazione ──────────────────────────────────────────────────────────
  const [modulo, setModulo]         = useState("4-3-3");
  const [fieldSlots, setFieldSlots] = useState<Record<string, number>>({});
  const [roster, setRoster]         = useState<number[]>([]);
  const [captainId, setCaptainId]   = useState<number | null>(null);
  const [loadedKey, setLoadedKey]   = useState("");

  const roundKey = `${activeRound}-${fantaTeamId}-${season}`;
  useEffect(() => { setLoadedKey(""); }, [activeRound, fantaTeamId, season]);

  useEffect(() => {
    if (loadedKey === roundKey) return;
    if (allPlayers.length === 0) return;
    if (lineupData === undefined) return; // attendi che la query sia risolta
    setLoadedKey(roundKey);

    if (lineupData && lineupData.players.length > 0) {
      setModulo(lineupData.module);
      setCaptainId(lineupData.captainPlayerId ?? null);
      const formation = parseFormation(lineupData.module);
      let si = 1;
      const siToSlot = new Map<number, string>();
      formation.forEach((c, ri) => {
        for (let j = 0; j < c; j++) { siToSlot.set(si, `${ri}-${j}`); si++; }
      });
      const newField: Record<string, number> = {};
      const newRoster: number[] = [];
      lineupData.players.forEach(p => {
        if (p.isStarter) { const sid = siToSlot.get(p.slotIndex); if (sid) newField[sid] = p.playerId; }
        else newRoster.push(p.playerId);
      });
      setFieldSlots(newField);
      setRoster(newRoster);
    } else {
      setFieldSlots({});
      setRoster(allPlayers.map(p => p.id));
      setCaptainId(null);
    }
  }, [roundKey, loadedKey, allPlayers, lineupData]);

  // ── Stato UI ──────────────────────────────────────────────────────────────────
  const [filterRoles, setFilterRoles] = useState<Set<Role>>(new Set());
  const [filterTeam, setFilterTeam]   = useState<string | null>(null);
  const [selection, setSelection]     = useState<Sel>(null);
  const [saveErrors, setSaveErrors]   = useState<string[]>([]);
  const [saveOk, setSaveOk]           = useState(false);
  const [roleError, setRoleError]     = useState<string | null>(null);

  const formation    = useMemo(() => parseFormation(modulo), [modulo]);
  const starterCount = Object.keys(fieldSlots).length;
  const fieldIds     = useMemo(() => new Set(Object.values(fieldSlots)), [fieldSlots]);

  // Ruolo del campo attualmente selezionato
  const selectedFieldRole: Role | null =
    selection?.kind === "field"       ? getSlotRole(selection.slotId, formation) :
    selection?.kind === "field-empty" ? getSlotRole(selection.slotId, formation) :
    null;

  // Club in rosa
  const clubs = useMemo(() => {
    const m = new Map<string, { count: number; colors: { primary: string; secondary: string }; logoUrl: string | null }>();
    allPlayers.forEach(p => {
      const e = m.get(p.realTeam);
      if (e) e.count++;
      else m.set(p.realTeam, { count: 1, colors: p.colors, logoUrl: p.logoUrl });
    });
    return Array.from(m.entries())
      .map(([team, { count, colors, logoUrl }]) => ({ team, count, colors, logoUrl }))
      .sort((a, b) => b.count - a.count);
  }, [allPlayers]);

  const roleCounts = useMemo(() => {
    const c: Record<Role, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
    allPlayers.forEach(p => c[p.role]++);
    return c;
  }, [allPlayers]);

  const filteredPlayers = useMemo((): LocalPlayer[] => {
    let list = allPlayers;
    if (filterRoles.size > 0) list = list.filter(p => filterRoles.has(p.role));
    if (filterTeam)           list = list.filter(p => p.realTeam === filterTeam);
    return list;
  }, [allPlayers, filterRoles, filterTeam]);

  // ── Handler modulo ────────────────────────────────────────────────────────────
  function handleModuloChange(newMod: string) {
    const r = migrateLineup(fieldSlots, roster, formation, parseFormation(newMod));
    setModulo(newMod);
    setFieldSlots(r.fieldSlots);
    setRoster(r.roster);
    setSelection(null);
  }

  // ── Handler chip sul campo ────────────────────────────────────────────────────
  function handleFieldChipClick(slotId: string) {
    if (roundLocked) return;
    const pid = fieldSlots[slotId];

    // Bench player selezionato → piazza qui
    if (selection?.kind === "bench") {
      const reqRole = getSlotRole(slotId, formation);
      const p = playerById.get(selection.playerId);
      if (!p || p.role !== reqRole) {
        setRoleError(`Slot ${ROLE_LABEL[reqRole]} richiede ruolo ${ROLE_LABEL[reqRole]}`);
        setTimeout(() => setRoleError(null), 2400);
        setSelection(null);
        return;
      }
      const outgoing = fieldSlots[slotId];
      setFieldSlots(prev => ({ ...prev, [slotId]: selection.playerId }));
      setRoster(prev => {
        const next = prev.filter(id => id !== selection.playerId);
        if (outgoing !== undefined) next.push(outgoing);
        return next;
      });
      setSelection(null);
      return;
    }

    // Stessa selezione → deselect
    if (
      (selection?.kind === "field"       && selection.slotId === slotId) ||
      (selection?.kind === "field-empty" && selection.slotId === slotId)
    ) { setSelection(null); return; }

    // Altro chip campo selezionato → swap se stesso ruolo
    if (selection?.kind === "field" && pid !== undefined) {
      const fromRole = getSlotRole(selection.slotId, formation);
      const toRole   = getSlotRole(slotId, formation);
      if (fromRole === toRole) {
        const fromPid = selection.playerId;
        setFieldSlots(prev => ({ ...prev, [selection.slotId]: pid, [slotId]: fromPid }));
        setSelection(null);
      } else {
        setSelection({ kind: "field", slotId, playerId: pid });
      }
      return;
    }

    // Campo selezionato → slot vuoto compatibile: sposta
    if (selection?.kind === "field" && pid === undefined) {
      const reqRole  = getSlotRole(slotId, formation);
      const movingP  = playerById.get(selection.playerId);
      if (movingP && movingP.role === reqRole) {
        setFieldSlots(prev => {
          const n = { ...prev };
          delete n[selection.slotId];
          n[slotId] = selection.playerId;
          return n;
        });
        setSelection(null);
      } else {
        setRoleError(`Slot ${ROLE_LABEL[reqRole]} richiede ruolo ${ROLE_LABEL[reqRole]}`);
        setTimeout(() => setRoleError(null), 2400);
        setSelection(null);
      }
      return;
    }

    // Nessuna selezione attiva: seleziona
    if (pid !== undefined) setSelection({ kind: "field", slotId, playerId: pid });
    else                   setSelection({ kind: "field-empty", slotId });
  }

  function handleRemoveFromField(slotId: string) {
    const pid = fieldSlots[slotId];
    if (pid === undefined) return;
    setFieldSlots(prev => { const n = { ...prev }; delete n[slotId]; return n; });
    setRoster(prev => [...prev, pid]);
    setSelection(null);
  }

  // ── Handler sidebar ───────────────────────────────────────────────────────────
  function handleSidebarClick(pid: number) {
    if (roundLocked) return;

    // Giocatore già in campo: seleziona lo slot corrispondente
    if (fieldIds.has(pid)) {
      const slotId = Object.entries(fieldSlots).find(([, p]) => p === pid)?.[0];
      if (slotId) setSelection({ kind: "field", slotId, playerId: pid });
      return;
    }

    // Slot campo selezionato → piazza dalla panchina
    if (selection?.kind === "field" || selection?.kind === "field-empty") {
      const reqRole = getSlotRole(selection.slotId, formation);
      const p = playerById.get(pid);
      if (!p || p.role !== reqRole) {
        setRoleError(`Slot ${ROLE_LABEL[reqRole]} richiede ruolo ${ROLE_LABEL[reqRole]}`);
        setTimeout(() => setRoleError(null), 2400);
        return;
      }
      const outgoing = fieldSlots[selection.slotId];
      setFieldSlots(prev => ({ ...prev, [selection.slotId]: pid }));
      setRoster(prev => {
        const next = prev.filter(id => id !== pid);
        if (outgoing !== undefined) next.push(outgoing);
        return next;
      });
      setSelection(null);
      return;
    }

    // Altro bench player selezionato → swap ordine panchina
    if (selection?.kind === "bench") {
      const a = roster.indexOf(selection.playerId);
      const b = roster.indexOf(pid);
      if (a !== -1 && b !== -1) {
        setRoster(prev => { const n = [...prev]; [n[a], n[b]] = [n[b], n[a]]; return n; });
      }
      setSelection(null);
      return;
    }

    setSelection({ kind: "bench", playerId: pid });
  }

  // ── Salva ─────────────────────────────────────────────────────────────────────
  function handleSave() {
    if (!fantaTeamId) return;
    setSaveErrors([]); setSaveOk(false);

    type SP = "GK" | "DEF" | "MID" | "T" | "ATT";
    const s2p = (label: string): SP => {
      switch (label) { case "P": return "GK"; case "D": return "DEF"; case "T": return "T"; case "A": return "ATT"; default: return "MID"; }
    };
    const r2p = (role: Role): SP => {
      switch (role) { case "GK": return "GK"; case "DEF": return "DEF"; case "ATT": return "ATT"; default: return "MID"; }
    };

    const players: Array<{ playerId: number; slotPosition: SP; slotIndex: number; isStarter: boolean; benchOrder: number | null }> = [];
    let si = 1;
    formation.forEach((c, ri) => {
      const pos = s2p(getRowLabel(ri, formation.length));
      for (let j = 0; j < c; j++) {
        const pid = fieldSlots[`${ri}-${j}`];
        if (pid !== undefined) players.push({ playerId: pid, slotPosition: pos, slotIndex: si, isStarter: true, benchOrder: null });
        si++;
      }
    });
    roster.forEach((pid, i) => {
      const p = playerById.get(pid);
      if (!p) return;
      players.push({ playerId: pid, slotPosition: r2p(p.role), slotIndex: 12 + i, isStarter: false, benchOrder: i + 1 });
    });

    saveMutation.mutate({ data: { fantaTeamId, season, round: activeRound, module: modulo, captainPlayerId: captainId ?? null, players } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLineupsQueryKey({ fantaTeamId, season, round: activeRound }) });
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 3200);
      },
      onError: (err: unknown) => {
        const d = (err as { response?: { data?: unknown } })?.response?.data;
        if (d && typeof d === "object" && "errors" in d && Array.isArray((d as { errors: unknown[] }).errors)) {
          setSaveErrors((d as { errors: string[] }).errors);
        } else if (d && typeof d === "object" && "error" in d) {
          setSaveErrors([(d as { error: string }).error]);
        } else {
          setSaveErrors(["Salvataggio non riuscito"]);
        }
      },
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="fd" style={{ height: "100dvh", background: "var(--cream)", color: "var(--green-d)", fontFamily: "var(--font-sans)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 22px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <button
          onClick={() => window.history.back()}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, borderRadius: 6, display: "flex" }}
        >
          <ChevronLeft size={20} />
        </button>

        {/* Badge squadra */}
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-serif)", fontWeight: 800, fontSize: 12, color: "#c8922b" }}>MS</span>
        </div>
        <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 16, color: "var(--green)" }}>
          {teamName}
        </span>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 18, marginLeft: "auto" }}>
          {["Formazione", "Partita"].map(tab => (
            <span key={tab} style={{
              fontSize: 12, textTransform: "uppercase" as const, letterSpacing: "0.1em",
              color: tab === "Formazione" ? "var(--green)" : "var(--muted)",
              paddingBottom: 3, cursor: "pointer",
              borderBottom: tab === "Formazione" ? "2px solid var(--gold)" : "2px solid transparent",
            }}>
              {tab}
            </span>
          ))}
        </div>

        {/* Azioni */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 24 }}>
          {roundLocked ? (
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 13px", borderRadius: 8, background: "var(--paper)", border: "1px solid var(--line)" }}>
              <Lock size={11} color="var(--muted)" />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Sola lettura</span>
            </div>
          ) : (
            <>
              <button
                disabled={starterCount !== 11 || saveMutation.isPending}
                onClick={handleSave}
                style={{
                  background: starterCount === 11 ? "var(--green)" : "var(--paper)",
                  color: starterCount === 11 ? "var(--cream)" : "var(--muted)",
                  border: starterCount === 11 ? "1px solid var(--green)" : "1px solid var(--line)",
                  borderRadius: 9, padding: "8px 18px",
                  fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12,
                  cursor: starterCount === 11 && !saveMutation.isPending ? "pointer" : "not-allowed",
                  transition: "all 0.15s",
                }}
              >
                {saveMutation.isPending ? "Salvataggio…" : "Salva"}
              </button>
              <button
                onClick={() => { setFieldSlots({}); setRoster(allPlayers.map(p => p.id)); setSelection(null); setCaptainId(null); setSaveErrors([]); }}
                title="Reset"
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", padding: 6, borderRadius: 6, display: "flex" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width={18} height={18}>
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── STRIP PARTITA ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "7px 22px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em" }}>SERIE A</span>
        <span style={{ color: "var(--line)" }}>·</span>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, color: "var(--green-d)" }}>GIORNATA {activeRound}</span>
        {opponent && (
          <>
            <span style={{ color: "var(--line)" }}>·</span>
            {isHome ? <HomeIcon size={10} color="var(--muted)" /> : <Plane size={10} color="var(--muted)" />}
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, color: "var(--green)" }}>
              {opponent.name.toUpperCase()}
            </span>
          </>
        )}
        <span style={{ color: "var(--line)" }}>·</span>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 10, color: roundLocked ? "var(--muted)" : "#6aa07f" }}>
          {roundLocked ? "Conclusa" : "Aperta"}
        </span>
      </div>

      {/* ── GRIGLIA PRINCIPALE ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "312px 1fr", overflow: "hidden", maxWidth: 1180, width: "100%", margin: "0 auto" }}>

        {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
        <div style={{ borderRight: "1px solid var(--line)", padding: 14, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {/* Label */}
          <div style={{ fontSize: 9, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 8 }}>
            Filtra la rosa — ruolo × club
          </div>

          {/* Filtri ruolo */}
          <div style={{ display: "flex", gap: 6, marginBottom: 11 }}>
            {(["GK", "DEF", "MID", "ATT"] as Role[]).map(role => {
              const active = filterRoles.has(role);
              return (
                <button
                  key={role}
                  onClick={() => setFilterRoles(prev => {
                    const next = new Set(prev);
                    if (next.has(role)) next.delete(role); else next.add(role);
                    return next;
                  })}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    fontSize: 11, border: `1px solid ${active ? ROLE_RING[role] : "var(--line)"}`,
                    background: active ? `${ROLE_RING[role]}22` : "var(--paper)",
                    borderRadius: 8, padding: "6px 4px", cursor: "pointer",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: ROLE_RING[role], flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--green-d)", fontSize: 11 }}>{ROLE_LABEL[role]}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 10 }}>{roleCounts[role]}</span>
                </button>
              );
            })}
          </div>

          {/* Filtri club */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
            {clubs.map(({ team, count, logoUrl }) => (
              <button
                key={team}
                onClick={() => setFilterTeam(prev => prev === team ? null : team)}
                title={team}
                style={{
                  display: "flex", alignItems: "center", gap: 3,
                  fontSize: 10, color: filterTeam === team ? "var(--green-d)" : "var(--muted)",
                  cursor: "pointer", background: "none", border: "none", padding: "1px 3px",
                  outline: filterTeam === team ? "1px solid var(--line)" : "none",
                  borderRadius: 3,
                }}
              >
                {/* Crest tondo: logo reale o .miss */}
                <span style={{
                  width: 16, height: 16, borderRadius: "50%", flexShrink: 0, display: "inline-flex",
                  alignItems: "center", justifyContent: "center",
                  overflow: "hidden", background: "var(--cream2)",
                  boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.18)",
                }}>
                  {logoUrl
                    ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    : <span style={{ fontSize: 8, fontWeight: 700, color: "var(--danger)", lineHeight: 1 }}>?</span>
                  }
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{count}</span>
              </button>
            ))}
          </div>

          {(filterRoles.size > 0 || filterTeam) && (
            <button
              onClick={() => { setFilterRoles(new Set()); setFilterTeam(null); }}
              style={{ fontSize: 9, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-serif)", fontStyle: "italic", marginBottom: 6, padding: 0, textAlign: "left" }}
            >
              Rimuovi filtri
            </button>
          )}

          {/* Hint panchina automatica */}
          <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-serif)", fontStyle: "italic", marginBottom: 9, lineHeight: 1.5 }}>
            {selectedFieldRole !== null
              ? `↑ Seleziona un ${ROLE_LABEL[selectedFieldRole]} — panchina automatica`
              : "Clicca uno slot campo poi un giocatore — chi resta è in panca"}
          </div>

          {/* Lista giocatori */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
            {filteredPlayers.map(p => {
              const inField  = fieldIds.has(p.id);
              const isSel    = selection?.kind === "bench" && selection.playerId === p.id;
              const isComp   = selectedFieldRole !== null ? (p.role === selectedFieldRole ? true : false) : null;
              return (
                <PlayerBenchRow
                  key={p.id}
                  player={p}
                  isInField={inField}
                  isSelected={isSel}
                  isCompatible={isComp}
                  isCaptain={p.id === captainId}
                  isLocked={roundLocked}
                  faceSmall
                  onTap={() => handleSidebarClick(p.id)}
                  onCaptainToggle={() => setCaptainId(prev => prev === p.id ? null : p.id)}
                />
              );
            })}
          </div>
        </div>

        {/* ── CAMPO ────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", overflow: "hidden" }}>
          <div style={{
            position: "relative",
            background: "repeating-linear-gradient(0deg, #173a27 0px 48px, #1a402b 48px 96px)",
            borderLeft: "1px solid #15301f",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "22px 26px 20px 134px",
            overflow: "hidden",
          }}>

            {/* Righe campo (SVG) */}
            <svg
              style={{ position: "absolute", left: 134, top: 0, bottom: 0, width: "calc(100% - 160px)", height: "100%", pointerEvents: "none", opacity: 0.13 }}
              viewBox="0 0 100 160" preserveAspectRatio="none"
            >
              <rect x="5" y="3" width="90" height="154" fill="none" stroke="#fff" strokeWidth="0.8" />
              <line x1="5" y1="80" x2="95" y2="80" stroke="#fff" strokeWidth="0.6" />
              <circle cx="50" cy="80" r="10" fill="none" stroke="#fff" strokeWidth="0.6" />
              <circle cx="50" cy="80" r="1.2" fill="#fff" />
              <rect x="28" y="3" width="44" height="18" fill="none" stroke="#fff" strokeWidth="0.6" />
              <rect x="38" y="3" width="24" height="8" fill="none" stroke="#fff" strokeWidth="0.5" />
              <rect x="28" y="139" width="44" height="18" fill="none" stroke="#fff" strokeWidth="0.6" />
              <rect x="38" y="149" width="24" height="8" fill="none" stroke="#fff" strokeWidth="0.5" />
            </svg>

            {/* Banner sola lettura */}
            {roundLocked && (
              <div style={{
                position: "absolute", top: 12, left: 140, right: 20, zIndex: 10,
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 13px", borderRadius: 8,
                background: "rgba(13,31,26,0.82)", border: "1px solid rgba(239,230,211,0.14)",
                backdropFilter: "blur(4px)",
              }}>
                <Lock size={12} color="rgba(239,230,211,0.42)" />
                <span style={{ fontSize: 12, color: "rgba(239,230,211,0.48)", fontFamily: "var(--font-sans)" }}>
                  Giornata conclusa — sola lettura
                </span>
              </div>
            )}

            {/* Area allenatore — .coach > .fm + .mister + .cn (ordine dal mockup) */}
            <div className="coach">
              <div className="fm">
                {roundLocked ? modulo : (
                  <select
                    value={modulo}
                    onChange={e => handleModuloChange(e.target.value)}
                    style={{
                      fontFamily: "var(--disp)", fontSize: 13, fontWeight: 700, color: "var(--gold-l)",
                      background: "transparent", border: "none", outline: "none",
                      cursor: "pointer", appearance: "none" as const, WebkitAppearance: "none" as const,
                      textAlign: "center", width: "100%", letterSpacing: ".04em",
                    }}
                  >
                    {MODULI.map(m => (
                      <option key={m} value={m} style={{ background: "#0d1f1a", color: "var(--gold-l)" }}>{m}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="mister"><MisterToyAvatar /></div>
              <div className="cn">{rosaData?.managerName ?? teamName}</div>
            </div>

            {/* Righe giocatori: ATT in cima → GK in fondo */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly", position: "relative", zIndex: 1 }}>
              {[...formation].reverse().map((count, revIdx) => {
                const rowIdx = formation.length - 1 - revIdx;
                return (
                  <div
                    key={rowIdx}
                    style={{ display: "flex", justifyContent: "space-around", alignItems: "center", width: "100%" }}
                  >
                    {Array.from({ length: count }, (_, si) => {
                      const slotId  = `${rowIdx}-${si}`;
                      const pid     = fieldSlots[slotId];
                      const player  = pid !== undefined ? (playerById.get(pid) ?? null) : null;
                      const role    = getSlotRole(slotId, formation);
                      const isSel   =
                        (selection?.kind === "field"       && selection.slotId === slotId) ||
                        (selection?.kind === "field-empty" && selection.slotId === slotId);
                      const isDimmed = selection !== null && !isSel &&
                        !(selection.kind === "bench" && role === playerById.get(selection.playerId)?.role);
                      return (
                        <PlayerFieldChip
                          key={slotId}
                          player={player}
                          role={role}
                          isSelected={isSel}
                          isCaptain={pid !== undefined && pid === captainId}
                          isDimmed={!!isDimmed}
                          isLocked={roundLocked}
                          onClick={() => handleFieldChipClick(slotId)}
                          onRemove={() => handleRemoveFromField(slotId)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
