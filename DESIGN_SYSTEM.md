# DESIGN_SYSTEM.md
**Token, scala tipografica, componenti. La fonte concreta per costruire UI Mister.**

Leggi prima AGENT_BRIEF.md per il contesto. Questo file è il "come".

---

## 1. CSS variables (token)

Inserisci questo blocco nel CSS globale, da cui attingono tutti i componenti.

```css
:root {
  /* === COLORI === */
  --green-deep:   #1f4733;
  --green-mid:    #2d6b4f;
  --green-pale:   #e8f0eb;
  --cream:        #efe6d3;
  --cream-dark:   #e2d6bf;
  --ink:          #0a1f17;
  --ink-mid:      #4a5550;
  --ink-dim:      #8a9591;
  --sidebar-bg:   #0d1f1a;
  --sidebar-fg:   #d4dcd8;
  --sidebar-dim:  #6b7570;
  --paper:        #fafaf7;
  --surface:      #ffffff;
  --border:       #e5e7e4;
  --border-strong:#cdd2cf;
  --danger:       #8b2c2c;
  --warn:         #a06820;
  --success:      var(--green-deep);

  /* === FONT FAMILY === */
  --font-serif:   "Fraunces", Georgia, serif;
  --font-mono:    "JetBrains Mono", "SF Mono", Menlo, monospace;
  --font-sans:    "Inter", -apple-system, system-ui, sans-serif;

  /* === SCALA TIPOGRAFICA === */
  --text-xs:    11px;
  --text-sm:    13px;
  --text-base:  14px;
  --text-md:    16px;
  --text-lg:    20px;
  --text-xl:    28px;
  --text-2xl:   38px;
  --text-3xl:   52px;
  --leading-tight: 1.15;
  --leading-normal: 1.5;
  --leading-relaxed: 1.65;

  /* === SPAZIATURA (multipli di 4) === */
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 20px;
  --sp-6: 24px;
  --sp-8: 32px;
  --sp-10: 40px;
  --sp-12: 48px;
  --sp-16: 64px;

  /* === RADII === */
  --r-sm: 4px;
  --r-md: 6px;
  --r-lg: 10px;

  /* === SHADOWS === */
  --shadow-card: 0 1px 2px rgba(10, 31, 23, 0.04), 0 1px 3px rgba(10, 31, 23, 0.06);
  --shadow-elevated: 0 4px 12px rgba(10, 31, 23, 0.08), 0 2px 4px rgba(10, 31, 23, 0.04);
}

* { box-sizing: border-box; }
html { font-size: 14px; }
body {
  font-family: var(--font-sans);
  color: var(--ink);
  background: var(--paper);
  line-height: var(--leading-normal);
}
```

---

## 2. Regola tipografica (decisiva per il "feel" Mister)

**Mai un titolo H1 o H2 in sans-serif.** Mai un numero in sans-serif. Mai uno slug o ID o codice in sans-serif.

```css
/* Titoli di pagina e sezione: Fraunces */
h1, .h-page {
  font-family: var(--font-serif);
  font-size: var(--text-2xl);
  font-weight: 600;
  line-height: var(--leading-tight);
  letter-spacing: -0.01em;
  color: var(--green-deep);
}
h2, .h-section {
  font-family: var(--font-serif);
  font-size: var(--text-xl);
  font-weight: 600;
  line-height: var(--leading-tight);
  color: var(--ink);
}
h3, .h-block {
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--ink);
}

/* TUTTI i numeri: JetBrains Mono */
.num, .metric, .credit, .price, .date, .id, .slug, .code, .badge-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.metric-big {
  font-family: var(--font-mono);
  font-size: var(--text-2xl);
  font-weight: 500;
  color: var(--green-deep);
  letter-spacing: -0.01em;
}

/* Etichette form, sottotitoli */
.label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--ink-mid);
  text-transform: none; /* niente uppercase a vanvera */
}
.label-tiny {
  font-size: var(--text-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-dim);
}
```

---

## 3. Layout app (sidebar + main)

