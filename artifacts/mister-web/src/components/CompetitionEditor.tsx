import { useState, useEffect } from "react";
import type { FederationRules } from "@/components/RulesEditor";
import { DEFAULT_RULES } from "@/components/RulesEditor";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Save, ChevronUp, ChevronDown, X, Plus, Info } from "lucide-react";

// ─── Tipi locali (specchio di lib/db/src/schema/competitions.ts) ─────────────

type CompetitionType =
  | "campionato"
  | "coppa"
  | "battle_royale"
  | "sprint_race"
  | "formula_uno"
  | "punteggio_assoluto";

type TiebreakerKey =
  | "scontri_diretti"
  | "differenza_reti"
  | "gol_fatti"
  | "gol_subiti"
  | "punteggio_totale"
  | "vittorie"
  | "vittorie_totali_match"
  | "giornate_vinte"
  | "f1_punti"
  | "f1_vittorie"
  | "f1_podi"
  | "punteggio_max_giornata"
  | "gol_fatti_giornata"
  | "punteggio_totale_storico"
  | "sorteggio"
  | "punti";

interface CompetitionConfig {
  campionato?: {
    giornatePerGirone: number;
    numeroGironi: number;
    homeAdvantageEnabled: boolean;
    homeAdvantageBonus: number;
    gironeNeutro: number[];
  };
  coppa?: {
    twoLegs: boolean;
    tieBreakInMatch: "penalties" | "fanta_extra_time" | "away_goals";
    bracket: [string, string][];
  };
  battleRoyale?: { homeAdvantageEnabled: boolean };
  sprintRace?: Record<string, never>;
  formulaUno?: { pointsScale: number[] };
  punteggioAssoluto?: { excludeWorstNGiornate: number };
  scoring: { win: number; draw: number; loss: number };
  tiebreakers: string[];
  prizes: Record<string, string>;
  participantTeamIds: string[];
}

// ─── Costanti (specchio di lib/db/src/schema/competitions.ts) ────────────────

const ALLOWED_TIEBREAKERS: Record<CompetitionType, TiebreakerKey[]> = {
  campionato: ["scontri_diretti", "differenza_reti", "gol_fatti", "gol_subiti", "punteggio_totale", "vittorie", "sorteggio"],
  coppa: [],
  battle_royale: ["vittorie_totali_match", "differenza_reti", "gol_fatti", "gol_subiti", "punteggio_totale", "giornate_vinte", "sorteggio"],
  sprint_race: ["gol_fatti_giornata", "punteggio_totale_storico", "sorteggio"],
  formula_uno: ["f1_vittorie", "f1_podi", "punteggio_totale", "punteggio_max_giornata", "sorteggio"],
  punteggio_assoluto: ["giornate_vinte", "punteggio_max_giornata", "sorteggio"],
};

const TB_LABEL: Record<string, string> = {
  scontri_diretti: "Scontri diretti",
  differenza_reti: "Differenza reti",
  gol_fatti: "Gol fatti",
  gol_subiti: "Gol subiti",
  punteggio_totale: "Punteggio totale assoluto",
  vittorie: "Numero vittorie",
  vittorie_totali_match: "Vittorie match paralleli (BattleRoyale)",
  giornate_vinte: "Giornate vinte",
  f1_punti: "Punti F1",
  f1_vittorie: "Vittorie F1",
  f1_podi: "Podi F1 (top 3)",
  punteggio_max_giornata: "Punteggio max giornata",
  gol_fatti_giornata: "Gol fatti in giornata",
  punteggio_totale_storico: "Punteggio storico cumulativo",
  sorteggio: "Sorteggio (spareggio finale)",
  punti: "Punti classifica",
};

const TYPE_LABEL: Record<CompetitionType, string> = {
  campionato: "Campionato (girone all'italiana)",
  coppa: "Coppa (eliminazione diretta)",
  battle_royale: "Battle Royale (tutti contro tutti)",
  sprint_race: "Sprint Race (eliminazione giornaliera)",
  formula_uno: "Formula 1 (punteggio F1 per posizione)",
  punteggio_assoluto: "Punteggio Assoluto (somma cumulativa)",
};

const SCORING_TYPES: CompetitionType[] = ["campionato", "battle_royale"];

