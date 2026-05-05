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

// ─── Health check (used by field-staff expo workflow ensurePreviewReachable) ──
app.get("/status", (_req, res) => { res.json({ ok: true }); });

// ─── Production static serving ────────────────────────────────────────────────
// In production this process serves:
//   /api/*  → Express API routes (router above)
//   /       → Field-staff Expo landing page + manifests + static bundles
// Admin-panel is served as a separate static artifact (its own publicDir).

if (process.env.NODE_ENV === "production") {
  const root = process.cwd();

  // ── Field-staff Expo static build ────────────────────────────────────────
  const fieldRoot = path.join(root, "artifacts/field-staff/static-build");
  const templatePath = path.join(
    root,
    "artifacts/field-staff/server/templates/landing-page.html",
  );

  let landingHtml = "";
  let appName = "SCMS Field App";

  if (fs.existsSync(templatePath)) {
    landingHtml = fs.readFileSync(templatePath, "utf-8");
  }
  try {
    const appJsonPath = path.join(root, "artifacts/field-staff/app.json");
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8")) as {
      expo?: { name?: string };
    };
    appName = appJson.expo?.name ?? appName;
  } catch {
    // keep default name
  }

  // /status — lightweight health check (also used by Expo app)
  app.get("/status", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // / — redirect to Admin Panel; /manifest — Expo platform manifest
  app.get("/", (req: Request, res: Response) => {
    const platform = req.headers["expo-platform"] as string | undefined;

    // Expo app requesting manifest
    if (platform === "ios" || platform === "android") {
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

    // Browser — redirect to Admin Panel
    res.redirect(301, "/admin-panel/");
  });

  app.get("/manifest", (req: Request, res: Response) => {
    const platform = req.headers["expo-platform"] as string | undefined;
    if (platform === "ios" || platform === "android") {
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
    res.redirect(301, "/admin-panel/");
  });

  // Field-staff static assets (JS bundles, images, etc.)
  if (fs.existsSync(fieldRoot)) {
    app.use(express.static(fieldRoot));
  }
}

export default app;
