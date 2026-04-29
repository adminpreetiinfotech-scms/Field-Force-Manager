import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import type { Candidate } from "@workspace/db";

// ─── Font paths ──────────────────────────────────────────────────────────────
const FONTS_DIR = path.resolve(__dirname, "fonts");
const FONT_NS_REG  = path.join(FONTS_DIR, "NotoSansDevanagari-Regular.ttf");
const FONT_NS_BOLD = path.join(FONTS_DIR, "NotoSansDevanagari-Bold.ttf");
const FONT_DV_REG  = path.join(FONTS_DIR, "DejaVuSans-Regular.ttf");
const FONT_DV_BOLD = path.join(FONTS_DIR, "DejaVuSans-Bold.ttf");

type PDFDoc = InstanceType<typeof PDFDocument>;

const A4_W = 595.28;
const A4_H = 841.89;
const M    = 30;          // page margin
const NAVY = "#1A3560";
const GRAY = "#6B7280";
const LGRAY = "#9CA3AF";
const DARK = "#111827";

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

function t(
  doc: PDFDoc, text: string,
  x: number, y: number,
  o: TxtOpts = {},
) {
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

// ─── Shape helpers ────────────────────────────────────────────────────────────

function hLine(doc: PDFDoc, x1: number, y: number, x2: number, lw = 0.5) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor("#CBD5E1").lineWidth(lw).stroke();
}

function vLine(doc: PDFDoc, x: number, y1: number, y2: number, lw = 0.5) {
  doc.moveTo(x, y1).lineTo(x, y2).strokeColor("#CBD5E1").lineWidth(lw).stroke();
}

function box(doc: PDFDoc, x: number, y: number, w: number, h: number, lw = 0.6, color = "#374151") {
  doc.rect(x, y, w, h).strokeColor(color).lineWidth(lw).stroke();
}

function fill(doc: PDFDoc, x: number, y: number, w: number, h: number, color: string) {
  doc.rect(x, y, w, h).fill(color);
}

function safeImg(
  doc: PDFDoc, fp: string | null | undefined,
  x: number, y: number, opts: Record<string, unknown>,
): boolean {
  if (!fp || !fs.existsSync(fp)) return false;
  try { doc.image(fp, x, y, opts); return true; }
  catch { return false; }
}

// ─── Compound helpers ─────────────────────────────────────────────────────────

const ROW_H  = 22;   // standard data-row height (pt)
const BAND_H = 15;   // section header band height (pt)

/**
 * A labelled data box.
 *
 * Layout:
 *   top-left   → English label line  (DVR 6pt gray)
 *   below that → Hindi label line    (NSR 5.5pt light-gray)
 *   right half → value text          (bold, 8.5pt, dark)
 *
 * labelW: x-offset where value starts.
 */
function field(
  doc: PDFDoc,
  x: number, y: number, w: number, h: number,
  eng: string, hin: string,
  value: string | null | undefined,
  labelW = 130,
) {
  box(doc, x, y, w, h);
  // English label
  t(doc, eng, x + 3, y + 3, { size: 5.5, color: "#6B7280", width: labelW - 5 });
  // Hindi label
  t(doc, hin, x + 3, y + 11, { size: 5, color: "#9CA3AF", width: labelW - 5 });
  // Value
  if (value?.trim()) {
    t(doc, value.trim(), x + labelW, y + 7, {
      size: 8.5, bold: true, color: DARK, width: w - labelW - 4,
    });
  }
}

/** Radio-button row */
function radio(
  doc: PDFDoc,
  eng: string, hin: string,
  opts: string[], value: string | null | undefined,
  x: number, y: number, w: number, h: number,
) {
  box(doc, x, y, w, h);
  t(doc, eng, x + 3, y + 3,  { size: 5.5, color: GRAY });
  t(doc, hin, x + 3, y + 11, { size: 5,   color: LGRAY });
  let cx = x + 4;
  const cy = y + h / 2 + 2;
  for (const opt of opts) {
    const sel = (value ?? "").toLowerCase() === opt.toLowerCase();
    if (sel) doc.circle(cx + 3.5, cy, 3.5).fill(NAVY);
    else     doc.circle(cx + 3.5, cy, 3.5).strokeColor("#6B7280").lineWidth(0.6).stroke();
    t(doc, opt, cx + 9, cy - 4, { size: 7, bold: sel, color: sel ? NAVY : "#374151" });
    cx += 9 + opt.length * 4.6 + 4;
  }
}

