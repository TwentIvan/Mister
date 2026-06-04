/**
 * RulesEditor — editor delle regole di punteggio FederationRules.
 * Tipi speculari a lib/db/src/schema/federations.ts (non importati da @workspace/db,
 * che è server-only).
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Trophy } from "lucide-react";

// ─── Tipi locali ──────────────────────────────────────────────────────────────

export interface BonusMalus {
  goalAtt: number;
  goalMid: number;
  goalDef: number;
  goalGk: number;
  assist: number;
  keyPassChain: number;
  penaltySaved: number;
  cleanSheetGk: number;
  goalConcededGk: number;
  penaltyScored: number;
  penaltyMissed: number;
  yellow: number;
  red: number;
  ownGoal: number;
  goalConcededDef: number;
}

export interface GoalThresholds {
  base: number;
  step: number;
  maxGoals: number;
}

export interface DefenseModifier {
  enabled: boolean;
  useFullDefense: boolean;
  table: Record<string, number>;
}

export interface MidfieldModifier {
  enabled: boolean;
  table: Record<string, number>;
}

export interface HomeAdvantage {
  enabled: boolean;
  bonusPoints: number;
}

export interface SubstitutionRules {
  autoSubstitution: boolean;
  maxAutoSubs: number;
  fallbackNoVote: "sv_zero" | "exclude" | "average";
}

export interface FederationRules {
  bonusMalus: BonusMalus;
  goalThresholds: GoalThresholds;
  defenseModifier: DefenseModifier;
  midfieldModifier: MidfieldModifier;
  homeAdvantage: HomeAdvantage;
  substitutions: SubstitutionRules;
}

export const DEFAULT_RULES: FederationRules = {
  bonusMalus: {
    goalAtt: 3.0,
    goalMid: 3.5,
    goalDef: 4.0,
    goalGk: 6.0,
    assist: 1.0,
    keyPassChain: 0.5,
    penaltySaved: 3.0,
    cleanSheetGk: 1.0,
    goalConcededGk: -1.0,
    penaltyScored: 3.0,
    penaltyMissed: -3.0,
    yellow: -0.5,
    red: -1.0,
    ownGoal: -2.0,
    goalConcededDef: 0.0,
  },
  goalThresholds: { base: 66, step: 6, maxGoals: 8 },
  defenseModifier: {
    enabled: true,
    useFullDefense: false,
    table: {
      "<=5.0": -1.0,
      "5.0-5.5": -0.5,
      "5.5-6.0": 0.0,
      "6.0-6.5": 1.0,
      "6.5-7.0": 3.0,
      "7.0-7.5": 5.0,
      ">7.5": 6.0,
    },
  },
  midfieldModifier: {
    enabled: false,
    table: {
      "<=5.5": -0.5,
      "5.5-6.0": 0.0,
      "6.0-6.5": 1.0,
      "6.5-7.0": 2.0,
      ">7.0": 3.0,
    },
  },
  homeAdvantage: { enabled: true, bonusPoints: 3.0 },
  substitutions: { autoSubstitution: true, maxAutoSubs: 3, fallbackNoVote: "sv_zero" },
};

// ─── Helper components ────────────────────────────────────────────────────────

function NumField({
  label,
  value,
  onChange,
  step = 0.5,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div>
        <span className="text-sm">{label}</span>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        className="w-24 h-8 font-mono text-center text-sm shrink-0"
      />
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground pt-3 pb-1 border-t">
      {label}
    </p>
  );
}

// ─── Componente principale ────────────────────────────────────────────────────

interface Props {
  rules: FederationRules;
  onChange: (r: FederationRules) => void;
}

export function RulesEditor({ rules, onChange }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const setBm = (key: keyof BonusMalus, value: number) =>
    onChange({ ...rules, bonusMalus: { ...rules.bonusMalus, [key]: value } });

  const setGt = (key: keyof GoalThresholds, value: number) =>
    onChange({ ...rules, goalThresholds: { ...rules.goalThresholds, [key]: value } });

  const setDef = (patch: Partial<DefenseModifier>) =>
    onChange({ ...rules, defenseModifier: { ...rules.defenseModifier, ...patch } });

  const setDefTable = (k: string, v: number) =>
    onChange({
      ...rules,
      defenseModifier: {
        ...rules.defenseModifier,
        table: { ...rules.defenseModifier.table, [k]: v },
      },
    });

  const setMid = (patch: Partial<MidfieldModifier>) =>
    onChange({ ...rules, midfieldModifier: { ...rules.midfieldModifier, ...patch } });

  const setMidTable = (k: string, v: number) =>
    onChange({
      ...rules,
      midfieldModifier: {
        ...rules.midfieldModifier,
        table: { ...rules.midfieldModifier.table, [k]: v },
      },
    });

  const setHome = (patch: Partial<HomeAdvantage>) =>
    onChange({ ...rules, homeAdvantage: { ...rules.homeAdvantage, ...patch } });

  const setSubs = (patch: Partial<SubstitutionRules>) =>
    onChange({ ...rules, substitutions: { ...rules.substitutions, ...patch } });

  const bm = rules.bonusMalus;
  const gt = rules.goalThresholds;
  const dm = rules.defenseModifier;
  const mm = rules.midfieldModifier;
  const ha = rules.homeAdvantage;
  const sb = rules.substitutions;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Regole di punteggio</CardTitle>
        </div>
        <CardDescription>
          Bonus, malus, soglie di conversione gol e modificatori.
          Le modifiche valgono per nuove leghe/stagioni — le leghe già avviate usano le regole congelate al primo avvio asta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* ── BONUS / MALUS ──────────────────────────────────── */}
        <div>
          <p className="text-sm font-semibold mb-3">Bonus e malus</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 divide-y md:divide-y-0">
            {/* Colonna sinistra */}
            <div className="divide-y">
              <SectionDivider label="Gol" />
              <NumField label="Gol portiere"       value={bm.goalGk}  onChange={(v) => setBm("goalGk",  v)} />
              <NumField label="Gol difensore"      value={bm.goalDef} onChange={(v) => setBm("goalDef", v)} />
              <NumField label="Gol centrocampista" value={bm.goalMid} onChange={(v) => setBm("goalMid", v)} />
              <NumField label="Gol attaccante"     value={bm.goalAtt} onChange={(v) => setBm("goalAtt", v)} />

              <SectionDivider label="Azioni costruttive" />
              <NumField label="Assist"                 value={bm.assist}       onChange={(v) => setBm("assist",       v)} />
              <NumField label="Catena passaggi chiave" value={bm.keyPassChain} onChange={(v) => setBm("keyPassChain", v)}
                hint="Passaggi che precedono direttamente il gol" />

              <SectionDivider label="Calci di rigore" />
              <NumField label="Rigore parato"   value={bm.penaltySaved}  onChange={(v) => setBm("penaltySaved",  v)} />
              <NumField label="Rigore segnato"  value={bm.penaltyScored} onChange={(v) => setBm("penaltyScored", v)} />
              <NumField label="Rigore sbagliato" value={bm.penaltyMissed} onChange={(v) => setBm("penaltyMissed", v)} />
            </div>

            {/* Colonna destra */}
            <div className="divide-y">
              <SectionDivider label="Clean sheet e gol subiti" />
              <NumField label="Clean sheet (portiere)"  value={bm.cleanSheetGk}    onChange={(v) => setBm("cleanSheetGk",    v)} />
              <NumField label="Gol subiti (portiere)"   value={bm.goalConcededGk}  onChange={(v) => setBm("goalConcededGk",  v)} />
              <NumField label="Gol subiti (difensore)"  value={bm.goalConcededDef} onChange={(v) => setBm("goalConcededDef", v)}
                hint="Per gol concesso. Di norma 0 se attivi il modificatore difesa" />

              <SectionDivider label="Disciplina" />
              <NumField label="Ammonizione" value={bm.yellow}  onChange={(v) => setBm("yellow",  v)} />
              <NumField label="Espulsione"  value={bm.red}     onChange={(v) => setBm("red",     v)} />
              <NumField label="Autogol"     value={bm.ownGoal} onChange={(v) => setBm("ownGoal", v)} />
            </div>
          </div>
        </div>

        {/* ── SOGLIE GOL ─────────────────────────────────────── */}
        <div className="border-t pt-4">
          <p className="text-sm font-semibold mb-3">Conversione punteggio → gol</p>
          <p className="text-xs text-muted-foreground mb-3">
            Formula: 1° gol a &ge; <span className="font-mono">{gt.base}</span> punti;
            ogni gol successivo richiede +<span className="font-mono">{gt.step}</span> punti;
            massimo <span className="font-mono">{gt.maxGoals}</span> gol/giornata.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Punteggio base 1° gol</Label>
              <Input
                type="number" step={1} min={50} max={90} value={gt.base}
                onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) setGt("base", n); }}
                className="font-mono text-center h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Incremento (punti)</Label>
              <Input
                type="number" step={1} min={1} max={20} value={gt.step}
                onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) setGt("step", n); }}
                className="font-mono text-center h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Gol massimi</Label>
              <Input
                type="number" step={1} min={1} max={20} value={gt.maxGoals}
                onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) setGt("maxGoals", n); }}
                className="font-mono text-center h-9"
              />
            </div>
          </div>
        </div>

        {/* ── AVANZATE (collapsible) ─────────────────────────── */}
        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className="flex items-center gap-2 text-sm font-semibold w-full text-left group"
          >
            {advancedOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            Avanzate
            <span className="ml-1 text-[10px] font-mono font-normal text-muted-foreground">
              — modificatori difesa/centrocampo, vantaggio campo, sostituzioni
            </span>
          </button>

          {advancedOpen && (
            <div className="mt-4 space-y-6">

              {/* Modificatore difesa */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">Modificatore difesa</p>
                    <p className="text-xs text-muted-foreground">Bonus al totale squadra in base alla media voto dei centrali.</p>
                  </div>
                  <Switch
                    checked={dm.enabled}
                    onCheckedChange={(v) => setDef({ enabled: v })}
                    aria-label="Abilita modificatore difesa"
                  />
                </div>

                {dm.enabled && (
                  <div className="space-y-2 pl-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                      <input
                        type="checkbox"
                        checked={dm.useFullDefense}
                        onChange={(e) => setDef({ useFullDefense: e.target.checked })}
                        className="h-4 w-4 rounded border accent-primary"
                      />
                      Considera tutta la linea difensiva (non solo i centrali)
                    </label>
                    <div className="mt-3 border rounded-md overflow-hidden">
                      <div className="grid grid-cols-2 bg-muted/50 px-3 py-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Media voto difesa</span>
                        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground text-right">Bonus (fanta-pt)</span>
                      </div>
                      {Object.entries(dm.table).map(([band, val]) => (
                        <div key={band} className="grid grid-cols-2 items-center px-3 py-1 border-t">
                          <span className="font-mono text-sm text-muted-foreground">{band}</span>
                          <div className="flex justify-end">
                            <Input
                              type="number" step={0.5} value={val}
                              onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n)) setDefTable(band, n); }}
                              className="w-20 h-7 font-mono text-center text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modificatore centrocampo */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">Modificatore centrocampo</p>
                    <p className="text-xs text-muted-foreground">Bonus al totale squadra in base alla media voto dei centrocampisti.</p>
                  </div>
                  <Switch
                    checked={mm.enabled}
                    onCheckedChange={(v) => setMid({ enabled: v })}
                    aria-label="Abilita modificatore centrocampo"
                  />
                </div>

                {mm.enabled && (
                  <div className="border rounded-md overflow-hidden">
                    <div className="grid grid-cols-2 bg-muted/50 px-3 py-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Media voto centrocampo</span>
                      <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground text-right">Bonus (fanta-pt)</span>
                    </div>
                    {Object.entries(mm.table).map(([band, val]) => (
                      <div key={band} className="grid grid-cols-2 items-center px-3 py-1 border-t">
                        <span className="font-mono text-sm text-muted-foreground">{band}</span>
                        <div className="flex justify-end">
                          <Input
                            type="number" step={0.5} value={val}
                            onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n)) setMidTable(band, n); }}
                            className="w-20 h-7 font-mono text-center text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vantaggio campo */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">Vantaggio campo</p>
                    <p className="text-xs text-muted-foreground">Bonus al punteggio del padrone di casa. Applicato prima della conversione in gol.</p>
                  </div>
                  <Switch
                    checked={ha.enabled}
                    onCheckedChange={(v) => setHome({ enabled: v })}
                    aria-label="Abilita vantaggio campo"
                  />
                </div>
                {ha.enabled && (
                  <NumField
                    label="Bonus casa (fanta-punti)"
                    value={ha.bonusPoints}
                    onChange={(v) => setHome({ bonusPoints: v })}
                    step={0.5}
                    min={0}
                    max={10}
                  />
                )}
              </div>

              {/* Sostituzioni automatiche */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">Sostituzioni automatiche</p>
                    <p className="text-xs text-muted-foreground">Sostituzione automatica dei titolari senza voto con la panchina.</p>
                  </div>
                  <Switch
                    checked={sb.autoSubstitution}
                    onCheckedChange={(v) => setSubs({ autoSubstitution: v })}
                    aria-label="Abilita sostituzioni automatiche"
                  />
                </div>
                {sb.autoSubstitution && (
                  <div className="space-y-3 pl-1">
                    <NumField
                      label="Max sostituzioni automatiche"
                      value={sb.maxAutoSubs}
                      onChange={(v) => setSubs({ maxAutoSubs: Math.round(v) })}
                      step={1}
                      min={1}
                      max={11}
                    />
                    <div className="flex items-center justify-between py-1.5">
                      <div>
                        <span className="text-sm">Comportamento per SV</span>
                        <p className="text-xs text-muted-foreground">Cosa fare se il titolare ha SV (senza voto).</p>
                      </div>
                      <Select
                        value={sb.fallbackNoVote}
                        onValueChange={(v) => setSubs({ fallbackNoVote: v as SubstitutionRules["fallbackNoVote"] })}
                      >
                        <SelectTrigger className="w-44 h-8 font-mono text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sv_zero">SV = 0 punti</SelectItem>
                          <SelectItem value="exclude">Escludi dalla formazione</SelectItem>
                          <SelectItem value="average">Usa media giornata</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
