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

- Registration flow: welcome screen → "Register as Admin" or "Register as Staff" → OTP verify
- Phone `9999999999` → Demo Admin (Anita Sharma, ADM-001, bypasses registration)
- Phone `9876543210` → Demo Field Staff (bypasses registration)
- OTP is mocked: always `1234`
- `adminCode`: admins get a 6-char invite code on registration; staff can supply it to link to an org

**Pillars**: Discipline, Transparency, Accuracy, Control — surfaced in UI as colored pillar badges.

**Key features**

- Registration: welcome → register-admin / register-staff → OTP verify; `POST /api/staff/register`
- OTP login (`app/(auth)/phone.tsx`, `otp.tsx`)
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

**State**: `contexts/AppContext.tsx` — `register()` + `requestOtp()` + `verifyOtp()` actions; persisted to AsyncStorage at key `@field-staff/state-v1`.

**Maps**: `react-native-maps` is used on native only. The web build uses a schematic SVG-grid placeholder. To keep the import platform-safe, the native map lives in `components/admin/MapView.tsx` with a web stub at `components/admin/MapView.web.tsx` (Metro picks the right one). Do not put `.web.tsx` files inside `app/`, since expo-router's `require.context` would still load the native variant.

**Permissions** (in `app.json`): camera + fine/coarse location, with iOS `infoPlist` strings.
