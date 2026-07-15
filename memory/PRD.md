# UGrow Naturals — Product Requirements Document

## Overview
A field-service management mobile app for a terrace/kitchen garden installation and maintenance company. Two roles: **Admin** (operations) and **Employee** (field technician).

## Tech Stack
- **Frontend:** Expo Router (React Native + TypeScript), file-based routing under `/app`.
- **Backend:** FastAPI + Motor (async MongoDB).
- **Auth:** JWT (bcrypt/passlib, OAuth2PasswordBearer). Admin auto-seeded on first boot.
- **Storage:** MongoDB collections — `users`, `setups`, `visits`, `notifications`.
- **Reports:** `reportlab` for PDF, Python `csv` for CSV.

## Data Models
- **User**: id, name, email, password_hash, role (admin/employee), mobile, address, profile_photo, status, joining_date, created_at
- **Setup**: id, customer_name, mobile, address, gmap_link, setup_type, installation_date, maintenance_plan, assigned_employee_id, status, created_at
- **Visit**: id, setup_id, employee_id, employee_name, customer_name, check_in_time, check_in_lat/lng, check_out_time, check_out_lat/lng, duration_minutes, status, form (nested), rating, created_at
- **Notification**: id, admin_id, type, title, body, visit_id, setup_id, read, created_at

## Features

### Auth
- POST `/api/auth/login` (form-encoded) → JWT + user; GET `/api/auth/me`
- Admin seed: `admin@ugrow.com` / `Admin@123` (see `/app/memory/test_credentials.md`)

### Admin
- **Dashboard** — 6 stat cards (Today's Visits, Completed, Pending, Working Now, Active Setups, Employees) + Live Activity feed (recent 10 visits) with 20s polling.
- **Employee Management** — CRUD, activate/deactivate.
- **Setup Management** — CRUD, assign employee.
- **Visit Detail** — full form + rating (1–5 stars + comment) + single-visit PDF export.
- **Reports** — filters (date range, status), date-grouped list, bulk CSV/PDF export.
- **Notification Bell** — unread badge, tap opens list, tap notification opens visit detail; auto-marks all read on open.

### Employee
- **Home** — Today's assigned setups with pending / checked-in status.
- **Visit Flow** — Check in (GPS via expo-location) → 10-section maintenance form (Plants, Maintenance, Pesticide, Cleaning, Drip, Problems, Materials, Customer, Summary, Photos) → Check out (GPS + duration).
- **My Visits** — history.
- **Profile** — sign out.

## Design System
- iOS-native structural minimalism (stark white, 1pt borders).
- Primary green `#10B981`, dark brand `#064E3B`, brandSecondary `#D1FAE5`.
- Radius: sm 6 / md 12 / lg 20 / pill 999. Typography 12/14/16/20/24.
- Bottom-tab navigation, Ionicons (Phosphor-like uniform weight), 48pt+ touch targets.
- Sticky glass-bg CTA at bottom of maintenance form.

## Key Endpoints
- `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/users`, `PUT/DELETE /api/users/{id}` (admin only)
- `GET/POST /api/setups`, `GET/PUT/DELETE /api/setups/{id}` (list scoped by role)
- `POST /api/visits/checkin`, `POST /api/visits/{id}/checkout`
- `GET /api/visits` (role-scoped), `GET /api/visits/{id}`
- `POST /api/visits/{id}/rate` (admin only)
- `GET /api/dashboard/stats` (admin only)
- `GET /api/notifications`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all`
- `GET /api/reports/visits?date_from&date_to&status&employee_id&format=csv|pdf`
- `GET /api/visits/{id}/export?format=pdf`

## Push Notifications
Per user choice, real device push (Expo Push API / FCM) is **NOT** implemented in this iteration. In-app notification bell + 20s dashboard polling provides near-real-time UX during preview.

## Verified End-to-End
Backend curl-verified: admin login, employee create, setup create + assign, employee login, role-scoped setups, RBAC 403, check-in, notifications insert, check-out with form + duration, admin rating, dashboard stats, CSV/PDF bulk export, single-visit PDF export. Frontend login → admin dashboard renders correctly.
