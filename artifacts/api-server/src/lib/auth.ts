/**
 * auth.ts — middleware e guard di autenticazione.
 *
 * optionalAuth: popola req.user dal cookie JWT (non rifiuta mai).
 * requireAuth: 401 se non autenticato.
 * guardLeagueAdmin / guardLeagueMember / guardFederationOwner:
 *   helper asincroni — inviano 401/403 e restituiscono false; true se ok.
 *   Uso: if (!await guardLeagueAdmin(req, res, leagueId)) return;
 */

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { leagueMembers, federations } from "@workspace/db";

const COOKIE_NAME = "mister_auth";

// JWT_SECRET: fallback dev, FATAL in produzione se non impostato.
const rawSecret = process.env["JWT_SECRET"];
if (!rawSecret && process.env["NODE_ENV"] === "production") {
  throw new Error(
    "FATAL: JWT_SECRET non impostato. Impostare la variabile d'ambiente prima di avviare il server in produzione."
  );
}
const JWT_SECRET = rawSecret ?? "dev-secret-CHANGE-IN-PROD";

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 giorni

export interface AuthPayload {
  sub: string;         // user.id
  email: string;
  displayName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/** Verifica il cookie di sessione e popola req.user se valido. Non rifiuta mai. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token: string | undefined = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET) as AuthPayload;
    } catch {
      // token scaduto o manomesso: ignoriamo, req.user resta undefined
    }
  }
  next();
}

/** 401 se non autenticato. Da usare come middleware Express. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return;
  }
  next();
}

/** Firma un JWT e scrive il cookie HTTP-only. */
export function setAuthCookie(res: Response, payload: AuthPayload): void {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

/** Cancella il cookie di sessione. */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

// ─── Guard helpers ────────────────────────────────────────────────────────────

/** Verifica se userId è admin della lega. Pura, senza side-effect HTTP. */
export async function isLeagueAdmin(userId: string, leagueId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: leagueMembers.userId })
    .from(leagueMembers)
    .where(
      and(
        eq(leagueMembers.userId, userId),
        eq(leagueMembers.leagueId, leagueId),
        eq(leagueMembers.role, "admin"),
      ),
    );
  return !!row;
}

/** Verifica se userId è membro (qualsiasi ruolo) della lega. */
export async function isLeagueMember(userId: string, leagueId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: leagueMembers.userId })
    .from(leagueMembers)
    .where(
      and(
        eq(leagueMembers.userId, userId),
        eq(leagueMembers.leagueId, leagueId),
      ),
    );
  return !!row;
}

/**
 * Guard: richiede che req.user sia admin della lega.
 * Restituisce false (e ha già inviato 401/403) se non autorizzato.
 */
export async function guardLeagueAdmin(
  req: Request,
  res: Response,
  leagueId: string,
): Promise<boolean> {
  if (!req.user) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return false;
  }
  if (!(await isLeagueAdmin(req.user.sub, leagueId))) {
    res.status(403).json({ error: "Riservato all'amministratore della lega" });
    return false;
  }
  return true;
}

/**
 * Guard: richiede che req.user sia membro (o admin) della lega.
 */
export async function guardLeagueMember(
  req: Request,
  res: Response,
  leagueId: string,
): Promise<boolean> {
  if (!req.user) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return false;
  }
  if (!(await isLeagueMember(req.user.sub, leagueId))) {
    res.status(403).json({ error: "Non sei membro di questa lega" });
    return false;
  }
  return true;
}

/**
 * Guard: richiede che req.user sia il proprietario della federazione.
 * Attenzione: un admin che ha ADOTTATO una federazione non è il proprietario.
 */
export async function guardFederationOwner(
  req: Request,
  res: Response,
  federationId: string,
): Promise<boolean> {
  if (!req.user) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return false;
  }
  const [fed] = await db
    .select({ ownerUserId: federations.ownerUserId })
    .from(federations)
    .where(eq(federations.id, federationId));
  if (!fed) {
    res.status(404).json({ error: "Federazione non trovata" });
    return false;
  }
  if (fed.ownerUserId !== req.user.sub) {
    res.status(403).json({ error: "Riservato al proprietario della federazione" });
    return false;
  }
  return true;
}
