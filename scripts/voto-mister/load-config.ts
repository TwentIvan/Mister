/**
 * load-config.ts — Carica la configurazione algoritmo voto attiva dal DB.
 *
 * Ordine di risoluzione:
 *   1. Config attiva per la federation specifica (se federationId è dato)
 *   2. System default (federation_id NULL, status=active)
 *   3. Errore esplicito se nessuna config attiva trovata (seed non eseguito)
 */

export { loadActiveConfig } from "@workspace/voto-engine";
