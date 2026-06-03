import { useState } from "react";
import {
  useManualAddPlayer,
  useManualRemovePlayer,
  useManualSetBudget,
  useListPlayers,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Trash2, Plus, Search } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SquadraInfo = {
  id: string;
  name: string;
  credits_remaining: number;
};

type Assignment = {
  player_id: number;
  player_name: string;
  role_classic: string;
  fanta_team_id: string;
  final_price_fm: number;
};

type Props = {
  auctionId: string;
  squadre: SquadraInfo[];
  assignments: Assignment[];
  onClose: () => void;
  onRefetch: () => void;
};

const ROLE_LABEL: Record<string, string> = {
  GK:  "P",
  DEF: "D",
  MID: "C",
  ATT: "A",
};

// ── CorreggiPanel ─────────────────────────────────────────────────────────────

export function CorreggiPanel({ auctionId, squadre, assignments, onClose, onRefetch }: Props) {
  const [activeTeamId, setActiveTeamId] = useState<string>(squadre[0]?.id ?? "");
  const [searchQuery,  setSearchQuery]  = useState("");
  const [addPrice,     setAddPrice]     = useState<string>("");
  const [budgetInput,  setBudgetInput]  = useState<string>("");
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);

  const addMutation    = useManualAddPlayer();
  const removeMutation = useManualRemovePlayer();
  const budgetMutation = useManualSetBudget();

  const searchParams = { search: searchQuery || undefined, limit: 20 };
  const { data: playerSearchData } = useListPlayers(
    searchParams,
    { query: { enabled: searchQuery.length >= 2, queryKey: getListPlayersQueryKey(searchParams) } },
  );

  const isBusy = addMutation.isPending || removeMutation.isPending || budgetMutation.isPending;

  const activeTeam       = squadre.find((t) => t.id === activeTeamId);
  const teamAssignments  = assignments.filter((a) => a.fanta_team_id === activeTeamId);

  const clearError = () => setErrorMsg(null);

  // ── RIMUOVI ───────────────────────────────────────────────────────────────

  const handleRemove = async (playerId: number) => {
    clearError();
    try {
      await removeMutation.mutateAsync({
        id: auctionId,
        data: { fanta_team_id: activeTeamId, player_id: playerId },
      });
      onRefetch();
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string } })?.data;
      setErrorMsg(body?.error ?? "Errore rimozione giocatore.");
    }
  };

  // ── AGGIUNGI ──────────────────────────────────────────────────────────────

  const handleAdd = async (playerId: number) => {
    const price = parseInt(addPrice, 10);
    if (!price || price < 1) {
      setErrorMsg("Inserire un prezzo valido (≥ 1 FM).");
      return;
    }
    clearError();
    try {
      await addMutation.mutateAsync({
        id: auctionId,
        data: { fanta_team_id: activeTeamId, player_id: playerId, price_fm: price },
      });
      setSearchQuery("");
      setAddPrice("");
      onRefetch();
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string } })?.data;
      setErrorMsg(body?.error ?? "Errore aggiunta giocatore.");
    }
  };

  // ── BUDGET ────────────────────────────────────────────────────────────────

  const handleBudget = async () => {
    const credits = parseInt(budgetInput, 10);
    if (isNaN(credits) || credits < 0) {
      setErrorMsg("Budget non valido.");
      return;
    }
    clearError();
    try {
      await budgetMutation.mutateAsync({
        id: auctionId,
        data: { fanta_team_id: activeTeamId, credits_remaining: credits },
      });
      setBudgetInput("");
      onRefetch();
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string } })?.data;
      setErrorMsg(body?.error ?? "Errore aggiornamento budget.");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-background border shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="font-serif text-lg font-bold text-primary">Correggi rose e budget</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Team tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-1 overflow-x-auto shrink-0">
          {squadre.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveTeamId(t.id); clearError(); }}
              className={[
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-mono transition-colors",
                t.id === activeTeamId
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              ].join(" ")}
            >
              {t.name}
              <span className="ml-1.5 opacity-70">{t.credits_remaining} FM</span>
            </button>
          ))}
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="mx-4 mt-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive font-mono">
            {errorMsg}
          </div>
        )}

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-5">

          {/* ── Rosa attuale ─────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Rosa corrente
              {teamAssignments.length === 0 && (
                <span className="ml-2 text-muted-foreground/60 normal-case tracking-normal">— nessun giocatore</span>
              )}
            </h3>
            {teamAssignments.length > 0 && (
              <ul className="divide-y divide-border rounded-md border overflow-hidden">
                {teamAssignments.map((a) => (
                  <li key={a.player_id} className="flex items-center gap-3 px-3 py-2 bg-card hover:bg-muted/30 transition-colors">
                    <span className="w-5 text-center text-xs font-mono font-bold text-muted-foreground">
                      {ROLE_LABEL[a.role_classic] ?? a.role_classic}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate">{a.player_name}</span>
                    <span className="text-xs font-mono text-muted-foreground">{a.final_price_fm} FM</span>
                    <button
                      onClick={() => handleRemove(a.player_id)}
                      disabled={isBusy}
                      className="rounded p-1 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40"
                      title="Rimuovi dalla rosa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Aggiungi giocatore ────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Aggiungi giocatore
            </h3>
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-8 font-mono text-sm h-8"
                  placeholder="Cerca per cognome…"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); clearError(); }}
                />
              </div>
              <Input
                className="w-24 font-mono text-sm h-8"
                placeholder="FM"
                type="number"
                min={1}
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
              />
            </div>

            {searchQuery.length >= 2 && (
              <ul className="rounded-md border divide-y divide-border overflow-hidden max-h-40 overflow-y-auto">
                {(playerSearchData?.items ?? []).length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground font-mono">Nessun risultato</li>
                ) : (
                  (playerSearchData?.items ?? []).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2 bg-card hover:bg-muted/30 transition-colors">
                      <span className="w-5 text-center text-xs font-mono font-bold text-muted-foreground">
                        {ROLE_LABEL[p.role_classic] ?? p.role_classic}
                      </span>
                      <span className="flex-1 text-sm truncate">{p.name}</span>
                      <span className="text-xs font-mono text-muted-foreground">{p.real_team}</span>
                      <button
                        onClick={() => handleAdd(p.id)}
                        disabled={isBusy}
                        className="rounded p-1 hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40"
                        title="Aggiungi alla rosa"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </section>

          {/* ── Modifica budget ───────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Imposta budget
            </h3>
            <div className="flex gap-2 items-center">
              <span className="text-sm text-muted-foreground font-mono shrink-0">
                Attuale: <strong className="text-foreground">{activeTeam?.credits_remaining ?? "—"} FM</strong>
              </span>
              <Input
                className="w-28 font-mono text-sm h-8"
                placeholder="Nuovo FM"
                type="number"
                min={0}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleBudget}
                disabled={isBusy || !budgetInput}
                className="h-8 font-mono text-xs"
              >
                Aggiorna
              </Button>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t bg-muted/20 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="font-mono text-xs">
            Chiudi
          </Button>
        </div>
      </div>
    </div>
  );
}
