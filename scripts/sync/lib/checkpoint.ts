import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CHECKPOINT_FILE = resolve(__dirname, "../.checkpoint.json");

function loadAll(): Record<string, unknown> {
  if (!existsSync(CHECKPOINT_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CHECKPOINT_FILE, "utf-8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, unknown>): void {
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function loadCheckpoint(scriptName: string): unknown {
  return loadAll()[scriptName] ?? null;
}

export function saveCheckpoint(scriptName: string, state: unknown): void {
  const all = loadAll();
  all[scriptName] = state;
  saveAll(all);
}

export function clearCheckpoint(scriptName: string): void {
  const all = loadAll();
  delete all[scriptName];
  saveAll(all);
}
