import { Router, type IRouter } from "express";
import healthRouter from "./health";
import activityRouter from "./activity";
import staffRouter from "./staff";
import candidatesRouter from "./candidates";
import adminRouter from "./admin";
import mpinRouter from "./mpin";
import reportsRouter from "./reports";
import noticesRouter from "./notices";
import companiesRouter from "./companies";
import superAdminRouter from "./super-admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mpinRouter);
router.use(companiesRouter);
router.use(superAdminRouter);
router.use(staffRouter);
router.use(activityRouter);
router.use(adminRouter);
router.use(candidatesRouter);
router.use(reportsRouter);
router.use(noticesRouter);

export default router;
