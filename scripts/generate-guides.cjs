const PDFDocument = require('../artifacts/api-server/node_modules/pdfkit');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../artifacts/marketing-site/public/guides');

const C = {
  navy:      '#1a3272',
  navyLight: '#1e3d87',
  navyDark:  '#0f1f4a',
  saffron:   '#f97316',
  green:     '#16a34a',
  gray:      '#64748b',
  grayL:     '#f8fafc',
  grayM:     '#e2e8f0',
  dark:      '#0f172a',
  white:     '#ffffff',
  red:       '#ef4444',
  yellow:    '#fef3c7',
  yellowB:   '#f59e0b',
  blue:      '#eff6ff',
  blueB:     '#3b82f6',
};

const PAGE_W     = 595.28;
const PAGE_H     = 841.89;
const MARGIN     = 50;
const CONTENT_W  = PAGE_W - MARGIN * 2;
const HEADER_H   = 44;
const FOOTER_H   = 34;
const CONTENT_TOP = HEADER_H + 18;
const CONTENT_BTM = PAGE_H - FOOTER_H - 16;

// ── Doc factory ───────────────────────────────────────────────────────────────
function createDoc(filename, title, subject) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 }, // we control all layout
    bufferPages: true,
    autoFirstPage: false,
    info: { Title: title, Subject: subject, Author: 'SCMS — Preeti Infotech', Creator: 'SCMS Digital Platform' },
  });
  doc.pipe(fs.createWriteStream(path.join(OUTPUT_DIR, filename)));
  return doc;
}

// ── Per-doc state ─────────────────────────────────────────────────────────────
let _pageCount   = 0;
let _isCover     = true;

function initDoc(doc) {
  _pageCount = 0;
  _isCover   = true;

  doc.on('pageAdded', () => {
    if (_isCover) { _isCover = false; return; }
    _pageCount++;
    const n = _pageCount;

    // Header
    doc.rect(0, 0, PAGE_W, HEADER_H).fill(C.navy);
    doc.circle(28, 22, 11).fill(C.saffron);
    doc.fontSize(8).fillColor(C.white).font('Helvetica-Bold')
       .text('SC', 22, 17, { lineBreak: false });
    doc.fontSize(10).fillColor(C.white).font('Helvetica-Bold')
       .text('SCMS', 46, 13, { lineBreak: false });
    doc.fontSize(7).fillColor('#93c5fd').font('Helvetica')
       .text('Skill Center Management System', 46, 27, { lineBreak: false });

    // Footer — drawn at absolute position, no risk of pdfkit auto-page
    const fy = PAGE_H - FOOTER_H;
    doc.rect(0, fy, PAGE_W, FOOTER_H).fill(C.grayL);
    doc.moveTo(0, fy).lineTo(PAGE_W, fy).lineWidth(0.8).strokeColor(C.grayM).stroke();
    doc.fontSize(7.5).fillColor(C.gray).font('Helvetica')
       .text('SCMS by Preeti Infotech  •  scmsdigital.com  •  Support: WhatsApp',
             MARGIN, fy + 11, { width: CONTENT_W - 60, align: 'left', lineBreak: false });
    doc.fontSize(7.5).fillColor(C.gray).font('Helvetica')
       .text(`Page ${n}`, MARGIN, fy + 11, { width: CONTENT_W, align: 'right', lineBreak: false });

    // Reset Y to just below header
    doc.y = CONTENT_TOP;
  });
}

