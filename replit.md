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
- **Mobile:** Expo (React Native)
- **Web Admin:** React with Vite
- **Mapping:** `react-native-maps` (mobile), Leaflet.js (web)
- **PDF Generation:** pdfkit, fontkit

## Where things live

- `/artifacts/field-staff`: Expo mobile app source
- `/artifacts/admin-panel`: React Vite admin panel source
- `/artifacts/api-server`: Express.js backend source
- `/artifacts/api-server/src/db/schema.ts`: Database schema definition
- `/artifacts/api-server/openapi.yaml`: OpenAPI specification
- `/artifacts/api-server/src/lib/push.ts`: Push notification utility
- `/artifacts/field-staff/services/pushNotifications.ts`: Mobile push notification service
- `/artifacts/field-staff/app.json`: Mobile app configuration (permissions, fonts)

## Architecture decisions

- **Offline-first Mobile App:** Uses `AsyncStorage` for data persistence and auto/manual sync, ensuring functionality in low-connectivity environments.
- **Multi-Tenancy:** Achieved via `company_id` foreign keys in most data tables, allowing a single deployment to serve multiple companies with data isolation.
- **Role-Based Access Control:** Differentiates `staff`, `admin`, and `super_admin` roles with distinct API protections and middleware.
- **OpenAPI-driven Development:** Uses Orval to generate API clients from an OpenAPI spec, ensuring type safety and consistency between frontend and backend.
- **Replaced WebView for Document Capture:** Switched from a complex WebView+OpenCV pipeline to `expo-image-picker` for simpler and more reliable document/photo capture.

## Product

- **Mobile App (Field Staff):** MPIN auth, GPS/Selfie check-in/out, KM tracking, candidate management (registration, approval, audit), live shift timer, attendance calendar, leave/holiday management, real-time location tracking, daily outcome reports, push notifications.
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

## Pointers

- **Drizzle ORM Docs:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
- **Expo Docs:** [https://docs.expo.dev/](https://docs.expo.dev/)
- **Orval Docs:** [https://orval.dev/docs/getting-started](https://orval.dev/docs/getting-started)
- **Zod Docs:** [https://zod.dev/](https://zod.dev/)
- **Leaflet.js Docs:** [https://leafletjs.com/](https://leafletjs.com/)