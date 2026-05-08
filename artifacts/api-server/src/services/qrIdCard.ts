/**
 * QR ID Card PDF Generator
 *
 * Generates an A4 PDF with 4 ID cards per page (CR80 / Aadhaar / ATM card size: 85.6 × 54 mm).
 * Each card shows:
 *   - Company logo (if available)
 *   - Staff photo (reference selfie, if available)
 *   - Name, Emp Code, Role, Center
 *   - QR code (payload: "<staffId>:<hmac32>")
 *
 * Layout: 2 columns × 2 rows on A4, ~10 mm margins.
 */

import path from "path";
import crypto from "node:crypto";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

// ─── Constants ─────────────────────────────────────────────────────────────────

// When bundled (dist/), fonts are copied alongside. When in src/, they're in src/fonts/.
const FONTS_DIR = path.resolve(__dirname, "fonts");
const FONT_BOLD = path.join(FONTS_DIR, "DejaVuSans-Bold.ttf");
const FONT_REG  = path.join(FONTS_DIR, "DejaVuSans-Regular.ttf");

// A4 in points (72 pt/in)
const A4_W = 595.28;
const A4_H = 841.89;

// CR80 card: 85.6mm × 54mm → points (1 mm = 2.8346 pt)
const MM = 2.8346;
const CARD_W = Math.round(85.6 * MM); // ≈ 243 pt
const CARD_H = Math.round(54 * MM);   // ≈ 153 pt

// Margins and gaps
const PAGE_MARGIN_X = Math.round(15 * MM); // ~42 pt
const PAGE_MARGIN_Y = Math.round(20 * MM); // ~57 pt
const GAP_X = Math.round(10 * MM);
const GAP_Y = Math.round(12 * MM);

// Card colours
const NAVY  = "#1A3560";
const AMBER = "#F59E0B";
const WHITE = "#FFFFFF";
const LGRAY = "#F3F4F6";

// ─── HMAC token (same as qr-attendance route) ──────────────────────────────────

function makeQrToken(staffId: string): string {
  const secret = process.env.SESSION_SECRET ?? "scms-qr-secret";
  return crypto.createHmac("sha256", secret).update(staffId).digest("hex").slice(0, 32);
}

export function makeQrPayload(staffId: string): string {
  return `${staffId}:${makeQrToken(staffId)}`;
}

// ─── Generate QR PNG buffer ───────────────────────────────────────────────────

