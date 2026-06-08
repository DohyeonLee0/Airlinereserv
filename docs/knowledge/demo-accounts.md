# Demo Accounts

Use these accounts to explore the system. Password for all: **Ars#CSE305!Demo2026**

## Customer accounts

| Email | Name | Notes |
|-------|------|-------|
| john.smith@example.com | John Smith | Primary demo customer with many sample bookings |
| mary.watson@example.com | Mary Watson | Customer |
| gildong.hong@example.com | Gildong Hong | Customer |
| minji.kim@example.com | Minji Kim | Customer |

After login, customers are redirected to **My Bookings** (`/bookings`).

## Staff accounts

| Email | Role | Display name | Access level |
|-------|------|--------------|--------------|
| alice.manager@example.com | Staff | Alice Manager | Operations only — no staff approvals |
| alex.admin@example.com | Admin | Alex Admin | Operations + approve **Staff** signup requests |
| sam.supervisor@example.com | SuperAdmin | Sam Supervisor | Operations + approve **Staff and Admin** signup requests |

After login, staff are redirected to **Dashboard** (`/dashboard`).

## Staff signup flow

1. Go to `/signup/staff`
2. Choose requested role: **Staff** or **Admin**
3. Submit the request (status: Pending)
4. An administrator must approve before you can sign in:
   - **Staff** requests → approved by Admin or SuperAdmin
   - **Admin** requests → approved by SuperAdmin only
