-- ============================================================
-- AIRLINE RESERVATION SYSTEM
-- sample_data.sql
-- ICN-focused demo data using real airlines, airports, and routes.
-- Run order: schema.sql -> sample_data.sql -> operations.sql
-- Seed password for all users (bcrypt cost 12): Ars#CSE305!Demo2026

SET @seed_password = '$2b$12$1MgZOW/IWItRV/bUHFE2x.uvppZ/KBDAcA.ny3aHjlhHN7qN8l59W';

-- ============================================================
-- USERS
-- ============================================================

INSERT INTO users (user_id, first_name, middle_name, last_name, email, password, role, status)
VALUES
('super01', 'Sam', NULL, 'Supervisor', 'sam.supervisor@example.com', @seed_password, 'SuperAdmin', 'Active'),
('admin01', 'Alex', NULL, 'Admin', 'alex.admin@example.com', @seed_password, 'Admin', 'Active'),
('cust01', 'John', NULL, 'Smith', 'john.smith@example.com', @seed_password, 'Customer', 'Active'),
('cust02', 'Mary', 'Jane', 'Watson', 'mary.watson@example.com', @seed_password, 'Customer', 'Active'),
('cust03', 'Gildong', NULL, 'Hong', 'gildong.hong@example.com', @seed_password, 'Customer', 'Active'),
('cust04', 'Minji', NULL, 'Kim', 'minji.kim@example.com', @seed_password, 'Customer', 'Active'),
('staff01', 'Alice', NULL, 'Manager', 'alice.manager@example.com', @seed_password, 'Staff', 'Active');
-- ============================================================
-- AIRLINES
-- ============================================================

INSERT INTO airlines (airline_id, airline_name, country)
VALUES
('KE', 'Korean Air', 'South Korea'),
('OZ', 'Asiana Airlines', 'South Korea'),
('DL', 'Delta Air Lines', 'United States'),
('AA', 'American Airlines', 'United States'),
('UA', 'United Airlines', 'United States'),
('SQ', 'Singapore Airlines', 'Singapore'),
('AF', 'Air France', 'France'),
('JL', 'Japan Airlines', 'Japan');

-- ============================================================
-- AIRPORTS
-- ============================================================

INSERT INTO airports (airport_code, airport_name, city, country)
VALUES
('ICN', 'Incheon International Airport', 'Incheon', 'South Korea'),
('JFK', 'John F. Kennedy International Airport', 'New York', 'United States'),
('LAX', 'Los Angeles International Airport', 'Los Angeles', 'United States'),
('SFO', 'San Francisco International Airport', 'San Francisco', 'United States'),
('SEA', 'Seattle-Tacoma International Airport', 'Seattle', 'United States'),
('NRT', 'Narita International Airport', 'Tokyo', 'Japan'),
('KIX', 'Kansai International Airport', 'Osaka', 'Japan'),
('SIN', 'Singapore Changi Airport', 'Singapore', 'Singapore'),
('CDG', 'Paris Charles de Gaulle Airport', 'Paris', 'France'),
('FRA', 'Frankfurt Airport', 'Frankfurt', 'Germany'),
('BKK', 'Suvarnabhumi Airport', 'Bangkok', 'Thailand'),
('HKG', 'Hong Kong International Airport', 'Hong Kong', 'Hong Kong');

-- ============================================================
-- AIRCRAFT
-- ============================================================

INSERT INTO aircraft (aircraft_id, airline_id, model, capacity)
VALUES
(101, 'KE', 'Boeing 777-300ER', 322),
(102, 'KE', 'Boeing 787-9', 276),
(201, 'OZ', 'Airbus A350-900', 316),
(301, 'DL', 'Airbus A330-900neo', 281),
(401, 'AA', 'Boeing 787-9', 276),
(501, 'UA', 'Boeing 777-200ER', 322),
(601, 'SQ', 'Airbus A350-900', 316),
(701, 'AF', 'Boeing 777-300ER', 322),
(801, 'JL', 'Boeing 787-8', 276);

-- ============================================================
-- SEAT CLASSES
-- UI/API display class names directly. Numeric class_id is internal only.
-- ============================================================

INSERT INTO seat_classes (class_id, class_name)
VALUES
(1, 'Economy'),
(2, 'Business'),
(3, 'First');

