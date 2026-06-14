# Istruzioni per l'agente Replit — aggiungere "Cassa" all'indice schermate

Aggiunge la voce della pagina Cassa nell'indice schermate di sviluppo
(`DevPage.tsx`), nel gruppo "Hub / Lega". Una sola riga. Nessun'altra modifica,
niente DB. Non committare/pushare: lascia nel working tree.

---

## Modifica `artifacts/mister-web/src/pages/DevPage.tsx`

Individua la riga (nel gruppo "Hub / Lega (con sidebar)"):

```ts
      { path: `/leagues/${L}/markets`,              label: `/leagues/${L}/markets — Mercati` },
```

e IMMEDIATAMENTE DOPO di essa inserisci:

```ts
      { path: `/leagues/${L}/cassa`,                label: `/leagues/${L}/cassa — Cassa` },
```

---

## Verifica
- Typecheck/build di `mister-web`: 0 errori.
- Nell'indice schermate (DevPage) compare la voce `/leagues/<L>/cassa — Cassa`.
- NON committare e NON fare push.
