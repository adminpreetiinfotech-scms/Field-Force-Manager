import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import type { Candidate } from "@workspace/db";

// ─── Font paths ───────────────────────────────────────────────────────────────
const FONTS_DIR = path.resolve(__dirname, "fonts");
const FONT_NS_REG  = path.join(FONTS_DIR, "NotoSansDevanagari-Regular.ttf");
const FONT_NS_BOLD = path.join(FONTS_DIR, "NotoSansDevanagari-Bold.ttf");
const FONT_DV_REG  = path.join(FONTS_DIR, "DejaVuSans-Regular.ttf");
const FONT_DV_BOLD = path.join(FONTS_DIR, "DejaVuSans-Bold.ttf");

type PDFDoc = InstanceType<typeof PDFDocument>;

const A4_W = 595.28;
const A4_H = 841.89;
const ML   = 22;        // left/right page margin
const MT   = 14;        // top/bottom page margin
const INK  = "#111111"; // primary ink colour (near-black)
const DARK = "#1a1a1a";

// ─── Script detection ─────────────────────────────────────────────────────────

function isDevanagariCp(cp: number): boolean {
  return (cp >= 0x0900 && cp <= 0x097F) || (cp >= 0xA8E0 && cp <= 0xA8FF);
}

type Seg = { text: string; dev: boolean };

function splitScript(text: string): Seg[] {
  if (!text) return [];
  const out: Seg[] = [];
  let cur = "";
  let curDev = isDevanagariCp(text.codePointAt(0) ?? 0);
  for (const ch of text) {
    const dev = isDevanagariCp(ch.codePointAt(0) ?? 0);
    if (dev !== curDev) {
      if (cur) out.push({ text: cur, dev: curDev });
      cur = ch; curDev = dev;
    } else { cur += ch; }
  }
  if (cur) out.push({ text: cur, dev: curDev });
  return out;
}

function font4(dev: boolean, bold: boolean): string {
  return dev ? (bold ? "NSB" : "NSR") : (bold ? "DVB" : "DVR");
}

// ─── Core text renderer ───────────────────────────────────────────────────────

interface TxtOpts {
  width?:     number;
  size?:      number;
  bold?:      boolean;
  align?:     "left" | "center" | "right";
  color?:     string;
  lineBreak?: boolean;
  cont?:      boolean;
}

function t(doc: PDFDoc, text: string, x: number, y: number, o: TxtOpts = {}) {
  const {
    size = 8, bold = false, align = "left",
    color = DARK, width, lineBreak = false, cont: outerCont = false,
  } = o;
  const segs = splitScript(text);
  if (!segs.length) return;
  doc.fontSize(size).fillColor(color);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    const last = i === segs.length - 1;
    const cont = last ? outerCont : true;
    doc.font(font4(s.dev, bold));
    if (i === 0) doc.text(s.text, x, y, { width, align, lineBreak, continued: cont });
    else         doc.text(s.text,       { width, align, lineBreak, continued: cont });
  }
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

/** Horizontal rule */
function hl(doc: PDFDoc, x1: number, y: number, x2: number, lw = 0.5) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(INK).lineWidth(lw).stroke();
}

/** Thin rectangle outline */
function rect(doc: PDFDoc, x: number, y: number, w: number, h: number, lw = 0.6) {
  doc.rect(x, y, w, h).strokeColor(INK).lineWidth(lw).stroke();
}

/** Safe image draw */
function safeImg(
  doc: PDFDoc, fp: string | null | undefined,
  x: number, y: number, opts: Record<string, unknown>,
): boolean {
  if (!fp || !fs.existsSync(fp)) return false;
  try { doc.image(fp, x, y, opts); return true; }
  catch { return false; }
}

// ─── Field helpers ────────────────────────────────────────────────────────────

const ROW = 22;   // standard row height (pt)
const ULY = 15;   // underline y-offset within a row

/**
 * Render one field segment: label + underline + optional value
 *   x       = left edge
 *   y       = top of row
 *   labelW  = width allocated for label text (underline starts here)
 *   totalW  = total width of this field segment (underline ends here)
 */