-- ============================================================
-- AIRCRAFT SEATS
-- Model-based wide-body layouts for the demo seat map:
-- - 777: First 1-2-1, Business 2-2-2, Economy 3-4-3
-- - 787: Business 2-2-2, Economy 3-3-3
-- - A350: Business 1-2-1, Economy 3-3-3
-- - A330neo: Business 1-2-1, Economy 2-4-2
-- ============================================================

CREATE TEMPORARY TABLE demo_rows (n INT PRIMARY KEY);

INSERT INTO demo_rows (n)
VALUES
(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),
(11),(12),(13),(14),(15),(16),(17),(18),(19),(20),
(21),(22),(23),(24),(25),(26),(27),(28),(29),(30),
(31),(32),(33),(34),(35),(36),(37),(38),(39),(40),
(41),(42),(43),(44),(45),(46),(47),(48),(49),(50),
(51),(52),(53),(54),(55),(56),(57),(58),(59),(60),
(61),(62),(63),(64),(65),(66),(67),(68),(69),(70);

-- Boeing 777 family
INSERT INTO aircraft_seats (aircraft_id, seat_number, class_id)
SELECT a.aircraft_id, CONCAT(r.n, l.letter), 3
FROM aircraft a
JOIN demo_rows r ON r.n BETWEEN 1 AND 2
JOIN (SELECT 'A' letter UNION ALL SELECT 'D' UNION ALL SELECT 'G' UNION ALL SELECT 'K') l
WHERE a.model LIKE 'Boeing 777%';

INSERT INTO aircraft_seats (aircraft_id, seat_number, class_id)
SELECT a.aircraft_id, CONCAT(r.n, l.letter), 2
FROM aircraft a
JOIN demo_rows r ON r.n BETWEEN 7 AND 15
JOIN (SELECT 'A' letter UNION ALL SELECT 'C' UNION ALL SELECT 'D' UNION ALL SELECT 'G' UNION ALL SELECT 'H' UNION ALL SELECT 'K') l
WHERE a.model LIKE 'Boeing 777%';

INSERT INTO aircraft_seats (aircraft_id, seat_number, class_id)
SELECT a.aircraft_id, CONCAT(r.n, l.letter), 1
FROM aircraft a
JOIN demo_rows r ON r.n BETWEEN 28 AND 53
JOIN (
    SELECT 'A' letter UNION ALL SELECT 'B' UNION ALL SELECT 'C' UNION ALL
    SELECT 'D' UNION ALL SELECT 'E' UNION ALL SELECT 'F' UNION ALL SELECT 'G' UNION ALL
    SELECT 'H' UNION ALL SELECT 'J' UNION ALL SELECT 'K'
) l
WHERE a.model LIKE 'Boeing 777%';

-- Boeing 787 family
INSERT INTO aircraft_seats (aircraft_id, seat_number, class_id)
SELECT a.aircraft_id, CONCAT(r.n, l.letter), 2
FROM aircraft a
JOIN demo_rows r ON r.n BETWEEN 1 AND 4
JOIN (SELECT 'A' letter UNION ALL SELECT 'C' UNION ALL SELECT 'D' UNION ALL SELECT 'G' UNION ALL SELECT 'H' UNION ALL SELECT 'K') l
WHERE a.model LIKE 'Boeing 787%';

INSERT INTO aircraft_seats (aircraft_id, seat_number, class_id)
SELECT a.aircraft_id, CONCAT(r.n, l.letter), 1
FROM aircraft a
JOIN demo_rows r ON r.n BETWEEN 28 AND 55
JOIN (
    SELECT 'A' letter UNION ALL SELECT 'B' UNION ALL SELECT 'C' UNION ALL
    SELECT 'D' UNION ALL SELECT 'E' UNION ALL SELECT 'F' UNION ALL
    SELECT 'H' UNION ALL SELECT 'J' UNION ALL SELECT 'K'
) l
WHERE a.model LIKE 'Boeing 787%';

-- Airbus A350-900
INSERT INTO aircraft_seats (aircraft_id, seat_number, class_id)
SELECT a.aircraft_id, CONCAT(r.n, l.letter), 2
FROM aircraft a
JOIN demo_rows r ON r.n BETWEEN 1 AND 7
JOIN (SELECT 'A' letter UNION ALL SELECT 'D' UNION ALL SELECT 'G' UNION ALL SELECT 'K') l
WHERE a.model = 'Airbus A350-900';

