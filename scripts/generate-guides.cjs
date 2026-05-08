const PDFDocument = require('../artifacts/api-server/node_modules/pdfkit');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../artifacts/marketing-site/public/guides');

const COLORS = {
  navy: '#1a3272',
  saffron: '#f97316',
  green: '#16a34a',
  gray: '#64748b',
  lightGray: '#f1f5f9',
  darkText: '#1e293b',
  white: '#ffffff',
};

function createDoc(filename) {
  const doc = new PDFDocument({ 
    size: 'A4', 
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    info: { Creator: 'SCMS by Preeti Infotech' }
  });
  const stream = fs.createWriteStream(path.join(OUTPUT_DIR, filename));
  doc.pipe(stream);
  return { doc, stream };
}

function drawHeader(doc, title, subtitle, badgeText) {
  // Navy header bg
  doc.rect(0, 0, doc.page.width, 140).fill(COLORS.navy);
  
  // Logo area
  doc.circle(60, 50, 18).fill(COLORS.saffron);
  doc.fontSize(14).fillColor(COLORS.white).font('Helvetica-Bold').text('SC', 51, 43);

  // Title
  doc.fontSize(22).fillColor(COLORS.white).font('Helvetica-Bold').text('SCMS', 90, 30);
  doc.fontSize(9).fillColor('#93c5fd').font('Helvetica').text('Skill Center Management System — By Preeti Infotech', 90, 56);

  // Badge
  doc.roundedRect(doc.page.width - 180, 25, 150, 26, 13)
    .fill(COLORS.saffron);
  doc.fontSize(9).fillColor(COLORS.white).font('Helvetica-Bold')
    .text(badgeText, doc.page.width - 175, 32, { width: 140, align: 'center' });

  // Guide title
  doc.fontSize(16).fillColor(COLORS.white).font('Helvetica-Bold').text(title, 60, 85);
  doc.fontSize(10).fillColor('#bfdbfe').font('Helvetica').text(subtitle, 60, 108);
  
  doc.y = 160;
}

function sectionTitle(doc, text) {
  doc.moveDown(0.5);
  doc.rect(60, doc.y, doc.page.width - 120, 28).fill(COLORS.navy);
  doc.fontSize(11).fillColor(COLORS.white).font('Helvetica-Bold')
    .text(text, 70, doc.y - 22, { width: doc.page.width - 140 });
  doc.moveDown(0.8);
}

function step(doc, number, title, desc) {
  const y = doc.y;
  // Circle number
  doc.circle(75, y + 8, 10).fill(COLORS.saffron);
  doc.fontSize(9).fillColor(COLORS.white).font('Helvetica-Bold').text(number, 71, y + 3);
  // Title + desc
  doc.fontSize(11).fillColor(COLORS.darkText).font('Helvetica-Bold').text(title, 95, y, { width: doc.page.width - 155 });
  doc.fontSize(9.5).fillColor(COLORS.gray).font('Helvetica').text(desc, 95, doc.y + 2, { width: doc.page.width - 155 });
  doc.moveDown(0.9);
}

function bullet(doc, text) {
  const y = doc.y;
  doc.circle(72, y + 5, 3).fill(COLORS.saffron);
  doc.fontSize(9.5).fillColor(COLORS.darkText).font('Helvetica').text(text, 85, y, { width: doc.page.width - 145 });
  doc.moveDown(0.4);
}

function note(doc, text) {
  doc.rect(60, doc.y, doc.page.width - 120, 32).fill('#fef3c7');
  doc.rect(60, doc.y - 32, 4, 32).fill(COLORS.saffron);
  doc.fontSize(9).fillColor('#92400e').font('Helvetica-Bold')
    .text('NOTE: ', 70, doc.y - 28, { continued: true })
    .font('Helvetica').text(text, { width: doc.page.width - 150 });
  doc.moveDown(0.8);
}

