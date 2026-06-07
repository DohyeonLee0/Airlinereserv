-- ============================================================
-- AIRLINE RESERVATION SYSTEM
-- schema.sql
-- Basic table definitions
-- MariaDB / MySQL Compatible
-- ============================================================

DROP TABLE IF EXISTS refunds;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS booking_seats;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS seat_holds;
DROP TABLE IF EXISTS flight_seats;
DROP TABLE IF EXISTS flights;
DROP TABLE IF EXISTS schedule_days;
DROP TABLE IF EXISTS promotions;
DROP TABLE IF EXISTS flight_schedules;
DROP TABLE IF EXISTS itineraries;
DROP TABLE IF EXISTS aircraft_seats;
DROP TABLE IF EXISTS seat_classes;
DROP TABLE IF EXISTS aircraft;
DROP TABLE IF EXISTS airports;
DROP TABLE IF EXISTS staff_registration_requests;
DROP TABLE IF EXISTS airlines;
DROP TABLE IF EXISTS users;

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
    user_id      VARCHAR(20) PRIMARY KEY,
    first_name   VARCHAR(50)  NOT NULL,
    middle_name  VARCHAR(50)  NULL,
    last_name    VARCHAR(50)  NOT NULL,
    email        VARCHAR(100) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,
    role         VARCHAR(20)  NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'Active',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK (role IN ('Customer', 'Staff', 'Admin', 'SuperAdmin')),
    CHECK (status IN ('Active', 'Inactive'))
);

CREATE TABLE staff_registration_requests (
    request_id     INT PRIMARY KEY,
    first_name     VARCHAR(50)  NOT NULL,
    middle_name    VARCHAR(50)  NULL,
    last_name      VARCHAR(50)  NOT NULL,
    email          VARCHAR(100) NOT NULL,
    password       VARCHAR(255) NOT NULL,
    requested_role VARCHAR(20)  NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'Pending',
    requested_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by    VARCHAR(20)  NULL,
    reviewed_at    TIMESTAMP NULL,
    reject_reason  VARCHAR(255) NULL,

    CHECK (requested_role IN ('Staff', 'Admin')),
    CHECK (status IN ('Pending', 'Approved', 'Rejected')),

    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
);

-- ============================================================
-- MASTER DATA
-- ============================================================

CREATE TABLE airlines (
    airline_id    VARCHAR(10) PRIMARY KEY,
    airline_name  VARCHAR(100) NOT NULL,
    country       VARCHAR(50)
);

CREATE TABLE airports (
    airport_code  CHAR(3) PRIMARY KEY,
    airport_name  VARCHAR(100) NOT NULL,
    city          VARCHAR(50) NOT NULL,
    country       VARCHAR(50) NOT NULL
);

CREATE TABLE aircraft (
    aircraft_id  INT PRIMARY KEY,
    airline_id   VARCHAR(10) NOT NULL,
    model        VARCHAR(50) NOT NULL,
    capacity     INT NOT NULL,

    FOREIGN KEY (airline_id) REFERENCES airlines(airline_id),
    CHECK (capacity > 0)
);

