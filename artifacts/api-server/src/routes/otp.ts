import { Router } from "express";
import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db, otpsTable } from "@workspace/db";

const router = Router();

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;

function hashCode(code: string, salt: string): string {
  return crypto.scryptSync(code, salt, 32).toString("hex");
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post("/otp/send", async (req, res) => {
  const { phone } = req.body as { phone?: string };

  if (!phone || !/^\d{10}$/.test(phone)) {
    res.status(400).json({ title: "Enter a valid 10-digit mobile number.", status: 400 });
    return;
  }

  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  const twilioPhone = process.env["TWILIO_PHONE_NUMBER"];

  if (!accountSid || !authToken || !twilioPhone) {
    req.log.warn({ phone }, "Twilio not configured — OTP not sent");
    res.status(503).json({
      title: "SMS service is not configured. Please contact the administrator.",
      status: 503,
    });
    return;
  }

  const code = generateOtp();
  const salt = crypto.randomBytes(16).toString("hex");
  const codeHash = `${salt}:${hashCode(code, salt)}`;
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await db.delete(otpsTable).where(eq(otpsTable.phone, phone));
  await db.insert(otpsTable).values({ phone, codeHash, expiresAt });

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      body: `Your JSDMS/DDU-GKY verification code is ${code}. Valid for 10 minutes. Do not share this code with anyone.`,
      from: twilioPhone,
      to: `+91${phone}`,
    });
  } catch (smsErr) {
    req.log.error({ smsErr }, "Twilio SMS send failed");
    await db.delete(otpsTable).where(eq(otpsTable.phone, phone));
    res.status(502).json({
      title: "Failed to send SMS. Please check the number and try again.",
      status: 502,
    });
    return;
  }

  req.log.info({ phone }, "OTP sent successfully");
  res.json({ message: "OTP sent successfully" });
});

router.post("/otp/verify", async (req, res) => {
  const { phone, otp } = req.body as { phone?: string; otp?: string };

  if (!phone || !/^\d{10}$/.test(phone) || !otp || !/^\d{6}$/.test(otp)) {
    res.status(400).json({ title: "Invalid input.", status: 400 });
    return;
  }

  const records = await db
    .select()
    .from(otpsTable)
    .where(
      and(
        eq(otpsTable.phone, phone),
        eq(otpsTable.used, false),
        gt(otpsTable.expiresAt, new Date()),
      ),
    )
    .orderBy(otpsTable.createdAt)
    .limit(1);

  const record = records[0] ?? null;

  if (!record) {
    res.status(400).json({
      title: "OTP has expired or was not sent. Please request a new one.",
      status: 400,
    });
    return;
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await db.delete(otpsTable).where(eq(otpsTable.id, record.id));
    res.status(400).json({
      title: "Too many incorrect attempts. Please request a new OTP.",
      status: 400,
    });
    return;
  }

  const [salt, storedHash] = record.codeHash.split(":");
  const inputHash = hashCode(otp, salt!);

  if (inputHash !== storedHash) {
    const newAttempts = record.attempts + 1;
    await db
      .update(otpsTable)
      .set({ attempts: newAttempts })
      .where(eq(otpsTable.id, record.id));

    const remaining = MAX_ATTEMPTS - newAttempts;
    if (remaining <= 0) {
      await db.delete(otpsTable).where(eq(otpsTable.id, record.id));
      res.status(400).json({
        title: "Too many incorrect attempts. Please request a new OTP.",
        status: 400,
      });
      return;
    }
    res.status(400).json({
      title: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      status: 400,
    });
    return;
  }

  await db.update(otpsTable).set({ used: true }).where(eq(otpsTable.id, record.id));
  req.log.info({ phone }, "OTP verified successfully");
  res.json({ verified: true });
});

export default router;
