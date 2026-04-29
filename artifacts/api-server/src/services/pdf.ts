import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import type { Candidate } from "@workspace/db";

// ─── Font paths ──────────────────────────────────────────────────────────────
// Noto Sans Devanagari supports full Latin + Devanagari Unicode with proper shaping.
// __dirname is overridden by esbuild banner to point to dist/ (the output dir),
// so fonts live at dist/fonts/ which is one level down from __dirname.
const FONTS_DIR = path.resolve(__dirname, "fonts");
const FONT_REGULAR = path.join(FONTS_DIR, "NotoSansDevanagari-Regular.ttf");
const FONT_BOLD = path.join(FONTS_DIR, "NotoSansDevanagari-Bold.ttf");

const A4_W = 595.28;
const A4_H = 841.89;
const M = 28; // margin

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeImage(
  doc: InstanceType<typeof PDFDocument>,
  filePath: string | null | undefined,
  x: number,
  y: number,
  options: Record<string, unknown>,
): boolean {
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    doc.image(filePath, x, y, options);
    return true;
  } catch {
    return false;
  }
}

function hLine(
  doc: InstanceType<typeof PDFDocument>,
  x1: number,
  y: number,
  x2: number,
  lw = 0.7,
) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor("#111").lineWidth(lw).stroke();
}

function vLine(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y1: number,
  y2: number,
  lw = 0.7,
) {
  doc.moveTo(x, y1).lineTo(x, y2).strokeColor("#111").lineWidth(lw).stroke();
}

function box(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  lw = 0.7,
) {
  doc.rect(x, y, w, h).strokeColor("#111").lineWidth(lw).stroke();
}

function filled(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  doc.rect(x, y, w, h).fill(color);
}

// Render text. Uses Noto Sans Devanagari (supports both Latin and Hindi).
function label(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  x: number,
  y: number,
  opts: {
    width?: number;
    fontSize?: number;
    bold?: boolean;
    align?: "left" | "center" | "right";
    color?: string;
    lineBreak?: boolean;
  } = {},
) {
  doc
    .font(opts.bold ? "NSB" : "NSR")
    .fontSize(opts.fontSize ?? 8)
    .fillColor(opts.color ?? "#111827")
    .text(text, x, y, {
      width: opts.width,
      align: opts.align ?? "left",
      lineBreak: opts.lineBreak ?? false,
    });
}

// A field row: box + small bilingual label (top-left) + value text
function fieldRow(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  fieldLabel: string,
  value: string | null | undefined,
  labelW = 120,
) {
  box(doc, x, y, w, h);
  const innerY = y + 2.5;
  doc
    .font("NSR")
    .fontSize(6)
    .fillColor("#555")
    .text(fieldLabel, x + 3, innerY, { width: labelW - 4, lineBreak: false });
  if (value?.trim()) {
    doc
      .font("NSB")
      .fontSize(8)
      .fillColor("#111")
      .text(value.trim(), x + labelW, y + (h / 2 - 4), {
        width: w - labelW - 4,
        lineBreak: false,
      });
  }
}

function circle(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  r: number,
  isFilled: boolean,
) {
  if (isFilled) {
    doc.circle(x, y, r).fill("#1E3A5F");
  } else {
    doc.circle(x, y, r).strokeColor("#555").lineWidth(0.5).stroke();
  }
}

function radioRow(
  doc: InstanceType<typeof PDFDocument>,
  fieldLabel: string,
  options: string[],
  value: string | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  box(doc, x, y, w, h);
  doc
    .font("NSR")
    .fontSize(6)
    .fillColor("#555")
    .text(fieldLabel, x + 3, y + 2.5, { lineBreak: false });

  let cx = x + 3;
  const cy = y + h / 2 + 1;
  for (const opt of options) {
    const selected = value?.toLowerCase() === opt.toLowerCase() || value === opt;
    circle(doc, cx + 3.5, cy, 3.5, selected);
    doc
      .font(selected ? "NSB" : "NSR")
      .fontSize(7)
      .fillColor(selected ? "#1E3A5F" : "#333")
      .text(opt, cx + 9, cy - 3.5, { lineBreak: false });
    cx += 9 + opt.length * 4.8 + 4;
  }
}