```html
<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <span class="brand-name">MISTER</span>
    </div>
    <nav class="nav">
      <div class="nav-section">
        <div class="label-tiny" style="color: var(--sidebar-dim); padding: var(--sp-3) var(--sp-4) var(--sp-2);">Menu</div>
        <a class="nav-item active">Cruscotto</a>
        <a class="nav-item">Le mie leghe</a>
        <a class="nav-item">Giocatori</a>
      </div>
      <div class="nav-section">
        <div class="label-tiny" style="color: var(--sidebar-dim); padding: var(--sp-3) var(--sp-4) var(--sp-2);">Amministrazione</div>
        <a class="nav-item">Profili</a>
      </div>
    </nav>
    <div class="user-row">
      <div class="avatar">IV</div>
      <div class="user-name">Ivan</div>
    </div>
  </aside>
  <main class="main">
    <!-- contenuto -->
  </main>
</div>
```

```css
.app { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.sidebar {
  background: var(--sidebar-bg);
  color: var(--sidebar-fg);
  display: flex;
  flex-direction: column;
  padding: var(--sp-6) 0 var(--sp-4);
}
.brand {
  padding: 0 var(--sp-5) var(--sp-8);
}
.brand-name {
  font-family: var(--font-serif);
  font-size: var(--text-lg);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--green-mid);
}
.nav { flex: 1; }
.nav-item {
  display: block;
  padding: var(--sp-2) var(--sp-5);
  font-size: var(--text-sm);
  color: var(--sidebar-fg);
  text-decoration: none;
  border-left: 2px solid transparent;
  cursor: pointer;
}
.nav-item:hover { background: rgba(255,255,255,0.04); }
.nav-item.active {
  background: rgba(45, 107, 79, 0.18);
  border-left-color: var(--green-mid);
  color: white;
}
.user-row {
  display: flex; align-items: center; gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-5);
  border-top: 1px solid rgba(255,255,255,0.06);
}
.avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--green-mid); color: white;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 600;
}
.main { padding: var(--sp-8) var(--sp-10); max-width: 1400px; }
```

---

## 4. Header di pagina

```html
<header class="page-header">
  <div>
    <h1 class="h-page">Regolamento</h1>
    <p class="page-subtitle">Configura le regole sportive e le feature attive nella tua lega.</p>
  </div>
  <div class="page-actions">
    <button class="btn btn-primary">Salva regolamento</button>
  </div>
</header>
```

```css
.page-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: var(--sp-8);
  gap: var(--sp-6);
}
.page-subtitle {
  margin-top: var(--sp-1);
  color: var(--ink-mid);
  font-size: var(--text-base);
  max-width: 640px;
}
```

---

## 5. Card e pannelli

```html
<section class="card">
  <header class="card-header">
    <div>
      <h3 class="h-block">Contratti</h3>
      <p class="card-sub">Durata, rinnovo, prelazione.</p>
    </div>
    <span class="badge badge-soft">5 flag</span>
  </header>
  <div class="card-body">
    <!-- contenuto -->
  </div>
</section>
```

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-card);
}
.card-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: var(--sp-5) var(--sp-6);
  border-bottom: 1px solid var(--border);
}
.card-sub {
  margin-top: 2px;
  font-size: var(--text-sm);
  color: var(--ink-mid);
}
.card-body { padding: var(--sp-5) var(--sp-6); }
```

---

## 6. Stat card (per dashboard)

```html
<div class="stat">
  <div class="stat-label">Manager iscritti</div>
  <div class="stat-value-row">
    <span class="metric-big">8</span>
    <span class="stat-fraction">/ 12</span>
  </div>
  <a class="stat-action">Invita un manager →</a>
