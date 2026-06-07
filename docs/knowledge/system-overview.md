# System Overview

CSE305 Air is a demo **airline reservation system** built with Next.js 15 and **MariaDB stored procedures**.

## What you can do

- **Customers** search flights on the home page, pick seats, pay, and manage bookings at `/bookings`.
- **Staff** use the dashboard at `/dashboard` for master data, flight generation, promotions, all bookings, and reports.
- **Admins** additionally approve staff registration requests.
- **SuperAdmins** can approve both Staff and Admin registration requests.

## Tech stack

- Frontend: Next.js, React, Tailwind CSS
- Backend: Next.js API routes calling MariaDB stored procedures
- Auth: JWT session cookie (`AUTH_SECRET`)

## Common pages

| Path | Who | Purpose |
|------|-----|---------|
| `/` | Everyone | Search and book flights |
| `/login` | Everyone | Sign in |
| `/signup` | Everyone | Customer registration |
| `/signup/staff` | Applicants | Request Staff or Admin access (requires approval) |
| `/bookings` | Customers | My bookings, cancel, search/filter |
| `/account` | Customers | Profile |
| `/seats?flight_id=...` | Customers | Seat map and checkout |
| `/dashboard` | Staff+ | Operations portal |

## Demo password

All seeded demo accounts use the same password: **Ars#CSE305!Demo2026**
