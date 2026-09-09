import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { optionalAuth } from "./lib/auth";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());

// T178: healthcheck — risposta immediata, zero DB (per Coolify/monitoring)
app.get("/health", (_req, res) => { res.json({ ok: true }); });
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(optionalAuth);

app.use("/api", router);

export default app;
