import { useState } from "react";
import {
  useManualAddPlayer,
  useManualRemovePlayer,
  useManualSetBudget,
  useManualUpdatePrice,
  useListPlayers,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Trash2, Plus, Search, Pencil, Check, XCircle } from "lucide-react";

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

type PlayerItem = {
  id: number;
  name: string;
  real_team: string;
  role_classic: string;
};

const ROLE_LABEL: Record<string, string> = {
  GK:  "P",
  DEF: "D",
  MID: "C",
  ATT: "A",
};

// ── CorreggiPanel ─────────────────────────────────────────────────────────────

export function CorreggiPanel({ auctionId, squadre, assignments, onClose, onRefetch }: Props) {
  // ── Stato selezione squadra (F1: combo) ───────────────────────────────────
  const [activeTeamId, setActiveTeamId] = useState<string>(squadre[0]?.id ?? "");

  // ── Stato ricerca + selezione giocatore da aggiungere (F2) ────────────────
  const [searchQuery,     setSearchQuery]    = useState("");
  const [pendingPlayer,   setPendingPlayer]  = useState<PlayerItem | null>(null);
  const [addPrice,        setAddPrice]       = useState<string>("1");

  // ── Stato modifica prezzo in rosa (F3) ────────────────────────────────────
  // editingPlayerId → quale riga è in modifica; editPrice → valore del campo
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [editPrice,       setEditPrice]       = useState<string>("");

  // ── Stato override budget (F4: invariato) ─────────────────────────────────
  const [budgetInput, setBudgetInput] = useState<string>("");

  // ── Feedback operazione ────────────────────────────────────────────────────
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addMutation         = useManualAddPlayer();
  const removeMutation      = useManualRemovePlayer();
  const budgetMutation      = useManualSetBudget();
  const updatePriceMutation = useManualUpdatePrice();

  const isBusy =
    addMutation.isPending ||
    removeMutation.isPending ||
    budgetMutation.isPending ||
    updatePriceMutation.isPending;

  // ── Ricerca giocatori (abilitata da ≥ 2 caratteri; azzerata se pendingPlayer) ──
  const searchParams = { search: searchQuery || undefined, limit: 20 };
  const { data: playerSearchData } = useListPlayers(searchParams, {
    query: { enabled: searchQuery.length >= 2, queryKey: getListPlayersQueryKey(searchParams) },
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeTeam      = squadre.find((t) => t.id === activeTeamId);
  const teamAssignments = assignments.filter((a) => a.fanta_team_id === activeTeamId);

  const clearMessages = () => { setErrorMsg(null); setSuccessMsg(null); };

  // ── F2: selezione giocatore da aggiungere ─────────────────────────────────
  const handleSelectPlayer = (p: PlayerItem) => {
    setPendingPlayer(p);
    setSearchQuery("");
    setAddPrice("1"); // default 1 FM (base d'asta minima); l'utente può modificarlo
    clearMessages();
  };

  const handleCancelAdd = () => {
    setPendingPlayer(null);
    setAddPrice("1");
    clearMessages();
  };

  // ── F2: conferma aggiunta ─────────────────────────────────────────────────
  const handleConfirmAdd = async () => {
    if (!pendingPlayer) return;
    const price = parseInt(addPrice, 10);
    if (!price || price < 1) {
      setErrorMsg("Inserire un prezzo valido (≥ 1 FM).");
      return;
    }
    clearMessages();
    try {
      await addMutation.mutateAsync({
        id: auctionId,
        data: { fanta_team_id: activeTeamId, player_id: pendingPlayer.id, price_fm: price },
      });
      const teamName = activeTeam?.name ?? activeTeamId;
      setSuccessMsg(`${pendingPlayer.name} aggiunto a ${teamName} per ${price} FM.`);
      setPendingPlayer(null);
      setAddPrice("1");
      onRefetch();
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string } })?.data;
      setErrorMsg(body?.error ?? "Errore aggiunta giocatore.");
    }
  };

  // ── F4: rimozione (invariata) ─────────────────────────────────────────────
  const handleRemove = async (playerId: number) => {
    clearMessages();
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

  // ── F3: avvia modifica prezzo ─────────────────────────────────────────────
  const handleStartEditPrice = (a: Assignment) => {
    setEditingPlayerId(a.player_id);
    setEditPrice(String(a.final_price_fm));
    clearMessages();
  };

  const handleCancelEditPrice = () => {
    setEditingPlayerId(null);
    setEditPrice("");
  };

  // ── F3: salva nuovo prezzo ────────────────────────────────────────────────
  const handleSavePrice = async (a: Assignment) => {
    const newPrice = parseInt(editPrice, 10);
    if (!newPrice || newPrice < 1) {
      setErrorMsg("Prezzo non valido (≥ 1 FM).");
      return;
    }
    if (newPrice === a.final_price_fm) {
      setEditingPlayerId(null);
      return;
    }
    clearMessages();
    try {
      const result = await updatePriceMutation.mutateAsync({
        id: auctionId,
        data: { fanta_team_id: activeTeamId, player_id: a.player_id, new_price_fm: newPrice },
      });
      const delta = result.credits_delta;
      const sign  = delta >= 0 ? "+" : "";
      setSuccessMsg(
        `${a.player_name}: ${result.old_price_fm} → ${result.new_price_fm} FM — crediti ${sign}${delta}`,
      );
      setEditingPlayerId(null);
      onRefetch();
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string } })?.data;
      setErrorMsg(body?.error ?? "Errore modifica prezzo.");
    }
  };

  // ── F4: override budget (invariato) ──────────────────────────────────────
  const handleBudget = async () => {
    const credits = parseInt(budgetInput, 10);
    if (isNaN(credits) || credits < 0) {
      setErrorMsg("Budget non valido.");
      return;
    }
    clearMessages();
    try {
      await budgetMutation.mutateAsync({
        id: auctionId,
        data: { fanta_team_id: activeTeamId, credits_remaining: credits },
      });
      setSuccessMsg(`Budget impostato a ${credits} FM.`);
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-background border shadow-2xl overflow-hidden">

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="font-serif text-lg font-bold text-primary">Correggi rose e budget</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* ── F1: combo squadra ─────────────────────────────────── */}
        <div className="px-4 pt-3 pb-2 shrink-0 border-b bg-muted/20">
          <select
            value={activeTeamId}
            onChange={(e) => {
              setActiveTeamId(e.target.value);
              setPendingPlayer(null);
              setEditingPlayerId(null);
              clearMessages();
            }}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {squadre.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.credits_remaining} FM residui
              </option>
            ))}
          </select>
        </div>

        {/* ── Banner errore / successo ───────────────────────────── */}
        {errorMsg && (
          <div className="mx-4 mt-2 shrink-0 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive font-mono">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mx-4 mt-2 shrink-0 rounded-md bg-green-50 border border-green-300 px-3 py-2 text-sm text-green-800 font-mono">
            {successMsg}
          </div>
        )}

        {/* ── Corpo scrollabile ─────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-5">

          {/* ── Rosa corrente (F3: modifica prezzo inline) ────────── */}
          <section>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Rosa corrente
              {teamAssignments.length === 0 && (
                <span className="ml-2 text-muted-foreground/60 normal-case tracking-normal">
                  — nessun giocatore
                </span>
              )}
            </h3>
            {teamAssignments.length > 0 && (
              <ul className="divide-y divide-border rounded-md border overflow-hidden">
                {teamAssignments.map((a) => (
                  <li key={a.player_id} className="flex items-center gap-2 px-3 py-2 bg-card">

                    {/* Ruolo */}
                    <span className="w-5 text-center text-xs font-mono font-bold text-muted-foreground shrink-0">
                      {ROLE_LABEL[a.role_classic] ?? a.role_classic}
                    </span>

                    {/* Nome */}
                    <span className="flex-1 text-sm font-medium truncate">{a.player_name}</span>

                    {/* Prezzo — normale o in modifica */}
                    {editingPlayerId === a.player_id ? (
                      <>
                        <Input
                          className="w-20 font-mono text-sm h-7 text-center"
                          type="number"
                          min={1}
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleSavePrice(a);
                            if (e.key === "Escape") handleCancelEditPrice();
                          }}
                          autoFocus
                        />
                        <span className="text-xs text-muted-foreground font-mono shrink-0">FM</span>
                        <button
                          onClick={() => void handleSavePrice(a)}
                          disabled={isBusy}
                          className="rounded p-1 hover:bg-green-100 hover:text-green-700 transition-colors disabled:opacity-40"
                          title="Salva"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleCancelEditPrice}
                          className="rounded p-1 hover:bg-muted transition-colors"
                          title="Annulla"
                        >
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-mono text-muted-foreground shrink-0">
                          {a.final_price_fm} FM
                        </span>
                        <button
                          onClick={() => handleStartEditPrice(a)}
                          disabled={isBusy}
                          className="rounded p-1 hover:bg-muted transition-colors disabled:opacity-40"
                          title="Modifica prezzo"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => void handleRemove(a.player_id)}
                          disabled={isBusy}
                          className="rounded p-1 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40"
                          title="Rimuovi dalla rosa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── F2: Aggiungi giocatore ────────────────────────────── */}
          <section>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Aggiungi giocatore
            </h3>

            {/* Giocatore in attesa di conferma */}
            {pendingPlayer ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-center text-xs font-mono font-bold text-muted-foreground shrink-0">
                    {ROLE_LABEL[pendingPlayer.role_classic] ?? pendingPlayer.role_classic}
                  </span>
                  <span className="flex-1 text-sm font-medium">{pendingPlayer.name}</span>
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {pendingPlayer.real_team}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-mono text-muted-foreground shrink-0">
                    Prezzo FM
                  </label>
                  <Input
                    className="w-24 font-mono text-sm h-8"
                    type="number"
                    min={1}
                    value={addPrice}
                    onChange={(e) => setAddPrice(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleConfirmAdd();
                      if (e.key === "Escape") handleCancelAdd();
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleConfirmAdd()}
                    disabled={isBusy || !addPrice}
                    className="h-8 font-mono text-xs bg-primary text-primary-foreground"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Aggiungi
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelAdd}
                    className="h-8 font-mono text-xs text-muted-foreground"
                  >
                    Annulla
                  </Button>
                </div>
              </div>
            ) : (
              /* Barra di ricerca */
              <div className="space-y-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 font-mono text-sm h-8"
                    placeholder="Cerca per cognome…"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); clearMessages(); }}
                  />
                </div>
                {searchQuery.length >= 2 && (
                  <ul className="rounded-md border divide-y divide-border overflow-hidden max-h-44 overflow-y-auto">
                    {(playerSearchData?.items ?? []).length === 0 ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground font-mono">
                        Nessun risultato
                      </li>
                    ) : (
                      (playerSearchData?.items ?? []).map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center gap-3 px-3 py-2 bg-card hover:bg-muted/40 cursor-pointer transition-colors"
                          onClick={() => handleSelectPlayer({
                            id: p.id,
                            name: p.name,
                            real_team: p.real_team,
                            role_classic: p.role_classic,
                          })}
                        >
                          <span className="w-5 text-center text-xs font-mono font-bold text-muted-foreground shrink-0">
                            {ROLE_LABEL[p.role_classic] ?? p.role_classic}
                          </span>
                          <span className="flex-1 text-sm truncate">{p.name}</span>
                          <span className="text-xs font-mono text-muted-foreground shrink-0">
                            {p.real_team}
                          </span>
                          <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* ── F4: Imposta budget (invariato) ───────────────────── */}
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
                onKeyDown={(e) => { if (e.key === "Enter") void handleBudget(); }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleBudget()}
                disabled={isBusy || !budgetInput}
                className="h-8 font-mono text-xs"
              >
                Aggiorna
              </Button>
            </div>
          </section>

        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t bg-muted/20 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="font-mono text-xs">
            Chiudi
          </Button>
        </div>
      </div>
    </div>
  );
}