</div>
```

```css
.stat {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: var(--sp-5) var(--sp-6);
  display: flex; flex-direction: column; gap: var(--sp-2);
}
.stat-label {
  font-size: var(--text-sm);
  color: var(--ink-mid);
  font-weight: 500;
}
.stat-value-row {
  display: flex; align-items: baseline; gap: var(--sp-2);
}
.stat-fraction {
  font-family: var(--font-mono);
  font-size: var(--text-md);
  color: var(--ink-dim);
}
.stat-action {
  font-size: var(--text-sm);
  color: var(--green-deep);
  text-decoration: none;
  margin-top: var(--sp-2);
}
.stat-action:hover { text-decoration: underline; }
```

**Quando un valore è 0, l'action è prominente.** "Manager iscritti: 0/12" diventa una CTA piena, non un numero spento.

---

## 7. Bottoni

```html
<button class="btn btn-primary">Salva regolamento</button>
<button class="btn btn-secondary">Annulla</button>
<button class="btn btn-danger">Elimina lega</button>
<button class="btn btn-ghost">Modifica</button>
```

```css
.btn {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 500;
  padding: var(--sp-2) var(--sp-4);
  border-radius: var(--r-sm);
  border: 1px solid transparent;
  cursor: pointer;
  display: inline-flex; align-items: center; gap: var(--sp-2);
  transition: background 80ms ease;
}
.btn-primary {
  background: var(--green-deep);
  color: white;
  border-color: var(--green-deep);
}
.btn-primary:hover { background: var(--green-mid); }
.btn-secondary {
  background: var(--surface);
  color: var(--ink);
  border-color: var(--border-strong);
}
.btn-secondary:hover { background: var(--paper); }
.btn-danger {
  background: transparent;
  color: var(--danger);
  border-color: transparent;
}
.btn-danger:hover { background: rgba(139, 44, 44, 0.06); }
.btn-ghost {
  background: transparent;
  color: var(--ink-mid);
  border-color: transparent;
}
```

---

## 8. Form (input, textarea, select, toggle)

```html
<label class="field">
  <span class="label">Nome lega</span>
  <input type="text" class="input" value="Champions del Bar Roma">
</label>

<label class="field">
  <span class="label">Modalità</span>
  <select class="input">
    <option value="classic">Classico</option>
    <option value="mantra">Mantra</option>
  </select>
</label>

<label class="field">
  <span class="label">Descrizione</span>
  <textarea class="input" rows="3">…</textarea>
</label>
```

```css
.field {
  display: flex; flex-direction: column; gap: var(--sp-2);
  margin-bottom: var(--sp-4);
}
.input {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-sm);
  background: var(--surface);
  color: var(--ink);
}
.input:focus {
  outline: none;
  border-color: var(--green-deep);
  box-shadow: 0 0 0 3px rgba(31, 71, 51, 0.12);
}
/* per input numerici e select con valori tipo "5 stagioni": forza mono */
.input.num { font-family: var(--font-mono); }
```

**Toggle row** (riga regolamento, vedi sezione 11 per uso):

```html
<div class="toggle-row">
  <div class="toggle-text">
    <div class="toggle-title">Contratti pluriennali</div>
    <div class="toggle-desc">Permette contratti di durata maggiore di 1 stagione.</div>
  </div>
  <button class="toggle" data-on="true" aria-pressed="true">
    <span class="toggle-knob"></span>
  </button>
</div>
```

```css
.toggle-row {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: var(--sp-3) 0;
  gap: var(--sp-6);
  border-bottom: 1px solid var(--border);
}
.toggle-row:last-child { border-bottom: 0; }
.toggle-title {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--ink);
}
.toggle-desc {
  font-size: var(--text-sm);
  color: var(--ink-mid);
  margin-top: 2px;
  max-width: 480px;
}
.toggle {
  width: 36px; height: 20px;
  border-radius: 999px;
  background: var(--border-strong);
  border: 0; padding: 2px; cursor: pointer;
  flex-shrink: 0;
  position: relative;
}
.toggle[aria-pressed="true"] { background: var(--green-deep); }
.toggle-knob {
  display: block; width: 16px; height: 16px;
  background: white; border-radius: 50%;
  transition: transform 120ms ease;
}
.toggle[aria-pressed="true"] .toggle-knob { transform: translateX(16px); }
```

---

## 9. Badge

```html
<span class="badge badge-role badge-role-gk">P</span>
<span class="badge badge-role badge-role-def">D</span>
<span class="badge badge-role badge-role-mid">C</span>
<span class="badge badge-role badge-role-att">A</span>

