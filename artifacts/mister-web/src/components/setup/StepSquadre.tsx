import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Plus, Trash2, Users } from "lucide-react";

export interface SquadraData {
  name: string;
  nameAuction: string;
  colorPrimary: string;
  colorSecondary: string;
  logoUrl?: string;
}

interface StepSquadreProps {
  squadre: SquadraData[];
  onChange: (squadre: SquadraData[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const EMPTY_SQUADRA: SquadraData = {
  name: "",
  nameAuction: "",
  colorPrimary: "#1f4733",
  colorSecondary: "#efe6d3",
};

function validateSquadre(squadre: SquadraData[]): string[] {
  const errors: string[] = Array(squadre.length).fill("");
  const auctionNames = squadre.map(s => s.nameAuction.trim().toLowerCase()).filter(Boolean);
  squadre.forEach((s, i) => {
    if (!s.name.trim()) {
      errors[i] = "Nome squadra obbligatorio";
    } else if (s.name.trim().length > 50) {
      errors[i] = "Massimo 50 caratteri";
    } else if (!s.nameAuction.trim()) {
      errors[i] = "Nome all'asta obbligatorio";
    } else if (s.nameAuction.trim().length > 30) {
      errors[i] = "Massimo 30 caratteri";
    } else {
      const name = s.nameAuction.trim().toLowerCase();
      const isDuplicate = auctionNames.filter(n => n === name).length > 1;
      if (isDuplicate) {
        errors[i] = "Nome all'asta già usato da un'altra squadra";
      }
    }
  });
  return errors;
}

export default function StepSquadre({ squadre, onChange, onNext, onBack }: StepSquadreProps) {
  const [touched, setTouched] = useState<boolean[]>([]);

  const errors = validateSquadre(squadre);
  const hasErrors = errors.some(Boolean);
  const canProceed = squadre.length >= 4 && !hasErrors;

  const addSquadra = () => {
    if (squadre.length >= 8) return;
    onChange([...squadre, { ...EMPTY_SQUADRA }]);
    setTouched(t => [...t, false]);
  };

  const removeSquadra = (i: number) => {
    onChange(squadre.filter((_, idx) => idx !== i));
    setTouched(t => t.filter((_, idx) => idx !== i));
  };

  const updateSquadra = (i: number, patch: Partial<SquadraData>) => {
    const next = squadre.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange(next);
    setTouched(t => {
      const next = [...t];
      next[i] = true;
      return next;
    });
  };

  const handleNext = () => {
    setTouched(squadre.map(() => true));
    if (canProceed) onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-[#1f4733] tracking-tight">
          Le squadre
        </h1>
        <p className="text-muted-foreground mt-1 text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>
            <span className="font-mono font-bold">{squadre.length}</span> / 8 squadre · minimo 4 per iniziare l'asta
          </span>
        </p>
      </div>

      <div className="space-y-3">
        {squadre.length === 0 && (
          <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nessuna squadra aggiunta.</p>
            <p className="text-xs mt-1">Aggiungi almeno 4 squadre per procedere.</p>
          </div>
        )}

        {squadre.map((squadra, i) => {
          const showError = touched[i] && errors[i];
          return (
            <Card key={i} className="border-border/60">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-mono text-muted-foreground pt-1">
                    #{i + 1}
                  </span>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nome squadra</Label>
                      <Input
                        value={squadra.name}
                        maxLength={50}
                        placeholder="es. I Gladiatori di Roma"
                        onChange={e => updateSquadra(i, { name: e.target.value })}
                        data-testid={`input-team-name-${i}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Nome all'asta
                      </Label>
                      <Input
                        value={squadra.nameAuction}
                        maxLength={30}
                        placeholder="es. Gladiatori"
                        onChange={e => updateSquadra(i, { nameAuction: e.target.value })}
                        data-testid={`input-team-auction-${i}`}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Pronunciato al microfono dall'AI battitore
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive mt-5"
                    onClick={() => removeSquadra(i)}
                    data-testid={`button-remove-team-${i}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-4 pl-5">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Colore primario</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={squadra.colorPrimary}
                        onChange={e => updateSquadra(i, { colorPrimary: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border border-border"
                      />
                      <span className="text-xs font-mono text-muted-foreground">
                        {squadra.colorPrimary}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Colore secondario</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={squadra.colorSecondary}
                        onChange={e => updateSquadra(i, { colorSecondary: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border border-border"
                      />
                      <span className="text-xs font-mono text-muted-foreground">
                        {squadra.colorSecondary}
                      </span>
                    </div>
                  </div>
                </div>

                {showError && (
                  <p className="text-xs text-destructive pl-5">{errors[i]}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {squadre.length < 8 && (
        <Button
          variant="outline"
          className="w-full border-dashed border-[#1f4733]/40 text-[#1f4733] hover:bg-[#1f4733]/5"
          onClick={addSquadra}
          data-testid="button-add-team"
        >
          <Plus className="mr-2 h-4 w-4" />
          Aggiungi squadra
        </Button>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Lega
        </Button>
        <Button
          onClick={handleNext}
          disabled={squadre.length < 4}
          data-testid="button-next-riepilogo"
        >
          Avanti: riepilogo
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
