import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Clock, Gavel, Crown } from "lucide-react";

export interface LegaData {
  name: string;
  budgetInitial: number;
  timerSeconds: number;
  rosterP: number;
  rosterD: number;
  rosterC: number;
  rosterA: number;
  mode: "classico" | "manageriale" | "manageriale_pro";
}

interface StepLegaProps {
  data: LegaData;
  onChange: (data: LegaData) => void;
  onNext: () => void;
  onCancel: () => void;
}

const MODE_DESCRIPTIONS: Record<string, string> = {
  classico:
    "Esperienza fantacalcio tradizionale: rosa di una sola stagione, formazione settimanale, voti del giornalista.",
  manageriale:
    "Contratti pluriennali e mercato attivo. Le squadre diventano patrimonio da gestire tra stagioni.",
  manageriale_pro:
    "Tutto il manageriale + clausole rescissorie, sviluppo giovanile, lega permanente.",
};

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => {
          const v = Number(e.target.value);
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className="font-mono text-right"
      />
    </div>
  );
}

export default function StepLega({ data, onChange, onNext, onCancel }: StepLegaProps) {
  const [nameError, setNameError] = useState("");

  const update = (patch: Partial<LegaData>) =>
    onChange({ ...data, ...patch });

  const rosterTotal = data.rosterP + data.rosterD + data.rosterC + data.rosterA;

  const isValid =
    data.name.trim().length >= 2 &&
    data.name.trim().length <= 50 &&
    data.budgetInitial >= 100 &&
    data.budgetInitial <= 2000 &&
    data.timerSeconds >= 3 &&
    data.timerSeconds <= 30 &&
    [data.rosterP, data.rosterD, data.rosterC, data.rosterA].every(v => v >= 1 && v <= 15);

  const handleNext = () => {
    if (!data.name.trim()) {
      setNameError("Il nome della lega è obbligatorio");
      return;
    }
    if (data.name.trim().length < 2) {
      setNameError("Minimo 2 caratteri");
      return;
    }
    setNameError("");
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-[#1f4733] tracking-tight">
          Configura la lega
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Imposta nome, modalità, budget e composizione della rosa.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-[#1f4733]" />
            Identità
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <Label htmlFor="league-name">Nome lega</Label>
            <Input
              id="league-name"
              value={data.name}
              maxLength={50}
              onChange={e => {
                setNameError("");
                update({ name: e.target.value });
              }}
              placeholder="Coppa Acerbi 2025"
              data-testid="input-league-name"
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
            <p className="text-xs text-muted-foreground text-right font-mono">
              {data.name.length} / 50
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gavel className="h-4 w-4 text-[#1f4733]" />
            Modalità
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {(["classico", "manageriale", "manageriale_pro"] as const).map(mode => {
              const isLocked = mode !== "manageriale";
              const isSelected = data.mode === mode;
              const labels: Record<string, string> = {
                classico: "Classico",
                manageriale: "Manageriale",
                manageriale_pro: "Manageriale Pro",
              };
              return (
                <div
                  key={mode}
                  className={`relative rounded-lg border-2 p-3 transition-all ${
                    isSelected
                      ? "border-[#1f4733] bg-[#1f4733]/5"
                      : isLocked
                      ? "border-border/40 opacity-50 cursor-not-allowed"
                      : "border-border cursor-pointer hover:border-[#1f4733]/50"
                  }`}
                  onClick={() => !isLocked && update({ mode })}
                  data-testid={`card-mode-${mode}`}
                >
                  {isLocked && (
                    <div className="absolute top-1.5 right-1.5">
                      <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                        In arrivo
                      </span>
                    </div>
                  )}
                  <p className={`text-sm font-semibold ${isSelected ? "text-[#1f4733]" : ""}`}>
                    {labels[mode]}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground italic">
            {MODE_DESCRIPTIONS[data.mode]}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#1f4733]" />
            Budget e timer
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <NumberInput
            label="Budget iniziale per squadra (FM)"
            value={data.budgetInitial}
            onChange={v => update({ budgetInitial: v })}
            min={100}
            max={2000}
            step={10}
          />
          <NumberInput
            label="Durata timer per rilancio (secondi)"
            value={data.timerSeconds}
            onChange={v => update({ timerSeconds: v })}
            min={3}
            max={30}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Composizione rosa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <NumberInput
              label="Portieri (P)"
              value={data.rosterP}
              onChange={v => update({ rosterP: v })}
              min={1}
              max={15}
            />
            <NumberInput
              label="Difensori (D)"
              value={data.rosterD}
              onChange={v => update({ rosterD: v })}
              min={1}
              max={15}
            />
            <NumberInput
              label="Centrocampisti (C)"
              value={data.rosterC}
              onChange={v => update({ rosterC: v })}
              min={1}
              max={15}
            />
            <NumberInput
              label="Attaccanti (A)"
              value={data.rosterA}
              onChange={v => update({ rosterA: v })}
              min={1}
              max={15}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Totale rosa target:{" "}
            <span className="font-mono font-bold text-foreground">{rosterTotal}</span>{" "}
            giocatori per squadra
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onCancel}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Annulla
        </Button>
        <Button
          onClick={handleNext}
          disabled={!isValid}
          data-testid="button-next-squadre"
        >
          Avanti: le squadre
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
