import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gavel, Timer } from "lucide-react";

interface Team {
  id: string;
  name: string;
  name_auction?: string | null;
}

interface AstaConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  isLoading: boolean;
  onConfirm: (timerSeconds: number, teamNames: Record<string, string>) => void;
}

export function AstaConfigModal({
  open,
  onOpenChange,
  teams,
  isLoading,
  onConfirm,
}: AstaConfigModalProps) {
  const [timerSeconds, setTimerSeconds] = useState(8);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});

  // Inizializza i nomi quando il modal si apre
  useEffect(() => {
    if (open) {
      setTimerSeconds(8);
      const initial: Record<string, string> = {};
      for (const t of teams) {
        initial[t.id] = t.name_auction ?? t.name;
      }
      setTeamNames(initial);
    }
  }, [open, teams]);

  const handleTimerChange = (val: string) => {
    const n = parseInt(val, 10);
    if (!isNaN(n)) setTimerSeconds(Math.max(5, Math.min(30, n)));
  };

  const handleTeamName = (teamId: string, value: string) => {
    setTeamNames((prev) => ({ ...prev, [teamId]: value }));
  };

  const handleConfirm = () => {
    onConfirm(timerSeconds, teamNames);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Gavel className="h-5 w-5 text-primary" />
            Configura asta
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-2">
          {/* Timer */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Timer className="h-4 w-4 text-muted-foreground" />
              Durata rilancio (secondi)
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={5}
                max={30}
                value={timerSeconds}
                onChange={(e) => handleTimerChange(e.target.value)}
                className="w-28 font-mono text-center text-lg"
              />
              <span className="text-xs text-muted-foreground">Range: 5–30 s. Default: 8 s.</span>
            </div>
          </div>

          {/* Nomi voce per squadra */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Nomi per la voce</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Il nome che il battitore usa per ogni squadra. Precompilato dal nome asta attuale.
              </p>
            </div>
            <div className="space-y-2">
              {teams.map((team) => (
                <div key={team.id} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 font-mono">{team.name}</p>
                    <Input
                      value={teamNames[team.id] ?? ""}
                      onChange={(e) => handleTeamName(team.id, e.target.value)}
                      placeholder={team.name}
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annulla
          </Button>
          <Button
            className="bg-[#1f4733] text-[#efe6d3] hover:bg-[#1f4733]/90 gap-2"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            <Gavel className="h-4 w-4" />
            {isLoading ? "Avvio in corso..." : "Salva e Avvia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
