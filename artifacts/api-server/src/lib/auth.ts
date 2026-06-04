/**
 * auth.ts — middleware di autenticazione opzionale.
 *
 * optionalAuth: legge il cookie `mister_auth`, verifica il JWT, attacca
 * req.user se valido. Non rifiuta mai la richiesta (gating = Passo B).
 *
 * currentUserId(): helper per route che vogliono l'id utente loggato
 * senza ripetere il cast ogni volta.
 */

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "mister_auth";
const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret-CHANGE-IN-PROD";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 giorni

export interface AuthPayload {
  sub: string;         // user.id
  email: string;
  displayName: string;
}

/** Estende Express.Request con user opzionale. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/** Verifica il cookie di sessione e popola req.user se valido. */
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