async function qrPng(payload: string, sizePx: number): Promise<Buffer> {
  return await QRCode.toBuffer(payload, {
    type: "png",
    width: sizePx,
    margin: 1,
    color: { dark: "#000000", light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  });
}

// ─── Draw one card ────────────────────────────────────────────────────────────

async function drawCard(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  card: {
    name: string;
    empCode: string;
    role: string | null;
    centerName: string | null;
    companyName: string | null;
    staffId: string;
    photoBuffer: Buffer | null;
  },
) {
  const qrPayload = makeQrPayload(card.staffId);
  const QR_SIZE = 80; // px; will be rendered at ~56pt in the card
  const qrBuf = await qrPng(qrPayload, QR_SIZE * 3); // 3× for sharpness

  const cardX = x;
  const cardY = y;
  const cw = CARD_W;
  const ch = CARD_H;

  // ── Card background ──────────────────────────────────────────────────────
  doc.save();
  doc.roundedRect(cardX, cardY, cw, ch, 6).fillColor(WHITE).fill();

  // Header strip (navy)
  const headerH = 28;
  doc.roundedRect(cardX, cardY, cw, headerH, 6).fillColor(NAVY).fill();
  // mask bottom corners of header
  doc.rect(cardX, cardY + headerH - 6, cw, 6).fillColor(NAVY).fill();

  // Amber accent bar below header
  const accentH = 3;
  doc.rect(cardX, cardY + headerH, cw, accentH).fillColor(AMBER).fill();

  // ── Company / scheme name in header ─────────────────────────────────────
  const headerLabel = card.companyName ?? "SCMS";
  doc.font(FONT_BOLD).fontSize(7).fillColor(WHITE);
  doc.text(headerLabel.toUpperCase(), cardX + 6, cardY + 7, {
    width: cw - 12,
    ellipsis: true,
    lineBreak: false,
  });

  // "GROUND STAFF ID" sub-label
  doc.font(FONT_REG).fontSize(5).fillColor(AMBER);
  doc.text("GROUND STAFF IDENTITY CARD", cardX + 6, cardY + 17, {
    width: cw - 12,
    lineBreak: false,
  });

  // ── Photo placeholder / photo ────────────────────────────────────────────
  const photoX = cardX + 6;
  const photoY = cardY + headerH + accentH + 6;
  const photoW = 44;
  const photoH = 52;

  if (card.photoBuffer) {
    doc.save();
    doc.roundedRect(photoX, photoY, photoW, photoH, 3).clip();
    doc.image(card.photoBuffer, photoX, photoY, { width: photoW, height: photoH });
    doc.restore();
  } else {
    doc.roundedRect(photoX, photoY, photoW, photoH, 3).fillColor(LGRAY).fill();
    doc.font(FONT_BOLD).fontSize(16).fillColor("#9CA3AF");
    const initial = (card.name.trim()[0] ?? "?").toUpperCase();
    doc.text(initial, photoX, photoY + photoH / 2 - 10, {
      width: photoW,
      align: "center",
      lineBreak: false,
    });
  }

  // ── Text area (right of photo) ───────────────────────────────────────────
  const textX = photoX + photoW + 7;
  const textY = cardY + headerH + accentH + 6;
  const textW = cw - photoW - 6 - 7 - QR_SIZE / 3 - 6;

  // Name
  doc.font(FONT_BOLD).fontSize(8.5).fillColor(NAVY);
  const nameParts = card.name.trim().split(" ");
  const nameDisplay = nameParts.length > 2
    ? nameParts.slice(0, 2).join(" ") + "\n" + nameParts.slice(2).join(" ")
    : card.name.trim();
  doc.text(nameDisplay, textX, textY, { width: textW, lineBreak: true });

  let lineY = textY + (nameParts.length > 2 ? 20 : 12);

  // Emp Code
  doc.font(FONT_REG).fontSize(6.5).fillColor("#374151");
  doc.text(`ID: ${card.empCode}`, textX, lineY, { width: textW, lineBreak: false });
  lineY += 10;

  // Role
  if (card.role) {
    doc.font(FONT_REG).fontSize(6).fillColor("#6B7280");
    doc.text(card.role, textX, lineY, { width: textW, lineBreak: false, ellipsis: true });
    lineY += 9;
  }

  // Center
  if (card.centerName) {
    doc.font(FONT_REG).fontSize(6).fillColor("#6B7280");
    doc.text(card.centerName, textX, lineY, { width: textW, lineBreak: false, ellipsis: true });
  }

  // ── QR code (right side of card) ────────────────────────────────────────
  const qrPtSize = 56;
  const qrX = cardX + cw - qrPtSize - 5;
  const qrY = cardY + headerH + accentH + 6;
  doc.image(qrBuf, qrX, qrY, { width: qrPtSize, height: qrPtSize });
  doc.font(FONT_REG).fontSize(4.5).fillColor("#9CA3AF");
  doc.text("SCAN TO MARK ATTENDANCE", qrX - 2, qrY + qrPtSize + 2, { width: qrPtSize + 4, align: "center", lineBreak: false });

  // ── Bottom footer strip ──────────────────────────────────────────────────
  const footerY = cardY + ch - 14;
  doc.rect(cardX, footerY, cw, 14).fillColor(LGRAY).fill();
  doc.font(FONT_REG).fontSize(5).fillColor("#6B7280");
  const footerText = "This card is the property of the issuing organization. If found, please return.";
  doc.text(footerText, cardX + 6, footerY + 4, { width: cw - 12, lineBreak: false, ellipsis: true });

  // ── Card border ──────────────────────────────────────────────────────────
  doc.roundedRect(cardX, cardY, cw, ch, 6).strokeColor("#D1D5DB").lineWidth(0.5).stroke();

  // Cut marks (dashed lines around card)
  const dash = [3, 2] as [number, number];
  const mk = 5;
  doc.save();
  doc.dash(dash[0], { space: dash[1] }).strokeColor("#CBD5E1").lineWidth(0.3);
  // top-left
  doc.moveTo(cardX - mk, cardY).lineTo(cardX, cardY).stroke();
  doc.moveTo(cardX, cardY - mk).lineTo(cardX, cardY).stroke();
  // top-right
  doc.moveTo(cardX + cw, cardY).lineTo(cardX + cw + mk, cardY).stroke();
  doc.moveTo(cardX + cw, cardY - mk).lineTo(cardX + cw, cardY).stroke();
  // bottom-left
  doc.moveTo(cardX - mk, cardY + ch).lineTo(cardX, cardY + ch).stroke();
  doc.moveTo(cardX, cardY + ch).lineTo(cardX, cardY + ch + mk).stroke();
  // bottom-right
  doc.moveTo(cardX + cw, cardY + ch).lineTo(cardX + cw + mk, cardY + ch).stroke();
  doc.moveTo(cardX + cw, cardY + ch).lineTo(cardX + cw, cardY + ch + mk).stroke();
  doc.undash();
  doc.restore();

  doc.restore();
}

// ─── Public: generate PDF buffer ─────────────────────────────────────────────

export type IdCardStaff = {
  staffId: string;
  name: string;
  empCode: string;
  role: string | null;
  centerName: string | null;
  companyName: string | null;
  photoBuffer: Buffer | null;
};

export async function generateIdCardsPdf(staffList: IdCardStaff[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: PAGE_MARGIN_Y, bottom: PAGE_MARGIN_Y, left: PAGE_MARGIN_X, right: PAGE_MARGIN_X },
      autoFirstPage: false,
      info: { Title: "Ground Staff ID Cards", Author: "SCMS" },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Register fonts
    doc.registerFont("Bold", FONT_BOLD);
    doc.registerFont("Regular", FONT_REG);

    const positions: { x: number; y: number }[] = [
      { x: PAGE_MARGIN_X, y: PAGE_MARGIN_Y },
      { x: PAGE_MARGIN_X + CARD_W + GAP_X, y: PAGE_MARGIN_Y },
      { x: PAGE_MARGIN_X, y: PAGE_MARGIN_Y + CARD_H + GAP_Y },
      { x: PAGE_MARGIN_X + CARD_W + GAP_X, y: PAGE_MARGIN_Y + CARD_H + GAP_Y },
    ];

    (async () => {
      try {
        for (let i = 0; i < staffList.length; i++) {
          const posIdx = i % 4;
          if (posIdx === 0) {
            doc.addPage();
            // Page header
            doc.font(FONT_BOLD).fontSize(8).fillColor("#9CA3AF");
            doc.text("GROUND STAFF ID CARDS  ·  SCMS  ·  PRINT & LAMINATE", PAGE_MARGIN_X, 18, { align: "center", width: A4_W - PAGE_MARGIN_X * 2 });
          }
          const pos = positions[posIdx];
          await drawCard(doc, pos.x, pos.y, staffList[i]);
        }
        doc.end();
      } catch (err) {
        reject(err);
      }
    })();
  });
}
