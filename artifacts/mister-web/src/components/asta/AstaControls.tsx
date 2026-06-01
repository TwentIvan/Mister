import { Gavel, Pause, Play, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AstaControlsProps {
  canAssign: boolean;
  isPaused: boolean;
  timerExpired: boolean;
  isLoading: boolean;
  onAggiudica: () => void;
  onPauseResume: () => void;
  onSalta: () => void;
  onTermina: () => void;
}

export function AstaControls({
  canAssign,
  isPaused,
  timerExpired,
  isLoading,
  onAggiudica,
  onPauseResume,
  onSalta,
  onTermina,
}: AstaControlsProps) {
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      <Button
        className="bg-[#1f4733] text-[#efe6d3] hover:bg-[#1f4733]/90 gap-2 px-6"
        disabled={!canAssign || isLoading}
        onClick={onAggiudica}
      >
        <Gavel className="h-4 w-4" />
        {timerExpired && canAssign ? "AGGIUDICA — PRONTO" : "Aggiudica"}
      </Button>

      <Button variant="outline" className="gap-2" onClick={onPauseResume} disabled={isLoading}>
        {isPaused ? (
          <><Play className="h-4 w-4" /> Riprendi</>
        ) : (
          <><Pause className="h-4 w-4" /> Pausa</>
        )}
      </Button>

      <Button variant="outline" className="gap-2" onClick={onSalta} disabled={isLoading}>
        <SkipForward className="h-4 w-4" />
        Salta
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" className="text-destructive hover:text-destructive gap-2" disabled={isLoading}>
            Termina asta
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminare l'asta?</AlertDialogTitle>
            <AlertDialogDescription>
              L'asta verrà chiusa. I giocatori non ancora banditi rimarranno senza assegnazione.
              Questa operazione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={onTermina} className="bg-destructive text-destructive-foreground">
              Termina asta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
