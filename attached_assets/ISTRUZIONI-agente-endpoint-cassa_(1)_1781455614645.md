# Istruzioni per l'agente Replit — endpoint cassa (economy)

Aggiunge il layer applicativo del sottosistema cassa sopra lo schema già
presente (tabella `economy_transactions` + `EconomyConfig`, già migrati).
Sono tutte aggiunte: 2 file nuovi e 2 righe in `routes/index.ts`. NIENTE
modifiche al DB (la tabella esiste già): nessun push, nessuna migrazione.

Le modifiche sono già state typecheckate fuori dal repo (0 errori) contro lo
schema reale. Non committare né pushare: lascia tutto nel working tree.

## Superficie API risultante
- `POST /api/leagues/:leagueId/economy/deposit-requests` — un presidente RICHIEDE
  un versamento € → FM per la propria squadra; resta `pending` se la valvola ha
  `requiresApproval`.
- `POST /api/leagues/:leagueId/economy/transactions/:txnId/approve` — admin conferma.
- `POST /api/leagues/:leagueId/economy/transactions/:txnId/reject` — admin annulla (voided).
- `POST /api/leagues/:leagueId/economy/transactions` — admin registra un movimento
  `confirmed` (multe, quote, premi, ecc.).
- `GET  /api/leagues/:leagueId/economy/transactions?status=pending` — elenco (membro).
- `GET  /api/leagues/:leagueId/economy/balance?account=...&currency=fm|eur` — saldo derivato (membro).

---

## 1) CREA `artifacts/api-server/src/lib/economy.ts`

Crea il file con ESATTAMENTE questo contenuto:

```ts
/**
 * Servizio cassa (economy) — unico punto di lettura saldi e scrittura movimenti.
 *
 * Modello: due zone (FM / €) e un libro dei trasferimenti (economy_transactions).
 * I saldi NON sono memorizzati: si derivano sommando i movimenti 'confirmed'.
 *
 * Gating: tutto è subordinato a leagues.config.economy.realMoneyEnabled; le
 * conversioni richiedono anche conversion.<valvola>.enabled.
 */

import { and, eq, or } from "drizzle-orm";
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
```

---

## 2) CREA `artifacts/api-server/src/routes/economy.ts`

Crea il file con ESATTAMENTE questo contenuto:

