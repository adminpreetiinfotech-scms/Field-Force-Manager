import { Router, type IRouter } from "express";
import healthRouter from "./health";
import activityRouter from "./activity";
import staffRouter from "./staff";
import candidatesRouter from "./candidates";
import adminRouter from "./admin";
import mpinRouter from "./mpin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mpinRouter);
router.use(staffRouter);
router.use(activityRouter);
router.use(adminRouter);
router.use(candidatesRouter);

export default router;
