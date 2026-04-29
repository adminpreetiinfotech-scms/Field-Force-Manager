import { db, candidatesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import express, { Router } from "express";
import fs from "fs";
import path from "path";
import { generateCandidatePdf } from "../services/pdf";

const router = Router();

// ─── Upload directory ──────────────────────────────────────────────────────────

const UPLOADS_BASE = path.join(process.cwd(), "uploads");
const CANDIDATES_DIR = path.join(UPLOADS_BASE, "candidates");
fs.mkdirSync(CANDIDATES_DIR, { recursive: true });

// Serve uploaded files under /api/uploads/*
router.use("/uploads", express.static(UPLOADS_BASE));

// ─── Helpers ───────────────────────────────────────────────────────────────────

function saveBase64(
  base64: string | null | undefined,
  mimeType: string | null | undefined,
  dir: string,
  name: string,
): string | null {
  if (!base64) return null;
  const ext = (mimeType || "image/jpeg").includes("png") ? "png" : "jpg";
  const filename = `${name}.${ext}`;
  const filepath = path.join(dir, filename);
  try {
    fs.writeFileSync(filepath, Buffer.from(base64, "base64"));
    return filepath;
  } catch {
    return null;
  }
}

function toUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const rel = path.relative(UPLOADS_BASE, filePath).replace(/\\/g, "/");
  return `/api/uploads/${rel}`;
}

function toDto(c: typeof candidatesTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    fatherName: c.fatherName ?? null,
    dob: c.dob ?? null,
    gender: c.gender ?? null,
    address: c.address ?? null,
    area: c.area ?? null,
    aadhaarNumber: c.aadhaarNumber ?? null,
    education: c.education ?? null,
    bankAccount: c.bankAccount ?? null,
    bankName: c.bankName ?? null,
    ifsc: c.ifsc ?? null,
    caste: c.caste ?? null,
    photoUrl: toUrl(c.photoPath),
    aadhaarFrontUrl: toUrl(c.aadhaarFrontPath),
    aadhaarBackUrl: toUrl(c.aadhaarBackPath),
    educationCertUrl: toUrl(c.educationCertPath),
    bankPassbookUrl: toUrl(c.bankPassbookPath),
    casteCertUrl: toUrl(c.casteCertPath),
    pdfUrl: c.pdfPath ? `/api/candidates/${c.id}/pdf` : null,
    submittedBy: c.submittedBy ?? null,
    createdAt: c.createdAt?.toISOString() ?? null,
  };
}

// ─── POST /api/candidates ──────────────────────────────────────────────────────