function drawFooter(doc, pageNum) {
  const y = doc.page.height - 45;
  doc.rect(0, y, doc.page.width, 45).fill(COLORS.navy);
  doc.fontSize(8).fillColor('#93c5fd').font('Helvetica')
    .text('SCMS by Preeti Infotech  |  scmsdigital.com  |  Support: WhatsApp', 60, y + 10, { align: 'left', width: doc.page.width - 120 })
    .text(`Page ${pageNum}`, 0, y + 10, { align: 'right', width: doc.page.width - 60 });
}

// ─── GUIDE 1: Company Registration ─────────────────────────────────────────

function generateCompanyGuide() {
  const { doc } = createDoc('company-registration-guide.pdf');
  drawHeader(doc, 'Company Registration Guide', 'Naya account setup karne ka complete guide — Step by Step', 'For Owners / Directors');

  sectionTitle(doc, '1. SCMS Account Register Kaise Karein');
  step(doc, '1', 'Website par jaayein', 'Browser mein scmsdigital.com kholein aur "Book Demo" button par click karein.');
  step(doc, '2', 'WhatsApp par contact karein', 'Hamare team se WhatsApp par baat karein. Aapki company ka naam, state, aur center count batayein.');
  step(doc, '3', 'Account activation', 'Team aapka company account activate karegi aur Super Admin credentials WhatsApp par bhejegi.');
  step(doc, '4', 'Plan choose karein', 'Basic (10 staff), Standard (50 staff), ya Premium (unlimited) — apni zaroorat ke hisaab se plan choose karein.');

  sectionTitle(doc, '2. Company Profile Setup');
  step(doc, '1', 'Login karein', 'Super Admin panel par login karein: scmsdigital.com/super-admin');
  step(doc, '2', 'Company details bharein', 'Company naam, address, state, district, registered mobile number aur email add karein.');
  step(doc, '3', 'Logo upload karein', 'Company ka official logo upload karein — yeh PDF reports aur app mein dikh0ega.');
  step(doc, '4', 'Subscription verify karein', 'Dashboard par subscription status aur expiry date check karein.');

  sectionTitle(doc, '3. Pehla Admin Account Banana');
  step(doc, '1', 'Admin tab kholein', 'Super Admin dashboard mein "Admins" section mein jaayein.');
  step(doc, '2', 'Admin add karein', '"New Admin" button par click karein. Naam, phone number aur MPIN set karein.');
  step(doc, '3', 'Admin ko batayein', 'Admin ko unka phone number aur MPIN share karein. Woh Admin Panel par login kar sakenge.');
  step(doc, '4', 'Test login', 'Admin se verify karwayein ki woh scmsdigital.com/admin-panel par successfully login ho pa rahe hain.');

  note(doc, 'Account activation ke liye hamare WhatsApp support se zaroor sampark karein. Akele setup karne ki koshish na karein.');

  sectionTitle(doc, '4. Subscription Plans');
  bullet(doc, 'Basic Plan — ₹2,000/month: 10 staff tak, GPS attendance, basic reporting');
  bullet(doc, 'Standard Plan — ₹5,000/month: 50 staff tak, AI face verification, offline app, Excel exports');
  bullet(doc, 'Premium Plan — ₹10,000/month: Unlimited staff, multi-center, priority support, dedicated account manager');
  bullet(doc, 'Sabhi plans mein 1 mahine ka FREE trial shamil hai');
  bullet(doc, 'Annual payment par special discount available hai — team se poochein');

  drawFooter(doc, 1);
  doc.end();
  console.log('✅ Company Registration Guide generated');
}

// ─── GUIDE 2: Admin User Guide ───────────────────────────────────────────────

