import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import type { Candidate } from "@workspace/db";

// ─── Asset paths ──────────────────────────────────────────────────────────────
const FONTS_DIR   = path.resolve(__dirname, "fonts");
const FONT_NS_REG = path.join(FONTS_DIR, "NotoSansDevanagari-Regular.ttf");
const FONT_NS_BOL = path.join(FONTS_DIR, "NotoSansDevanagari-Bold.ttf");
const FONT_DV_REG = path.join(FONTS_DIR, "DejaVuSans-Regular.ttf");
const FONT_DV_BOL = path.join(FONTS_DIR, "DejaVuSans-Bold.ttf");
const LOGO_PATH   = path.join(FONTS_DIR, "jsdms_logo.jpeg");

type PDFDoc = InstanceType<typeof PDFDocument>;

// ─── Page constants ───────────────────────────────────────────────────────────
const A4_W  = 595.28;
const A4_H  = 841.89;
const ML    = 22;
const MT    = 12;
const INK   = "#111111";
const NAVY  = "#1A3560";
const AMBER = "#F59E0B";
const GRAY  = "#6B7280";
const DARK  = "#1a1a1a";
const LGRAY = "#999999";

// ─── Script detection ─────────────────────────────────────────────────────────
function isDevanagari(cp: number): boolean {
  return (cp >= 0x0900 && cp <= 0x097F) || (cp >= 0xA8E0 && cp <= 0xA8FF);
}

/**
 * A "neutral" character: ASCII but NOT a Latin letter.
 * Spaces, digits, punctuation (.,/-:–() etc.) attach to the current script
 * segment instead of creating a new one. This prevents "मेगा स्कील" from
 * fragmenting into ["मेगा", " ", "स्कील"] — it stays as one Devanagari run.
 */
function isNeutral(cp: number): boolean {
  if (cp > 0x007F) return false;           // non-ASCII = never neutral
  const c = String.fromCodePoint(cp);
  return !/[a-zA-Z]/.test(c);             // letters are NOT neutral
}

type Seg = { text: string; dev: boolean };

function splitScript(text: string): Seg[] {
  if (!text) return [];
  const out: Seg[] = [];
  let cur = "";
  let curDev: boolean | null = null;

  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;

    if (isNeutral(cp)) {
      // Attach to current segment (spaces, punctuation, digits)
      cur += ch;
    } else {
      const dev = isDevanagari(cp);
      if (curDev === null) {
        // First real character: initialize
        curDev = dev;
        cur += ch;
      } else if (dev !== curDev) {
        // Script boundary: flush current, start new
        if (cur.trim()) out.push({ text: cur, dev: curDev });
        else if (cur) {
          // leading neutrals: assign to incoming script
        }
        cur = ch;
        curDev = dev;
      } else {
        cur += ch;
      }
    }
  }

  if (cur.trim() && curDev !== null) out.push({ text: cur, dev: curDev });
  return out;
}

function fk(dev: boolean, bold: boolean): string {
  return dev ? (bold ? "NSB" : "NSR") : (bold ? "DVB" : "DVR");
}

// ─── Core text renderer ───────────────────────────────────────────────────────
interface TO {
  width?: number; size?: number; bold?: boolean;
  align?: "left" | "center" | "right"; color?: string;
}

/**
 * Render potentially mixed-script text.
 *
 * Left-aligned multi-segment → x-advancement (no `continued` across font switch).
 * Single-segment or center/right → single doc.text() call.
 */
function t(doc: PDFDoc, text: string, x: number, y: number, o: TO = {}) {
  const { size = 8, bold = false, align = "left", color = DARK, width } = o;
  const segs = splitScript(text);
  if (!segs.length) return;
  doc.fillColor(color);

  // ── Single segment: direct render ──
  if (segs.length === 1) {
    const s = segs[0]!;
    doc.font(fk(s.dev, bold)).fontSize(size)
       .text(s.text, x, y, { width, align, lineBreak: false });
    return;
  }

  // ── Left-aligned multi-segment: advance x per segment ──
  if (align === "left") {
    let cx = x;
    const maxX = width ? x + width : A4_W - ML;
    for (const s of segs) {
      if (cx >= maxX) break;
      doc.font(fk(s.dev, bold)).fontSize(size);
      const avail = maxX - cx;
      const sw = doc.widthOfString(s.text);
      doc.text(s.text, cx, y, { width: Math.min(avail, sw + 1), lineBreak: false });
      cx += Math.min(sw, avail);
    }
    return;
  }

  // ── Center / right multi-segment: use continued ──
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    const cont = i < segs.length - 1;
    doc.font(fk(s.dev, bold)).fontSize(size);
    if (i === 0) doc.text(s.text, x, y, { width, align, lineBreak: false, continued: cont });
    else         doc.text(s.text,       { lineBreak: false, continued: cont });
  }
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────
function hl(doc: PDFDoc, x1: number, y: number, x2: number, lw = 0.5, color = INK) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(lw).stroke();
}
function vl(doc: PDFDoc, x: number, y1: number, y2: number, lw = 0.5) {
  doc.moveTo(x, y1).lineTo(x, y2).strokeColor(LGRAY).lineWidth(lw).stroke();
}
function box(doc: PDFDoc, x: number, y: number, w: number, h: number, lw = 0.7, color = INK) {
  doc.rect(x, y, w, h).strokeColor(color).lineWidth(lw).stroke();
}
function fill(doc: PDFDoc, x: number, y: number, w: number, h: number, color: string) {
  doc.rect(x, y, w, h).fill(color);
}
function safeImg(doc: PDFDoc, fp: string | null | undefined,
  x: number, y: number, opts: Record<string, unknown>): boolean {
  if (!fp || !fs.existsSync(fp)) return false;
  try { doc.image(fp, x, y, opts); return true; }
  catch { return false; }
}
function safeImgBuf(doc: PDFDoc, buf: Buffer | null | undefined,
  x: number, y: number, opts: Record<string, unknown>): boolean {
  if (!buf || buf.length === 0) return false;
  try { doc.image(buf, x, y, opts); return true; }
  catch { return false; }
}