// ── Cover page ────────────────────────────────────────────────────────────────
function drawCoverPage(doc, guideTitle, guideSubtitle, badgeText, badgeColor) {
  doc.addPage();
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.navyDark);
  doc.rect(0, 0, PAGE_W, 6).fill(C.saffron);

  // Decorative blobs
  doc.save();
  doc.opacity(0.15);
  doc.circle(PAGE_W + 20, -20, 180).fill(C.navyLight);
  doc.circle(-50, PAGE_H + 50, 200).fill(C.navy);
  doc.restore();

  // Logo
  doc.roundedRect(50, 40, 48, 48, 10).fill(C.saffron);
  doc.fontSize(20).fillColor(C.white).font('Helvetica-Bold')
     .text('SC', 50, 53, { width: 48, align: 'center', lineBreak: false });
  doc.fontSize(22).fillColor(C.white).font('Helvetica-Bold')
     .text('SCMS', 110, 46, { lineBreak: false });
  doc.fontSize(8).fillColor('#93c5fd').font('Helvetica')
     .text('Skill Center Management System', 110, 72, { lineBreak: false });
  doc.fontSize(8).fillColor('#64748b').font('Helvetica')
     .text('by Preeti Infotech', 110, 84, { lineBreak: false });

  doc.moveTo(50, 116).lineTo(PAGE_W - 50, 116).lineWidth(0.5).strokeColor('#1e3a8a').stroke();

  // Badge
  const midY = PAGE_H * 0.35;
  doc.roundedRect(50, midY - 46, 145, 26, 13).fill(badgeColor);
  doc.fontSize(9).fillColor(C.white).font('Helvetica-Bold')
     .text(badgeText, 50, midY - 38, { width: 145, align: 'center', lineBreak: false });

  // Title
  doc.fontSize(34).fillColor(C.white).font('Helvetica-Bold')
     .text(guideTitle, 50, midY, { width: CONTENT_W });

  const lineY = doc.y + 6;
  doc.moveTo(50, lineY).lineTo(112, lineY).lineWidth(3).strokeColor(C.saffron).stroke();

  doc.fontSize(13).fillColor('#bfdbfe').font('Helvetica')
     .text(guideSubtitle, 50, lineY + 16, { width: CONTENT_W - 80 });

  // Info card
  const cardY = PAGE_H - 192;
  doc.roundedRect(50, cardY, CONTENT_W, 82, 12).fill('#0f2060');
  const cols   = [70, 232, 392];
  const labels = ['PLATFORM', 'VERSION', 'LANGUAGE'];
  const vals   = ['SCMS Digital', 'v2.0 — 2025', 'Hindi + English'];
  const subs   = ['scmsdigital.com', 'DDU-GKY / PMKVY / JSDMS', 'Field Operations Guide'];
  cols.forEach((x, i) => {
    doc.fontSize(8).fillColor('#94a3b8').font('Helvetica')
       .text(labels[i], x, cardY + 14, { lineBreak: false });
    doc.fontSize(11).fillColor(C.white).font('Helvetica-Bold')
       .text(vals[i], x, cardY + 28, { lineBreak: false });
    doc.fontSize(8).fillColor('#64748b').font('Helvetica')
       .text(subs[i], x, cardY + 50, { lineBreak: false });
  });

  // Bottom strip
  doc.rect(0, PAGE_H - 44, PAGE_W, 44).fill('#060f28');
  doc.fontSize(8).fillColor('#475569').font('Helvetica')
     .text('© 2025 Preeti Infotech Pvt. Ltd.  |  All rights reserved  |  scmsdigital.com',
           50, PAGE_H - 24, { width: CONTENT_W, align: 'center', lineBreak: false });
}

// ── Content page helpers ──────────────────────────────────────────────────────

function newPage(doc) {
  doc.addPage();
  doc.y = CONTENT_TOP;
}

function maybeBreak(doc, neededPx) {
  if (doc.y + neededPx > CONTENT_BTM) newPage(doc);
}

function spacer(doc, h) { doc.y += (h || 10); }

function para(doc, text) {
  maybeBreak(doc, 28);
  doc.fontSize(9.5).fillColor(C.dark).font('Helvetica')
     .text(text, MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });
  doc.y += 6;
}

function sectionHeader(doc, num, text, color) {
  color = color || C.navy;
  maybeBreak(doc, 54);
  doc.y += 8;
  const y = doc.y;
  doc.rect(MARGIN, y, 4, 30).fill(C.saffron);
  doc.circle(MARGIN + 22, y + 15, 13).fill(color);
  doc.fontSize(10).fillColor(C.white).font('Helvetica-Bold')
     .text(String(num), MARGIN + 16, y + 9, { width: 13, align: 'center', lineBreak: false });
  doc.fontSize(13).fillColor(color).font('Helvetica-Bold')
     .text(text, MARGIN + 42, y + 7, { width: CONTENT_W - 50, lineBreak: false });
  doc.moveTo(MARGIN + 42, y + 30).lineTo(PAGE_W - MARGIN, y + 30)
     .lineWidth(0.5).strokeColor(C.grayM).stroke();
  doc.y = y + 42;
}

