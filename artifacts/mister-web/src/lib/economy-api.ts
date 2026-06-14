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