const DEFAULT_CONFIG: CompetitionConfig = {
  scoring: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ["sorteggio"],
  prizes: {},
  participantTeamIds: [],
};

function mergeConfig(raw: unknown): CompetitionConfig {
  const r = (raw ?? {}) as Partial<CompetitionConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...r,
    scoring: { ...DEFAULT_CONFIG.scoring, ...(r.scoring ?? {}) },
    tiebreakers: r.tiebreakers ?? ["sorteggio"],
    prizes: r.prizes ?? {},
    participantTeamIds: r.participantTeamIds ?? [],
  };
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface CompetitionData {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  season: number;
  start_giornata: number;
  end_giornata: number;
  config: unknown;
  active: boolean;
  completed: boolean;
  scope_type?: string;
  scope_id?: string;
  league_id: string;
}

export interface SavePayload {
  name: string;
  description: string;
  start_giornata: number;
  end_giornata: number;
  season: number;
  active: boolean;
  completed: boolean;
  settings: CompetitionConfig;
}

interface CompetitionEditorProps {
  competition: CompetitionData;
  teams: Array<{ id: string; name: string }>;
  federationRules?: FederationRules | null;
  onSave: (data: SavePayload) => void;
  isSaving: boolean;
}

// ─── Sotto-componenti ─────────────────────────────────────────────────────────

