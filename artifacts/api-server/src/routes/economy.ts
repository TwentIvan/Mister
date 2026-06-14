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
