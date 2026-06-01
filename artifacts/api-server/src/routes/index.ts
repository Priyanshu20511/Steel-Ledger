import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import stockMasterRouter from "./stockMaster";
import openingStockRouter from "./openingStock";
import productionRouter from "./production";
import stockInEntriesRouter from "./stockInEntries";
import stockOutEntriesRouter from "./stockOutEntries";
import dispatchRouter from "./dispatch";
import stockRegisterRouter from "./stockRegister";
import stockLedgerRouter from "./stockLedger";
import stockSummaryRouter from "./stockSummary";
import reportsRouter from "./reports";
import auditLogsRouter from "./auditLogs";
import notificationsRouter from "./notifications";
import backupRouter from "./backup";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(stockMasterRouter);
router.use(openingStockRouter);
router.use(productionRouter);
router.use(stockInEntriesRouter);
router.use(stockOutEntriesRouter);
router.use(dispatchRouter);
router.use(stockRegisterRouter);
router.use(stockLedgerRouter);
router.use(stockSummaryRouter);
router.use(reportsRouter);
router.use(auditLogsRouter);
router.use(notificationsRouter);
router.use(backupRouter);

export default router;
