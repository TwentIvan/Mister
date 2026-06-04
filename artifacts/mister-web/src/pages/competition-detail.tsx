import {
  useGetCompetition, getGetCompetitionQueryKey,
  useUpdateCompetition,
  useDeleteCompetition,
  useGetFederation, getGetFederationQueryKey,
  useListFantaTeams, getListFantaTeamsQueryKey,
} from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2 } from "lucide-react";
import { CompetitionEditor, type SavePayload } from "@/components/CompetitionEditor";
import type { FederationRules } from "@/components/RulesEditor";

const TYPE_LABEL: Record<string, string> = {
  campionato: "Campionato",
  coppa: "Coppa",
  battle_royale: "Battle Royale",
  sprint_race: "Sprint Race",
  formula_uno: "Formula 1",
  punteggio_assoluto: "Punteggio Assoluto",
};

export default function CompetitionDetail() {
  const { leagueId, id } = useParams<{ leagueId: string; id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: competition, isLoading } = useGetCompetition(
    leagueId, id,
    { query: { enabled: !!(leagueId && id), queryKey: getGetCompetitionQueryKey(leagueId, id) } }
  );

  const { data: federation } = useGetFederation(
    leagueId,
    { query: { enabled: !!leagueId, queryKey: getGetFederationQueryKey(leagueId) } }
  );

  const { data: teamsData } = useListFantaTeams(
    leagueId,
    { query: { enabled: !!leagueId, queryKey: getListFantaTeamsQueryKey(leagueId) } }
  );

  const updateMutation = useUpdateCompetition();
  const deleteMutation = useDeleteCompetition();

  const federationRules = federation?.rules as FederationRules | undefined ?? null;
  const teams = (teamsData ?? []).map(t => ({ id: t.id, name: t.name ?? "" }));

  const handleSave = (values: SavePayload) => {
    updateMutation.mutate(
      { leagueId, id, data: { ...values, settings: values.settings as unknown as Record<string, unknown> } },
      {
        onSuccess: (updated) => {
          toast({ title: "Competizione aggiornata" });
          queryClient.setQueryData(getGetCompetitionQueryKey(leagueId, id), updated);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Aggiornamento fallito" });
        },
      }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(
      { leagueId, id },
      {
        onSuccess: () => {
          toast({ title: "Competizione eliminata" });
          setLocation(`/leagues/${leagueId}`);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Eliminazione fallita" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!competition) {
    return <div className="text-destructive">Competizione non trovata</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <Button variant="ghost" className="mb-2 -ml-4" onClick={() => setLocation(`/leagues/${leagueId}`)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Torna alla lega
      </Button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <Badge variant="outline" className="uppercase font-mono tracking-wider text-[10px]">
              {TYPE_LABEL[competition.type] ?? competition.type}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              Stagione {competition.season}
            </Badge>
            <Badge variant={competition.active ? "default" : "secondary"}>
              {competition.active ? "Attiva" : "Inattiva"}
            </Badge>
            {competition.completed && <Badge variant="secondary">Conclusa</Badge>}
          </div>
          <h1 className="text-3xl font-bold font-serif text-primary tracking-tight" data-testid="text-comp-name">
            {competition.name}
          </h1>
          {competition.description && (
            <p className="text-sm text-muted-foreground mt-1">{competition.description}</p>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-2 shrink-0">
              <Trash2 className="h-4 w-4" /> Elimina
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Elimina competizione</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare «{competition.name}»? L'azione non è reversibile.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <CompetitionEditor
        competition={competition}
        teams={teams}
        federationRules={federationRules}
        onSave={handleSave}
        isSaving={updateMutation.isPending}
      />
    </div>
  );
}