INSERT INTO aircraft_seats (aircraft_id, seat_number, class_id)
SELECT a.aircraft_id, CONCAT(r.n, l.letter), 1
FROM aircraft a
JOIN demo_rows r ON r.n BETWEEN 10 AND 41
JOIN (
    SELECT 'A' letter UNION ALL SELECT 'B' UNION ALL SELECT 'C' UNION ALL
    SELECT 'D' UNION ALL SELECT 'E' UNION ALL SELECT 'F' UNION ALL
    SELECT 'H' UNION ALL SELECT 'J' UNION ALL SELECT 'K'
) l
WHERE a.model = 'Airbus A350-900';

-- Airbus A330-900neo
INSERT INTO aircraft_seats (aircraft_id, seat_number, class_id)
SELECT a.aircraft_id, CONCAT(r.n, l.letter), 2
FROM aircraft a
JOIN demo_rows r ON r.n BETWEEN 1 AND 7
JOIN (SELECT 'A' letter UNION ALL SELECT 'D' UNION ALL SELECT 'G' UNION ALL SELECT 'K') l
WHERE a.model = 'Airbus A330-900neo';

INSERT INTO aircraft_seats (aircraft_id, seat_number, class_id)
SELECT a.aircraft_id, CONCAT(r.n, l.letter), 1
FROM aircraft a
JOIN demo_rows r ON r.n BETWEEN 20 AND 51
JOIN (
    SELECT 'A' letter UNION ALL SELECT 'B' UNION ALL SELECT 'C' UNION ALL SELECT 'D' UNION ALL
    SELECT 'F' UNION ALL SELECT 'G' UNION ALL SELECT 'H' UNION ALL SELECT 'J'
) l
WHERE a.model = 'Airbus A330-900neo';

DROP TEMPORARY TABLE demo_rows;

-- ============================================================
-- FLIGHT SCHEDULES
-- ICN-centered real-world route set for demo queries.
-- ============================================================

INSERT INTO flight_schedules (
    schedule_id,
    airline_id,
    flight_number,
    dep_airport,
    arr_airport,
    dep_time,
    arr_time,
    valid_from,
    valid_to
)
VALUES
(1,  'KE', 'KE081', 'ICN', 'JFK', '10:00:00', '22:00:00', '2025-07-01', '2026-06-30'),
(2,  'KE', 'KE017', 'ICN', 'LAX', '08:00:00', '18:00:00', '2026-06-01', '2026-06-30'),
(3,  'AA', 'AA010', 'LAX', 'JFK', '20:00:00', '23:30:00', '2026-06-01', '2026-06-30'),
(4,  'KE', 'KE703', 'ICN', 'NRT', '09:00:00', '11:30:00', '2026-06-01', '2026-06-30'),
(5,  'OZ', 'OZ202', 'ICN', 'LAX', '14:40:00', '09:50:00', '2026-06-01', '2026-06-30'),
(6,  'DL', 'DL196', 'ICN', 'SEA', '19:20:00', '13:35:00', '2026-06-01', '2026-06-30'),
(7,  'UA', 'UA892', 'ICN', 'SFO', '16:50:00', '11:25:00', '2026-06-01', '2026-06-30'),
(8,  'SQ', 'SQ607', 'ICN', 'SIN', '09:00:00', '14:45:00', '2026-06-01', '2026-06-30'),
(9,  'AF', 'AF267', 'ICN', 'CDG', '12:15:00', '19:30:00', '2026-06-01', '2026-06-30'),
(10, 'JL', 'JL5206', 'ICN', 'KIX', '13:10:00', '15:00:00', '2026-06-01', '2026-06-30'),
(11, 'KE', 'KE651', 'ICN', 'BKK', '17:20:00', '21:10:00', '2026-06-01', '2026-06-30'),
(12, 'OZ', 'OZ721', 'ICN', 'HKG', '09:00:00', '11:45:00', '2026-06-01', '2026-06-30');

-- 2026-06-01 is Monday. These demo schedules operate Mon/Wed/Fri.
INSERT INTO schedule_days (schedule_id, day_of_week)
SELECT schedule_id, day_of_week
FROM flight_schedules
CROSS JOIN (
    SELECT 'MON' AS day_of_week UNION ALL
    SELECT 'WED' UNION ALL
    SELECT 'FRI'
) days;

-- ============================================================
-- ITINERARIES
-- Template rows (10/20/30) used by flight generation; per-flight rows for seed data.
-- ER: https://dbdiagram.io/d/69d9fb748089629684700561
-- ============================================================

