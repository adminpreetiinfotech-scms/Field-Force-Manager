import { db, staffTable } from "@workspace/db";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/staff", async (_req, res, next) => {
  try {
    const rows = await db.select().from(staffTable).orderBy(staffTable.name);
    res.json(
      rows.map((r) => ({
        id: r.id,
        empCode: r.empCode,
        name: r.name,
        phone: r.phone,
        role: r.role,
      })),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
