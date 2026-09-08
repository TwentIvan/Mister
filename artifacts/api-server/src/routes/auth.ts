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
import { sql } from "drizzle-orm";
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


// ═══ T172 — SIGN IN WITH GOOGLE ══════════════════════════════════════════════
// Flusso authorization-code con verifica server-side. Aggancio PER EMAIL:
// chi esiste già entra nel proprio account (squadre incluse); chi non esiste
// viene creato al volo. La password locale resta valida come alternativa.

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";
const G_REDIRECT = process.env["GOOGLE_REDIRECT_URI"] ?? "https://api.fantamister.cloud/api/auth/google/callback";
const G_FRONTEND = process.env["FRONTEND_URL"] ?? "https://app.fantamister.cloud";

router.get("/auth/google", (req, res): void => {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  if (!clientId) { res.status(503).json({ error: "Google login non configurato" }); return; }
  const state = nanoid(24);
  res.cookie("g_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 10 * 60_000, path: "/" });
  const url = `${GOOGLE_AUTH}?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: G_REDIRECT,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString()}`;
  res.redirect(url);
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    const cookieState = (req.cookies as Record<string, string> | undefined)?.["g_state"];
    if (!code || !state || !cookieState || state !== cookieState) {
      res.redirect(`${G_FRONTEND}/login?error=google`);
      return;
    }
    res.clearCookie("g_state", { path: "/" });

    const tokenResp = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env["GOOGLE_CLIENT_ID"] ?? "",
        client_secret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
        redirect_uri: G_REDIRECT,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResp.ok) { res.redirect(`${G_FRONTEND}/login?error=google`); return; }
    const tokens = (await tokenResp.json()) as { access_token?: string };
    if (!tokens.access_token) { res.redirect(`${G_FRONTEND}/login?error=google`); return; }

    const infoResp = await fetch(GOOGLE_USERINFO, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const info = (await infoResp.json()) as { email?: string; verified_email?: boolean; name?: string };
    const email = info.email?.trim().toLowerCase();
    if (!email || info.verified_email === false) { res.redirect(`${G_FRONTEND}/login?error=google`); return; }

    // aggancio per email o creazione
    let [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`);
    if (!user) {
      const randomPw = await bcrypt.hash(nanoid(32), 10);
      const inserted = await db.insert(users).values({
        id: `usr-${nanoid(8)}`,
        email,
        passwordHash: randomPw,
        displayName: info.name?.trim() || email.split("@")[0]!,
      }).returning();
      user = inserted[0]!;
      req.log.info({ email }, "T172: utente creato via Google");
    }
    setAuthCookie(res, { sub: user.id, email: user.email, displayName: user.displayName });
    res.redirect(G_FRONTEND);
  } catch (e) {
    req.log.error({ err: e }, "T172: errore callback Google");
    res.redirect(`${G_FRONTEND}/login?error=google`);
  }
});

export default router;
