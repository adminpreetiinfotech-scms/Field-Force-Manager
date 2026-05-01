# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### `artifacts/field-staff` — Field Staff Manager (Expo mobile app)

Mobile-first field operations app for distribution/utility staff and ops admins.

**Roles & demo login**

- Registration flow: welcome screen → "Register as Admin" or "Register as Staff" → phone entry → MPIN setup
- Login flow: phone entry → MPIN entry (4-digit PIN, scrypt-hashed)
- Phone `9999999999` → Demo Admin (Anita Sharma, ADM-001)
- Phone `9876543210` → Demo Field Staff
- 3 failed MPIN attempts → 15-minute lockout
- `adminCode`: admins get a 6-char invite code on registration; staff can supply it to link to an org

**Auth routes**

- `POST /api/auth/check-phone` — check if phone is registered and MPIN is set
- `POST /api/auth/login-mpin` — verify MPIN, return user (with lockout/disable checks)
- `POST /api/auth/set-mpin` — set/reset MPIN for registered user (scrypt)

**Pillars**: Discipline, Transparency, Accuracy, Control — surfaced in UI as colored pillar badges.

**Key features**

- MPIN login (`app/(auth)/phone.tsx`, `app/(auth)/mpin.tsx`)
- Registration: welcome → register-admin / register-staff → MPIN setup; `POST /api/staff/register`
- Selfie + GPS check-in / check-out (`app/attendance/check-in.tsx`)
- Live shift timer with auto-kilometer GPS tracking (`app/(staff)/index.tsx`)
- Meter reading capture with photo + consumer no. + GPS (`app/meter/add.tsx`)
- Trip ledger (`app/(staff)/trips.tsx`)
- Admin dashboard, live map, tamper-resistant records, and ride report CSV export (`app/(admin)/`)
- Ride report: date-range + staff filter; `GET /api/activity/trip-report`; CSV download via Blob (web) or expo-sharing (native)
- **Candidate Management (10 features)**:
  - `POST /api/candidates`: submit with staff security gate (403 if staff not yet approved), `submittedByPhone` recorded
  - `POST /api/candidates/check-duplicate`: pre-submit check by phone or aadhaar; returns `{isDuplicate, field, existingName}`
  - `GET /api/candidates/my?phone=`: staff view their own submitted candidates
  - `GET /api/admin/candidates`: admin list with search (name/phone) + status/village/course/mobilizer filters
  - `PATCH /api/admin/candidates/:id/status`: approve/reject/enroll with remarks; auto-creates notification for submitting staff; writes audit log entry
  - `GET /api/admin/candidates/csv`: CSV export with optional `status`, `from` (YYYY-MM-DD), `to` (YYYY-MM-DD), `mobilizer` query filters
  - `GET /api/candidates/:id/pdf`: generated PDF per candidate
  - `GET /api/notifications?phone=`: staff in-app notifications
  - `PATCH /api/notifications/:id/read` / `PATCH /api/notifications/read-all`: mark read
  - Mobile screens: `app/candidate/register.tsx` (offline draft save, duplicate check, village+course), `app/candidate/list.tsx` (admin verify/reject modal, document preview, status badges), `app/candidate/my-candidates.tsx` (staff own list), `app/notifications.tsx` (notification centre)
  - `GET /api/admin/candidate-stats`: summary counts by status, today's submissions, unique mobilizers breakdown
  - `GET /api/admin/permissions?phone=`: returns role + approvalStatus + canSubmitCandidates for any phone
  - `GET /api/admin/audit-log`: paginated audit log with optional `candidateId`/`phone` filter
  - Role-based middleware: `requireAdmin(req,res,next)` in `routes/admin.ts` + `isAdminPhone()` / `isApprovedStaff()` helpers
  - Shift screen (`app/(staff)/shift.tsx`): notification bell with unread badge in header; "My Candidates" + "Notifications" quick action buttons
  - Admin dashboard (`app/(admin)/dashboard.tsx`): candidate stats panel (Total / Today / Pending / Verified / Enrolled / Rejected + mobilizer count badge)
  - DB: `candidates` table has 40+ columns: all personal/address/identity/education/bank/document/status fields; `candidate_notifications` table; `candidate_audit_log` table (every status change tracked)
  - New fields added: `email`, `mother_name`, `marital_status`, `religion`, `pwd`, `disability_type`, `bpl`, `bpl_number`, `police_station`, `post_office`, `district`, `state`, `pin`, `year_of_passing`, `bank_branch`, `skill_centre_name`, `mobilizer`, `candidate_id_code`, `signature_path`
  - PDF style: official JSDMS reference-matching layout — 3-column letterhead (English left | JSDMS logo center | Hindi right), photo box top-right (115×130pt), big "मेगा स्कील सेन्टर" Hindi title, "STUDENT / CANDIDATE REGISTRATION FORM" bordered box, A-G section bands (navy+amber accent), underline-style fields per section, Aadhaar 12-box grid in 3 groups of 4, document checklist (F section + footer inline), Hindi note box, declaration + signature area (G section)
  - PDF JSDMS logo: `artifacts/api-server/src/fonts/jsdms_logo.jpeg` — copied to `dist/fonts/` by `build.mjs`; falls back to concentric-circle placeholder if file missing
  - PDF Hindi font: Noto Sans Devanagari TTF embedded via pdfkit (fonts in `src/fonts/`; `build.mjs` copies them to `dist/fonts/` at build time; fontkit v2.0.4 has a GPOS null-anchor bug patched in `scripts/patches/fontkit-gpos-null-anchor.js` run via root postinstall)
  - Mobile form (`register.tsx`): JSDMS/DDUKK paper-form header (centered bilingual, navy accent bar, blue-tinted bg), 7 collapsible sections A-G (Personal/Address/Aadhaar/Education/Bank/Documents/Declaration) each with navy band + amber left accent, 12-box Aadhaar digit input, dual Hindi+English two-line field labels (English in Inter_600SemiBold, Hindi in NotoSansDevanagari_400Regular), passport photo box, signature upload, all 30+ fields; inline validation; Hindi font loaded via `@expo-google-fonts/noto-sans-devanagari` (400Regular/500Medium/700Bold variants added to `useFonts` in `_layout.tsx`); `splitBilingual()` helper auto-detects first Devanagari char and splits label text for both `FieldLabel` and `DocUploadCard` components
  - Secure file upload: server rejects non-image MIME types (returns 400) and files > 6 MB; client `pickImage` also guards before upload
