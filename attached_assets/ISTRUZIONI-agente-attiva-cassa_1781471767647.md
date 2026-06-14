# Istruzioni per l'agente Replit — attivazione cassa (impostazioni + endpoint)

Aggiunge il comando per ATTIVARE e configurare la cassa: un endpoint admin per
salvare la config economy, e un pannello "Impostazioni cassa" sulla pagina Cassa
(visibile all'admin anche quando la cassa è spenta). Tutte aggiunte/edit; NIENTE
modifiche al DB. Backend già typecheckato fuori dal repo; frontend da verificare
col typecheck del progetto. Non committare/pushare: lascia nel working tree.

---

## 1) BACKEND — `artifacts/api-server/src/lib/economy.ts`

### 1a) Import: aggiungi `sql`
Sostituisci:
```ts
import { and, eq, or } from "drizzle-orm";
```
con:
```ts
import { and, eq, or, sql } from "drizzle-orm";
```

### 1b) Nuova funzione `updateLeagueEconomy`
Individua la fine della funzione `getLeagueEconomy` (la riga `return cfg?.economy ?? DEFAULT_ECONOMY_CONFIG;` seguita da `}`). IMMEDIATAMENTE DOPO quella `}` di chiusura, inserisci:

```ts
/**
 * Scrive la config economy di una lega, fondendola nel JSONB `config`
 * (sostituisce solo la chiave `economy`, preserva squad/captain/budget/…).
 */
export async function updateLeagueEconomy(
  leagueId: string,
  economy: EconomyConfig,
): Promise<EconomyConfig> {
  const json = JSON.stringify({ economy });
  await db
    .update(leagues)
    .set({
      config: sql`COALESCE(${leagues.config}, '{}'::jsonb) || ${json}::jsonb`,
    })
    .where(eq(leagues.id, leagueId));
  return economy;
}
```

---

## 2) BACKEND — `artifacts/api-server/src/routes/economy.ts`

### 2a) Import: aggiungi `updateLeagueEconomy`
Nel blocco di import da `"../lib/economy"`, dopo la riga `  getLeagueEconomy,` aggiungi una riga `  updateLeagueEconomy,` (subito prima di `  getAccountBalance,`).

### 2b) Schema + endpoint PUT
Individua l'handler GET della config (il blocco `router.get("/leagues/:leagueId/economy/config", ...)`). IMMEDIATAMENTE DOPO quel blocco (dopo la sua riga `);`), inserisci:

```ts
const RoundingRuleSchema = z.enum(["round5_first_decimal", "standard", "none"]);
const ConversionValveSchema = z.object({
  enabled: z.boolean(),
  fmToEur: z.number().positive(),
  min: z.number().nonnegative(),
  max: z.number().nullable(),
  requiresApproval: z.boolean(),
  rounding: RoundingRuleSchema,
});
const EconomyConfigSchema = z.object({
  realMoneyEnabled: z.boolean(),
  conversion: z.object({
    depositIn: ConversionValveSchema,
    cashOut: ConversionValveSchema,
  }),
  realAmounts: z.object({
    initialFund: z.number(),
    entryFees: z.object({
      league: z.number(),
      cup: z.number(),
      supercup: z.number(),
    }),
    missedLineupFine: z.object({
      amount: z.number(),
      freeCount: z.number(),
    }),
    freeAgentCardCost: z.number(),
    semiOwnerFee: z.number(),
  }),
  fmRules: z.object({
    lostPlayerRefundFraction: z.number(),
    rounding: RoundingRuleSchema,
  }),
});

// ── Admin: salva la config economy della lega (attiva/configura la cassa) ──────

router.put(
  "/leagues/:leagueId/economy/config",
  async (req, res): Promise<void> => {
    const leagueId = req.params.leagueId;
    if (!(await guardLeagueAdmin(req, res, leagueId))) return;
    const body = EconomyConfigSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const updated = await updateLeagueEconomy(leagueId, body.data);
    res.json(updated);
  },
);
```

---

## 3) FRONTEND — `artifacts/mister-web/src/lib/economy-api.ts`

Aggiungi in fondo al file questo hook:

```ts
export function useUpdateEconomyConfig(leagueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cfg: EconomyConfig) =>
      customFetch<EconomyConfig>(`${apiBase(leagueId)}/config`, {
        method: "PUT",
        body: JSON.stringify(cfg),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["economy", "config", leagueId] });
      qc.invalidateQueries({ queryKey: ["economy", "balance", leagueId] });
    },
  });
}
```

---

## 4) FRONTEND — sostituisci `artifacts/mister-web/src/pages/CassaPage.tsx`

Sostituisci l'INTERO contenuto del file con esattamente questo (è la pagina
attuale più il pannello "Impostazioni cassa" per l'admin e la ristrutturazione
del gating perché l'admin veda le impostazioni anche a cassa spenta):

```tsx
import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetLeague, useListFantaTeams } from "@workspace/api-client-react";
import { useCurrentUser } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Wallet, Coins, Check, X, Clock, Settings } from "lucide-react";
import {
  type EconomyTransaction,
  type EconomyConfig,
  useEconomyConfig,
  useAccountBalance,
  useEconomyTransactions,
  useRequestDeposit,
  useResolveTransaction,
  useUpdateEconomyConfig,
  fmCapitalAccount,
  prizePoolAccount,
} from "@/lib/economy-api";

type TeamLike = { id: string; name?: string | null };

function teamNameFromAccount(teams: TeamLike[] | undefined, account: string): string {
  const teamId = account.split(":")[1];
  return teams?.find((t) => t.id === teamId)?.name ?? "Squadra";
}

export default function CassaPage() {
  const { id } = useParams<{ id: string }>();
  const leagueId = id!;
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const { data: league } = useGetLeague(leagueId);
  const { data: teams } = useListFantaTeams(leagueId);
  const { data: econ, isLoading: econLoading } = useEconomyConfig(leagueId);

  const isAdmin = !!league && !!user && league.admin_user_id === user.id;
  const myTeam = teams?.find((t) => t.manager_user_id === user?.id);
  const valve = econ?.conversion.depositIn;

  const { data: myCapital } = useAccountBalance(
    leagueId,
    myTeam ? fmCapitalAccount(myTeam.id) : undefined,
    "fm",
  );
  const { data: prizePool } = useAccountBalance(
    leagueId,
    isAdmin ? prizePoolAccount(leagueId) : undefined,
    "eur",
  );
  const { data: pending } = useEconomyTransactions(leagueId, "pending");
  const { data: allTxns } = useEconomyTransactions(leagueId);

  const requestDeposit = useRequestDeposit(leagueId);
  const resolveTxn = useResolveTransaction(leagueId);
  const updateConfig = useUpdateEconomyConfig(leagueId);

  const [amount, setAmount] = useState("");
  const [draft, setDraft] = useState<EconomyConfig | null>(null);

  useEffect(() => {
    if (econ) setDraft(econ);
  }, [econ]);

  function showError(err: unknown, fallback: string) {
    const msg = (err as { data?: { error?: string } })?.data?.error ?? fallback;
    toast({ title: "Errore", description: msg, variant: "destructive" });
  }

  async function submitDeposit() {
    if (!myTeam) return;
    const eur = Number(amount);
    if (!(eur > 0)) {
      toast({
        title: "Importo non valido",
        description: "Inserisci un importo in euro maggiore di zero.",
        variant: "destructive",
      });
      return;
    }
    try {
      await requestDeposit.mutateAsync({ teamId: myTeam.id, amountEur: eur });
      setAmount("");
      toast({
        title: "Richiesta inviata",
        description: valve?.requiresApproval
          ? "In attesa di approvazione dell'admin."
          : "Versamento registrato.",
      });
    } catch (err) {
      showError(err, "Impossibile inviare la richiesta.");
    }
  }

  async function resolve(txnId: string, action: "approve" | "reject") {
    try {
      await resolveTxn.mutateAsync({ txnId, action });
      toast({ title: action === "approve" ? "Approvato" : "Rifiutato" });
    } catch (err) {
      showError(err, "Operazione non riuscita.");
    }
  }

  async function saveConfig() {
    if (!draft) return;
    try {
      await updateConfig.mutateAsync(draft);
      toast({ title: "Impostazioni salvate" });
    } catch (err) {
      showError(err, "Impossibile salvare le impostazioni.");
    }
  }

  // Aggiorna un campo della valvola depositIn nel draft.
  function patchDeposit(patch: Partial<EconomyConfig["conversion"]["depositIn"]>) {
    if (!draft) return;
    setDraft({
      ...draft,
      conversion: {
        ...draft.conversion,
        depositIn: { ...draft.conversion.depositIn, ...patch },
      },
    });
  }

  const myPending = (allTxns ?? []).filter(
    (t: EconomyTransaction) =>
      myTeam &&
      t.type === "deposit_in" &&
      t.status === "pending" &&
      t.toAccount === fmCapitalAccount(myTeam.id),
  );
  const adminPending = (pending ?? []).filter(
    (t: EconomyTransaction) => t.type === "deposit_in",
  );

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/leagues/${leagueId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5" /> Cassa
        </h1>
      </div>

      {econLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <>
          {isAdmin && draft && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Impostazioni cassa
                </CardTitle>
                <CardDescription>
                  Attiva e configura la cassa reale per questa lega.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rm-toggle">Cassa reale attiva</Label>
                  <Switch
                    id="rm-toggle"
                    checked={draft.realMoneyEnabled}
                    onCheckedChange={(v) => setDraft({ ...draft, realMoneyEnabled: v })}
                    data-testid="switch-real-money"
                  />
                </div>

                {draft.realMoneyEnabled && (
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="dep-toggle">Consenti versamenti (€ → FM)</Label>
                      <Switch
                        id="dep-toggle"
                        checked={draft.conversion.depositIn.enabled}
                        onCheckedChange={(v) => patchDeposit({ enabled: v })}
                        data-testid="switch-deposit-in"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="appr-toggle">Richiede approvazione admin</Label>
                      <Switch
                        id="appr-toggle"
                        checked={draft.conversion.depositIn.requiresApproval}
                        onCheckedChange={(v) => patchDeposit({ requiresApproval: v })}
                        data-testid="switch-requires-approval"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">€ per 1 FM</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={draft.conversion.depositIn.fmToEur}
                          onChange={(e) => patchDeposit({ fmToEur: Number(e.target.value) })}
                          data-testid="input-fmtoeur"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Min (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={draft.conversion.depositIn.min}
                          onChange={(e) => patchDeposit({ min: Number(e.target.value) })}
                          data-testid="input-min"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Max (€, vuoto = ∞)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={draft.conversion.depositIn.max ?? ""}
                          onChange={(e) =>
                            patchDeposit({
                              max: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          data-testid="input-max"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={saveConfig}
                  disabled={updateConfig.isPending}
                  data-testid="button-save-economy-config"
                >
                  {updateConfig.isPending ? "Salvataggio..." : "Salva impostazioni"}
                </Button>
              </CardContent>
            </Card>
          )}

          {!econ?.realMoneyEnabled && !isAdmin && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                La cassa reale non è attiva per questa lega.
              </CardContent>
            </Card>
          )}

          {econ?.realMoneyEnabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                      <Coins className="h-4 w-4" /> Il tuo capitale (FM)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">
                      {myCapital ? myCapital.balance.toFixed(2) : myTeam ? "0.00" : "—"}
                    </div>
                  </CardContent>
                </Card>
                {isAdmin && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                        <Wallet className="h-4 w-4" /> Montepremi (€)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">
                        {prizePool ? prizePool.balance.toFixed(2) : "0.00"}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {valve?.enabled && myTeam && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Richiedi versamento</CardTitle>
                    <CardDescription>
                      Versa euro reali per aumentare il tuo capitale (1 FM = {valve.fmToEur} €).
                      {valve.requiresApproval
                        ? " La richiesta dovrà essere approvata dall'admin."
                        : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-end gap-3">
                    <div className="space-y-1.5 flex-1">
                      <Label className="text-xs text-muted-foreground">Importo (€)</Label>
                      <Input
                        type="number"
                        min={valve.min}
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={`min ${valve.min}${valve.max !== null ? `, max ${valve.max}` : ""}`}
                        data-testid="input-deposit-amount"
                      />
                    </div>
                    <Button
                      onClick={submitDeposit}
                      disabled={requestDeposit.isPending}
                      data-testid="button-request-deposit"
                    >
                      {requestDeposit.isPending ? "Invio..." : "Richiedi"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {myPending.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Le tue richieste in attesa</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {myPending.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between text-sm border rounded-md px-3 py-2"
                      >
                        <span>
                          Versamento {Number(t.amountFrom).toFixed(2)} € →{" "}
                          {Number(t.amountTo).toFixed(2)} FM
                        </span>
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" /> in attesa
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {isAdmin && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Richieste da approvare</CardTitle>
                    <CardDescription>Versamenti in attesa di conferma.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {adminPending.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nessuna richiesta in attesa.</p>
                    ) : (
                      adminPending.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-3 border rounded-md px-3 py-2"
                        >
                          <div className="text-sm">
                            <div className="font-medium">{teamNameFromAccount(teams, t.toAccount)}</div>
                            <div className="text-muted-foreground">
                              {Number(t.amountFrom).toFixed(2)} € → {Number(t.amountTo).toFixed(2)} FM
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolve(t.id, "approve")}
                              disabled={resolveTxn.isPending}
                              data-testid="button-approve-deposit"
                            >
                              <Check className="h-4 w-4 mr-1" /> Approva
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => resolve(t.id, "reject")}
                              disabled={resolveTxn.isPending}
                              data-testid="button-reject-deposit"
                            >
                              <X className="h-4 w-4 mr-1" /> Rifiuta
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
```

---

## 5) Verifica
- Typecheck/build di `@workspace/api-server` e `mister-web`: 0 errori.
- Nessuna modifica al DB.
- Aprendo `/leagues/<ID>/cassa` come admin compare il pannello "Impostazioni
  cassa" con il toggle "Cassa reale attiva"; attivandolo e salvando, la cassa
  diventa operativa per la lega.
- NON committare e NON fare push.
