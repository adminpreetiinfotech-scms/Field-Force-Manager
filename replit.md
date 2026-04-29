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
  - `PATCH /api/admin/candidates/:id/status`: approve/reject/enroll with remarks; auto-creates notification for submitting staff
  - `GET /api/admin/candidates/csv`: full CSV export
  - `GET /api/candidates/:id/pdf`: generated PDF per candidate
  - `GET /api/notifications?phone=`: staff in-app notifications
  - `PATCH /api/notifications/:id/read` / `PATCH /api/notifications/read-all`: mark read
  - Mobile screens: `app/candidate/register.tsx` (offline draft save, duplicate check, village+course), `app/candidate/list.tsx` (admin verify/reject modal, document preview, status badges), `app/candidate/my-candidates.tsx` (staff own list), `app/notifications.tsx` (notification centre)
  - Shift screen (`app/(staff)/shift.tsx`): notification bell with unread badge in header; "My Candidates" + "Notifications" quick action buttons
  - DB: `candidates` table extended with `status`, `village`, `course`, `verified_by`, `verified_at`, `verification_remarks`, `submitted_by_phone`; new `candidate_notifications` table
- Offline-first sync via AsyncStorage; auto-syncs after ~4s, manual `Sync` button via `SyncBanner`

**State**: `contexts/AppContext.tsx` — `register()` + `requestOtp()` + `verifyOtp()` actions; persisted to AsyncStorage at key `@field-staff/state-v1`.

**Maps**: `react-native-maps` is used on native only. The web build uses a schematic SVG-grid placeholder. To keep the import platform-safe, the native map lives in `components/admin/MapView.tsx` with a web stub at `components/admin/MapView.web.tsx` (Metro picks the right one). Do not put `.web.tsx` files inside `app/`, since expo-router's `require.context` would still load the native variant.

**Permissions** (in `app.json`): camera + fine/coarse location, with iOS `infoPlist` strings.
