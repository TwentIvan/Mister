import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { seedSystemTemplates } from "@workspace/db/seeds";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  // Apre la porta subito — il seed avviene in background
  await new Promise<void>((resolve, reject) => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        reject(err);
        return;
      }
      logger.info({ port }, "Server listening");
      resolve();
    });
  });

  // Seed in background — non blocca l'avvio
  seedSystemTemplates(db)
    .then(() => logger.info("Seed template di sistema completato"))
    .catch((err) =>
      logger.warn({ err }, "Seed template di sistema fallito (non bloccante)"),
    );
}

start().catch((err) => {
  logger.error({ err }, "Fatal error during startup");
  process.exit(1);
});