function stepCard(doc, num, title, desc) {
  const cardH = desc ? 56 : 36;
  maybeBreak(doc, cardH + 6);
  const y = doc.y;
  doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 8).fill(C.grayL);
  doc.rect(MARGIN, y, 3, cardH).fill(C.saffron);
  const cy = y + cardH / 2;
  doc.roundedRect(MARGIN + 10, cy - 12, 24, 24, 6).fill(C.navy);
  doc.fontSize(10).fillColor(C.white).font('Helvetica-Bold')
     .text(String(num), MARGIN + 10, cy - 6, { width: 24, align: 'center', lineBreak: false });
  doc.fontSize(10.5).fillColor(C.dark).font('Helvetica-Bold')
     .text(title, MARGIN + 42, y + 10, { width: CONTENT_W - 52, lineBreak: false });
  if (desc) {
    doc.fontSize(9).fillColor(C.gray).font('Helvetica')
       .text(desc, MARGIN + 42, y + 28, { width: CONTENT_W - 52, lineBreak: false });
  }
  doc.y = y + cardH + 6;
}

function warningCard(doc, num, title, desc) {
  const cardH = desc ? 56 : 36;
  maybeBreak(doc, cardH + 6);
  const y = doc.y;
  doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 8).fill('#fff7ed');
  doc.rect(MARGIN, y, 3, cardH).fill(C.red);
  const cy = y + cardH / 2;
  doc.roundedRect(MARGIN + 10, cy - 12, 24, 24, 6).fill(C.red);
  doc.fontSize(10).fillColor(C.white).font('Helvetica-Bold')
     .text('!', MARGIN + 10, cy - 6, { width: 24, align: 'center', lineBreak: false });
  doc.fontSize(10.5).fillColor('#7c2d12').font('Helvetica-Bold')
     .text(title, MARGIN + 42, y + 10, { width: CONTENT_W - 52, lineBreak: false });
  if (desc) {
    doc.fontSize(9).fillColor('#92400e').font('Helvetica')
       .text(desc, MARGIN + 42, y + 28, { width: CONTENT_W - 52, lineBreak: false });
  }
  doc.y = y + cardH + 6;
}

function bulletPoint(doc, text) {
  maybeBreak(doc, 24);
  const y = doc.y;
  doc.circle(MARGIN + 8, y + 6, 3.5).fill(C.saffron);
  doc.fontSize(9.5).fillColor(C.dark).font('Helvetica')
     .text(text, MARGIN + 22, y, { width: CONTENT_W - 24, lineBreak: false });
  doc.y = y + 20;
}

function tipBox(doc, text) {
  maybeBreak(doc, 54);
  const y = doc.y;
  doc.roundedRect(MARGIN, y, CONTENT_W, 44, 8).fill(C.yellow);
  doc.rect(MARGIN, y, 4, 44).fill(C.yellowB);
  doc.fontSize(8).fillColor('#92400e').font('Helvetica-Bold')
     .text('TIP  ', MARGIN + 14, y + 15, { continued: true, lineBreak: false });
  doc.font('Helvetica').fillColor('#78350f')
     .text(text, { width: CONTENT_W - 28, lineBreak: false });
  doc.y = y + 52;
}

function infoBox(doc, title, text) {
  maybeBreak(doc, 58);
  const y = doc.y;
  doc.roundedRect(MARGIN, y, CONTENT_W, 50, 8).fill(C.blue);
  doc.rect(MARGIN, y, 4, 50).fill(C.blueB);
  doc.fontSize(9).fillColor('#1e40af').font('Helvetica-Bold')
     .text(title, MARGIN + 14, y + 12, { width: CONTENT_W - 24, lineBreak: false });
  doc.fontSize(8.5).fillColor('#1e3a8a').font('Helvetica')
     .text(text, MARGIN + 14, y + 28, { width: CONTENT_W - 24, lineBreak: false });
  doc.y = y + 58;
}

function subHeading(doc, text) {
  maybeBreak(doc, 28);
  doc.y += 4;
  doc.fontSize(10).fillColor(C.navy).font('Helvetica-Bold')
     .text(text, MARGIN, doc.y, { lineBreak: false });
  doc.y += 18;
}

// ── Finalize: remove trailing blank content pages ─────────────────────────────
function finalizeDoc(doc) {
  const range = doc.bufferedPageRange();
  // Find last page that has content below CONTENT_TOP
  let lastContentIdx = range.start + range.count - 1;
  for (let i = range.start + range.count - 1; i >= range.start + 1; i--) {
    doc.switchToPage(i);
    if (doc.y > CONTENT_TOP + 4) { lastContentIdx = i; break; }
  }
  // Switch to last content page so doc.end() doesn't append anything after it
  doc.switchToPage(lastContentIdx);
  doc.flushPages();
  doc.end();
}

