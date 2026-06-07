# Booking Rules

## How to book a flight

1. On the home page, enter departure airport, arrival airport, date, and cabin class
2. Search — results show direct and connecting options
3. Click a flight to open **seat selection** (`/seats?flight_id=...`)
4. Select seat(s), choose payment method, and confirm
5. Booking appears under **My Bookings** (`/bookings`)

## Cancellation policy

- Customers can **cancel and get a full refund** only while the booking is **Active** and the **earliest flight leg has not departed yet**
- If the departure date has passed, the UI shows **"Departure date passed — cancellation not available"**
- Cancelled bookings show refund amount when applicable
- The backend also rejects cancellation API calls for past departures

## My Bookings page features

- Search by booking number, route, flight, seat, status, payment info
- Filter by status: All, Active, Cancelled
- Filter by departure date range (Depart from / Depart to)
- Pagination: 10 bookings per page
- Expand a booking to see flight legs, seats, and ticket IDs

## Payment

- Supported methods include CARD and TRANSFER (demo)
- Payment status shows SUCCESS on completed bookings
- Payment ledger is visible on the seats page after booking

## Connecting flights

- One-stop itineraries may have multiple legs under one booking
- Cancellation applies to the whole booking
- Earliest leg departure date determines whether cancellation is allowed
