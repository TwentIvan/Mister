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
import { Gavel, Timer, Users } from "lucide-react";

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
  initialTimer?: number | null;
  initialRosterP?: number | null;
  initialRosterD?: number | null;
  initialRosterC?: number | null;
  initialRosterA?: number | null;
  onConfirm: (
    timerSeconds: number,
    teamNames: Record<string, string>,
    rosterP: number,
    rosterD: number,
    rosterC: number,
    rosterA: number,
    callMode: "listone" | "chiamata",
    roleOrder: boolean,
  ) => void;
}

function NumInput({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${color}`}>{label}</span>
      <Input
        type="number"
        min={1}
        max={20}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n) && n >= 1) onChange(n);
        }}
        className="w-16 h-9 font-mono text-center text-base font-bold"
      />
    </div>
  );
}

export function AstaConfigModal({
  open,
  onOpenChange,
  teams,
  isLoading,
  initialTimer,
  initialRosterP,
  initialRosterD,
  initialRosterC,
  initialRosterA,
  onConfirm,
}: AstaConfigModalProps) {
  const [timerSeconds, setTimerSeconds] = useState(initialTimer ?? 8);
  const [rosterP, setRosterP] = useState(initialRosterP ?? 3);
  const [rosterD, setRosterD] = useState(initialRosterD ?? 8);
  const [rosterC, setRosterC] = useState(initialRosterC ?? 8);
  const [rosterA, setRosterA] = useState(initialRosterA ?? 6);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [callMode, setCallMode] = useState<"listone" | "chiamata">("listone");
  const [roleOrder, setRoleOrder] = useState(false);

  useEffect(() => {
    if (open) {
      setTimerSeconds(initialTimer ?? 8);
      setRosterP(initialRosterP ?? 3);
      setRosterD(initialRosterD ?? 8);
      setRosterC(initialRosterC ?? 8);
      setRosterA(initialRosterA ?? 6);
      setCallMode("listone");
      setRoleOrder(false);
    }
  }, [open, initialTimer, initialRosterP, initialRosterD, initialRosterC, initialRosterA]);

  useEffect(() => {
    if (open && teams.length > 0) {
      const initial: Record<string, string> = {};
      for (const t of teams) {
        initial[t.id] = t.name_auction ?? t.name;
      }
      setTeamNames(initial);
    }
  }, [open, teams]);

  const handleTeamName = (teamId: string, value: string) => {
    setTeamNames((prev) => ({ ...prev, [teamId]: value }));
  };

  const slotTotal = rosterP + rosterD + rosterC + rosterA;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Gavel className="h-5 w-5 text-primary" />
            Configura asta
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-2 pr-1">
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
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!isNaN(n)) setTimerSeconds(Math.max(5, Math.min(30, n)));
                }}
                className="w-24 font-mono text-center text-lg"
              />
              <span className="text-xs text-muted-foreground">
                Range: 5–30 s &nbsp;·&nbsp;
                {initialTimer ? `Configurato: ${initialTimer} s` : "Default: 8 s"}
              </span>
            </div>
          </div>

          {/* Modalità chiamata */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Modalità asta</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <select
                  value={callMode}
                  onChange={(e) => {
                    setCallMode(e.target.value as "listone" | "chiamata");
                    if (e.target.value !== "chiamata") setRoleOrder(false);
                  }}
                  className="h-9 rounded-md border bg-background px-3 font-mono text-sm w-48"
                >
                  <option value="listone">A listone</option>
                  <option value="chiamata">A chiamata</option>
                </select>
                <span className="text-xs text-muted-foreground">
                  {callMode === "listone"
                    ? "Avanzamento automatico dal listone"
                    : "Il banditore chiama ogni giocatore"}
                </span>
              </div>
              {callMode === "chiamata" && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={roleOrder}
                    onChange={(e) => setRoleOrder(e.target.checked)}
                    className="h-4 w-4 rounded border accent-primary"
                  />
                  <span className="text-sm font-mono">Chiamata per ordine di ruolo (P → D → C → A)</span>
                </label>
              )}
            </div>
          </div>

          {/* Composizione rosa */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />
              Composizione rosa per squadra
            </Label>
            <div className="flex items-end gap-3">
              <NumInput label="Portieri"  value={rosterP} onChange={setRosterP} color="text-amber-700" />
              <NumInput label="Difensori" value={rosterD} onChange={setRosterD} color="text-blue-700"  />
              <NumInput label="Centroc."  value={rosterC} onChange={setRosterC} color="text-green-700" />
              <NumInput label="Attacc."   value={rosterA} onChange={setRosterA} color="text-red-700"   />
              <div className="ml-auto pb-0.5 text-right">
                <span className="text-xs text-muted-foreground font-mono">Totale</span>
                <p className="font-mono font-bold text-primary text-lg leading-tight">{slotTotal}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {initialRosterP || initialRosterD || initialRosterC || initialRosterA
                ? `Configurato: ${initialRosterP ?? 3}P · ${initialRosterD ?? 8}D · ${initialRosterC ?? 8}C · ${initialRosterA ?? 6}A`
                : "Default classico: 3P · 8D · 8C · 6A = 25 giocatori"}
            </p>
          </div>

          {/* Nomi voce */}
          {teams.length > 0 && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold">Nomi per la voce</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Come il battitore chiama ogni squadra.
                </p>
              </div>
              <div className="space-y-2">
                {teams.map((team) => (
                  <div key={team.id} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground w-28 shrink-0 truncate">{team.name}</span>
                    <Input
                      value={teamNames[team.id] ?? ""}
                      onChange={(e) => handleTeamName(team.id, e.target.value)}
                      placeholder={team.name}
                      className="h-8 text-sm font-mono flex-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annulla
          </Button>
          <Button
            className="bg-[#1f4733] text-[#efe6d3] hover:bg-[#1f4733]/90 gap-2"
            onClick={() => onConfirm(timerSeconds, teamNames, rosterP, rosterD, rosterC, rosterA, callMode, roleOrder)}
            disabled={isLoading}
          >
            <Gavel className="h-4 w-4" />
            {isLoading ? "Avvio in corso…" : "Salva e Avvia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
