import { Router, type IRouter } from "express";
import { streamLogoToResponse } from "../lib/logoStorage";

const router: IRouter = Router();

/**
 * GET /api/storage/objects/*
 * Serves objects stored in GCS (company logos, etc.)
 */
router.get(/^\/storage\/objects\/(.+)$/, async (req, res, next) => {
  try {
    const rawPath = (req.params as unknown as string[])[0] ?? "";
    const objectPath = "/" + rawPath;
    const found = await streamLogoToResponse(objectPath, res);
    if (!found) {
      res.status(404).json({ title: "Object not found", status: 404 });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
