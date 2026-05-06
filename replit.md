# Field Operations Management Platform

A monorepo for streamlining field activities and operations administration for distribution/utility staff and managers.

## Run & Operate

- **Install dependencies:** `pnpm install`
- **Run API Server:** `pnpm --filter=api-server dev`
- **Run Admin Panel:** `pnpm --filter=admin-panel dev`
- **Run Mobile App:** `pnpm --filter=field-staff start`
- **Build API Server:** `pnpm --filter=api-server build`
- **Generate API Client:** `pnpm --filter=api-server orval`
- **Generate Drizzle Migrations:** `drizzle-kit generate:pg` (from `artifacts/api-server`)
- **Push DB Schema:** `drizzle-kit push:pg` (from `artifacts/api-server`)

**EAS Build Commands** (run from `artifacts/field-staff/`, requires `eas-cli` login):
- `pnpm eas:build:dev` — Development APK with custom dev client (for testing native modules)
- `pnpm eas:build:preview` — Preview APK for internal distribution/testing
- `pnpm eas:build:production` — Production AAB for Play Store submission
- `pnpm eas:build:production-apk` — Production APK (for direct install)
- `pnpm eas:update:preview "message"` — Push OTA JS update to preview channel
- `pnpm eas:update:production "message"` — Push OTA JS update to production channel

**Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string
- `API_BASE_URL`: Base URL for the API server
- `GCS_SERVICE_ACCOUNT_KEY`: Google Cloud Storage service account key
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`: Twilio credentials for SMS
- `EXPO_PUSH_NOTIFICATION_ACCESS_TOKEN`: Expo token for push notifications

## Stack

- **Monorepo:** pnpm workspaces
- **Runtime:** Node.js 24
- **Language:** TypeScript 5.9
- **Backend:** Express.js 5
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Validation:** Zod 4
- **API Codegen:** Orval
- **Mobile:** Expo SDK 54 (React Native 0.81)
- **Web Admin:** React with Vite
- **OTA Updates:** expo-updates ~29.0 with EAS channels
- **Mapping:** `react-native-maps` (mobile), Leaflet.js (web)
- **PDF Generation:** pdfkit, fontkit

## Where things live

- `/artifacts/field-staff`: Expo mobile app source
- `/artifacts/field-staff/app.json`: Mobile app config (permissions, OTA, EAS project ID)
- `/artifacts/field-staff/eas.json`: EAS build profiles (development/preview/production)
- `/artifacts/field-staff/hooks/useOtaUpdate.ts`: OTA update check hook
- `/artifacts/admin-panel`: React Vite admin panel source
- `/artifacts/api-server`: Express.js backend source
- `/artifacts/api-server/src/db/schema.ts`: Database schema definition
- `/artifacts/api-server/openapi.yaml`: OpenAPI specification
- `/artifacts/api-server/src/lib/push.ts`: Push notification utility
- `/artifacts/field-staff/services/pushNotifications.ts`: Mobile push notification service
- `/artifacts/field-staff/services/activitySync.ts`: Offline queue with exponential backoff

## Architecture decisions

- **Offline-first Mobile App:** Uses `AsyncStorage` for data persistence; `activitySync.ts` queue with exponential backoff (30s→60s→120s→300s) and network-aware drain via `expo-network`.
- **OTA Updates via EAS:** `expo-updates` with per-channel routing (`preview`/`production`). JS-only fixes can be pushed without a Play Store release. `useOtaUpdate` hook prompts staff to reload.
- **Multi-Tenancy:** Achieved via `company_id` foreign keys in most data tables, allowing a single deployment to serve multiple companies with data isolation.
- **Role-Based Access Control:** Differentiates `staff`, `admin`, and `super_admin` roles with distinct API protections and middleware.
- **OpenAPI-driven Development:** Uses Orval to generate API clients from an OpenAPI spec, ensuring type safety and consistency between frontend and backend.

## Product

- **Mobile App (Field Staff):** MPIN auth, GPS/Selfie check-in/out, KM tracking, candidate management (registration, approval, audit), live shift timer, attendance calendar, leave/holiday management, real-time location tracking, daily outcome reports, push notifications, OTA auto-update.
- **Admin Panel (Managers):** Two-step phone + MPIN auth, dashboard with live stats, staff lifecycle management, candidate search/filter, report downloads (Excel, PDFs), notices management (broadcast SMS/push), live staff map.
- **API Server:** Secure backend for mobile and admin applications, handles authentication, data persistence (PostgreSQL + Drizzle), multi-tenancy, company branding, subscription management, super admin functionalities, and various reporting endpoints.

## User preferences

I want iterative development.
Ask before making major changes.
I prefer to use `pnpm` as the package manager.
I do not want you to make changes to the folder `artifacts/admin-panel`.

## Gotchas

- **GCS Service Account:** Ensure the `GCS_SERVICE_ACCOUNT_KEY` environment variable is correctly set for object storage operations (e.g., company logos).
- **Mobile Push Notifications:** Requires `EXPO_PUSH_NOTIFICATION_ACCESS_TOKEN` for sending notifications via Expo.
- **API Client Regeneration:** After any API changes, remember to run `pnpm --filter=api-server orval` to regenerate the API client and ensure type safety.
- **Drizzle Migrations:** Always generate and push Drizzle migrations (`drizzle-kit generate:pg` then `drizzle-kit push:pg`) after schema changes in `artifacts/api-server/src/db/schema.ts`.
- **OTA Updates only in production builds:** `useOtaUpdate` is a no-op in Expo Go and development builds (`Updates.isEnabled === false`). It only fires in `preview` and `production` EAS builds.
- **Orval codegen is BROKEN:** Do not run `pnpm --filter @workspace/api-spec run codegen`.

## Pointers

- **Drizzle ORM Docs:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
- **Expo Docs:** [https://docs.expo.dev/](https://docs.expo.dev/)
- **EAS Build Docs:** [https://docs.expo.dev/build/introduction/](https://docs.expo.dev/build/introduction/)
- **EAS Update Docs:** [https://docs.expo.dev/eas-update/introduction/](https://docs.expo.dev/eas-update/introduction/)
- **Orval Docs:** [https://orval.dev/docs/getting-started](https://orval.dev/docs/getting-started)
- **Zod Docs:** [https://zod.dev/](https://zod.dev/)
- **Leaflet.js Docs:** [https://leafletjs.com/](https://leafletjs.com/)