CREATE TABLE seat_classes (
    class_id    INT PRIMARY KEY,
    class_name  VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE aircraft_seats (
    aircraft_id  INT NOT NULL,
    seat_number  VARCHAR(5) NOT NULL,
    class_id     INT NOT NULL,

    PRIMARY KEY (aircraft_id, seat_number),

    FOREIGN KEY (aircraft_id) REFERENCES aircraft(aircraft_id),
    FOREIGN KEY (class_id) REFERENCES seat_classes(class_id)
);

-- ============================================================
-- FLIGHT SCHEDULES
-- ============================================================

CREATE TABLE flight_schedules (
    schedule_id    INT PRIMARY KEY,
    airline_id     VARCHAR(10) NOT NULL,
    flight_number  VARCHAR(10) NOT NULL,
    dep_airport    CHAR(3) NOT NULL,
    arr_airport    CHAR(3) NOT NULL,
    dep_time       TIME NOT NULL,
    arr_time       TIME NOT NULL,
    valid_from     DATE NOT NULL,
    valid_to       DATE NOT NULL,

    FOREIGN KEY (airline_id) REFERENCES airlines(airline_id),
    FOREIGN KEY (dep_airport) REFERENCES airports(airport_code),
    FOREIGN KEY (arr_airport) REFERENCES airports(airport_code),

    CHECK (dep_airport <> arr_airport),
    CHECK (valid_from <= valid_to)
);

CREATE TABLE schedule_days (
    schedule_id  INT NOT NULL,
    day_of_week  VARCHAR(3) NOT NULL,

    PRIMARY KEY (schedule_id, day_of_week),

    FOREIGN KEY (schedule_id) REFERENCES flight_schedules(schedule_id),

    CHECK (day_of_week IN ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'))
);

-- ============================================================
-- ITINERARIES (OneWay / RoundTrip / Connecting)
-- Aligns with ER diagram: https://dbdiagram.io/d/69d9fb748089629684700561
-- ============================================================

CREATE TABLE itineraries (
    itinerary_id            INT PRIMARY KEY,
    trip_type               VARCHAR(15) NOT NULL,
    departure_airport_code  CHAR(3) NOT NULL,
    arrival_airport_code    CHAR(3) NOT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (departure_airport_code) REFERENCES airports(airport_code),
    FOREIGN KEY (arrival_airport_code) REFERENCES airports(airport_code),

    CHECK (trip_type IN ('OneWay', 'RoundTrip', 'Connecting')),
    CHECK (departure_airport_code <> arrival_airport_code)
);

-- ============================================================
-- GENERATED FLIGHTS AND FLIGHT-SPECIFIC SEATS
-- ============================================================

CREATE TABLE flights (
    flight_id      INT PRIMARY KEY,
    itinerary_id   INT NOT NULL,
    schedule_id    INT NOT NULL,
    flight_date    DATE NOT NULL,
    aircraft_id    INT NOT NULL,
    segment_order  INT NOT NULL DEFAULT 1,
    leg_type       VARCHAR(10) NOT NULL DEFAULT 'Outbound',
    status         VARCHAR(20) NOT NULL,

    FOREIGN KEY (itinerary_id) REFERENCES itineraries(itinerary_id),
    FOREIGN KEY (schedule_id) REFERENCES flight_schedules(schedule_id),
    FOREIGN KEY (aircraft_id) REFERENCES aircraft(aircraft_id),

    UNIQUE (schedule_id, flight_date),
    UNIQUE (itinerary_id, segment_order),

    CHECK (segment_order > 0),
    CHECK (leg_type IN ('Outbound', 'Return')),
    CHECK (status IN ('Scheduled', 'Delayed', 'Cancelled', 'Completed'))
);

CREATE TABLE flight_seats (
    flight_id     INT NOT NULL,
    aircraft_id   INT NOT NULL,
    seat_number   VARCHAR(5) NOT NULL,
    class_id      INT NOT NULL,
    is_available  BOOLEAN NOT NULL DEFAULT TRUE,
    price         DECIMAL(10,2) NOT NULL,

    PRIMARY KEY (flight_id, seat_number),

    FOREIGN KEY (flight_id) REFERENCES flights(flight_id),
    FOREIGN KEY (aircraft_id) REFERENCES aircraft(aircraft_id),
    FOREIGN KEY (class_id) REFERENCES seat_classes(class_id),
    FOREIGN KEY (aircraft_id, seat_number)
        REFERENCES aircraft_seats(aircraft_id, seat_number),

    CHECK (price >= 0)
);

-- Needed so final_operations.sql can reference
-- FOREIGN KEY (flight_id, seat_number) against flight_seats.
CREATE INDEX idx_flight_seats_flight_seat
ON flight_seats(flight_id, seat_number);

-- ============================================================
-- BOOKINGS
-- ============================================================

CREATE TABLE bookings (
    booking_id    INT PRIMARY KEY,
    user_id       VARCHAR(20) NOT NULL,
    itinerary_id  INT NOT NULL,
    booking_time  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status        VARCHAR(20) NOT NULL,

    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (itinerary_id) REFERENCES itineraries(itinerary_id),

    CHECK (status IN ('Active', 'Cancelled'))
);

CREATE TABLE booking_seats (
    booking_id   INT NOT NULL,
    flight_id    INT NOT NULL,
    seat_number  VARCHAR(5) NOT NULL,

    PRIMARY KEY (booking_id, flight_id, seat_number),

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (flight_id, seat_number)
        REFERENCES flight_seats(flight_id, seat_number),

    UNIQUE (flight_id, seat_number)
);

CREATE TABLE payments (
    payment_id      INT PRIMARY KEY,
    booking_id      INT NOT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    payment_method  VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL,
    payment_time    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),

    CHECK (amount >= 0),
    CHECK (status IN ('SUCCESS', 'FAILED', 'REFUNDED'))
);

CREATE TABLE tickets (
    ticket_id    INT PRIMARY KEY,
    booking_id   INT NOT NULL,
    flight_id    INT NOT NULL,
    seat_number  VARCHAR(5) NOT NULL,
    issue_time   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (flight_id, seat_number)
        REFERENCES flight_seats(flight_id, seat_number),

    UNIQUE (flight_id, seat_number)
);

CREATE TABLE refunds (
    refund_id      INT PRIMARY KEY,
    booking_id     INT NOT NULL,
    payment_id     INT NOT NULL,
    refund_amount  DECIMAL(10,2) NOT NULL,
    refund_time    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (payment_id) REFERENCES payments(payment_id),

    CHECK (refund_amount >= 0)
);

-- ============================================================
-- RECOMMENDED INDEXES FOR EFFICIENCY
-- ============================================================

CREATE INDEX idx_flights_schedule_date_status
ON flights(schedule_id, flight_date, status);

CREATE INDEX idx_flight_search
ON flights(flight_date, schedule_id);

CREATE INDEX idx_flight_itinerary
ON flights(itinerary_id, segment_order);

CREATE INDEX idx_flight_schedules_route
ON flight_schedules(dep_airport, arr_airport, dep_time, arr_time);

CREATE INDEX idx_flight_seats_lookup
ON flight_seats(flight_id, class_id, is_available, price);

CREATE INDEX idx_seat_available
ON flight_seats(flight_id, is_available);

CREATE INDEX idx_bookings_user
ON bookings(user_id, status);