import ExcelJS from "exceljs";
import {
  candidateAuditLogTable,
  candidateNotificationsTable,
  candidatesTable,
  centersTable,
  companiesTable,
  db,
  staffTable,
} from "@workspace/db";
import { and, desc, eq, gte, ilike, inArray, isNull, lt, or } from "drizzle-orm";
import express, { Router } from "express";
import { isValidUUID } from "../lib/validation";
import fs from "fs";
import path from "path";
import { sendSmsSilent } from "../lib/twilio";
import { sendPushSilent } from "../lib/push";
import { downloadLogoBuffer } from "../lib/logoStorage";
import { generateCandidatePdf, type PdfReportOpts } from "../services/pdf";
import { requireAdmin } from "./admin";

const PDF_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

function fmtDMY(d: Date | null | undefined): string {
  if (!d) return new Date().toLocaleDateString("en-IN");
  const day = d.getDate().toString().padStart(2, "0");
  return `${day} ${PDF_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

type CompanyBranding = {
  companyName?: string | null;
  companyLogoPath?: string | null;
  companyLogoBuffer?: Buffer | null;
  schemeName?: string | null;
  tcId?: string | null;
};

function buildPdfOpts(
  candidate: { skillCentreName?: string | null; centerTcId?: string | null; mobilizer?: string | null; submittedBy?: string | null; createdAt?: Date | null },
  query?: Record<string, string>,
  branding?: CompanyBranding,
): PdfReportOpts {
  return {
    organization:      query?.["organization"]?.trim() || candidate.skillCentreName?.trim() || null,
    staffName:         query?.["staffName"]?.trim()    || candidate.mobilizer?.trim() || candidate.submittedBy?.trim() || null,
    reportDate:        fmtDMY(candidate.createdAt ? new Date(candidate.createdAt) : new Date()),
    // Do NOT pass companyName — always keep the original JSDMS Jharkhand government header.
    // Candidate's own centerTcId takes priority; fall back to company-level tcId.
    companyName:       null,
    companyLogoPath:   null,
    companyLogoBuffer: null,
    schemeName:        null,
    tcId:              candidate.centerTcId?.trim() || branding?.tcId || null,
  };
}

async function fetchCompanyBranding(companyId: string | null | undefined): Promise<CompanyBranding> {
  if (!companyId) return {};
  try {
    const [co] = await db
      .select({ name: companiesTable.name, logoPath: companiesTable.logoPath, projectName: companiesTable.projectName, tcId: companiesTable.tcId })
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);
    if (!co) return {};
    // Download logo buffer from GCS (if path is a GCS object path)
    const logoBuffer = co.logoPath
      ? await downloadLogoBuffer(co.logoPath)
      : null;
    return {
      companyName:       co.name ?? null,
      companyLogoPath:   co.logoPath ?? null,   // kept as fallback for legacy disk paths
      companyLogoBuffer: logoBuffer,
      schemeName:        co.projectName ?? null,
      tcId:              co.tcId ?? null,
    };
  } catch {
    return {};
  }
}

/**
 * Resolve the best company ID for branding.
 * Priority: candidate.companyId → staff lookup via submittedByPhone → first company in DB.
 * This ensures tcId, logo etc. always appear on PDFs even if candidate.companyId is null.
 */
async function resolveCompanyIdForBranding(
  candidateCompanyId: string | null | undefined,
  submittedByPhone: string | null | undefined,
): Promise<string | null> {
  if (candidateCompanyId) return candidateCompanyId;
  // Fallback 1: look up staff member's companyId
  if (submittedByPhone) {
    try {
      const [staffRow] = await db
        .select({ companyId: staffTable.companyId })
        .from(staffTable)
        .where(eq(staffTable.phone, submittedByPhone))
        .limit(1);
      if (staffRow?.companyId) return staffRow.companyId;
    } catch { /* ignore */ }
  }
  // Fallback 2: if there is exactly one company (single-tenant deploy), use it
  try {
    const [only] = await db
      .select({ id: companiesTable.id })
      .from(companiesTable)
      .limit(1);
    if (only) return only.id;
  } catch { /* ignore */ }
  return null;
}

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

const ALLOWED_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 6 * 1024 * 1024; // 6 MB

function validateBase64File(
  base64: string | null | undefined,
  mime: string | null | undefined,
  fieldName: string,
): void {
  if (!base64) return;
  if (mime && !ALLOWED_MIMES.includes(mime.toLowerCase())) {
    throw Object.assign(
      new Error(`${fieldName}: only JPEG, PNG and WebP images are allowed (got ${mime})`),
      { status: 400 },
    );
  }
  // Approximate decoded size: base64 length × 3/4
  const approxBytes = Math.ceil((base64.length * 3) / 4);
  if (approxBytes > MAX_FILE_BYTES) {
    throw Object.assign(
      new Error(`${fieldName}: file too large (max 5 MB)`),
      { status: 400 },
    );
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
    parentMobile: c.parentMobile ?? null,
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
    casteCertAvailable: (c as any).casteCertAvailable ?? null,
    casteName: (c as any).casteName ?? null,
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

// ─── POST /api/public/candidates/register ─────────────────────────────────────
//
// PUBLIC self-registration endpoint. No auth, no submitter staff check.
// Used by the browser /register page so prospective candidates can sign up
// themselves without going through a field-staff mobilizer. The record is
// created as an orphan (company_id = NULL) with status = "pending"; a super
// admin then adopts it into the right company via the existing
// "Adopt Orphans" action and approves it from the candidates list.
router.post("/public/candidates/register", async (req, res, next) => {
  try {
    const body = req.body as {
      name?: string;
      phone?: string;
      parentMobile?: string | null;
      email?: string | null;
      fatherName?: string | null;
      motherName?: string | null;
      dob?: string | null;
      gender?: string | null;
      address?: string | null;
      village?: string | null;
      district?: string | null;
      state?: string | null;
      pin?: string | null;
      course?: string | null;
      skillCentreName?: string | null;
      aadhaarNumber?: string | null;
      education?: string | null;
      yearOfPassing?: string | null;
    };

    // Validation — same rules as the staff-driven endpoint.
    if (!body.name?.trim() || body.name.trim().length < 2) {
      res.status(400).json({ title: "Name required (min 2 chars)", status: 400 });
      return;
    }
    if (!body.phone?.trim() || !/^\d{10}$/.test(body.phone.trim())) {
      res.status(400).json({ title: "Valid 10-digit phone required", status: 400 });
      return;
    }
    if (!body.parentMobile?.trim() || !/^\d{10}$/.test(body.parentMobile.trim())) {
      res.status(400).json({ title: "Parent's mobile number (10 digits) is required", status: 400 });
      return;
    }
    if (!body.dob?.trim()) {
      res.status(400).json({ title: "Date of birth is required", status: 400 });
      return;
    }
    if (body.aadhaarNumber?.trim() && !/^\d{12}$/.test(body.aadhaarNumber.trim())) {
      res.status(400).json({ title: "Aadhaar number must be exactly 12 digits", status: 400 });
      return;
    }
    if (body.pin?.trim() && !/^\d{6}$/.test(body.pin.trim())) {
      res.status(400).json({ title: "PIN code must be 6 digits", status: 400 });
      return;
    }

    // Duplicate phone guard — application-level uniqueness on phone.
    const phone = body.phone.trim();
    const [dupPhone] = await db
      .select({ id: candidatesTable.id })
      .from(candidatesTable)
      .where(eq(candidatesTable.phone, phone))
      .limit(1);
    if (dupPhone) {
      res.status(409).json({
        title: "A candidate with this phone number is already registered",
        status: 409,
      });
      return;
    }
    if (body.aadhaarNumber?.trim()) {
      const [dupAadhaar] = await db
        .select({ id: candidatesTable.id })
        .from(candidatesTable)
        .where(eq(candidatesTable.aadhaarNumber, body.aadhaarNumber.trim()))
        .limit(1);
      if (dupAadhaar) {
        res.status(409).json({
          title: "A candidate with this Aadhaar number is already registered",
          status: 409,
        });
        return;
      }
    }

    const [candidate] = await db
      .insert(candidatesTable)
      .values({
        companyId: null,
        name: body.name.trim(),
        phone,
        parentMobile: body.parentMobile.trim(),
        email: body.email?.trim() || null,
        fatherName: body.fatherName?.trim() || null,
        motherName: body.motherName?.trim() || null,
        dob: body.dob.trim(),
        gender: body.gender?.trim() || null,
        address: body.address?.trim() || null,
        village: body.village?.trim() || null,
        district: body.district?.trim() || null,
        state: body.state?.trim() || null,
        pin: body.pin?.trim() || null,
        course: body.course?.trim() || null,
        skillCentreName: body.skillCentreName?.trim() || null,
        aadhaarNumber: body.aadhaarNumber?.trim() || null,
        education: body.education?.trim() || null,
        yearOfPassing: body.yearOfPassing?.trim() || null,
        submittedBy: "Self Registration",
        submittedByPhone: phone,
        status: "pending",
      })
      .returning({
        id: candidatesTable.id,
        name: candidatesTable.name,
        status: candidatesTable.status,
      });

    req.log.info(
      { candidateId: candidate.id, candidateName: candidate.name, phone },
      "Self-registered candidate created",
    );

    res.status(201).json({
      id: candidate.id,
      name: candidate.name,
      status: candidate.status,
      message:
        "Registration received. An admin will review your details and contact you shortly.",
    });
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
      parentMobile?: string | null;
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
      centerTcId?: string | null;
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
      otherDocBase64?: string | null;
      otherDocMime?: string | null;
      candidateIdCode?: string | null;
      casteCertAvailable?: string | null;
      casteName?: string | null;
    };

    if (!body.name?.trim() || body.name.trim().length < 2) {
      res.status(400).json({ title: "Name required (min 2 chars)", status: 400 });
      return;
    }
    if (!body.phone?.trim() || !/^\d{10}$/.test(body.phone.trim())) {
      res.status(400).json({ title: "Valid 10-digit phone required", status: 400 });
      return;
    }
    if (!body.parentMobile?.trim() || !/^\d{10}$/.test(body.parentMobile.trim())) {
      res.status(400).json({ title: "Parent's mobile number (10 digits) is required", status: 400 });
      return;
    }
    if (!body.dob?.trim()) {
      res.status(400).json({ title: "Date of birth is required", status: 400 });
      return;
    }
    if (body.aadhaarNumber?.trim() && !/^\d{12}$/.test(body.aadhaarNumber.trim())) {
      res.status(400).json({ title: "Aadhaar number must be exactly 12 digits", status: 400 });
      return;
    }
    if (body.pin?.trim() && !/^\d{6}$/.test(body.pin.trim())) {
      res.status(400).json({ title: "PIN code must be 6 digits", status: 400 });
      return;
    }
    // Secure file validation — type + size for each upload
    try {
      validateBase64File(body.photoBase64, body.photoMime, "Candidate photo");
      validateBase64File(body.aadhaarFrontBase64, body.aadhaarFrontMime, "Aadhaar front");
      validateBase64File(body.aadhaarBackBase64, body.aadhaarBackMime, "Aadhaar back");
      validateBase64File(body.educationCertBase64, body.educationCertMime, "Education certificate");
      validateBase64File(body.bankPassbookBase64, body.bankPassbookMime, "Bank passbook");
      validateBase64File(body.casteCertBase64, body.casteCertMime, "Caste certificate");
      validateBase64File(body.signatureBase64, body.signatureMime, "Signature");
      validateBase64File(body.otherDocBase64, body.otherDocMime, "Other document");
    } catch (validationErr) {
      const e = validationErr as Error & { status?: number };
      res.status(e.status ?? 400).json({ title: e.message, status: e.status ?? 400 });
      return;
    }

    // Security: verify submitter is an approved staff member. Also capture their company_id and center_id.
    let submitterCompanyId: string | null = null;
    let submitterCenterId: string | null = null;
    if (body.submittedByPhone) {
      const [staffRow] = await db
        .select({ approvalStatus: staffTable.approvalStatus, companyId: staffTable.companyId, centerId: staffTable.centerId })
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
      submitterCompanyId = staffRow?.companyId ?? null;
      submitterCenterId = staffRow?.centerId ?? null;
    }

    // Block candidate registration if company subscription is expired/inactive
    if (submitterCompanyId) {
      const [company] = await db
        .select({
          subscriptionActive: companiesTable.subscriptionActive,
          subscriptionEndDate: companiesTable.subscriptionEndDate,
        })
        .from(companiesTable)
        .where(eq(companiesTable.id, submitterCompanyId))
        .limit(1);
      if (company) {
        const blocked = !company.subscriptionActive ||
          (company.subscriptionEndDate !== null && new Date() > new Date(company.subscriptionEndDate));
        if (blocked) {
          res.status(403).json({ title: "Subscription expired. Contact admin.", status: 403 });
          return;
        }
      }
    }

    // Enforce: candidates must be registered under staff's assigned center only.
    let assignedCenterName: string | null = null;
    let assignedCenterTcId: string | null = null;
    if (submitterCenterId) {
      const [centerRow] = await db
        .select({ name: centersTable.name, tcId: centersTable.tcId })
        .from(centersTable)
        .where(eq(centersTable.id, submitterCenterId))
        .limit(1);
      if (centerRow) {
        assignedCenterName = centerRow.name;
        assignedCenterTcId = centerRow.tcId ?? null;
      }
    }

    const [candidate] = await db
      .insert(candidatesTable)
      .values({
        companyId: submitterCompanyId,
        name: body.name.trim(),
        phone: body.phone.trim(),
        parentMobile: body.parentMobile?.trim() || null,
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
        // Always use staff's assigned center — overrides whatever the client sent
        skillCentreName: assignedCenterName ?? body.skillCentreName?.trim() ?? null,
        centerTcId: assignedCenterTcId ?? body.centerTcId?.trim() ?? null,
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
        candidateIdCode: body.candidateIdCode?.trim() || null,
        casteCertAvailable: body.casteCertAvailable?.trim() || null,
        casteName: body.casteName?.trim() || null,
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
    const otherDocPath = saveBase64(body.otherDocBase64, body.otherDocMime, candidateDir, "other-doc");

    const candidateWithFiles = {
      ...candidate,
      photoPath,
      aadhaarFrontPath,
      aadhaarBackPath,
      educationCertPath,
      bankPassbookPath,
      casteCertPath,
      signaturePath,
      otherDocPath,
    };
    const pdfFilePath = path.join(candidateDir, "profile.pdf");
    try {
      const resolvedCompanyId = await resolveCompanyIdForBranding(submitterCompanyId, body.submittedByPhone?.trim());
      const branding = await fetchCompanyBranding(resolvedCompanyId);
      await generateCandidatePdf(
        candidateWithFiles as typeof candidate,
        pdfFilePath,
        buildPdfOpts(candidate, undefined, branding),
      );
    } catch (pdfErr) {
      req.log.error({ err: pdfErr, candidateId: candidate.id }, "PDF generation failed (non-fatal)");
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
        otherDocPath: otherDocPath ?? undefined,
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

router.get("/admin/candidates", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const { search, status, mobilizer, village, course } = req.query as {
      search?: string;
      status?: string;
      mobilizer?: string;
      village?: string;
      course?: string;
    };

    const conditions = [];
    if (companyId) conditions.push(or(eq(candidatesTable.companyId, companyId), isNull(candidatesTable.companyId)));
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

router.get("/admin/candidates/csv", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const { status, mobilizer, from, to, skillCentre, format: fmt } = req.query as {
      status?: string;
      mobilizer?: string;
      from?: string; // YYYY-MM-DD
      to?: string;   // YYYY-MM-DD
      skillCentre?: string;
      format?: string; // "xlsx" | "csv" (default csv)
    };
    const conditions = [];
    if (companyId) conditions.push(or(eq(candidatesTable.companyId, companyId), isNull(candidatesTable.companyId)));
    if (status?.trim()) conditions.push(eq(candidatesTable.status, status.trim()));
    if (mobilizer?.trim()) conditions.push(ilike(candidatesTable.mobilizer, `%${mobilizer.trim()}%`));
    if (skillCentre?.trim()) conditions.push(ilike(candidatesTable.skillCentreName, `%${skillCentre.trim()}%`));
    if (from?.trim()) {
      const fromDate = new Date(from.trim());
      if (!isNaN(fromDate.getTime())) conditions.push(gte(candidatesTable.createdAt, fromDate));
    }
    if (to?.trim()) {
      const toDate = new Date(to.trim());
      if (!isNaN(toDate.getTime())) {
        toDate.setDate(toDate.getDate() + 1); // inclusive of the to-date
        conditions.push(lt(candidatesTable.createdAt, toDate));
      }
    }
    const rows = await db
      .select()
      .from(candidatesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(candidatesTable.createdAt));

    const headers = [
      "Candidate ID", "Name", "Phone", "Parent's Mobile", "Email", "Father's Name", "Mother's Name",
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
    const dateStr = new Date().toISOString().slice(0, 10);
    const centerLabel = skillCentre?.trim() ? `_${skillCentre.trim().replace(/\s+/g, "_")}` : "";

    if (fmt === "xlsx") {
      // ── Excel format ──────────────────────────────────────────────────────────
      const wb = new ExcelJS.Workbook();
      wb.creator = "SCMS Admin";
      const ws = wb.addWorksheet("Candidates");
      ws.columns = headers.map((h) => ({ header: h, key: h, width: 20 }));
      // Style header row
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      for (const r of rows) {
        const pdfLink = r.pdfPath ? `${baseUrl}/api/candidates/${r.id}/pdf` : "";
        ws.addRow([
          r.candidateIdCode ?? "", r.name ?? "", r.phone ?? "", r.parentMobile ?? "", r.email ?? "",
          r.fatherName ?? "", r.motherName ?? "", r.dob ?? "", r.gender ?? "", r.maritalStatus ?? "",
          r.religion ?? "", r.caste ?? "", r.pwd ?? "", r.address ?? "", r.village ?? "",
          r.policeStation ?? "", r.postOffice ?? "", r.district ?? "", r.state ?? "", r.pin ?? "",
          r.course ?? "", r.skillCentreName ?? "", r.aadhaarNumber ?? "", r.bpl ?? "", r.bplNumber ?? "",
          r.education ?? "", r.yearOfPassing ?? "", r.bankName ?? "", r.bankAccount ?? "",
          r.ifsc ?? "", r.bankBranch ?? "", r.mobilizer ?? "", r.status ?? "",
          r.verifiedBy ?? "", r.verifiedAt?.toISOString().slice(0, 10) ?? "", r.verificationRemarks ?? "",
          r.submittedBy ?? "", r.createdAt?.toISOString().slice(0, 10) ?? "", pdfLink,
        ]);
      }
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="candidates${centerLabel}_${dateStr}.xlsx"`);
      await wb.xlsx.write(res);
      res.end();
      return;
    }

    // ── CSV format (default) ───────────────────────────────────────────────────
    const lines = [headers.join(",")];
    for (const r of rows) {
      const pdfLink = r.pdfPath ? `${baseUrl}/api/candidates/${r.id}/pdf` : "";
      lines.push([
        r.candidateIdCode, r.name, r.phone, r.parentMobile, r.email, r.fatherName, r.motherName,
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
    res.setHeader("Content-Disposition", `attachment; filename="candidates${centerLabel}_${dateStr}.csv"`);
    res.send(lines.join("\r\n"));
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/candidates/:id/status ──────────────────────────────────

router.patch("/admin/candidates/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const id = req.params.id as string;
    if (!id?.trim()) {
      res.status(400).json({ title: "id is required", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
      return;
    }
    const { status, remarks, verifiedBy, verifiedByPhone } = req.body as {
      status?: string;
      remarks?: string;
      verifiedBy?: string;
      verifiedByPhone?: string;
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

    // Company scope guard — admin must belong to the same company as the candidate
    if (companyId && candidate.companyId && candidate.companyId !== companyId) {
      res.status(403).json({ title: "Forbidden", detail: "Candidate does not belong to your company", status: 403 });
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

    // Write audit log entry
    await db.insert(candidateAuditLogTable).values({
      companyId: candidate.companyId ?? null,
      candidateId: candidate.id,
      candidateName: candidate.name,
      actionBy: verifiedBy?.trim() || "admin",
      actionByPhone: verifiedByPhone?.trim() || null,
      oldStatus: candidate.status ?? null,
      newStatus: status,
      remarks: remarks?.trim() || null,
    });

    // Create in-app notification for the submitter.
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
        companyId: candidate.companyId ?? null,
        staffPhone: candidate.submittedByPhone,
        candidateId: candidate.id,
        candidateName: candidate.name,
        message,
      });

      // Fire-and-forget push + SMS to the mobilizer
      void (async () => {
        try {
          if (candidate.submittedByPhone) {
            const [mobilizer] = await db
              .select({ expoPushToken: staffTable.expoPushToken })
              .from(staffTable)
              .where(eq(staffTable.phone, candidate.submittedByPhone))
              .limit(1);
            if (mobilizer?.expoPushToken) {
              await sendPushSilent(
                [mobilizer.expoPushToken],
                `Candidate ${statusLabel}`,
                message,
                { type: "candidate_status", candidateId: candidate.id, status },
                req.log.warn.bind(req.log),
              );
            }
            if (status !== "pending") {
              const smsBody = `Nistha Skill: ${message}`.slice(0, 320);
              await sendSmsSilent(
                candidate.submittedByPhone,
                smsBody,
                req.log.warn.bind(req.log),
              );
            }
          }
        } catch {
          /* push/sms failure must not affect response */
        }
      })();
    }

    res.json(toDto(updated));
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/candidates/bulk-status ──────────────────────────────────
// Bulk update status for multiple candidates at once.

router.patch("/admin/candidates/bulk-status", requireAdmin, async (req, res, next) => {
  try {
    const companyId = res.locals.companyId as string | null;
    const { ids, status, remarks, verifiedBy, verifiedByPhone } = req.body as {
      ids?: unknown;
      status?: string;
      remarks?: string;
      verifiedBy?: string;
      verifiedByPhone?: string;
    };

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ title: "ids must be a non-empty array", status: 400 });
      return;
    }
    if (ids.length > 200) {
      res.status(400).json({ title: "Cannot update more than 200 candidates at once", status: 400 });
      return;
    }
    const validStatuses = ["pending", "verified", "rejected", "enrolled"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ title: `status must be one of: ${validStatuses.join(", ")}`, status: 400 });
      return;
    }

    const cleanIds: string[] = [];
    for (const id of ids) {
      if (typeof id !== "string" || !isValidUUID(id)) {
        res.status(400).json({ title: `Invalid UUID in ids: ${id}`, status: 400 });
        return;
      }
      cleanIds.push(id);
    }

    // Fetch candidates to validate company scope
    const existing = await db
      .select({ id: candidatesTable.id, companyId: candidatesTable.companyId, name: candidatesTable.name, status: candidatesTable.status, submittedByPhone: candidatesTable.submittedByPhone })
      .from(candidatesTable)
      .where(inArray(candidatesTable.id, cleanIds));

    const forbidden = companyId ? existing.filter((c) => c.companyId && c.companyId !== companyId) : [];
    if (forbidden.length > 0) {
      res.status(403).json({ title: "Some candidates do not belong to your company", status: 403 });
      return;
    }

    const now = new Date();
    const actionBy = verifiedBy?.trim() || "admin";

    // Bulk update
    await db
      .update(candidatesTable)
      .set({ status, verifiedBy: actionBy, verifiedAt: now, verificationRemarks: remarks?.trim() || null })
      .where(inArray(candidatesTable.id, cleanIds));

    // Write audit logs for each candidate
    if (existing.length > 0) {
      await db.insert(candidateAuditLogTable).values(
        existing.map((c) => ({
          companyId: c.companyId ?? null,
          candidateId: c.id,
          candidateName: c.name,
          actionBy,
          actionByPhone: verifiedByPhone?.trim() || null,
          oldStatus: c.status ?? null,
          newStatus: status,
          remarks: remarks?.trim() || null,
        })),
      );
    }

    // Fire-and-forget push + SMS notifications (non-blocking)
    void (async () => {
      try {
        const statusLabel =
          status === "verified" ? "approved ✓"
          : status === "rejected" ? "rejected ✗"
          : status === "enrolled" ? "enrolled 🎓"
          : status;

        for (const candidate of existing) {
          if (!candidate.submittedByPhone) continue;
          const message = `Your candidate ${candidate.name} has been ${statusLabel}.${remarks ? ` Remark: ${remarks}` : ""}`;
          await db.insert(candidateNotificationsTable).values({
            companyId: candidate.companyId ?? null,
            staffPhone: candidate.submittedByPhone,
            candidateId: candidate.id,
            candidateName: candidate.name,
            message,
          }).catch(() => {});

          const [mobilizer] = await db
            .select({ expoPushToken: staffTable.expoPushToken })
            .from(staffTable)
            .where(eq(staffTable.phone, candidate.submittedByPhone))
            .limit(1);
          if (mobilizer?.expoPushToken) {
            await sendPushSilent(
              [mobilizer.expoPushToken],
              `Candidate ${statusLabel}`,
              message,
              { type: "candidate_status", candidateId: candidate.id, status },
              () => {},
            ).catch(() => {});
          }
          if (status !== "pending") {
            await sendSmsSilent(
              candidate.submittedByPhone,
              `Nistha Skill: ${message}`.slice(0, 320),
              () => {},
            ).catch(() => {});
          }
        }
      } catch { /* non-fatal */ }
    })();

    res.json({ updated: existing.length, status });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/candidates/:id ──────────────────────────────────────────────────

router.get("/candidates/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id?.trim()) {
      res.status(400).json({ title: "id is required", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
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
    res.json(toDto(candidate));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/candidates/:id/pdf ──────────────────────────────────────────────

router.get("/candidates/:id/pdf", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id?.trim()) {
      res.status(400).json({ title: "id is required", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
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

    const pdfFilePath = path.join(CANDIDATES_DIR, candidate.id, "profile.pdf");
    const resolvedCompanyId = await resolveCompanyIdForBranding(candidate.companyId, candidate.submittedByPhone);
    const branding = await fetchCompanyBranding(resolvedCompanyId);
    const pdfOpts = buildPdfOpts(candidate, req.query as Record<string, string>, branding);
    // Always regenerate PDF to ensure latest data is reflected
    fs.mkdirSync(path.dirname(pdfFilePath), { recursive: true });
    try {
      await generateCandidatePdf(candidate, pdfFilePath, pdfOpts);
    } catch (pdfErr) {
      next(pdfErr);
      return;
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
    if (!id?.trim()) {
      res.status(400).json({ title: "id is required", status: 400 });
      return;
    }
    if (!isValidUUID(id)) {
      res.status(400).json({ title: "id must be a valid UUID", status: 400 });
      return;
    }
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