```ts
/**
 * Route cassa (economy).
 *
 * Flusso versamento concordato:
 *   - un presidente RICHIEDE un versamento (deposit_in) -> resta 'pending'
 *   - l'admin lo APPROVA ('confirmed') o lo RIFIUTA ('voided')
 * Solo i movimenti 'confirmed' concorrono ai saldi.
 *
 * L'admin può inoltre registrare direttamente movimenti 'confirmed'
 * (multe, quote, premi, ecc.) tramite l'endpoint generico.
 */

import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, economyTransactions, fantaTeams } from "@workspace/db";
import { guardLeagueAdmin, guardLeagueMember } from "../lib/auth";
import {
  acc,
  getLeagueEconomy,
  getAccountBalance,
  recordTransaction,
  setTransactionStatus,
  applyRounding,
  EconomyValidationError,
} from "../lib/economy";

const router: IRouter = Router();

// ── Presidente: richiede un versamento € -> FM ───────────────────────────────

const DepositRequestBody = z.object({
  teamId: z.string().min(1),
  amountEur: z.number().positive(),
  note: z.string().max(280).optional(),
});

router.post(
  "/leagues/:leagueId/economy/deposit-requests",
  async (req, res): Promise<void> => {
    const leagueId = req.params.leagueId;
    if (!(await guardLeagueMember(req, res, leagueId))) return;

    const body = DepositRequestBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const econ = await getLeagueEconomy(leagueId);
    if (!econ.realMoneyEnabled || !econ.conversion.depositIn.enabled) {
      res
        .status(403)
        .json({ error: "I versamenti non sono abilitati per questa lega" });
      return;
    }

    const valve = econ.conversion.depositIn;
    const { teamId, amountEur, note } = body.data;
    if (amountEur < valve.min || (valve.max !== null && amountEur > valve.max)) {
      res.status(400).json({
        error: `Importo fuori dai limiti (${valve.min}–${valve.max ?? "∞"} €)`,
      });
      return;
    }

    // Il richiedente deve essere il manager (presidente) della squadra.
    const [team] = await db
      .select()
      .from(fantaTeams)
      .where(and(eq(fantaTeams.id, teamId), eq(fantaTeams.leagueId, leagueId)));
    if (!team) {
      res.status(404).json({ error: "Squadra non trovata in questa lega" });
      return;
    }
    if (team.managerUserId !== req.user!.sub) {
      res.status(403).json({
        error: "Puoi richiedere versamenti solo per la tua squadra",
      });
      return;
    }

    const amountFm = applyRounding(amountEur / valve.fmToEur, valve.rounding);

    try {
      const txn = await recordTransaction({
        leagueId,
        type: "deposit_in",
        fromAccount: acc.realCash(teamId),
        toAccount: acc.fmCapital(teamId),
        currencyFrom: "eur",
        currencyTo: "fm",
        amountFrom: amountEur,
        amountTo: amountFm,
        rate: valve.fmToEur,
        status: valve.requiresApproval ? "pending" : "confirmed",
        createdBy: req.user!.sub,
        note: note ?? "",
      });
      res.status(201).json(txn);
    } catch (err) {
      if (err instanceof EconomyValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  },
);

// ── Admin: approva / rifiuta un movimento 'pending' ───────────────────────────

const TxnIdParams = z.object({
  leagueId: z.string().min(1),
  txnId: z.string().min(1),
});

router.post(
  "/leagues/:leagueId/economy/transactions/:txnId/approve",
  async (req, res): Promise<void> => {
    const params = TxnIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!(await guardLeagueAdmin(req, res, params.data.leagueId))) return;

    const row = await setTransactionStatus(
      params.data.leagueId,
      params.data.txnId,
      "confirmed",
    );
    if (!row) {
      res.status(404).json({ error: "Movimento non trovato" });
      return;
    }
    res.json(row);
  },
);

router.post(
  "/leagues/:leagueId/economy/transactions/:txnId/reject",
  async (req, res): Promise<void> => {
    const params = TxnIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!(await guardLeagueAdmin(req, res, params.data.leagueId))) return;

    const row = await setTransactionStatus(
      params.data.leagueId,
      params.data.txnId,
      "voided",
    );
    if (!row) {
      res.status(404).json({ error: "Movimento non trovato" });
      return;
    }
    res.json(row);
  },
);

// ── Admin: registra direttamente un movimento 'confirmed' ─────────────────────

const RecordBody = z.object({
  type: z.enum([
    "initial_capital",
    "auction_purchase",
    "trade_payment",
    "refund_lost_player",
    "loan_fee",
    "co_ownership_payment",
    "initial_fund",
    "entry_fee",
    "fine",
    "free_agent_card",
    "semi_owner_fee",
    "prize_payout",
    "deposit_in",
    "cash_out",
  ]),
  fromAccount: z.string().min(1),
  toAccount: z.string().min(1),
  currencyFrom: z.enum(["fm", "eur"]),
  currencyTo: z.enum(["fm", "eur"]),
  amountFrom: z.number().positive(),
  amountTo: z.number().positive(),
  rate: z.number().positive().optional(),
  note: z.string().max(280).optional(),
});

router.post(
  "/leagues/:leagueId/economy/transactions",
  async (req, res): Promise<void> => {
    const leagueId = req.params.leagueId;
    if (!(await guardLeagueAdmin(req, res, leagueId))) return;

    const body = RecordBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    try {
      const txn = await recordTransaction({
        leagueId,
        ...body.data,
        status: "confirmed",
        createdBy: req.user!.sub,
        note: body.data.note ?? "",
      });
      res.status(201).json(txn);
    } catch (err) {
      if (err instanceof EconomyValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  },
);

// ── Letture: elenco movimenti e saldo di un conto ─────────────────────────────

router.get(
  "/leagues/:leagueId/economy/transactions",
  async (req, res): Promise<void> => {
    const leagueId = req.params.leagueId;
    if (!(await guardLeagueMember(req, res, leagueId))) return;

    const status = req.query.status;
    const rows = await db
      .select()
      .from(economyTransactions)
      .where(eq(economyTransactions.leagueId, leagueId));

    const filtered =
      typeof status === "string"
        ? rows.filter((r) => r.status === status)
        : rows;
    res.json(filtered);
  },
);

const BalanceQuery = z.object({
  account: z.string().min(1),
  currency: z.enum(["fm", "eur"]),
});

router.get(
  "/leagues/:leagueId/economy/balance",
  async (req, res): Promise<void> => {
    const leagueId = req.params.leagueId;
    if (!(await guardLeagueMember(req, res, leagueId))) return;

    const q = BalanceQuery.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: q.error.message });
      return;
    }
    const balance = await getAccountBalance(
      leagueId,
      q.data.account,
      q.data.currency,
    );
    res.json({ account: q.data.account, currency: q.data.currency, balance });
  },
);

export default router;
```

---

## 3) MODIFICA `artifacts/api-server/src/routes/index.ts` — 2 aggiunte

### 3a) Import
Dopo la riga:
```ts
import feedRouter from "./feed";
```
aggiungi:
```ts
import economyRouter from "./economy";
```

### 3b) Montaggio
Dopo la riga:
```ts
router.use(feedRouter);
```
aggiungi:
```ts
router.use(economyRouter);
```

---

## 4) Verifica
- Esegui il typecheck/build dell'`api-server` (es. `pnpm --filter @workspace/api-server typecheck` o lo script equivalente del progetto): deve passare con 0 errori.
- NON serve toccare il database: nessun `drizzle-kit push`.
- NON committare e NON fare push.