function seg(
  doc: PDFDoc,
  label: string,
  value: string | null | undefined,
  x: number, y: number,
  labelW: number,
  totalW: number,
) {
  t(doc, label, x, y + 2, { size: 7.5, width: labelW - 1, color: INK });
  hl(doc, x + labelW, y + ULY, x + totalW, 0.45);
  if (value?.trim()) {
    t(doc, value.trim(), x + labelW + 2, y + 2, {
      size: 8, bold: false, color: DARK,
      width: totalW - labelW - 4,
    });
  }
}

/** 12 Aadhaar digit boxes in 3 groups of 4 */
function aadhaarBoxes(doc: PDFDoc, num: string | null | undefined, x: number, y: number) {
  const BW = 15; const BH = 14; const GAP = 2; const GRPGAP = 5;
  const digits = (num ?? "").replace(/\D/g, "").padEnd(12, "").split("");
  for (let i = 0; i < 12; i++) {
    const bx = x + i * (BW + GAP) + Math.floor(i / 4) * GRPGAP;
    rect(doc, bx, y, BW, BH, 0.5);
    if (digits[i]) {
      doc.font("DVB").fontSize(9).fillColor(DARK)
        .text(digits[i]!, bx, y + 2.5, { width: BW, align: "center", lineBreak: false });
    }
  }
}

/** Small checkbox square for document checklist */
function chkBox(doc: PDFDoc, x: number, y: number, checked: boolean) {
  const SZ = 8;
  rect(doc, x, y, SZ, SZ, 0.6);
  if (checked) {
    doc.font("DVB").fontSize(7).fillColor(DARK)
      .text("✓", x, y + 0.5, { width: SZ, align: "center", lineBreak: false });
  }
}

// ─── Main PDF generation ──────────────────────────────────────────────────────