function RowLabel({ label, description }: { label: string; description?: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{label}</div>
      {description && (
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>{description}</div>
      )}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

function NumInput({ value, onChange, min, max, step, mono = true }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; mono?: boolean;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={e => onChange(Number(e.target.value))}
      style={{
        width: 80, padding: "4px 8px", borderRadius: 6,
        border: "1px solid var(--border)",
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: 14, color: "var(--ink)",
        background: "var(--surface)",
        textAlign: "right",
      }}
    />
  );
}

// ─── Tiebreaker Editor ────────────────────────────────────────────────────────

function TiebreakerEditor({
  type, tiebreakers, onChange,
}: {
  type: CompetitionType;
  tiebreakers: string[];
  onChange: (v: string[]) => void;
}) {
  const allowed = ALLOWED_TIEBREAKERS[type] ?? [];
  const available = allowed.filter(tb => !tiebreakers.includes(tb));

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...tiebreakers];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => onChange(tiebreakers.filter((_, i) => i !== idx));

  const add = (key: string) => onChange([...tiebreakers, key]);

  if (type === "coppa") {
    return (
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-dim)", padding: "8px 12px", background: "rgba(0,0,0,0.04)", borderRadius: 6 }}>
        Coppa: spareggi gestiti partita per partita — nessun tiebreaker di classifica.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {tiebreakers.length === 0 && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-dim)" }}>Nessun criterio — aggiungine almeno uno.</div>
      )}
      {tiebreakers.map((tb, idx) => (
        <div key={tb} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 10px", borderRadius: 6,
          border: "1px solid var(--border)", background: "var(--surface)",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)", width: 20, textAlign: "right", flexShrink: 0 }}>
            {idx + 1}.
          </span>
          <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink)" }}>
            {TB_LABEL[tb] ?? tb}
          </span>
          <button onClick={() => move(idx, -1)} disabled={idx === 0} title="Sposta su" style={{ border: "none", background: "none", cursor: "pointer", padding: 2, color: idx === 0 ? "var(--ink-dim)" : "var(--ink-mid)" }}>
            <ChevronUp size={14} />
          </button>
          <button onClick={() => move(idx, 1)} disabled={idx === tiebreakers.length - 1} title="Sposta giù" style={{ border: "none", background: "none", cursor: "pointer", padding: 2, color: idx === tiebreakers.length - 1 ? "var(--ink-dim)" : "var(--ink-mid)" }}>
            <ChevronDown size={14} />
          </button>
          <button onClick={() => remove(idx)} title="Rimuovi" style={{ border: "none", background: "none", cursor: "pointer", padding: 2, color: tb === "sorteggio" ? "var(--ink-dim)" : "#b91c1c" }} disabled={tb === "sorteggio" && tiebreakers.length === 1}>
            <X size={14} />
          </button>
        </div>
      ))}
      {available.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          {available.map(tb => (
            <button key={tb} onClick={() => add(tb)} style={{
              padding: "3px 10px", borderRadius: 99, border: "1px dashed var(--border)",
              background: "transparent", cursor: "pointer",
              fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-mid)",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <Plus size={10} /> {TB_LABEL[tb] ?? tb}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Impostazioni tipo-specifiche ─────────────────────────────────────────────

function CampionatoSection({ value, onChange }: {
  value: CompetitionConfig["campionato"];
  onChange: (v: CompetitionConfig["campionato"]) => void;
}) {
  const v = value ?? { giornatePerGirone: 7, numeroGironi: 5, homeAdvantageEnabled: true, homeAdvantageBonus: 3, gironeNeutro: [] };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <RowLabel label="Giornate per girone" description="Solitamente n-1 per n squadre (es. 7 per 8 squadre)" />
        <NumInput value={v.giornatePerGirone} min={1} max={37} onChange={n => onChange({ ...v, giornatePerGirone: n })} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <RowLabel label="Numero di gironi" description="Quante volte si ripete il ciclo completo" />
        <NumInput value={v.numeroGironi} min={1} max={10} onChange={n => onChange({ ...v, numeroGironi: n })} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <RowLabel label="Vantaggio campo" description="Bonus in punti per il padrone di casa" />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Switch checked={v.homeAdvantageEnabled} onCheckedChange={b => onChange({ ...v, homeAdvantageEnabled: b })} />
          {v.homeAdvantageEnabled && (
            <NumInput value={v.homeAdvantageBonus} min={0} max={10} step={0.5} onChange={n => onChange({ ...v, homeAdvantageBonus: n })} />
          )}
        </div>
      </div>
    </div>
  );
}

function CoppaSection({ value, onChange }: {
  value: CompetitionConfig["coppa"];
  onChange: (v: CompetitionConfig["coppa"]) => void;
}) {
  const v = value ?? { twoLegs: false, tieBreakInMatch: "penalties", bracket: [] };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <RowLabel label="Andata e ritorno" description="Ogni eliminatoria si disputa su due giornate" />
        <Switch checked={v.twoLegs} onCheckedChange={b => onChange({ ...v, twoLegs: b })} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <RowLabel label="Spareggio in partita" />
        <select value={v.tieBreakInMatch} onChange={e => onChange({ ...v, tieBreakInMatch: e.target.value as typeof v.tieBreakInMatch })} style={{
          padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
          fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink)", background: "var(--surface)",
        }}>
          <option value="penalties">Rigori (sorteggio fanta)</option>
          <option value="fanta_extra_time">Supplementari (50% voti)</option>
          <option value="away_goals">Gol fuori casa (legacy)</option>
        </select>
      </div>
    </div>
  );
}

function FormulaUnoSection({ value, onChange }: {
  value: CompetitionConfig["formulaUno"];
  onChange: (v: CompetitionConfig["formulaUno"]) => void;
}) {
  const v = value ?? { pointsScale: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] };
  const scaleStr = v.pointsScale.join(", ");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <RowLabel label="Scala punti per posizione" description="Valori separati da virgola. Es. 25,18,15,12,10,8,6,4,2,1" />
      <input
        type="text"
        defaultValue={scaleStr}
        onBlur={e => {
          const parsed = e.target.value.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
          onChange({ ...v, pointsScale: parsed });
        }}
        style={{
          padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)",
          fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink)", background: "var(--surface)",
        }}
      />
    </div>
  );
}

function PunteggioAssolutoSection({ value, onChange }: {
  value: CompetitionConfig["punteggioAssoluto"];
  onChange: (v: CompetitionConfig["punteggioAssoluto"]) => void;
}) {
  const v = value ?? { excludeWorstNGiornate: 0 };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <RowLabel label="Scarta le N peggiori giornate" description="0 = nessuno scarto" />
      <NumInput value={v.excludeWorstNGiornate} min={0} max={10} onChange={n => onChange({ ...v, excludeWorstNGiornate: n })} />
    </div>
  );
}

// ─── Sezione "Regole ereditate dalla federazione" (SOLA LETTURA) ──────────────
// K2: l'editor NON espone controlli per i punteggi-giocatore della federazione.
// K5: in futuro, il motore di scoring leggerà:
//   - snapshot di federation.rules (base) catturato all'avvio della competizione
//   - addizioni di competition.config (formato/classifica/extra)
//   Le addizioni si congelano all'avvio della competizione (stesso meccanismo
//   snapshot usato da leagues.snapshot_rules quando si avvia l'asta).

