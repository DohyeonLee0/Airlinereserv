# User Roles and Permissions

There are four roles in the system: **Customer**, **Staff**, **Admin**, and **SuperAdmin**.

## Customer

- Search flights, book seats, pay
- View and cancel own bookings at `/bookings`
- Manage account at `/account`
- Cannot access `/dashboard`

## Staff

Everything a customer cannot do, plus full **operations dashboard**:

- Overview charts and KPIs
- **Master Data**: airlines, airports, aircraft, flight schedules
- **Flight Generation**: create flights from schedules
- **Promotions**: manage promo codes
- **All Bookings**: view any customer's booking
- **Reports**: revenue and load-factor reports

Staff **cannot** access **Staff Approvals** or approve registration requests.

## Admin

All Staff permissions, plus:

- **Staff Approvals** menu in dashboard sidebar
- Approve or reject **Staff** registration requests only
- Cannot approve **Admin** registration requests

## SuperAdmin

All Admin permissions, plus:

- Approve or reject **Admin** registration requests
- Sees both Staff and Admin pending requests in Staff Approvals

## Role hierarchy

```
SuperAdmin  >  Admin  >  Staff  >  Customer
```

## How roles are enforced

- **Middleware** blocks non-staff from `/dashboard` and non-customers from `/bookings` and `/seats`
- **API routes** check session role (`isStaffRole`, `isAdminRole`)
- **Stored procedures** enforce approval rules for staff registration (`approve_staff_request`, `list_pending_staff_requests`)