function generateAdminGuide() {
  const { doc } = createDoc('admin-user-guide.pdf');
  drawHeader(doc, 'Admin User Guide', 'Admin panel ka poora walkthrough — Staff, Attendance, Reports, Notices', 'For Admins / Center Managers');

  sectionTitle(doc, '1. Admin Panel Login');
  step(doc, '1', 'URL kholein', 'Browser mein scmsdigital.com/admin-panel kholein.');
  step(doc, '2', 'Phone number dalein', 'Apna registered mobile number enter karein aur OTP verify karein.');
  step(doc, '3', 'MPIN enter karein', '4-digit MPIN enter karein jo aapko setup ke waqt diya gaya tha.');
  step(doc, '4', 'Dashboard', 'Login hone par main dashboard dikhega — live stats, staff count, aaj ki attendance summary.');

  sectionTitle(doc, '2. Staff Management');
  step(doc, '1', 'Naya staff add karein', '"Staff" section mein jaayein → "Add Staff" → naam, phone, role, assigned center bharein.');
  step(doc, '2', 'Staff edit/remove', 'Kisi bhi staff ke naam par click karein → Edit ya Deactivate karein.');
  step(doc, '3', 'MPIN reset', 'Staff MPIN bhool jaaye toh — Staff profile → "Reset MPIN" → naya MPIN set karein.');
  step(doc, '4', 'Staff location', 'Live Map section mein jaayein — map par sab active staff ke GPS pins dikhenge.');

  sectionTitle(doc, '3. Attendance Management');
  step(doc, '1', 'Aaj ki attendance', 'Dashboard par ya Attendance tab mein aaj ke check-in/out records dekh sakte hain.');
  step(doc, '2', 'Date filter', 'Kisi bhi date ki attendance dekhne ke liye date picker use karein.');
  step(doc, '3', 'Manual correction', 'Agar koi galti ho — attendance record par click karein → Edit karein aur reason note karein.');
  step(doc, '4', 'Selfie photos', 'Har check-in ki selfie photo click karke dekh sakte hain — verification ke liye.');

  sectionTitle(doc, '4. Reports Download');
  step(doc, '1', 'Reports section', '"Reports" tab mein jaayein. Date range select karein.');
  step(doc, '2', 'Excel report', '"Download Excel" par click karein — attendance, salary calculation, KM tracking sab ek file mein.');
  step(doc, '3', 'PDF reports', 'Individual staff ya candidate ki PDF reports bhi download ho sakti hain.');
  step(doc, '4', 'Schedule report', 'Monthly report automatically email par bhi schedule ki ja sakti hai — Settings mein.');

  sectionTitle(doc, '5. Leave Management');
  bullet(doc, 'Staff ki leave requests "Leave" tab mein aayengi');
  bullet(doc, 'Approve ya Reject — ek click mein, staff ko automatically notification milega');
  bullet(doc, 'Leave calendar mein poore mahine ka overview dekh sakte hain');
  bullet(doc, 'Public holidays bhi admin panel se set kar sakte hain');

  sectionTitle(doc, '6. Notices Broadcast');
  step(doc, '1', 'Notice likhein', '"Notices" tab → "New Notice" → title aur message likhein.');
  step(doc, '2', 'Target choose karein', 'Sab staff ko ya kisi specific center ke staff ko notice bhej sakte hain.');
  step(doc, '3', 'SMS + Push', 'Notice SMS aur push notification dono ke zariye jaata hai — internet nahi toh bhi SMS milega.');

  note(doc, 'Koi bhi report ya data delete karne se pehle hamare support se confirm zaroor karein. Deleted data restore nahi hota.');

  drawFooter(doc, 1);
  doc.end();
  console.log('✅ Admin User Guide generated');
}

// ─── GUIDE 3: Center Staff Guide ─────────────────────────────────────────────