<span class="badge badge-soft">Stagione 2025</span>
<span class="badge badge-success">In corso</span>
<span class="badge badge-mute">In asta</span>
```

```css
.badge {
  display: inline-flex; align-items: center;
  padding: 2px 8px;
  border-radius: var(--r-sm);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  letter-spacing: 0.02em;
}
.badge-role { font-weight: 700; padding: 2px 6px; }
.badge-role-gk  { background: #fef0c7; color: #7a5d0f; }
.badge-role-def { background: #d9eed9; color: #2f5d2f; }
.badge-role-mid { background: #dbe6f7; color: #1f3d70; }
.badge-role-att { background: #f7dbdb; color: #8b2c2c; }

.badge-soft   { background: var(--green-pale); color: var(--green-deep); }
.badge-success{ background: var(--green-deep); color: white; }
.badge-mute   { background: var(--sidebar-bg); color: var(--sidebar-fg); }
```

---

## 10. Tabella (per database giocatori e simili)

```html
<table class="data-table">
  <thead>
    <tr>
      <th class="w-role">Ruolo</th>
      <th>Giocatore</th>
      <th>Squadra</th>
      <th>Mantra</th>
      <th class="num">Valore</th>
      <th class="num">Quotazione</th>
      <th>Stato</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-role badge-role-gk">P</span></td>
      <td>
        <div class="player-name">Donnarumma</div>
        <div class="player-full">Gianluigi Donnarumma</div>
      </td>
      <td class="team-cell">Napoli</td>
      <td>
        <span class="badge badge-mute">Por</span>
      </td>
      <td class="num">38</td>
      <td class="num">42</td>
      <td><span class="status-dot status-ok"></span></td>
    </tr>
  </tbody>
</table>
```

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}
.data-table th {
  text-align: left;
  font-weight: 500;
  color: var(--ink-mid);
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--border);
  font-size: var(--text-sm);
}
.data-table th.num { text-align: right; font-family: var(--font-mono); }
.data-table td {
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.data-table td.num { text-align: right; font-family: var(--font-mono); }
.data-table tbody tr:hover { background: var(--paper); }
.player-name { font-weight: 600; color: var(--ink); }
.player-full { font-size: var(--text-xs); color: var(--ink-dim); }
.team-cell { color: var(--ink-mid); font-size: var(--text-sm); }
.status-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
}
.status-ok { background: var(--green-mid); }
.status-injured { background: var(--warn); }
.status-out { background: var(--danger); }
```

**[FORTE]** La colonna "Squadra" deve essere LEGGIBILE — non un grigio sbiadito. Nelle screenshot attuali il testo della squadra è quasi invisibile, è un bug. Usa `var(--ink-mid)` non `var(--ink-dim)`.

---

## 11. Pannello regolamento federation con tutti i 18 flag

Questo è il pezzo più importante da riprogettare. La pagina attuale ne mostra 6, il backend ne ha 18. Layout corretto:

```html
<h2 class="h-section">Regolamento</h2>

<!-- BLOCCO IMPOSTAZIONI GENERALI -->
<section class="card" style="margin-bottom: var(--sp-6);">
  <header class="card-header">
    <h3 class="h-block">Impostazioni generali</h3>
    <p class="card-sub">Identità della federazione e modalità di gioco.</p>
  </header>
  <div class="card-body" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-5);">
    <label class="field" style="grid-column: 1 / -1;">
      <span class="label">Nome federazione</span>
      <input class="input" value="Regolamento Serie A Fantasy">
    </label>
    <label class="field" style="grid-column: 1 / -1;">
      <span class="label">Descrizione</span>
      <textarea class="input" rows="2">Regolamento ufficiale della lega</textarea>
    </label>
    <label class="field">
      <span class="label">Modalità</span>
      <select class="input">
        <option>Classico</option>
        <option>Mantra</option>
      </select>
    </label>
    <!-- NESSUN campo Voto Source. È stato rimosso dal modello. -->
  </div>
</section>

<!-- BLOCCO FEATURE FLAG, RAGGRUPPATI PER CATEGORIA -->
<section class="card" style="margin-bottom: var(--sp-6);">
  <header class="card-header">
    <h3 class="h-block">Contratti</h3>
    <p class="card-sub">Durata, rinnovo, prelazione del detentore uscente.</p>
  </header>
  <div class="card-body">
    <!-- ciclare i 4 flag categoria "contracts" -->
    <div class="toggle-row">
      <div class="toggle-text">
        <div class="toggle-title">Contratti pluriennali</div>
        <div class="toggle-desc">Permette contratti di durata maggiore di 1 stagione. Se off, ogni stagione riparte con rosa azzerata.</div>
      </div>
      <button class="toggle" aria-pressed="true"><span class="toggle-knob"></span></button>
    </div>
    <!-- Quando "Contratti pluriennali" è on, espandere il campo numerico: -->
    <div class="toggle-row">
      <div class="toggle-text">
        <div class="toggle-title">Durata massima contratto</div>
        <div class="toggle-desc">Numero massimo di stagioni per ogni giocatore.</div>
      </div>
      <input type="number" class="input num" style="width: 80px;" value="5" min="1" max="10">
    </div>
    <div class="toggle-row">
      <div class="toggle-text">
        <div class="toggle-title">Rinnovo contrattuale</div>
        <div class="toggle-desc">Abilita il flusso esplicito di rinnovo prima della scadenza.</div>
      </div>
      <button class="toggle" aria-pressed="true"><span class="toggle-knob"></span></button>
    </div>
    <div class="toggle-row">
      <div class="toggle-text">
        <div class="toggle-title">Diritto di pareggio in asta</div>
        <div class="toggle-desc">Alla scadenza, il detentore può pareggiare in tempo reale i rilanci nell'asta di re-acquisto.</div>
      </div>
      <button class="toggle" aria-pressed="true"><span class="toggle-knob"></span></button>
    </div>
  </div>
</section>

<!-- Ripetere per le altre 4 categorie: Mercato (4 flag), Economia (8 flag), Tattica (1 flag), Scouting (1 flag) -->
```

**Mappa categorie → flag** (leggi da `lib/db/src/flags.ts`):

| Categoria   | Flag                                                                    |
|-------------|-------------------------------------------------------------------------|
| contracts   | multi_season_contracts, max_contract_length, contract_renewal, preemption_right |
| market      | repair_auction_january, free_agent_pool, direct_trades, always_on_markets       |
| economy     | carryover_budget, carryover_percentage, player_value_dynamic, amortization, release_clauses, clause_default_factor, rescission_penalty, rescission_recovery_pct |
| tactics     | no_schema_tactics                                                       |
| scouting    | scouting_enabled                                                        |

**Pattern**: i flag booleani sono toggle. I flag float/int sono input numerici. Quando un toggle padre è off, i flag figli devono essere visivamente disabilitati (`opacity: 0.4; pointer-events: none;`) — es. se `multi_season_contracts=off`, anche `max_contract_length`, `contract_renewal`, `preemption_right` sono spenti.

---

## 12. Card di template profilo (per Template Manager)

Le card attuali sono troppo minimali. Pattern corretto:

```html
<article class="template-card">
  <header class="template-head">
    <div>
      <h3 class="template-name">Manageriale</h3>
      <div class="template-slug">manageriale · livello 3 · ~50 min/sett.</div>
    </div>
    <div class="template-toggle">
      <span class="badge badge-success">Attivo</span>
      <button class="toggle" aria-pressed="true"><span class="toggle-knob"></span></button>
    </div>
  </header>

  <p class="template-desc">Il prodotto pieno: contratti fino a 5 stagioni, ammortamento, clausole rescissorie, scouting, mercato sempre attivo.</p>

  <div class="template-flags">
    <div class="flag-chip flag-on">contratti 5 anni</div>
    <div class="flag-chip flag-on">clausole rescissorie</div>
    <div class="flag-chip flag-on">scouting</div>
    <div class="flag-chip flag-on">carryover 100%</div>
    <div class="flag-chip flag-off">tattica no-schema</div>
    <div class="flag-chip-more">+ 13 altri flag →</div>
  </div>

  <footer class="template-foot">
    <div class="template-counts">
      <span><span class="num">5</span> mercati suggeriti</span>
      <span><span class="num">3</span> competizioni suggerite</span>
    </div>
    <div class="template-actions">
      <button class="btn btn-ghost">Duplica</button>
      <button class="btn btn-secondary">Modifica</button>
    </div>
  </footer>
</article>
```

```css
.template-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: var(--sp-5) var(--sp-6);
}
.template-head { display: flex; justify-content: space-between; align-items: flex-start; }
.template-name { font-family: var(--font-serif); font-size: var(--text-lg); font-weight: 600; }
.template-slug { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-dim); margin-top: 2px; }
.template-desc { font-size: var(--text-sm); color: var(--ink-mid); margin: var(--sp-3) 0 var(--sp-4); }
.template-flags { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-4); }
.flag-chip {
  font-family: var(--font-mono); font-size: var(--text-xs);
  padding: 2px 8px; border-radius: var(--r-sm);
  background: var(--green-pale); color: var(--green-deep);
}
.flag-chip.flag-off { background: var(--paper); color: var(--ink-dim); text-decoration: line-through; }
.flag-chip-more { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--green-mid); cursor: pointer; }
.template-foot {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: var(--sp-4); border-top: 1px solid var(--border);
}
.template-counts { display: flex; gap: var(--sp-5); font-size: var(--text-sm); color: var(--ink-mid); }
.template-actions { display: flex; gap: var(--sp-2); }
```

I template di sistema (is_system=true) hanno il bottone **Modifica** ma non **Elimina**. Solo **Disattiva**. Solo i template custom hanno Elimina.

---

## 13. Empty state (vuoto ma utile)

```html
<div class="empty">
  <div class="empty-text">
    <h3 class="h-block">Nessuna competizione ancora</h3>
    <p>Per iniziare la stagione crea almeno un torneo: campionato, coppa, o uno dei formati alternativi.</p>
  </div>
  <button class="btn btn-primary">Crea competizione</button>
</div>
```

```css
.empty {
  display: flex; justify-content: space-between; align-items: center;
  padding: var(--sp-6);
  background: var(--paper);
  border: 1px dashed var(--border-strong);
  border-radius: var(--r-md);
}
.empty p { font-size: var(--text-sm); color: var(--ink-mid); max-width: 480px; }
```

**Mai mostrare un empty state senza un'azione.** Mai "No managers registered yet." come testo terminale.

---

## 14. Pannello "dark" (Active Markets sidebar style)

Nella screenshot del cruscotto c'è già un pannello scuro a destra per i mercati attivi. Mantieni il pattern, è un bel touch.

```css
.panel-dark {
  background: var(--sidebar-bg);
  color: var(--sidebar-fg);
  border-radius: var(--r-md);
  padding: var(--sp-5) var(--sp-6);
}
.panel-dark h3 { color: white; }
.panel-dark .market-row {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: var(--sp-3) 0;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.panel-dark .market-row:last-child { border-bottom: 0; }
.market-name { color: white; font-size: var(--text-sm); font-weight: 500; }
.market-deadline { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--sidebar-dim); }
.market-type {
  font-family: var(--font-mono); font-size: var(--text-xs);
  padding: 2px 6px; border-radius: var(--r-sm);
  background: rgba(45,107,79,0.3); color: #b8d4c4;
}
```

---

## 15. Ordine di priorità per il refactor

Se devi sistemare le 5 pagine attuali, fallo in quest'ordine (impatto sull'identità del prodotto, dal massimo al minimo):

1. **Pannello Regolamento (Federation Rules)** — espandere a 18 flag categorizzati, rimuovere Voto Source. Sezione 11 di questo file.
2. **Template Manager** — riprogettare le card con flag preview + counts + actions. Sezione 12.
3. **Lingua** — tradurre tutto in italiano via la tabella in AGENT_BRIEF.md sezione 2.
4. **Tipografia** — applicare Fraunces / Mono / Sans secondo la regola tipografica. Sezione 2 di questo file.
5. **Database giocatori** — popolare con tutti i ~500 giocatori Serie A via API-Football, non 15 sample.
6. **League dashboard** — aggiungere CTA inline ai numeri zero, aggiungere pannelli secondari.