// ─── Form layout constants ────────────────────────────────────────────────────
const ROW = 20;     // standard row height
const UL  = 15;     // underline y-offset within row
const BH  = 13;     // section band height

/** Navy section band. Returns y below band. */
function band(doc: PDFDoc, label: string, x: number, y: number, w: number): number {
  fill(doc, x, y, w, BH, NAVY);
  fill(doc, x, y, 3, BH, AMBER);
  t(doc, label, x + 8, y + 3, { size: 7.5, bold: true, color: "#FFFFFF", width: w - 12 });
  return y + BH;
}

/**
 * Single underline-style field.
 *   label  – bilingual label (Hindi/English)
 *   value  – filled value or null/undefined
 *   lbW    – pts reserved for the label (underline starts here)
 *   totW   – total field width (underline ends here)
 */
function seg(
  doc: PDFDoc,
  label: string,
  value: string | null | undefined,
  x: number, y: number,
  lbW: number, totW: number,
) {
  t(doc, label, x, y + 2, { size: 7, color: GRAY, width: lbW - 1 });
  hl(doc, x + lbW, y + UL, x + totW, 0.45, LGRAY);
  if (value?.trim()) {
    t(doc, value.trim(), x + lbW + 2, y + 2,
      { size: 7.5, bold: false, color: DARK, width: totW - lbW - 4 });
  }
}

/** 12 Aadhaar digit boxes in three groups of four. */
function aadhaarBoxes(doc: PDFDoc, num: string | null | undefined, x: number, y: number) {
  const BW = 15; const BH2 = 14; const GAP = 2; const GRPGAP = 5;
  const digits = (num ?? "").replace(/\D/g, "").padEnd(12, "").split("");
  for (let i = 0; i < 12; i++) {
    const bx = x + i * (BW + GAP) + Math.floor(i / 4) * GRPGAP;
    box(doc, bx, y, BW, BH2, 0.5);
    if (digits[i] && digits[i] !== " ") {
      doc.font("DVR").fontSize(8.5).fillColor(DARK)
        .text(digits[i]!, bx, y + 2.5, { width: BW, align: "center", lineBreak: false });
    }
  }
}

/** Small checkbox + label for document list. */
function chk(doc: PDFDoc, x: number, y: number, checked: boolean, label: string) {
  const SZ = 8;
  box(doc, x, y + 1, SZ, SZ, 0.6);
  if (checked) {
    doc.font("DVB").fontSize(7).fillColor("#059669")
      .text("\u2713", x, y + 1.5, { width: SZ, align: "center", lineBreak: false });
  }
  t(doc, label, x + SZ + 3, y + 1, { size: 7.5, color: DARK, width: 220 });
}

// ─── Main PDF generator ───────────────────────────────────────────────────────
export type PdfReportOpts = {
  organization?: string | null;
  staffName?: string | null;
  reportDate?: string | null;
  /** Dynamic company branding (overrides hardcoded JSDMS header) */
  companyName?: string | null;
  companyNameHindi?: string | null;
  companyLogoPath?: string | null;
  /** Pre-fetched logo Buffer (from GCS) — takes priority over companyLogoPath */
  companyLogoBuffer?: Buffer | null;
  schemeName?: string | null;
};