// ─── GUIDE 1: Company Registration ───────────────────────────────────────────
function generateCompanyGuide() {
  const doc = createDoc('company-registration-guide.pdf', 'Company Registration Guide', 'SCMS Account Setup');
  initDoc(doc);
  drawCoverPage(doc, 'Company\nRegistration Guide',
    'SCMS mein naya account kaise setup karein — Owner aur Director ke liye complete walkthrough.',
    'For Owners / Directors', C.navy);

  newPage(doc);
  para(doc, 'Is guide mein aap seekhenge ki SCMS platform par apni company ka account kaise register karein, profile setup karein, aur pehla Admin account kaise banayein.');

  spacer(doc, 4);
  sectionHeader(doc, '1', 'Demo Book Karna & Account Activation');
  stepCard(doc, 1, 'Website par jaayein', 'Browser mein scmsdigital.com kholein aur "Book Demo" button par click karein.');
  stepCard(doc, 2, 'WhatsApp par contact karein', 'Team se baat karein — company naam, state, center count batayein.');
  stepCard(doc, 3, 'Credentials receive karein', 'Team aapka account activate karegi aur Super Admin credentials WhatsApp par bhejegi.');
  stepCard(doc, 4, 'Plan choose karein', 'Basic, Standard ya Premium — apni zaroorat ke hisaab se plan select karein.');
  tipBox(doc, 'Account activation mein 24 hours lag sakte hain weekdays mein. Team aapko WhatsApp par update degi.');

  spacer(doc, 4);
  sectionHeader(doc, '2', 'Company Profile Setup');
  stepCard(doc, 1, 'Super Admin panel login karein', 'URL: scmsdigital.com/super-admin — phone number aur MPIN enter karein.');
  stepCard(doc, 2, 'Company details bharein', 'Company naam, address, state, district, registered mobile aur email add karein.');
  stepCard(doc, 3, 'Logo upload karein', 'Official logo upload karein — yeh PDF reports aur app mein dikhega.');
  stepCard(doc, 4, 'Subscription verify karein', 'Dashboard par subscription status aur expiry date confirm karein.');

  spacer(doc, 4);
  sectionHeader(doc, '3', 'Pehla Admin Account Banana');
  stepCard(doc, 1, '"Admins" section mein jaayein', 'Super Admin dashboard → left menu → "Admins" tab par click karein.');
  stepCard(doc, 2, 'New Admin add karein', '"Add Admin" → naam, phone, assigned center aur 4-digit MPIN set karein.');
  stepCard(doc, 3, 'Credentials share karein', 'Admin ko unka phone number aur MPIN securely share karein.');
  stepCard(doc, 4, 'Test login', 'Admin se verify karwayein ki scmsdigital.com/admin-panel par login ho pa rahe hain.');
  infoBox(doc, 'Security Tip', 'MPIN kisi ke saath share na karein. Har Admin ka alag MPIN hona chahiye. Quarterly MPIN change ki sifarish hai.');

  spacer(doc, 4);
  sectionHeader(doc, '4', 'Subscription Plans');
  subHeading(doc, 'Basic Plan — ₹1,999/month');
  bulletPoint(doc, 'Upto 15 field staff');
  bulletPoint(doc, 'GPS attendance tracking');
  bulletPoint(doc, 'Basic attendance reports, 1 Admin account');
  subHeading(doc, 'Standard Plan — ₹4,999/month');
  bulletPoint(doc, 'Upto 40 field staff');
  bulletPoint(doc, 'AI face verification, offline app with sync');
  bulletPoint(doc, 'Excel + PDF exports, 5 Admin accounts');
  subHeading(doc, 'Premium Plan — ₹9,999/month');
  bulletPoint(doc, 'Unlimited staff + multi-center management');
  bulletPoint(doc, 'Priority support + dedicated account manager');
  bulletPoint(doc, 'Custom branding on reports, annual discount available');
  tipBox(doc, 'Sabhi plans mein pehla 1 mahina FREE trial shamil hai. Koi advance payment nahi.');

  finalizeDoc(doc);
  console.log('✅ Company Registration Guide generated');
}

