const PDFDocument = require('../artifacts/api-server/node_modules/pdfkit');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../artifacts/marketing-site/public/guides');

const C = {
  navy:      '#1a3272',
  navyLight: '#1e3d87',
  navyDark:  '#0f1f4a',
  saffron:   '#f97316',
  saffronL:  '#fed7aa',
  green:     '#16a34a',
  greenL:    '#dcfce7',
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

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

function createDoc(filename, title, subject) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: title,
      Subject: subject,
      Author: 'SCMS — Preeti Infotech',
      Creator: 'SCMS Digital Platform',
      Keywords: 'SCMS, DDU-GKY, PMKVY, skill center, user guide',
    },
    autoFirstPage: false,
  });
  const stream = fs.createWriteStream(path.join(OUTPUT_DIR, filename));
  doc.pipe(stream);
  return doc;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hex(h) { // hex to [r,g,b]
  const n = parseInt(h.replace('#',''), 16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}

function drawCoverPage(doc, guideTitle, guideSubtitle, badgeText, badgeColor) {
  doc.addPage();

  // Full dark navy background
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.navyDark);

  // Top accent bar
  doc.rect(0, 0, PAGE_W, 6).fill(C.saffron);

  // Decorative circles (top-right)
  doc.circle(PAGE_W + 40, -40, 180).fill(C.navyLight).fillOpacity(0.5);
  doc.circle(PAGE_W - 30, 120, 100).fill(C.navy).fillOpacity(0.6);
  // Decorative circle bottom-left
  doc.circle(-60, PAGE_H + 60, 200).fill(C.navy).fillOpacity(0.5);
  doc.fillOpacity(1);

  // SCMS Logo block (top-left)
  const logoX = 50, logoY = 40;
  doc.roundedRect(logoX, logoY, 48, 48, 10).fill(C.saffron);
  doc.fontSize(20).fillColor(C.white).font('Helvetica-Bold')
     .text('SC', logoX, logoY + 13, { width: 48, align: 'center' });

  doc.fontSize(22).fillColor(C.white).font('Helvetica-Bold')
     .text('SCMS', logoX + 58, logoY + 6);
  doc.fontSize(8).fillColor('#93c5fd').font('Helvetica')
     .text('Skill Center Management System', logoX + 58, logoY + 32)
     .text('by Preeti Infotech', logoX + 58, logoY + 44);

  // Horizontal divider line
  doc.moveTo(50, 120).lineTo(PAGE_W - 50, 120).lineWidth(0.5).strokeColor('#1e3a8a').stroke();

  // Center content area
  const midY = PAGE_H * 0.38;

  // Guide badge
  const [br, bg, bb] = hex(badgeColor);
  doc.roundedRect(50, midY - 46, 130, 26, 13)
     .fill(`rgb(${br},${bg},${bb})`);
  doc.fontSize(9).fillColor(C.white).font('Helvetica-Bold')
     .text(badgeText, 50, midY - 38, { width: 130, align: 'center' });

  // Guide title
  doc.fontSize(34).fillColor(C.white).font('Helvetica-Bold')
     .text(guideTitle, 50, midY, { width: CONTENT_W, lineGap: 4 });

  // Subtitle line
  const afterTitle = doc.y + 10;
  doc.moveTo(50, afterTitle).lineTo(50 + 60, afterTitle).lineWidth(3).strokeColor(C.saffron).stroke();

  // Subtitle text
  doc.fontSize(13).fillColor('#bfdbfe').font('Helvetica')
     .text(guideSubtitle, 50, afterTitle + 16, { width: CONTENT_W - 80 });

  // Info card (bottom)
  const cardY = PAGE_H - 180;
  doc.roundedRect(50, cardY, CONTENT_W, 80, 12).fill('#0f2060');

  doc.fontSize(9).fillColor('#94a3b8').font('Helvetica')
     .text('PLATFORM', 70, cardY + 16)
     .text('VERSION', 230, cardY + 16)
     .text('LANGUAGE', 390, cardY + 16);

  doc.fontSize(11).fillColor(C.white).font('Helvetica-Bold')
     .text('SCMS Digital', 70, cardY + 30)
     .text('v2.0 — 2025', 230, cardY + 30)
     .text('Hindi + English', 390, cardY + 30);

  doc.fontSize(9).fillColor('#64748b').font('Helvetica')
     .text('scmsdigital.com', 70, cardY + 50)
     .text('DDU-GKY / PMKVY / JSDMS', 230, cardY + 50)
     .text('Field Operations Guide', 390, cardY + 50);

  // Bottom strip
  doc.rect(0, PAGE_H - 50, PAGE_W, 50).fill('#060f28');
  doc.fontSize(8.5).fillColor('#475569').font('Helvetica')
     .text('© 2025 Preeti Infotech Pvt. Ltd.  |  All rights reserved  |  scmsdigital.com', 50, PAGE_H - 30, { width: CONTENT_W, align: 'center' });
}

