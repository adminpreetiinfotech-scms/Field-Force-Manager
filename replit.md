# Workspace

## Overview

This pnpm workspace monorepo, built with TypeScript, provides a comprehensive solution for field operations management, targeting distribution/utility staff and operations administrators. It includes a mobile-first Expo app for field staff and a React Vite web-based admin panel for managers.

The project aims to streamline field activities such as attendance, vehicle KM tracking, and candidate management, ensuring discipline, transparency, accuracy, and control. It supports multi-company/multi-tenant operations with robust authentication, real-time tracking, and comprehensive reporting capabilities. The mobile app features offline-first sync, while the admin panel offers advanced management functionalities.

## User Preferences

I want iterative development.
Ask before making major changes.
I prefer to use `pnpm` as the package manager.
I do not want you to make changes to the folder `artifacts/admin-panel`.

## System Architecture

The project is a pnpm monorepo using Node.js 24 and TypeScript 5.9. The backend is built with Express 5, PostgreSQL, and Drizzle ORM, with Zod for validation. API codegen is handled by Orval from an OpenAPI spec.

**Core Components:**

- **Mobile App (`artifacts/field-staff`):** An Expo mobile app for Android/iOS.
    - **Authentication:** MPIN-based login with phone number, scrypt hashing, and lockout mechanisms. Supports admin and staff roles.
    - **Key Features:** Selfie + GPS check-in/out, live shift timer with GPS tracking, vehicle odometer check-in/out (KM tracking), trip ledger, candidate management (registration, duplicate checks, admin approval/rejection, audit logs, PDF generation, notifications), Staff Leaderboard (top 5 by km/trips/candidate count with Today/Week/Month filter), Candidate Notifications (real-time status alerts to mobilizers), Attendance Calendar (monthly view with present/partial/absent color-coded days, summary strip, day detail card with check-in/out times, trips, GPS distance, and Odometer vs GPS comparison card with variance % indicator), and Course Picker during center staff registration (modal list from center's courses jsonb array with search filter).
    - **Leave & Holiday Management (v1.7):** Full leave lifecycle for all staff (field + center). Staff: apply for Casual (12/yr) / Sick (6/yr) / Other leave via "Leaves" tab, view balance, cancel pending requests. Holiday Calendar tab shows company-defined holidays with type (national/regional/company), next-holiday banner, upcoming filter, year picker. Admin mobile: dedicated Leave & Holidays screen (tab in Records area, link from dashboard card) — approve/reject pending leaves with optional rejection reason, add/delete company holidays, see pending leave count badge. DB: `leaves` + `holidays` tables. API: POST /api/leaves/apply, GET /api/leaves/my, DELETE /api/leaves/:id, GET /api/admin/leaves, PATCH /api/admin/leaves/:id, POST /api/admin/holidays, DELETE /api/admin/holidays/:id, GET /api/holidays.
    - **Center Staff Attendance (v1.6):** Dedicated attendance dashboard for center staff replacing the field-staff Shift screen. Features: selfie + geo-fence verified check-in/out (via existing `/attendance/check-in` and `/attendance/check-out` flows), live geo-fence distance banner (inside/outside center), today's status card (check-in time, check-out time, hours worked), monthly summary strip (present/partial/absent counts + % bar), quick links to attendance calendar and notices. Tab bar shows "Attendance" icon instead of "Shift" and hides Trips tab for center staff. Admin mobile dashboard shows center staff attendance stats (total/present/absent/violations) via `CenterStaffAttendanceCard`, with "View all →" navigating to `/(admin)/center-attendance` screen (date navigation, per-staff cards with check-in/out times, geo-fence proof, hours, status badge, Excel export via `/api/admin/center-attendance/xlsx`).
    - **Vehicle Type at Check-in (v1.5):** Field staff now select their vehicle type (🏍️ 2-Wheeler / 🚗 4-Wheeler) at each check-in as a separate step (step 2), before entering the odometer reading (step 3). Selected vehicle type is stored in the checkin event payload as `vehicleType`. Profile default pre-selects the card. Center staff skip this step.
    - **Odometer vs GPS Comparison (v1.5):** `/api/activity/attendance-calendar` per-day response now includes `startOdometer`, `endOdometer`, `odometerKm`, `vehicleType` fields. Attendance Calendar day detail card shows a 4-column breakdown (Start Odo / End Odo / Odo KM / GPS KM) with a variance banner (green ≤15%, red >15%).
    - **Offline-first:** Data syncs via AsyncStorage with auto and manual sync options.
    - **Real-time Tracking:** Staff location pinging every 30s, displayed on an admin map with 15s polling.
    - **Reporting:** Daily Outcome Reports for staff with WhatsApp sharing, Admin Ride Reports (CSV export), Staff List Excel export (GET /api/admin/staff/export — styled workbook with 16 columns, download button in both admin panel and mobile admin staff screen), **Daily KM Summary** (GPS vs Odometer comparison for all field staff on a given date — Section 4 in mobile admin Reports screen, with CSV + Excel download, variance color-coded per staff card).
    - **UI/UX:** Uses Expo Router, `react-native-maps` (native only), themed with a focus on clear information hierarchy. Candidate forms feature bilingual labels (Hindi/English) and structured sections (A-G) with inline validation, passport photo upload, and signature capture. PDF reports leverage embedded fonts (Noto Sans Devanagari) for proper rendering.
    - **Permissions:** Camera and location permissions requested with `app.json` configuration.
    - **Document Scanner (v4):** Hybrid mode — EAS Custom Dev Build uses `react-native-document-scanner-plugin` (Android CameraX+MLKit / iOS VisionKit, native pro edge detection + built-in crop UI). Expo Go falls back to WebView+OpenCV pipeline with manual crop. No code changes needed when switching between modes.
- **Admin Panel (`artifacts/admin-panel`):** A React Vite web app for management.
    - **Authentication:** Two-step phone + MPIN login, storing user in `localStorage`. Uses `x-admin-phone` header for API calls.
    - **Key Features:** Dashboard for live stats, Staff Management (full lifecycle: approve/reject/disable/enable/soft-delete, Edit Profile dialog, View Profile & Performance dialog with lifetime stats/recent trips), Candidate list with search/filter, Report downloads (Excel, candidate PDFs), Notices Management (create/view/delete broadcast notices with priority, type, target staff, expiry, and read/unread status tracking — triggers Twilio SMS), and Live Staff Map (Leaflet.js + OpenStreetMap, green/amber/gray markers by recency, staff sidebar with search & status filter, auto-refresh every 30s, click-to-popup with GPS coords and last-seen time).
    - **Staff Management Tabs:** All / Pending / Approved / Disabled / Rejected — contextual action buttons per status. Confirm dialogs for Disable and Delete.
    - **Live Map library:** react-leaflet + leaflet (installed as devDependencies).
- **API Server (`artifacts/api-server`):** Express.js backend.
    - **Database:** PostgreSQL with Drizzle ORM.
    - **Multi-Tenancy:** `companies` table and `company_id` FK in all major data tables. Supports `staff`, `admin`, and `super_admin` roles.
    - **Company Branding:** Stores company logos in Replit GCS object storage. Provides public endpoint for company branding details (name, logo URL, project name, state, district).
    - **Admin Routes:** Comprehensive API for dashboard stats, staff management (deactivate, enable, delete), candidate status updates, and reports. All admin routes protected by `requireAdmin` middleware with `companyId` scoping. Company logo/profile routes require admin auth with own-company verification (403 if wrong company).
    - **Security (v1.0.2):** Fixed previously unprotected `/admin/pending-staff`, `/admin/staff/:id/approve`, `/admin/staff/:id/reject` routes. Added auth + cross-company guards to `/companies/:id/logo` and `/companies/:id/profile`.
    - **Super Admin:** Dedicated routes for managing companies (list, status, subscription, MPIN reset) and listing all staff across all companies (GET /api/super-admin/staff — includes email, centerName, projectName, state, district, area, lastLocationAt, isOnShift).
    - **Subscription System (v1.1):** Full plan/expiry management on companies table (plan: basic/standard/premium, subscriptionStartDate, subscriptionEndDate, paymentStatus: paid/pending/expired). Auto-expiry blocks login (mpin.ts), check-in (activity.ts), and candidate registration (candidates.ts) when subscriptionEndDate < now. Super Admin sets/extends subscription via PATCH /api/super-admin/companies/:id. Company admin dashboard shows expiry warning banner (red if expired, red if 1 day, amber if ≤3 days) via GET /api/admin/company/subscription.
    - **Company Admin Create (v1.2):** Super Admin creates company admin via POST /api/super-admin/company-admin. Fields: name, phone, companyId (required), email (optional), initialMpin (optional — uses same scrypt hash scheme as mpin.ts). Validates 10-digit Indian mobile, blocks duplicate phones (409), returns empCode + adminCode. UI: /super-admin/create-admin page with form + success detail card (copy buttons for phone, empCode, adminCode).
    - **Company Settings (v1.2):** Company Admin can update own company branding via /settings page — name, logo (base64 upload to GCS), scheme/project, center/branch, state, district. Uses existing PATCH /api/companies/:id/profile (now accepts centerName) + PATCH /api/companies/:id/logo. companies table has new center_name column. Super Admin sees a "use All Companies section" info card on /settings.
    - **TC ID + Caste Cert Flow (v1.3):** companies table has new tc_id column. candidates table has caste_cert_available (yes/no) + caste_name columns. TC ID auto-prints on all PDF registration forms (fetched from company branding). candidateIdCode is auto-set to aadhaarNumber on form submission. For SC/ST/OBC candidates: "Caste Certificate Available? Yes/No" radio in Documents section — if Yes → normal cert upload; if No → caste/tribe name input + auto-generated Hindi self-declaration page replaces caste cert page in PDF. Company Settings page has TC ID field. DB migration applied: ALTER TABLE companies ADD COLUMN tc_id text; ALTER TABLE candidates ADD COLUMN caste_cert_available text; ALTER TABLE candidates ADD COLUMN caste_name text;
    - **Course Picker + Staff Export (v1.4):** staff table has new trainer_course column. During center staff self-registration, after selecting a center a "Course / Subject" section appears — if center has courses configured (centers.courses jsonb), a searchable modal picker is shown; otherwise a free-text input. trainerCourse saved on /api/staff/register. Staff Excel export via GET /api/admin/staff/export (requireAdmin, 16-column styled workbook with alternate row shading). Download button added to admin panel Staff Management page and mobile admin staff screen (expo-file-system + expo-sharing for native). DB migration applied: ALTER TABLE staff ADD COLUMN trainer_course text;
- **Common Libraries:**
    - **API Client:** Generated using Orval, with custom fetch for injecting `x-admin-phone` header.
    - **State Management:** `AppContext.tsx` handles global state, persisted to AsyncStorage.

## External Dependencies

- **pnpm workspaces:** Monorepo management
- **Node.js:** Runtime environment (v24)
- **TypeScript:** Language (v5.9)
- **Express.js:** Web application framework (v5)
- **PostgreSQL:** Relational database
- **Drizzle ORM:** TypeScript ORM for PostgreSQL
- **Zod:** Schema declaration and validation library (`zod/v4`)
- **drizzle-zod:** Zod integration for Drizzle ORm
- **Orval:** OpenAPI client code generator
- **esbuild:** Bundler for CJS output
- **Expo:** Framework for universal native apps
- **React Native Maps:** Mapping component for React Native (native only)
- **React Vite:** Frontend framework for the admin panel
- **AsyncStorage:** Persistent key-value storage for React Native
- **Replit GCS Object Storage:** For storing company logos and other files.
- **`@expo-google-fonts/noto-sans-devanagari`:** For Hindi font support in the mobile app.
- **pdfkit:** PDF generation library (used server-side).
- **fontkit (patched v2.0.4):** Font handling for PDF generation.