function generateCenterStaffGuide() {
  const { doc } = createDoc('center-staff-user-guide.pdf');
  drawHeader(doc, 'Center Staff User Guide', 'Mobile app use karne ka complete guide — Login, Attendance, Leave', 'For Center Staff / Trainers');

  sectionTitle(doc, '1. App Download & Login');
  step(doc, '1', 'App install karein', 'Apne Android phone par SCMS Field App install karein — link aapke admin se maangein.');
  step(doc, '2', 'Phone number dalein', 'App kholein → apna registered mobile number enter karein → OTP verify karein.');
  step(doc, '3', 'MPIN set karein', 'Pehli baar login par 4-digit MPIN set karein. Yeh MPIN yaad rakhein — baar baar kaam aayega.');
  step(doc, '4', 'Dashboard', 'Login ke baad aapka dashboard dikhega — aaj ki shift status, notifications, leave balance.');

  sectionTitle(doc, '2. Check-In / Check-Out');
  step(doc, '1', 'Center par pahuncho', 'Pehle apne assigned training center ya work location par physically pahunchein.');
  step(doc, '2', 'Check-In button', '"Check In" button par tap karein. App GPS location lega aur selfie maangega.');
  step(doc, '3', 'Live selfie', 'Camera se apni live selfie kheenchein — gallery se photo nahi chalegi. Face clearly dikh0na chahiye.');
  step(doc, '4', 'Confirmation', 'Green tick aane par check-in confirm ho jaata hai. Timer shuru ho jaata hai.');
  step(doc, '5', 'Check-Out', 'Kaam khatam hone par "Check Out" button dabayein → phir se selfie → done.');

  note(doc, 'Check-in tab hi hoga jab aap assigned location ke 100 meter ke andar honge. Location services ON rakhein.');

  sectionTitle(doc, '3. Leave Apply Karna');
  step(doc, '1', 'Leave section', 'App mein "Leave" tab par jaayein.');
  step(doc, '2', 'New request', '"Apply Leave" par tap karein → leave type chunein (casual/sick/other).');
  step(doc, '3', 'Dates aur reason', 'Start date, end date aur leave ka reason likhein.');
  step(doc, '4', 'Submit', 'Submit karein — admin ko notification jaayegi. Approval hone par aapko bhi notification milegi.');

  sectionTitle(doc, '4. Notices Dekhna');
  bullet(doc, 'Admin jo bhi notice bhejega woh app ke "Notices" tab mein dikhega');
  bullet(doc, 'SMS bhi aayega — internet nahi hone par bhi notice milega');
  bullet(doc, 'Important notices ka jawab dena zarori hai — admin se confirm karein');

  sectionTitle(doc, '5. Attendance Calendar');
  bullet(doc, '"Calendar" tab mein poore mahine ki attendance dekh sakte hain');
  bullet(doc, 'Green = present, Red = absent, Yellow = half day, Blue = holiday');
  bullet(doc, 'Kisi date par tap karein toh us din ki detail dikhegi — check-in time, check-out time, location');

  sectionTitle(doc, '6. Common Problems & Solutions');
  step(doc, '!', 'Check-in nahi ho raha', 'Location services aur internet check karein. App force close karke dobara try karein.');
  step(doc, '!', 'MPIN bhool gaye', 'Admin se sampark karein — woh aapka MPIN reset kar denge.');
  step(doc, '!', 'Selfie reject ho rahi hai', 'Achhi roshni mein chehra clear dikhayen. Mask ya cap nahi pehnen.');

  drawFooter(doc, 1);
  doc.end();
  console.log('✅ Center Staff User Guide generated');
}

// ─── GUIDE 4: Field Staff Guide ──────────────────────────────────────────────

