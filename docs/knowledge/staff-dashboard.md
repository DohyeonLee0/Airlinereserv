# Staff Dashboard Guide

Staff, Admin, and SuperAdmin users access the portal at `/dashboard`.

## Overview

- Summary KPIs: bookings, revenue, load factor
- Charts for trends (demo data from stored procedures)

## Master Data

Manage reference data used by flight operations:

| Section | Path | Actions |
|---------|------|---------|
| Airlines | `/dashboard/master/airlines` | Add, delete airlines |
| Airports | `/dashboard/master/airports` | Add, delete airports |
| Aircraft | `/dashboard/master/aircraft` | Add aircraft types |
| Flight Schedules | `/dashboard/master/schedules` | Create recurring schedule templates |

## Flight Generation

Path: `/dashboard/generate`

- Generate actual **flight instances** from schedules for a date range
- Generates seats for each new flight
- Required before customers can book on new dates

## Promotions

Path: `/dashboard/promotions`

- Create promo codes (e.g. SUMMER10)
- Customers can search with promotion tab on home page

## All Bookings

Path: `/dashboard/bookings`

- View all customer bookings across the system
- Search, sort, and paginate
- Staff can inspect any booking (unlike customers who only see their own)

## Reports

Path: `/dashboard/reports`

- Revenue by flight, month, route, seat class
- Load factor statistics
- Tables support search, sort, and pagination

## Staff Approvals (Admin & SuperAdmin only)

Path: `/dashboard/approvals`

- **Admin**: pending **Staff** requests only
- **SuperAdmin**: pending **Staff** and **Admin** requests
- Approve creates an active user account; Reject requires a reason

## Demo data note

Seed data includes flights through mid-June 2026. Home page default search date is **2026-06-10** for presentations.
