import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { SetupState } from "@/pages/SetupLegaPage";

interface StepRiepilogoProps {
  state: SetupState;
  onBack: () => void;
  onConfirm: () => void;
  isPending: boolean;
  error?: string;
}

export default function StepRiepilogo({
  state,
  onBack,
  onConfirm,
  isPending,
  error,
}: StepRiepilogoProps) {
  const { lega, squadre } = state;
  const rosterTotal = lega.rosterP + lega.rosterD + lega.rosterC + lega.rosterA;
  const poolTotale = rosterTotal * squadre.length;

  const MODE_LABELS: Record<string, string> = {
    classico: "Classico",
    manageriale: "Manageriale",
    manageriale_pro: "Manageriale Pro",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-[#1f4733] tracking-tight">
          Riepilogo
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Verifica le impostazioni prima di creare la lega.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#1f4733]">Lega</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Nome</span>
            <span className="font-medium">{lega.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Modalità</span>
            <span className="font-medium">{MODE_LABELS[lega.mode]}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#1f4733]">Parametri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Budget per squadra</span>
            <span className="font-mono font-bold">{lega.budgetInitial} FM</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Timer rilancio</span>
            <span className="font-mono">{lega.timerSeconds} s</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Rosa target</span>
            <span className="font-mono">
              {lega.rosterP}P · {lega.rosterD}D · {lega.rosterC}C · {lega.rosterA}A
              {" "}
              <span className="text-muted-foreground">({rosterTotal} tot)</span>
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Pool giocatori</span>
            <span className="font-mono">{poolTotale} giocatori</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#1f4733]">
            Squadre{" "}
            <span className="font-mono text-muted-foreground text-sm">({squadre.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {squadre.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-2 border rounded-md px-2 py-1.5 text-sm"
              >
                <div className="flex gap-0.5">
                  <div
                    className="w-3 h-3 rounded-full ring-1 ring-border"
                    style={{ backgroundColor: s.colorPrimary }}
                  />
                  <div
                    className="w-3 h-3 rounded-full ring-1 ring-border"
                    style={{ backgroundColor: s.colorSecondary }}
                  />
                </div>
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground text-xs font-mono">
                  "{s.nameAuction}"
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive border border-destructive/20 bg-destructive/5 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={isPending}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Squadre
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isPending}
          className="bg-[#1f4733] hover:bg-[#1f4733]/90 text-[#efe6d3] min-w-[120px]"
          data-testid="button-create-league"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creazione...
            </>
          ) : (
            "Crea lega"
          )}
        </Button>
      </div>
    </div>
  );
}