let _currentPage = 0;

function addContentPage(doc, showHeader = true) {
  _currentPage++;
  doc.addPage();

  if (showHeader) {
    // Slim top header strip
    doc.rect(0, 0, PAGE_W, 44).fill(C.navy);
    // Logo dot
    doc.circle(30, 22, 12).fill(C.saffron);
    doc.fontSize(8).fillColor(C.white).font('Helvetica-Bold').text('SC', 23, 17);
    doc.fontSize(10).fillColor(C.white).font('Helvetica-Bold').text('SCMS', 48, 13);
    doc.fontSize(7).fillColor('#93c5fd').font('Helvetica').text('Skill Center Management System', 48, 27);
  }

  // Footer
  drawPageFooter(doc, _currentPage);

  // Reset Y below header
  doc.y = 64;
}

function drawPageFooter(doc, pageNum) {
  const fy = PAGE_H - 36;
  doc.rect(0, fy, PAGE_W, 36).fill(C.grayL);
  doc.moveTo(0, fy).lineTo(PAGE_W, fy).lineWidth(1).strokeColor(C.grayM).stroke();
  doc.fontSize(7.5).fillColor(C.gray).font('Helvetica')
     .text('SCMS by Preeti Infotech  •  scmsdigital.com  •  Support: WhatsApp', MARGIN, fy + 12, { width: CONTENT_W - 40, align: 'left' })
     .text(`Page ${pageNum}`, MARGIN, fy + 12, { width: CONTENT_W, align: 'right' });
}

function sectionHeader(doc, num, text, color = C.navy) {
  checkPageBreak(doc, 50);
  doc.moveDown(0.6);
  const y = doc.y;

  // Left accent bar
  doc.rect(MARGIN, y, 4, 28).fill(C.saffron);

  // Number circle
  doc.circle(MARGIN + 22, y + 14, 13).fill(color);
  doc.fontSize(10).fillColor(C.white).font('Helvetica-Bold')
     .text(num, MARGIN + 16, y + 8, { width: 13, align: 'center' });

  // Section title
  doc.fontSize(13).fillColor(color).font('Helvetica-Bold')
     .text(text, MARGIN + 42, y + 6, { width: CONTENT_W - 50 });

  // Underline
  doc.moveTo(MARGIN + 42, doc.y + 2).lineTo(PAGE_W - MARGIN, doc.y + 2)
     .lineWidth(0.5).strokeColor(C.grayM).stroke();

  doc.y += 14;
}

function stepCard(doc, num, title, desc) {
  checkPageBreak(doc, 58);
  const y = doc.y;
  const cardH = desc ? 52 : 34;

  // Card background
  doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 8).fill(C.grayL);
  // Left border
  doc.rect(MARGIN, y, 3, cardH).fill(C.saffron);

  // Step number badge
  doc.roundedRect(MARGIN + 10, y + (cardH/2) - 12, 24, 24, 6).fill(C.navy);
  doc.fontSize(10).fillColor(C.white).font('Helvetica-Bold')
     .text(String(num), MARGIN + 10, y + (cardH/2) - 6, { width: 24, align: 'center' });

  // Title
  doc.fontSize(10.5).fillColor(C.dark).font('Helvetica-Bold')
     .text(title, MARGIN + 42, y + 10, { width: CONTENT_W - 52 });

  // Description
  if (desc) {
    doc.fontSize(9).fillColor(C.gray).font('Helvetica')
       .text(desc, MARGIN + 42, y + 26, { width: CONTENT_W - 52 });
  }

  doc.y = y + cardH + 6;
}

