# MariaDB Setup

MariaDB is running on this machine at port `3306`.

## ER Diagram

Team schema documentation: [dbdiagram.io ER diagram](https://dbdiagram.io/d/69d9fb748089629684700561)

Key entities aligned with the diagram:

- `itineraries` — trip type (OneWay / RoundTrip / Connecting) and end-to-end route
- `flights` — scheduled segments linked to an itinerary (`segment_order`, `leg_type`)
- `bookings` — one booking per itinerary (multi-leg via `booking_seats`)
- Revenue reports — ticket seat prices from `flight_seats`, not booking-level payment totals

If the current MariaDB administrator account uses Windows/GSSAPI authentication, create a password-based app user first:

```powershell
& "C:\Program Files\MariaDB 12.2\bin\mysql.exe" -uroot -p < db-admin-setup.sql
```

Then create `.env.local`:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=ars_app
DB_PASSWORD=ars_app_password_change_me
DB_NAME=airline_reservation
```

Load schema, ICN seed data, procedures, and triggers:

```powershell
npm run db:setup
```

This also loads **`demo_transactions.sql`** — sample bookings, tickets, and payments so revenue reports, load factor, and My Bookings show real data after setup.

Demo booking highlights (log in as customers with `Ars#CSE305!Demo2026`):

| Customer | Sample booking |
|----------|----------------|
| `cust01` | KE081 ICN→JFK (Jun 1 & Jun 3) |
| `cust02` | Connecting ICN→LAX→JFK + ICN→SFO Business |
| `cust03` | ICN→NRT Business; cancelled ICN→KIX (refunded) |
| `cust04` | ICN→LAX, ICN→CDG Business |

Staff dashboard revenue tabs will show tickets sold and seat-price revenue across airlines, routes, months, and seat classes.

Verify the app connection:

```powershell
npm run db:ping
```
