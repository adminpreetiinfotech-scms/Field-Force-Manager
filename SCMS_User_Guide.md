# SCMS — Skill Center Management System
## User Guide / उपयोगकर्ता मार्गदर्शिका
**Praiaiti Infotech | DDU-GKY / JSDMS Training Centers**

---

## विषय सूची (Table of Contents)

1. [System Overview](#1-system-overview)
2. [User Types / Role](#2-user-types)
3. [Admin Panel — Login](#3-admin-panel-login)
4. [Dashboard](#4-dashboard)
5. [Training Centers](#5-training-centers)
6. [Staff Management](#6-staff-management)
7. [Candidates](#7-candidates)
8. [Center Attendance](#8-center-attendance)
9. [Field Attendance](#9-field-attendance)
10. [Live Map](#10-live-map)
11. [Reports](#11-reports)
12. [Notices](#12-notices)
13. [Company Settings](#13-company-settings)
14. [Super Admin Features](#14-super-admin-features)
15. [Field Staff Mobile App](#15-field-staff-mobile-app)

---

## 1. System Overview

SCMS ek **white-label SaaS platform** hai jo DDU-GKY / JSDMS Training Centers ke liye banaya gaya hai.

| Component | Description |
|-----------|-------------|
| **Admin Panel** | Web browser se access — center management, staff, attendance, reports |
| **Field Staff App** | Mobile app (Android/iOS) — field staff ka daily use |
| **API Server** | Backend (automatically manage hota hai) |

**Production URL:**
- Admin Panel: `https://field-force-manager-mobilization.replit.app/admin-panel/`
- Field App: `https://field-force-manager-mobilization.replit.app/`

---

## 2. User Types

| Role | Access |
|------|--------|
| **Super Admin** | Sab companies/centers dekh aur manage kar sakta hai, naye admins create kar sakta hai |
| **Admin** | Apni company ke centers, staff, attendance, reports manage kar sakta hai |
| **Staff (Field)** | Mobile app se check-in/check-out, trips, notices dekh sakta hai |

---

## 3. Admin Panel — Login

**URL:** `https://field-force-manager-mobilization.replit.app/admin-panel/`

### Login Steps:
1. Browser mein Admin Panel URL open karein
2. **Phone Number** daalen (registered number)
3. **OTP** ya **MPIN** se login karein
4. Dashboard automatically open hoga

> **Note:** Pehli baar login par MPIN set karna hoga. OTP registered phone par aayega.

---

## 4. Dashboard

Dashboard par aapko ek nazar mein dikhai dega:

| Card | Description |
|------|-------------|
| **Total Candidates** | System mein register sab candidates |
| **Verified / Enrolled** | Verify ya enroll hue candidates |
| **Staff Today** | Aaj check-in/check-out kiye hue staff |
| **Active Staff** | Currently active field staff |

### Hints / Tips:
- Agar Geo-fence set nahi hai — dashboard warning dikhayega
- Cards par click karke details dekh sakte hain

---

## 5. Training Centers

**Menu:** `Training Centers`

Yahan aap training centers create aur manage kar sakte hain.

### Naya Center Create Karna:

1. **"Add Center"** button click karein
2. Yeh fields bharein:

| Field | Description |
|-------|-------------|
| **Training Center Name** | Center ka poora naam |
| **TC ID** | Training Center ID (e.g. JH-RAN-001) |
| **Courses** | Multiple courses add karein (A, B, C, D, E — jitne chahein) |
| **State** | State select karein |
| **District** | District |
| **Block** | Block / Taluka |
| **PIN Code** | Center ka PIN code |

3. **Save** karein

### Geo-fence Configure Karna:

Geo-fence se yeh decide hota hai ki staff ka check-in valid hai ya nahi (location ke hisaab se).

1. Center select karein
2. **"Set Geo-fence"** ya map icon click karein
3. Map par center ki location mark karein **ya** latitude/longitude manually daalen
4. **Radius** set karein (default: 200 meters)
5. Save karein

> **Important:** Geo-fence set karna zaroori hai — bina iske center attendance track nahi hogi.

### Auto-Population (Candidate Registration):
- Jab koi candidate us center se register karta hai, toh **Training Center Name, TC ID, aur Course** automatically fill ho jaate hain

---

## 6. Staff Management

**Menu:** `Staff`

### Staff List Dekhna:
- Saare registered staff members dikhai denge
- Search box se naam/phone se dhundh sakte hain
- Filter: Active / Inactive

### Naya Staff Add Karna:
1. **"Add Staff"** click karein
2. Yeh information bharein:
   - Naam, Phone Number
   - Role: Field Staff / Center Staff
   - Training Center assign karein (TC ID se linked)
   - Vehicle Type (agar applicable)
3. **Save** karein — staff ko OTP milega registration ke liye

### Staff Ko Center Se Link Karna:
- Staff add karte waqt **Training Center** select karein
- Isse staff automatically us center se linked ho jaayega

### Vehicle KM Tracking:
- Staff ke trips mein odometer readings track hoti hain
- **>20% variance** wali readings **laal (red)** mein highlight hoti hain
- Staff detail mein recent trips ka KM summary dekh sakte hain

---

## 7. Candidates

**Menu:** `Candidates`

### Candidate Registration:
- Candidates web link se khud register kar sakte hain
- Ya admin panel se manually add kar sakte hain

### Status Update Karna:
| Status | Meaning |
|--------|---------|
| **Pending** | Register hua, verify nahi |
| **Verified** | Documents verify ho gaye |
| **Enrolled** | Course mein enroll ho gaya |
| **Rejected** | Reject kiya gaya |

1. Candidate ke saamne status dropdown click karein
2. Naya status select karein
3. Automatically save ho jaata hai

### Edit Candidate:
- Pencil icon click karein
- Details update karein
- Save karein

> **Note:** Changes PDF mein bhi reflect honge (next download par)

---

## 8. Center Attendance

**Menu:** `Center Attendance`

Yahan center staff ki daily attendance track hoti hai (geo-fence ke andar check-in).

### Dekhna:
- Date select karein
- Sabhi center staff ka attendance record dikhai dega
- **Present / Absent / Late** status
- Check-in aur Check-out time

### Filter Options:
- Date wise
- Center wise
- Staff wise

---

## 9. Field Attendance

**Menu:** `Field Attendance`

Field staff (jo bahar jaate hain) ki attendance aur trips yahan track hoti hain.

### Dekhna:
- Date select karein
- Field staff ki trips aur check-in/check-out dikhai dega
- **Distance traveled** aur **KM readings**
- Variance % (agar >20% — laal highlight)

---

## 10. Live Map

**Menu:** `Live Map`

Real-time mein field staff ki location dekh sakte hain.

### Features:
- Map par sab active field staff ke markers dikhai denge
- Click on marker: staff ka naam, last update time
- Auto-refresh hota hai
- Filter: specific staff select kar sakte hain

> **Note:** Staff ki location tab dikhai degi jab unka shift active ho (check-in ke baad)

---

## 11. Reports

**Menu:** `Reports`

### Available Reports:
| Report | Description |
|--------|-------------|
| **Daily Attendance** | Din ke hisaab se staff attendance summary |
| **Monthly Summary** | Mahine ki poori attendance |
| **Trip Report** | Field trips ka detail |
| **KM Report** | Vehicle wise KM traveled |

### Download:
1. Report type select karein
2. Date range set karein
3. **"Download"** click karein — Excel/PDF mein aayega

### Scheduled Reports:
- Reports automatically email par schedule ki ja sakti hain
- Settings mein ja ke schedule configure karein

---

## 12. Notices

**Menu:** `Notices`

### Notice Publish Karna:
1. **"New Notice"** click karein
2. Title aur Content likhen
3. Target select karein: All Staff / Specific Center / Specific Staff
4. **"Publish"** click karein

Staff ko mobile app par notification milegi.

---

## 13. Company Settings

**Menu:** `Settings`

### Kya Configure Kar Sakte Hain:
| Setting | Description |
|---------|-------------|
| **Company Name** | Organization ka naam |
| **Logo** | Company logo upload karein |
| **Project Name** | DDU-GKY project name |
| **License Dates** | Start aur End date |
| **Admin Details** | Admin ka naam, email, phone |
| **Center Geo-fence** | Center ka lat/lng aur radius |

---

## 14. Super Admin Features

Super Admin ke liye extra features:

### Companies / Organizations:
**Menu:** `Super Admin > Companies`

- Nayi company/organization add karein
- Company ka license manage karein
- Har company ki detail mein jaayein

### Create Admin:
**Menu:** `Super Admin > Create Admin`

- Nayi company ke liye admin account banayein
- Phone number, naam, center details bharein

### All Staff View:
**Menu:** `Super Admin > Staff`

- Sab companies ke sare staff ek jagah dekhen
- Filter by company

---

## 15. Field Staff Mobile App

**Download:** App link field staff ko WhatsApp/Email par share karein
**URL:** `https://field-force-manager-mobilization.replit.app/`

### Login:
1. App open karein
2. **Phone Number** daalen
3. **OTP** receive karein → Enter karein
4. **4-digit MPIN** set karein (pehli baar)
5. Aage se sirf MPIN se login hoga

---

### Tab 1: Shift (Check-in / Check-out)

**Subah — Shift Start (Check-in):**
1. "Shift" tab open karein
2. **"Start Shift"** button press karein
3. Location permission allow karein
4. Odometer reading photo click karein (vehicle wale staff ke liye)
5. Confirm karein → Shift start!

**Shaam — Shift End (Check-out):**
1. "Shift" tab open karein
2. **"End Shift"** press karein
3. Odometer reading photo click karein
4. Confirm karein → Shift complete!

> **Note:** Check-in tabhi valid hoga jab aap training center ke Geo-fence ke andar honge (agar center staff hain)

---

### Tab 2: Trips

Field staff ek shift mein multiple trips kar sakte hain:

**Naya Trip Start:**
1. "Trips" tab → **"New Trip"** click karein
2. Destination bharein
3. Starting odometer photo click karein
4. **"Start"** press karein

**Trip Complete Karna:**
1. Wapas "Trips" tab → active trip select karein
2. Ending odometer photo click karein
3. **"End Trip"** press karein

---

### Tab 3: Notices

- Admin ne jo notices publish ki hain woh yahan dikhai dengi
- Unread notices pe badge (notification count) dikhega

---

### Tab 4: Profile

- Apna naam, photo, vehicle details dekh/update kar sakte hain
- **MPIN Change** kar sakte hain
- **Logout** kar sakte hain

---

## Troubleshooting / Samasya Samadhan

| Problem | Solution |
|---------|----------|
| Login nahi ho raha | Phone number check karein, OTP dobara maangein |
| Check-in fail ho raha hai | Location ON karein, Geo-fence area mein ho |
| App slow hai | Internet connection check karein |
| Attendance nahi dikh rahi | Date filter reset karein |
| Report download nahi ho raha | Browser mein popup allow karein |
| Staff location Live Map mein nahi dikh rahi | Staff ka shift active hai ya nahi check karein |

---

## Support

**Praiaiti Infotech**
- System: SCMS v1.0
- Platform: Replit Cloud (Reserved VM)
- Database: PostgreSQL (Production)

---

*Document Version: May 2026*