export async function generateCandidatePdf(
  rawCandidate: Candidate,
  pdfPath: string,
): Promise<void> {
  const c = rawCandidate as Candidate & {
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

    doc.registerFont("NSR", FONT_NS_REG);
    doc.registerFont("NSB", FONT_NS_BOLD);
    doc.registerFont("DVR", FONT_DV_REG);
    doc.registerFont("DVB", FONT_DV_BOLD);

    const ws = fs.createWriteStream(pdfPath);
    doc.pipe(ws);
    ws.on("error", reject);
    ws.on("finish", resolve);

    const CW = A4_W - ML * 2;   // usable content width = 551
    const FX = ML + 2;           // field content left edge
    const FW = CW - 4;           // field content width
    const FE = FX + FW;          // field content right edge

    // ── Outer border ──────────────────────────────────────────────────────────
    rect(doc, ML, MT, CW, A4_H - MT * 2, 1.0);

    // ══════════════════════════════════════════════════════════════════════════
    // PHOTO BOX — top right corner, inside outer border
    // ══════════════════════════════════════════════════════════════════════════

    const PW = 115;            // photo box width
    const PH = 136;            // photo box height (spans header + title area)
    const PX = ML + CW - PW;  // right-aligned within outer border
    const PY = MT;             // top-aligned

    rect(doc, PX, PY, PW, PH, 0.7);

    t(doc, "Affix recent Passport", PX, PY + 4, {
      size: 6.5, width: PW, align: "center",
    });
    t(doc, "Size Colour Photo", PX, PY + 13, {
      size: 6.5, width: PW, align: "center",
    });

    const photoAreaX = PX + 5;
    const photoAreaY = PY + 23;
    const photoAreaW = PW - 10;
    const photoAreaH = PH - 47;

    const photoOk = safeImg(doc, c.photoPath, photoAreaX, photoAreaY, {
      width: photoAreaW, height: photoAreaH, cover: [photoAreaW, photoAreaH],
    });
    if (!photoOk) {
      rect(doc, photoAreaX, photoAreaY, photoAreaW, photoAreaH, 0.4);
    }

    t(doc, "Cross Sign. Over", PX, PY + PH - 24, {
      size: 6, width: PW, align: "center",
    });
    t(doc, "photograph", PX, PY + PH - 15, {
      size: 6, width: PW, align: "center",
    });

    // ══════════════════════════════════════════════════════════════════════════
    // LETTERHEAD — three column (English | Logo | Hindi), left of photo box
    // ══════════════════════════════════════════════════════════════════════════

    const HW   = PX - ML - 3;   // header content width (left of photo box)
    const logoW = 62;            // centre logo column width
    const leftW = (HW - logoW) * 0.52;  // ~225pt for English col
    const rightW = HW - leftW - logoW;  // ~175pt for Hindi col

    const hX  = ML + 3;
    const hY  = MT + 3;
    const rX  = ML + leftW + logoW;    // right Hindi column start

    // Left — English
    t(doc, "Jharkhand Skill Development Mission Society", hX, hY, {
      size: 8.5, bold: true, color: DARK, width: leftW,
    });
    t(doc, "Labour Employment and skill Development Department", hX, hY + 11, {
      size: 7, color: DARK, width: leftW,
    });
    t(doc, "Govt. of Jharkhand", hX, hY + 21, {
      size: 7, color: DARK, width: leftW,
    });
    t(doc, "Training Centre ID :–", hX, hY + 32, {
      size: 7, color: DARK, width: 95,
    });
    hl(doc, hX + 98, hY + 32 + 10, hX + leftW - 2, 0.4);

    // Centre — Logo placeholder (concentric circles with "JSDMS")
    const logoX = ML + leftW + logoW / 2;
    const logoY = hY + 24;
    doc.circle(logoX, logoY, 24).strokeColor(INK).lineWidth(0.7).stroke();
    doc.circle(logoX, logoY, 19).strokeColor(INK).lineWidth(0.4).stroke();
    doc.circle(logoX, logoY, 3).fill(INK);
    t(doc, "JSDMS", logoX - 14, logoY - 5, { size: 5.5, bold: true, color: DARK, width: 28 });

    // Right — Hindi
    t(doc, "झारखण्ड कौशल विकास मिशन सांसाइटी", rX, hY, {
      size: 8, bold: true, color: DARK, width: rightW,
    });
    t(doc, "श्रम नियोजन प्रशिक्षण एवं कौशल विकास विभाग", rX, hY + 11, {
      size: 7, color: DARK, width: rightW,
    });
    t(doc, "झारखण्ड सरकार द्वारा वित्त प्रदत्त", rX, hY + 22, {
      size: 7, color: DARK, width: rightW,
    });

    // Header separator line
    const sepY = MT + 58;
    hl(doc, ML, sepY, ML + CW, 0.7);

    // ══════════════════════════════════════════════════════════════════════════
    // TITLE AREA — big Hindi name + DDUKK + form box
    // ══════════════════════════════════════════════════════════════════════════

    let y = sepY + 4;
    const titleW = PX - ML;   // title content stops at the photo box

    // Large Hindi title
    t(doc, "मेगा स्कील सेन्टर", ML, y, {
      size: 26, bold: true, color: DARK, width: titleW, align: "center",
    });
    y += 32;

    t(doc, "DEEN DAYAL UPADHYAY KAUSHAL KENDRA (DDUKK)", ML, y, {
      size: 9.5, bold: true, color: DARK, width: titleW, align: "center",
    });
    y += 13;

    // "STUDENT REGISTRATION FORM" in a bordered rectangle
    const stfW = 215;
    const stfX = ML + (titleW - stfW) / 2;
    rect(doc, stfX, y, stfW, 14, 0.7);
    t(doc, "STUDENT REGISTRATION FORM", stfX, y + 2, {
      size: 9, bold: true, color: DARK, width: stfW, align: "center",
    });
    y += 17;

    // Separator
    hl(doc, ML, y + 1, ML + CW, 0.7);
    y += 5;

    // Skill Centre Name row
    t(doc, "Skill Centre Name :–", FX, y + 2, { size: 8, bold: true, width: 112, color: DARK });
    const scName = c.skillCentreName ?? "";
    if (scName) {
      t(doc, scName, FX + 115, y + 2, { size: 8, color: DARK, width: FW - 118 });
    } else {
      hl(doc, FX + 115, y + ULY, FE, 0.4);
    }
    y += ROW - 4;
    hl(doc, ML, y, ML + CW, 0.7);
    y += 4;

    // ══════════════════════════════════════════════════════════════════════════
    // FORM FIELDS — underline style, matching reference layout exactly
    // ══════════════════════════════════════════════════════════════════════════

    // Row 1: Course Name + Candidate ID boxes
    const courseW = FW * 0.54;
    seg(doc, "कोर्स का नाम/Course Name", c.course, FX, y, 113, courseW);

    const cidX = FX + courseW + 4;
    const cidRemainingW = FW - courseW - 4;
    t(doc, "Candidate ID", cidX, y + 2, { size: 7.5, width: 60, color: INK });

    // Candidate ID boxes
    const cidCode = (c.candidateIdCode ?? "").substring(0, 10).padEnd(10, "");
    const cidBoxW = 16; const cidBoxH = 13;
    let bx2 = cidX + 63;
    for (let i = 0; i < 10; i++) {
      if (bx2 + cidBoxW > FE) break;
      rect(doc, bx2, y + 1, cidBoxW, cidBoxH, 0.5);
      if (cidCode[i] && cidCode[i] !== " ") {
        doc.font("DVB").fontSize(8).fillColor(DARK)
          .text(cidCode[i]!, bx2, y + 3.5, { width: cidBoxW, align: "center", lineBreak: false });
      }
      bx2 += cidBoxW + 2;
    }
    y += ROW;

    // Row 2: Name
    seg(doc, "नाम / Name", c.name, FX, y, 48, FW);
    y += ROW;

    // Row 3: Father/Husband Name + Mobile No.
    const fatherW = FW * 0.63;
    seg(doc, "पिता/पति का नाम/Father's/ Husband Name", c.fatherName, FX, y, 148, fatherW);
    seg(doc, "Mobile No.", c.phone, FX + fatherW + 3, y, 56, FW - fatherW - 3);
    y += ROW;

    // Row 4: Mother's Name
    seg(doc, "माता का नाम/ Mother's Name", c.motherName, FX, y, 118, FW);
    y += ROW;

    // Row 5: Marital Status
    seg(doc, "वैवाहिक स्थिति/Marital Status", c.maritalStatus, FX, y, 128, FW);
    y += ROW;

    // Row 6: Sex + Date of Birth
    const sexW = FW * 0.30;
    seg(doc, "लिंग/Sex", c.gender, FX, y, 48, sexW);
    seg(doc, "जन्म तिथि/Date of Birth (Born on or before 01/01/2004)", c.dob,
      FX + sexW + 3, y, 188, FW - sexW - 3);
    y += ROW;

    // Row 7: Religion + Category
    const relW = FW * 0.33;
    seg(doc, "धर्म/Religion", c.religion, FX, y, 68, relW);
    seg(doc, "जाति/Category (Gen/SC/ST/OBC/BCI/BCII/Minority)", c.caste,
      FX + relW + 3, y, 175, FW - relW - 3);
    y += ROW;

    // Row 8: PwD + Disability Type
    const pwdW = FW * 0.36;
    seg(doc, "शक्त/PwD", c.pwd, FX, y, 50, pwdW);
    seg(doc, "निशक्त प्रकृति/Disability Type", c.disabilityType,
      FX + pwdW + 3, y, 128, FW - pwdW - 3);
    y += ROW;

    // Row 9: Address + Village/Town
    const addrW = FW * 0.58;
    seg(doc, "पता/Address/मोहल्ला/Area", c.address, FX, y, 112, addrW);
    seg(doc, "गाँव/शहर/Vill/Town", c.village, FX + addrW + 3, y, 82, FW - addrW - 3);
    y += ROW;

    // Row 10: Police Station + Post Office
    const psW = FW * 0.48;
    seg(doc, "थाना/Police Station", c.policeStation, FX, y, 88, psW);
    seg(doc, "डाकघर/Post Office", c.postOffice, FX + psW + 3, y, 80, FW - psW - 3);
    y += ROW;

    // Row 11: District + State + Pin
    const distW = FW * 0.37;
    const stateW = FW * 0.35;
    const pinW   = FW - distW - stateW;
    seg(doc, "जिला/District", c.district, FX, y, 62, distW);
    seg(doc, "राज्य/State", c.state ?? "Jharkhand", FX + distW + 2, y, 52, stateW);
    seg(doc, "पिन/Pin", c.pin, FX + distW + stateW + 4, y, 36, pinW - 4);
    y += ROW;

    // Row 12: Mobile + Email
    const mobW = FW * 0.44;
    seg(doc, "मोबाईल/Mobile No.", c.phone, FX, y, 90, mobW);
    seg(doc, "ई-मेल/E-mail", c.email, FX + mobW + 3, y, 60, FW - mobW - 3);
    y += ROW;

    // Row 13: Aadhaar Number
    t(doc, "आधार नं/Aadhar No.", FX, y + 2, { size: 7.5, width: 100, color: INK });
    aadhaarBoxes(doc, c.aadhaarNumber, FX + 103, y + 2);
    y += ROW;

    // Row 14: BPL + BPL Number
    const bplW = FW * 0.44;
    seg(doc, "बी.पी.एल./BPL :– हाँ/ना/Yes / No :", c.bpl, FX, y, 148, bplW);
    seg(doc, "अगर हाँ तो बी.पी.एल. संख्या/BPL No.", c.bplNumber,
      FX + bplW + 3, y, 153, FW - bplW - 3);
    y += ROW;

    // Row 15: Highest Qualification + Year of Passing
    const eduW = FW * 0.58;
    seg(doc, "अधिकतम शैक्षिक योग्यता/Highest Qualification", c.education,
      FX, y, 175, eduW);
    seg(doc, "पास करने का वर्ष/Year of Passing", c.yearOfPassing,
      FX + eduW + 3, y, 133, FW - eduW - 3);
    y += ROW;

    // Row 16: A/C No. + Bank Name
    const acW = FW * 0.50;
    seg(doc, "A/C No.", c.bankAccount, FX, y, 40, acW);
    seg(doc, "Bank Name", c.bankName, FX + acW + 3, y, 56, FW - acW - 3);
    y += ROW;

    // Row 17: IFSC Code + Branch Name
    seg(doc, "IFSC Code No.", c.ifsc, FX, y, 66, FW * 0.50);
    seg(doc, "Branch Name", c.bankBranch, FX + FW * 0.50 + 3, y, 58, FW * 0.50 - 3);
    y += ROW;

    y += 8; // breathing room before footer

    // ══════════════════════════════════════════════════════════════════════════
    // FOOTER
    // ══════════════════════════════════════════════════════════════════════════

    // Date / Place / Signature
    const dateStr = c.createdAt?.toLocaleDateString("en-IN") ?? "";
    t(doc, "Date :", FX, y + 2, { size: 7.5, width: 28, color: INK });
    hl(doc, FX + 30, y + ULY, FX + 100, 0.45);
    if (dateStr) t(doc, dateStr, FX + 32, y + 2, { size: 8, color: DARK, width: 65 });

    t(doc, "Place", FX + 104, y + 2, { size: 7.5, width: 26, color: INK });
    hl(doc, FX + 132, y + ULY, FX + FW * 0.58, 0.45);
    if (c.area) t(doc, c.area, FX + 134, y + 2, { size: 8, color: DARK, width: 140 });

    const sigLblX = FX + FW * 0.60;
    t(doc, "Signature of the Applicant", sigLblX, y + 2, {
      size: 8, bold: true, color: INK, width: FE - sigLblX,
    });
    const sigDone = safeImg(doc, c.signaturePath, sigLblX, y + 14, {
      width: FE - sigLblX, height: 22, fit: [FE - sigLblX, 22],
    });
    if (!sigDone) {
      hl(doc, sigLblX, y + 34, FE, 0.45);
    }
    y += 38;

    // Mobilizer Name (dotted line)
    t(doc, "oblizer Name", FX, y + 2, { size: 7.5, width: 58, color: INK });
    const mob = c.mobilizer ?? c.submittedBy ?? "";
    if (mob) {
      t(doc, mob, FX + 62, y + 2, { size: 8, color: DARK, width: FW - 65 });
    }
    // Draw dotted line across full width
    for (let dx = FX + 62; dx < FE; dx += 5) {
      doc.moveTo(dx, y + ULY).lineTo(Math.min(dx + 3, FE), y + ULY)
        .strokeColor(INK).lineWidth(0.5).stroke();
    }
    y += 18;

    // Document checklist: "दस्तावेज :- 1. □  2. □  ..."
    t(doc, "दस्तावेज :–", FX, y + 2, { size: 7.5, bold: true, width: 55, color: INK });

    const chkItems: { n: string; lbl: string; checked: boolean; x: number }[] = [
      { n: "1.", lbl: "जन्म प्रमाण पत्र",   checked: false, x: FX + 58 },
      { n: "2.", lbl: "जाति प्रमाण पत्र",   checked: !!(c.casteCertPath    && fs.existsSync(c.casteCertPath!)),    x: FX + 155 },
      { n: "3.", lbl: "आधार कार्ड",          checked: !!(c.aadhaarFrontPath && fs.existsSync(c.aadhaarFrontPath!)), x: FX + 250 },
      { n: "4.", lbl: "शैक्षिक प्रमाण पत्र", checked: !!(c.educationCertPath && fs.existsSync(c.educationCertPath!)), x: FX + 315 },
      { n: "5.", lbl: "बैंक पास बुक",        checked: !!(c.bankPassbookPath && fs.existsSync(c.bankPassbookPath!)), x: FX + 430 },
    ];

    for (const item of chkItems) {
      t(doc, item.n + " " + item.lbl, item.x, y + 2, { size: 7.5, color: INK, width: 85 });
      // draw checkbox square after the label text (fixed offset)
      const cbOffset = item.lbl.length > 12 ? 82 : item.lbl.length > 8 ? 68 : 54;
      chkBox(doc, item.x + cbOffset, y + 3, item.checked);
    }
    y += 18;

    // Note box (bottom of form)
    const noteH = 32;
    rect(doc, ML, y, CW, noteH, 0.6);
    t(doc, "नोट :– इस पंजीयन पत्र को JSDM के पोर्टल http://jsdm.jharkhand.gov.in पर ऑनलाइन पंजीकृत करना अनिवार्य है।",
      ML + 4, y + 4, { size: 7, width: CW - 8, align: "center" });
    t(doc, "ऑनलाइन पंजीकृत किए बिना यह पंजीयन पत्र अमान्य है।",
      ML + 4, y + 15, { size: 7, width: CW - 8, align: "center" });
    y += noteH + 4;

    // Small metadata footer
    doc.font("DVR").fontSize(5.5).fillColor("#555555")
      .text(
        `ID: ${c.id}   Registered: ${dateStr || "—"}   Status: ${(c.status ?? "").toUpperCase()}   JSDMS / DDU-GKY Jharkhand`,
        ML, y, { width: CW, align: "center", lineBreak: false },
      );

    // Re-draw outer border on top to fix any edge bleed
    rect(doc, ML, MT, CW, A4_H - MT * 2, 1.0);

    // ══════════════════════════════════════════════════════════════════════════
    // PAGES 2+ — Attached document images
    // ══════════════════════════════════════════════════════════════════════════

    const attached = [
      { label: "Aadhaar Card – Front  /  आधार कार्ड (आगे)",        path: c.aadhaarFrontPath },
      { label: "Aadhaar Card – Back  /  आधार कार्ड (पीछे)",         path: c.aadhaarBackPath  },
      { label: "Education Certificate  /  शैक्षणिक प्रमाण पत्र",   path: c.educationCertPath },
      { label: "Bank Passbook  /  बैंक पासबुक",                     path: c.bankPassbookPath  },
      { label: "Caste Certificate  /  जाति प्रमाण पत्र",            path: c.casteCertPath     },
    ];

    for (const { label, path: fp } of attached) {
      if (!fp || !fs.existsSync(fp)) continue;
      doc.addPage({ size: "A4", margin: 0 });

      // Header strip
      doc.rect(0, 0, A4_W, 40).fill("#1A3560");
      doc.rect(0, 0, 4, 40).fill("#F59E0B");
      t(doc, label, 14, 8, { size: 11, bold: true, color: "#FFFFFF" });
      if (c.name) {
        t(doc, c.name, 0, 28, { size: 8, color: "rgba(255,255,255,0.7)", width: A4_W - 14, align: "right" });
      }

      const imgY = 48;
      safeImg(doc, fp, 0, imgY, {
        width: A4_W,
        height: A4_H - imgY - 14,
        fit:    [A4_W, A4_H - imgY - 14],
        align: "center",
        valign: "center",
      });
    }

    doc.end();
  });
}