// ─── GUIDE 2: Admin User Guide ────────────────────────────────────────────────
function generateAdminGuide() {
  const doc = createDoc('admin-user-guide.pdf', 'Admin User Guide', 'Admin Panel Complete Walkthrough');
  initDoc(doc);
  drawCoverPage(doc, 'Admin\nUser Guide',
    'Staff management, attendance, reports, leave approval, notices broadcast — Admin Panel ka poora walkthrough.',
    'For Admins / Center Managers', C.navyLight);

  newPage(doc);
  para(doc, 'Admin Panel ek powerful web dashboard hai jo aapko staff ki poori activity track karne, reports download karne, leave approve karne aur notices broadcast karne ki suvidha deta hai.');

  spacer(doc, 4);
  sectionHeader(doc, '1', 'Admin Panel Login');
  stepCard(doc, 1, 'URL kholein', 'Chrome browser mein jaayein: scmsdigital.com/admin-panel');
  stepCard(doc, 2, 'Phone number dalein', 'Registered mobile number enter karein → "Send OTP" dabayein.');
  stepCard(doc, 3, 'OTP verify karein', 'SMS par aaye 6-digit OTP enter karein. 5 minutes mein expire hota hai.');
  stepCard(doc, 4, 'MPIN enter karein', '4-digit MPIN dalein jo setup ke waqt set kiya gaya tha.');
  stepCard(doc, 5, 'Dashboard', 'Login hone par live stats — aaj ki attendance, total staff, active shifts.');
  tipBox(doc, 'Mobile browser mein bhi kaam karta hai — lekin desktop/laptop par zyada comfortable rahega.');

  spacer(doc, 4);
  sectionHeader(doc, '2', 'Staff Management');
  stepCard(doc, 1, 'Naya staff add karein', '"Staff" → "Add Staff" → naam, phone, role, assigned center bharein.');
  stepCard(doc, 2, 'Staff profile edit karein', 'Staff ke naam par click → "Edit" → details update → Save.');
  stepCard(doc, 3, 'Staff deactivate karein', 'Staff profile → "Deactivate" → staff login nahi kar payega (data safe rahega).');
  stepCard(doc, 4, 'MPIN reset karein', 'Staff profile → "Reset MPIN" → naya MPIN set → staff ko batayein.');
  stepCard(doc, 5, 'Live location dekhein', '"Live Map" tab → map par sab active staff ke GPS pins real-time mein.');

  spacer(doc, 4);
  sectionHeader(doc, '3', 'Attendance Management');
  stepCard(doc, 1, 'Aaj ki attendance', 'Dashboard ya "Attendance" tab → aaj ke saare check-in/out records.');
  stepCard(doc, 2, 'Date filter use karein', 'Date picker se kisi bhi din ki attendance dekh sakte hain.');
  stepCard(doc, 3, 'Selfie photo verify karein', 'Har check-in entry par click → selfie photo dekh sakte hain.');
  stepCard(doc, 4, 'Manual correction', 'Attendance record → "Edit" → galat time correct karein → reason note karein.');
  infoBox(doc, 'Geo-fencing kya hai?', 'Staff sirf assigned center ke 100 meter ke andar rahne par check-in kar sakta hai. Yeh proxy attendance rokta hai.');

  spacer(doc, 4);
  sectionHeader(doc, '4', 'Reports Download');
  stepCard(doc, 1, 'Reports tab kholein', '"Reports" section → date range select karein.');
  stepCard(doc, 2, 'Excel report', '"Download Excel" → attendance, salary, KM tracking — sab ek file mein.');
  stepCard(doc, 3, 'PDF reports', 'Individual staff ya candidate ki PDF report bhi download hoti hai.');
  stepCard(doc, 4, 'Candidate report', 'Candidate section → select → "Download PDF" → registration form milega.');

  spacer(doc, 4);
  sectionHeader(doc, '5', 'Leave Management');
  bulletPoint(doc, 'Leave requests "Leave" tab mein — pending, approved, rejected status dikhega.');
  bulletPoint(doc, 'Approve ya Reject ek click mein. Staff ko push notification milta hai.');
  bulletPoint(doc, 'Leave calendar mein mahine ka overview — green (present), red (absent), yellow (leave).');
  bulletPoint(doc, 'Public holidays "Holiday" section se set karein — sab staff ko auto-notify hoga.');

  spacer(doc, 4);
  sectionHeader(doc, '6', 'Notices Broadcast');
  stepCard(doc, 1, 'New Notice likhein', '"Notices" → "New Notice" → title aur message likhein.');
  stepCard(doc, 2, 'Target choose karein', 'Sab staff, ek center, ya specific role ko notice bhej sakte hain.');
  stepCard(doc, 3, 'SMS + Push dono', 'Notice SMS aur push notification dono se automatically jaata hai.');
  stepCard(doc, 4, 'Notice history', '"Sent Notices" mein saare purane notices + read receipts dikhte hain.');
  warningCard(doc, '!', 'Data Delete Warning', 'Koi bhi data delete karne se pehle support se confirm karein. Deleted data restore nahi hota.');

  finalizeDoc(doc);
  console.log('✅ Admin User Guide generated');
}

