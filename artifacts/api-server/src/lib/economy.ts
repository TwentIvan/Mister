/**
 * Servizio cassa (economy) — unico punto di lettura saldi e scrittura movimenti.
 *
 * Modello: due zone (FM / €) e un libro dei trasferimenti (economy_transactions).
 * I saldi NON sono memorizzati: si derivano sommando i movimenti 'confirmed'.
 *
 * Gating: tutto è subordinato a leagues.config.economy.realMoneyEnabled; le
 * conversioni richiedono anche conversion.<valvola>.enabled.
 */

import { and, eq, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  db,
  economyTransactions,
  leagues,
  DEFAULT_ECONOMY_CONFIG,
  type EconomyConfig,
  type Currency,
  type EconomyTxnType,
  type EconomyTxnStatus,
  type LeagueConfig,
} from "@workspace/db";

// ── Conti ──────────────────────────────────────────────────────────────────

/** Conti di sistema (lato emissione/esterno). */
export const FM_SYSTEM = "fm_system";
export const EUR_EXTERNAL = "eur_external";

/** Costruttori delle chiavi conto "tipo:ownerId". */
export const acc = {
  fmCapital: (fantaTeamId: string): string => `fm_capital:${fantaTeamId}`,
  realCash: (fantaTeamId: string): string => `real_cash:${fantaTeamId}`,
  prizePool: (leagueId: string): string => `prize_pool:${leagueId}`,
};

// ── Config / gating ──────────────────────────────────────────────────────────

/**
 * Config economy di una lega, con merge dei default per le righe vecchie che
 * non hanno ancora il campo nel JSONB config.
 */
export async function getLeagueEconomy(
  leagueId: string,
): Promise<EconomyConfig> {
  const [lg] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, leagueId));
  const cfg = (lg?.config as Partial<LeagueConfig> | null) ?? null;
  return cfg?.economy ?? DEFAULT_ECONOMY_CONFIG;
}

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

// ── Saldi (derivati) ─────────────────────────────────────────────────────────

/**
 * Saldo di un conto in una data valuta, sui soli movimenti 'confirmed'.
 *   saldo = Σ amountTo (dove toAccount=account, currencyTo=currency)
 *         − Σ amountFrom (dove fromAccount=account, currencyFrom=currency)
 * Nota: le colonne numeric tornano come stringa da node-postgres → Number().
 */
export async function getAccountBalance(
  leagueId: string,
  account: string,
  currency: Currency,
): Promise<number> {
  const rows = await db
    .select()
    .from(economyTransactions)
    .where(
      and(
        eq(economyTransactions.leagueId, leagueId),
        eq(economyTransactions.status, "confirmed"),
        or(
          eq(economyTransactions.toAccount, account),
          eq(economyTransactions.fromAccount, account),
        ),
      ),
    );

  let balance = 0;
  for (const r of rows) {
    if (r.toAccount === account && r.currencyTo === currency) {
      balance += Number(r.amountTo);
    }
    if (r.fromAccount === account && r.currencyFrom === currency) {
      balance -= Number(r.amountFrom);
    }
  }
  return balance;
}

// ── Scrittura movimenti (unico punto di insert) ──────────────────────────────

export interface RecordTransactionInput {
  leagueId: string;
  type: EconomyTxnType;
  fromAccount: string;
  toAccount: string;
  currencyFrom: Currency;
  currencyTo: Currency;
  amountFrom: number;
  amountTo: number;
  rate?: number;
  status?: EconomyTxnStatus;
  createdBy: string;
  relatedPlayerId?: number | null;
  relatedContractId?: string | null;
  relatedMarketEventId?: string | null;
  note?: string;
}

/** Errore di validazione di un movimento (il chiamante lo mappa su 400). */
export class EconomyValidationError extends Error {}

/**
 * Inserisce un movimento dopo averne verificato la coerenza. È l'unico punto
 * che scrive su economy_transactions.
 */
export async function recordTransaction(input: RecordTransactionInput) {
  const {
    leagueId,
    type,
    fromAccount,
    toAccount,
    currencyFrom,
    currencyTo,
    amountFrom,
    amountTo,
    rate = 1,
    status = "confirmed",
    createdBy,
    relatedPlayerId = null,
    relatedContractId = null,
    relatedMarketEventId = null,
    note = "",
  } = input;

  if (!(amountFrom > 0) || !(amountTo > 0)) {
    throw new EconomyValidationError("Gli importi devono essere positivi");
  }
  if (fromAccount === toAccount) {
    throw new EconomyValidationError("Conto di origine e destinazione coincidono");
  }
  // Trasferimento interno: stessa valuta, stesso importo, rate 1.
  if (currencyFrom === currencyTo) {
    if (Math.abs(amountFrom - amountTo) > 0.001) {
      throw new EconomyValidationError(
        "Trasferimento interno: gli importi devono coincidere",
      );
    }
  }

  const [row] = await db
    .insert(economyTransactions)
    .values({
      id: `etx-${nanoid(12)}`,
      leagueId,
      type,
      fromAccount,
      toAccount,
      currencyFrom,
      currencyTo,
      amountFrom: amountFrom.toFixed(2),
      amountTo: amountTo.toFixed(2),
      rate: rate.toString(),
      status,
      relatedPlayerId,
      relatedContractId,
      relatedMarketEventId,
      note,
      createdBy,
    })
    .returning();
  return row;
}

/** Imposta lo stato di un movimento (approva/annulla). */
export async function setTransactionStatus(
  leagueId: string,
  txnId: string,
  status: EconomyTxnStatus,
) {
  const [row] = await db
    .update(economyTransactions)
    .set({ status })
    .where(
      and(
        eq(economyTransactions.id, txnId),
        eq(economyTransactions.leagueId, leagueId),
      ),
    )
    .returning();
  return row ?? null;
}

// ── Arrotondamento ────────────────────────────────────────────────────────────

export function applyRounding(
  value: number,
  rule: EconomyConfig["fmRules"]["rounding"],
): number {
  switch (rule) {
    case "standard":
      return Math.round(value * 100) / 100;
    case "round5_first_decimal":
      // "Regola del 5" sul primo decimale: arrotonda al mezzo più vicino.
      return Math.round(value * 2) / 2;
    case "none":
    default:
      return value;
  }
}
