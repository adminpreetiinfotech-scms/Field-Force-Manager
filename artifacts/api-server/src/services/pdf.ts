import fs from "fs";
import PDFDocument from "pdfkit";
import type { Candidate } from "@workspace/db";

const A4_W = 595.28;
const A4_H = 841.89;
const M = 28; // margin
const COL_W = A4_W - M * 2; // usable width: 539.28

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
  } = {},
) {
  doc
    .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts.fontSize ?? 8)
    .fillColor(opts.color ?? "#111827")
    .text(text, x, y, {
      width: opts.width,
      align: opts.align ?? "left",
      lineBreak: false,
    });
}

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
  const innerX = x + 3;
  const innerY = y + 3;
  doc
    .font("Helvetica")
    .fontSize(6.5)
    .fillColor("#555")
    .text(fieldLabel, innerX, innerY, { width: labelW - 4, lineBreak: false });
  if (value) {
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor("#111")
      .text(value, x + labelW, y + (h / 2 - 4), {
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
  filled_: boolean,
) {
  if (filled_) {
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
    .font("Helvetica")
    .fontSize(6.5)
    .fillColor("#555")
    .text(fieldLabel, x + 3, y + 3, { lineBreak: false });

  let cx = x + 3;
  const cy = y + h / 2 + 1;
  for (const opt of options) {
    circle(doc, cx + 3, cy, 3, value === opt);
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor("#111")
      .text(opt, cx + 8, cy - 4, { lineBreak: false });
    cx += 8 + opt.length * 5 + 4;
  }
}

function aadhaarBoxes(
  doc: InstanceType<typeof PDFDocument>,
  aadhaar: string | null | undefined,
  x: number,
  y: number,
) {
  const boxSize = 17;
  const gap = 3;
  const digits = (aadhaar ?? "").replace(/\D/g, "").padEnd(12, "").split("");
  for (let i = 0; i < 12; i++) {
    const bx = x + i * (boxSize + gap) + Math.floor(i / 4) * 6;
    box(doc, bx, y, boxSize, boxSize);
    if (digits[i]) {
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#111")
        .text(digits[i]!, bx, y + 4, { width: boxSize, align: "center", lineBreak: false });
    }
  }
}

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
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .fillColor("#fff")
    .text(text, x + 5, y + 3, { width: w - 10, align: "left", lineBreak: false });
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
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#059669").text("✓", x + 1, y + 1, { lineBreak: false });
  }
  doc.font("Helvetica").fontSize(7).fillColor("#111").text(lbl, x + 12, y + 1, { lineBreak: false });
}

export async function generateCandidatePdf(
  candidate: Candidate,
  pdfPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
    const ws = fs.createWriteStream(pdfPath);
    doc.pipe(ws);
    ws.on("error", reject);
    ws.on("finish", resolve);

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 1 — Registration Form
    // ═══════════════════════════════════════════════════════════════════════════

    // Outer page border
    box(doc, M, M, COL_W, A4_H - M * 2, 1.5);

    // ── HEADER ────────────────────────────────────────────────────────────────

    const HY = M; // header top y
    const PHOTO_W = 72;
    const PHOTO_H = 90;
    const photoX = M + COL_W - PHOTO_W - 5;
    const photoY = HY + 5;

    // Photo box
    box(doc, photoX, photoY, PHOTO_W, PHOTO_H, 1);
    const photoOk = safeImage(doc, candidate.photoPath, photoX, photoY, {
      width: PHOTO_W,
      height: PHOTO_H,
      cover: [PHOTO_W, PHOTO_H],
    });
    if (!photoOk) {
      doc.font("Helvetica").fontSize(6.5).fillColor("#9CA3AF")
        .text("Paste Passport", photoX, photoY + 28, { width: PHOTO_W, align: "center", lineBreak: false });
      doc.font("Helvetica").fontSize(6.5).fillColor("#9CA3AF")
        .text("Size Photo", photoX, photoY + 38, { width: PHOTO_W, align: "center", lineBreak: false });
    }
    doc.font("Helvetica").fontSize(5.5).fillColor("#555")
      .text("3.5 × 4.5 cm", photoX, photoY + PHOTO_H + 2, { width: PHOTO_W, align: "center", lineBreak: false });

    // Header text area (left of photo)
    const textX = M + 5;
    const textW = photoX - textX - 8;

    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#1E3A5F")
      .text("JHARKHAND SKILL DEVELOPMENT MISSION SOCIETY (JSDMS)", textX, HY + 6, { width: textW, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#1E3A5F")
      .text("Deen Dayal Upadhyay Grameen Kaushalya Yojana (DDU-GKY)", textX, HY + 18, { width: textW, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#1E3A5F")
      .text("Deen Dayal Upadhyay Kaushal Kendra (DDUKK)", textX, HY + 30, { width: textW, lineBreak: false });

    hLine(doc, M, HY + 42, M + COL_W, 0.7);

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111")
      .text("STUDENT / CANDIDATE REGISTRATION FORM", textX, HY + 46, { width: textW, align: "center", lineBreak: false });
    doc.font("Helvetica").fontSize(8).fillColor("#111")
      .text("(छात्र / अभ्यर्थी पंजीकरण फॉर्म)", textX, HY + 58, { width: textW, align: "center", lineBreak: false });

    hLine(doc, M, HY + 70, M + COL_W, 0.7);

    // Training Centre ID and Skill Centre Name row
    const tcLabelX = M + 3;
    const tcValueX = M + 110;
    const tcY = HY + 74;

    doc.font("Helvetica").fontSize(7).fillColor("#555")
      .text("Training Centre ID / प्रशिक्षण केंद्र आईडी:", tcLabelX, tcY, { lineBreak: false });
    hLine(doc, tcValueX, tcY + 9, M + COL_W / 2 - 5, 0.5);

    const scLabelX = M + COL_W / 2 + 3;
    doc.font("Helvetica").fontSize(7).fillColor("#555")
      .text("Skill Centre Name / कौशल केंद्र नाम:", scLabelX, tcY, { lineBreak: false });
    if (candidate.skillCentreName) {
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#111")
        .text(candidate.skillCentreName, scLabelX + 108, tcY, { width: COL_W / 2 - 115, lineBreak: false });
    } else {
      hLine(doc, scLabelX + 108, tcY + 9, M + COL_W - 3, 0.5);
    }

    hLine(doc, M, tcY + 13, M + COL_W, 0.7);

    // ── COURSE + CANDIDATE ID row ──────────────────────────────────────────────

    let y = HY + 100;
    const rowH = 18;

    // Course Name (left 60%)
    const courseW = COL_W * 0.62;
    box(doc, M, y, courseW, rowH);
    doc.font("Helvetica").fontSize(6.5).fillColor("#555")
      .text("Course Name / कोर्स का नाम:", M + 3, y + 3, { lineBreak: false });
    if (candidate.course) {
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#111")
        .text(candidate.course, M + 110, y + 5, { width: courseW - 115, lineBreak: false });
    }

    // Candidate ID (right 38%)
    const cidX = M + courseW;
    const cidW = COL_W - courseW;
    box(doc, cidX, y, cidW, rowH);
    doc.font("Helvetica").fontSize(6.5).fillColor("#555")
      .text("Candidate ID:", cidX + 3, y + 3, { lineBreak: false });
    if (candidate.candidateIdCode) {
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#111")
        .text(candidate.candidateIdCode, cidX + 66, y + 5, { width: cidW - 70, lineBreak: false });
    }
    y += rowH;

    // ── SECTION: PERSONAL DETAILS ─────────────────────────────────────────────

    y = sectionBand(doc, "A.  PERSONAL DETAILS  /  व्यक्तिगत विवरण", M, y, COL_W);

    // Name rows
    const fullW = COL_W;
    box(doc, M, y, fullW, rowH);
    doc.font("Helvetica").fontSize(6.5).fillColor("#555")
      .text("Candidate Name (Hindi) / अभ्यर्थी का नाम (हिंदी):", M + 3, y + 3, { lineBreak: false });
    hLine(doc, M + 180, y + rowH - 3, M + fullW - 3, 0.4);
    y += rowH;

    box(doc, M, y, fullW, rowH);
    doc.font("Helvetica").fontSize(6.5).fillColor("#555")
      .text("Candidate Name (English) / नाम (अंग्रेजी):", M + 3, y + 3, { lineBreak: false });
    if (candidate.name) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#111")
        .text(candidate.name.toUpperCase(), M + 170, y + 5, { width: fullW - 175, lineBreak: false });
    }
    y += rowH;

    // Father + Mother names
    const halfW = COL_W / 2;
    fieldRow(doc, M, y, halfW, rowH, "Father/Husband Name / पिता/पति का नाम:", candidate.fatherName, 130);
    fieldRow(doc, M + halfW, y, halfW, rowH, "Mother's Name / माता का नाम:", candidate.motherName, 100);
    y += rowH;

    // Marital + Gender radio
    radioRow(doc, "Marital / वैवाहिक:", ["Single", "Married", "Divorced"], candidate.maritalStatus, M, y, halfW, rowH);
    radioRow(doc, "Sex / लिंग:", ["Male", "Female", "Other"], candidate.gender, M + halfW, y, halfW, rowH);
    y += rowH;

    // DOB + Religion
    fieldRow(doc, M, y, halfW, rowH, "Date of Birth (DD/MM/YYYY) / जन्म तिथि:", candidate.dob, 140);
    fieldRow(doc, M + halfW, y, halfW, rowH, "Religion / धर्म:", candidate.religion, 80);
    y += rowH;

    // Category + PwD
    radioRow(doc, "Category / वर्ग:", ["General", "OBC", "SC", "ST"], candidate.caste, M, y, halfW, rowH);
    radioRow(doc, "PwD / दिव्यांग:", ["Yes", "No"], candidate.pwd, M + halfW, y, COL_W - halfW, rowH);
    y += rowH;

    // Disability type
    fieldRow(doc, M, y, fullW, rowH, "Type of Disability / दिव्यांगता का प्रकार (if PwD Yes):", candidate.disabilityType, 170);
    y += rowH;

    // Mobile + Email
    fieldRow(doc, M, y, halfW, rowH, "Mobile No. / मोबाइल नं.:", candidate.phone, 95);
    fieldRow(doc, M + halfW, y, halfW, rowH, "Email / ईमेल:", candidate.email, 75);
    y += rowH;

    // ── SECTION: ADDRESS ─────────────────────────────────────────────────────

    y = sectionBand(doc, "B.  ADDRESS  /  पता", M, y, COL_W);

    // Address full width
    fieldRow(doc, M, y, fullW, rowH, "Address / पता (House No., Street, Locality):", candidate.address, 175);
    y += rowH;

    // Village + Police Station
    fieldRow(doc, M, y, halfW, rowH, "Village / Town / ग्राम / नगर:", candidate.village, 110);
    fieldRow(doc, M + halfW, y, halfW, rowH, "Police Station / थाना:", candidate.policeStation, 95);
    y += rowH;

    // Post Office + District
    fieldRow(doc, M, y, halfW, rowH, "Post Office / डाकघर:", candidate.postOffice, 95);
    fieldRow(doc, M + halfW, y, halfW, rowH, "District / जिला:", candidate.district, 75);
    y += rowH;

    // State + PIN
    const thirdW = COL_W * 0.55;
    fieldRow(doc, M, y, thirdW, rowH, "State / राज्य:", candidate.state ?? "Jharkhand", 75);
    fieldRow(doc, M + thirdW, y, COL_W - thirdW, rowH, "PIN Code / पिन कोड:", candidate.pin, 80);
    y += rowH;

    // ── SECTION: AADHAAR ─────────────────────────────────────────────────────

    y = sectionBand(doc, "C.  AADHAAR NUMBER  /  आधार नंबर", M, y, COL_W);

    const aY = y + 3;
    doc.font("Helvetica").fontSize(7).fillColor("#555")
      .text("Aadhaar No. / आधार नं.:", M + 3, aY + 3, { lineBreak: false });
    aadhaarBoxes(doc, candidate.aadhaarNumber, M + 110, aY);
    y = aY + 25;

    // BPL
    const bplH = 18;
    radioRow(doc, "BPL / गरीबी रेखा से नीचे:", ["Yes", "No"], candidate.bpl, M, y, halfW, bplH);
    fieldRow(doc, M + halfW, y, halfW, bplH, "BPL Card No. / बीपीएल कार्ड नं.:", candidate.bplNumber, 110);
    y += bplH;

    // ── SECTION: EDUCATION ───────────────────────────────────────────────────

    y = sectionBand(doc, "D.  EDUCATIONAL DETAILS  /  शैक्षणिक विवरण", M, y, COL_W);

    fieldRow(doc, M, y, thirdW, rowH, "Highest Qualification / उच्चतम योग्यता:", candidate.education, 140);
    fieldRow(doc, M + thirdW, y, COL_W - thirdW, rowH, "Year of Passing / उत्तीर्ण वर्ष:", candidate.yearOfPassing, 110);
    y += rowH;

    // ── SECTION: BANK ────────────────────────────────────────────────────────

    y = sectionBand(doc, "E.  BANK DETAILS  /  बैंक विवरण", M, y, COL_W);

    fieldRow(doc, M, y, halfW, rowH, "Bank Account No. / बैंक खाता नं.:", candidate.bankAccount, 130);
    fieldRow(doc, M + halfW, y, halfW, rowH, "Bank Name / बैंक का नाम:", candidate.bankName, 90);
    y += rowH;

    fieldRow(doc, M, y, halfW, rowH, "IFSC Code:", candidate.ifsc, 75);
    fieldRow(doc, M + halfW, y, halfW, rowH, "Branch Name / शाखा:", candidate.bankBranch, 85);
    y += rowH;

    // ── SECTION: DOCUMENT CHECKLIST ──────────────────────────────────────────

    y = sectionBand(doc, "F.  DOCUMENTS ATTACHED  /  संलग्न दस्तावेज", M, y, COL_W);

    const docList = [
      { label: "Birth Certificate / जन्म प्रमाण पत्र", path: null },
      { label: "Caste Certificate / जाति प्रमाण पत्र", path: candidate.casteCertPath },
      { label: "Aadhaar Card / आधार कार्ड", path: candidate.aadhaarFrontPath },
      { label: "Education Certificate / शैक्षणिक प्रमाण पत्र", path: candidate.educationCertPath },
      { label: "Bank Passbook / बैंक पासबुक", path: candidate.bankPassbookPath },
    ];

    const docColW = COL_W / 2;
    let docIdx = 0;
    for (let di = 0; di < docList.length; di += 2) {
      const dY = y + 4 + docIdx * 13;
      const checked1 = !!(docList[di]?.path && fs.existsSync(docList[di]!.path!));
      checkBox(doc, M + 5, dY, checked1, docList[di]?.label ?? "");
      if (docList[di + 1]) {
        const checked2 = !!(docList[di + 1]?.path && fs.existsSync(docList[di + 1]!.path!));
        checkBox(doc, M + docColW + 5, dY, checked2, docList[di + 1]?.label ?? "");
      }
      docIdx++;
    }
    y += 4 + Math.ceil(docList.length / 2) * 13 + 4;

    // ── SECTION: DECLARATION / SIGNATURE ─────────────────────────────────────

    y = sectionBand(doc, "G.  DECLARATION  /  घोषणा", M, y, COL_W);

    const declH = 28;
    box(doc, M, y, COL_W, declH);
    doc.font("Helvetica").fontSize(6.5).fillColor("#333")
      .text(
        "I hereby declare that the information given above is true and correct to the best of my knowledge and belief.\n" +
        "मैं घोषणा करता/करती हूँ कि उपरोक्त जानकारी मेरी जानकारी एवं विश्वास के अनुसार सत्य और सही है।",
        M + 4,
        y + 4,
        { width: COL_W - 8, lineBreak: true },
      );
    y += declH;

    // Place / Date / Signature row
    const sigH = 36;
    box(doc, M, y, COL_W, sigH);
    const third = COL_W / 3;

    vLine(doc, M + third, y, y + sigH, 0.5);
    vLine(doc, M + third * 2, y, y + sigH, 0.5);

    doc.font("Helvetica").fontSize(6.5).fillColor("#555")
      .text("Place / स्थान:", M + 3, y + 4, { lineBreak: false });
    if (candidate.area) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#111")
        .text(candidate.area, M + 55, y + 4, { width: third - 58, lineBreak: false });
    }

    doc.font("Helvetica").fontSize(6.5).fillColor("#555")
      .text("Date / दिनांक:", M + third + 3, y + 4, { lineBreak: false });
    doc.font("Helvetica").fontSize(8).fillColor("#111")
      .text(candidate.createdAt?.toLocaleDateString("en-IN") ?? "", M + third + 52, y + 4, { lineBreak: false });

    doc.font("Helvetica").fontSize(6.5).fillColor("#555")
      .text("Signature of Applicant / अभ्यर्थी के हस्ताक्षर:", M + third * 2 + 3, y + 4, { lineBreak: false });

    const sigImg = safeImage(doc, candidate.signaturePath, M + third * 2 + 3, y + 13, {
      width: third - 6,
      height: 18,
      fit: [third - 6, 18],
    });
    if (!sigImg) {
      hLine(doc, M + third * 2 + 10, y + sigH - 4, M + COL_W - 10, 0.5);
    }
    y += sigH;

    // Mobilizer row
    const mobH = 16;
    box(doc, M, y, COL_W, mobH);
    doc.font("Helvetica").fontSize(6.5).fillColor("#555")
      .text("Mobilizer Name / मोबिलाइज़र का नाम:", M + 3, y + 4, { lineBreak: false });
    if (candidate.mobilizer ?? candidate.submittedBy) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#111")
        .text(candidate.mobilizer ?? candidate.submittedBy ?? "", M + 145, y + 4, { width: COL_W - 150, lineBreak: false });
    }
    y += mobH;

    // Footer
    y += 4;
    doc.font("Helvetica").fontSize(6).fillColor("#888")
      .text(
        `Candidate ID: ${candidate.id}  |  Registered: ${candidate.createdAt?.toLocaleDateString("en-IN") ?? ""}  |  Status: ${candidate.status.toUpperCase()}`,
        M, y, { width: COL_W, align: "center", lineBreak: false },
      );

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGES 2+: Document images
    // ═══════════════════════════════════════════════════════════════════════════

    const attachedDocs: Array<{ label: string; filePath: string | null | undefined }> = [
      { label: "Aadhaar Card – Front / आधार कार्ड (आगे)", filePath: candidate.aadhaarFrontPath },
      { label: "Aadhaar Card – Back / आधार कार्ड (पीछे)", filePath: candidate.aadhaarBackPath },
      { label: "Education Certificate / शैक्षणिक प्रमाण पत्र", filePath: candidate.educationCertPath },
      { label: "Bank Passbook / बैंक पासबुक", filePath: candidate.bankPassbookPath },
      { label: "Caste Certificate / जाति प्रमाण पत्र", filePath: candidate.casteCertPath },
    ];

    for (const { label: docLabel, filePath } of attachedDocs) {
      if (!filePath || !fs.existsSync(filePath)) continue;
      doc.addPage({ size: "A4", margin: 0 });

      doc.rect(0, 0, A4_W, 38).fill("#1E3A5F");
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#fff")
        .text(docLabel, M, 12, { align: "left", lineBreak: false });
      doc.font("Helvetica").fontSize(8).fillColor("rgba(255,255,255,0.75)")
        .text(candidate.name, 0, 14, { width: A4_W - M, align: "right", lineBreak: false });

      const imgY = 46;
      const imgH = A4_H - imgY - 12;
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