/** 12 individual digit boxes for Aadhaar */
function aadhaar(doc: PDFDoc, num: string | null | undefined, x: number, y: number) {
  const SZ = 16;
  const GAP = 2;
  const digits = (num ?? "").replace(/\D/g, "").padEnd(12, "").split("");
  for (let i = 0; i < 12; i++) {
    const bx = x + i * (SZ + GAP) + Math.floor(i / 4) * 5;
    fill(doc, bx, y, SZ, SZ, "#F8FAFC");
    box(doc, bx, y, SZ, SZ, 0.6);
    if (digits[i]) {
      doc.font("DVB").fontSize(9.5).fillColor(DARK)
        .text(digits[i]!, bx, y + 3, { width: SZ, align: "center", lineBreak: false });
    }
  }
}

/** Dark navy section header band */
function band(doc: PDFDoc, text: string, x: number, y: number, w: number): number {
  fill(doc, x, y, w, BAND_H, NAVY);
  // Subtle left accent stripe
  fill(doc, x, y, 3, BAND_H, "#F59E0B");
  t(doc, text, x + 7, y + 3.5, {
    size: 7.5, bold: true, color: "#FFFFFF", width: w - 10,
  });
  return y + BAND_H;
}

/** Tick checkbox with bilingual label */
function tick(doc: PDFDoc, x: number, y: number, checked: boolean, lbl: string) {
  fill(doc, x, y, 9, 9, checked ? "#ECFDF5" : "#F9FAFB");
  box(doc, x, y, 9, 9, 0.6, checked ? "#059669" : "#9CA3AF");
  if (checked) {
    doc.font("DVB").fontSize(8).fillColor("#059669").text("✓", x + 1, y + 0.5, { lineBreak: false });
  }
  t(doc, lbl, x + 13, y + 0.5, { size: 6.5, color: "#374151" });
}