function warningCard(doc, num, title, desc) {
  checkPageBreak(doc, 58);
  const y = doc.y;
  const cardH = desc ? 52 : 34;

  doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 8).fill('#fff7ed');
  doc.rect(MARGIN, y, 3, cardH).fill(C.red);

  doc.roundedRect(MARGIN + 10, y + (cardH/2) - 12, 24, 24, 6).fill(C.red);
  doc.fontSize(9).fillColor(C.white).font('Helvetica-Bold')
     .text('!', MARGIN + 10, y + (cardH/2) - 6, { width: 24, align: 'center' });

  doc.fontSize(10.5).fillColor('#7c2d12').font('Helvetica-Bold')
     .text(title, MARGIN + 42, y + 10, { width: CONTENT_W - 52 });
  if (desc) {
    doc.fontSize(9).fillColor('#92400e').font('Helvetica')
       .text(desc, MARGIN + 42, y + 26, { width: CONTENT_W - 52 });
  }

  doc.y = y + cardH + 6;
}

function bulletPoint(doc, text) {
  checkPageBreak(doc, 22);
  const y = doc.y;
  doc.circle(MARGIN + 8, y + 6, 3.5).fill(C.saffron);
  doc.fontSize(9.5).fillColor(C.dark).font('Helvetica')
     .text(text, MARGIN + 20, y, { width: CONTENT_W - 22 });
  doc.y += 4;
}

function tipBox(doc, text) {
  checkPageBreak(doc, 50);
  const y = doc.y;
  doc.roundedRect(MARGIN, y, CONTENT_W, 42, 8).fill(C.yellow);
  doc.rect(MARGIN, y, 4, 42).fill(C.yellowB);
  doc.fontSize(8).fillColor('#92400e').font('Helvetica-Bold').text('TIP  ', MARGIN + 14, y + 13, { continued: true });
  doc.fontSize(8).fillColor('#78350f').font('Helvetica').text(text, { width: CONTENT_W - 24 });
  doc.y = y + 50;
}

function infoBox(doc, title, text) {
  checkPageBreak(doc, 54);
  const y = doc.y;
  doc.roundedRect(MARGIN, y, CONTENT_W, 48, 8).fill(C.blue);
  doc.rect(MARGIN, y, 4, 48).fill(C.blueB);
  doc.fontSize(8.5).fillColor('#1e40af').font('Helvetica-Bold').text(title, MARGIN + 14, y + 12, { width: CONTENT_W - 24 });
  doc.fontSize(8.5).fillColor('#1e3a8a').font('Helvetica').text(text, MARGIN + 14, y + 26, { width: CONTENT_W - 24 });
  doc.y = y + 56;
}

function checkPageBreak(doc, neededHeight) {
  if (doc.y + neededHeight > PAGE_H - 60) {
    const pageNum = ++_currentPage;
    doc.addPage();
    // Header
    doc.rect(0, 0, PAGE_W, 44).fill(C.navy);
    doc.circle(30, 22, 12).fill(C.saffron);
    doc.fontSize(8).fillColor(C.white).font('Helvetica-Bold').text('SC', 23, 17);
    doc.fontSize(10).fillColor(C.white).font('Helvetica-Bold').text('SCMS', 48, 13);
    doc.fontSize(7).fillColor('#93c5fd').font('Helvetica').text('Skill Center Management System', 48, 27);
    drawPageFooter(doc, pageNum);
    doc.y = 64;
  }
}

function subHeading(doc, text) {
  checkPageBreak(doc, 26);
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor(C.navy).font('Helvetica-Bold').text(text, MARGIN, doc.y);
  doc.moveDown(0.3);
}

function para(doc, text) {
  checkPageBreak(doc, 26);
  doc.fontSize(9.5).fillColor(C.dark).font('Helvetica').text(text, MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });
  doc.moveDown(0.5);
}

function spacer(doc, h = 10) {
  doc.y += h;
}