function generateFieldStaffGuide() {
  const { doc } = createDoc('field-staff-user-guide.pdf');
  drawHeader(doc, 'Field Staff (Mobilizer) User Guide', 'GPS tracking, Candidate registration, Document capture — Poora guide', 'For Field Mobilizers');

  sectionTitle(doc, '1. App Login');
  step(doc, '1', 'App install', 'SCMS Field App apne Android phone par install karein — admin se APK link maangein.');
  step(doc, '2', 'Login', 'Phone number enter karein → OTP verify karein → MPIN set karein.');
  step(doc, '3', 'Permissions', 'App Camera, Location aur Storage access maangegi — teeno ko ALLOW karein. Bina iske app kaam nahi karega.');

  sectionTitle(doc, '2. Field Check-In / Check-Out');
  step(doc, '1', 'Location ON karein', 'Phone mein GPS location ON karein. Bina GPS ke check-in nahi hoga.');
  step(doc, '2', 'Check-In', '"Check In" dabayein → GPS coordinates save honge → live selfie kheenchein.');
  step(doc, '3', 'Shift timer', 'Check-in ke baad live timer chalega — kitne ghante field mein hain yeh track hota hai.');
  step(doc, '4', 'KM tracking', 'Din bhar ka safar automatically track hota hai — petrol reimbursement ke liye useful.');
  step(doc, '5', 'Check-Out', 'Field se wapas aane par "Check Out" dabayein → selfie → din ka report save.');

  sectionTitle(doc, '3. Candidate Registration — Step by Step');
  step(doc, '1', '"New Candidate" tab', 'App mein "Candidates" → "Register New" par tap karein.');
  step(doc, '2', 'Personal details', 'Candidate ka poora naam, pita ka naam, mata ka naam, DOB, gender, category (ST/SC/OBC/General) bharein.');
  step(doc, '3', 'Address details', 'Gaon/mohalla, post, block, district, state, pincode sab carefully bharein.');
  step(doc, '4', 'Aadhaar details', '12-digit Aadhaar number enter karein. Aadhaar se match karna zaroori hai.');
  step(doc, '5', 'Bank details', 'Bank account number, IFSC code, bank ka naam aur branch bharein.');
  step(doc, '6', 'Document capture', 'Teeno required documents live camera se capture karein (gallery nahi chalegi).');
  step(doc, '7', 'Submit', 'Sab details check karke Submit karein. Admin panel par turant dikh jaata hai.');

  sectionTitle(doc, '4. Document Capture Rules');
  bullet(doc, 'Passport Photo — 3.5×4.5 cm, white background, face clearly visible');
  bullet(doc, 'Aadhaar Front — poora card frame mein, sabhi details readable');
  bullet(doc, 'Aadhaar Back — poora card frame mein, address clearly visible');
  bullet(doc, 'Jati Praman Patra — government issued, seal aur sign visible');
  bullet(doc, 'Shaikshanik Praman Patra — highest qualification ka certificate');
  bullet(doc, 'Bank Passbook — first page jisme naam, account number, IFSC clearly dikh rahe');
  bullet(doc, 'Hastakshar — candidate ka signature white paper par kara karein aur capture karein');

  note(doc, 'Koi bhi document gallery se upload karna BAND hai. Sirf live camera capture allowed hai — audit ke liye.');

  sectionTitle(doc, '5. Offline Mode');
  step(doc, '1', 'Internet nahi hai?', 'Koi dikkat nahi! App offline bhi kaam karta hai. Data phone mein save hota rehta hai.');
  step(doc, '2', 'Auto sync', 'Jab bhi 4G ya WiFi milega, data automatically server par sync ho jaata hai.');
  step(doc, '3', 'Sync status', 'App mein orange indicator dikhega jab data sync hona pending ho. Green = synced.');

  sectionTitle(doc, '6. My Candidates List');
  bullet(doc, '"My Candidates" tab mein apne registered saare candidates ki list dikhegi');
  bullet(doc, 'Pending = admin ne abhi approve nahi kiya, Approved = batch assign ho gaya');
  bullet(doc, 'Kisi candidate par tap karein → poori profile dekh sakte hain → PDF bhi share kar sakte hain');

  sectionTitle(doc, '7. Common Problems');
  step(doc, '!', 'Check-in nahi ho raha', 'GPS ON karein, internet check karein, app restart karein.');
  step(doc, '!', 'Camera permission nahi', 'Phone Settings → Apps → SCMS → Permissions → Camera ON karein.');
  step(doc, '!', 'Data sync nahi ho raha', 'Internet connection check karein. App close karke dobara kholein.');
  step(doc, '!', 'MPIN bhool gaye', 'Admin se sampark karein — woh reset kar denge.');

  drawFooter(doc, 1);
  doc.end();
  console.log('✅ Field Staff User Guide generated');
}

// Run all
generateCompanyGuide();
generateAdminGuide();
generateCenterStaffGuide();
generateFieldStaffGuide();
console.log('\n🎉 All 4 guides generated in artifacts/marketing-site/public/guides/');
