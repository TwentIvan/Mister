# Debito tecnico — da saldare

| # | Cosa | Dove | Introdotto | Rimozione |
|---|---|---|---|---|
| TD-1 | **Bypass superadmin dev** per ivan.lotorto@gmail.com: funzioni admin di ogni lega, frontend E backend (guardLeagueAdmin) | `artifacts/mister-web/src/lib/dev-superadmin.ts` + 2 import; `artifacts/api-server/src/lib/auth.ts` (`grep -r "DEV_SUPERADMIN\|dev-superadmin"`) | 2026-09-04, per sbloccare i test config lega | Cancellare il file e gli import quando: (a) admin corretto sulle leghe seed, (b) gating server-side "Passo B" auth |
| TD-2 | Gating admin lato server assente ("Passo B" auth): le rotte di update lega non verificano l'admin | `artifacts/api-server/src/routes/leagues.ts` e affini | pre-esistente (design incrementale) | Con l'implementazione del Passo B |
| TD-3 | Test disallineato: `chiamo.test.ts` si aspetta null ma parseIntent restituisce `chiama_notfound` | `artifacts/mister-web/src/hooks/__tests__/chiamo.test.ts` | pre-esistente | Aggiornare l'aspettativa del test |