// ─── GUIDE 1: Company Registration ───────────────────────────────────────────
function generateCompanyGuide() {
  _currentPage = 0;
  const doc = createDoc('company-registration-guide.pdf', 'Company Registration Guide', 'SCMS Account Setup — Step by Step');

  drawCoverPage(doc,
    'Company Registration\nGuide',
    'SCMS mein naya account kaise setup karein — Owner aur Director ke liye complete walkthrough.',
    'For Owners / Directors',
    C.navy
  );

  addContentPage(doc);

  // Intro para
  para(doc, 'Is guide mein aap seekhenge ki SCMS platform par apni company ka account kaise register karein, profile setup karein, aur pehla Admin account kaise banayein.');

  spacer(doc, 8);
  sectionHeader(doc, '1', 'Demo Book Karna & Account Activation');

  stepCard(doc, 1, 'Website par jaayein', 'Browser mein scmsdigital.com kholein aur "Book Demo" button par click karein.');
  stepCard(doc, 2, 'WhatsApp par contact karein', 'Hamare team se WhatsApp par baat karein. Company ka naam, state, center count batayein.');
  stepCard(doc, 3, 'Credentials receive karein', 'Team aapka account activate karegi aur Super Admin credentials WhatsApp par bhejegi.');
  stepCard(doc, 4, 'Plan choose karein', 'Basic, Standard ya Premium — apni zaroorat ke hisaab se plan select karein (details neeche hain).');

  tipBox(doc, 'Account activation mein 24 hours lag sakte hain — weekdays mein. Team aapko WhatsApp par update degi.');

  spacer(doc, 4);
  sectionHeader(doc, '2', 'Company Profile Setup');

  stepCard(doc, 1, 'Super Admin panel login karein', 'URL: scmsdigital.com/super-admin — apna phone number aur MPIN enter karein.');
  stepCard(doc, 2, 'Company details bharein', 'Company naam, address, state, district, registered mobile aur email add karein.');
  stepCard(doc, 3, 'Logo upload karein', 'Official company logo upload karein — yeh PDF reports aur app mein dikhega.');
  stepCard(doc, 4, 'Subscription verify karein', 'Dashboard par subscription status aur expiry date confirm karein.');

  spacer(doc, 4);
  sectionHeader(doc, '3', 'Pehla Admin Account Banana');

  stepCard(doc, 1, '"Admins" section mein jaayein', 'Super Admin dashboard → left menu → "Admins" tab par click karein.');
  stepCard(doc, 2, 'New Admin add karein', '"Add Admin" button → naam, phone number, assigned center aur 4-digit MPIN set karein.');
  stepCard(doc, 3, 'Credentials share karein', 'Admin ko unka phone number aur MPIN share karein securely.');
  stepCard(doc, 4, 'Test login', 'Admin se verify karwayein: scmsdigital.com/admin-panel par successfully login ho pa rahe hain.');

  infoBox(doc, 'Security Tip', 'MPIN kisi ke saath share na karein. Har Admin ka alag MPIN hona chahiye. Quarterly MPIN change ki sifarish hai.');

  spacer(doc, 4);
  sectionHeader(doc, '4', 'Subscription Plans — Overview');

  subHeading(doc, 'Basic Plan — ₹2,000/month');
  bulletPoint(doc, 'Upto 10 field staff');
  bulletPoint(doc, 'GPS attendance tracking');
  bulletPoint(doc, 'Basic attendance reports');
  bulletPoint(doc, '1 Admin account');

  subHeading(doc, 'Standard Plan — ₹5,000/month');
  bulletPoint(doc, 'Upto 50 field staff');
  bulletPoint(doc, 'AI face verification on check-in');
  bulletPoint(doc, 'Offline mobile app with sync');
  bulletPoint(doc, 'Excel + PDF exports');
  bulletPoint(doc, '5 Admin accounts');

  subHeading(doc, 'Premium Plan — ₹10,000/month');
  bulletPoint(doc, 'Unlimited staff');
  bulletPoint(doc, 'Multi-center management');
  bulletPoint(doc, 'Priority WhatsApp support');
  bulletPoint(doc, 'Dedicated account manager');
  bulletPoint(doc, 'Custom branding on reports');
  bulletPoint(doc, 'Annual discount available — team se poochein');

  tipBox(doc, 'Sabhi plans mein pehla 1 mahina FREE trial shamil hai. Koi advance payment nahi.');

  doc.end();
  console.log('✅ Company Registration Guide generated');
}

