import { useParams } from "wouter";

/**
 * Legge un parametro di route in modo sicuro.
 *
 * Wouter v3 con component= prop può restituire il template della route
 * (es. ":competitionId") come stringa truthy al primo render SPA, prima
 * che il match sia completamente risolto. Questo hook filtra quel caso e
 * ritorna undefined finché il valore reale non è disponibile.
 *
 * Pattern d'uso (hooks obbligatori prima del guard):
 *
 *   const competitionId = useRouteId("competitionId");
 *   const { data, isLoading } = useGetSomething(competitionId ?? "");
 *   if (!competitionId) return <RouteIdLoading />;
 */
export function useRouteId(name: string): string | undefined {
  const params = useParams<Record<string, string>>();
  const value = params[name];
  if (!value || value.startsWith(":")) return undefined;
  return value;
}

/**
 * Spinner minimale da usare nel guard while useRouteId ritorna undefined.
 * Sostituisce i fallback hardcoded che mascheravano il bug wouter-v3.
 */
export function RouteIdLoading() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#cfc6ad",
      }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 13,
          color: "#8a8266",
          letterSpacing: "0.04em",
        }}
      >
        Caricamento…
      </span>
    </div>
  );
}