// ─── GUIDE 3: Center Staff Guide ─────────────────────────────────────────────
function generateCenterStaffGuide() {
  const doc = createDoc('center-staff-user-guide.pdf', 'Center Staff User Guide', 'Mobile App Guide');
  initDoc(doc);
  drawCoverPage(doc, 'Center Staff\nUser Guide',
    'MPIN login, GPS check-in/out, leave apply, notices — center staff ke liye complete mobile app guide.',
    'For Center Staff / Trainers', C.green);

  newPage(doc);
  para(doc, 'SCMS Field App ek Android application hai jo center staff ke daily kaam ko transparent aur simple banata hai — attendance, leave, notices sab ek jagah.');

  spacer(doc, 4);
  sectionHeader(doc, '1', 'App Download & First Time Login');
  stepCard(doc, 1, 'App install karein', 'Android phone par SCMS Field App install karein — APK link admin se maangein.');
  stepCard(doc, 2, 'Phone number enter karein', 'App kholein → registered number → "Send OTP" tap karein.');
  stepCard(doc, 3, 'OTP verify karein', 'SMS par aaya 6-digit OTP enter karein.');
  stepCard(doc, 4, 'MPIN set karein', 'Pehli baar 4-digit MPIN choose karein — yaad rakhein, baar baar kaam aayega.');
  stepCard(doc, 5, 'Dashboard', 'Aaj ki shift status, leave balance, notifications — sab ek screen par.');
  tipBox(doc, 'MPIN bhoolne par admin se sampark karein — woh reset kar denge. MPIN kisi ke saath share na karein.');

  spacer(doc, 4);
  sectionHeader(doc, '2', 'Daily Check-In Process');
  stepCard(doc, 1, 'Center par pahunchein', 'Physically apne assigned training center ya work location par aayein.');
  stepCard(doc, 2, '"Check In" button dabayein', 'App home screen par bada "Check In" button dikhega — tap karein.');
  stepCard(doc, 3, 'GPS location verify hogi', 'App confirm karega ki aap assigned center ke 100 meter ke andar hain.');
  stepCard(doc, 4, 'Live selfie kheenchein', 'Front camera se selfie kheenchein — face clearly dikhna chahiye, mask nahi.');
  stepCard(doc, 5, 'Confirmation', 'Green tick = check-in successful. Live shift timer shuru ho jaata hai.');
  warningCard(doc, '!', 'Location se bahar check-in nahi hoga', 'Agar 100m se zyada door hain toh check-in button kaam nahi karega. Yeh policy hai.');

  spacer(doc, 4);
  sectionHeader(doc, '3', 'Check-Out Process');
  stepCard(doc, 1, 'Kaam khatam hone par', 'App par wapas jaayein — home screen par "Check Out" button dikhega.');
  stepCard(doc, 2, 'Check-Out tap karein', '"Check Out" dabayein → GPS verify → live selfie maangegi.');
  stepCard(doc, 3, 'Daily summary', 'Check-out ke baad aaj ka total hours aur location summary dikhta hai.');

  spacer(doc, 4);
  sectionHeader(doc, '4', 'Leave Apply Karna');
  stepCard(doc, 1, 'Leave tab kholein', 'Bottom menu mein "Leave" icon tap karein.');
  stepCard(doc, 2, '"Apply Leave" tap karein', 'Leave type chunein: Casual / Sick / Other.');
  stepCard(doc, 3, 'Dates aur reason likhein', 'Start date, end date select karein aur leave ka reason briefly likhein.');
  stepCard(doc, 4, 'Submit karein', 'Admin ko notification jaayegi. Approval/rejection par aapko bhi notification milegi.');
  tipBox(doc, '1 din pehle leave apply karein jab bhi possible ho — admin ko planning mein madad milti hai.');

  spacer(doc, 4);
  sectionHeader(doc, '5', 'Attendance Calendar');
  bulletPoint(doc, '"Calendar" tab → poore mahine ki attendance ek nazar mein.');
  bulletPoint(doc, 'Color code: Green = Present, Red = Absent, Yellow = Leave, Blue = Holiday.');
  bulletPoint(doc, 'Kisi date par tap → us din ka detail: check-in time, check-out time, GPS location.');
  bulletPoint(doc, 'Agar galti dikh rahi ho — turant admin se sampark karein correction ke liye.');

  spacer(doc, 4);
  sectionHeader(doc, '6', 'Notices Dekhna');
  bulletPoint(doc, '"Notices" tab mein admin ke saare broadcasts dikhenge — title aur message.');
  bulletPoint(doc, 'Internet nahi hone par bhi SMS se notice milega — dono channels active hain.');
  bulletPoint(doc, 'Important notices read karna mandatory hai — admin check kar sakta hai kisne padha.');

  spacer(doc, 4);
  sectionHeader(doc, '7', 'Common Problems & Solutions');
  warningCard(doc, '!', 'Check-in nahi ho raha', 'Location services ON karein. Internet check karein. App force-close karein aur retry karein.');
  warningCard(doc, '!', 'MPIN bhool gaye', 'Admin se sampark karein — woh MPIN reset kar denge. Phone number ready rakhein.');
  warningCard(doc, '!', 'Selfie reject ho rahi hai', 'Achhi roshni mein selfie kheenchein. Chehra poora frame mein aaye. Mask ya cap nahi.');
  warningCard(doc, '!', 'App crash ho raha hai', 'Phone restart karein. Agar phir bhi problem — admin se naya APK link maangein.');

  finalizeDoc(doc);
  console.log('✅ Center Staff User Guide generated');
}