// 12 individual digit boxes for Aadhaar
function aadhaarBoxes(
  doc: InstanceType<typeof PDFDocument>,
  aadhaar: string | null | undefined,
  x: number,
  y: number,
) {
  const boxSize = 16;
  const gap = 2;
  const digits = (aadhaar ?? "").replace(/\D/g, "").padEnd(12, "").split("");
  for (let i = 0; i < 12; i++) {
    // Extra gap between groups of 4
    const bx = x + i * (boxSize + gap) + Math.floor(i / 4) * 5;
    box(doc, bx, y, boxSize, boxSize);
    if (digits[i]) {
      doc
        .font("NSB")
        .fontSize(9)
        .fillColor("#111")
        .text(digits[i]!, bx, y + 3.5, { width: boxSize, align: "center", lineBreak: false });
    }
  }
}

// Dark navy section band
function sectionBand(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  x: number,
  y: number,
  w: number,
  h = 14,
) {
  filled(doc, x, y, w, h, "#1E3A5F");
  doc
    .font("NSB")
    .fontSize(7.5)
    .fillColor("#FFFFFF")
    .text(text, x + 6, y + 3, { width: w - 12, align: "left", lineBreak: false });
  return y + h;
}

function checkBox(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  checked: boolean,
  lbl: string,
) {
  box(doc, x, y, 9, 9, 0.7);
  if (checked) {
    doc.font("NSB").fontSize(8).fillColor("#059669").text("✓", x + 1, y + 0.5, { lineBreak: false });
  }
  doc.font("NSR").fontSize(7).fillColor("#111").text(lbl, x + 12, y + 1, { lineBreak: false });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateCandidatePdf(
  rawCandidate: Candidate,
  pdfPath: string,
): Promise<void> {
  // Cast to extended type so TS doesn't complain about newer columns
  const candidate = rawCandidate as Candidate & {
    maritalStatus?: string | null;
    religion?: string | null;
    pwd?: string | null;
    disabilityType?: string | null;
    email?: string | null;
    policeStation?: string | null;
    postOffice?: string | null;
    district?: string | null;
    state?: string | null;
    pin?: string | null;
    bpl?: string | null;
    bplNumber?: string | null;
    yearOfPassing?: string | null;
    bankBranch?: string | null;
    skillCentreName?: string | null;
    mobilizer?: string | null;
    candidateIdCode?: string | null;
    signaturePath?: string | null;
    motherName?: string | null;
  };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });

    // Register Noto Sans Devanagari – handles both Latin and Devanagari Unicode
    doc.registerFont("NSR", FONT_REGULAR);
    doc.registerFont("NSB", FONT_BOLD);

    const ws = fs.createWriteStream(pdfPath);
    doc.pipe(ws);
    ws.on("error", reject);
    ws.on("finish", resolve);

    const COL_W = A4_W - M * 2; // 539.28 pt usable width

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 1 — Registration Form
    // ═══════════════════════════════════════════════════════════════════════════

    // Outer page border (1.5pt black)
    box(doc, M, M, COL_W, A4_H - M * 2, 1.5);

    // ── HEADER ────────────────────────────────────────────────────────────────

    const HY = M;
    const PHOTO_W = 72;
    const PHOTO_H = 90;
    const photoX = M + COL_W - PHOTO_W - 6;
    const photoY = HY + 5;

    // Photo box with label
    box(doc, photoX, photoY, PHOTO_W, PHOTO_H, 1);
    const photoOk = safeImage(doc, candidate.photoPath, photoX, photoY, {
      width: PHOTO_W,
      height: PHOTO_H,
      cover: [PHOTO_W, PHOTO_H],
    });
    if (!photoOk) {
      doc.font("NSR").fontSize(6.5).fillColor("#9CA3AF")
        .text("Paste Passport", photoX, photoY + 26, { width: PHOTO_W, align: "center", lineBreak: false });
      doc.font("NSR").fontSize(6.5).fillColor("#9CA3AF")
        .text("Size Photo", photoX, photoY + 36, { width: PHOTO_W, align: "center", lineBreak: false });
      doc.font("NSR").fontSize(6).fillColor("#BBBBBB")
        .text("(पासपोर्ट साइज)", photoX, photoY + 46, { width: PHOTO_W, align: "center", lineBreak: false });
    }
    doc.font("NSR").fontSize(5.5).fillColor("#555")
      .text("3.5 × 4.5 cm", photoX, photoY + PHOTO_H + 2, { width: PHOTO_W, align: "center", lineBreak: false });

    // Header text (left of photo)
    const textX = M + 5;
    const textW = photoX - textX - 8;

    doc.font("NSB").fontSize(8.5).fillColor("#1E3A5F")
      .text("JHARKHAND SKILL DEVELOPMENT MISSION SOCIETY (JSDMS)", textX, HY + 6, { width: textW, lineBreak: false });
    doc.font("NSR").fontSize(7.5).fillColor("#1E3A5F")
      .text("झारखंड कौशल विकास मिशन सोसाइटी", textX, HY + 17, { width: textW, lineBreak: false });
    doc.font("NSB").fontSize(7.5).fillColor("#1E3A5F")
      .text("Deen Dayal Upadhyay Grameen Kaushalya Yojana (DDU-GKY)", textX, HY + 28, { width: textW, lineBreak: false });
    doc.font("NSR").fontSize(7).fillColor("#1E3A5F")
      .text("दीन दयाल उपाध्याय ग्रामीण कौशल्या योजना", textX, HY + 38, { width: textW, lineBreak: false });

    hLine(doc, M, HY + 50, M + COL_W, 0.8);

    // Form title centred
    doc.font("NSB").fontSize(10).fillColor("#111")
      .text("CANDIDATE REGISTRATION FORM  /  अभ्यर्थी पंजीकरण फॉर्म",
        textX, HY + 54, { width: textW, align: "center", lineBreak: false });

    hLine(doc, M, HY + 66, M + COL_W, 0.8);

    // Training Centre + Skill Centre row
    const tcY = HY + 70;
    doc.font("NSR").fontSize(6.5).fillColor("#555")
      .text("Training Centre ID / प्रशिक्षण केंद्र आईडी:", M + 3, tcY, { lineBreak: false });
    hLine(doc, M + 130, tcY + 8, M + COL_W / 2 - 5, 0.4);

    const scLabelX = M + COL_W / 2 + 3;
    doc.font("NSR").fontSize(6.5).fillColor("#555")
      .text("Skill Centre / कौशल केंद्र:", scLabelX, tcY, { lineBreak: false });
    if (candidate.skillCentreName) {
      doc.font("NSB").fontSize(7).fillColor("#111")
        .text(candidate.skillCentreName, scLabelX + 95, tcY, { width: COL_W / 2 - 100, lineBreak: false });
    } else {
      hLine(doc, scLabelX + 95, tcY + 8, M + COL_W - 3, 0.4);
    }

    hLine(doc, M, tcY + 14, M + COL_W, 0.8);

    // ── COURSE + CANDIDATE ID ──────────────────────────────────────────────────

    let y = tcY + 28;
    const rowH = 18;
    const fullW = COL_W;
    const halfW = COL_W / 2;

    const courseW = COL_W * 0.62;
    box(doc, M, y, courseW, rowH);
    doc.font("NSR").fontSize(6).fillColor("#555")
      .text("Course Name / कोर्स का नाम:", M + 3, y + 3, { lineBreak: false });
    if (candidate.course) {
      doc.font("NSB").fontSize(8).fillColor("#111")
        .text(candidate.course, M + 105, y + 5, { width: courseW - 110, lineBreak: false });
    }

    const cidX = M + courseW;
    const cidW = COL_W - courseW;
    box(doc, cidX, y, cidW, rowH);
    doc.font("NSR").fontSize(6).fillColor("#555")
      .text("Candidate ID:", cidX + 3, y + 3, { lineBreak: false });
    if (candidate.candidateIdCode) {
      doc.font("NSB").fontSize(8).fillColor("#111")
        .text(candidate.candidateIdCode, cidX + 62, y + 5, { width: cidW - 66, lineBreak: false });
    }
    y += rowH;

    // ── A. PERSONAL DETAILS ────────────────────────────────────────────────────

    y = sectionBand(doc, "A.  PERSONAL DETAILS  /  व्यक्तिगत विवरण", M, y, COL_W);

    // Candidate name — Hindi (blank line for handwriting)
    box(doc, M, y, fullW, rowH);
    doc.font("NSR").fontSize(6).fillColor("#555")
      .text("Name in Hindi / हिंदी में नाम:", M + 3, y + 3, { lineBreak: false });
    hLine(doc, M + 120, y + rowH - 4, M + fullW - 3, 0.4);
    y += rowH;

    // Candidate name — English (filled from data)
    box(doc, M, y, fullW, rowH);
    doc.font("NSR").fontSize(6).fillColor("#555")
      .text("Name in English / अंग्रेजी में नाम:", M + 3, y + 3, { lineBreak: false });
    if (candidate.name) {
      doc.font("NSB").fontSize(9).fillColor("#111")
        .text(candidate.name.toUpperCase(), M + 125, y + 4.5, { width: fullW - 130, lineBreak: false });
    }
    y += rowH;

    // Father + Mother
    fieldRow(doc, M, y, halfW, rowH, "Father/Husband / पिता/पति का नाम:", candidate.fatherName, 130);
    fieldRow(doc, M + halfW, y, halfW, rowH, "Mother's Name / माता का नाम:", candidate.motherName, 120);
    y += rowH;

    // Marital + Gender
    radioRow(doc, "Marital Status / वैवाहिक स्थिति:", ["Single", "Married", "Divorced"], candidate.maritalStatus, M, y, halfW, rowH);
    radioRow(doc, "Sex / लिंग:", ["Male", "Female", "Other"], candidate.gender, M + halfW, y, halfW, rowH);
    y += rowH;

    // DOB + Religion
    fieldRow(doc, M, y, halfW, rowH, "Date of Birth / जन्म तिथि (DD/MM/YYYY):", candidate.dob, 148);
    fieldRow(doc, M + halfW, y, halfW, rowH, "Religion / धर्म:", candidate.religion, 80);
    y += rowH;

    // Category + PwD
    radioRow(doc, "Category / वर्ग:", ["General", "OBC", "SC", "ST"], candidate.caste, M, y, halfW, rowH);
    radioRow(doc, "PwD / दिव्यांग:", ["Yes", "No"], candidate.pwd, M + halfW, y, halfW, rowH);
    y += rowH;

    // Disability type
    fieldRow(doc, M, y, fullW, rowH, "Disability Type / दिव्यांगता का प्रकार (यदि PwD = Yes):", candidate.disabilityType, 172);
    y += rowH;

    // Mobile + Email
    fieldRow(doc, M, y, halfW, rowH, "Mobile No. / मोबाइल नं.:", candidate.phone, 100);
    fieldRow(doc, M + halfW, y, halfW, rowH, "Email / ईमेल:", candidate.email, 75);
    y += rowH;

    // ── B. ADDRESS ────────────────────────────────────────────────────────────

    y = sectionBand(doc, "B.  ADDRESS  /  पता", M, y, COL_W);

    fieldRow(doc, M, y, fullW, rowH, "Full Address / पूरा पता (घर नं., मोहल्ला, वार्ड):", candidate.address, 178);
    y += rowH;

    fieldRow(doc, M, y, halfW, rowH, "Village / Town / ग्राम / नगर:", candidate.village, 112);
    fieldRow(doc, M + halfW, y, halfW, rowH, "Police Station / थाना:", candidate.policeStation, 100);
    y += rowH;

    fieldRow(doc, M, y, halfW, rowH, "Post Office / डाकघर:", candidate.postOffice, 100);
    fieldRow(doc, M + halfW, y, halfW, rowH, "District / जिला:", candidate.district, 75);
    y += rowH;

    const thirdW = COL_W * 0.55;
    fieldRow(doc, M, y, thirdW, rowH, "State / राज्य:", candidate.state ?? "Jharkhand", 75);
    fieldRow(doc, M + thirdW, y, COL_W - thirdW, rowH, "PIN Code / पिन कोड:", candidate.pin, 80);
    y += rowH;

    // ── C. AADHAAR ────────────────────────────────────────────────────────────

    y = sectionBand(doc, "C.  AADHAAR NUMBER  /  आधार नंबर", M, y, COL_W);

    const aadhaarRowH = 26;
    box(doc, M, y, fullW, aadhaarRowH);
    doc.font("NSR").fontSize(6).fillColor("#555")
      .text("Aadhaar No. / आधार नं.:", M + 3, y + 4, { lineBreak: false });
    aadhaarBoxes(doc, candidate.aadhaarNumber, M + 100, y + 4);
    y += aadhaarRowH;

    const bplH = 18;
    radioRow(doc, "BPL / गरीबी रेखा से नीचे:", ["Yes", "No"], candidate.bpl, M, y, halfW, bplH);
    fieldRow(doc, M + halfW, y, halfW, bplH, "BPL Card No. / बीपीएल कार्ड नं.:", candidate.bplNumber, 115);
    y += bplH;

    // ── D. EDUCATION ──────────────────────────────────────────────────────────

    y = sectionBand(doc, "D.  EDUCATIONAL DETAILS  /  शैक्षणिक विवरण", M, y, COL_W);

    fieldRow(doc, M, y, thirdW, rowH, "Highest Qualification / उच्चतम योग्यता:", candidate.education, 142);
    fieldRow(doc, M + thirdW, y, COL_W - thirdW, rowH, "Year of Passing / उत्तीर्ण वर्ष:", candidate.yearOfPassing, 112);
    y += rowH;

    // ── E. BANK DETAILS ───────────────────────────────────────────────────────

    y = sectionBand(doc, "E.  BANK DETAILS  /  बैंक विवरण", M, y, COL_W);

    fieldRow(doc, M, y, halfW, rowH, "Bank Account No. / बैंक खाता नं.:", candidate.bankAccount, 130);
    fieldRow(doc, M + halfW, y, halfW, rowH, "Bank Name / बैंक का नाम:", candidate.bankName, 90);
    y += rowH;

    fieldRow(doc, M, y, halfW, rowH, "IFSC Code / आईएफएससी:", candidate.ifsc, 100);
    fieldRow(doc, M + halfW, y, halfW, rowH, "Branch / शाखा:", candidate.bankBranch, 85);
    y += rowH;

    // ── F. DOCUMENTS ──────────────────────────────────────────────────────────

    y = sectionBand(doc, "F.  DOCUMENTS ATTACHED  /  संलग्न दस्तावेज", M, y, COL_W);

    const docList = [
      { label: "Birth Certificate / जन्म प्रमाण पत्र", path: null },
      { label: "Caste Certificate / जाति प्रमाण पत्र", path: candidate.casteCertPath },
      { label: "Aadhaar Card / आधार कार्ड", path: candidate.aadhaarFrontPath },
      { label: "Education Certificate / शैक्षणिक प्रमाण पत्र", path: candidate.educationCertPath },
      { label: "Bank Passbook / बैंक पासबुक", path: candidate.bankPassbookPath },
      { label: "Passport Photo / पासपोर्ट साइज फोटो", path: candidate.photoPath },
    ];

    const docColW = COL_W / 2;
    let docIdx = 0;
    const docStartY = y;
    for (let di = 0; di < docList.length; di += 2) {
      const dY = docStartY + 4 + docIdx * 13;
      const checked1 = !!(docList[di]?.path && fs.existsSync(docList[di]!.path!));
      checkBox(doc, M + 5, dY, checked1, docList[di]?.label ?? "");
      if (docList[di + 1]) {
        const checked2 = !!(docList[di + 1]?.path && fs.existsSync(docList[di + 1]!.path!));
        checkBox(doc, M + docColW + 5, dY, checked2, docList[di + 1]?.label ?? "");
      }
      docIdx++;
    }
    y = docStartY + 4 + Math.ceil(docList.length / 2) * 13 + 6;

    // ── G. DECLARATION ────────────────────────────────────────────────────────

    y = sectionBand(doc, "G.  DECLARATION  /  घोषणा", M, y, COL_W);

    const declH = 32;
    box(doc, M, y, COL_W, declH);
    doc.font("NSR").fontSize(6.5).fillColor("#333")
      .text(
        "I hereby declare that the information given above is true and correct to the best of my knowledge and belief.",
        M + 4, y + 4,
        { width: COL_W - 8, lineBreak: false },
      );
    doc.font("NSR").fontSize(6.5).fillColor("#333")
      .text(
        "मैं घोषणा करता/करती हूँ कि उपरोक्त जानकारी मेरी जानकारी एवं विश्वास के अनुसार सत्य और सही है।",
        M + 4, y + 14,
        { width: COL_W - 8, lineBreak: false },
      );
    y += declH;

    // Place / Date / Signature row
    const sigH = 40;
    box(doc, M, y, COL_W, sigH);
    const third = COL_W / 3;

    vLine(doc, M + third, y, y + sigH, 0.5);
    vLine(doc, M + third * 2, y, y + sigH, 0.5);

    // Place
    doc.font("NSR").fontSize(6).fillColor("#555")
      .text("Place / स्थान:", M + 3, y + 4, { lineBreak: false });
    if (candidate.area) {
      doc.font("NSB").fontSize(8).fillColor("#111")
        .text(candidate.area, M + 56, y + 4, { width: third - 60, lineBreak: false });
    } else {
      hLine(doc, M + 56, y + sigH - 5, M + third - 4, 0.4);
    }

    // Date
    doc.font("NSR").fontSize(6).fillColor("#555")
      .text("Date / दिनांक:", M + third + 3, y + 4, { lineBreak: false });
    const dateVal = candidate.createdAt?.toLocaleDateString("en-IN") ?? "";
    if (dateVal) {
      doc.font("NSR").fontSize(8).fillColor("#111")
        .text(dateVal, M + third + 56, y + 4, { lineBreak: false });
    } else {
      hLine(doc, M + third + 56, y + sigH - 5, M + third * 2 - 4, 0.4);
    }

    // Signature
    doc.font("NSR").fontSize(6).fillColor("#555")
      .text("Signature / अभ्यर्थी के हस्ताक्षर:", M + third * 2 + 3, y + 4, { lineBreak: false });
    const sigDrawn = safeImage(doc, candidate.signaturePath, M + third * 2 + 3, y + 14, {
      width: third - 6,
      height: 20,
      fit: [third - 6, 20],
    });
    if (!sigDrawn) {
      hLine(doc, M + third * 2 + 10, y + sigH - 5, M + COL_W - 10, 0.5);
    }
    y += sigH;

    // Mobilizer row
    const mobH = 18;
    box(doc, M, y, COL_W, mobH);
    doc.font("NSR").fontSize(6).fillColor("#555")
      .text("Mobilizer / मोबिलाइज़र का नाम:", M + 3, y + 4, { lineBreak: false });
    const mobName = candidate.mobilizer ?? candidate.submittedBy;
    if (mobName) {
      doc.font("NSB").fontSize(8).fillColor("#111")
        .text(mobName, M + 130, y + 5, { width: COL_W - 135, lineBreak: false });
    } else {
      hLine(doc, M + 130, y + mobH - 5, M + COL_W - 4, 0.4);
    }
    y += mobH;

    // Footer metadata line
    y += 5;
    doc.font("NSR").fontSize(5.5).fillColor("#888")
      .text(
        `ID: ${candidate.id}  |  Registered: ${candidate.createdAt?.toLocaleDateString("en-IN") ?? ""}  |  Status: ${(candidate.status ?? "").toUpperCase()}  |  JSDMS/DDU-GKY Jharkhand`,
        M, y, { width: COL_W, align: "center", lineBreak: false },
      );

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGES 2+: Attached document images
    // ═══════════════════════════════════════════════════════════════════════════

    const attachedDocs: Array<{ docLabel: string; filePath: string | null | undefined }> = [
      { docLabel: "Aadhaar Card – Front  /  आधार कार्ड (आगे)", filePath: candidate.aadhaarFrontPath },
      { docLabel: "Aadhaar Card – Back  /  आधार कार्ड (पीछे)", filePath: candidate.aadhaarBackPath },
      { docLabel: "Education Certificate  /  शैक्षणिक प्रमाण पत्र", filePath: candidate.educationCertPath },
      { docLabel: "Bank Passbook  /  बैंक पासबुक", filePath: candidate.bankPassbookPath },
      { docLabel: "Caste Certificate  /  जाति प्रमाण पत्र", filePath: candidate.casteCertPath },
    ];

    for (const { docLabel, filePath } of attachedDocs) {
      if (!filePath || !fs.existsSync(filePath)) continue;
      doc.addPage({ size: "A4", margin: 0 });

      // Dark header band
      doc.rect(0, 0, A4_W, 40).fill("#1E3A5F");
      doc.font("NSB").fontSize(11).fillColor("#FFFFFF")
        .text(docLabel, M, 10, { align: "left", lineBreak: false });
      doc.font("NSR").fontSize(8).fillColor("rgba(255,255,255,0.7)")
        .text(candidate.name, 0, 26, { width: A4_W - M, align: "right", lineBreak: false });

      const imgY = 48;
      const imgH = A4_H - imgY - 14;
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
