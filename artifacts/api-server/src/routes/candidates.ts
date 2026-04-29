import {
  candidateNotificationsTable,
  candidatesTable,
  db,
  staffTable,
} from "@workspace/db";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import express, { Router } from "express";
import fs from "fs";
import path from "path";
import { generateCandidatePdf } from "../services/pdf";

const router = Router();

// ─── Upload directory ──────────────────────────────────────────────────────────

const UPLOADS_BASE = path.join(process.cwd(), "uploads");
const CANDIDATES_DIR = path.join(UPLOADS_BASE, "candidates");
fs.mkdirSync(CANDIDATES_DIR, { recursive: true });

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
  const filepath = path.join(dir, `${name}.${ext}`);
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
    candidateIdCode: c.candidateIdCode ?? null,
    name: c.name,
    phone: c.phone,
    email: c.email ?? null,
    fatherName: c.fatherName ?? null,
    motherName: c.motherName ?? null,
    dob: c.dob ?? null,
    gender: c.gender ?? null,
    maritalStatus: c.maritalStatus ?? null,
    religion: c.religion ?? null,
    address: c.address ?? null,
    village: c.village ?? null,
    policeStation: c.policeStation ?? null,
    postOffice: c.postOffice ?? null,
    district: c.district ?? null,
    state: c.state ?? null,
    pin: c.pin ?? null,
    area: c.area ?? null,
    course: c.course ?? null,
    skillCentreName: c.skillCentreName ?? null,
    aadhaarNumber: c.aadhaarNumber ?? null,
    education: c.education ?? null,
    yearOfPassing: c.yearOfPassing ?? null,
    caste: c.caste ?? null,
    pwd: c.pwd ?? null,
    disabilityType: c.disabilityType ?? null,
    bpl: c.bpl ?? null,
    bplNumber: c.bplNumber ?? null,
    bankAccount: c.bankAccount ?? null,
    bankName: c.bankName ?? null,
    bankBranch: c.bankBranch ?? null,
    ifsc: c.ifsc ?? null,
    mobilizer: c.mobilizer ?? null,
    status: c.status ?? "pending",
    verifiedBy: c.verifiedBy ?? null,
    verifiedAt: c.verifiedAt?.toISOString() ?? null,
    verificationRemarks: c.verificationRemarks ?? null,
    photoUrl: toUrl(c.photoPath),
    aadhaarFrontUrl: toUrl(c.aadhaarFrontPath),
    aadhaarBackUrl: toUrl(c.aadhaarBackPath),
    educationCertUrl: toUrl(c.educationCertPath),
    bankPassbookUrl: toUrl(c.bankPassbookPath),
    casteCertUrl: toUrl(c.casteCertPath),
    pdfUrl: c.pdfPath ? `/api/candidates/${c.id}/pdf` : null,
    submittedBy: c.submittedBy ?? null,
    submittedByPhone: c.submittedByPhone ?? null,
    createdAt: c.createdAt?.toISOString() ?? null,
  };
}

function notifToDto(n: typeof candidateNotificationsTable.$inferSelect) {
  return {
    id: n.id,
    candidateId: n.candidateId,
    candidateName: n.candidateName,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt?.toISOString() ?? null,
  };
}

// ─── POST /api/candidates/check-duplicate ─────────────────────────────────────
// Must be registered BEFORE /candidates/:id