// ─── GUIDE 2: Admin User Guide ───────────────────────────────────────────────
function generateAdminGuide() {
  _currentPage = 0;
  const doc = createDoc('admin-user-guide.pdf', 'Admin User Guide', 'Admin Panel Complete Walkthrough');

  drawCoverPage(doc,
    'Admin User Guide',
    'Staff management, attendance, reports, leave approval, notices broadcast — Admin Panel ka poora walkthrough.',
    'For Admins / Center Managers',
    C.navyLight
  );

  addContentPage(doc);

  para(doc, 'Admin Panel ek powerful web dashboard hai jo aapko staff ki poori activity track karne, reports download karne, leave approve karne aur notices broadcast karne ki suvidha deta hai.');

  spacer(doc, 8);
  sectionHeader(doc, '1', 'Admin Panel Login');

  stepCard(doc, 1, 'URL kholein', 'Browser (Chrome recommended) mein jaayein: scmsdigital.com/admin-panel');
  stepCard(doc, 2, 'Phone number dalein', 'Registered mobile number enter karein → "Send OTP" dabayein.');
  stepCard(doc, 3, 'OTP verify karein', 'SMS par aaye 6-digit OTP enter karein. 5 minute mein expire ho jaata hai.');
  stepCard(doc, 4, 'MPIN enter karein', '4-digit MPIN dalein jo setup ke waqt set kiya gaya tha.');
  stepCard(doc, 5, 'Dashboard', 'Login hone par live stats — aaj ki attendance, total staff, active shifts dikhenge.');

  tipBox(doc, 'Mobile browser mein bhi admin panel kaam karta hai — lekin desktop/laptop par zyada comfortable rahega.');

  spacer(doc, 4);
  sectionHeader(doc, '2', 'Staff Management');

  stepCard(doc, 1, 'Naya staff add karein', '"Staff" → "Add Staff" → naam, phone, role (staff/admin), assigned center bharein.');
  stepCard(doc, 2, 'Staff profile edit karein', 'Staff ke naam par click karein → "Edit" → details update karein → Save.');
  stepCard(doc, 3, 'Staff deactivate karein', 'Staff profile → "Deactivate" → staff app use nahi kar payega (data safe rahega).');
  stepCard(doc, 4, 'MPIN reset karein', 'Staff profile → "Reset MPIN" → naya 4-digit MPIN set karein → staff ko batayein.');
  stepCard(doc, 5, 'Live location dekhin', '"Live Map" tab → map par sab active staff ke GPS pins real-time mein dikhenge.');

  spacer(doc, 4);
  sectionHeader(doc, '3', 'Attendance Management');

  stepCard(doc, 1, 'Aaj ki attendance', 'Dashboard → ya "Attendance" tab → aaj ke saare check-in/out records.');
  stepCard(doc, 2, 'Date filter use karein', 'Date picker se kisi bhi din ki attendance dekh sakte hain.');
  stepCard(doc, 3, 'Selfie photo verify karein', 'Har check-in entry par click karein → selfie photo dekh sakte hain.');
  stepCard(doc, 4, 'Manual correction', 'Attendance record → "Edit" → galat time ya location correct karein → reason note karein.');

  infoBox(doc, 'Geo-fencing kya hai?', 'Staff sirf assigned center ke 100 meter ke andar rahne par check-in kar sakta hai. Yeh proxy attendance rokta hai.');

  spacer(doc, 4);
  sectionHeader(doc, '4', 'Reports Download');

  stepCard(doc, 1, 'Reports tab kholein', '"Reports" section → date range select karein (daily/weekly/monthly).');
  stepCard(doc, 2, 'Excel report', '"Download Excel" → attendance, salary, KM tracking — sab ek file mein.');
  stepCard(doc, 3, 'PDF reports', 'Individual staff ya candidate ki PDF report bhi download kar sakte hain.');
  stepCard(doc, 4, 'Candidate report', 'Candidate section → select karo → "Download PDF" → registration form PDF milega.');

  spacer(doc, 4);
  sectionHeader(doc, '5', 'Leave Management');

  bulletPoint(doc, 'Staff ki leave requests "Leave" tab mein aayengi — pending, approved, rejected status dikhega.');
  bulletPoint(doc, 'Approve ya Reject — ek click mein. Staff ko automatically push notification milega.');
  bulletPoint(doc, 'Leave calendar mein poore mahine ka overview — green (present), red (absent), yellow (leave).');
  bulletPoint(doc, 'Public holidays "Holiday" section se set kar sakte hain — sab staff ko auto-notify hoga.');

  spacer(doc, 4);
  sectionHeader(doc, '6', 'Notices Broadcast');

  stepCard(doc, 1, 'New Notice likhein', '"Notices" → "New Notice" → title aur message likhein (Hindi ya English).');
  stepCard(doc, 2, 'Target choose karein', 'Sab staff ko, ya kisi ek center ke staff ko, ya specific role ko notice bhej sakte hain.');
  stepCard(doc, 3, 'SMS + Push', 'Notice automatically SMS aur push notification dono se jaata hai.');
  stepCard(doc, 4, 'Notice history', 'Saare purane notices "Sent Notices" mein dekh sakte hain — read receipts bhi.');

  warningCard(doc, '!', 'Data Delete Warning', 'Koi bhi report ya attendance data delete karne se pehle hamare support se confirm zaroor karein. Deleted data restore nahi hota.');

  doc.end();
  console.log('✅ Admin User Guide generated');
}