// ─── GUIDE 4: Field Staff Guide ───────────────────────────────────────────────
function generateFieldStaffGuide() {
  const doc = createDoc('field-staff-user-guide.pdf', 'Field Staff User Guide', 'GPS Tracking & Candidate Registration');
  initDoc(doc);
  drawCoverPage(doc, 'Field Staff\n(Mobilizer) Guide',
    'GPS tracking, candidate registration, 7 documents capture, offline mode — field mobilizers ke liye complete guide.',
    'For Field Mobilizers', C.saffron);

  newPage(doc);
  para(doc, 'Field Staff (Mobilizers) ka kaam candidates ko field mein visit karke register karna aur documents collect karna hai. Yeh guide aapko app ka poora use step-by-step sikhayegi.');

  spacer(doc, 4);
  sectionHeader(doc, '1', 'App Setup & Login');
  stepCard(doc, 1, 'App install karein', 'Admin se SCMS Field App ka APK link maangein → Android phone par install karein.');
  stepCard(doc, 2, 'Permissions allow karein', 'Camera, Location aur Storage — teeno permissions ALLOW karein. Bina iske app kaam nahi karega.');
  stepCard(doc, 3, 'Phone number enter karein', 'Registered mobile number → OTP verify karein.');
  stepCard(doc, 4, 'MPIN set karein', 'Pehli baar 4-digit MPIN choose karein — ise yaad rakhein.');
  infoBox(doc, 'Recommended Phone Settings', 'Location: High Accuracy mode ON. Battery Saver: Field duty par OFF rakhein. Mobile Data: Jab available ho ON rakhein.');

  spacer(doc, 4);
  sectionHeader(doc, '2', 'Field Check-In / Check-Out');
  stepCard(doc, 1, 'GPS ON karein', 'Phone mein GPS / Location ON karein. Bina GPS ke check-in nahi hoga.');
  stepCard(doc, 2, '"Check In" dabayein', 'App home → "Check In" → GPS save → live selfie kheenchein.');
  stepCard(doc, 3, 'Shift timer', 'Check-in ke baad live timer chalega — kitne ghante field mein hain track hota hai.');
  stepCard(doc, 4, 'KM tracking', 'Din bhar ki GPS movement se total distance calculate hoti hai — petrol reimbursement ke liye.');
  stepCard(doc, 5, 'Check-Out', 'Field se wapas aane par "Check Out" → selfie → din ka summary save.');
  tipBox(doc, 'Internet nahi hai toh bhi check-in/out hoga — data phone mein save hoga aur internet aane par auto-sync karega.');

  spacer(doc, 4);
  sectionHeader(doc, '3', 'Candidate Registration — Step by Step');
  stepCard(doc, 1, '"Register New Candidate" tap karein', 'App → "Candidates" tab → "+" button ya "Register New".');
  stepCard(doc, 2, 'Personal details bharein', 'Poora naam, pita ka naam, mata ka naam, DOB, gender, category (ST/SC/OBC/General).');
  stepCard(doc, 3, 'Address details', 'Gaon/mohalla, post, block, district, state, pincode — ek-ek field carefully bharein.');
  stepCard(doc, 4, 'Aadhaar details', '12-digit Aadhaar number — Aadhaar card se milana zaroori hai, typo mat karna.');
  stepCard(doc, 5, 'Bank details', 'Account number, IFSC code, bank naam, branch — double check karein.');
  stepCard(doc, 6, 'Documents capture karein', '7 documents live camera se capture karein (neeche list hai).');
  stepCard(doc, 7, 'Review & Submit', 'Sab details check karein → Submit. Admin panel par turant dikhega.');

  spacer(doc, 4);
  sectionHeader(doc, '4', '7 Required Documents — Capture Rules');
  bulletPoint(doc, '1. Passport Photo — 3.5×4.5 cm, white background, face 80% frame mein');
  bulletPoint(doc, '2. Aadhaar Card (Front) — poora card, naam/DOB/address/photo readable');
  bulletPoint(doc, '3. Aadhaar Card (Back) — address clearly visible, barcode capture ho');
  bulletPoint(doc, '4. Jati Praman Patra — government issued, official seal aur signature visible');
  bulletPoint(doc, '5. Shaikshanik Praman Patra — highest qualification (10th/12th/graduation)');
  bulletPoint(doc, '6. Bank Passbook (First Page) — naam, account number, IFSC clearly dikh rahe');
  bulletPoint(doc, '7. Hastakshar — candidate ka signature white plain paper par, poora frame mein');
  warningCard(doc, '!', 'Gallery se upload BAND hai', 'Koi bhi document gallery ya downloaded photo se submit ALLOWED NAHI. Sirf live camera capture — audit requirement hai.');

  spacer(doc, 4);
  sectionHeader(doc, '5', 'Offline Mode');
  stepCard(doc, 1, 'Internet nahi — koi baat nahi', 'App offline bhi poora kaam karta hai. Data phone ke local storage mein save hota hai.');
  stepCard(doc, 2, 'Auto sync', 'Jab bhi 4G ya WiFi milega, sab pending data automatically server par sync ho jaata hai.');
  stepCard(doc, 3, 'Sync indicator', 'Orange dot = sync pending, Green dot = sab synced. Din khatam karne se pehle green confirm karein.');
  infoBox(doc, 'Daily Routine', 'Roz din khatam karne ke baad WiFi se connect karein aur green sync indicator confirm karein. Isse koi bhi data kabhi nahi khoega.');

  spacer(doc, 4);
  sectionHeader(doc, '6', 'My Candidates — Status Tracking');
  bulletPoint(doc, '"My Candidates" tab → apne registered saare candidates ki list.');
  bulletPoint(doc, 'Pending = admin ne approve nahi kiya. Approved = batch assign ho gaya.');
  bulletPoint(doc, 'Rejected = koi document ya detail galat thi — admin ka reason dekh sakte hain.');
  bulletPoint(doc, 'Kisi candidate par tap → poori profile → "Share PDF" se registration proof share karein.');

  spacer(doc, 4);
  sectionHeader(doc, '7', 'Common Problems & Solutions');
  warningCard(doc, '!', 'Check-in fail ho raha hai', 'GPS High Accuracy ON karein. Internet check karein. App restart karein aur retry karein.');
  warningCard(doc, '!', 'Camera permission nahi', 'Phone Settings → Apps → SCMS → Permissions → Camera → Allow. App restart karein.');
  warningCard(doc, '!', 'Data sync nahi ho raha', 'WiFi ya data ON karein. App close karke dobara kholein. Orange dot jaane tak wait karein.');
  warningCard(doc, '!', 'MPIN bhool gaye', 'Admin se sampark karein — MPIN reset kar denge. Registered phone number ready rakhein.');
  warningCard(doc, '!', 'Candidate submit nahi ho raha', 'Sabhi 7 documents captured hain? Sab fields filled? Offline submit karo — baad mein sync hoga.');

  finalizeDoc(doc);
  console.log('✅ Field Staff User Guide generated');
}

// ── Run all ───────────────────────────────────────────────────────────────────
generateCompanyGuide();
generateAdminGuide();
generateCenterStaffGuide();
generateFieldStaffGuide();
console.log('\n🎉 All 4 guides generated in artifacts/marketing-site/public/guides/');
