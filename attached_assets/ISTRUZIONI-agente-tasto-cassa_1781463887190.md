# Istruzioni per l'agente Replit — tasto "Cassa" in league-detail

Aggiunge un pulsante "Cassa" nella pagina di dettaglio lega, che porta a
`/leagues/:id/cassa`. Visibile a tutti i membri (anche i presidenti, non solo
l'admin) e SOLO se la cassa reale è attiva per la lega.

Sono 4 inserzioni mirate in un solo file:
`artifacts/mister-web/src/pages/league-detail.tsx`. Nessun'altra modifica,
niente DB. Non committare/pushare: lascia nel working tree.

---

## 1) Import dell'icona `Wallet`

Sostituisci la riga:

```ts
import { Trophy, Users, Calendar, Activity, BookOpen, Gavel, ArrowLeft, Settings, Plus, Copy, Link2 } from "lucide-react";
```

con:

```ts
import { Trophy, Users, Calendar, Activity, BookOpen, Gavel, ArrowLeft, Settings, Plus, Copy, Link2, Wallet } from "lucide-react";
```

## 2) Import dell'hook config economy

Dopo la riga:

```ts
import { useCurrentUser } from "@/contexts/AuthContext";
```

aggiungi:

```ts
import { useEconomyConfig } from "@/lib/economy-api";
```

## 3) Chiamata dell'hook

Dopo la riga:

```ts
  const { id } = useParams<{ id: string }>();
```

aggiungi:

```ts
  const { data: economyConfig } = useEconomyConfig(id!);
```

## 4) Il pulsante

Individua questo blocco (il link "Tutte le leghe"):

```tsx
          <Link href="/leagues">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              Tutte le leghe
            </Button>
          </Link>
```

e IMMEDIATAMENTE DOPO il suo `</Link>` di chiusura inserisci:

```tsx
          {economyConfig?.realMoneyEnabled && (
            <Link href={`/leagues/${league.id}/cassa`}>
              <Button variant="outline" className="gap-2 border-primary/20 text-primary">
                <Wallet className="h-4 w-4" />
                Cassa
              </Button>
            </Link>
          )}
```

---

## 5) Verifica
- Typecheck/build di `mister-web`: 0 errori.
- Nella pagina di una lega con cassa attiva compare il pulsante "Cassa" che
  porta a `/leagues/<ID>/cassa`. Nelle leghe senza cassa il pulsante non appare.
- NON committare e NON fare push.