export async function generateCandidatePdf(
  rawCandidate: Candidate,
  pdfPath: string,
  reportOpts?: PdfReportOpts,
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
    doc.registerFont("NSB", FONT_NS_BOL);
    doc.registerFont("DVR", FONT_DV_REG);
    doc.registerFont("DVB", FONT_DV_BOL);

    const ws = fs.createWriteStream(pdfPath);
    doc.pipe(ws);
    ws.on("error", reject);
    ws.on("finish", resolve);

    // Usable dimensions
    const CW = A4_W - ML * 2;   // 551.28 pt
    const FX = ML + 3;           // field left x
    const FW = CW - 6;           // field content width
    const FE = FX + FW;          // field right edge

    // ── Outer border ──────────────────────────────────────────────────────────
    box(doc, ML, MT, CW, A4_H - MT * 2, 1.0);

    // ══════════════════════════════════════════════════════════════════════════
    // PHOTO AREA  (top-right, no border box)
    // Reserved slot: 99 × 120 pt (≈ 3.5 × 4.5 cm passport portrait).
    // When a photo is captured from camera it is placed here directly.
    // ══════════════════════════════════════════════════════════════════════════
    const PW = 99; const PH = 120;
    const PX = ML + CW - PW; const PY = MT;

    // Inset the actual image by PP on every side so it never touches the border
    const PP  = 7;                    // ~2.5 mm padding on all four sides
    const imgX = PX + PP;
    const imgY = PY + PP;
    const imgW = PW - PP * 2;        // 85 pt
    const imgH = PH - PP * 2;        // 106 pt  (≈ 3.5 × 4.5 cm ratio at 72 dpi)

    const photoOk = safeImg(doc, c.photoPath, imgX, imgY,
      { width: imgW, height: imgH, cover: [imgW, imgH] });

    if (!photoOk) {
      // No photo yet — centred text label, no box or border
      const midY = PY + (PH - 18) / 2;
      doc.font("DVR").fontSize(7).fillColor(GRAY)
        .text("Passport Size Photo", PX, midY,      { width: PW, align: "center", lineBreak: false })
        .text("(3.5 x 4.5 cm)",      PX, midY + 10, { width: PW, align: "center", lineBreak: false });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LETTERHEAD  (English left | Logo centre | Hindi/company right)
    //
    // Layout (all left of photo box):
    //   ML+4 ──── colW ──── logoGap ── LGSZ ── logoGap ──── colW ──── PX
    // ══════════════════════════════════════════════════════════════════════════
    const HEADER_H = 72;                         // letterhead band height
    const LGSZ     = 66;                         // logo square (px)
    const HW       = PX - ML;                   // full width left of photo box
    const logoGap  = 8;                          // gap on each side of logo
    const colW     = (HW - LGSZ - logoGap * 2) / 2;  // equal column width
    const hX       = ML + 4;                    // English column left x
    const logoX    = ML + colW + logoGap;        // logo left x
    const rX       = logoX + LGSZ + logoGap;     // Hindi column left x
    const hY       = MT + 4;                    // top of text rows

    // Determine branding source: use company override if provided, else JSDMS defaults
    const brandName    = reportOpts?.companyName?.trim()      || "Jharkhand Skill Development Mission Society";
    const brandHindi   = reportOpts?.companyNameHindi?.trim() || "झारखण्ड कौशल विकास मिशन सोसाइटी";
    const brandScheme  = reportOpts?.schemeName?.trim()       || "DDU-KK";
    const brandLogoPath = reportOpts?.companyLogoPath         || LOGO_PATH;
    const brandLogoBuf  = reportOpts?.companyLogoBuffer ?? null;
    const isCustomBrand = !!(reportOpts?.companyName?.trim());

    // ── English left column ────────────────────────────────────────────────
    // Split brandName at midpoint for two lines if long
    const nameParts = brandName.split(/\s+/);
    const midIdx    = Math.ceil(nameParts.length / 2);
    const nameLine1 = nameParts.slice(0, midIdx).join(" ");
    const nameLine2 = nameParts.slice(midIdx).join(" ");
    doc.font("DVB").fontSize(8.5).fillColor(DARK)
       .text(nameLine1, hX, hY, { width: colW, align: "left", lineBreak: false });
    if (nameLine2) {
      doc.font("DVB").fontSize(8.5).fillColor(DARK)
         .text(nameLine2, hX, hY + 11, { width: colW, align: "left", lineBreak: false });
    }
    if (!isCustomBrand) {
      doc.font("DVR").fontSize(7).fillColor(DARK)
         .text("Labour, Employment & Skill Dev. Dept.",
               hX, hY + 23, { width: colW, lineBreak: false })
         .text("Government of Jharkhand",
               hX, hY + 33, { width: colW, lineBreak: false });
    } else {
      doc.font("DVR").fontSize(7).fillColor(DARK)
         .text(brandScheme,
               hX, hY + 23, { width: colW, lineBreak: false });
    }

    // ── Centre logo ────────────────────────────────────────────────────────
    const logoY = MT + (HEADER_H - LGSZ) / 2;          // vertically centred
    const logoLoaded =
      safeImgBuf(doc, brandLogoBuf, logoX, logoY, { width: LGSZ, height: LGSZ, fit: [LGSZ, LGSZ] }) ||
      safeImg(doc, brandLogoPath, logoX, logoY, { width: LGSZ, height: LGSZ, fit: [LGSZ, LGSZ] });
    if (!logoLoaded) {
      const cx2 = logoX + LGSZ / 2; const cy2 = logoY + LGSZ / 2;
      doc.circle(cx2, cy2, 28).strokeColor(INK).lineWidth(0.8).stroke();
      doc.circle(cx2, cy2, 20).strokeColor(INK).lineWidth(0.4).stroke();
      doc.circle(cx2, cy2,  4).fill(INK);
      // Show abbreviated org name in the logo placeholder
      const abbr = brandName.split(/\s+/).map((w: string) => w[0]).join("").slice(0, 6);
      doc.font("DVB").fontSize(6).fillColor(DARK)
         .text(abbr, cx2 - 14, cy2 - 4, { width: 28, align: "center", lineBreak: false });
    }

    // ── Right column (Hindi brand name) ─────────────────────────────────────
    const hindiParts = brandHindi.split(/\s+/);
    const hMidIdx    = Math.ceil(hindiParts.length / 2);
    const hindiLine1 = hindiParts.slice(0, hMidIdx).join(" ");
    const hindiLine2 = hindiParts.slice(hMidIdx).join(" ");
    doc.font("NSB").fontSize(8.5).fillColor(DARK)
       .text(hindiLine1, rX, hY, { width: colW, align: "right", lineBreak: false });
    if (hindiLine2) {
      doc.font("NSB").fontSize(8.5).fillColor(DARK)
         .text(hindiLine2, rX, hY + 11, { width: colW, align: "right", lineBreak: false });
    }
    if (!isCustomBrand) {
      doc.font("NSR").fontSize(7).fillColor(DARK)
         .text("श्रम, नियोजन एवं कौशल विकास विभाग",
               rX, hY + 23, { width: colW, align: "right", lineBreak: false })
         .text("झारखण्ड सरकार",
               rX, hY + 33, { width: colW, align: "right", lineBreak: false });
    }
    // (Training Centre ID row removed from header — now shown below header)

    // Header bottom (no divider line — keep title area clean)
    const sepY = MT + HEADER_H;

    // ── Optional report context strip ─────────────────────────────────────
    let reportStripH = 0;
    const rOrg  = reportOpts?.organization?.trim() || c.skillCentreName?.trim() || null;
    const rStaff = reportOpts?.staffName?.trim() || null;
    const rDate  = reportOpts?.reportDate?.trim() || null;
    if (rOrg || rStaff || rDate) {
      const stripY = sepY;
      reportStripH = 18;
      // Light navy band
      fill(doc, ML, stripY, CW, reportStripH, NAVY + "12");
      fill(doc, ML, stripY, 3, reportStripH, AMBER);
      const contentParts: string[] = [];
      if (rOrg)   contentParts.push(rOrg);
      if (rStaff) contentParts.push(`Staff: ${rStaff}`);
      if (rDate)  contentParts.push(`Date: ${rDate}`);
      const stripText = contentParts.join("   |   ");
      t(doc, stripText, ML + 6, stripY + 5,
        { size: 7, color: NAVY, width: CW - 12, align: "center" });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TITLE AREA  (left of photo box)
    // ══════════════════════════════════════════════════════════════════════════
    let y = sepY + reportStripH + 6;
    const TW = PX - ML;   // title area width

    // Title: company scheme name (Hindi if JSDMS, English if custom brand)
    if (!isCustomBrand) {
      // "मेगा स्कील सेंटर" — pure Devanagari (anusvara form), centered bold
      doc.font("NSB").fontSize(20).fillColor(DARK)
         .text("मेगा स्कील सेंटर", ML, y, { width: TW, align: "center", lineBreak: false });
      y += 26;
      // DDU-KK English line
      doc.font("DVB").fontSize(8).fillColor(DARK)
         .text("DEEN DAYAL UPADHYAY KAUSHAL KENDRA  (DDU-KK)",
               ML, y, { width: TW, align: "center", lineBreak: false });
      y += 11;
    } else {
      // Custom company: show scheme name prominently
      doc.font("DVB").fontSize(16).fillColor(DARK)
         .text(brandScheme, ML, y, { width: TW, align: "center", lineBreak: false });
      y += 22;
    }

    // Bordered form title box
    const formTitleW = 238; const formTitleX = ML + (TW - formTitleW) / 2;
    box(doc, formTitleX, y, formTitleW, 14, 0.9);
    doc.font("DVB").fontSize(8.5).fillColor(DARK)
       .text("STUDENT / CANDIDATE REGISTRATION FORM",
             formTitleX, y + 2.5, { width: formTitleW, align: "center", lineBreak: false });
    y += 18;

    // ── Training Centre Name + Training Centre ID (same row) ──────────────
    hl(doc, ML, y, ML + CW, 0.7);
    y += 4;

    // Left half: Training Centre Name
    const tcnLblW = 122;                          // label width
    const halfW   = Math.floor(FW * 0.56);        // name value takes 56 % of row
    doc.font("DVB").fontSize(8).fillColor(INK)
       .text("Training Centre Name :", FX, y + 2, { width: tcnLblW, lineBreak: false });
    if (c.skillCentreName?.trim()) {
      t(doc, c.skillCentreName.trim(), FX + tcnLblW + 2, y + 2,
        { size: 7.5, color: DARK, width: halfW - tcnLblW - 2 });
    } else {
      hl(doc, FX + tcnLblW + 2, y + UL, FX + halfW, 0.4, LGRAY);
    }

    // Right half: Training Centre ID
    const tciX    = FX + halfW + 8;              // ID label starts here
    const tciLblW = 104;                          // "Training Centre ID :" label
    doc.font("DVB").fontSize(8).fillColor(INK)
       .text("Training Centre ID :", tciX, y + 2, { width: tciLblW, lineBreak: false });
    hl(doc, tciX + tciLblW + 2, y + UL, FE, 0.4, LGRAY);

    y += ROW - 2;
    hl(doc, ML, y, ML + CW, 0.9);
    y += 2;

    // ══════════════════════════════════════════════════════════════════════════
    // A — PERSONAL DETAILS
    // ══════════════════════════════════════════════════════════════════════════
    y = band(doc, "A.  PERSONAL DETAILS  /  व्यक्तिगत विवरण", ML, y, CW);

    // A1 — Course Name + Candidate ID boxes
    const csW = FW * 0.53;
    seg(doc, "कोर्स का नाम / Course Name", c.course, FX, y, 110, csW);

    const cidX = FX + csW + 5;
    doc.font("DVR").fontSize(7.5).fillColor(GRAY)
       .text("Candidate ID", cidX, y + 2, { lineBreak: false });
    let bx = cidX + 66;
    const cidCode = (c.candidateIdCode ?? "").substring(0, 10).padEnd(10, " ");
    for (let i = 0; i < 10; i++) {
      if (bx + 16 > FE) break;
      box(doc, bx, y + 1, 16, 13, 0.5);
      const ch2 = cidCode[i];
      if (ch2 && ch2 !== " ") {
        doc.font("DVR").fontSize(7.5).fillColor(DARK)
           .text(ch2, bx, y + 3.5, { width: 16, align: "center", lineBreak: false });
      }
      bx += 18;
    }
    y += ROW;

    // A2 — Name
    seg(doc, "नाम / Name", c.name, FX, y, 46, FW);
    y += ROW;

    // A3 — Father/Husband + Mobile
    const fhW = FW * 0.63;
    seg(doc, "पिता / पति का नाम / Father's / Husband Name", c.fatherName, FX, y, 150, fhW);
    seg(doc, "मोबाइल / Mobile", c.phone, FX + fhW + 4, y, 90, FW - fhW - 4);
    y += ROW;

    // A4 — Mother's Name + Parent's Mobile
    const mnW = FW * 0.55;
    seg(doc, "माता का नाम / Mother's Name", c.motherName, FX, y, 116, mnW);
    seg(doc, "Parent's Mobile / अभिभावक का मोबाइल", c.parentMobile, FX + mnW + 4, y, 140, FW - mnW - 4);
    y += ROW;

    // A5 — Marital Status
    seg(doc, "वैवाहिक स्थिति / Marital Status", c.maritalStatus, FX, y, 130, FW);
    y += ROW;

    // A6 — Sex + DOB (wider DOB field)
    const sxW = FW * 0.28;
    seg(doc, "लिंग / Sex", c.gender, FX, y, 50, sxW);
    seg(doc, "जन्म तिथि / Date of Birth  (On or before 01-01-2004)",
      c.dob, FX + sxW + 5, y, 190, FW - sxW - 5);
    y += ROW;

    // A7 — Religion + Category
    const rlW = FW * 0.32;
    seg(doc, "धर्म / Religion", c.religion, FX, y, 70, rlW);
    seg(doc, "जाति / Category  (Gen / SC / ST / OBC / BCI / BCII / Minority)",
      c.caste, FX + rlW + 5, y, 178, FW - rlW - 5);
    y += ROW;

    // A8 — PwD + Disability Type
    const pdW = FW * 0.35;
    seg(doc, "दिव्यांग / PwD", c.pwd, FX, y, 70, pdW);
    seg(doc, "दिव्यांगता का प्रकार / Disability Type", c.disabilityType,
      FX + pdW + 5, y, 145, FW - pdW - 5);
    y += ROW + 2;

    // ══════════════════════════════════════════════════════════════════════════
    // B — ADDRESS
    // ══════════════════════════════════════════════════════════════════════════
    y = band(doc, "B.  ADDRESS  /  पता", ML, y, CW);

    // B1 — Address/Mohalla + Village/Town
    const adW = FW * 0.57;
    seg(doc, "पता / मोहल्ला / Address / Mohalla / Area", c.address, FX, y, 115, adW);
    seg(doc, "गाँव / शहर / Village / Town", c.village, FX + adW + 5, y, 90, FW - adW - 5);
    y += ROW;

    // B2 — Police Station + Post Office
    const psW2 = FW * 0.48;
    seg(doc, "थाना / Police Station", c.policeStation, FX, y, 90, psW2);
    seg(doc, "डाकघर / Post Office", c.postOffice, FX + psW2 + 5, y, 82, FW - psW2 - 5);
    y += ROW;

    // B3 — District + State + Pin
    const dW = FW * 0.36; const stW = FW * 0.36;
    seg(doc, "जिला / District", c.district, FX, y, 66, dW);
    seg(doc, "राज्य / State", c.state ?? "Jharkhand", FX + dW + 5, y, 56, stW);
    seg(doc, "पिन / Pin", c.pin, FX + dW + stW + 10, y, 38, FW - dW - stW - 10);
    y += ROW;

    // B4 — Mobile + Email
    const mbW = FW * 0.44;
    seg(doc, "मोबाइल / Mobile No.", c.phone, FX, y, 94, mbW);
    seg(doc, "ई-मेल / E-mail", c.email, FX + mbW + 5, y, 60, FW - mbW - 5);
    y += ROW + 2;

    // ══════════════════════════════════════════════════════════════════════════
    // C — AADHAAR & IDENTITY
    // ══════════════════════════════════════════════════════════════════════════
    y = band(doc, "C.  AADHAAR & IDENTITY  /  आधार एवं पहचान", ML, y, CW);

    // C1 — Aadhaar boxes
    t(doc, "आधार नं. / Aadhaar No.", FX, y + 2,
      { size: 7.5, color: GRAY, width: 106 });
    aadhaarBoxes(doc, c.aadhaarNumber, FX + 108, y + 2);
    y += ROW;

    // C2 — BPL + BPL No.
    const bpW = FW * 0.45;
    seg(doc, "बी.पी.एल. / BPL  (हाँ / Yes  या  नहीं / No)", c.bpl, FX, y, 152, bpW);
    seg(doc, "यदि हाँ, तो बी.पी.एल. सं. / BPL No.", c.bplNumber,
      FX + bpW + 5, y, 145, FW - bpW - 5);
    y += ROW + 2;

    // ══════════════════════════════════════════════════════════════════════════
    // D — EDUCATION
    // ══════════════════════════════════════════════════════════════════════════
    y = band(doc, "D.  EDUCATIONAL DETAILS  /  शैक्षणिक विवरण", ML, y, CW);

    const edW = FW * 0.57;
    seg(doc, "सर्वोच्च शैक्षिक योग्यता / Highest Qualification", c.education,
      FX, y, 178, edW);
    seg(doc, "उत्तीर्ण वर्ष / Year of Passing", c.yearOfPassing,
      FX + edW + 5, y, 132, FW - edW - 5);
    y += ROW + 2;

    // ══════════════════════════════════════════════════════════════════════════
    // E — BANK DETAILS
    // ══════════════════════════════════════════════════════════════════════════
    y = band(doc, "E.  BANK DETAILS  /  बैंक विवरण", ML, y, CW);

    const acW = FW * 0.50;
    seg(doc, "खाता नं. / A/C No.", c.bankAccount, FX, y, 80, acW);
    seg(doc, "बैंक का नाम / Bank Name", c.bankName, FX + acW + 5, y, 90, FW - acW - 5);
    y += ROW;

    seg(doc, "IFSC Code", c.ifsc, FX, y, 56, acW);
    seg(doc, "शाखा / Branch Name", c.bankBranch, FX + acW + 5, y, 82, FW - acW - 5);
    y += ROW + 2;

    // ══════════════════════════════════════════════════════════════════════════
    // F — DOCUMENTS ATTACHED
    // ══════════════════════════════════════════════════════════════════════════
    y = band(doc, "F.  DOCUMENTS ATTACHED  /  संलग्न दस्तावेज", ML, y, CW);

    const docs = [
      { n: "1", lbl: "जन्म प्रमाण पत्र / Birth Certificate",       chk: false },
      { n: "2", lbl: "जाति प्रमाण पत्र / Caste Certificate",        chk: !!(c.casteCertPath && fs.existsSync(c.casteCertPath!)) },
      { n: "3", lbl: "आधार कार्ड / Aadhaar Card",                   chk: !!(c.aadhaarFrontPath && fs.existsSync(c.aadhaarFrontPath!)) },
      { n: "4", lbl: "शैक्षिक प्रमाण पत्र / Education Certificate", chk: !!(c.educationCertPath && fs.existsSync(c.educationCertPath!)) },
      { n: "5", lbl: "बैंक पासबुक / Bank Passbook",                 chk: !!(c.bankPassbookPath && fs.existsSync(c.bankPassbookPath!)) },
      { n: "6", lbl: "पासपोर्ट फोटो / Passport Photo",              chk: !!(c.photoPath && fs.existsSync(c.photoPath!)) },
    ];

    const hf = FW / 2;
    for (let i = 0; i < docs.length; i += 2) {
      const dy = y + Math.floor(i / 2) * 16 + 3;
      chk(doc, FX + 3,    dy, docs[i]!.chk,  `${docs[i]!.n}. ${docs[i]!.lbl}`);
      if (docs[i + 1]) {
        chk(doc, FX + hf + 3, dy, docs[i + 1]!.chk, `${docs[i + 1]!.n}. ${docs[i + 1]!.lbl}`);
        vl(doc, FX + hf, dy - 1, dy + 14);
      }
    }
    y += Math.ceil(docs.length / 2) * 16 + 5;

    // Aadhaar images intentionally excluded from PDF for privacy

    // ══════════════════════════════════════════════════════════════════════════
    // G — DECLARATION & SIGNATURE
    // ══════════════════════════════════════════════════════════════════════════
    y = band(doc, "G.  DECLARATION  /  घोषणा", ML, y, CW);

    // Declaration text box
    const declH = 28;
    fill(doc, ML, y, CW, declH, "#F8FAFC");
    box(doc, ML, y, CW, declH, 0.5, "#CBD5E1");

    // English line — pure Latin, single font
    doc.font("DVR").fontSize(7).fillColor("#374151")
       .text(
         "I hereby declare that all the above information is true and correct to the best of my knowledge and belief.",
         FX, y + 4, { width: FW, lineBreak: false },
       );
    // Hindi line — pure Devanagari, single font
    doc.font("NSR").fontSize(7).fillColor("#374151")
       .text(
         "मैं घोषणा करता / करती हूँ कि ऊपर दी गई सभी जानकारी मेरी जानकारी और विश्वास के अनुसार पूर्णतः सत्य है।",
         FX, y + 15, { width: FW, lineBreak: false },
       );
    y += declH + 5;

    // Date / Place / Signature
    const dateStr = c.createdAt?.toLocaleDateString("en-IN") ?? "";

    // Date field
    doc.font("DVB").fontSize(7.5).fillColor(INK)
       .text("Date :", FX, y + 2, { width: 30, lineBreak: false });
    hl(doc, FX + 33, y + UL, FX + 110, 0.4, LGRAY);
    if (dateStr) {
      doc.font("DVB").fontSize(8).fillColor(DARK)
         .text(dateStr, FX + 35, y + 2, { width: 73, lineBreak: false });
    }

    // Place field
    doc.font("DVB").fontSize(7.5).fillColor(INK)
       .text("Place :", FX + 116, y + 2, { width: 32, lineBreak: false });
    hl(doc, FX + 150, y + UL, FX + 310, 0.4, LGRAY);
    if (c.area) {
      t(doc, c.area, FX + 152, y + 2, { size: 7.5, color: DARK, width: 155 });
    }

    // Signature area (right side)
    const sigX = FX + 318;
    const sigW = FE - sigX;
    doc.font("DVR").fontSize(7.5).fillColor(INK)
       .text("Signature of Applicant :", sigX, y + 2, { width: sigW, align: "center", lineBreak: false });
    const sigOk = safeImg(doc, c.signaturePath, sigX + 10, y + 12,
      { width: sigW - 20, height: 22, fit: [sigW - 20, 22] });
    if (!sigOk) {
      hl(doc, sigX + 5, y + 33, sigX + sigW - 5, 0.4, LGRAY);
    }
    y += 40;

    // Mobilizer Name
    doc.font("DVB").fontSize(7.5).fillColor(INK)
       .text("Mobilizer Name :", FX, y + 2, { width: 88, lineBreak: false });
    const mobVal = (c.mobilizer ?? c.submittedBy ?? "").toString();
    if (mobVal) {
      t(doc, mobVal, FX + 90, y + 2, { size: 7.5, bold: false, color: DARK, width: FW - 93 });
    }
    // Dotted underline across the mobilizer field
    for (let dx = FX + 90; dx < FE; dx += 5) {
      doc.moveTo(dx, y + UL).lineTo(Math.min(dx + 3, FE), y + UL)
         .strokeColor(LGRAY).lineWidth(0.45).stroke();
    }
    y += 20;

    // ── Centered footer strip ────────────────────────────────────────────────
    hl(doc, ML, y, ML + CW, 0.5, LGRAY);
    y += 6;
    doc.font("DVR").fontSize(6).fillColor(GRAY)
       .text(
         `Registration ID: ${c.id}   |   Status: ${(c.status ?? "Pending").toUpperCase()}   |   JSDMS / DDU-KK Jharkhand`,
         ML, y, { width: CW, align: "center", lineBreak: false },
       );

    // Re-draw outer border over any paint bleed
    box(doc, ML, MT, CW, A4_H - MT * 2, 1.0);

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 2 — Aadhaar combined page (front + back on same A4 sheet)
    // ══════════════════════════════════════════════════════════════════════════
    const hasFront = !!(c.aadhaarFrontPath && fs.existsSync(c.aadhaarFrontPath!));
    const hasBack  = !!(c.aadhaarBackPath  && fs.existsSync(c.aadhaarBackPath!));

    if (hasFront || hasBack) {
      doc.addPage({ size: "A4", margin: 0 });

      // Header — same navy style as other document pages
      fill(doc, 0, 0, A4_W, 44, NAVY);
      fill(doc, 0, 0, 4,    44, AMBER);

      // Title (mixed Hindi + English)
      const aadhaarTitle = "Aadhaar Card  /  आधार कार्ड";
      const aadhaarSegs  = splitScript(aadhaarTitle);
      if (aadhaarSegs.length === 1) {
        doc.font(fk(aadhaarSegs[0]!.dev, true)).fontSize(11).fillColor("#FFFFFF")
           .text(aadhaarSegs[0]!.text, 14, 10, { lineBreak: false });
      } else {
        let lx = 14;
        for (const s of aadhaarSegs) {
          doc.font(fk(s.dev, true)).fontSize(11).fillColor("#FFFFFF");
          const sw = doc.widthOfString(s.text);
          doc.text(s.text, lx, 10, { lineBreak: false });
          lx += sw;
        }
      }

      // Candidate name (top-right, faded)
      if (c.name) {
        doc.font("NSR").fontSize(8).fillColor("rgba(255,255,255,0.65)")
           .text(c.name, 0, 30, { width: A4_W - 14, align: "right", lineBreak: false });
      }

      // Layout: split usable area below header into two equal halves
      const PAD    = 20;
      const imgW   = A4_W - PAD * 2;
      const startY = 52;
      const totalH = A4_H - startY - PAD;
      const halfH  = Math.floor(totalH / 2) - 6;

      // ── Front (top half) ──
      doc.font("DVB").fontSize(8).fillColor(NAVY)
         .text("FRONT  /  आगे", PAD, startY + 4, { lineBreak: false });
      if (hasFront) {
        box(doc, PAD, startY + 16, imgW, halfH - 20, 0.5, LGRAY);
        safeImg(doc, c.aadhaarFrontPath!, PAD + 4, startY + 20, {
          width: imgW - 8, height: halfH - 28,
          fit: [imgW - 8, halfH - 28], align: "center", valign: "center",
        });
      }

      // ── Divider ──
      const midY = startY + halfH + 4;
      hl(doc, PAD, midY, A4_W - PAD, 1.0, LGRAY);

      // ── Back (bottom half) ──
      doc.font("DVB").fontSize(8).fillColor(NAVY)
         .text("BACK  /  पीछे", PAD, midY + 6, { lineBreak: false });
      if (hasBack) {
        box(doc, PAD, midY + 18, imgW, halfH - 20, 0.5, LGRAY);
        safeImg(doc, c.aadhaarBackPath!, PAD + 4, midY + 22, {
          width: imgW - 8, height: halfH - 28,
          fit: [imgW - 8, halfH - 28], align: "center", valign: "center",
        });
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 3+ — Other attached document images
    // ══════════════════════════════════════════════════════════════════════════
    const attached: Array<{ label: string; path: string | null | undefined }> = [
      { label: "Education Certificate  /  शैक्षिक प्रमाण पत्र",   path: c.educationCertPath },
      { label: "Bank Passbook  /  बैंक पासबुक",                    path: c.bankPassbookPath  },
      { label: "Caste Certificate  /  जाति प्रमाण पत्र",           path: c.casteCertPath     },
    ];

    for (const item of attached) {
      if (!item.path || !fs.existsSync(item.path)) continue;
      doc.addPage({ size: "A4", margin: 0 });
      fill(doc, 0, 0, A4_W, 44, NAVY);
      fill(doc, 0, 0, 4,    44, AMBER);
      // Label: split script to handle mixed Hindi/English correctly
      const lblSegs = splitScript(item.label);
      if (lblSegs.length === 1) {
        doc.font(fk(lblSegs[0]!.dev, true)).fontSize(11).fillColor("#FFFFFF")
           .text(lblSegs[0]!.text, 14, 10, { lineBreak: false });
      } else {
        let lx = 14;
        for (const s of lblSegs) {
          doc.font(fk(s.dev, true)).fontSize(11).fillColor("#FFFFFF");
          const sw = doc.widthOfString(s.text);
          doc.text(s.text, lx, 10, { lineBreak: false });
          lx += sw;
        }
      }
      if (c.name) {
        doc.font("NSR").fontSize(8).fillColor("rgba(255,255,255,0.65)")
           .text(c.name, 0, 30, { width: A4_W - 14, align: "right", lineBreak: false });
      }
      safeImg(doc, item.path, 0, 52, {
        width: A4_W, height: A4_H - 60,
        fit: [A4_W, A4_H - 60], align: "center", valign: "center",
      });
    }

    doc.end();
  });
}
