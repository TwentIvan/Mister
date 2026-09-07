/**
 * Route di autenticazione email/password.
 *
 * POST /auth/register  — crea account (email unica, password hashata con bcrypt)
 * POST /auth/login     — verifica credenziali, apre sessione (cookie HTTP-only)
 * POST /auth/logout    — cancella cookie di sessione
 * GET  /auth/me        — restituisce l'utente corrente (da cookie)
 *
 * NOTE — VERIFICA EMAIL RIMANDATA:
 *   L'email è la chiave univoca ma non è verificata al momento della registrazione.
 *   Implementare la verifica via link magico in una fase successiva.
 *
 * NOTE — GATING ROUTE:
 *   optionalAuth popola req.user ma non rifiuta mai la richiesta.
 *   Il cancello vero (401 se non loggato, 403 se ruolo insufficiente)
 *   è nel Passo B (middleware requireAuth / canManageLeague).
 */

import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { users } from "@workspace/db";
import { setAuthCookie, clearAuthCookie, optionalAuth } from "../lib/auth";

const router: IRouter = Router();

const BCRYPT_ROUNDS = 12;

// ── POST /auth/register ──────────────────────────────────────────────────────

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, display_name } = req.body as {
    email?: unknown;
    password?: unknown;
    display_name?: unknown;
  };

  if (typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Email non valida" });
    return;
  }
  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "La password deve essere di almeno 8 caratteri" });
    return;
  }
  if (typeof display_name !== "string" || display_name.trim().length === 0) {
    res.status(400).json({ error: "Il nome non può essere vuoto" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Controlla duplicato email
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "Email già registrata" });
    return;
  }

  // Hash della password — MAI in chiaro nel DB
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [user] = await db
    .insert(users)
    .values({
      id: `usr-${nanoid(8)}`,
      email: normalizedEmail,
      passwordHash,
      displayName: display_name.trim(),
    })
    .returning();

  setAuthCookie(res, { sub: user.id, email: user.email, displayName: user.displayName });

  res.status(201).json({
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    created_at: user.createdAt,
  });
});

// ── POST /auth/login ─────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: unknown; password?: unknown };

  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Email e password sono obbligatori" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  // Risposta identica per utente non trovato o password errata (no user enumeration)
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Credenziali non valide" });
    return;
  }

  setAuthCookie(res, { sub: user.id, email: user.email, displayName: user.displayName });

  res.json({
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    created_at: user.createdAt,
  });
});

// ── POST /auth/logout ────────────────────────────────────────────────────────

router.post("/auth/logout", (_req, res): void => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// ── GET /auth/me ─────────────────────────────────────────────────────────────

router.get("/auth/me", optionalAuth, (req, res): void => {
  if (!req.user) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }
  res.json({
    id: req.user.sub,
    email: req.user.email,
    display_name: req.user.displayName,
  });
});


// ── PATCH /auth/me — T173.b: profilo (nome, cognome, display name) ───────────
router.patch("/auth/me", async (req, res): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  const b = req.body as { first_name?: string | null; last_name?: string | null; display_name?: string };
  const set: Record<string, unknown> = {};
  if (b.first_name !== undefined) set.firstName = b.first_name;
  if (b.last_name !== undefined) set.lastName = b.last_name;
  if (b.display_name !== undefined && b.display_name.trim()) set.displayName = b.display_name.trim();
  if (Object.keys(set).length === 0) { res.status(400).json({ error: "Nessun campo da aggiornare" }); return; }
  const [u] = await db.update(users).set(set).where(eq(users.id, req.user.sub))
    .returning({ id: users.id, email: users.email, displayName: users.displayName, firstName: users.firstName, lastName: users.lastName });
  res.json({ id: u!.id, email: u!.email, display_name: u!.displayName, first_name: u!.firstName ?? null, last_name: u!.lastName ?? null });
});

export default router;