// ─── GUIDE 3: Center Staff Guide ─────────────────────────────────────────────
function generateCenterStaffGuide() {
  _currentPage = 0;
  const doc = createDoc('center-staff-user-guide.pdf', 'Center Staff User Guide', 'Mobile App Guide for Center Staff');

  drawCoverPage(doc,
    'Center Staff\nUser Guide',
    'MPIN login, GPS check-in/out, leave apply, notices — center pe kaam karne wale staff ke liye complete mobile app guide.',
    'For Center Staff / Trainers',
    C.green
  );

  addContentPage(doc);

  para(doc, 'SCMS Field App ek Android mobile application hai jo center staff ke daily kaam ko simple aur transparent banata hai — attendance, leave, notices sab ek jagah.');

  spacer(doc, 8);
  sectionHeader(doc, '1', 'App Download & First Time Login');

  stepCard(doc, 1, 'App install karein', 'Apne Android phone par SCMS Field App install karein — APK link apne admin se maangein.');
  stepCard(doc, 2, 'Phone number enter karein', 'App kholein → registered mobile number enter karein → "Send OTP" tap karein.');
  stepCard(doc, 3, 'OTP verify karein', 'SMS par aaya 6-digit OTP enter karein.');
  stepCard(doc, 4, 'MPIN set karein', 'Pehli baar 4-digit MPIN choose karein — ise yaad rakhein, har baar kaam aayega.');
  stepCard(doc, 5, 'Dashboard', 'Aaj ki shift status, leave balance, notifications — sab ek screen par.');

  tipBox(doc, 'MPIN bhoolne par admin se sampark karein — woh reset kar denge. MPIN kisi ke saath share na karein.');

  spacer(doc, 4);
  sectionHeader(doc, '2', 'Daily Check-In Process');

  stepCard(doc, 1, 'Center par pahunchein', 'Pehle physically apne assigned training center ya work location par aayein.');
  stepCard(doc, 2, '"Check In" button dabayein', 'App home screen par bada "Check In" button dikhega — tap karein.');
  stepCard(doc, 3, 'GPS location verify hogi', 'App GPS se verify karega ki aap assigned center ke 100 meter ke andar hain.');
  stepCard(doc, 4, 'Live selfie kheenchein', 'Front camera se apni live selfie kheenchein. Face clearly dikhna chahiye — mask nahi.');
  stepCard(doc, 5, 'Confirmation dekhein', 'Green tick = check-in successful. Live shift timer shuru ho jaata hai.');

  warningCard(doc, '!', 'Location se bahar check-in nahi hoga', 'Agar aap assigned center se 100m se zyada door hain toh check-in button kaam nahi karega. Yeh policy hai.');

  spacer(doc, 4);
  sectionHeader(doc, '3', 'Check-Out Process');

  stepCard(doc, 1, 'Kaam khatam hone par', 'App par wapas jaayein — home screen par "Check Out" button dikhega.');
  stepCard(doc, 2, 'Check-Out tap karein', '"Check Out" button dabayein → GPS verify hogi → live selfie maangegi.');
  stepCard(doc, 3, 'Daily summary', 'Check-out ke baad aaj ka total hours, location summary dikh jaata hai.');

  spacer(doc, 4);
  sectionHeader(doc, '4', 'Leave Apply Karna');

  stepCard(doc, 1, 'Leave tab kholein', 'Bottom menu mein "Leave" icon tap karein.');
  stepCard(doc, 2, '"Apply Leave" tap karein', 'Leave type chunein: Casual / Sick / Other.');
  stepCard(doc, 3, 'Dates aur reason likhein', 'Start date, end date select karein aur leave ka reason briefly likhein.');
  stepCard(doc, 4, 'Submit karein', 'Admin ko notification jaayegi. Approval ya rejection par aapko bhi notification milegi.');

  tipBox(doc, '1 din pehle leave apply karein jab bhi possible ho — admin ko planning mein madad milti hai.');

  spacer(doc, 4);
  sectionHeader(doc, '5', 'Attendance Calendar');

  bulletPoint(doc, '"Calendar" tab → poore mahine ki attendance ek nazar mein dikhai degi.');
  bulletPoint(doc, 'Har din ka color code: Green = Present, Red = Absent, Yellow = Leave, Blue = Holiday.');
  bulletPoint(doc, 'Kisi date par tap karein → us din ki detail: check-in time, check-out time, hours, GPS location.');
  bulletPoint(doc, 'Agar galti dikh rahi ho — turant admin se sampark karein correction ke liye.');

  spacer(doc, 4);
  sectionHeader(doc, '6', 'Notices Dekhna');

  bulletPoint(doc, '"Notices" tab mein admin ke saare broadcasts dikhenge — title aur message.');
  bulletPoint(doc, 'Internet nahi hone par bhi SMS se notice milega — dono channels active hain.');
  bulletPoint(doc, 'Important notices read karna mandatory hai — admin check kar sakta hai ki kisne padha.');

  spacer(doc, 4);
  sectionHeader(doc, '7', 'Common Problems & Solutions');

  warningCard(doc, '!', 'Check-in nahi ho raha', 'Location services ON karein. Internet check karein. App force-close karein aur dobara try karein.');
  warningCard(doc, '!', 'MPIN bhool gaye', 'Admin se sampark karein — woh aapka MPIN reset kar denge. Phone number ready rakhein.');
  warningCard(doc, '!', 'Selfie reject ho rahi hai', 'Achhi roshni mein selfie kheenchein. Chehra poora frame mein aana chahiye. Mask ya cap nahi.');
  warningCard(doc, '!', 'App crash ho raha hai', 'Phone restart karein. Agar phir bhi problem ho — admin se naya APK link maangein.');

  doc.end();
  console.log('✅ Center Staff User Guide generated');
}

