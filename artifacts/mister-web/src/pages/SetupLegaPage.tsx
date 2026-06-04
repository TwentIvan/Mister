import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useCreateLeague } from "@workspace/api-client-react";
import StepIndicator from "@/components/setup/StepIndicator";
import StepLega, { type LegaData } from "@/components/setup/StepLega";
import StepSquadre from "@/components/setup/StepSquadre";
import StepRiepilogo from "@/components/setup/StepRiepilogo";

export type SetupState = {
  step: 1 | 2 | 3;
  lega: LegaData;
  teamCount: number;
};

const DEFAULT_STATE: SetupState = {
  step: 1,
  lega: {
    name: "Coppa Acerbi 2025",
    budgetInitial: 500,
    timerSeconds: 8,
    rosterP: 3,
    rosterD: 8,
    rosterC: 8,
    rosterA: 6,
    mode: "manageriale",
    federationChoice: "new",
    federationId: undefined,
  },
  teamCount: 8,
};

export default function SetupLegaPage() {
  const [state, setState] = useState<SetupState>(DEFAULT_STATE);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const federationId = new URLSearchParams(search).get("federation_id") ?? undefined;
  const createLeagueMutation = useCreateLeague();

  const setStep = (step: 1 | 2 | 3) =>
    setState(s => ({ ...s, step }));

  const setLega = (lega: LegaData) =>
    setState(s => ({ ...s, lega }));

  const handleCreate = () => {
    createLeagueMutation.mutate(
      {
        data: {
          name: state.lega.name,
          budget_initial: state.lega.budgetInitial,
          timer_seconds: state.lega.timerSeconds,
          roster_p: state.lega.rosterP,
          roster_d: state.lega.rosterD,
          roster_c: state.lega.rosterC,
          roster_a: state.lega.rosterA,
          team_count: state.teamCount,
          ...(state.lega.federationChoice === "adopt" && state.lega.federationId
            ? { federation_id: state.lega.federationId }
            : federationId
            ? { federation_id: federationId }
            : {}),
        },
      },
      {
        onSuccess: result => {
          setLocation(`/leagues/${result.league.id}`);
        },
      },
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
      <StepIndicator step={state.step} />

      {state.step === 1 && (
        <StepLega
          data={state.lega}
          onChange={setLega}
          onNext={() => setStep(2)}
          onCancel={() => setLocation("/leagues")}
        />
      )}

      {state.step === 2 && (
        <StepSquadre
          teamCount={state.teamCount}
          onChange={count => setState(s => ({ ...s, teamCount: count }))}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {state.step === 3 && (
        <StepRiepilogo
          state={state}
          onBack={() => setStep(2)}
          onConfirm={handleCreate}
          isPending={createLeagueMutation.isPending}
          error={
            createLeagueMutation.error
              ? "Errore durante la creazione. Riprova."
              : undefined
          }
        />
      )}
    </div>
  );
}
