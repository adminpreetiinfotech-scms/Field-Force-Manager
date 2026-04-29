import { Router, type IRouter } from "express";
import healthRouter from "./health";
import activityRouter from "./activity";
import staffRouter from "./staff";

const router: IRouter = Router();

router.use(healthRouter);
router.use(staffRouter);
router.use(activityRouter);

export default router;