// ─── GUIDE 4: Field Staff Guide ──────────────────────────────────────────────
function generateFieldStaffGuide() {
  _currentPage = 0;
  const doc = createDoc('field-staff-user-guide.pdf', 'Field Staff User Guide', 'GPS Tracking, Candidate Registration, Documents');

  drawCoverPage(doc,
    'Field Staff\n(Mobilizer) Guide',
    'GPS tracking, candidate registration, 7 documents capture, offline mode — field mobilizers ke liye complete guide.',
    'For Field Mobilizers',
    C.saffron
  );

  addContentPage(doc);

  para(doc, 'Field Staff (Mobilizers) ka kaam candidates ko field mein visit karke register karna aur documents collect karna hai. Yeh guide aapko app ka poora use step-by-step sikhayegi.');

  spacer(doc, 8);
  sectionHeader(doc, '1', 'App Setup & Login');

  stepCard(doc, 1, 'App install karein', 'Admin se SCMS Field App ka APK link maangein → Android phone par install karein.');
  stepCard(doc, 2, 'Permissions allow karein', 'Camera, Location aur Storage — teeno permissions ALLOW karein. Bina iske app kaam nahi karega.');
  stepCard(doc, 3, 'Phone number enter karein', 'Registered mobile number → OTP verify karein.');
  stepCard(doc, 4, 'MPIN set karein', 'Pehli baar 4-digit MPIN choose karein — ise yaad rakhein.');

  infoBox(doc, 'Recommended Phone Settings', 'Location: High Accuracy mode ON karein. Battery Saver: OFF rakhein field duty par. Mobile Data: ON rakhein jab bhi available ho.');

  spacer(doc, 4);
  sectionHeader(doc, '2', 'Field Check-In / Check-Out');

  stepCard(doc, 1, 'GPS ON karein', 'Phone mein GPS / Location ON karein. Bina GPS ke check-in nahi hoga.');
  stepCard(doc, 2, '"Check In" dabayein', 'App home → "Check In" button → GPS coordinates save honge → live selfie kheenchein.');
  stepCard(doc, 3, 'Shift timer', 'Check-in ke baad live timer chalega — kitne ghante field mein hain track hota hai.');
  stepCard(doc, 4, 'KM tracking', 'Din bhar ki GPS movement se total distance calculate hoti hai — petrol reimbursement ke liye.');
  stepCard(doc, 5, 'Check-Out', 'Field se wapas aane par "Check Out" → selfie → din ka summary save.');

  tipBox(doc, 'Agar internet nahi hai toh bhi check-in/out hoga — data phone mein save hoga aur internet aane par auto-sync karega.');

  spacer(doc, 4);
  sectionHeader(doc, '3', 'Candidate Registration — Step by Step');

  stepCard(doc, 1, '"Register New Candidate" tap karein', 'App → "Candidates" tab → "+" button ya "Register New".');
  stepCard(doc, 2, 'Personal details bharein', 'Poora naam, pita ka naam, mata ka naam, DOB, gender, category (ST/SC/OBC/General).');
  stepCard(doc, 3, 'Address details', 'Gaon/mohalla, post, block, district, state, pincode — ek-ek field carefully bharein.');
  stepCard(doc, 4, 'Aadhaar details', '12-digit Aadhaar number enter karein. Aadhaar card se milana zaroori hai — typo mat karna.');
  stepCard(doc, 5, 'Bank details', 'Account number, IFSC code, bank ka naam, branch — double check karein.');
  stepCard(doc, 6, 'Documents capture karein', '7 documents live camera se capture karein (neeche list hai).');
  stepCard(doc, 7, 'Review & Submit', 'Sab details check karein → Submit. Admin panel par turant dikhega.');

  spacer(doc, 4);
  sectionHeader(doc, '4', '7 Required Documents — Capture Rules');

  subHeading(doc, 'Documents ki list:');
  bulletPoint(doc, '1. Passport Photo — 3.5×4.5 cm size, white background, face 80% frame mein, clearly visible');
  bulletPoint(doc, '2. Aadhaar Card (Front) — poora card frame mein, naam, DOB, address, photo sab readable');
  bulletPoint(doc, '3. Aadhaar Card (Back) — poora card, address clearly visible, barcode bhi capture ho');
  bulletPoint(doc, '4. Jati Praman Patra — government issued certificate, official seal aur signature clearly visible');
  bulletPoint(doc, '5. Shaikshanik Praman Patra — highest qualification ka certificate (10th/12th/graduation)');
  bulletPoint(doc, '6. Bank Passbook (First Page) — naam, account number, IFSC sab clearly dikh rahe');
  bulletPoint(doc, '7. Hastakshar (Signature) — candidate ka signature white plain paper par — frame mein poora aaye');

  warningCard(doc, '!', 'Gallery se upload BAND hai', 'Koi bhi document gallery ya downloaded photo se submit karna ALLOWED NAHI hai. Sirf live camera capture hoga — audit requirement hai.');

  spacer(doc, 4);
  sectionHeader(doc, '5', 'Offline Mode — Internet Nahi Toh Bhi Kaam Karein');

  stepCard(doc, 1, 'Internet nahi — koi baat nahi', 'App offline bhi poora kaam karta hai. Data phone mein local storage mein save hota hai.');
  stepCard(doc, 2, 'Auto sync', 'Jab bhi 4G ya WiFi milega, sab pending data automatically server par sync ho jaata hai.');
  stepCard(doc, 3, 'Sync indicator', 'Orange dot = sync pending, Green dot = sab synced. Din khatam hone se pehle sync zaroor verify karein.');

  infoBox(doc, 'Daily Routine', 'Roz din khatam karne ke baad WiFi se connect karein aur green sync indicator confirm karein. Isse koi bhi data kabhi nahi khayega.');

  spacer(doc, 4);
  sectionHeader(doc, '6', 'My Candidates — List & Status');

  bulletPoint(doc, '"My Candidates" tab → apne registered saare candidates ki list dikhegi.');
  bulletPoint(doc, 'Status: Pending = admin ne abhi approve nahi kiya. Approved = batch assign ho gaya.');
  bulletPoint(doc, 'Rejected = koi document ya detail galat thi — admin ka reason dekh sakte hain.');
  bulletPoint(doc, 'Kisi candidate par tap → poori profile → "Share PDF" se candidate ko registration proof share karein.');

  spacer(doc, 4);
  sectionHeader(doc, '7', 'Common Problems & Solutions');

  warningCard(doc, '!', 'Check-in fail ho raha hai', 'GPS High Accuracy ON karein. Internet check karein. App restart karein. Location clear karke retry karein.');
  warningCard(doc, '!', 'Camera permission nahi', 'Phone Settings → Apps → SCMS → Permissions → Camera → Allow. Phir app restart karein.');
  warningCard(doc, '!', 'Data sync nahi ho raha', 'WiFi ya mobile data ON karein. App close karke dobara kholein. Orange dot jaane tak wait karein.');
  warningCard(doc, '!', 'MPIN bhool gaye', 'Admin se sampark karein — woh MPIN reset kar denge. Registered phone number ready rakhein.');
  warningCard(doc, '!', 'Candidate submit nahi ho raha', 'Sabhi fields fill hain? Documents 7/7 captured hain? Internet check karein. Offline submit karo — baad mein sync hoga.');

  doc.end();
  console.log('✅ Field Staff User Guide generated');
}

// ── Run all ──────────────────────────────────────────────────────────────────
generateCompanyGuide();
generateAdminGuide();
generateCenterStaffGuide();
generateFieldStaffGuide();
console.log('\n🎉 All 4 guides generated in artifacts/marketing-site/public/guides/');