- Offline-first sync via AsyncStorage; auto-syncs after ~4s, manual `Sync` button via `SyncBanner`

**Real-time Staff Tracking** (`app/(admin)/map.tsx`):
- `GET /api/admin/live-locations` — returns all non-deleted staff with `lastLat`, `lastLng`, `lastLocationAt`, `isOnShift`; polled every 15 s by admin map
- `POST /api/staff/ping-location` — staff device sends `{ staffId, lat, lng }` every 30 s while shift is active; updates `last_lat`, `last_lng`, `last_location_at` on staff row
- `POST /api/activity` (checkin) now also sets `is_on_shift=true` + updates location; checkout sets `is_on_shift=false`
- Admin map: fetches live-locations on mount and polls every 15 s; merges server data over local demo data; shows a green/red live-status pill (green = synced, red = offline) with time-since-last-sync
- Staff shift.tsx: throttled ping — fires at most once per 30 s inside `watchPositionAsync` callback while checked in; fire-and-forget (`.catch(() => {})`)
- DB columns added: `last_lat double precision`, `last_lng double precision`, `last_location_at timestamp`, `is_on_shift boolean`

**Admin Staff Management** (`app/(admin)/dashboard.tsx` `StaffManagementSection`):
- `GET /api/admin/staff-list` — all non-deleted staff with `disabledAt` flag
- `PATCH /api/admin/staff/:id/disable` — prevent login/submissions; blocked at MPIN login route
- `PATCH /api/admin/staff/:id/enable` — restore access
- `DELETE /api/admin/staff/:id` — soft-delete (sets `deletedAt`); candidate records preserved for reports
- Confirmation modal before delete; inline Disable/Enable toggle; admin accounts protected (cannot disable/delete)
- DB columns added: `disabledAt timestamp`, `deletedAt timestamp` on `staff` table

**Staff Daily Outcome Report & WhatsApp Share** (`app/(staff)/shift.tsx` `DailyReportModal`):
- "Daily Outcome Report" button in shift quick actions (green, opens bottom-sheet modal)
- `GET /api/staff/daily-report?staffId=&date=` — returns check-in time, candidate counts (today/pending/verified), trip count, total km
- Modal shows: check-in/out time, today's candidates, pending/verified counts, trips, distance
- "Share on WhatsApp" button — generates formatted text report and opens `whatsapp://send` (or WhatsApp web on web)
- Falls back to local attendance/trip state if server data unavailable

**Admin Profile / Organization Settings** (`app/account-settings.tsx`):
- `PATCH /api/staff/profile` — update name, email, organization, centerName, projectName, state, district (body includes all); validates email format server-side
- DB columns added: `email text`, `center_name text`, `project_name text`, `state text`, `district text` on `staff` table
- Admin registration screen (`app/(auth)/register-admin.tsx`) now accepts all fields with sectioned form; org fields are optional at registration time

**Staff Registration / Staff Profile Fields Expansion**:
- Staff registration (`app/(auth)/register-staff.tsx`): All 7 fields now required — Name, Mobile (10-digit), Email, Center/Branch Name, Scheme/Project Name, State, District. Sectioned into Personal / Organization / Location / Admin Code groups with inline validation.
- Staff profile (`app/(staff)/profile.tsx`): "Account Details" card shows email, centerName, projectName, state, district when set.
- Admin mobilizer detail (`app/(admin)/mobilizer/[id].tsx`): Identity card shows email, centerName, projectName, state+district. "Edit Profile" button opens a bottom-sheet modal for admin to edit all fields via `PATCH /api/admin/staff/:id/profile`.
- `PATCH /api/admin/staff/:id/profile` — new endpoint for admin editing staff fields (name, email, centerName, projectName, state, district, area, organization).
- Daily Field Report (`DailyReportModal`): Shows Center/Branch Name, Scheme/Project, Location (district+state) in report header and footer.
- Shift header (`ReportContextBar`): Shows `centerName` (or falls back to `organization`) as the center line.
- `AppContext.User` type extended with `centerName`; all auth/update flows (register, loginWithMpin, setupMpin, updateProfile) propagate it.
- `GET /api/admin/staff-list` and `GET /api/staff/:staffId/profile-stats` both return centerName, email, projectName, state, district.
- Auth DTO (`mpin.ts`) and staff DTO (`staff.ts`) both return all new fields on login/register/update.

**State**: `contexts/AppContext.tsx` — `register()` + `setPendingPhone()` + `checkPhone()` + `loginWithMpin()` + `setupMpin()` + `updateProfile()` actions; persisted to AsyncStorage at key `@field-staff/state-v1`.

**Maps**: `react-native-maps` is used on native only. The web build uses a schematic SVG-grid placeholder. To keep the import platform-safe, the native map lives in `components/admin/MapView.tsx` with a web stub at `components/admin/MapView.web.tsx` (Metro picks the right one). Do not put `.web.tsx` files inside `app/`, since expo-router's `require.context` would still load the native variant.

**Permissions** (in `app.json`): camera + fine/coarse location, with iOS `infoPlist` strings.