INSERT INTO itineraries (itinerary_id, trip_type, departure_airport_code, arrival_airport_code)
VALUES
(10, 'OneWay', 'ICN', 'JFK'),
(20, 'RoundTrip', 'ICN', 'JFK'),
(30, 'Connecting', 'ICN', 'JFK'),
(7001, 'Connecting', 'ICN', 'JFK'),
(7030, 'Connecting', 'ICN', 'JFK');

-- One itinerary per direct seed flight (5000 + flight_id)
INSERT INTO itineraries (itinerary_id, trip_type, departure_airport_code, arrival_airport_code)
SELECT
    5000 + f.flight_id,
    'OneWay',
    fs.dep_airport,
    fs.arr_airport
FROM (
    SELECT 1001 AS flight_id, 1 AS schedule_id UNION ALL
    SELECT 1004, 4 UNION ALL SELECT 1005, 5 UNION ALL SELECT 1006, 6 UNION ALL
    SELECT 1007, 7 UNION ALL SELECT 1008, 8 UNION ALL SELECT 1009, 9 UNION ALL
    SELECT 1010, 10 UNION ALL SELECT 1011, 11 UNION ALL SELECT 1012, 12 UNION ALL
    SELECT 1013, 1
) f
JOIN flight_schedules fs ON f.schedule_id = fs.schedule_id;

-- ============================================================
-- GENERATED FLIGHTS
-- ============================================================

INSERT INTO flights (flight_id, itinerary_id, schedule_id, flight_date, aircraft_id, segment_order, leg_type, status)
VALUES
(1001, 6001, 1,  '2026-06-01', 101, 1, 'Outbound', 'Scheduled'),
(1002, 7001, 2,  '2026-06-01', 102, 1, 'Outbound', 'Scheduled'),
(1003, 7001, 3,  '2026-06-01', 401, 2, 'Outbound', 'Scheduled'),
(1004, 6004, 4,  '2026-06-01', 101, 1, 'Outbound', 'Scheduled'),
(1005, 6005, 5,  '2026-06-12', 201, 1, 'Outbound', 'Scheduled'),
(1006, 6006, 6,  '2026-06-15', 301, 1, 'Outbound', 'Scheduled'),
(1007, 6007, 7,  '2026-06-01', 501, 1, 'Outbound', 'Scheduled'),
(1008, 6008, 8,  '2026-06-01', 601, 1, 'Outbound', 'Scheduled'),
(1009, 6009, 9,  '2026-06-01', 701, 1, 'Outbound', 'Scheduled'),
(1010, 6010, 10, '2026-06-01', 801, 1, 'Outbound', 'Scheduled'),
(1011, 6011, 11, '2026-06-01', 102, 1, 'Outbound', 'Scheduled'),
(1012, 6012, 12, '2026-06-01', 201, 1, 'Outbound', 'Scheduled'),
(1013, 6013, 1,  '2026-06-10', 101, 1, 'Outbound', 'Scheduled'),
(1014, 7030, 2,  '2026-06-10', 102, 1, 'Outbound', 'Scheduled'),
(1015, 7030, 3,  '2026-06-10', 401, 2, 'Outbound', 'Scheduled');

-- Demo search window: daily ICN→JFK through June 15, 2026
INSERT INTO itineraries (itinerary_id, trip_type, departure_airport_code, arrival_airport_code)
VALUES
(6020, 'OneWay', 'ICN', 'JFK'),
(6021, 'OneWay', 'ICN', 'JFK'),
(6023, 'OneWay', 'ICN', 'JFK'),
(6024, 'OneWay', 'ICN', 'JFK'),
(6025, 'OneWay', 'ICN', 'JFK'),
(6026, 'OneWay', 'ICN', 'JFK'),
(6027, 'OneWay', 'ICN', 'JFK'),
(6028, 'OneWay', 'ICN', 'NRT'),
(6029, 'OneWay', 'ICN', 'SIN'),
(6030, 'OneWay', 'ICN', 'CDG');

