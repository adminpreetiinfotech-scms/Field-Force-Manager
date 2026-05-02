# Workspace

## Overview

This pnpm workspace monorepo, built with TypeScript, provides a comprehensive solution for field operations management, targeting distribution/utility staff and operations administrators. It includes a mobile-first Expo app for field staff and a React Vite web-based admin panel for managers.

The project aims to streamline field activities such as attendance, meter reading, and candidate management, ensuring discipline, transparency, accuracy, and control. It supports multi-company/multi-tenant operations with robust authentication, real-time tracking, and comprehensive reporting capabilities. The mobile app features offline-first sync, while the admin panel offers advanced management functionalities.

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
    - **Key Features:** Selfie + GPS check-in/out, live shift timer with GPS tracking, meter reading capture, trip ledger, candidate management (registration, duplicate checks, admin approval/rejection, audit logs, PDF generation, notifications), Staff Leaderboard (top 5 by km/trips/candidate count with Today/Week/Month filter), and Candidate Notifications (real-time status alerts to mobilizers).
    - **Offline-first:** Data syncs via AsyncStorage with auto and manual sync options.
    - **Real-time Tracking:** Staff location pinging every 30s, displayed on an admin map with 15s polling.
    - **Reporting:** Daily Outcome Reports for staff with WhatsApp sharing, Admin Ride Reports (CSV export).
    - **UI/UX:** Uses Expo Router, `react-native-maps` (native only), themed with a focus on clear information hierarchy. Candidate forms feature bilingual labels (Hindi/English) and structured sections (A-G) with inline validation, passport photo upload, and signature capture. PDF reports leverage embedded fonts (Noto Sans Devanagari) for proper rendering.
    - **Permissions:** Camera and location permissions requested with `app.json` configuration.
- **Admin Panel (`artifacts/admin-panel`):** A React Vite web app for management.
    - **Authentication:** Two-step phone + MPIN login, storing user in `localStorage`. Uses `x-admin-phone` header for API calls.
    - **Key Features:** Dashboard for live stats, staff list management (approve/reject, disable/enable, soft-delete), candidate list with search/filter, report downloads (Excel, candidate PDFs), and Notices Management (create/view/delete broadcast notices with priority, type, target staff, expiry, and read/unread status tracking).
- **API Server (`artifacts/api-server`):** Express.js backend.
    - **Database:** PostgreSQL with Drizzle ORM.
    - **Multi-Tenancy:** `companies` table and `company_id` FK in all major data tables. Supports `staff`, `admin`, and `super_admin` roles.
    - **Company Branding:** Stores company logos in Replit GCS object storage. Provides public endpoint for company branding details (name, logo URL, project name, state, district).
    - **Admin Routes:** Comprehensive API for dashboard stats, staff management (deactivate, enable, delete), candidate status updates, and reports.
    - **Super Admin:** Dedicated routes for managing companies (list, status, subscription, MPIN reset).
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