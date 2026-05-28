import { Router, type IRouter } from "express";
import healthRouter from "./health";
import templatesRouter from "./templates";
import leaguesRouter from "./leagues";
import federationsRouter from "./federations";
import competitionsRouter from "./competitions";
import marketsRouter from "./markets";
import fantaTeamsRouter from "./fanta-teams";
import playersRouter from "./players";
import contractsRouter from "./contracts";
import dashboardRouter from "./dashboard";
import votoAlgorithmConfigRouter from "./voto-algorithm-config";
import lineupsRouter from "./lineups";
import matchesRouter from "./matches";

const router: IRouter = Router();

router.use(healthRouter);
router.use(templatesRouter);
router.use(leaguesRouter);
router.use(federationsRouter);
router.use(competitionsRouter);
router.use(marketsRouter);
router.use(fantaTeamsRouter);
router.use(playersRouter);
router.use(contractsRouter);
router.use(dashboardRouter);
router.use(votoAlgorithmConfigRouter);
router.use(lineupsRouter);
router.use(matchesRouter);

export default router;