function InheritedRulesSection({ rules }: { rules?: FederationRules | null }) {
  const r = rules ?? DEFAULT_RULES;
  const bm = r.bonusMalus;
  const gt = r.goalThresholds;

  const bmRows: Array<[string, number]> = [
    ["Gol (attaccante)", bm.goalAtt],
    ["Gol (centrocampista)", bm.goalMid],
    ["Gol (difensore)", bm.goalDef],
    ["Gol (portiere)", bm.goalGk],
    ["Assist", bm.assist],
    ["Passaggio chiave", bm.keyPassChain],
    ["Rigore parato", bm.penaltySaved],
    ["Clean sheet (portiere)", bm.cleanSheetGk],
    ["Gol subito (portiere)", bm.goalConcededGk],
    ["Ammonizione", bm.yellow],
    ["Espulsione", bm.red],
    ["Autogol", bm.ownGoal],
  ];

  return (
    <Card style={{ borderColor: "rgba(31,71,51,0.15)", background: "rgba(239,230,211,0.15)" }}>
      <CardHeader className="pb-2">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Info size={14} style={{ color: "var(--green-deep)", flexShrink: 0 }} />
          <CardTitle className="text-sm" style={{ color: "var(--green-deep)" }}>
            Regole ereditate dalla federazione — sola lettura
          </CardTitle>
        </div>
        <CardDescription style={{ fontSize: 12 }}>
          Le regole di punteggio giocatore sono definite nella federazione e non sono modificabili qui.
          Le addizioni di formato (sopra) sono le uniche regole configurabili a livello competizione.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "2px 24px" }}>
          {bmRows.map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid rgba(31,71,51,0.07)" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-mid)" }}>{label}</span>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 12,
                color: value > 0 ? "var(--green-deep)" : value < 0 ? "#b91c1c" : "var(--ink-dim)",
                fontWeight: 600,
              }}>
                {value > 0 ? `+${value}` : value}
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: "6px 10px", background: "rgba(31,71,51,0.06)", borderRadius: 6, display: "flex", gap: 20 }}>
          <div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Base portiere</span>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{gt.base}</div>
          </div>
          <div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Soglia / step</span>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{gt.base} + {gt.step} × gol</div>
          </div>
          <div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Max gol calcolati</span>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{gt.maxGoals}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── CompetitionEditor ────────────────────────────────────────────────────────