INSERT INTO flights (flight_id, itinerary_id, schedule_id, flight_date, aircraft_id, segment_order, leg_type, status)
VALUES
(1020, 6020, 1, '2026-06-08', 101, 1, 'Outbound', 'Scheduled'),
(1021, 6021, 1, '2026-06-09', 101, 1, 'Outbound', 'Scheduled'),
(1023, 6023, 1, '2026-06-11', 101, 1, 'Outbound', 'Scheduled'),
(1024, 6024, 1, '2026-06-12', 101, 1, 'Outbound', 'Scheduled'),
(1025, 6025, 1, '2026-06-13', 101, 1, 'Outbound', 'Scheduled'),
(1026, 6026, 1, '2026-06-14', 101, 1, 'Outbound', 'Scheduled'),
(1027, 6027, 1, '2026-06-15', 101, 1, 'Outbound', 'Scheduled'),
(1028, 6028, 4, '2026-06-11', 101, 1, 'Outbound', 'Scheduled'),
(1029, 6029, 8, '2026-06-13', 601, 1, 'Outbound', 'Scheduled'),
(1030, 6030, 9, '2026-06-15', 701, 1, 'Outbound', 'Scheduled');

-- ============================================================
-- 12-MONTH REVENUE DEMO FLIGHTS (Jul 2025 – May 2026)
-- One KE081 ICN→JFK per month; June 2026 uses flights 1001+ above.
-- ============================================================

INSERT INTO itineraries (itinerary_id, trip_type, departure_airport_code, arrival_airport_code)
VALUES
(8001, 'OneWay', 'ICN', 'JFK'),
(8002, 'OneWay', 'ICN', 'JFK'),
(8003, 'OneWay', 'ICN', 'JFK'),
(8004, 'OneWay', 'ICN', 'JFK'),
(8005, 'OneWay', 'ICN', 'JFK'),
(8006, 'OneWay', 'ICN', 'JFK'),
(8007, 'OneWay', 'ICN', 'JFK'),
(8008, 'OneWay', 'ICN', 'JFK'),
(8009, 'OneWay', 'ICN', 'JFK'),
(8010, 'OneWay', 'ICN', 'JFK'),
(8011, 'OneWay', 'ICN', 'JFK');

INSERT INTO flights (flight_id, itinerary_id, schedule_id, flight_date, aircraft_id, segment_order, leg_type, status)
VALUES
(2001, 8001, 1, '2025-07-07', 101, 1, 'Outbound', 'Completed'),
(2002, 8002, 1, '2025-08-04', 101, 1, 'Outbound', 'Completed'),
(2003, 8003, 1, '2025-09-01', 101, 1, 'Outbound', 'Completed'),
(2004, 8004, 1, '2025-10-06', 101, 1, 'Outbound', 'Completed'),
(2005, 8005, 1, '2025-11-03', 101, 1, 'Outbound', 'Completed'),
(2006, 8006, 1, '2025-12-01', 101, 1, 'Outbound', 'Completed'),
(2007, 8007, 1, '2026-01-05', 101, 1, 'Outbound', 'Completed'),
(2008, 8008, 1, '2026-02-02', 101, 1, 'Outbound', 'Completed'),
(2009, 8009, 1, '2026-03-02', 101, 1, 'Outbound', 'Completed'),
(2010, 8010, 1, '2026-04-06', 101, 1, 'Outbound', 'Completed'),
(2011, 8011, 1, '2026-05-04', 101, 1, 'Outbound', 'Completed');

-- ============================================================
-- FLIGHT-SPECIFIC SEATS AND PRICES
-- ============================================================

INSERT INTO flight_seats (flight_id, aircraft_id, seat_number, class_id, is_available, price)
SELECT
    f.flight_id,
    f.aircraft_id,
    s.seat_number,
    s.class_id,
    TRUE,
    CASE
        WHEN s.class_id = 3 THEN
            CASE
                WHEN fs.arr_airport IN ('JFK', 'LAX', 'SFO', 'SEA', 'CDG') THEN 5200.00
                WHEN fs.arr_airport IN ('SIN', 'BKK', 'HKG') THEN 2600.00
                ELSE 1600.00
            END
        WHEN s.class_id = 2 THEN
            CASE
                WHEN fs.arr_airport IN ('JFK', 'LAX', 'SFO', 'SEA', 'CDG') THEN 2400.00
                WHEN fs.arr_airport IN ('SIN', 'BKK', 'HKG') THEN 980.00
                ELSE 620.00
            END
        ELSE
            CASE
                WHEN fs.arr_airport IN ('JFK', 'LAX', 'SFO', 'SEA', 'CDG') THEN 780.00
                WHEN fs.arr_airport IN ('SIN', 'BKK', 'HKG') THEN 360.00
                ELSE 210.00
            END
    END AS price
FROM flights f
JOIN flight_schedules fs ON f.schedule_id = fs.schedule_id
JOIN aircraft_seats s ON f.aircraft_id = s.aircraft_id;
