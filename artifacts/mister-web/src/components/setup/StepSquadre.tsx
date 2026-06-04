import { ArrowLeft, ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SlotCountData {
  teamCount: number;
}

interface StepSlotProps {
  teamCount: number;
  onChange: (count: number) => void;
  onNext: () => void;
  onBack: () => void;
}

const MIN_SLOTS = 4;
const MAX_SLOTS = 20;
const PRESETS = [4, 6, 8, 10, 12];

export default function StepSquadre({ teamCount, onChange, onNext, onBack }: StepSlotProps) {
  const valid = teamCount >= MIN_SLOTS && teamCount <= MAX_SLOTS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-[#1f4733] tracking-tight">
          Slot squadre
        </h1>
        <p className="text-muted-foreground mt-1 text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>
            Quanti manager possono iscriversi? I partecipanti porteranno la propria identità al momento dell'ingresso.
          </span>
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={[
                "px-5 py-2.5 rounded-md border text-sm font-mono font-bold transition-colors",
                teamCount === n
                  ? "bg-[#1f4733] text-[#efe6d3] border-[#1f4733]"
                  : "bg-background border-border text-foreground hover:border-[#1f4733]/50",
              ].join(" ")}
              data-testid={`preset-${n}`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground w-24">Personalizzato</span>
          <input
            type="number"
            min={MIN_SLOTS}
            max={MAX_SLOTS}
            value={teamCount}
            onChange={e => onChange(Number(e.target.value))}
            className="w-20 h-9 px-2 rounded-md border border-border bg-background text-center font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-[#1f4733]"
            data-testid="input-team-count"
          />
          <span className="text-xs text-muted-foreground">
            da {MIN_SLOTS} a {MAX_SLOTS} slot
          </span>
        </div>

        {!valid && (
          <p className="text-xs text-destructive">
            Il numero di slot deve essere compreso tra {MIN_SLOTS} e {MAX_SLOTS}.
          </p>
        )}

        <div className="border rounded-lg p-4 bg-muted/30 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-2xl text-[#1f4733]">{teamCount}</span>
            <span className="text-sm text-muted-foreground">slot verranno creati, tutti vuoti</span>
          </div>
          <p className="text-xs text-muted-foreground">
            L'admin riceve un codice invito da condividere. Ogni partecipante sceglie uno slot e ci attacca la propria società.
          </p>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Lega
        </Button>
        <Button
          onClick={onNext}
          disabled={!valid}
          data-testid="button-next-riepilogo"
        >
          Avanti: riepilogo
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
