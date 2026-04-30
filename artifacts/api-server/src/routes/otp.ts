import { Router } from "express";
import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const router = Router();

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]!;
  const projectId = process.env["EXPO_PUBLIC_FIREBASE_PROJECT_ID"];
  if (!projectId) throw new Error("EXPO_PUBLIC_FIREBASE_PROJECT_ID is not set");
  return initializeApp({ projectId });
}

router.post("/otp/verify-token", async (req, res) => {
  const { idToken, phone } = req.body as { idToken?: string; phone?: string };

  if (!idToken || !phone) {
    res.status(400).json({ title: "idToken and phone are required.", status: 400 });
    return;
  }

  try {
    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken);

    const tokenPhone = decoded.phone_number;
    const expectedPhone = `+91${phone}`;

    if (tokenPhone !== expectedPhone) {
      res.status(401).json({
        title: "Phone number mismatch. Verification failed.",
        status: 401,
      });
      return;
    }

    req.log.info({ phone }, "Firebase OTP verified successfully");
    res.json({ verified: true, uid: decoded.uid });
  } catch (err) {
    req.log.error({ err }, "Firebase token verification failed");
    res.status(401).json({
      title: "Invalid or expired verification code. Please try again.",
      status: 401,
    });
  }
});

export default router;
