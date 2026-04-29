import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import type { Candidate } from "@workspace/db";

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 40;
const PHOTO_W = 90;
const PHOTO_H = 110;

function safeImage(
  doc: InstanceType<typeof PDFDocument>,
  filePath: string | null | undefined,
  x: number,
  y: number,
  options: Record<string, unknown>,
) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    doc.image(filePath, x, y, options);
    return true;
  } catch {
    return false;
  }
}

function drawHr(doc: InstanceType<typeof PDFDocument>, y: number) {
  doc
    .moveTo(MARGIN, y)
    .lineTo(A4_W - MARGIN, y)
    .strokeColor("#E5E7EB")
    .lineWidth(0.5)
    .stroke();
}

function labelValue(
  doc: InstanceType<typeof PDFDocument>,
  label: string,
  value: string | null | undefined,
  x: number,
  y: number,
  labelW = 140,
  valueW = 180,
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#6B7280")
    .text(label.toUpperCase(), x, y, { width: labelW, lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#111827")
    .text(value || "—", x + labelW, y, { width: valueW, lineBreak: false });
}

export async function generateCandidatePdf(
  candidate: Candidate,
  pdfPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
    const writeStream = fs.createWriteStream(pdfPath);

    doc.pipe(writeStream);
    writeStream.on("error", reject);
    writeStream.on("finish", resolve);

    // ─── Page 1: Candidate profile ──────────────────────────────────────────────

    // Header bar
    doc.rect(0, 0, A4_W, 54).fill("#1E3A5F");
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#FFFFFF")
      .text("CANDIDATE PROFILE", MARGIN, 16, { align: "left" });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("rgba(255,255,255,0.75)")
      .text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, A4_W - MARGIN - 130, 20, {
        width: 130,
        align: "right",
      });

    // Candidate photo box
    const photoX = A4_W - MARGIN - PHOTO_W;
    const photoY = 68;
    doc
      .rect(photoX, photoY, PHOTO_W, PHOTO_H)
      .strokeColor("#D1D5DB")
      .lineWidth(1)
      .stroke();
    const photoOk = safeImage(doc, candidate.photoPath, photoX, photoY, {
      width: PHOTO_W,
      height: PHOTO_H,
      cover: [PHOTO_W, PHOTO_H],
    });
    if (!photoOk) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#9CA3AF")
        .text("No Photo", photoX, photoY + PHOTO_H / 2 - 8, { width: PHOTO_W, align: "center" });
    }

    // Candidate name & ID
    let y = 70;
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#111827")
      .text(candidate.name, MARGIN, y, { width: photoX - MARGIN - 10 });
    y += 22;
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#374151")
      .text(`📞 ${candidate.phone}`, MARGIN, y);
    if (candidate.area) {
      y += 15;
      doc.text(`📍 ${candidate.area}`, MARGIN, y);
    }
    y += 28;
    drawHr(doc, y);
    y += 12;

    // Section: Personal Details
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#1E3A5F")
      .text("PERSONAL DETAILS", MARGIN, y);
    y += 16;

    const col1X = MARGIN;
    const col2X = MARGIN + 170 + 20;
    const colMaxRight = photoX - MARGIN - 10;

    const personal: Array<[string, string | null | undefined]> = [
      ["Father's Name", candidate.fatherName],
      ["Date of Birth", candidate.dob],
      ["Gender", candidate.gender],
      ["Aadhaar No.", candidate.aadhaarNumber],
      ["Address", candidate.address],
    ];
    for (let i = 0; i < personal.length; i += 2) {
      labelValue(doc, personal[i][0], personal[i][1], col1X, y, 90, 165);
      if (personal[i + 1]) {
        labelValue(doc, personal[i + 1]![0], personal[i + 1]![1], col2X, y, 90, colMaxRight - col2X - 90);
      }
      y += 18;
    }
    y += 4;
    drawHr(doc, y);
    y += 12;

    // Section: Education & Caste
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1E3A5F").text("EDUCATION & CATEGORY", MARGIN, y);
    y += 16;

    const edu: Array<[string, string | null | undefined]> = [
      ["Education", candidate.education],
      ["Caste Category", candidate.caste],
    ];
    for (let i = 0; i < edu.length; i += 2) {
      labelValue(doc, edu[i][0], edu[i][1], col1X, y, 90, 165);
      if (edu[i + 1]) {
        labelValue(doc, edu[i + 1]![0], edu[i + 1]![1], col2X, y, 90, colMaxRight - col2X - 90);
      }
      y += 18;
    }
    y += 4;
    drawHr(doc, y);
    y += 12;

    // Section: Bank Details
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1E3A5F").text("BANK DETAILS", MARGIN, y);
    y += 16;
    const bank: Array<[string, string | null | undefined]> = [
      ["Bank Name", candidate.bankName],
      ["Account No.", candidate.bankAccount],
      ["IFSC Code", candidate.ifsc],
    ];
    for (let i = 0; i < bank.length; i += 2) {
      labelValue(doc, bank[i][0], bank[i][1], col1X, y, 90, 165);
      if (bank[i + 1]) {
        labelValue(doc, bank[i + 1]![0], bank[i + 1]![1], col2X, y, 90, colMaxRight - col2X - 90);
      }
      y += 18;
    }
    y += 4;
    drawHr(doc, y);
    y += 12;

    // Document checklist on bottom of page 1
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1E3A5F").text("DOCUMENTS ATTACHED", MARGIN, y);
    y += 16;
    const docs: Array<[string, string | null | undefined]> = [
      ["Aadhaar Front", candidate.aadhaarFrontPath],
      ["Aadhaar Back", candidate.aadhaarBackPath],
      ["Education Certificate", candidate.educationCertPath],
      ["Bank Passbook", candidate.bankPassbookPath],
      ["Caste Certificate", candidate.casteCertPath],
    ];
    for (const [label, p] of docs) {
      const present = p && fs.existsSync(p);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(present ? "#059669" : "#9CA3AF")
        .text(`${present ? "✓" : "✗"}  ${label}`, MARGIN + 4, y);
      y += 16;
    }

    // Submitted-by footer
    if (candidate.submittedBy) {
      y += 8;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#6B7280")
        .text(`Submitted by: ${candidate.submittedBy}`, MARGIN, y);
    }

    // ─── Pages 2+: Document images ─────────────────────────────────────────────

    const attachedDocs: Array<{ label: string; filePath: string | null | undefined }> = [
      { label: "Aadhaar Card – Front", filePath: candidate.aadhaarFrontPath },
      { label: "Aadhaar Card – Back", filePath: candidate.aadhaarBackPath },
      { label: "Education Certificate", filePath: candidate.educationCertPath },
      { label: "Bank Passbook", filePath: candidate.bankPassbookPath },
      { label: "Caste Certificate", filePath: candidate.casteCertPath },
    ];

    for (const { label, filePath } of attachedDocs) {
      if (!filePath || !fs.existsSync(filePath)) continue;

      doc.addPage({ size: "A4", margin: 0 });

      // Label header
      doc.rect(0, 0, A4_W, 36).fill("#1E3A5F");
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#FFFFFF")
        .text(label, MARGIN, 11, { align: "left" });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("rgba(255,255,255,0.75)")
        .text(candidate.name, 0, 13, { width: A4_W - MARGIN, align: "right" });

      // Full-page document image
      const imgY = 44;
      const imgH = A4_H - imgY - 10;
      safeImage(doc, filePath, 0, imgY, {
        width: A4_W,
        height: imgH,
        fit: [A4_W, imgH],
        align: "center",
        valign: "center",
      });
    }

    doc.end();
  });
}
