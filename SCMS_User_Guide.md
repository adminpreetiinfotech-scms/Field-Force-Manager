# SCMS — Skill Center Management System
## User Guide / उपयोगकर्ता मार्गदर्शिका
**Praiaiti Infotech | DDU-GKY / JSDMS Training Centers**

---

## विषय सूची (Table of Contents)

1. [System Overview](#1-system-overview)
2. [User Roles](#2-user-roles)
3. [Nayi Training Center Register Karna](#3-nayi-training-center-register-karna)
4. [Admin Panel — Login](#4-admin-panel-login)
5. [Dashboard](#5-dashboard)
6. [Training Centers](#6-training-centers)
7. [Staff Management](#7-staff-management)
8. [Candidates](#8-candidates)
9. [Center Attendance](#9-center-attendance)
10. [Field Attendance](#10-field-attendance)
11. [Live Map](#11-live-map)
12. [Reports](#12-reports)
13. [Notices](#13-notices)
14. [Company Settings](#14-company-settings)
15. [Super Admin Features](#15-super-admin-features)
16. [Field Staff Mobile App](#16-field-staff-mobile-app)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. System Overview

SCMS ek **white-label SaaS platform** hai jo DDU-GKY / JSDMS Training Centers ke liye banaya gaya hai. Ek hi system mein field staff tracking, candidate management, attendance, aur reporting sab kuch milta hai.

| Component | Description |
|-----------|-------------|
| **Admin Panel** | Web browser se kholein — centers, staff, attendance, reports manage karein |
| **Field Staff App** | Android / iOS mobile app — staff ka daily use |
| **API Server** | Backend (automatically manage hota hai, aapko kuch nahi karna) |

**Production URLs:**

| Panel | URL |
|-------|-----|
| Admin Panel | `https://field-force-manager-mobilization.replit.app/admin-panel/` |
| Company Registration | `https://field-force-manager-mobilization.replit.app/admin-panel/company-register` |
| Candidate Registration (public) | `https://field-force-manager-mobilization.replit.app/admin-panel/register` |
| Field Staff App | `https://field-force-manager-mobilization.replit.app/` |

---

## 2. User Roles

| Role | Kya kar sakta hai |
|------|-------------------|
| **Super Admin** | Praiaiti Infotech ka account — sab companies dekhe, subscriptions manage kare, kisi bhi company ka admin reset kare |
| **Admin** | Apni company ke training centers, staff, candidates, attendance, reports manage kare |
| **Staff** | Mobile app se shift start/end, trips, notices dekhe — admin panel access nahi |

> **Admin panel sirf Super Admin aur Admin ke liye hai.** Staff sirf mobile app use karta hai.

---

## 3. Nayi Training Center Register Karna

> **Yeh section un organizations ke liye hai jo pehli baar SCMS par join kar rahe hain.**
>
> Ek **organization** (company) kai **training centers** operate kar sakti hai. Pehle organization register karo, phir Admin Panel mein jaake apne centers add karo.

### Step 1 — Registration Key Prapt Karein

**Praiaiti Infotech** se contact karein aur **Admin Registration Key** maangein. Yeh ek secret key hai — bina iske registration nahi hogi. Yeh security ke liye hai taaki koi bhi unauthorized organization register na kar sake.

### Step 2 — Registration Form Bharein

**URL:** `https://field-force-manager-mobilization.replit.app/admin-panel/company-register`

Ya phir Login page par "Nayi training center? Register karein" link par click karein.

Form mein yeh details bharein:

| Field | Description | Zaruri? |
|-------|-------------|---------|
| **Organization Name** | Apni organization ka poora naam (e.g. Jharkhand Skills Academy) | Haan |
| **Project Name** | DDU-GKY / JSDMS — jo bhi applicable ho | Optional |
| **State** | Apna state | Optional |
| **District** | Apna district | Optional |
| **Organization Logo** | PNG ya JPG format mein logo | Optional |
| **Admin Full Name** | Jo iss account ka admin hoga uska naam | Haan |
| **Admin Phone Number** | 10-digit mobile — yahi se login hoga | Haan |
| **Admin Email** | Scheduled reports ke liye useful | Optional |
| **Admin Registration Key** | Praiaiti Infotech se prapt key | Haan |

### Step 3 — Submit Karein

**"Register Training Center"** button click karein. Success screen par aapka organization naam aur admin phone number confirm hoga.

### Step 4 — Pehli Baar Login Karein

1. Admin Panel login page kholen: `https://field-force-manager-mobilization.replit.app/admin-panel/`
2. Registered **Admin Phone Number** daalen → **"Continue"**
3. Phone par **OTP** aayega → enter karein
4. **4-digit MPIN** set karein — yahi aage login ke liye use hoga
5. Dashboard open hoga

### Step 5 — Initial Setup Karein

Registration ke baad yeh kaam zaroor karein:

| Priority | Kaam | Kahan |
|----------|------|-------|
| 1 | Apna training center add karein | **Training Centers** menu |
| 2 | Center ka Geo-fence set karein | Training Center → Set Geo-fence |
| 3 | Staff add karein | **Staff** menu |
| 4 | Candidates manage karna shuru karein | **Candidates** menu |

> **Important:** Ek hi organization (company) ke under kai training centers ho sakte hain — sabko **Training Centers** menu se alag-alag add karein.

---

## 4. Admin Panel — Login

**URL:** `https://field-force-manager-mobilization.replit.app/admin-panel/`

### Login Steps:
1. Admin Panel URL browser mein kholein
2. **Phone Number** (10-digit) daalen → **"Continue"**
3. **4-digit MPIN** enter karein → **"Login"**
4. Dashboard automatically open ho jaayega

### Pehli Baar MPIN Setup:
- Pehle login par MPIN set karna hoga
- Phone par OTP aayega → OTP enter karein → naya 4-digit MPIN set karein
- Aage sirf MPIN se login hoga (OTP nahi maangega)

> **Tip:** MPIN bhool gaye? Settings mein jaake MPIN reset kar sakte hain, ya Super Admin se request karein.

---

## 5. Dashboard

Login ke baad yeh screen dikhti hai — yahan poori organization ki summary ek nazar mein milti hai.

### Stat Cards:

| Card | Kya dikhata hai |
|------|-----------------|
| **Total Candidates** | System mein register hue sab candidates ki ginti |
| **Verified** | Jin candidates ke documents verify ho gaye |
| **Enrolled** | Jin candidates ka course mein enrollment ho gaya |
| **Pending Review** | Naye candidates jinhe abhi verify karna hai (action required) |
| **Pending Approvals** | Staff jo mobile app se join kiye hain — approve karna baaki hai |
| **Staff Today** | Aaj shift mein aaye hue (check-in kiye hue) staff |
| **Active Shifts** | Is waqt shift mein active staff members |

### Quick Actions:
Dashboard par seedhe links milenge:
- **Review Pending Candidates** — candidate verification ke liye
- **Approve Staff Requests** — naye staff approve karne ke liye

### Candidate Status Chart:
- Pie/bar chart mein Pending / Verified / Enrolled / Rejected ka breakdown dikhta hai

### Warnings:
- Agar kisi training center ka **Geo-fence set nahi hai** — dashboard warning dikhayega
- Agar **subscription expire** hone wala ho — alert aayega

---

## 6. Training Centers

**Menu:** `Training Centers`

Yahan apni organization ke saare training centers manage hote hain.

### Naya Center Add Karna:

1. **"Add Center"** button click karein
2. Yeh fields bharein:

| Field | Description | Example |
|-------|-------------|---------|
| **Training Center Name** | Center ka poora official naam | Ranchi Skill Centre |
| **TC ID** | Training Center ID | JH-RAN-001 |
| **Courses** | Jo courses is center mein chalte hain | Electrician, Plumber, Beautician |
| **State** | Center wala state | Jharkhand |
| **District** | Center wala district | Ranchi |
| **Block** | Block / Taluka | Kanke |
| **PIN Code** | Center ka 6-digit PIN | 834008 |

3. **"Save"** click karein

### Geo-fence Set Karna (Zaruri):

Geo-fence se decide hota hai ki center staff ka check-in valid hai ya nahi — unhe center ke andar hi hona chahiye.

1. Center card par click karein → **"Set Geo-fence"** button
2. **Option A:** Map par center ki location pin karein
3. **Option B:** Latitude aur Longitude manually type karein
4. **Radius** set karein (default: 200 meters — badha ya ghata sakte hain)
5. **"Save"** karein

> **Zaroori:** Geo-fence set kiye bina center staff ki attendance track nahi hogi. Dashboard par warning dikhegi.

### Center Edit / Delete Karna:
- Center card par pencil icon → edit
- Delete: center ke andar koi active staff nahi hona chahiye

### Candidate Registration ke Saath Link:
- Jab koi candidate public registration form se register karta hai aur apna Skill Centre naam enter karta hai, toh woh automatically is center se link ho jaata hai

---

## 7. Staff Management

**Menu:** `Staff`

Yahan apni organization ke sare staff members manage hote hain.

### Staff Categories (Do Prakar ke Staff):

| Category | Kaam | Attendance |
|----------|------|------------|
| **Field Staff** | Bahar jaate hain — candidates mobilize karna, visits | GPS + Odometer tracking |
| **Center Staff** | Training center mein hote hain | Geo-fence ke andar check-in |

### Center Staff Roles (Center Staff ke liye):

Center Staff add karte waqt unka role select karna hoga:

| Role | Description |
|------|-------------|
| Center Head | Center ka head / in-charge |
| MIS Executive | Data entry aur reporting |
| Placement Incharge | Placement coordination |
| Trainer | Course trainer |
| IT Trainer | IT / Computer trainer |
| Soft Skills Trainer | Soft skills / personality trainer |
| Receptionist | Front desk |
| Counselor | Student counseling |
| Office Boy | Office support |
| Security Guard | Security |
| Cook | Hostel / canteen cook |
| Cleaning Staff | Housekeeping |

### Naya Staff Add Karna:

1. **"Add Staff"** button click karein
2. Yeh information bharein:

| Field | Description |
|-------|-------------|
| **Name** | Staff ka poora naam |
| **Phone Number** | 10-digit — yahi se mobile app login hoga |
| **Category** | Field Staff ya Center Staff |
| **Center Staff Role** | (sirf center staff ke liye) upar wali list mein se |
| **Training Center** | Kaunse center se linked hai |
| **Area / Territory** | Field staff ka assigned area / zone |
| **Vehicle Type** | 2-Wheeler ya 4-Wheeler (field staff ke liye) |
| **Vehicle Number** | Gaadi ka number (optional) |
| **Employee Code** | Auto-generate hota hai (empCode) |

3. **"Save"** — Staff add ho jaata hai (approvalStatus: pending)

### Staff Approval Flow:

Staff jab mobile app download karke khud join karta hai, ya admin add karta hai — **admin ko approve karna hota hai**:

| Status | Matlab | Action |
|--------|--------|--------|
| **Pending** | Naya join kiya, approve nahi | Approve ya Reject |
| **Approved** | Active staff, app use kar sakta hai | Edit, Disable, Delete |
| **Rejected** | Join reject kiya gaya | — |
| **Disabled** | Account temporarily band | Re-enable kar sakte hain |

- Dashboard par **"Pending Approvals"** badge se reminder milega
- Staff card par green ✓ (Approve) aur red ✗ (Reject) buttons hain

### Staff Search aur Filter:

- Search box: naam, phone number, employee code se dhundho
- Filter: All / Field Staff / Center Staff
- Filter: All / Pending / Approved / Rejected / Disabled

### Staff Detail Dekhna:

Staff card par click karo → detail panel mein milega:
- Recent trips aur KM readings
- Attendance history
- Profile photo
- Vehicle odometer readings

### Vehicle KM Tracking:

- Har trip mein starting aur ending odometer photo click hoti hai
- System automatically distance calculate karta hai
- **>20% variance** (reported vs expected KM) — red highlight hoti hai
- Suspicious readings admin ko alert karti hain

---

## 8. Candidates

**Menu:** `Candidates`

Yahan training center ke candidates (trainee applicants) manage hote hain.

### Candidate Kaise Register Hote Hain:

**Option A — Public Web Form (Recommended):**
- Link share karein: `https://field-force-manager-mobilization.replit.app/admin-panel/register`
- Candidate khud apni details fill karta hai
- Submit hone ke baad "Pending Review" mein aata hai

**Option B — Field Staff se:**
- Field staff mobile app se candidate register kar sakta hai

**Option C — Admin se directly:**
- Admin Panel → Candidates → manually entry (planned feature)

### Candidates List mein kya dikhta hai:

| Column | Description |
|--------|-------------|
| Candidate | Naam, phone, DOB |
| Contact | Mobile number |
| Location | District, State |
| Mobilizer | Kis field staff ne register karaya |
| Registered | Registration date |
| Status | Current status |
| Actions | Edit, status change |

### Status Update Karna:

| Status | Matlab |
|--------|--------|
| **Pending** | Register hua, verify nahi hua |
| **Verified** | Documents check ho gaye |
| **Enrolled** | Course mein officially enroll ho gaya |
| **Rejected** | Reject kiya gaya (reason add kar sakte hain) |

1. Candidate ke Status dropdown click karein
2. Naya status select karein → automatically save hota hai

### Candidate Edit Karna:

- Pencil icon → edit dialog khuolta hai
- Naam, phone, DOB, address, course, skill centre — koi bhi field update karein
- **"Save"** — changes PDF mein bhi reflect honge (next download par)

### Candidate PDF Export:

- Individual candidate ka PDF download kar sakte hain
- PDF mein: photo, personal details, course details, training center info, status

---

## 9. Center Attendance

**Menu:** `Center Attendance`

Center staff (jo training center mein hote hain) ki daily attendance yahan track hoti hai.

### Kaise Kaam Karta Hai:

- Center staff mobile app se **shift start** karta hai
- Check-in tabhi valid hai jab wo **Geo-fence ke andar** ho
- Admin Panel mein real-time attendance dikh jaati hai

### Attendance Dekhna:

1. **Date** select karein (calendar picker)
2. **Training Center** filter karein (sab centers ya specific)
3. List mein dikhega:

| Column | Description |
|--------|-------------|
| Staff Name | Center staff ka naam |
| Role | Center Head, Trainer, etc. |
| Training Center | Kaunse center ka |
| Check-in Time | Shift start time |
| Check-out Time | Shift end time |
| Status | Present / Absent / Late |
| Duration | Kitne ghante kaam kiya |

### Filter Options:
- Date wise
- Center wise
- Staff wise
- Status wise (Present / Absent / Late)

---

## 10. Field Attendance

**Menu:** `Field Attendance`

Field staff (jo bahar jaate hain — mobilizers, etc.) ki trips aur attendance yahan track hoti hai.

### Kya Track Hota Hai:

| Data | Description |
|------|-------------|
| Check-in / Check-out | Shift start aur end time |
| Trips | Ek shift mein kitni trips |
| Destination | Kahan gaye |
| Starting Odometer | Trip start par gaadi ka KM reading |
| Ending Odometer | Trip khatam par gaadi ka KM reading |
| Distance (Reported) | Odometer se calculated distance |
| Variance % | Expected vs reported KM ka difference |

### Variance Warning:
- Agar distance variance **>20%** hai → row **laal (red)** mein highlight hogi
- Yeh suspicious travel indicate karta hai — admin review kare

### Filter Options:
- Date range
- Specific staff member
- Center filter
- Sort by: Date / Staff Name / KM

### Excel Download:
- **"Download Excel"** button → field attendance ka Excel file download hoga
- Date range set karke specific period ka report nikalo

---

## 11. Live Map

**Menu:** `Live Map`

Real-time mein field staff ki current location dekh sakte hain.

### Features:

- Map par **sab active field staff ke markers** dikhai denge (shift active hone par)
- Marker par click karein → staff ka naam, last location update time
- Map **auto-refresh** hota hai
- **Filter:** Specific staff select karein

### Conditions:

- Staff ki location tab dikhti hai jab:
  1. Unka shift active ho (check-in kiya ho)
  2. Mobile app mein location permission ON ho
  3. Internet connection ho

> **Tip:** Agar kisi staff ki location nahi dikh rahi — unka shift active hai ya nahi check karein, aur unse location permission confirm karwayein.

---

## 12. Reports

**Menu:** `Reports`

Teen tarah ki reports available hain — sab Excel mein download hoti hain.

### Available Reports:

| Report | Kya milta hai | Format |
|--------|--------------|--------|
| **Attendance Summary** | Staff-wise check-in days ka count, date range mein | Excel (.xlsx) |
| **Field Attendance** | Trip details, destinations, KM readings, variance | Excel (.xlsx) |
| **Vehicle KM Summary** | Har staff ka total KM traveled, vehicle wise summary | Excel (.xlsx) |

### Report Download Karna:

1. **Report type** select karein (top mein tabs)
2. **Date range** set karein (From Date → To Date)
3. **Center filter** lagayein (optional — sab centers ya specific)
4. **"Download Excel"** click karein — file automatically download ho jaayegi

### Report Preview (Field Attendance):

Download se pehle table mein preview bhi dikh sakta hai:
- Sort by: Date, Staff Name, ya KM
- Variance wali rows red mein highlight

---

### Scheduled Reports (Auto Email):

Reports automatically email par bheji ja sakti hain — manually download karne ki zarurat nahi.

**Setup Karna:**

1. Reports page → **"Scheduled Reports"** section (neeche scroll karein)
2. **Frequency** select karein:
   - `Daily` — har din subah
   - `Weekly` — specific weekday par (e.g. Monday)
   - `Monthly` — specific date par (e.g. 1st of month)
3. **Report Types** choose karein (ek ya zyada select kar sakte hain):
   - Attendance Summary
   - Field Attendance
   - Vehicle KM Summary
4. **Email addresses** add karein (multiple emails allowed — comma se alag karein)
5. **"Save Schedule"** — ab reports automatically email par aayengi

> **Note:** Email configuration Praiaiti Infotech ke server se hoti hai. Agar email nahi aa raha toh support se contact karein.

---

## 13. Notices

**Menu:** `Notices`

Staff ko important announcements, instructions, ya updates bhejne ke liye.

### Notice Publish Karna:

1. **"New Notice"** button click karein
2. **Title** likhen (short — e.g. "Meeting Tomorrow")
3. **Content** likhen (poora message)
4. **Target** select karein:
   - **All Staff** — apni company ke sab staff ko
   - **Specific Center** — kisi ek training center ke staff ko
   - **Specific Staff** — kisi ek individual ko
5. **"Publish"** click karein

Staff ko mobile app par **notification badge** aayega. Unread notices ki ginti dikhegi.

### Notice History:

- Published notices ki list yahan dikhti hai
- Date, title, target, aur status dikh sakta hai

---

## 14. Company Settings

**Menu:** `Settings`

Apni organization ki profile aur settings yahan configure hoti hain.

### Kya Update Kar Sakte Hain:

| Setting | Description |
|---------|-------------|
| **Company Name** | Organization ka official naam |
| **Logo** | PNG / JPG format mein logo upload — admin panel aur reports mein dikhai dega |
| **Project Name** | DDU-GKY / JSDMS — jo applicable ho |
| **State** | Organization wala state |
| **District** | Organization wala district |
| **Admin Name** | Admin ka naam update |
| **Admin Email** | Reports ke liye email |
| **Admin Phone** | (change ke liye Super Admin se contact karein) |

### Logo Update Karna:

1. Settings → logo section
2. **"Upload Logo"** / **"Change Logo"** click karein
3. PNG ya JPG file select karein
4. Preview dikhai dega → **"Save"** karein

> **Note:** Subscription dates (license start/end) Super Admin manage karta hai — aap sirf dekh sakte hain, change nahi kar sakte.

---

## 15. Super Admin Features

**Yeh section sirf Praiaiti Infotech ke Super Admin ke liye hai.**

Super Admin ko Admin Panel mein extra menu milta hai.

---

### Companies / Organizations

**Menu:** `Super Admin → Companies`

Sab registered organizations ki list yahan dikhti hai.

**Kya kar sakte hain:**
- Organizations dhundho (search by name, project, state, admin)
- Company ka **Active / Inactive** status toggle karein
- Company ka **Subscription** activate / deactivate karein
- Kisi bhi company ki detail mein jaayein (click karein)

**Company Detail Page mein:**

| Feature | Description |
|---------|-------------|
| **Stats** | Total staff, candidates, activity |
| **Subscription Details** | Plan, start date, end date |
| **Set Plan & Dates** | Subscription ki dates set karein |
| **Extend Subscription** | Expiry date extend karein |
| **Reset Admin MPIN** | Agar admin MPIN bhool gaya — reset karo (admin ko dobara OTP se MPIN set karna hoga) |
| **Toggle Subscription** | Active ↔ Inactive |

---

### Create Admin

**Menu:** `Super Admin → Create Admin`

Kisi naye organization ke liye directly admin account banana (registration form ke bina bhi):

1. Organization details bharein (naam, state, district, project)
2. Admin ka naam aur phone number daalen
3. **Admin Registration Key** enter karein
4. **"Create"** — organization + admin account ban jaata hai

---

### All Staff View

**Menu:** `Super Admin → Staff`

- **Sab companies ke sab staff** ek jagah
- Filter by company / organization
- Har staff ka status, category, attendance history dekh sakte hain

---

## 16. Field Staff Mobile App

Yeh app field staff aur center staff dono use karte hain.

### App Download / Access:

- **URL:** `https://field-force-manager-mobilization.replit.app/`
- Yeh link WhatsApp ya Email par staff ko bhejein
- Browser mein kholein — "Add to Home Screen" option se app jaise install ho sakta hai

### Pehli Baar Login:

1. App open karein
2. **Phone Number** (10-digit) daalen → **"Continue"**
3. Phone par **OTP** aayega → enter karein
4. **4-digit MPIN** set karein
5. Ab se sirf MPIN se login hoga

> **Note:** Admin ne pehle staff ko system mein add kiya ho aur approve kiya ho tabhi login hoga. Pending staff ko "Approval pending" message milega.

---

### Tab 1: Shift (Check-in / Check-out)

**Subah — Shift Start (Check-in):**
1. **"Shift"** tab open karein
2. **"Start Shift"** button press karein
3. Location permission allow karein
4. Vehicle wale staff: **odometer photo** click karein (gaadi ka KM reading)
5. Confirm karein → shift start!

**Shaam — Shift End (Check-out):**
1. **"Shift"** tab → **"End Shift"** press karein
2. Vehicle wale staff: ending odometer photo click karein
3. Confirm karein → shift complete!

**Center Staff ke liye:**
> Check-in sirf tab valid hoga jab aap training center ke **Geo-fence ke andar** honge. Bahar se check-in fail hoga.

**Field Staff ke liye:**
> Check-in kahi se bhi ho sakta hai — GPS location track hoti hai.

---

### Tab 2: Trips

Field staff ek shift mein multiple trips kar sakte hain.

**Naya Trip Start Karna:**
1. **"Trips"** tab → **"New Trip"** button
2. **Destination** type karein (kahan ja rahe hain)
3. **Starting odometer photo** click karein
4. **"Start Trip"** press karein

**Trip Complete Karna:**
1. Wapas "Trips" tab → active trip select karein
2. **Ending odometer photo** click karein
3. **"End Trip"** press karein → trip ka KM calculate ho jaata hai

> **Center Staff ke liye Trip tab nahi hoti** — unka kaam center ke andar hota hai.

---

### Tab 3: Notices

- Admin ne jo notices publish ki hain woh yahan dikhai dengi
- **Badge (number)** unread notices ki ginti batata hai
- Notice click karein → poora message padhein

---

### Tab 4: Profile

| Feature | Description |
|---------|-------------|
| **Profile Photo** | Photo update kar sakte hain |
| **Vehicle Details** | Gaadi ka number / type update |
| **MPIN Change** | Purana MPIN daalen → naya set karein |
| **Logout** | App se logout karein |

---

## 17. Troubleshooting

### Admin Panel se Sambandhit Samasya:

| Samasya | Sambhavit Kaaran | Hal |
|---------|-----------------|-----|
| Login nahi ho raha | Phone number registered nahi, ya MPIN galat | Super Admin se contact karein ya MPIN reset karwayein |
| "Account not found" | Phone number admin ne add nahi kiya | Admin se kaho phone number add karein |
| Attendance report mein data nahi | Date filter galat, ya staff ne check-in nahi kiya | Date range dobara check karein |
| Report download nahi ho raha | Browser popup block kar raha hai | Browser settings mein popup allow karein |
| Company register nahi ho rahi | Registration Key galat hai | Praiaiti Infotech se sahi key maangein |
| Staff pending mein atki hai | Admin ne approve nahi kiya | Staff page → pending staff → Approve karein |
| Candidate list nahi dikh rahi | Filter active hai | Filters reset karein |

### Mobile App se Sambandhit Samasya:

| Samasya | Sambhavit Kaaran | Hal |
|---------|-----------------|-----|
| Check-in fail ho raha hai (center staff) | Geo-fence ke bahar hain | Training center ke bilkul paas jaayein |
| Location track nahi ho rahi | Location permission OFF | Mobile Settings → App → Location → Always Allow |
| OTP nahi aa raha | Network issue ya wrong number | Network check karein, 2-3 minute wait karein, retry |
| "Approval pending" message | Admin ne approve nahi kiya | Admin se approve karwayein |
| App slow hai | Slow internet | WiFi ya strong signal area mein try karein |
| Trip start nahi ho raha | Shift active nahi | Pehle "Start Shift" karein, phir trip start karein |
| Staff location Live Map mein nahi | Shift active nahi ya location OFF | Shift active confirm karein, location permission check karein |

---

## Support

**Praiaiti Infotech**

Kisi bhi technical samasya ke liye Praiaiti Infotech se contact karein.

- System: **SCMS v1.0**
- Platform: Replit Cloud (Reserved VM)
- Database: PostgreSQL (Production)
- Admin Panel: `https://field-force-manager-mobilization.replit.app/admin-panel/`

---

*Document Version: May 2026 | Praiaiti Infotech*
