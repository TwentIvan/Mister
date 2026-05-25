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
  try {
    await seedSystemTemplates(db);
    logger.info("Seed template di sistema completato");
  } catch (err) {
    logger.warn({ err }, "Seed template di sistema fallito (non bloccante)");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start();
