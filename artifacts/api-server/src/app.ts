import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import fs from "fs";

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
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.use("/api", router);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/status", (_req, res) => { res.json({ ok: true }); });

// ─── Root redirect → always send browsers to Admin Panel ─────────────────────
app.get(["/", "/manifest"], (req: Request, res: Response) => {
  const platform = req.headers["expo-platform"] as string | undefined;

  // Expo APK requesting manifest — serve from field-staff static build
  if (platform === "ios" || platform === "android") {
    const root = process.cwd();
    const fieldRoot = path.join(root, "artifacts/field-staff/static-build");
    const manifestPath = path.join(fieldRoot, platform, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      res.status(404).json({ error: `Manifest not found for: ${platform}` });
      return;
    }
    res.setHeader("expo-protocol-version", "1");
    res.setHeader("expo-sfv-version", "0");
    res.setHeader("content-type", "application/json");
    res.send(fs.readFileSync(manifestPath, "utf-8"));
    return;
  }

  // Browser — redirect to Admin Panel login
  res.redirect(301, "/admin-panel/");
});

// ─── Field-staff static assets (production only) ──────────────────────────────
if (process.env.NODE_ENV === "production") {
  const fieldRoot = path.join(process.cwd(), "artifacts/field-staff/static-build");
  if (fs.existsSync(fieldRoot)) {
    app.use(express.static(fieldRoot));
  }
}

export default app;