router.post("/candidates", async (req, res, next) => {
  try {
    const body = req.body as {
      name?: string;
      phone?: string;
      fatherName?: string | null;
      dob?: string | null;
      gender?: string | null;
      address?: string | null;
      area?: string | null;
      aadhaarNumber?: string | null;
      education?: string | null;
      bankAccount?: string | null;
      bankName?: string | null;
      ifsc?: string | null;
      caste?: string | null;
      submittedBy?: string | null;
      photoBase64?: string | null;
      photoMime?: string | null;
      aadhaarFrontBase64?: string | null;
      aadhaarFrontMime?: string | null;
      aadhaarBackBase64?: string | null;
      aadhaarBackMime?: string | null;
      educationCertBase64?: string | null;
      educationCertMime?: string | null;
      bankPassbookBase64?: string | null;
      bankPassbookMime?: string | null;
      casteCertBase64?: string | null;
      casteCertMime?: string | null;
    };

    if (!body.name || body.name.trim().length < 2) {
      res.status(400).json({ title: "Name required", status: 400 });
      return;
    }
    if (!body.phone || !/^\d{10}$/.test(body.phone.trim())) {
      res.status(400).json({ title: "Valid 10-digit phone required", status: 400 });
      return;
    }

    // Insert first to get the ID for the folder name.
    const [candidate] = await db
      .insert(candidatesTable)
      .values({
        name: body.name.trim(),
        phone: body.phone.trim(),
        fatherName: body.fatherName?.trim() || null,
        dob: body.dob?.trim() || null,
        gender: body.gender?.trim() || null,
        address: body.address?.trim() || null,
        area: body.area?.trim() || null,
        aadhaarNumber: body.aadhaarNumber?.trim() || null,
        education: body.education?.trim() || null,
        bankAccount: body.bankAccount?.trim() || null,
        bankName: body.bankName?.trim() || null,
        ifsc: body.ifsc?.trim() || null,
        caste: body.caste?.trim() || null,
        submittedBy: body.submittedBy?.trim() || null,
      })
      .returning();

    // Save uploaded files.
    const candidateDir = path.join(CANDIDATES_DIR, candidate.id);
    fs.mkdirSync(candidateDir, { recursive: true });

    const photoPath = saveBase64(body.photoBase64, body.photoMime, candidateDir, "photo");
    const aadhaarFrontPath = saveBase64(body.aadhaarFrontBase64, body.aadhaarFrontMime, candidateDir, "aadhaar-front");
    const aadhaarBackPath = saveBase64(body.aadhaarBackBase64, body.aadhaarBackMime, candidateDir, "aadhaar-back");
    const educationCertPath = saveBase64(body.educationCertBase64, body.educationCertMime, candidateDir, "education-cert");
    const bankPassbookPath = saveBase64(body.bankPassbookBase64, body.bankPassbookMime, candidateDir, "bank-passbook");
    const casteCertPath = saveBase64(body.casteCertBase64, body.casteCertMime, candidateDir, "caste-cert");

    // Generate PDF
    const pdfFilePath = path.join(candidateDir, "profile.pdf");
    const candidateWithFiles = {
      ...candidate,
      photoPath,
      aadhaarFrontPath,
      aadhaarBackPath,
      educationCertPath,
      bankPassbookPath,
      casteCertPath,
    };
    try {
      await generateCandidatePdf(candidateWithFiles as typeof candidate, pdfFilePath);
    } catch {
      // PDF generation failure is non-fatal
    }

    const pdfExists = fs.existsSync(pdfFilePath);

    // Update record with file paths and PDF path.
    const [updated] = await db
      .update(candidatesTable)
      .set({
        photoPath: photoPath ?? undefined,
        aadhaarFrontPath: aadhaarFrontPath ?? undefined,
        aadhaarBackPath: aadhaarBackPath ?? undefined,
        educationCertPath: educationCertPath ?? undefined,
        bankPassbookPath: bankPassbookPath ?? undefined,
        casteCertPath: casteCertPath ?? undefined,
        pdfPath: pdfExists ? pdfFilePath : undefined,
      })
      .where(eq(candidatesTable.id, candidate.id))
      .returning();

    res.status(201).json(toDto(updated));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/candidates ────────────────────────────────────────────────

router.get("/admin/candidates", async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(candidatesTable)
      .orderBy(desc(candidatesTable.createdAt));
    res.json(rows.map(toDto));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/candidates/csv ───────────────────────────────────────────

router.get("/admin/candidates/csv", async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(candidatesTable)
      .orderBy(desc(candidatesTable.createdAt));

    const headers = [
      "Name", "Phone", "Father's Name", "DOB", "Gender",
      "Area", "Address", "Aadhaar No.", "Education", "Caste",
      "Bank Name", "Account No.", "IFSC",
      "Submitted By", "Registered On", "PDF Link",
    ];

    function escapeCsv(v: string | null | undefined): string {
      if (v == null) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }

    const lines = [headers.join(",")];
    const baseUrl = `${_req.protocol}://${_req.get("host")}`;
    for (const r of rows) {
      const pdfLink = r.pdfPath ? `${baseUrl}/api/candidates/${r.id}/pdf` : "";
      lines.push([
        r.name, r.phone, r.fatherName, r.dob, r.gender,
        r.area, r.address, r.aadhaarNumber, r.education, r.caste,
        r.bankName, r.bankAccount, r.ifsc,
        r.submittedBy,
        r.createdAt?.toISOString().slice(0, 10) ?? "",
        pdfLink,
      ].map(escapeCsv).join(","));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="candidates_${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(lines.join("\r\n"));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/candidates/:id ──────────────────────────────────────────────────

router.get("/candidates/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const [candidate] = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.id, id))
      .limit(1);
    if (!candidate) {
      res.status(404).json({ title: "Candidate not found", status: 404 });
      return;
    }
    res.json(toDto(candidate));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/candidates/:id/pdf ──────────────────────────────────────────────

router.get("/candidates/:id/pdf", async (req, res, next) => {
  try {
    const { id } = req.params;
    const [candidate] = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.id, id))
      .limit(1);

    if (!candidate) {
      res.status(404).json({ title: "Candidate not found", status: 404 });
      return;
    }

    const candidateDir = path.join(CANDIDATES_DIR, candidate.id);
    const pdfFilePath = path.join(candidateDir, "profile.pdf");

    // Regenerate PDF if missing
    if (!fs.existsSync(pdfFilePath)) {
      fs.mkdirSync(candidateDir, { recursive: true });
      try {
        await generateCandidatePdf(candidate, pdfFilePath);
      } catch (pdfErr) {
        next(pdfErr);
        return;
      }
    }

    const safeName = candidate.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="candidate_${safeName}.pdf"`,
    );
    fs.createReadStream(pdfFilePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