// ─── Main export ──────────────────────────────────────────────────────────────

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

    const W = A4_W - M * 2;   // usable width
    const half = W / 2;
    const third = W * 0.55;

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 1
    // ═══════════════════════════════════════════════════════════════════════════

    // Subtle page background tint
    fill(doc, 0, 0, A4_W, A4_H, "#FAFBFC");

    // Outer border (double-rule effect)
    doc.rect(M - 2, M - 2, W + 4, A4_H - M * 2 + 4).strokeColor("#C7D2E0").lineWidth(0.4).stroke();
    doc.rect(M, M, W, A4_H - M * 2).strokeColor(NAVY).lineWidth(1).stroke();

    // ── HEADER ─────────────────────────────────────────────────────────────────

    const HH  = 110;  // header block height
    const pW  = 68;
    const pH  = 86;
    const pX  = M + W - pW - 5;
    const pY  = M + 4;

    // Header navy accent bar at top
    fill(doc, M, M, W, 5, NAVY);

    // Photo box
    fill(doc, pX, pY, pW, pH, "#F1F5F9");
    box(doc, pX, pY, pW, pH, 0.7, "#94A3B8");
    const photoOk = safeImg(doc, c.photoPath, pX, pY, { width: pW, height: pH, cover: [pW, pH] });
    if (!photoOk) {
      doc.font("DVR").fontSize(18).fillColor("#CBD5E1")
        .text("👤", pX, pY + 20, { width: pW, align: "center", lineBreak: false });
      t(doc, "Paste Photo", pX, pY + 52, { size: 6, color: LGRAY, width: pW, align: "center" });
      t(doc, "पासपोर्ट साइज", pX, pY + 61, { size: 5.5, color: LGRAY, width: pW, align: "center" });
    }
    t(doc, "3.5 × 4.5 cm", pX, pY + pH + 3, { size: 5, color: LGRAY, width: pW, align: "center" });

    // Org name block
    const tX = M + 5;
    const tW = pX - tX - 8;

    t(doc, "JHARKHAND SKILL DEVELOPMENT MISSION SOCIETY", tX, M + 8, {
      size: 9, bold: true, color: NAVY, width: tW,
    });
    t(doc, "झारखंड कौशल विकास मिशन सोसाइटी (JSDMS)", tX, M + 20, {
      size: 8, color: NAVY, width: tW,
    });
    t(doc, "Deen Dayal Upadhyay Grameen Kaushalya Yojana (DDU-GKY)", tX, M + 32, {
      size: 7.5, bold: true, color: "#334155", width: tW,
    });
    t(doc, "दीन दयाल उपाध्याय ग्रामीण कौशल्या योजना", tX, M + 43, {
      size: 7, color: "#475569", width: tW,
    });
    t(doc, "Deen Dayal Upadhyay Kaushal Kendra (DDUKK)", tX, M + 54, {
      size: 7, color: "#475569", width: tW,
    });

    // Divider
    doc.moveTo(M, M + HH - 28).lineTo(M + W, M + HH - 28).strokeColor("#C7D2E0").lineWidth(0.6).stroke();

    // Form title — centred in the remaining header space
    const titleY = M + HH - 24;
    fill(doc, M, titleY - 2, W, 18, "#EFF6FF");
    t(doc, "STUDENT / CANDIDATE REGISTRATION FORM", M, titleY, {
      size: 10, bold: true, color: NAVY, width: W, align: "center",
    });
    t(doc, "छात्र / अभ्यर्थी पंजीकरण फॉर्म", M, titleY + 12, {
      size: 7.5, color: "#475569", width: W, align: "center",
    });

    // Bottom divider of header
    doc.moveTo(M, M + HH + 6).lineTo(M + W, M + HH + 6).strokeColor(NAVY).lineWidth(0.8).stroke();

    // ── Training Centre / Skill Centre row ────────────────────────────────────

    let y = M + HH + 10;

    box(doc, M, y, half, ROW_H);
    t(doc, "Training Centre ID",          M + 3, y + 3,  { size: 5.5, color: GRAY });
    t(doc, "प्रशिक्षण केंद्र आईडी:",      M + 3, y + 11, { size: 5,   color: LGRAY });

    box(doc, M + half, y, half, ROW_H);
    t(doc, "Skill Centre Name",            M + half + 3, y + 3,  { size: 5.5, color: GRAY });
    t(doc, "कौशल केंद्र का नाम:",          M + half + 3, y + 11, { size: 5,   color: LGRAY });
    if (c.skillCentreName) {
      t(doc, c.skillCentreName, M + half + 3, y + 10, { size: 8, bold: true, color: DARK, width: half - 6 });
    }
    y += ROW_H;

    // ── Course + Candidate ID ─────────────────────────────────────────────────

    const cW = W * 0.62;
    box(doc, M, y, cW, ROW_H);
    t(doc, "Course Name",     M + 3, y + 3,  { size: 5.5, color: GRAY });
    t(doc, "कोर्स का नाम:",   M + 3, y + 11, { size: 5,   color: LGRAY });
    if (c.course) {
      t(doc, c.course, M + 90, y + 7, { size: 8.5, bold: true, color: DARK, width: cW - 94 });
    }

    const cidX = M + cW;
    const cidW = W - cW;
    box(doc, cidX, y, cidW, ROW_H);
    t(doc, "Candidate ID", cidX + 3, y + 3,  { size: 5.5, color: GRAY });
    if (c.candidateIdCode) {
      t(doc, c.candidateIdCode, cidX + 3, y + 12, { size: 8, bold: true, color: NAVY, width: cidW - 6 });
    }
    y += ROW_H;

    // ═══ A. PERSONAL DETAILS ══════════════════════════════════════════════════
    y = band(doc, "A.  PERSONAL DETAILS  /  व्यक्तिगत विवरण", M, y, W);

    // Name Hindi (blank for handwriting)
    box(doc, M, y, W, ROW_H);
    t(doc, "Name in Hindi (Block Letters)",  M + 3, y + 3,  { size: 5.5, color: GRAY });
    t(doc, "हिंदी में नाम (मोटे अक्षरों में):", M + 3, y + 11, { size: 5,   color: LGRAY });
    doc.moveTo(M + 175, y + ROW_H - 4).lineTo(M + W - 4, y + ROW_H - 4)
      .strokeColor("#D1D5DB").lineWidth(0.4).stroke();
    y += ROW_H;

    // Name English
    box(doc, M, y, W, ROW_H);
    t(doc, "Name in English (Block Letters)",    M + 3, y + 3,  { size: 5.5, color: GRAY });
    t(doc, "अंग्रेजी में नाम (बड़े अक्षरों में):", M + 3, y + 11, { size: 5,   color: LGRAY });
    if (c.name) {
      t(doc, c.name.toUpperCase(), M + 190, y + 7, {
        size: 9.5, bold: true, color: DARK, width: W - 194,
      });
    }
    y += ROW_H;

    // Father / Mother
    field(doc, M,        y, half, ROW_H, "Father / Husband Name",   "पिता / पति का नाम:",   c.fatherName, 120);
    field(doc, M + half, y, half, ROW_H, "Mother's Name",           "माता का नाम:",         c.motherName, 90);
    y += ROW_H;

    // Marital / Gender
    radio(doc, "Marital Status", "वैवाहिक स्थिति:",
      ["Single", "Married", "Divorced", "Widowed"], c.maritalStatus, M, y, half, ROW_H);
    radio(doc, "Sex", "लिंग:",
      ["Male", "Female", "Other"], c.gender, M + half, y, half, ROW_H);
    y += ROW_H;

    // DOB / Religion
    field(doc, M,        y, half, ROW_H, "Date of Birth (DD/MM/YYYY)", "जन्म तिथि:",   c.dob,      136);
    field(doc, M + half, y, half, ROW_H, "Religion",                    "धर्म:",        c.religion, 65);
    y += ROW_H;

    // Category / PwD
    radio(doc, "Category", "वर्ग:",
      ["General", "OBC", "SC", "ST"], c.caste, M, y, half, ROW_H);
    radio(doc, "PwD / Divyang", "दिव्यांग:",
      ["Yes", "No"], c.pwd, M + half, y, half, ROW_H);
    y += ROW_H;

    // Disability
    field(doc, M, y, W, ROW_H, "Disability Type (if PwD = Yes)", "दिव्यांगता का प्रकार (यदि PwD = हाँ):", c.disabilityType, 200);
    y += ROW_H;

    // Mobile / Email
    field(doc, M,        y, half, ROW_H, "Mobile Number", "मोबाइल नंबर:",  c.phone, 95);
    field(doc, M + half, y, half, ROW_H, "Email Address", "ईमेल पता:",     c.email, 80);
    y += ROW_H;

    // ═══ B. ADDRESS ═══════════════════════════════════════════════════════════
    y = band(doc, "B.  ADDRESS  /  पता", M, y, W);

    field(doc, M, y, W, ROW_H, "Full Address (House No., Street, Ward/Mohalla)", "पूरा पता (घर नं., गली, वार्ड / मोहल्ला):", c.address, 220);
    y += ROW_H;

    field(doc, M,        y, half, ROW_H, "Village / Town",      "ग्राम / नगर:",   c.village,      100);
    field(doc, M + half, y, half, ROW_H, "Police Station",      "थाना:",           c.policeStation, 85);
    y += ROW_H;

    field(doc, M,        y, half, ROW_H, "Post Office",         "डाकघर:",          c.postOffice,   85);
    field(doc, M + half, y, half, ROW_H, "District",            "जिला:",           c.district,     60);
    y += ROW_H;

    field(doc, M,        y, third,   ROW_H, "State",     "राज्य:",     c.state ?? "Jharkhand", 60);
    field(doc, M + third, y, W - third, ROW_H, "PIN Code", "पिन कोड:",   c.pin, 68);
    y += ROW_H;

    // ═══ C. AADHAAR ═══════════════════════════════════════════════════════════
    y = band(doc, "C.  AADHAAR NUMBER  /  आधार संख्या", M, y, W);

    const aH = 28;
    box(doc, M, y, W, aH);
    t(doc, "Aadhaar Number",  M + 3, y + 3,  { size: 5.5, color: GRAY });
    t(doc, "आधार नंबर:",      M + 3, y + 11, { size: 5,   color: LGRAY });
    aadhaar(doc, c.aadhaarNumber, M + 90, y + 5);
    y += aH;

    radio(doc, "BPL (Below Poverty Line)", "गरीबी रेखा से नीचे:",
      ["Yes", "No"], c.bpl, M, y, half, ROW_H);
    field(doc, M + half, y, half, ROW_H, "BPL Card Number", "बीपीएल कार्ड नंबर:", c.bplNumber, 110);
    y += ROW_H;

    // ═══ D. EDUCATION ═════════════════════════════════════════════════════════
    y = band(doc, "D.  EDUCATIONAL DETAILS  /  शैक्षणिक विवरण", M, y, W);

    field(doc, M,        y, third,   ROW_H, "Highest Qualification", "उच्चतम शैक्षणिक योग्यता:", c.education,     140);
    field(doc, M + third, y, W - third, ROW_H, "Year of Passing",   "उत्तीर्ण वर्ष:",            c.yearOfPassing, 90);
    y += ROW_H;

    // ═══ E. BANK DETAILS ══════════════════════════════════════════════════════
    y = band(doc, "E.  BANK DETAILS  /  बैंक विवरण", M, y, W);

    field(doc, M,        y, half, ROW_H, "Bank Account Number", "बैंक खाता नंबर:",  c.bankAccount, 120);
    field(doc, M + half, y, half, ROW_H, "Bank Name",           "बैंक का नाम:",     c.bankName,    80);
    y += ROW_H;

    field(doc, M,        y, half, ROW_H, "IFSC Code",    "आईएफएससी कोड:",  c.ifsc,      85);
    field(doc, M + half, y, half, ROW_H, "Branch Name",  "शाखा का नाम:",   c.bankBranch, 85);
    y += ROW_H;

    // ═══ F. DOCUMENTS ═════════════════════════════════════════════════════════
    y = band(doc, "F.  DOCUMENTS ATTACHED  /  संलग्न दस्तावेज", M, y, W);

    const docs = [
      { en: "Birth Certificate",         hi: "जन्म प्रमाण पत्र",       path: null as string | null | undefined },
      { en: "Caste Certificate",         hi: "जाति प्रमाण पत्र",       path: c.casteCertPath },
      { en: "Aadhaar Card",              hi: "आधार कार्ड",              path: c.aadhaarFrontPath },
      { en: "Education Certificate",     hi: "शैक्षणिक प्रमाण पत्र",   path: c.educationCertPath },
      { en: "Bank Passbook / Cheque",    hi: "बैंक पासबुक / चेक",       path: c.bankPassbookPath },
      { en: "Passport Size Photo",       hi: "पासपोर्ट साइज फोटो",     path: c.photoPath },
    ];

    const dColW = W / 2;
    let dIdx = 0;
    const dStartY = y;
    for (let i = 0; i < docs.length; i += 2) {
      const dY = dStartY + 3 + dIdx * 14;
      const chk1 = !!(docs[i]?.path && fs.existsSync(docs[i]!.path!));
      tick(doc, M + 5, dY, chk1, `${docs[i]!.en}  /  ${docs[i]!.hi}`);
      if (docs[i + 1]) {
        const chk2 = !!(docs[i + 1]?.path && fs.existsSync(docs[i + 1]!.path!));
        tick(doc, M + dColW + 5, dY, chk2, `${docs[i + 1]!.en}  /  ${docs[i + 1]!.hi}`);
      }
      dIdx++;
    }
    y = dStartY + 3 + Math.ceil(docs.length / 2) * 14 + 5;

    // ═══ G. DECLARATION ═══════════════════════════════════════════════════════
    y = band(doc, "G.  DECLARATION  /  घोषणा", M, y, W);

    const declH = 36;
    fill(doc, M, y, W, declH, "#F8FAFC");
    box(doc, M, y, W, declH, 0.6);
    t(doc, "I hereby declare that the information given above is true and correct to the best of my knowledge and belief.",
      M + 4, y + 5, { size: 6.5, color: "#374151", width: W - 8 });
    t(doc, "मैं घोषणा करता / करती हूँ कि उपरोक्त जानकारी मेरी जानकारी एवं विश्वास के अनुसार पूर्णतः सत्य है।",
      M + 4, y + 17, { size: 6.5, color: "#374151", width: W - 8 });
    y += declH;

    // Place / Date / Signature
    const sigH = 42;
    const col  = W / 3;
    fill(doc, M, y, W, sigH, "#FAFBFC");
    box(doc, M, y, W, sigH, 0.6);
    vLine(doc, M + col,     y, y + sigH, 0.4);
    vLine(doc, M + col * 2, y, y + sigH, 0.4);

    t(doc, "Place",  M + 3, y + 3, { size: 5.5, color: GRAY });
    t(doc, "स्थान:", M + 3, y + 11, { size: 5, color: LGRAY });
    if (c.area) {
      t(doc, c.area, M + 3, y + 22, { size: 8, bold: true, color: DARK, width: col - 6 });
    } else {
      doc.moveTo(M + 8, y + sigH - 6).lineTo(M + col - 6, y + sigH - 6)
        .strokeColor("#D1D5DB").lineWidth(0.4).stroke();
    }

    t(doc, "Date",    M + col + 3, y + 3,  { size: 5.5, color: GRAY });
    t(doc, "दिनांक:", M + col + 3, y + 11, { size: 5,   color: LGRAY });
    const dateStr = c.createdAt?.toLocaleDateString("en-IN") ?? "";
    if (dateStr) {
      t(doc, dateStr, M + col + 3, y + 22, { size: 8.5, bold: true, color: DARK });
    }

    t(doc, "Candidate Signature",    M + col * 2 + 3, y + 3,  { size: 5.5, color: GRAY });
    t(doc, "अभ्यर्थी के हस्ताक्षर:", M + col * 2 + 3, y + 11, { size: 5,   color: LGRAY });
    const sigDrawn = safeImg(doc, c.signaturePath, M + col * 2 + 3, y + 21, {
      width: col - 6, height: 16, fit: [col - 6, 16],
    });
    if (!sigDrawn) {
      doc.moveTo(M + col * 2 + 10, y + sigH - 6).lineTo(M + W - 10, y + sigH - 6)
        .strokeColor("#D1D5DB").lineWidth(0.4).stroke();
    }
    y += sigH;

    // Mobilizer row
    const mobH = 20;
    fill(doc, M, y, W, mobH, "#F8FAFC");
    box(doc, M, y, W, mobH, 0.6);
    t(doc, "Mobilizer Name",     M + 3, y + 3,  { size: 5.5, color: GRAY });
    t(doc, "मोबिलाइज़र का नाम:", M + 3, y + 11, { size: 5,   color: LGRAY });
    const mob = c.mobilizer ?? c.submittedBy;
    if (mob) {
      t(doc, mob, M + 120, y + 8, { size: 8.5, bold: true, color: DARK, width: W - 126 });
    }
    y += mobH;

    // Footer strip
    y += 4;
    fill(doc, M, y, W, 13, "#EFF6FF");
    doc.font("DVR").fontSize(5.5).fillColor("#64748B")
      .text(
        `ID: ${c.id}   Registered: ${c.createdAt?.toLocaleDateString("en-IN") ?? "—"}   Status: ${(c.status ?? "").toUpperCase()}   JSDMS / DDU-GKY Jharkhand`,
        M, y + 3, { width: W, align: "center", lineBreak: false },
      );

    // Outer border re-draw on top to cover any edge bleed
    doc.rect(M, M, W, A4_H - M * 2).strokeColor(NAVY).lineWidth(1).stroke();

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGES 2+ — Attached document images
    // ═══════════════════════════════════════════════════════════════════════════

    const attached = [
      { label: "Aadhaar Card – Front  /  आधार कार्ड (आगे)", path: c.aadhaarFrontPath },
      { label: "Aadhaar Card – Back  /  आधार कार्ड (पीछे)", path: c.aadhaarBackPath },
      { label: "Education Certificate  /  शैक्षणिक प्रमाण पत्र", path: c.educationCertPath },
      { label: "Bank Passbook  /  बैंक पासबुक", path: c.bankPassbookPath },
      { label: "Caste Certificate  /  जाति प्रमाण पत्र", path: c.casteCertPath },
    ];

    for (const { label, path: fp } of attached) {
      if (!fp || !fs.existsSync(fp)) continue;
      doc.addPage({ size: "A4", margin: 0 });

      fill(doc, 0, 0, A4_W, 44, NAVY);
      fill(doc, 0, 0, 4, 44, "#F59E0B");
      t(doc, label, 14, 8, { size: 11, bold: true, color: "#FFFFFF" });
      if (c.name) {
        t(doc, c.name, 0, 28, { size: 8, color: "rgba(255,255,255,0.7)", width: A4_W - 14, align: "right" });
      }

      const imgY = 52;
      safeImg(doc, fp, 0, imgY, {
        width: A4_W, height: A4_H - imgY - 14,
        fit: [A4_W, A4_H - imgY - 14],
        align: "center", valign: "center",
      });
    }

    doc.end();
  });
}