export function CompetitionEditor({
  competition,
  teams,
  federationRules,
  onSave,
  isSaving,
}: CompetitionEditorProps) {
  const [name, setName] = useState(competition.name);
  const [description, setDescription] = useState(competition.description ?? "");
  const [season, setSeason] = useState(competition.season);
  const [startGiornata, setStartGiornata] = useState(competition.start_giornata);
  const [endGiornata, setEndGiornata] = useState(competition.end_giornata);
  const [active, setActive] = useState(competition.active);
  const [completed, setCompleted] = useState(competition.completed);
  const [config, setConfig] = useState<CompetitionConfig>(() => mergeConfig(competition.config));

  useEffect(() => {
    setName(competition.name);
    setDescription(competition.description ?? "");
    setSeason(competition.season);
    setStartGiornata(competition.start_giornata);
    setEndGiornata(competition.end_giornata);
    setActive(competition.active);
    setCompleted(competition.completed);
    setConfig(mergeConfig(competition.config));
  }, [competition.id]);

  const type = competition.type as CompetitionType;

  const updateConfig = (patch: Partial<CompetitionConfig>) =>
    setConfig(c => ({ ...c, ...patch }));

  const handleSave = () => {
    onSave({
      name,
      description,
      season,
      start_giornata: startGiornata,
      end_giornata: endGiornata,
      active,
      completed,
      settings: config,
    });
  };

  const scopeType = competition.scope_type ?? "league";
  const scopeId = competition.scope_id ?? competition.league_id;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Identità ── */}
      <Section title="Identità" description="Nome, descrizione e periodo di svolgimento.">
        <div>
          <Label style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-mid)", marginBottom: 4, display: "block" }}>Nome</Label>
          <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-comp-name" />
        </div>
        <div>
          <Label style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-mid)", marginBottom: 4, display: "block" }}>Descrizione</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} className="min-h-[80px]" data-testid="input-comp-desc" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div>
            <Label style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-mid)", marginBottom: 4, display: "block" }}>Stagione</Label>
            <Input type="number" value={season} onChange={e => setSeason(Number(e.target.value))} style={{ fontFamily: "var(--font-mono)" }} />
          </div>
          <div>
            <Label style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-mid)", marginBottom: 4, display: "block" }}>Giornata inizio</Label>
            <Input type="number" min={1} max={38} value={startGiornata} onChange={e => setStartGiornata(Number(e.target.value))} style={{ fontFamily: "var(--font-mono)" }} data-testid="input-comp-start" />
          </div>
          <div>
            <Label style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-mid)", marginBottom: 4, display: "block" }}>Giornata fine</Label>
            <Input type="number" min={1} max={38} value={endGiornata} onChange={e => setEndGiornata(Number(e.target.value))} style={{ fontFamily: "var(--font-mono)" }} data-testid="input-comp-end" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <Switch checked={active} onCheckedChange={setActive} />
            <RowLabel label="Attiva" description="Competizione in corso" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <Switch checked={completed} onCheckedChange={setCompleted} />
            <RowLabel label="Conclusa" />
          </div>
        </div>
      </Section>

      {/* ── Tipo + Scope (sola lettura) ── */}
      <Section title="Tipo e scope" description="Il tipo determina il formato di gioco. Lo scope è la struttura organizzativa di appartenenza.">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Label style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-mid)", marginBottom: 4, display: "block" }}>Formato</Label>
            <div style={{
              padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
              background: "rgba(0,0,0,0.03)", fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink)",
            }}>
              {TYPE_LABEL[type] ?? type}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)", marginTop: 4 }}>
              Il tipo non è modificabile dopo la creazione.
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Label style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-mid)", marginBottom: 4, display: "block" }}>Scope</Label>
            <div style={{
              padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(31,71,51,0.2)",
              background: "rgba(31,71,51,0.04)", display: "flex", alignItems: "center", gap: 8,
            }}>
              <Badge variant="outline" style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase" }}>
                {scopeType}
              </Badge>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-mid)" }}>{scopeId}</span>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)", marginTop: 4 }}>
              Oggi: lega. Futuro: federazione (interleghe).
            </div>
          </div>
        </div>
      </Section>

      {/* ── Partecipanti ── */}
      <Section title="Partecipanti" description="Squadre ammesse. Vuoto = tutte le squadre della lega.">
        {teams.length === 0 ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-dim)" }}>Nessuna squadra nella lega.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {teams.map(t => {
              const selected = config.participantTeamIds.length === 0 || config.participantTeamIds.includes(t.id);
              const isExplicit = config.participantTeamIds.length > 0;
              const checked = config.participantTeamIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    if (!isExplicit) {
                      updateConfig({ participantTeamIds: teams.filter(x => x.id !== t.id).map(x => x.id) });
                    } else if (checked) {
                      const next = config.participantTeamIds.filter(id => id !== t.id);
                      updateConfig({ participantTeamIds: next.length === teams.length ? [] : next });
                    } else {
                      const next = [...config.participantTeamIds, t.id];
                      updateConfig({ participantTeamIds: next.length === teams.length ? [] : next });
                    }
                  }}
                  style={{
                    padding: "5px 12px", borderRadius: 99,
                    border: `1px solid ${selected ? "var(--green-deep)" : "var(--border)"}`,
                    background: selected ? "rgba(31,71,51,0.1)" : "transparent",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)", fontSize: 13,
                    color: selected ? "var(--green-deep)" : "var(--ink-mid)",
                    transition: "all 0.1s",
                  }}
                >
                  {t.name}
                </button>
              );
            })}
            {config.participantTeamIds.length > 0 && (
              <button
                onClick={() => updateConfig({ participantTeamIds: [] })}
                style={{
                  padding: "5px 12px", borderRadius: 99, border: "1px dashed var(--border)",
                  background: "transparent", cursor: "pointer",
                  fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)",
                }}
              >
                Seleziona tutte
              </button>
            )}
          </div>
        )}
        {config.participantTeamIds.length === 0 && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)" }}>
            Tutte le squadre partecipano — clicca una squadra per escluderla.
          </div>
        )}
      </Section>

      {/* ── Regole additive di formato ── */}
      <Section title="Regole additive di formato" description="Scoring, criteri di spareggio e premi. Queste regole si aggiungono al punteggio federazione — non lo sostituiscono.">

        {SCORING_TYPES.includes(type) && (
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
              Punteggio vittoria / pareggio / sconfitta
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              {(["win", "draw", "loss"] as const).map(k => (
                <div key={k} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {k === "win" ? "Vittoria" : k === "draw" ? "Pareggio" : "Sconfitta"}
                  </div>
                  <NumInput
                    value={config.scoring[k]}
                    min={-5} max={10} step={1}
                    onChange={n => updateConfig({ scoring: { ...config.scoring, [k]: n } })}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
            Criteri di spareggio (in ordine)
          </div>
          <TiebreakerEditor
            type={type}
            tiebreakers={config.tiebreakers}
            onChange={tiebreakers => updateConfig({ tiebreakers })}
          />
        </div>

        <div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
            Premi (facoltativi)
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)", marginBottom: 8 }}>
            Es. "1°" → "Cena offerta da tutti". Solo testo, nessun valore monetario.
          </div>
          {Object.entries(config.prizes).map(([pos, prize], idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <Input
                placeholder="Posizione (es. 1°)"
                defaultValue={pos}
                onBlur={e => {
                  const newPrizes = { ...config.prizes };
                  delete newPrizes[pos];
                  if (e.target.value) newPrizes[e.target.value] = prize;
                  updateConfig({ prizes: newPrizes });
                }}
                style={{ width: 120, fontFamily: "var(--font-mono)", fontSize: 12 }}
              />
              <Input
                placeholder="Premio"
                defaultValue={prize}
                onBlur={e => updateConfig({ prizes: { ...config.prizes, [pos]: e.target.value } })}
                style={{ flex: 1, fontSize: 13 }}
              />
              <button onClick={() => {
                const p = { ...config.prizes };
                delete p[pos];
                updateConfig({ prizes: p });
              }} style={{ border: "none", background: "none", cursor: "pointer", color: "#b91c1c", padding: "0 4px" }}>
                <X size={14} />
              </button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => {
            const n = Object.keys(config.prizes).length + 1;
            updateConfig({ prizes: { ...config.prizes, [`${n}°`]: "" } });
          }}>
            <Plus size={12} /> Aggiungi premio
          </Button>
        </div>
      </Section>

      {/* ── Impostazioni tipo-specifiche ── */}
      {(type === "campionato" || type === "coppa" || type === "formula_uno" || type === "punteggio_assoluto" || type === "battle_royale") && (
        <Section title={`Impostazioni ${TYPE_LABEL[type]?.split(" ")[0] ?? type}`} description="Parametri specifici per il formato selezionato.">
          {type === "campionato" && (
            <CampionatoSection
              value={config.campionato}
              onChange={v => updateConfig({ campionato: v })}
            />
          )}
          {type === "coppa" && (
            <CoppaSection
              value={config.coppa}
              onChange={v => updateConfig({ coppa: v })}
            />
          )}
          {type === "battle_royale" && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <RowLabel label="Vantaggio campo" description="Bonus per il padrone di casa nei match paralleli" />
              <Switch
                checked={config.battleRoyale?.homeAdvantageEnabled ?? false}
                onCheckedChange={b => updateConfig({ battleRoyale: { homeAdvantageEnabled: b } })}
              />
            </div>
          )}
          {type === "formula_uno" && (
            <FormulaUnoSection
              value={config.formulaUno}
              onChange={v => updateConfig({ formulaUno: v })}
            />
          )}
          {type === "punteggio_assoluto" && (
            <PunteggioAssolutoSection
              value={config.punteggioAssoluto}
              onChange={v => updateConfig({ punteggioAssoluto: v })}
            />
          )}
        </Section>
      )}

      {/* ── Regole ereditate dalla federazione (K2 — sola lettura) ── */}
      <InheritedRulesSection rules={federationRules} />

      {/* ── Salva ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          data-testid="button-save-comp"
          style={{ gap: 8 }}
        >
          <Save size={15} />
          {isSaving ? "Salvataggio..." : "Salva competizione"}
        </Button>
      </div>
    </div>
  );
}
