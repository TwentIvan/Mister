/**
 * ⚠️⚠️⚠️ TEMPORANEO — DA RIMUOVERE (debito tracciato in TECH_DEBT.md) ⚠️⚠️⚠️
 *
 * Bypass dei controlli admin di lega per gli sviluppatori, richiesto per
 * sbloccare i test mentre l'assegnazione admin delle leghe seed non è
 * allineata all'account reale e l'accesso SQL su Replit è macchinoso.
 *
 * Chi è in questa lista vede e usa TUTTE le funzioni admin di OGNI lega
 * (bottone Configurazione, nav Impostazioni, ecc.).
 *
 * RIMOZIONE: cancellare questo file e le sue 3 importazioni
 * (nav-model.ts, league-detail.tsx) — grep "dev-superadmin".
 * Il fix vero è il "Passo B" auth (gating server-side) + admin corretto
 * sulle leghe seed.
 */

export const DEV_SUPERADMIN_EMAILS = ["ivan.lotorto@gmail.com"];

export function isDevSuperadmin(email?: string | null): boolean {
  return !!email && DEV_SUPERADMIN_EMAILS.includes(email.trim().toLowerCase());
}