router.post("/candidates/check-duplicate", async (req, res, next) => {
  try {
    const { phone, aadhaarNumber } = req.body as {
      phone?: string;
      aadhaarNumber?: string;
    };

    if (phone && phone.trim()) {
      const [existing] = await db
        .select({ id: candidatesTable.id, name: candidatesTable.name })
        .from(candidatesTable)
        .where(eq(candidatesTable.phone, phone.trim()))
        .limit(1);
      if (existing) {
        res.json({ isDuplicate: true, field: "phone", existingName: existing.name });
        return;
      }
    }

    if (aadhaarNumber && aadhaarNumber.trim().length === 12) {
      const [existing] = await db
        .select({ id: candidatesTable.id, name: candidatesTable.name })
        .from(candidatesTable)
        .where(eq(candidatesTable.aadhaarNumber, aadhaarNumber.trim()))
        .limit(1);
      if (existing) {
        res.json({ isDuplicate: true, field: "aadhaar", existingName: existing.name });
        return;
      }
    }

    res.json({ isDuplicate: false });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/candidates ──────────────────────────────────────────────────────

router.post("/candidates", async (req, res, next) => {
  try {
    const body = req.body as {
      name?: string;
      phone?: string;
      email?: string | null;
      fatherName?: string | null;
      motherName?: string | null;
      dob?: string | null;
      gender?: string | null;
      maritalStatus?: string | null;
      religion?: string | null;
      address?: string | null;
      village?: string | null;
      policeStation?: string | null;
      postOffice?: string | null;
      district?: string | null;
      state?: string | null;
      pin?: string | null;
      area?: string | null;
      course?: string | null;
      skillCentreName?: string | null;
      aadhaarNumber?: string | null;
      education?: string | null;
      yearOfPassing?: string | null;
      caste?: string | null;
      pwd?: string | null;
      disabilityType?: string | null;
      bpl?: string | null;
      bplNumber?: string | null;
      bankAccount?: string | null;
      bankName?: string | null;
      bankBranch?: string | null;
      ifsc?: string | null;
      mobilizer?: string | null;
      submittedBy?: string | null;
      submittedByPhone?: string | null;
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
      signatureBase64?: string | null;
      signatureMime?: string | null;
    };

    if (!body.name?.trim() || body.name.trim().length < 2) {
      res.status(400).json({ title: "Name required (min 2 chars)", status: 400 });
      return;
    }
    if (!body.phone?.trim() || !/^\d{10}$/.test(body.phone.trim())) {
      res.status(400).json({ title: "Valid 10-digit phone required", status: 400 });
      return;
    }

    // Security: verify submitter is an approved staff member.
    if (body.submittedByPhone) {
      const [staffRow] = await db
        .select({ approvalStatus: staffTable.approvalStatus })
        .from(staffTable)
        .where(eq(staffTable.phone, body.submittedByPhone))
        .limit(1);
      if (staffRow && staffRow.approvalStatus !== "approved") {
        res.status(403).json({
          title:
            "Your account is pending admin approval. You cannot submit candidate data until your account is approved.",
          status: 403,
        });
        return;
      }
    }

    const [candidate] = await db
      .insert(candidatesTable)
      .values({
        name: body.name.trim(),
        phone: body.phone.trim(),
        email: body.email?.trim() || null,
        fatherName: body.fatherName?.trim() || null,
        motherName: body.motherName?.trim() || null,
        dob: body.dob?.trim() || null,
        gender: body.gender?.trim() || null,
        maritalStatus: body.maritalStatus?.trim() || null,
        religion: body.religion?.trim() || null,
        address: body.address?.trim() || null,
        village: body.village?.trim() || null,
        policeStation: body.policeStation?.trim() || null,
        postOffice: body.postOffice?.trim() || null,
        district: body.district?.trim() || null,
        state: body.state?.trim() || null,
        pin: body.pin?.trim() || null,
        area: body.area?.trim() || null,
        course: body.course?.trim() || null,
        skillCentreName: body.skillCentreName?.trim() || null,
        aadhaarNumber: body.aadhaarNumber?.trim() || null,
        education: body.education?.trim() || null,
        yearOfPassing: body.yearOfPassing?.trim() || null,
        caste: body.caste?.trim() || null,
        pwd: body.pwd?.trim() || null,
        disabilityType: body.disabilityType?.trim() || null,
        bpl: body.bpl?.trim() || null,
        bplNumber: body.bplNumber?.trim() || null,
        bankAccount: body.bankAccount?.trim() || null,
        bankName: body.bankName?.trim() || null,
        bankBranch: body.bankBranch?.trim() || null,
        ifsc: body.ifsc?.trim() || null,
        mobilizer: body.mobilizer?.trim() || null,
        submittedBy: body.submittedBy?.trim() || null,
        submittedByPhone: body.submittedByPhone?.trim() || null,
        status: "pending",
      })
      .returning();

    const candidateDir = path.join(CANDIDATES_DIR, candidate.id);
    fs.mkdirSync(candidateDir, { recursive: true });

    const photoPath = saveBase64(body.photoBase64, body.photoMime, candidateDir, "photo");
    const aadhaarFrontPath = saveBase64(body.aadhaarFrontBase64, body.aadhaarFrontMime, candidateDir, "aadhaar-front");
    const aadhaarBackPath = saveBase64(body.aadhaarBackBase64, body.aadhaarBackMime, candidateDir, "aadhaar-back");
    const educationCertPath = saveBase64(body.educationCertBase64, body.educationCertMime, candidateDir, "education-cert");
    const bankPassbookPath = saveBase64(body.bankPassbookBase64, body.bankPassbookMime, candidateDir, "bank-passbook");
    const casteCertPath = saveBase64(body.casteCertBase64, body.casteCertMime, candidateDir, "caste-cert");
    const signaturePath = saveBase64(body.signatureBase64, body.signatureMime ?? "image/png", candidateDir, "signature");

    const candidateWithFiles = {
      ...candidate,
      photoPath,
      aadhaarFrontPath,
      aadhaarBackPath,
      educationCertPath,
      bankPassbookPath,
      casteCertPath,
      signaturePath,
    };
    const pdfFilePath = path.join(candidateDir, "profile.pdf");
    try {
      await generateCandidatePdf(candidateWithFiles as typeof candidate, pdfFilePath);
    } catch {
      /* PDF generation failure is non-fatal */
    }
    const pdfExists = fs.existsSync(pdfFilePath);

    const [updated] = await db
      .update(candidatesTable)
      .set({
        photoPath: photoPath ?? undefined,
        aadhaarFrontPath: aadhaarFrontPath ?? undefined,
        aadhaarBackPath: aadhaarBackPath ?? undefined,
        educationCertPath: educationCertPath ?? undefined,
        bankPassbookPath: bankPassbookPath ?? undefined,
        casteCertPath: casteCertPath ?? undefined,
        signaturePath: signaturePath ?? undefined,
        pdfPath: pdfExists ? pdfFilePath : undefined,
      })
      .where(eq(candidatesTable.id, candidate.id))
      .returning();

    res.status(201).json(toDto(updated));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/candidates/my?phone=xxx ─────────────────────────────────────────
// Must be before /candidates/:id

router.get("/candidates/my", async (req, res, next) => {
  try {
    const { phone } = req.query as { phone?: string };
    if (!phone) {
      res.status(400).json({ title: "phone query param required", status: 400 });
      return;
    }
    const rows = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.submittedByPhone, phone))
      .orderBy(desc(candidatesTable.createdAt));
    res.json(rows.map(toDto));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/candidates ────────────────────────────────────────────────

router.get("/admin/candidates", async (req, res, next) => {
  try {
    const { search, status, mobilizer, village, course } = req.query as {
      search?: string;
      status?: string;
      mobilizer?: string;
      village?: string;
      course?: string;
    };

    const conditions = [];
    if (search?.trim()) {
      conditions.push(
        or(
          ilike(candidatesTable.name, `%${search.trim()}%`),
          ilike(candidatesTable.phone, `%${search.trim()}%`),
        ),
      );
    }
    if (status?.trim()) {
      conditions.push(eq(candidatesTable.status, status.trim()));
    }
    if (mobilizer?.trim()) {
      conditions.push(ilike(candidatesTable.submittedBy, `%${mobilizer.trim()}%`));
    }
    if (village?.trim()) {
      conditions.push(ilike(candidatesTable.village, `%${village.trim()}%`));
    }
    if (course?.trim()) {
      conditions.push(ilike(candidatesTable.course, `%${course.trim()}%`));
    }

    const rows = await db
      .select()
      .from(candidatesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(candidatesTable.createdAt));

    res.json(rows.map(toDto));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/candidates/csv ───────────────────────────────────────────

router.get("/admin/candidates/csv", async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    const conditions = status?.trim()
      ? [eq(candidatesTable.status, status.trim())]
      : [];
    const rows = await db
      .select()
      .from(candidatesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(candidatesTable.createdAt));

    const headers = [
      "Candidate ID", "Name", "Phone", "Email", "Father's Name", "Mother's Name",
      "DOB", "Gender", "Marital Status", "Religion", "Category", "PwD",
      "Address", "Village", "Police Station", "Post Office", "District", "State", "PIN",
      "Course", "Skill Centre", "Aadhaar No.", "BPL", "BPL No.",
      "Education", "Year of Passing", "Bank Name", "Account No.", "IFSC", "Branch",
      "Mobilizer", "Status", "Verified By", "Verified At", "Remarks",
      "Submitted By", "Registered On", "PDF Link",
    ];

    function esc(v: string | null | undefined): string {
      if (v == null) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n"))
        return `"${s.replace(/"/g, '""')}"`;
      return s;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const lines = [headers.join(",")];
    for (const r of rows) {
      const pdfLink = r.pdfPath ? `${baseUrl}/api/candidates/${r.id}/pdf` : "";
      lines.push([
        r.candidateIdCode, r.name, r.phone, r.email, r.fatherName, r.motherName,
        r.dob, r.gender, r.maritalStatus, r.religion, r.caste, r.pwd,
        r.address, r.village, r.policeStation, r.postOffice, r.district, r.state, r.pin,
        r.course, r.skillCentreName, r.aadhaarNumber, r.bpl, r.bplNumber,
        r.education, r.yearOfPassing, r.bankName, r.bankAccount, r.ifsc, r.bankBranch,
        r.mobilizer, r.status, r.verifiedBy, r.verifiedAt?.toISOString().slice(0, 10) ?? "", r.verificationRemarks,
        r.submittedBy, r.createdAt?.toISOString().slice(0, 10) ?? "",
        pdfLink,
      ].map(esc).join(","));
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

// ─── PATCH /api/admin/candidates/:id/status ──────────────────────────────────

router.patch("/admin/candidates/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks, verifiedBy } = req.body as {
      status?: string;
      remarks?: string;
      verifiedBy?: string;
    };

    const validStatuses = ["pending", "verified", "rejected", "enrolled"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({
        title: `status must be one of: ${validStatuses.join(", ")}`,
        status: 400,
      });
      return;
    }

    const [candidate] = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.id, id))
      .limit(1);
    if (!candidate) {
      res.status(404).json({ title: "Candidate not found", status: 404 });
      return;
    }

    const [updated] = await db
      .update(candidatesTable)
      .set({
        status,
        verifiedBy: verifiedBy?.trim() || null,
        verifiedAt: new Date(),
        verificationRemarks: remarks?.trim() || null,
      })
      .where(eq(candidatesTable.id, id))
      .returning();

    // Create notification for the submitter.
    if (candidate.submittedByPhone) {
      const statusLabel =
        status === "verified"
          ? "approved ✓"
          : status === "rejected"
            ? "rejected ✗"
            : status === "enrolled"
              ? "enrolled 🎓"
              : status;
      const message = `Your candidate ${candidate.name} has been ${statusLabel}.${remarks ? ` Remark: ${remarks}` : ""}`;
      await db.insert(candidateNotificationsTable).values({
        staffPhone: candidate.submittedByPhone,
        candidateId: candidate.id,
        candidateName: candidate.name,
        message,
      });
    }

    res.json(toDto(updated));
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

    const pdfFilePath = path.join(CANDIDATES_DIR, candidate.id, "profile.pdf");
    if (!fs.existsSync(pdfFilePath)) {
      fs.mkdirSync(path.dirname(pdfFilePath), { recursive: true });
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

// ─── GET /api/notifications?phone=xxx ────────────────────────────────────────

router.get("/notifications", async (req, res, next) => {
  try {
    const { phone } = req.query as { phone?: string };
    if (!phone) {
      res.status(400).json({ title: "phone query param required", status: 400 });
      return;
    }
    const rows = await db
      .select()
      .from(candidateNotificationsTable)
      .where(eq(candidateNotificationsTable.staffPhone, phone))
      .orderBy(desc(candidateNotificationsTable.createdAt));
    res.json(rows.map(notifToDto));
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────

router.patch("/notifications/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;
    const [updated] = await db
      .update(candidateNotificationsTable)
      .set({ isRead: true })
      .where(eq(candidateNotificationsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ title: "Notification not found", status: 404 });
      return;
    }
    res.json(notifToDto(updated));
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/notifications/read-all ───────────────────────────────────────

router.patch("/notifications/read-all", async (req, res, next) => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone) {
      res.status(400).json({ title: "phone required", status: 400 });
      return;
    }
    await db
      .update(candidateNotificationsTable)
      .set({ isRead: true })
      .where(eq(candidateNotificationsTable.staffPhone, phone));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
