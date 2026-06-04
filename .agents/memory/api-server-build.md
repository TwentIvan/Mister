---
name: Api-server build details
description: Il bundle compilato è dist/index.mjs (non dist/index.js). Il restart_workflow non garantisce rebuild se il build precedente era stale.
---

# Dettagli build

- Bundle output: `artifacts/api-server/dist/index.mjs`
- Dev script: `export NODE_ENV=development && pnpm run build && pnpm run start`
- Rebuild esplicito: `cd artifacts/api-server && pnpm run build` (oppure `pnpm --filter @workspace/api-server run build` dalla root)

**Why:** Se il restart_workflow avviene prima che il file source sia flush su disco, o se il dist è già presente da un build precedente parziale, potrebbe servire un rebuild esplicito.

**How to apply:** Dopo ogni modifica a src/, fare rebuild esplicito prima di restart_workflow per essere sicuri che il bundle sia aggiornato.
