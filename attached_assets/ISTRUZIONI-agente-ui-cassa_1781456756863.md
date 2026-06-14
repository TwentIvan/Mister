# Istruzioni per l'agente Replit — UI Cassa (frontend) + endpoint config

Aggiunge la pagina Cassa e un piccolo endpoint di lettura della config economy.
Tutte aggiunte/inserzioni; NIENTE modifiche al database. Il backend (endpoint
config) è già stato typecheckato fuori dal repo; il frontend va verificato dal
typecheck del progetto. Non committare/pushare: lascia nel working tree.

Superficie: una pagina `/leagues/:id/cassa` con saldo capitale (FM), form di
richiesta versamento per il presidente, e lista richieste da approvare per l'admin.

---

## 1) BACKEND — aggiungi 1 endpoint a `artifacts/api-server/src/routes/economy.ts`

Individua questo blocco già presente nel file:

```ts
const BalanceQuery = z.object({
  account: z.string().min(1),
  currency: z.enum(["fm", "eur"]),
});
```

e IMMEDIATAMENTE DOPO di esso inserisci:

```ts
// ── Lettura: config economy della lega (per gating e limiti UI) ───────────────

router.get(
  "/leagues/:leagueId/economy/config",
  async (req, res): Promise<void> => {
    const leagueId = req.params.leagueId;
    if (!(await guardLeagueMember(req, res, leagueId))) return;
    const econ = await getLeagueEconomy(leagueId);
    res.json(econ);
  },
);
```

(`getLeagueEconomy` e `guardLeagueMember` sono già importati nel file.)

---

## 2) CLIENT — esporta `customFetch` da `lib/api-client-react/src/index.ts`

Dopo la riga:

```ts
export { setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
```

aggiungi:

```ts
export { customFetch } from "./custom-fetch";
```

---

## 3) CREA `artifacts/mister-web/src/lib/economy-api.ts`

Contenuto esatto:

```ts
/**
 * Client React per gli endpoint cassa (non generati da OpenAPI).
 * Usa customFetch (stessa base URL / cookie di sessione / ApiError del client generato)
 * avvolto in hook react-query, in modo coerente con il resto dell'app.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type EconomyCurrency = "fm" | "eur";
export type EconomyTxnStatus = "pending" | "confirmed" | "voided";

export interface EconomyTransaction {
  id: string;
  leagueId: string;
  type: string;
  fromAccount: string;
  toAccount: string;
  currencyFrom: EconomyCurrency;
  currencyTo: EconomyCurrency;
  amountFrom: string; // numeric -> stringa
  amountTo: string;
  rate: string;
  status: EconomyTxnStatus;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface ConversionValve {
  enabled: boolean;
  fmToEur: number;
  min: number;
  max: number | null;
  requiresApproval: boolean;
  rounding: string;
}

export interface EconomyConfig {
  realMoneyEnabled: boolean;
  conversion: { depositIn: ConversionValve; cashOut: ConversionValve };
  realAmounts: {
    initialFund: number;
    entryFees: { league: number; cup: number; supercup: number };
    missedLineupFine: { amount: number; freeCount: number };
    freeAgentCardCost: number;
    semiOwnerFee: number;
  };
  fmRules: { lostPlayerRefundFraction: number; rounding: string };
}

interface BalanceResponse {
  account: string;
  currency: EconomyCurrency;
  balance: number;
}

const apiBase = (leagueId: string): string => `/api/leagues/${leagueId}/economy`;

/** Chiavi conto, allineate al backend. */
export const fmCapitalAccount = (teamId: string): string => `fm_capital:${teamId}`;
export const prizePoolAccount = (leagueId: string): string => `prize_pool:${leagueId}`;

export function useEconomyConfig(leagueId: string) {
  return useQuery({
    queryKey: ["economy", "config", leagueId],
    enabled: !!leagueId,
    queryFn: () => customFetch<EconomyConfig>(`${apiBase(leagueId)}/config`),
  });
}

export function useAccountBalance(
  leagueId: string,
  account: string | undefined,
  currency: EconomyCurrency,
) {
  return useQuery({
    queryKey: ["economy", "balance", leagueId, account, currency],
    enabled: !!leagueId && !!account,
    queryFn: () =>
      customFetch<BalanceResponse>(
        `${apiBase(leagueId)}/balance?account=${encodeURIComponent(account!)}&currency=${currency}`,
      ),
  });
}

export function useEconomyTransactions(leagueId: string, status?: EconomyTxnStatus) {
  return useQuery({
    queryKey: ["economy", "transactions", leagueId, status ?? "all"],
    enabled: !!leagueId,
    queryFn: () =>
      customFetch<EconomyTransaction[]>(
        `${apiBase(leagueId)}/transactions${status ? `?status=${status}` : ""}`,
      ),
  });
}

export function useRequestDeposit(leagueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { teamId: string; amountEur: number; note?: string }) =>
      customFetch<EconomyTransaction>(`${apiBase(leagueId)}/deposit-requests`, {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["economy", "transactions", leagueId] });
      qc.invalidateQueries({ queryKey: ["economy", "balance", leagueId] });
    },
  });
}

export function useResolveTransaction(leagueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { txnId: string; action: "approve" | "reject" }) =>
      customFetch<EconomyTransaction>(
        `${apiBase(leagueId)}/transactions/${vars.txnId}/${vars.action}`,
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["economy", "transactions", leagueId] });
      qc.invalidateQueries({ queryKey: ["economy", "balance", leagueId] });
    },
  });
}
```

---

## 4) CREA `artifacts/mister-web/src/pages/CassaPage.tsx`

Contenuto esatto:

```tsx
import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetLeague, useListFantaTeams } from "@workspace/api-client-react";
import { useCurrentUser } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Wallet, Coins, Check, X, Clock } from "lucide-react";
import {
  useEconomyConfig,
  useAccountBalance,
  useEconomyTransactions,
  useRequestDeposit,
  useResolveTransaction,
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

  const [amount, setAmount] = useState("");

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

  const myPending = (allTxns ?? []).filter(
    (t) =>
      myTeam &&
      t.type === "deposit_in" &&
      t.status === "pending" &&
      t.toAccount === fmCapitalAccount(myTeam.id),
  );
  const adminPending = (pending ?? []).filter((t) => t.type === "deposit_in");

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
      ) : !econ?.realMoneyEnabled ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            La cassa reale non è attiva per questa lega.
          </CardContent>
        </Card>
      ) : (
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
    </div>
  );
}
```

---

## 5) ROUTING — `artifacts/mister-web/src/App.tsx`

### 5a) Import
Dopo la riga:
```ts
import LeagueConfig from "@/pages/league-config";
```
aggiungi:
```ts
import CassaPage from "@/pages/CassaPage";
```

### 5b) Route
Dopo la riga:
```tsx
<Route path="/leagues/:id/config" component={LeagueConfig} />
```
aggiungi:
```tsx
<Route path="/leagues/:id/cassa" component={CassaPage} />
```

---

## 6) Verifica
- Typecheck/build di `@workspace/api-server` e `mister-web`: 0 errori.
- Nessuna modifica al DB, nessun push drizzle.
- La pagina è raggiungibile a `/leagues/<ID_LEGA>/cassa`. (Il link da
  league-detail non è incluso: si può aggiungere a parte.)
- NON committare e NON fare push.
