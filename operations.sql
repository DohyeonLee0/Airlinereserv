-- ============================================================
-- AIRLINE RESERVATION SYSTEM
-- Full Implementation — Final Version
-- MariaDB / MySQL Compatible
-- ============================================================
--
-- Execute order:
--   1. Run existing schema DDL first.
--   2. Insert sample data.
--   3. Run this file.
--
-- Operations implemented:
--   1.  Staff:    Flight Generation from Schedule
--   1B. Staff:    Generate Flight Seats
--   2.  Customer: Basic Flight Search
--   2B. Customer: Advanced Flight Search
--   2C. Customer: Flight Search with Promotions
--   2D. Customer: Direct and One-Stop Connecting Flight Search
--   2E. Customer: Recommended Routes
--   3.  Customer: View Available Seats
--   3B. Customer: Release Expired Seat Holds
--   3C. Customer: Real-time Seat Hold
--   3D. Customer: Name Splitting (Last Name / First Name)
--   4.  Customer: Atomic Create Booking & Double-Booking Prevention
--   5.  Customer: Cancel Booking & Refund Logic
--   6A. Staff:    Revenue Statistics by Flight
--   6B. Staff:    Revenue Statistics by Month
--   6C. Staff:    Revenue & Load Factor Report
--
-- Changes from previous version:
--   [FIX 1] Removed split_customer_names (conflicting logic).
--           split_name_last_first is the single authoritative procedure.
--   [FIX 2] recommend_routes scoring formula patched.
--           Price penalty is now capped at 40 pts to balance direct bonus.
--   [FIX 3] search_direct_and_connecting_flights available_seats
--           calculation comment added. Known limitation documented.
--   [FIX 4] Sample INSERT data moved to a clearly marked section
--           at the top, separated from DDL and procedure definitions.
--
-- ============================================================


-- ============================================================
-- 0. SCHEMA MIGRATIONS (safe to re-run, MySQL 8 / MariaDB)
-- ============================================================

SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'itineraries'
      AND COLUMN_NAME = 'leg_schedule_ids'
);
SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE itineraries ADD COLUMN leg_schedule_ids JSON NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Allow multiple calendar dates per connecting itinerary leg.
SET @idx_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'flights'
      AND INDEX_NAME = 'itinerary_id'
);
SET @sql = IF(
    @idx_exists > 0,
    'ALTER TABLE flights DROP INDEX itinerary_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @uq_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'flights'
      AND INDEX_NAME = 'uq_itinerary_flight_segment'
);
SET @sql = IF(
    @uq_exists = 0,
    'ALTER TABLE flights ADD UNIQUE INDEX uq_itinerary_flight_segment (itinerary_id, flight_date, segment_order)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE itineraries i
JOIN (
    SELECT
        ordered.itinerary_id,
        JSON_ARRAYAGG(ordered.schedule_id) AS leg_ids
    FROM (
        SELECT itinerary_id, segment_order, schedule_id
        FROM (
            SELECT DISTINCT itinerary_id, segment_order, schedule_id
            FROM flights
        ) distinct_legs
        ORDER BY itinerary_id, segment_order
    ) ordered
    GROUP BY ordered.itinerary_id
) src ON src.itinerary_id = i.itinerary_id
SET i.leg_schedule_ids = src.leg_ids
WHERE i.trip_type = 'Connecting'
  AND i.leg_schedule_ids IS NULL;

UPDATE itineraries
SET leg_schedule_ids = JSON_ARRAY(2, 3)
WHERE itinerary_id IN (7001, 7030)
  AND leg_schedule_ids IS NULL;


-- ============================================================
-- 0B. CLEANUP FOR RE-RUNNING THIS SCRIPT
-- ============================================================

DROP PROCEDURE IF EXISTS generate_flights_from_schedule;
DROP PROCEDURE IF EXISTS generate_flight_seats;
DROP PROCEDURE IF EXISTS search_flights;
DROP PROCEDURE IF EXISTS advanced_search_flights;
DROP PROCEDURE IF EXISTS search_flights_with_promotions;
DROP PROCEDURE IF EXISTS search_flights_with_promo_code;
DROP PROCEDURE IF EXISTS search_direct_and_connecting_flights;
DROP PROCEDURE IF EXISTS recommend_routes;
DROP PROCEDURE IF EXISTS available_promotions_for_flight;
DROP PROCEDURE IF EXISTS view_available_seats;
DROP PROCEDURE IF EXISTS hold_seat;
DROP PROCEDURE IF EXISTS release_expired_seat_holds;
DROP PROCEDURE IF EXISTS split_customer_names;
DROP PROCEDURE IF EXISTS split_name_last_first;
DROP PROCEDURE IF EXISTS get_customer_full_name;
DROP PROCEDURE IF EXISTS make_reservation;
DROP PROCEDURE IF EXISTS make_reservation_with_promo;
DROP PROCEDURE IF EXISTS cancel_reservation;
DROP PROCEDURE IF EXISTS revenue_report_by_flight;
DROP PROCEDURE IF EXISTS revenue_report_by_month;
DROP PROCEDURE IF EXISTS revenue_and_load_factor_report;
DROP PROCEDURE IF EXISTS revenue_report_by_route;
DROP PROCEDURE IF EXISTS revenue_breakdown_by_seat_class;
DROP PROCEDURE IF EXISTS revenue_report_by_quarter;
DROP PROCEDURE IF EXISTS register_customer;
DROP PROCEDURE IF EXISTS submit_staff_request;
DROP PROCEDURE IF EXISTS approve_staff_request;
DROP PROCEDURE IF EXISTS reject_staff_request;
DROP PROCEDURE IF EXISTS list_pending_staff_requests;
DROP PROCEDURE IF EXISTS get_customer_bookings;
DROP PROCEDURE IF EXISTS get_all_bookings_for_staff;
DROP PROCEDURE IF EXISTS get_booking_legs_for_staff;
DROP PROCEDURE IF EXISTS get_booking_activity_log;
DROP PROCEDURE IF EXISTS get_customer_name_parts;
DROP PROCEDURE IF EXISTS upsert_airline;
DROP PROCEDURE IF EXISTS delete_airline;
DROP PROCEDURE IF EXISTS upsert_airport;
DROP PROCEDURE IF EXISTS delete_airport;
DROP PROCEDURE IF EXISTS upsert_aircraft;
DROP PROCEDURE IF EXISTS replace_aircraft_seats;
DROP PROCEDURE IF EXISTS upsert_aircraft_seat_template;
DROP PROCEDURE IF EXISTS delete_aircraft_seat_template;
DROP PROCEDURE IF EXISTS upsert_flight_schedule;
DROP PROCEDURE IF EXISTS upsert_connecting_route;
DROP PROCEDURE IF EXISTS upsert_promotion;
DROP PROCEDURE IF EXISTS deactivate_promotion;

DROP TRIGGER IF EXISTS check_flight_seat_aircraft_insert;
DROP TRIGGER IF EXISTS check_flight_seat_aircraft_update;

DROP TABLE IF EXISTS seat_holds;
DROP TABLE IF EXISTS promotions;


-- ============================================================
-- 1. ADDITIONAL TABLES
-- ============================================================

-- ------------------------------------------------------------
-- promotions:
-- Stores discount rules per route, schedule, class, and date range.
-- Supports sale / promotion-aware flight search.
-- ------------------------------------------------------------

CREATE TABLE promotions (
    promo_id         INT            PRIMARY KEY,
    promo_code       VARCHAR(30)    NOT NULL UNIQUE,
    description      VARCHAR(255),

    schedule_id      INT            NULL,
    dep_airport      CHAR(3)        NULL,
    arr_airport      CHAR(3)        NULL,
    class_id         INT            NULL,

    discount_percent DECIMAL(5,2)   NOT NULL,
    valid_from       DATE           NOT NULL,
    valid_to         DATE           NOT NULL,
    is_active        BOOLEAN        DEFAULT TRUE,

    FOREIGN KEY (schedule_id) REFERENCES flight_schedules(schedule_id),
    FOREIGN KEY (class_id)    REFERENCES seat_classes(class_id),

    CHECK (discount_percent > 0 AND discount_percent <= 100),
    CHECK (valid_from <= valid_to)
);

-- ------------------------------------------------------------
-- seat_holds:
-- Temporarily holds a selected seat before final booking.
-- UNIQUE(flight_id, seat_number) prevents double holds.
-- ------------------------------------------------------------

CREATE TABLE seat_holds (
    hold_id      INT          PRIMARY KEY,
    user_id      VARCHAR(20)  NOT NULL,
    flight_id    INT          NOT NULL,
    seat_number  VARCHAR(5)   NOT NULL,
    hold_time    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    expires_at   TIMESTAMP    NOT NULL,

    UNIQUE (flight_id, seat_number),

    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (flight_id, seat_number)
        REFERENCES flight_seats(flight_id, seat_number)
);


-- ============================================================
-- 2. SAMPLE DATA FOR PROMOTIONS
-- [FIX 4] Sample data is separated here from procedure definitions.
-- Safe to re-run because the promotions table is dropped above.
-- ============================================================

INSERT INTO promotions (
    promo_id, promo_code, description,
    schedule_id, dep_airport, arr_airport, class_id,
    discount_percent, valid_from, valid_to, is_active
)
VALUES
(
    1,
    'SUMMER10',
    '10 percent summer discount for ICN to JFK economy seats',
    NULL, 'ICN', 'JFK', 1,
    10.00, '2026-06-01', '2026-06-30', TRUE
),
(
    2,
    'BUSINESS15',
    '15 percent promotion for all business class seats globally',
    NULL, NULL, NULL, 2,
    15.00, '2026-06-01', '2026-07-31', TRUE
),
(
    3,
    'ICNUSA20',
    '20 percent discount for selected ICN to United States routes',
    NULL, 'ICN', NULL, 1,
    20.00, '2026-06-01', '2026-06-30', TRUE
),
(
    4,
    'ASIA12',
    '12 percent discount for selected ICN Asia routes',
    NULL, 'ICN', NULL, 1,
    12.00, '2026-06-01', '2026-06-30', TRUE
);


-- ============================================================
-- 3. TRIGGERS
-- Ensure flight_seats.aircraft_id matches flights.aircraft_id.
-- Prevents invalid seat generation for the wrong aircraft.
-- ============================================================

DELIMITER //

CREATE TRIGGER check_flight_seat_aircraft_insert
BEFORE INSERT ON flight_seats
FOR EACH ROW
BEGIN
    DECLARE v_aircraft_id INT;

    SELECT aircraft_id
    INTO   v_aircraft_id
    FROM   flights
    WHERE  flight_id = NEW.flight_id;

    IF v_aircraft_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Invalid flight_id';
    END IF;

    IF v_aircraft_id <> NEW.aircraft_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Aircraft mismatch for this flight seat';
    END IF;
END //

CREATE TRIGGER check_flight_seat_aircraft_update
BEFORE UPDATE ON flight_seats
FOR EACH ROW
BEGIN
    DECLARE v_aircraft_id INT;

    SELECT aircraft_id
    INTO   v_aircraft_id
    FROM   flights
    WHERE  flight_id = NEW.flight_id;

    IF v_aircraft_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Invalid flight_id';
    END IF;

    IF v_aircraft_id <> NEW.aircraft_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Aircraft mismatch for this flight seat';
    END IF;
END //

DELIMITER ;


-- ============================================================
-- OPERATION 1
-- Staff: Flight Generation from Schedule
--
-- Generates actual flight rows from a recurring schedule.
-- Checks schedule_days and inserts flights only on matching days.
-- ============================================================

DELIMITER //

CREATE PROCEDURE generate_flights_from_schedule (
    IN p_schedule_id   INT,
    IN p_aircraft_id   INT,
    IN p_start_date    DATE,
    IN p_end_date      DATE,
    IN p_trip_type_id  INT
)
BEGIN
    DECLARE v_current_date     DATE;
    DECLARE v_day_name         VARCHAR(3);
    DECLARE v_next_flight_id   INT;
    DECLARE v_next_itinerary_id INT;
    DECLARE v_valid_from       DATE;
    DECLARE v_valid_to         DATE;
    DECLARE v_aircraft_exists  INT;
    DECLARE v_itinerary_id     INT;
    DECLARE v_leg_type         VARCHAR(10);
    DECLARE v_trip_type        VARCHAR(15);
    DECLARE v_dep_airport      CHAR(3);
    DECLARE v_arr_airport      CHAR(3);

    IF p_start_date > p_end_date THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Start date cannot be after end date';
    END IF;

    SELECT valid_from, valid_to, dep_airport, arr_airport
    INTO   v_valid_from, v_valid_to, v_dep_airport, v_arr_airport
    FROM   flight_schedules
    WHERE  schedule_id = p_schedule_id;

    IF v_valid_from IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Schedule does not exist';
    END IF;

    IF p_start_date < v_valid_from OR p_end_date > v_valid_to THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Date range is outside schedule validity period';
    END IF;

    SELECT COUNT(*)
    INTO   v_aircraft_exists
    FROM   aircraft
    WHERE  aircraft_id = p_aircraft_id;

    IF v_aircraft_exists = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Aircraft does not exist';
    END IF;

    CASE p_trip_type_id
        WHEN 1 THEN
            SET v_itinerary_id = 10;
            SET v_trip_type = 'OneWay';
            SET v_leg_type = 'Outbound';
        WHEN 2 THEN
            SET v_itinerary_id = 20;
            SET v_trip_type = 'RoundTrip';
            SET v_leg_type = 'Outbound';
        WHEN 3 THEN
            SET v_itinerary_id = 30;
            SET v_trip_type = 'Connecting';
            SET v_leg_type = 'Outbound';
        ELSE
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid trip type id (Must be 1: OneWay, 2: RoundTrip, 3: Connecting)';
    END CASE;

    SET v_current_date = p_start_date;

    SELECT COALESCE(MAX(flight_id), 0) + 1
    INTO   v_next_flight_id
    FROM   flights;

    SELECT COALESCE(MAX(itinerary_id), 0) + 1
    INTO   v_next_itinerary_id
    FROM   itineraries;

    WHILE v_current_date <= p_end_date DO

        SET v_day_name =
            CASE DAYOFWEEK(v_current_date)
                WHEN 1 THEN 'SUN'
                WHEN 2 THEN 'MON'
                WHEN 3 THEN 'TUE'
                WHEN 4 THEN 'WED'
                WHEN 5 THEN 'THU'
                WHEN 6 THEN 'FRI'
                WHEN 7 THEN 'SAT'
            END;

        IF EXISTS (
            SELECT 1
            FROM   schedule_days
            WHERE  schedule_id  = p_schedule_id
              AND  day_of_week  = v_day_name
        ) THEN

            INSERT INTO itineraries (
                itinerary_id, trip_type, departure_airport_code, arrival_airport_code
            )
            VALUES (
                v_next_itinerary_id, v_trip_type, v_dep_airport, v_arr_airport
            );

            INSERT IGNORE INTO flights (
                flight_id, itinerary_id, schedule_id, flight_date, aircraft_id,
                segment_order, leg_type, status
            )
            VALUES (
                v_next_flight_id, v_next_itinerary_id, p_schedule_id,
                v_current_date, p_aircraft_id, 1, v_leg_type, 'Scheduled'
            );

            SET v_next_flight_id = v_next_flight_id + 1;
            SET v_next_itinerary_id = v_next_itinerary_id + 1;

        END IF;

        SET v_current_date = DATE_ADD(v_current_date, INTERVAL 1 DAY);

    END WHILE;
END //

DELIMITER ;

-- Example:
-- CALL generate_flights_from_schedule(1, 101, '2026-06-01', '2026-06-30');


-- ============================================================
-- OPERATION 1-B
-- Staff: Generate Flight Seats
--
-- After generating flights, copies aircraft seat layout into
-- flight_seats with pricing per class.
-- ============================================================

DELIMITER //

CREATE PROCEDURE generate_flight_seats (
    IN p_flight_id       INT,
    IN p_economy_price   DECIMAL(10,2),
    IN p_business_price  DECIMAL(10,2),
    IN p_first_price     DECIMAL(10,2)
)
BEGIN
    DECLARE v_aircraft_id INT;

    SELECT aircraft_id
    INTO   v_aircraft_id
    FROM   flights
    WHERE  flight_id = p_flight_id;

    IF v_aircraft_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Flight does not exist';
    END IF;

    INSERT IGNORE INTO flight_seats (
        flight_id, aircraft_id, seat_number, class_id, is_available, price
    )
    SELECT
        p_flight_id,
        aircraft_id,
        seat_number,
        class_id,
        1,
        CASE
            WHEN class_id = 1 THEN p_economy_price
            WHEN class_id = 2 THEN p_business_price
            WHEN class_id = 3 THEN p_first_price
            ELSE p_economy_price
        END
    FROM  aircraft_seats
    WHERE aircraft_id = v_aircraft_id;
END //

DELIMITER ;

-- Example:
-- CALL generate_flight_seats(1001, 300.00, 800.00, 1500.00);


-- ============================================================
-- OPERATION 2
-- Customer: Basic Flight Search
--
-- Searches by departure airport, arrival airport, and date.
-- Returns available seat count and lowest price per flight.
-- ============================================================

DELIMITER //

CREATE PROCEDURE search_flights (
    IN p_dep_airport CHAR(3),
    IN p_arr_airport CHAR(3),
    IN p_flight_date DATE,
    IN p_class_id    INT,
    IN p_max_price   DECIMAL(10,2)
)
BEGIN
    SELECT
        'DIRECT'               AS route_type,
        f.flight_id,
        f.itinerary_id,
        fs.airline_id,
        al.airline_name,
        fs.flight_number,
        fs.dep_airport,
        fs.arr_airport,
        f.flight_date,
        fs.dep_time,
        fs.arr_time,
        f.status,
        sc.class_id,
        sc.class_name,
        COUNT(fls.seat_number) AS available_seats,
        MIN(fls.price)         AS lowest_price
    FROM   flights f
    JOIN   flight_schedules fs ON f.schedule_id = fs.schedule_id
    JOIN   airlines al           ON fs.airline_id = al.airline_id
    JOIN   flight_seats fls      ON f.flight_id   = fls.flight_id
    JOIN   seat_classes sc       ON fls.class_id  = sc.class_id
    WHERE  fs.dep_airport  = p_dep_airport
      AND  fs.arr_airport  = p_arr_airport
      AND  f.flight_date   = p_flight_date
      AND  f.status        = 'Scheduled'
      AND  fls.is_available = 1
      AND  (p_class_id  IS NULL OR fls.class_id = p_class_id)
      AND  (p_max_price IS NULL OR fls.price   <= p_max_price)
    GROUP BY
        f.flight_id, f.itinerary_id, fs.airline_id, al.airline_name,
        fs.flight_number, fs.dep_airport, fs.arr_airport,
        f.flight_date, fs.dep_time, fs.arr_time, f.status,
        sc.class_id, sc.class_name
    ORDER BY fs.dep_time ASC, sc.class_id ASC, lowest_price ASC;
END //

DELIMITER ;

-- Example:
-- CALL search_flights('ICN', 'JFK', '2026-06-01', NULL, NULL);


-- ============================================================
-- OPERATION 2-B
-- Customer: Advanced Flight Search (alias of unified search_flights)
-- ============================================================

DELIMITER //

CREATE PROCEDURE advanced_search_flights (
    IN p_dep_airport CHAR(3),
    IN p_arr_airport CHAR(3),
    IN p_flight_date DATE,
    IN p_class_id    INT,
    IN p_max_price   DECIMAL(10,2)
)
BEGIN
    CALL search_flights(
        p_dep_airport,
        p_arr_airport,
        p_flight_date,
        p_class_id,
        p_max_price
    );
END //

DELIMITER ;

-- Example:
-- CALL advanced_search_flights('ICN', 'JFK', '2026-06-01', 1, 500.00);


-- ============================================================
-- OPERATION 2-C
-- Customer: Flight Search with Promotions
--
-- Applies active promotions to compute the final discounted price.
-- Promotion matching rules:
--   - schedule_id: exact match or NULL (any schedule)
--   - dep_airport:  exact match or NULL (any departure)
--   - arr_airport:  exact match or NULL (any arrival)
--   - class_id:     exact match or NULL (any class)
-- p_max_price filter is applied to the discounted price.
-- ============================================================

DELIMITER //

CREATE PROCEDURE search_flights_with_promotions (
    IN p_dep_airport CHAR(3),
    IN p_arr_airport CHAR(3),
    IN p_flight_date DATE,
    IN p_class_id    INT,
    IN p_max_price   DECIMAL(10,2)
)
BEGIN
    SELECT
        f.flight_id,
        fs.airline_id,
        fs.flight_number,
        fs.dep_airport,
        fs.arr_airport,
        f.flight_date,
        fs.dep_time,
        fs.arr_time,
        sc.class_name,

        COUNT(fls.seat_number)                                    AS available_seats,
        MIN(fls.price)                                            AS original_lowest_price,
        COALESCE(MAX(p.discount_percent), 0)                      AS discount_percent,
        ROUND(
            MIN(fls.price)
            * (1 - COALESCE(MAX(p.discount_percent), 0) / 100),
            2
        )                                                         AS final_lowest_price,
        COALESCE(MAX(p.promo_code), 'NO_PROMO')                   AS applied_promo_code

    FROM   flights f
    JOIN   flight_schedules fs ON f.schedule_id = fs.schedule_id
    JOIN   flight_seats fls    ON f.flight_id   = fls.flight_id
    JOIN   seat_classes sc     ON fls.class_id  = sc.class_id
    LEFT JOIN promotions p
           ON  p.is_active    = TRUE
           AND f.flight_date  BETWEEN p.valid_from AND p.valid_to
           AND (p.schedule_id IS NULL OR p.schedule_id = fs.schedule_id)
           AND (p.dep_airport IS NULL OR p.dep_airport = fs.dep_airport)
           AND (p.arr_airport IS NULL OR p.arr_airport = fs.arr_airport)
           AND (p.class_id    IS NULL OR p.class_id    = fls.class_id)
    WHERE  fs.dep_airport  = p_dep_airport
      AND  fs.arr_airport  = p_arr_airport
      AND  f.flight_date   = p_flight_date
      AND  f.status        = 'Scheduled'
      AND  fls.is_available = 1
      AND  (p_class_id IS NULL OR fls.class_id = p_class_id)
    GROUP BY
        f.flight_id, fs.airline_id, fs.flight_number,
        fs.dep_airport, fs.arr_airport,
        f.flight_date, fs.dep_time, fs.arr_time, sc.class_name
    HAVING
        p_max_price IS NULL
        OR ROUND(
               MIN(fls.price)
               * (1 - COALESCE(MAX(p.discount_percent), 0) / 100),
               2
           ) <= p_max_price
    ORDER BY final_lowest_price ASC, fs.dep_time ASC;
END //

DELIMITER ;

-- Example:
-- CALL search_flights_with_promotions('ICN', 'JFK', '2026-06-01', 1, 500.00);

-- Promo-code driven search used by the web UI.
-- If p_promo_code is provided, only flights matching that code are returned.

DELIMITER //

CREATE PROCEDURE search_flights_with_promo_code (
    IN p_dep_airport CHAR(3),
    IN p_arr_airport CHAR(3),
    IN p_flight_date DATE,
    IN p_class_id    INT,
    IN p_max_price   DECIMAL(10,2),
    IN p_promo_code  VARCHAR(30)
)
BEGIN
    SELECT
        f.flight_id,
        fs.airline_id,
        fs.flight_number,
        fs.dep_airport,
        fs.arr_airport,
        f.flight_date,
        fs.dep_time,
        fs.arr_time,
        sc.class_name,
        COUNT(fls.seat_number)               AS available_seats,
        MIN(fls.price)                       AS original_lowest_price,
        p.discount_percent                   AS discount_percent,
        ROUND(MIN(fls.price) * (1 - p.discount_percent / 100), 2)
                                             AS final_lowest_price,
        p.promo_code                         AS applied_promo_code,
        p.description                        AS promo_description
    FROM   flights f
    JOIN   flight_schedules fs ON f.schedule_id = fs.schedule_id
    JOIN   flight_seats fls    ON f.flight_id   = fls.flight_id
    JOIN   seat_classes sc     ON fls.class_id  = sc.class_id
    JOIN   promotions p
           ON  p.is_active    = TRUE
           AND f.flight_date  BETWEEN p.valid_from AND p.valid_to
           AND (p.schedule_id IS NULL OR p.schedule_id = fs.schedule_id)
           AND (p.dep_airport IS NULL OR p.dep_airport = fs.dep_airport)
           AND (p.arr_airport IS NULL OR p.arr_airport = fs.arr_airport)
           AND (p.class_id    IS NULL OR p.class_id    = fls.class_id)
    WHERE  fs.dep_airport   = p_dep_airport
      AND  fs.arr_airport   = p_arr_airport
      AND  f.flight_date    = p_flight_date
      AND  f.status         = 'Scheduled'
      AND  fls.is_available = 1
      AND  (p_class_id IS NULL OR fls.class_id = p_class_id)
      AND  (p_promo_code IS NULL OR p_promo_code = '' OR p.promo_code = UPPER(p_promo_code))
    GROUP BY
        f.flight_id, fs.airline_id, fs.flight_number,
        fs.dep_airport, fs.arr_airport,
        f.flight_date, fs.dep_time, fs.arr_time, sc.class_name,
        p.promo_code, p.description, p.discount_percent
    HAVING
        p_max_price IS NULL
        OR ROUND(MIN(fls.price) * (1 - p.discount_percent / 100), 2) <= p_max_price
    ORDER BY final_lowest_price ASC, fs.dep_time ASC;
END //

DELIMITER ;

-- Example:
-- CALL search_flights_with_promo_code('ICN', 'JFK', '2026-06-01', 1, NULL, 'SUMMER10');

-- Lists all active promotions applicable to a selected flight and seat class.

DELIMITER //

CREATE PROCEDURE available_promotions_for_flight (
    IN p_flight_id INT,
    IN p_class_id  INT
)
BEGIN
    SELECT DISTINCT
        p.promo_id,
        p.promo_code,
        p.description,
        p.discount_percent,
        p.valid_from,
        p.valid_to
    FROM flights f
    JOIN flight_schedules fs ON f.schedule_id = fs.schedule_id
    JOIN promotions p
         ON  p.is_active    = TRUE
         AND f.flight_date  BETWEEN p.valid_from AND p.valid_to
         AND (p.schedule_id IS NULL OR p.schedule_id = fs.schedule_id)
         AND (p.dep_airport IS NULL OR p.dep_airport = fs.dep_airport)
         AND (p.arr_airport IS NULL OR p.arr_airport = fs.arr_airport)
         AND (p.class_id    IS NULL OR p.class_id    = p_class_id)
    WHERE f.flight_id = p_flight_id
    ORDER BY p.discount_percent DESC, p.promo_code;
END //

DELIMITER ;

-- Example:
-- CALL available_promotions_for_flight(1001, 1);


-- ============================================================
-- OPERATION 2-D
-- Customer: Direct and One-Stop Connecting Flight Search
--
-- Returns both direct flights and one-stop itineraries in one
-- result set via UNION ALL.
--
-- Constraints for connecting legs:
--   - Both legs on the same calendar date.
--   - Minimum 1-hour transfer time at stopover.
--   - Stopover airport must differ from origin and destination.
--
-- NOTE: available_seats for ONE_STOP rows is computed as
--   LEAST(COUNT(DISTINCT leg1 seats), COUNT(DISTINCT leg2 seats)).
--   Due to cross-join row multiplication, these counts may be
--   inflated. Treat ONE_STOP available_seats as an approximation.
-- ============================================================

DELIMITER //

CREATE PROCEDURE search_direct_and_connecting_flights (
    IN p_dep_airport CHAR(3),
    IN p_arr_airport CHAR(3),
    IN p_flight_date DATE,
    IN p_class_id    INT
)
BEGIN
    -- Direct flights
    SELECT
        'DIRECT'               AS route_type,
        f.flight_id            AS first_flight_id,
        fs.airline_id          AS first_airline,
        fs.flight_number       AS first_flight_number,
        fs.dep_airport         AS dep_airport,
        fs.arr_airport         AS arr_airport,
        f.flight_date          AS flight_date,
        fs.dep_time            AS first_dep_time,
        fs.arr_time            AS first_arr_time,
        NULL                   AS connection_airport,
        NULL                   AS second_flight_id,
        NULL                   AS second_airline,
        NULL                   AS second_flight_number,
        NULL                   AS second_dep_time,
        NULL                   AS second_arr_time,
        CAST(f.flight_id AS CHAR) AS flight_ids,
        fs.flight_number       AS flight_numbers,
        NULL                   AS connection_airports,
        0                      AS stop_count,
        COUNT(fls.seat_number) AS available_seats,
        MIN(fls.price)         AS total_lowest_price

    FROM   flights f
    JOIN   flight_schedules fs ON f.schedule_id = fs.schedule_id
    JOIN   flight_seats fls    ON f.flight_id   = fls.flight_id
    WHERE  fs.dep_airport  = p_dep_airport
      AND  fs.arr_airport  = p_arr_airport
      AND  f.flight_date   = p_flight_date
      AND  f.status        = 'Scheduled'
      AND  fls.is_available = 1
      AND  (p_class_id IS NULL OR fls.class_id = p_class_id)
    GROUP BY
        f.flight_id, fs.airline_id, fs.flight_number,
        fs.dep_airport, fs.arr_airport,
        f.flight_date, fs.dep_time, fs.arr_time

    UNION ALL

    -- Ad-hoc two-leg pairs (different itineraries; bookable only if later linked)
    SELECT
        'ONE_STOP'              AS route_type,
        f1.flight_id            AS first_flight_id,
        fs1.airline_id          AS first_airline,
        fs1.flight_number       AS first_flight_number,
        fs1.dep_airport         AS dep_airport,
        fs2.arr_airport         AS arr_airport,
        f1.flight_date          AS flight_date,
        fs1.dep_time            AS first_dep_time,
        fs1.arr_time            AS first_arr_time,
        fs1.arr_airport         AS connection_airport,
        f2.flight_id            AS second_flight_id,
        fs2.airline_id          AS second_airline,
        fs2.flight_number       AS second_flight_number,
        fs2.dep_time            AS second_dep_time,
        fs2.arr_time            AS second_arr_time,
        CONCAT(f1.flight_id, ',', f2.flight_id) AS flight_ids,
        CONCAT(fs1.flight_number, ',', fs2.flight_number) AS flight_numbers,
        fs1.arr_airport         AS connection_airports,
        1                       AS stop_count,
        LEAST(
            COUNT(DISTINCT fls1.seat_number),
            COUNT(DISTINCT fls2.seat_number)
        )                       AS available_seats,
        MIN(fls1.price) + MIN(fls2.price) AS total_lowest_price

    FROM   flights f1
    JOIN   flight_schedules fs1 ON f1.schedule_id = fs1.schedule_id
    JOIN   flights f2           ON f2.flight_date  = f1.flight_date
    JOIN   flight_schedules fs2 ON f2.schedule_id  = fs2.schedule_id
    JOIN   flight_seats fls1    ON f1.flight_id    = fls1.flight_id
    JOIN   flight_seats fls2    ON f2.flight_id    = fls2.flight_id
    WHERE  fs1.dep_airport  = p_dep_airport
      AND  fs2.arr_airport  = p_arr_airport
      AND  fs1.arr_airport  = fs2.dep_airport
      AND  fs1.arr_airport  <> p_dep_airport
      AND  fs1.arr_airport  <> p_arr_airport
      AND  f1.flight_date   = p_flight_date
      AND  f2.flight_date   = p_flight_date
      AND  f1.status        = 'Scheduled'
      AND  f2.status        = 'Scheduled'
      AND  f1.itinerary_id <> f2.itinerary_id
      AND  NOT EXISTS (
          SELECT 1
          FROM flights fx
          WHERE fx.itinerary_id = f1.itinerary_id
            AND fx.flight_date = f1.flight_date
            AND fx.status = 'Scheduled'
          GROUP BY fx.itinerary_id, fx.flight_date
          HAVING COUNT(*) >= 2
      )
      AND  NOT EXISTS (
          SELECT 1
          FROM flights fx
          WHERE fx.itinerary_id = f2.itinerary_id
            AND fx.flight_date = f2.flight_date
            AND fx.status = 'Scheduled'
          GROUP BY fx.itinerary_id, fx.flight_date
          HAVING COUNT(*) >= 2
      )
      AND  fls1.is_available = 1
      AND  fls2.is_available = 1
      AND  (p_class_id IS NULL OR fls1.class_id = p_class_id)
      AND  (p_class_id IS NULL OR fls2.class_id = p_class_id)
      AND  fs2.dep_time >= ADDTIME(fs1.arr_time, '01:00:00')
    GROUP BY
        f1.flight_id, fs1.airline_id, fs1.flight_number,
        fs1.dep_airport, fs1.arr_airport,
        f1.flight_date, fs1.dep_time, fs1.arr_time,
        f2.flight_id, fs2.airline_id, fs2.flight_number,
        fs2.dep_airport, fs2.arr_airport,
        fs2.dep_time, fs2.arr_time

    UNION ALL

    -- Itinerary-based connecting routes (2+ legs, same itinerary_id)
    SELECT
        IF(COUNT(DISTINCT f.flight_id) = 2, 'ONE_STOP', 'CONNECTING') AS route_type,
        MIN(CASE WHEN f.segment_order = 1 THEN f.flight_id END) AS first_flight_id,
        MIN(CASE WHEN f.segment_order = 1 THEN fs.airline_id END) AS first_airline,
        MIN(CASE WHEN f.segment_order = 1 THEN fs.flight_number END) AS first_flight_number,
        i.departure_airport_code AS dep_airport,
        i.arrival_airport_code   AS arr_airport,
        f.flight_date            AS flight_date,
        MIN(CASE WHEN f.segment_order = 1 THEN fs.dep_time END) AS first_dep_time,
        MIN(CASE WHEN f.segment_order = 1 THEN fs.arr_time END) AS first_arr_time,
        MIN(CASE WHEN f.segment_order = 1 THEN fs.arr_airport END) AS connection_airport,
        MAX(CASE WHEN f.segment_order = 2 THEN f.flight_id END) AS second_flight_id,
        MAX(CASE WHEN f.segment_order = 2 THEN fs.airline_id END) AS second_airline,
        MAX(CASE WHEN f.segment_order = 2 THEN fs.flight_number END) AS second_flight_number,
        MAX(CASE WHEN f.segment_order = 2 THEN fs.dep_time END) AS second_dep_time,
        MAX(CASE WHEN f.segment_order = 2 THEN fs.arr_time END) AS second_arr_time,
        GROUP_CONCAT(f.flight_id ORDER BY f.segment_order) AS flight_ids,
        GROUP_CONCAT(fs.flight_number ORDER BY f.segment_order) AS flight_numbers,
        GROUP_CONCAT(
            CASE WHEN f.segment_order < mx.max_segment_order THEN fs.arr_airport END
            ORDER BY f.segment_order SEPARATOR ','
        ) AS connection_airports,
        COUNT(DISTINCT f.flight_id) - 1 AS stop_count,
        MIN(leg_stats.available_seats) AS available_seats,
        SUM(leg_stats.min_price)     AS total_lowest_price

    FROM itineraries i
    JOIN flights f ON i.itinerary_id = f.itinerary_id
    JOIN (
        SELECT itinerary_id, flight_date, MAX(segment_order) AS max_segment_order
        FROM flights
        WHERE status = 'Scheduled'
        GROUP BY itinerary_id, flight_date
    ) mx ON mx.itinerary_id = i.itinerary_id AND mx.flight_date = f.flight_date
    JOIN (
        SELECT
            fx.itinerary_id,
            fx.flight_date,
            fx.flight_id,
            COUNT(fls2.seat_number) AS available_seats,
            MIN(fls2.price)         AS min_price
        FROM flights fx
        JOIN flight_seats fls2
          ON fx.flight_id = fls2.flight_id
         AND fls2.is_available = 1
         AND (p_class_id IS NULL OR fls2.class_id = p_class_id)
        WHERE fx.status = 'Scheduled'
        GROUP BY fx.itinerary_id, fx.flight_date, fx.flight_id
    ) leg_stats
      ON leg_stats.itinerary_id = i.itinerary_id
     AND leg_stats.flight_date  = f.flight_date
     AND leg_stats.flight_id    = f.flight_id
    JOIN flight_schedules fs ON f.schedule_id = fs.schedule_id
    WHERE i.trip_type = 'Connecting'
      AND i.departure_airport_code = p_dep_airport
      AND i.arrival_airport_code = p_arr_airport
      AND f.flight_date = p_flight_date
      AND f.status = 'Scheduled'
      AND NOT EXISTS (
          SELECT 1
          FROM flights f_a
          JOIN flight_schedules fs_a ON f_a.schedule_id = fs_a.schedule_id
          JOIN flights f_b
            ON f_b.itinerary_id = f_a.itinerary_id
           AND f_b.segment_order = f_a.segment_order + 1
           AND f_b.flight_date = f_a.flight_date
          JOIN flight_schedules fs_b ON f_b.schedule_id = fs_b.schedule_id
          WHERE f_a.itinerary_id = i.itinerary_id
            AND f_a.flight_date = p_flight_date
            AND f_a.status = 'Scheduled'
            AND f_b.status = 'Scheduled'
            AND (
                fs_a.arr_airport <> fs_b.dep_airport
                OR fs_b.dep_time < ADDTIME(fs_a.arr_time, '01:00:00')
            )
      )
    GROUP BY i.itinerary_id, f.flight_date, i.departure_airport_code, i.arrival_airport_code, mx.max_segment_order
    HAVING COUNT(DISTINCT f.flight_id) >= 2
       AND MIN(CASE WHEN f.segment_order = 1 THEN fs.dep_airport END) = i.departure_airport_code
       AND MIN(leg_stats.available_seats) > 0

    ORDER BY total_lowest_price ASC, first_dep_time ASC;
END //

DELIMITER ;

-- Example:
-- CALL search_direct_and_connecting_flights('ICN', 'JFK', '2026-06-01', 1);


-- ============================================================
-- OPERATION 2-E
-- Customer: Recommended Routes
--
-- Scoring formula (higher = better recommendation):
--   + 30 pts  if DIRECT flight
--   + min(available_seats, 20) pts  seat availability bonus
--   - min(total_lowest_price / 50, 40) pts  price penalty (capped 40)
--
-- [FIX 2] Price penalty cap prevents cheap multi-leg routes from
-- always beating expensive but superior direct flights.
--
-- Returns top 5 results ordered by score descending.
-- ============================================================

DELIMITER //

CREATE PROCEDURE recommend_routes (
    IN p_dep_airport CHAR(3),
    IN p_arr_airport CHAR(3),
    IN p_flight_date DATE,
    IN p_class_id    INT
)
BEGIN
    SELECT
        route_type,
        first_flight_id,
        first_airline,
        first_flight_number,
        dep_airport,
        arr_airport,
        flight_date,
        first_dep_time,
        first_arr_time,
        connection_airport,
        second_flight_id,
        second_airline,
        second_flight_number,
        second_dep_time,
        second_arr_time,
        available_seats,
        total_lowest_price,

        ROUND(
            -- Direct flight bonus
            CASE WHEN route_type = 'DIRECT' THEN 30 ELSE 0 END
            -- Seat availability bonus (capped at 20)
            + LEAST(available_seats, 20)
            -- Price penalty: $50 = -1pt, capped at -40pts
            -- [FIX 2] was: -(total_lowest_price / 100), uncapped and too weak
            - LEAST(total_lowest_price / 50, 40),
            2
        ) AS recommendation_score

    FROM (
        -- Direct flights sub-query
        SELECT
            'DIRECT'               AS route_type,
            f.flight_id            AS first_flight_id,
            fs.airline_id          AS first_airline,
            fs.flight_number       AS first_flight_number,
            fs.dep_airport         AS dep_airport,
            fs.arr_airport         AS arr_airport,
            f.flight_date          AS flight_date,
            fs.dep_time            AS first_dep_time,
            fs.arr_time            AS first_arr_time,
            NULL                   AS connection_airport,
            NULL                   AS second_flight_id,
            NULL                   AS second_airline,
            NULL                   AS second_flight_number,
            NULL                   AS second_dep_time,
            NULL                   AS second_arr_time,
            COUNT(fls.seat_number) AS available_seats,
            MIN(fls.price)         AS total_lowest_price

        FROM   flights f
        JOIN   flight_schedules fs ON f.schedule_id = fs.schedule_id
        JOIN   flight_seats fls    ON f.flight_id   = fls.flight_id
        WHERE  fs.dep_airport  = p_dep_airport
          AND  fs.arr_airport  = p_arr_airport
          AND  f.flight_date   = p_flight_date
          AND  f.status        = 'Scheduled'
          AND  fls.is_available = 1
          AND  (p_class_id IS NULL OR fls.class_id = p_class_id)
        GROUP BY
            f.flight_id, fs.airline_id, fs.flight_number,
            fs.dep_airport, fs.arr_airport,
            f.flight_date, fs.dep_time, fs.arr_time

        UNION ALL

        -- One-stop connecting flights sub-query
        SELECT
            'ONE_STOP'              AS route_type,
            f1.flight_id            AS first_flight_id,
            fs1.airline_id          AS first_airline,
            fs1.flight_number       AS first_flight_number,
            fs1.dep_airport         AS dep_airport,
            fs2.arr_airport         AS arr_airport,
            f1.flight_date          AS flight_date,
            fs1.dep_time            AS first_dep_time,
            fs1.arr_time            AS first_arr_time,
            fs1.arr_airport         AS connection_airport,
            f2.flight_id            AS second_flight_id,
            fs2.airline_id          AS second_airline,
            fs2.flight_number       AS second_flight_number,
            fs2.dep_time            AS second_dep_time,
            fs2.arr_time            AS second_arr_time,
            LEAST(
                COUNT(DISTINCT fls1.seat_number),
                COUNT(DISTINCT fls2.seat_number)
            )                       AS available_seats,
            MIN(fls1.price) + MIN(fls2.price) AS total_lowest_price

        FROM   flights f1
        JOIN   flight_schedules fs1 ON f1.schedule_id = fs1.schedule_id
        JOIN   flights f2           ON f2.flight_date  = f1.flight_date
        JOIN   flight_schedules fs2 ON f2.schedule_id  = fs2.schedule_id
        JOIN   flight_seats fls1    ON f1.flight_id    = fls1.flight_id
        JOIN   flight_seats fls2    ON f2.flight_id    = fls2.flight_id
        WHERE  fs1.dep_airport  = p_dep_airport
          AND  fs2.arr_airport  = p_arr_airport
          AND  fs1.arr_airport  = fs2.dep_airport
          AND  fs1.arr_airport  <> p_dep_airport
          AND  fs1.arr_airport  <> p_arr_airport
          AND  f1.flight_date   = p_flight_date
          AND  f2.flight_date   = p_flight_date
          AND  f1.status        = 'Scheduled'
          AND  f2.status        = 'Scheduled'
          AND  fls1.is_available = 1
          AND  fls2.is_available = 1
          AND  (p_class_id IS NULL OR fls1.class_id = p_class_id)
          AND  (p_class_id IS NULL OR fls2.class_id = p_class_id)
          AND  fs2.dep_time >= ADDTIME(fs1.arr_time, '01:00:00')
        GROUP BY
            f1.flight_id, fs1.airline_id, fs1.flight_number,
            fs1.dep_airport, fs1.arr_airport,
            f1.flight_date, fs1.dep_time, fs1.arr_time,
            f2.flight_id, fs2.airline_id, fs2.flight_number,
            fs2.dep_airport, fs2.arr_airport,
            fs2.dep_time, fs2.arr_time

    ) AS route_candidates

    ORDER BY
        recommendation_score DESC,
        total_lowest_price   ASC,
        first_dep_time       ASC

    LIMIT 5;
END //

DELIMITER ;

-- Example:
-- CALL recommend_routes('ICN', 'JFK', '2026-06-01', 1);


-- ============================================================
-- OPERATION 3
-- Customer: View Available Seats
--
-- Returns seats that are available and not currently held.
-- Cleans expired holds before querying.
-- ============================================================

DELIMITER //

CREATE PROCEDURE view_available_seats (
    IN p_flight_id INT
)
BEGIN
    DELETE FROM seat_holds
    WHERE expires_at < CURRENT_TIMESTAMP;

    SELECT
        fs.flight_id,
        fs.seat_number,
        sc.class_name,
        fs.price
    FROM   flight_seats fs
    JOIN   seat_classes sc ON fs.class_id   = sc.class_id
    LEFT JOIN seat_holds sh
           ON fs.flight_id  = sh.flight_id
          AND fs.seat_number = sh.seat_number
          AND sh.expires_at >= CURRENT_TIMESTAMP
    WHERE  fs.flight_id   = p_flight_id
      AND  fs.is_available = 1
      AND  sh.hold_id      IS NULL
    ORDER BY sc.class_id, fs.seat_number;
END //

DELIMITER ;

-- Example:
-- CALL view_available_seats(1001);


-- ============================================================
-- OPERATION 3-B
-- Customer: Release Expired Seat Holds
--
-- Cleans all expired temporary seat holds.
-- Can be called as a scheduled cleanup job.
-- ============================================================

DELIMITER //

CREATE PROCEDURE release_expired_seat_holds()
BEGIN
    DELETE FROM seat_holds
    WHERE expires_at < CURRENT_TIMESTAMP;
END //

DELIMITER ;

-- Example:
-- CALL release_expired_seat_holds();


-- ============================================================
-- OPERATION 3-C
-- Customer: Real-time Seat Hold (10 minutes)
--
-- Temporarily holds a seat for 10 minutes before booking.
-- UNIQUE(flight_id, seat_number) prevents two users from
-- holding the same seat simultaneously.
-- ============================================================

DELIMITER //

CREATE PROCEDURE hold_seat (
    IN p_hold_id     INT,
    IN p_user_id     VARCHAR(20),
    IN p_flight_id   INT,
    IN p_seat_number VARCHAR(5)
)
BEGIN
    DECLARE v_available INT;
    DECLARE v_user_role VARCHAR(10);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    DELETE FROM seat_holds
    WHERE expires_at < CURRENT_TIMESTAMP;

    SELECT role
    INTO   v_user_role
    FROM   users
    WHERE  user_id = p_user_id;

    IF v_user_role IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'User does not exist';
    END IF;

    IF v_user_role <> 'Customer' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only customers can hold seats';
    END IF;

    SELECT is_available
    INTO   v_available
    FROM   flight_seats
    WHERE  flight_id   = p_flight_id
      AND  seat_number = p_seat_number
    FOR UPDATE;

    IF v_available IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Seat does not exist';
    END IF;

    IF v_available <> 1 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Seat is not available';
    END IF;

    DELETE FROM seat_holds
    WHERE user_id = p_user_id
      AND flight_id = p_flight_id
      AND seat_number <> p_seat_number;

    INSERT INTO seat_holds (
        hold_id, user_id, flight_id, seat_number, expires_at
    )
    VALUES (
        p_hold_id,
        p_user_id,
        p_flight_id,
        p_seat_number,
        DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE)
    );

    COMMIT;
END //

DELIMITER ;

-- Example:
-- CALL hold_seat(1, 'cust01', 1001, '12A');


-- ============================================================
-- OPERATION 3-D
-- Customer: Name Splitting — Last Name / First Name
--
-- [FIX 1] split_customer_names removed. This is the single
-- authoritative name-splitting procedure.
--
-- Assumption: name is stored as "FirstName LastName"
--   The last space-delimited token is treated as last_name.
--   Everything before it is treated as first_name.
--
-- Examples:
--   "John Smith"       → last_name = Smith,    first_name = John
--   "Mary Jane Watson" → last_name = Watson,   first_name = Mary Jane
--   "Gildong"          → last_name = Gildong,  first_name = (empty)
-- ============================================================

DELIMITER //

CREATE PROCEDURE split_name_last_first()
BEGIN
    SELECT
        user_id,
        first_name,
        middle_name,
        last_name,
        TRIM(CONCAT_WS(' ', first_name, NULLIF(TRIM(middle_name), ''), last_name)) AS full_name,
        email
    FROM users
    WHERE role = 'Customer'
    ORDER BY user_id;
END //

DELIMITER ;

-- Example:
-- CALL split_name_last_first();

-- Compatibility alias for the web API:
-- returns customer full names without requiring UI-side concatenation.

DELIMITER //

CREATE PROCEDURE get_customer_full_name()
BEGIN
    SELECT
        user_id,
        first_name,
        middle_name,
        last_name,
        TRIM(CONCAT_WS(' ', first_name, NULLIF(TRIM(middle_name), ''), last_name)) AS full_name,
        email
    FROM users
    WHERE role = 'Customer'
      AND status = 'Active'
    ORDER BY user_id;
END //

DELIMITER ;

-- Example:
-- CALL get_customer_full_name();


-- ============================================================
-- OPERATION 4
-- Atomic Create Booking & Double-Booking Prevention
--
-- Creates in one atomic transaction:
--   booking → booking_seats → flight_seats update
--   → payments → tickets → seat_holds cleanup
--
-- Double-booking prevention mechanisms:
--   - SELECT ... FOR UPDATE on flight_seats
--   - UNIQUE(flight_id, seat_number) in booking_seats and tickets
--   - seat_holds cross-user check
-- ============================================================

DELIMITER //

CREATE PROCEDURE make_reservation_with_promo (
    IN p_booking_id     INT,
    IN p_ticket_id      INT,
    IN p_payment_id     INT,
    IN p_user_id        VARCHAR(20),
    IN p_flight_id      INT,
    IN p_seat_number    VARCHAR(5),
    IN p_payment_method VARCHAR(10),
    IN p_promo_code     VARCHAR(30)
)
BEGIN
    DECLARE v_available     INT;
    DECLARE v_price         DECIMAL(10,2);
    DECLARE v_user_role     VARCHAR(10);
    DECLARE v_flight_status VARCHAR(15);
    DECLARE v_hold_count    INT;
    DECLARE v_class_id      INT;
    DECLARE v_discount      DECIMAL(5,2);
    DECLARE v_itinerary_id  INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    DELETE FROM seat_holds
    WHERE expires_at < CURRENT_TIMESTAMP;

    -- Validate customer
    SELECT role
    INTO   v_user_role
    FROM   users
    WHERE  user_id = p_user_id
    FOR UPDATE;

    IF v_user_role IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'User does not exist';
    END IF;

    IF v_user_role <> 'Customer' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only customers can make reservations';
    END IF;

    -- Validate flight status
    SELECT status, itinerary_id
    INTO   v_flight_status, v_itinerary_id
    FROM   flights
    WHERE  flight_id = p_flight_id
    FOR UPDATE;

    IF v_flight_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Flight does not exist';
    END IF;

    IF v_flight_status <> 'Scheduled' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Flight is not available for reservation';
    END IF;

    -- Lock and validate seat
    SELECT is_available, price, class_id
    INTO   v_available, v_price, v_class_id
    FROM   flight_seats
    WHERE  flight_id   = p_flight_id
      AND  seat_number = p_seat_number
    FOR UPDATE;

    IF v_available IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Seat does not exist';
    END IF;

    IF v_available <> 1 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Seat is not available';
    END IF;

    -- Reject if another user currently holds this seat
    SELECT COUNT(*)
    INTO   v_hold_count
    FROM   seat_holds
    WHERE  flight_id   = p_flight_id
      AND  seat_number = p_seat_number
      AND  expires_at >= CURRENT_TIMESTAMP
      AND  user_id    <> p_user_id;

    IF v_hold_count > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Seat is currently held by another customer';
    END IF;

    IF p_promo_code IS NOT NULL AND p_promo_code <> '' THEN
        SELECT MAX(p.discount_percent)
        INTO   v_discount
        FROM   promotions p
        JOIN   flights f           ON f.flight_id    = p_flight_id
        JOIN   flight_schedules fs ON f.schedule_id  = fs.schedule_id
        WHERE  p.is_active    = TRUE
          AND  p.promo_code   = UPPER(p_promo_code)
          AND  f.flight_date  BETWEEN p.valid_from AND p.valid_to
          AND  (p.schedule_id IS NULL OR p.schedule_id = fs.schedule_id)
          AND  (p.dep_airport IS NULL OR p.dep_airport = fs.dep_airport)
          AND  (p.arr_airport IS NULL OR p.arr_airport = fs.arr_airport)
          AND  (p.class_id    IS NULL OR p.class_id    = v_class_id);

        IF v_discount IS NULL THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Promotion code is not applicable to this flight and seat';
        END IF;

        SET v_price = ROUND(v_price * (1 - v_discount / 100), 2);
    END IF;

    -- Create booking (itinerary-level, per ER diagram)
    INSERT INTO bookings (booking_id, user_id, itinerary_id, status)
    VALUES (p_booking_id, p_user_id, v_itinerary_id, 'Active');

    -- Assign seat to booking
    INSERT INTO booking_seats (booking_id, flight_id, seat_number)
    VALUES (p_booking_id, p_flight_id, p_seat_number);

    -- Mark seat unavailable
    UPDATE flight_seats
    SET    is_available = 0
    WHERE  flight_id   = p_flight_id
      AND  seat_number = p_seat_number;

    -- Record payment
    INSERT INTO payments (payment_id, booking_id, amount, payment_method, status)
    VALUES (p_payment_id, p_booking_id, v_price, p_payment_method, 'SUCCESS');

    -- Issue ticket
    INSERT INTO tickets (ticket_id, booking_id, flight_id, seat_number)
    VALUES (p_ticket_id, p_booking_id, p_flight_id, p_seat_number);

    -- Release this user's hold (if any) after successful booking
    DELETE FROM seat_holds
    WHERE  user_id    = p_user_id
      AND  flight_id  = p_flight_id
      AND  seat_number = p_seat_number;

    COMMIT;
END //

DELIMITER ;

-- Example:
-- CALL make_reservation(5001, 7001, 9001, 'cust01', 1001, '12A', 'CARD');

DELIMITER //

CREATE PROCEDURE make_reservation (
    IN p_booking_id     INT,
    IN p_ticket_id      INT,
    IN p_payment_id     INT,
    IN p_user_id        VARCHAR(20),
    IN p_flight_id      INT,
    IN p_seat_number    VARCHAR(5),
    IN p_payment_method VARCHAR(10)
)
BEGIN
    CALL make_reservation_with_promo(
        p_booking_id,
        p_ticket_id,
        p_payment_id,
        p_user_id,
        p_flight_id,
        p_seat_number,
        p_payment_method,
        NULL
    );
END //

DELIMITER ;


-- ============================================================
-- OPERATION 5
-- Customer: Cancel Booking & Refund Logic
--
-- Validates active booking, cancels it, releases the seat,
-- and creates a full refund record.
-- ============================================================

DELIMITER //

CREATE PROCEDURE cancel_reservation (
    IN p_refund_id  INT,
    IN p_booking_id INT,
    IN p_user_id    VARCHAR(20)
)
BEGIN
    DECLARE v_itinerary_id   INT DEFAULT NULL;
    DECLARE v_payment_id     INT DEFAULT NULL;
    DECLARE v_amount         DECIMAL(10,2) DEFAULT NULL;
    DECLARE v_status         VARCHAR(10) DEFAULT NULL;
    DECLARE v_owner_id       VARCHAR(20) DEFAULT NULL;

    DECLARE v_booking_count  INT DEFAULT 0;
    DECLARE v_seat_count     INT DEFAULT 0;
    DECLARE v_payment_count  INT DEFAULT 0;
    DECLARE v_refund_count   INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;

    SELECT COUNT(*)
    INTO   v_booking_count
    FROM   bookings
    WHERE  booking_id = p_booking_id;

    IF v_booking_count = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Booking does not exist';
    END IF;

    SELECT status, itinerary_id, user_id
    INTO   v_status, v_itinerary_id, v_owner_id
    FROM   bookings
    WHERE  booking_id = p_booking_id
    FOR UPDATE;

    IF v_owner_id <> p_user_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'You can only cancel your own bookings';
    END IF;

    IF v_status <> 'Active' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Booking is not active';
    END IF;

    SELECT COUNT(*)
    INTO   v_refund_count
    FROM   refunds
    WHERE  booking_id = p_booking_id;

    IF v_refund_count > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Refund already exists for this booking';
    END IF;

    SELECT COUNT(*)
    INTO   v_seat_count
    FROM   booking_seats
    WHERE  booking_id = p_booking_id;

    IF v_seat_count = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No seat assigned to this booking';
    END IF;

    SELECT COUNT(*)
    INTO   v_payment_count
    FROM   payments
    WHERE  booking_id = p_booking_id
      AND  status = 'SUCCESS';

    IF v_payment_count = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No successful payment found';
    END IF;

    SELECT payment_id, amount
    INTO   v_payment_id, v_amount
    FROM   payments
    WHERE  booking_id = p_booking_id
      AND  status = 'SUCCESS'
    LIMIT 1
    FOR UPDATE;

    UPDATE bookings
    SET    status = 'Cancelled'
    WHERE  booking_id = p_booking_id;

    UPDATE flight_seats fs
    JOIN   booking_seats bs
           ON fs.flight_id = bs.flight_id
          AND fs.seat_number = bs.seat_number
    JOIN   flights f
           ON fs.flight_id = f.flight_id
    SET    fs.is_available = 1
    WHERE  bs.booking_id = p_booking_id
      AND  f.itinerary_id = v_itinerary_id;

    DELETE FROM tickets
    WHERE booking_id = p_booking_id;

    UPDATE payments
    SET    status = 'REFUNDED'
    WHERE  payment_id = v_payment_id;

    INSERT INTO refunds (refund_id, booking_id, payment_id, refund_amount)
    VALUES (p_refund_id, p_booking_id, v_payment_id, v_amount);

    COMMIT;
END //

DELIMITER ;

-- Example:
-- CALL cancel_reservation(3001, 5001);


-- ============================================================
-- OPERATION 6-A
-- Staff: Revenue Statistics by Flight
-- ============================================================

DELIMITER //

CREATE PROCEDURE revenue_report_by_flight()
BEGIN
    SELECT
        fs.airline_id,
        fs.flight_number,
        f.flight_id,
        f.itinerary_id,
        f.flight_date,
        fs.dep_airport,
        fs.arr_airport,
        COUNT(DISTINCT t.ticket_id) AS tickets_sold,
        COALESCE(SUM(fls.price), 0) AS total_revenue
    FROM flights f
    JOIN flight_schedules fs
         ON f.schedule_id = fs.schedule_id
    LEFT JOIN tickets t
         ON f.flight_id = t.flight_id
    LEFT JOIN bookings b
         ON t.booking_id = b.booking_id
        AND b.status = 'Active'
    LEFT JOIN payments p
         ON b.booking_id = p.booking_id
        AND p.status = 'SUCCESS'
    LEFT JOIN flight_seats fls
         ON t.flight_id = fls.flight_id
        AND t.seat_number = fls.seat_number
    WHERE b.booking_id IS NULL
       OR p.payment_id IS NOT NULL
    GROUP BY
        fs.airline_id,
        fs.flight_number,
        f.flight_id,
        f.itinerary_id,
        f.flight_date,
        fs.dep_airport,
        fs.arr_airport
    ORDER BY
        total_revenue DESC,
        f.flight_date ASC;
END //

DELIMITER ;

-- Example:
-- CALL revenue_report_by_flight();


-- ============================================================
-- OPERATION 6-B
-- Staff: Monthly Revenue Statistics
-- ============================================================

DELIMITER //

CREATE PROCEDURE revenue_report_by_month()
BEGIN
    SELECT
        fs.airline_id,
        DATE_FORMAT(f.flight_date, '%Y-%m') AS revenue_month,
        COUNT(DISTINCT t.ticket_id)         AS tickets_sold,
        COALESCE(SUM(fls.price), 0)         AS monthly_revenue
    FROM flights f
    JOIN flight_schedules fs
         ON f.schedule_id = fs.schedule_id
    LEFT JOIN tickets t
         ON f.flight_id = t.flight_id
    LEFT JOIN bookings b
         ON t.booking_id = b.booking_id
        AND b.status = 'Active'
    LEFT JOIN payments p
         ON b.booking_id = p.booking_id
        AND p.status = 'SUCCESS'
    LEFT JOIN flight_seats fls
         ON t.flight_id = fls.flight_id
        AND t.seat_number = fls.seat_number
    WHERE b.booking_id IS NULL
       OR p.payment_id IS NOT NULL
    GROUP BY
        fs.airline_id,
        DATE_FORMAT(f.flight_date, '%Y-%m')
    ORDER BY
        revenue_month,
        fs.airline_id;
END //

DELIMITER ;

-- Example:
-- CALL revenue_report_by_month();


-- ============================================================
-- OPERATION 6-C
-- Staff: Revenue Statistics & Load Factor
--
-- Load Factor = sold_seats / total_seats * 100
-- ============================================================

DELIMITER //

CREATE PROCEDURE revenue_and_load_factor_report()
BEGIN
    SELECT
        fs.airline_id,
        fs.flight_number,
        f.flight_id,
        f.itinerary_id,
        f.flight_date,
        fs.dep_airport,
        fs.arr_airport,

        COALESCE(sold_stats.sold_seats, 0)  AS sold_seats,
        COALESCE(seat_stats.total_seats, 0) AS total_seats,

        ROUND(
            CASE
                WHEN COALESCE(seat_stats.total_seats, 0) = 0 THEN 0
                ELSE COALESCE(sold_stats.sold_seats, 0) * 100.0
                     / seat_stats.total_seats
            END,
            2
        ) AS load_factor_percent,

        COALESCE(revenue_stats.total_revenue, 0) AS total_revenue

    FROM flights f
    JOIN flight_schedules fs
         ON f.schedule_id = fs.schedule_id

    LEFT JOIN (
        SELECT
            flight_id,
            COUNT(DISTINCT seat_number) AS total_seats
        FROM flight_seats
        GROUP BY flight_id
    ) seat_stats
        ON f.flight_id = seat_stats.flight_id

    LEFT JOIN (
        SELECT
            t.flight_id,
            COUNT(DISTINCT t.ticket_id) AS sold_seats
        FROM tickets t
        JOIN bookings b
             ON t.booking_id = b.booking_id
            AND b.status = 'Active'
        JOIN payments p
             ON b.booking_id = p.booking_id
            AND p.status = 'SUCCESS'
        GROUP BY t.flight_id
    ) sold_stats
        ON f.flight_id = sold_stats.flight_id

    LEFT JOIN (
        SELECT
            t.flight_id,
            SUM(fls.price) AS total_revenue
        FROM tickets t
        JOIN bookings b
             ON t.booking_id = b.booking_id
            AND b.status = 'Active'
        JOIN payments p
             ON b.booking_id = p.booking_id
            AND p.status = 'SUCCESS'
        JOIN flight_seats fls
             ON t.flight_id = fls.flight_id
            AND t.seat_number = fls.seat_number
        GROUP BY t.flight_id
    ) revenue_stats
        ON f.flight_id = revenue_stats.flight_id

    ORDER BY
        f.flight_date,
        fs.flight_number;
END //

DELIMITER ;

-- Example:
-- CALL revenue_and_load_factor_report();

-- ============================================================
-- OPERATION 6-D
-- Staff: Revenue Statistics by Route
-- ============================================================

DELIMITER //

CREATE PROCEDURE revenue_report_by_route()
BEGIN
    SELECT
        fs.dep_airport,
        fs.arr_airport,
        COUNT(DISTINCT t.ticket_id) AS tickets_sold,
        COALESCE(SUM(fls.price), 0) AS route_revenue
    FROM flights f
    JOIN flight_schedules fs
         ON f.schedule_id = fs.schedule_id
    LEFT JOIN tickets t
         ON f.flight_id = t.flight_id
    LEFT JOIN bookings b
         ON t.booking_id = b.booking_id
        AND b.status = 'Active'
    LEFT JOIN payments p
         ON b.booking_id = p.booking_id
        AND p.status = 'SUCCESS'
    LEFT JOIN flight_seats fls
         ON t.flight_id = fls.flight_id
        AND t.seat_number = fls.seat_number
    WHERE b.booking_id IS NULL
       OR p.payment_id IS NOT NULL
    GROUP BY
        fs.dep_airport,
        fs.arr_airport
    ORDER BY
        route_revenue DESC;
END //

DELIMITER ;

-- Example:
-- CALL revenue_report_by_route();


-- ============================================================
-- OPERATION 6-E
-- Staff: Revenue Breakdown by Seat Class
-- ============================================================

DELIMITER //

CREATE PROCEDURE revenue_breakdown_by_seat_class()
BEGIN
    SELECT
        sc.class_name,
        COUNT(DISTINCT t.ticket_id) AS tickets_sold,
        COALESCE(SUM(fls.price), 0) AS class_revenue,
        ROUND(
            COALESCE(SUM(fls.price), 0)
            / NULLIF(total_stats.total_revenue, 0) * 100,
            2
        ) AS revenue_percentage
    FROM tickets t
    JOIN bookings b
         ON t.booking_id = b.booking_id
        AND b.status = 'Active'
    JOIN payments p
         ON b.booking_id = p.booking_id
        AND p.status = 'SUCCESS'
    JOIN flight_seats fls
         ON t.flight_id = fls.flight_id
        AND t.seat_number = fls.seat_number
    JOIN seat_classes sc
         ON fls.class_id = sc.class_id
    CROSS JOIN (
        SELECT
            SUM(fls2.price) AS total_revenue
        FROM tickets t2
        JOIN bookings b2
             ON t2.booking_id = b2.booking_id
            AND b2.status = 'Active'
        JOIN payments p2
             ON b2.booking_id = p2.booking_id
            AND p2.status = 'SUCCESS'
        JOIN flight_seats fls2
             ON t2.flight_id = fls2.flight_id
            AND t2.seat_number = fls2.seat_number
    ) total_stats
    GROUP BY
        sc.class_name,
        total_stats.total_revenue
    ORDER BY
        class_revenue DESC;
END //

DELIMITER ;

-- Example:
-- CALL revenue_breakdown_by_seat_class();


-- ============================================================
-- AUTH & CUSTOMER BOOKINGS
-- ============================================================

DELIMITER //

CREATE PROCEDURE get_customer_name_parts()
BEGIN
    SELECT
        user_id,
        first_name,
        middle_name,
        last_name,
        TRIM(CONCAT_WS(' ', first_name, NULLIF(TRIM(middle_name), ''), last_name)) AS display_name,
        email,
        role,
        status
    FROM users
    WHERE role = 'Customer'
      AND status = 'Active'
    ORDER BY user_id;
END //

CREATE PROCEDURE register_customer (
    IN  p_first_name  VARCHAR(50),
    IN  p_middle_name VARCHAR(50),
    IN  p_last_name   VARCHAR(50),
    IN  p_email       VARCHAR(100),
    IN  p_password    VARCHAR(255),
    OUT p_user_id     VARCHAR(20)
)
BEGIN
    DECLARE v_next_num INT;

    IF TRIM(p_first_name) = '' OR TRIM(p_last_name) = '' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'First name and last name are required';
    END IF;

    IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Email already registered';
    END IF;

    IF EXISTS (SELECT 1 FROM staff_registration_requests WHERE email = p_email AND status = 'Pending') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Email already has a pending staff request';
    END IF;

    SELECT COALESCE(MAX(CAST(SUBSTRING(user_id, 5) AS UNSIGNED)), 0) + 1
    INTO   v_next_num
    FROM   users
    WHERE  user_id LIKE 'cust%';

    SET p_user_id = CONCAT('cust', LPAD(v_next_num, 2, '0'));

    INSERT INTO users (
        user_id, first_name, middle_name, last_name,
        email, password, role, status
    )
    VALUES (
        p_user_id,
        TRIM(p_first_name),
        NULLIF(TRIM(p_middle_name), ''),
        TRIM(p_last_name),
        TRIM(p_email),
        p_password,
        'Customer',
        'Active'
    );
END //

CREATE PROCEDURE submit_staff_request (
    IN  p_first_name      VARCHAR(50),
    IN  p_middle_name     VARCHAR(50),
    IN  p_last_name       VARCHAR(50),
    IN  p_email           VARCHAR(100),
    IN  p_password        VARCHAR(255),
    IN  p_requested_role  VARCHAR(20),
    OUT p_request_id      INT
)
BEGIN
    IF TRIM(p_first_name) = '' OR TRIM(p_last_name) = '' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'First name and last name are required';
    END IF;

    IF p_requested_role NOT IN ('Staff', 'Admin') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Requested role must be Staff or Admin';
    END IF;

    IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Email already registered';
    END IF;

    IF EXISTS (
        SELECT 1 FROM staff_registration_requests
        WHERE email = p_email AND status = 'Pending'
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'A pending request already exists for this email';
    END IF;

    SELECT COALESCE(MAX(request_id), 0) + 1 INTO p_request_id FROM staff_registration_requests;

    INSERT INTO staff_registration_requests (
        request_id, first_name, middle_name, last_name,
        email, password, requested_role, status
    )
    VALUES (
        p_request_id,
        TRIM(p_first_name),
        NULLIF(TRIM(p_middle_name), ''),
        TRIM(p_last_name),
        TRIM(p_email),
        p_password,
        p_requested_role,
        'Pending'
    );
END //

CREATE PROCEDURE list_pending_staff_requests (
    IN p_reviewer_id VARCHAR(20)
)
BEGIN
    DECLARE v_reviewer_role VARCHAR(20);

    SELECT role INTO v_reviewer_role
    FROM users
    WHERE user_id = p_reviewer_id AND status = 'Active';

    IF v_reviewer_role IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Reviewer does not exist';
    END IF;

    IF v_reviewer_role NOT IN ('Admin', 'SuperAdmin') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only Admin or SuperAdmin can review staff requests';
    END IF;

    SELECT
        r.request_id,
        r.first_name,
        r.middle_name,
        r.last_name,
        TRIM(CONCAT_WS(' ', r.first_name, NULLIF(TRIM(r.middle_name), ''), r.last_name)) AS display_name,
        r.email,
        r.requested_role,
        r.status,
        r.requested_at
    FROM staff_registration_requests r
    WHERE r.status = 'Pending'
      AND (
          (v_reviewer_role = 'SuperAdmin' AND r.requested_role IN ('Staff', 'Admin'))
          OR (v_reviewer_role = 'Admin' AND r.requested_role = 'Staff')
      )
    ORDER BY r.requested_at;
END //

CREATE PROCEDURE approve_staff_request (
    IN p_request_id  INT,
    IN p_reviewer_id VARCHAR(20)
)
BEGIN
    DECLARE v_reviewer_role VARCHAR(20);
    DECLARE v_requested_role VARCHAR(20);
    DECLARE v_status VARCHAR(20);
    DECLARE v_email VARCHAR(100);
    DECLARE v_password VARCHAR(255);
    DECLARE v_first_name VARCHAR(50);
    DECLARE v_middle_name VARCHAR(50);
    DECLARE v_last_name VARCHAR(50);
    DECLARE v_new_user_id VARCHAR(20);
    DECLARE v_next_num INT;
    DECLARE v_prefix VARCHAR(10);

    SELECT role INTO v_reviewer_role
    FROM users
    WHERE user_id = p_reviewer_id AND status = 'Active';

    IF v_reviewer_role IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Reviewer does not exist';
    END IF;

    SELECT requested_role, status, email, password,
           first_name, middle_name, last_name
    INTO   v_requested_role, v_status, v_email, v_password,
           v_first_name, v_middle_name, v_last_name
    FROM   staff_registration_requests
    WHERE  request_id = p_request_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Staff request does not exist';
    END IF;

    IF v_status <> 'Pending' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Staff request is not pending';
    END IF;

    IF v_requested_role = 'Admin' AND v_reviewer_role <> 'SuperAdmin' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only SuperAdmin can approve Admin requests';
    END IF;

    IF v_requested_role = 'Staff' AND v_reviewer_role NOT IN ('Admin', 'SuperAdmin') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only Admin or SuperAdmin can approve Staff requests';
    END IF;

    IF EXISTS (SELECT 1 FROM users WHERE email = v_email) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Email already registered';
    END IF;

    IF v_requested_role = 'Admin' THEN
        SET v_prefix = 'admin';
        SELECT COALESCE(MAX(CAST(SUBSTRING(user_id, 6) AS UNSIGNED)), 0) + 1
        INTO   v_next_num
        FROM   users
        WHERE  user_id LIKE 'admin%';
        SET v_new_user_id = CONCAT('admin', LPAD(v_next_num, 2, '0'));
    ELSE
        SET v_prefix = 'staff';
        SELECT COALESCE(MAX(CAST(SUBSTRING(user_id, 6) AS UNSIGNED)), 0) + 1
        INTO   v_next_num
        FROM   users
        WHERE  user_id LIKE 'staff%';
        SET v_new_user_id = CONCAT('staff', LPAD(v_next_num, 2, '0'));
    END IF;

    INSERT INTO users (
        user_id, first_name, middle_name, last_name,
        email, password, role, status
    )
    VALUES (
        v_new_user_id, v_first_name, v_middle_name, v_last_name,
        v_email, v_password, v_requested_role, 'Active'
    );

    UPDATE staff_registration_requests
    SET    status = 'Approved',
           reviewed_by = p_reviewer_id,
           reviewed_at = CURRENT_TIMESTAMP
    WHERE  request_id = p_request_id;
END //

CREATE PROCEDURE reject_staff_request (
    IN p_request_id   INT,
    IN p_reviewer_id  VARCHAR(20),
    IN p_reject_reason VARCHAR(255)
)
BEGIN
    DECLARE v_reviewer_role VARCHAR(20);
    DECLARE v_requested_role VARCHAR(20);
    DECLARE v_status VARCHAR(20);

    SELECT role INTO v_reviewer_role
    FROM users
    WHERE user_id = p_reviewer_id AND status = 'Active';

    IF v_reviewer_role IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Reviewer does not exist';
    END IF;

    SELECT requested_role, status
    INTO   v_requested_role, v_status
    FROM   staff_registration_requests
    WHERE  request_id = p_request_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Staff request does not exist';
    END IF;

    IF v_status <> 'Pending' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Staff request is not pending';
    END IF;

    IF v_requested_role = 'Admin' AND v_reviewer_role <> 'SuperAdmin' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only SuperAdmin can reject Admin requests';
    END IF;

    IF v_requested_role = 'Staff' AND v_reviewer_role NOT IN ('Admin', 'SuperAdmin') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only Admin or SuperAdmin can reject Staff requests';
    END IF;

    UPDATE staff_registration_requests
    SET    status = 'Rejected',
           reviewed_by = p_reviewer_id,
           reviewed_at = CURRENT_TIMESTAMP,
           reject_reason = p_reject_reason
    WHERE  request_id = p_request_id;
END //

CREATE PROCEDURE get_customer_bookings (
    IN p_user_id VARCHAR(20)
)
BEGIN
    SELECT
        b.booking_id,
        b.user_id,
        b.itinerary_id,
        i.trip_type,
        i.departure_airport_code,
        i.arrival_airport_code,
        b.booking_time,
        b.status,
        bs.flight_id,
        bs.seat_number,
        sch.flight_number,
        f.flight_date,
        sch.dep_airport,
        sch.arr_airport,
        sch.dep_time,
        sch.arr_time,
        al.airline_name,
        sc.class_name,
        p.payment_id,
        p.amount,
        p.payment_method,
        p.status AS payment_status,
        t.ticket_id,
        COALESCE(r.refund_amount, 0) AS refund_amount
    FROM bookings b
    JOIN itineraries i ON b.itinerary_id = i.itinerary_id
    LEFT JOIN booking_seats bs ON b.booking_id = bs.booking_id
    LEFT JOIN flights f ON bs.flight_id = f.flight_id
    LEFT JOIN flight_schedules sch ON f.schedule_id = sch.schedule_id
    LEFT JOIN airlines al ON sch.airline_id = al.airline_id
    LEFT JOIN flight_seats fls ON bs.flight_id = fls.flight_id AND bs.seat_number = fls.seat_number
    LEFT JOIN seat_classes sc ON fls.class_id = sc.class_id
    LEFT JOIN payments p ON b.booking_id = p.booking_id
    LEFT JOIN tickets t ON b.booking_id = t.booking_id AND bs.flight_id = t.flight_id AND bs.seat_number = t.seat_number
    LEFT JOIN refunds r ON b.booking_id = r.booking_id
    WHERE b.user_id = p_user_id
    ORDER BY b.booking_time DESC, b.booking_id DESC, bs.flight_id ASC;
END //

CREATE PROCEDURE get_all_bookings_for_staff()
BEGIN
    SELECT
        b.booking_id,
        b.user_id,
        TRIM(CONCAT(
            u.first_name,
            ' ',
            IFNULL(CONCAT(u.middle_name, ' '), ''),
            u.last_name
        )) AS customer_name,
        u.email AS customer_email,
        b.itinerary_id,
        i.trip_type,
        i.departure_airport_code,
        i.arrival_airport_code,
        b.booking_time,
        b.status,
        p.payment_id,
        p.amount,
        p.payment_method,
        p.status AS payment_status,
        p.payment_time,
        COALESCE(rf.total_refund, 0) AS refund_amount,
        rf.last_refund_time,
        COALESCE(leg.leg_count, 0) AS leg_count,
        leg.flights_summary
    FROM bookings b
    JOIN users u ON b.user_id = u.user_id
    JOIN itineraries i ON b.itinerary_id = i.itinerary_id
    LEFT JOIN payments p ON b.booking_id = p.booking_id
    LEFT JOIN (
        SELECT booking_id,
               SUM(refund_amount) AS total_refund,
               MAX(refund_time) AS last_refund_time
        FROM refunds
        GROUP BY booking_id
    ) rf ON b.booking_id = rf.booking_id
    LEFT JOIN (
        SELECT bs.booking_id,
               COUNT(DISTINCT bs.flight_id) AS leg_count,
               GROUP_CONCAT(
                   DISTINCT CONCAT(sch.flight_number, ' (', DATE_FORMAT(f.flight_date, '%Y-%m-%d'), ')')
                   ORDER BY f.flight_id SEPARATOR ' · '
               ) AS flights_summary
        FROM booking_seats bs
        JOIN flights f ON bs.flight_id = f.flight_id
        JOIN flight_schedules sch ON f.schedule_id = sch.schedule_id
        GROUP BY bs.booking_id
    ) leg ON b.booking_id = leg.booking_id
    ORDER BY b.booking_time DESC, b.booking_id DESC;
END //

CREATE PROCEDURE get_booking_legs_for_staff (
    IN p_booking_id INT
)
BEGIN
    SELECT
        b.booking_id,
        b.user_id,
        TRIM(CONCAT(
            u.first_name,
            ' ',
            IFNULL(CONCAT(u.middle_name, ' '), ''),
            u.last_name
        )) AS customer_name,
        u.email AS customer_email,
        b.itinerary_id,
        i.trip_type,
        i.departure_airport_code,
        i.arrival_airport_code,
        b.booking_time,
        b.status,
        bs.flight_id,
        bs.seat_number,
        sch.flight_number,
        f.flight_date,
        sch.dep_airport,
        sch.arr_airport,
        sch.dep_time,
        sch.arr_time,
        al.airline_name,
        sc.class_name,
        p.payment_id,
        p.amount,
        p.payment_method,
        p.status AS payment_status,
        p.payment_time,
        t.ticket_id,
        t.issue_time AS ticket_issue_time,
        COALESCE(r.refund_amount, 0) AS refund_amount,
        r.refund_time
    FROM bookings b
    JOIN users u ON b.user_id = u.user_id
    JOIN itineraries i ON b.itinerary_id = i.itinerary_id
    LEFT JOIN booking_seats bs ON b.booking_id = bs.booking_id
    LEFT JOIN flights f ON bs.flight_id = f.flight_id
    LEFT JOIN flight_schedules sch ON f.schedule_id = sch.schedule_id
    LEFT JOIN airlines al ON sch.airline_id = al.airline_id
    LEFT JOIN flight_seats fls ON bs.flight_id = fls.flight_id AND bs.seat_number = fls.seat_number
    LEFT JOIN seat_classes sc ON fls.class_id = sc.class_id
    LEFT JOIN payments p ON b.booking_id = p.booking_id
    LEFT JOIN tickets t ON b.booking_id = t.booking_id AND bs.flight_id = t.flight_id AND bs.seat_number = t.seat_number
    LEFT JOIN refunds r ON b.booking_id = r.booking_id
    WHERE b.booking_id = p_booking_id
    ORDER BY bs.flight_id ASC;
END //

CREATE PROCEDURE get_booking_activity_log (
    IN p_booking_id INT
)
BEGIN
    SELECT event_type, event_time, description, detail_status
    FROM (
        SELECT
            'BOOKING_CREATED' AS event_type,
            b.booking_time AS event_time,
            CONCAT(
                'Booking #', b.booking_id,
                ' created for itinerary #', b.itinerary_id,
                ' (', i.trip_type, ': ', i.departure_airport_code, ' → ', i.arrival_airport_code, ')'
            ) AS description,
            b.status AS detail_status
        FROM bookings b
        JOIN itineraries i ON b.itinerary_id = i.itinerary_id
        WHERE b.booking_id = p_booking_id

        UNION ALL

        SELECT
            'PAYMENT',
            p.payment_time,
            CONCAT(
                'Payment #', p.payment_id,
                ' · ', p.payment_method,
                ' · $', FORMAT(p.amount, 2),
                ' · ', p.status
            ),
            p.status
        FROM payments p
        WHERE p.booking_id = p_booking_id

        UNION ALL

        SELECT
            'TICKET_ISSUED',
            t.issue_time,
            CONCAT(
                'Ticket #', t.ticket_id,
                ' · Flight ', t.flight_id,
                ' · Seat ', t.seat_number
            ),
            'ISSUED'
        FROM tickets t
        WHERE t.booking_id = p_booking_id

        UNION ALL

        SELECT
            'REFUND',
            r.refund_time,
            CONCAT(
                'Refund #', r.refund_id,
                ' · $', FORMAT(r.refund_amount, 2),
                ' · Payment #', r.payment_id
            ),
            'REFUNDED'
        FROM refunds r
        WHERE r.booking_id = p_booking_id

        UNION ALL

        SELECT
            'BOOKING_CANCELLED',
            COALESCE(rf.last_refund_time, b.booking_time),
            CONCAT('Booking #', b.booking_id, ' marked as Cancelled'),
            b.status
        FROM bookings b
        LEFT JOIN (
            SELECT booking_id, MAX(refund_time) AS last_refund_time
            FROM refunds
            WHERE booking_id = p_booking_id
            GROUP BY booking_id
        ) rf ON b.booking_id = rf.booking_id
        WHERE b.booking_id = p_booking_id
          AND b.status = 'Cancelled'
    ) events
    ORDER BY event_time ASC, event_type ASC;
END //

DELIMITER ;


-- ============================================================
-- OPERATION 6-F
-- Staff: Quarterly Revenue Statistics
-- ============================================================

DELIMITER //

CREATE PROCEDURE revenue_report_by_quarter()
BEGIN
    SELECT
        fs.airline_id,
        YEAR(f.flight_date)    AS revenue_year,
        QUARTER(f.flight_date) AS revenue_quarter,
        COUNT(DISTINCT t.ticket_id) AS tickets_sold,
        COALESCE(SUM(fls.price), 0) AS quarterly_revenue
    FROM flights f
    JOIN flight_schedules fs ON f.schedule_id = fs.schedule_id
    LEFT JOIN tickets t ON f.flight_id = t.flight_id
    LEFT JOIN bookings b ON t.booking_id = b.booking_id AND b.status = 'Active'
    LEFT JOIN payments p ON b.booking_id = p.booking_id AND p.status = 'SUCCESS'
    LEFT JOIN flight_seats fls ON t.flight_id = fls.flight_id AND t.seat_number = fls.seat_number
    WHERE b.booking_id IS NULL OR p.payment_id IS NOT NULL
    GROUP BY fs.airline_id, YEAR(f.flight_date), QUARTER(f.flight_date)
    ORDER BY revenue_year, revenue_quarter, fs.airline_id;
END //

DELIMITER ;


-- ============================================================
-- MASTER DATA CRUD (Staff)
-- ============================================================

DELIMITER //

CREATE PROCEDURE upsert_airline (
    IN p_airline_id   VARCHAR(10),
    IN p_airline_name VARCHAR(100),
    IN p_country      VARCHAR(50)
)
BEGIN
    INSERT INTO airlines (airline_id, airline_name, country)
    VALUES (p_airline_id, p_airline_name, p_country)
    ON DUPLICATE KEY UPDATE
        airline_name = VALUES(airline_name),
        country = VALUES(country);
END //

CREATE PROCEDURE delete_airline (
    IN p_airline_id VARCHAR(10)
)
BEGIN
    DELETE FROM airlines WHERE airline_id = p_airline_id;
END //

CREATE PROCEDURE upsert_airport (
    IN p_airport_code CHAR(3),
    IN p_airport_name VARCHAR(100),
    IN p_city         VARCHAR(50),
    IN p_country      VARCHAR(50)
)
BEGIN
    INSERT INTO airports (airport_code, airport_name, city, country)
    VALUES (p_airport_code, p_airport_name, p_city, p_country)
    ON DUPLICATE KEY UPDATE
        airport_name = VALUES(airport_name),
        city = VALUES(city),
        country = VALUES(country);
END //

CREATE PROCEDURE delete_airport (
    IN p_airport_code CHAR(3)
)
BEGIN
    DELETE FROM airports WHERE airport_code = p_airport_code;
END //

CREATE PROCEDURE upsert_aircraft (
    IN p_aircraft_id INT,
    IN p_airline_id  VARCHAR(10),
    IN p_model       VARCHAR(50),
    IN p_capacity    INT
)
BEGIN
    INSERT INTO aircraft (aircraft_id, airline_id, model, capacity)
    VALUES (p_aircraft_id, p_airline_id, p_model, p_capacity)
    ON DUPLICATE KEY UPDATE
        airline_id = VALUES(airline_id),
        model = VALUES(model),
        capacity = VALUES(capacity);
END //

CREATE PROCEDURE replace_aircraft_seats (
    IN p_aircraft_id INT,
    IN p_seats_json   JSON
)
BEGIN
    DECLARE v_seat_count INT DEFAULT 0;
    DECLARE v_idx INT DEFAULT 0;
    DECLARE v_path VARCHAR(32);
    DECLARE v_seat_number VARCHAR(5);
    DECLARE v_class_id INT;

    IF p_aircraft_id IS NULL OR p_aircraft_id <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid aircraft ID.';
    END IF;

    SET v_seat_count = JSON_LENGTH(p_seats_json);
    IF v_seat_count IS NULL OR v_seat_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'At least one seat is required.';
    END IF;

    DROP TEMPORARY TABLE IF EXISTS tmp_aircraft_seats;
    CREATE TEMPORARY TABLE tmp_aircraft_seats (
        seat_number VARCHAR(5) NOT NULL PRIMARY KEY,
        class_id    INT NOT NULL
    );

    WHILE v_idx < v_seat_count DO
        SET v_path = CONCAT('$[', v_idx, ']');
        SET v_seat_number = UPPER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p_seats_json, CONCAT(v_path, '.seat_number')))));
        SET v_class_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_seats_json, CONCAT(v_path, '.class_id'))) AS UNSIGNED);

        IF v_seat_number IS NULL OR v_seat_number = ''
           OR v_class_id IS NULL OR v_class_id NOT IN (1, 2, 3) THEN
            SET @aircraft_seat_err = CONCAT('Seat row ', v_idx + 1, ' is invalid.');
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = @aircraft_seat_err;
        END IF;

        INSERT INTO tmp_aircraft_seats (seat_number, class_id)
        VALUES (v_seat_number, v_class_id)
        ON DUPLICATE KEY UPDATE class_id = VALUES(class_id);

        SET v_idx = v_idx + 1;
    END WHILE;

    DELETE FROM aircraft_seats WHERE aircraft_id = p_aircraft_id;

    INSERT INTO aircraft_seats (aircraft_id, seat_number, class_id)
    SELECT p_aircraft_id, seat_number, class_id
    FROM tmp_aircraft_seats;

    UPDATE aircraft
    SET capacity = (SELECT COUNT(*) FROM tmp_aircraft_seats)
    WHERE aircraft_id = p_aircraft_id;

    DROP TEMPORARY TABLE IF EXISTS tmp_aircraft_seats;
END //

CREATE PROCEDURE upsert_aircraft_seat_template (
    IN p_template_id    INT,
    IN p_template_name  VARCHAR(100),
    IN p_model_label    VARCHAR(100),
    IN p_description    VARCHAR(255),
    IN p_seats_json     JSON
)
BEGIN
    DECLARE v_seat_count INT DEFAULT 0;
    DECLARE v_idx INT DEFAULT 0;
    DECLARE v_path VARCHAR(32);
    DECLARE v_seat_number VARCHAR(5);
    DECLARE v_class_id INT;

    IF p_template_name IS NULL OR TRIM(p_template_name) = '' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Template name is required.';
    END IF;

    SET v_seat_count = JSON_LENGTH(p_seats_json);
    IF v_seat_count IS NULL OR v_seat_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'At least one seat is required in a template.';
    END IF;

    DROP TEMPORARY TABLE IF EXISTS tmp_aircraft_seat_template_seats;
    CREATE TEMPORARY TABLE tmp_aircraft_seat_template_seats (
        seat_number VARCHAR(5) NOT NULL PRIMARY KEY,
        class_id    INT NOT NULL
    );

    WHILE v_idx < v_seat_count DO
        SET v_path = CONCAT('$[', v_idx, ']');
        SET v_seat_number = UPPER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p_seats_json, CONCAT(v_path, '.seat_number')))));
        SET v_class_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_seats_json, CONCAT(v_path, '.class_id'))) AS UNSIGNED);

        IF v_seat_number IS NULL OR v_seat_number = ''
           OR v_class_id IS NULL OR v_class_id NOT IN (1, 2, 3) THEN
            SET @template_err = CONCAT('Seat row ', v_idx + 1, ' is invalid.');
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = @template_err;
        END IF;

        INSERT INTO tmp_aircraft_seat_template_seats (seat_number, class_id)
        VALUES (v_seat_number, v_class_id)
        ON DUPLICATE KEY UPDATE class_id = VALUES(class_id);

        SET v_idx = v_idx + 1;
    END WHILE;

    SET @template_seats_json = (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('seat_number', ordered.seat_number, 'class_id', ordered.class_id))
        FROM (
            SELECT seat_number, class_id
            FROM tmp_aircraft_seat_template_seats
            ORDER BY seat_number
        ) ordered
    );

    INSERT INTO aircraft_seat_templates (
        template_id, template_name, model_label, description, seats_json
    )
    VALUES (
        p_template_id, TRIM(p_template_name), NULLIF(TRIM(p_model_label), ''), NULLIF(TRIM(p_description), ''), @template_seats_json
    )
    ON DUPLICATE KEY UPDATE
        template_name = VALUES(template_name),
        model_label = VALUES(model_label),
        description = VALUES(description),
        seats_json = @template_seats_json;

    DROP TEMPORARY TABLE IF EXISTS tmp_aircraft_seat_template_seats;
END //

CREATE PROCEDURE delete_aircraft_seat_template (
    IN p_template_id INT
)
BEGIN
    DELETE FROM aircraft_seat_templates WHERE template_id = p_template_id;
END //

CREATE PROCEDURE upsert_flight_schedule (
    IN p_schedule_id   INT,
    IN p_airline_id    VARCHAR(10),
    IN p_flight_number VARCHAR(10),
    IN p_dep_airport   CHAR(3),
    IN p_arr_airport   CHAR(3),
    IN p_dep_time      TIME,
    IN p_arr_time      TIME,
    IN p_valid_from    DATE,
    IN p_valid_to      DATE
)
BEGIN
    INSERT INTO flight_schedules (
        schedule_id, airline_id, flight_number,
        dep_airport, arr_airport, dep_time, arr_time,
        valid_from, valid_to
    )
    VALUES (
        p_schedule_id, p_airline_id, p_flight_number,
        p_dep_airport, p_arr_airport, p_dep_time, p_arr_time,
        p_valid_from, p_valid_to
    )
    ON DUPLICATE KEY UPDATE
        airline_id = VALUES(airline_id),
        flight_number = VALUES(flight_number),
        dep_airport = VALUES(dep_airport),
        arr_airport = VALUES(arr_airport),
        dep_time = VALUES(dep_time),
        arr_time = VALUES(arr_time),
        valid_from = VALUES(valid_from),
        valid_to = VALUES(valid_to);
END //

CREATE PROCEDURE upsert_connecting_route (
    IN p_itinerary_id        INT,
    IN p_departure_airport   CHAR(3),
    IN p_arrival_airport     CHAR(3),
    IN p_valid_from          DATE,
    IN p_valid_to            DATE,
    IN p_legs_json           JSON,
    IN p_operating_days_json JSON
)
BEGIN
    DECLARE v_leg_count INT DEFAULT 0;
    DECLARE v_idx INT DEFAULT 0;
    DECLARE v_path VARCHAR(32);
    DECLARE v_schedule_id INT;
    DECLARE v_airline_id VARCHAR(10);
    DECLARE v_flight_number VARCHAR(10);
    DECLARE v_dep_airport CHAR(3);
    DECLARE v_arr_airport CHAR(3);
    DECLARE v_dep_time TIME;
    DECLARE v_arr_time TIME;
    DECLARE v_prev_arr_airport CHAR(3) DEFAULT NULL;
    DECLARE v_prev_arr_time TIME DEFAULT NULL;
    DECLARE v_first_dep_airport CHAR(3);
    DECLARE v_last_arr_airport CHAR(3);
    DECLARE v_day_count INT DEFAULT 0;
    DECLARE v_day_idx INT DEFAULT 0;
    DECLARE v_day VARCHAR(3);
    DECLARE v_distinct_schedules INT DEFAULT 0;
    DECLARE v_total_legs INT DEFAULT 0;
    DECLARE v_operating_days_json JSON;

    IF p_departure_airport = p_arrival_airport THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Departure and arrival airports must be different.';
    END IF;

    SET v_leg_count = JSON_LENGTH(p_legs_json);
    IF v_leg_count IS NULL OR v_leg_count < 2 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Connecting routes require at least 2 legs.';
    END IF;

    DROP TEMPORARY TABLE IF EXISTS tmp_connecting_route_legs;
    CREATE TEMPORARY TABLE tmp_connecting_route_legs (
        leg_index     INT NOT NULL PRIMARY KEY,
        schedule_id   INT NOT NULL,
        airline_id    VARCHAR(10) NOT NULL,
        flight_number VARCHAR(10) NOT NULL,
        dep_airport   CHAR(3) NOT NULL,
        arr_airport   CHAR(3) NOT NULL,
        dep_time      TIME NOT NULL,
        arr_time      TIME NOT NULL
    );

    WHILE v_idx < v_leg_count DO
        SET v_path = CONCAT('$[', v_idx, ']');
        SET v_schedule_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_legs_json, CONCAT(v_path, '.schedule_id'))) AS UNSIGNED);
        SET v_airline_id = JSON_UNQUOTE(JSON_EXTRACT(p_legs_json, CONCAT(v_path, '.airline_id')));
        SET v_flight_number = TRIM(JSON_UNQUOTE(JSON_EXTRACT(p_legs_json, CONCAT(v_path, '.flight_number'))));
        SET v_dep_airport = JSON_UNQUOTE(JSON_EXTRACT(p_legs_json, CONCAT(v_path, '.dep_airport')));
        SET v_arr_airport = JSON_UNQUOTE(JSON_EXTRACT(p_legs_json, CONCAT(v_path, '.arr_airport')));
        SET v_dep_time = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_legs_json, CONCAT(v_path, '.dep_time'))) AS TIME);
        SET v_arr_time = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_legs_json, CONCAT(v_path, '.arr_time'))) AS TIME);

        IF v_schedule_id IS NULL OR v_schedule_id = 0
           OR v_airline_id IS NULL OR v_airline_id = ''
           OR v_flight_number IS NULL OR v_flight_number = ''
           OR v_dep_airport IS NULL OR v_dep_airport = ''
           OR v_arr_airport IS NULL OR v_arr_airport = ''
           OR v_dep_time IS NULL OR v_arr_time IS NULL THEN
            SET @connecting_err = CONCAT('Leg ', v_idx + 1, ' is missing required schedule fields.');
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = @connecting_err;
        END IF;

        INSERT INTO tmp_connecting_route_legs (
            leg_index, schedule_id, airline_id, flight_number,
            dep_airport, arr_airport, dep_time, arr_time
        ) VALUES (
            v_idx + 1, v_schedule_id, v_airline_id, v_flight_number,
            v_dep_airport, v_arr_airport, v_dep_time, v_arr_time
        );

        SET v_idx = v_idx + 1;
    END WHILE;

    SELECT COUNT(DISTINCT schedule_id), COUNT(*)
    INTO v_distinct_schedules, v_total_legs
    FROM tmp_connecting_route_legs;

    IF v_distinct_schedules <> v_total_legs THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Each leg needs a unique schedule ID.';
    END IF;

    SELECT dep_airport INTO v_first_dep_airport
    FROM tmp_connecting_route_legs
    WHERE leg_index = 1;

    IF v_first_dep_airport <> p_departure_airport THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Leg 1 must depart from the route origin airport.';
    END IF;

    -- MySQL cannot reference the same TEMPORARY TABLE twice in one query (ER 1137).
    SELECT arr_airport INTO v_last_arr_airport
    FROM tmp_connecting_route_legs
    WHERE leg_index = v_total_legs;

    IF v_last_arr_airport <> p_arrival_airport THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'The final leg must arrive at the route destination airport.';
    END IF;

    SET v_idx = 1;
    WHILE v_idx < (SELECT MAX(leg_index) FROM tmp_connecting_route_legs) DO
        SELECT arr_airport, arr_time
        INTO v_prev_arr_airport, v_prev_arr_time
        FROM tmp_connecting_route_legs
        WHERE leg_index = v_idx;

        SELECT dep_airport, dep_time
        INTO v_dep_airport, v_dep_time
        FROM tmp_connecting_route_legs
        WHERE leg_index = v_idx + 1;

        IF v_prev_arr_airport <> v_dep_airport THEN
            SET @connecting_err = CONCAT('Leg ', v_idx, ' must arrive where leg ', v_idx + 1, ' departs.');
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = @connecting_err;
        END IF;

        IF v_dep_time < ADDTIME(v_prev_arr_time, '01:00:00') THEN
            SET @connecting_err = CONCAT(
                'Layover between leg ', v_idx, ' and leg ', v_idx + 1, ' must be at least 1 hour.'
            );
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = @connecting_err;
        END IF;

        SET v_idx = v_idx + 1;
    END WHILE;

    SET v_idx = 1;
    WHILE v_idx <= (SELECT MAX(leg_index) FROM tmp_connecting_route_legs) DO
        SELECT schedule_id, airline_id, flight_number, dep_airport, arr_airport, dep_time, arr_time
        INTO v_schedule_id, v_airline_id, v_flight_number, v_dep_airport, v_arr_airport, v_dep_time, v_arr_time
        FROM tmp_connecting_route_legs
        WHERE leg_index = v_idx;

        CALL upsert_flight_schedule(
            v_schedule_id, v_airline_id, v_flight_number,
            v_dep_airport, v_arr_airport, v_dep_time, v_arr_time,
            p_valid_from, p_valid_to
        );

        SET v_idx = v_idx + 1;
    END WHILE;

    SET @leg_schedule_ids = (
        SELECT JSON_ARRAYAGG(ordered.schedule_id)
        FROM (
            SELECT schedule_id
            FROM tmp_connecting_route_legs
            ORDER BY leg_index
        ) ordered
    );

    INSERT INTO itineraries (
        itinerary_id, trip_type, departure_airport_code, arrival_airport_code, leg_schedule_ids
    )
    VALUES (p_itinerary_id, 'Connecting', p_departure_airport, p_arrival_airport, @leg_schedule_ids)
    ON DUPLICATE KEY UPDATE
        trip_type = VALUES(trip_type),
        departure_airport_code = VALUES(departure_airport_code),
        arrival_airport_code = VALUES(arrival_airport_code),
        leg_schedule_ids = @leg_schedule_ids;

    SET v_operating_days_json = p_operating_days_json;
    SET v_day_count = JSON_LENGTH(v_operating_days_json);
    IF v_day_count IS NULL OR v_day_count = 0 THEN
        SET v_operating_days_json = JSON_ARRAY('MON', 'WED', 'FRI');
        SET v_day_count = 3;
    END IF;

    SET v_idx = 1;
    WHILE v_idx <= (SELECT MAX(leg_index) FROM tmp_connecting_route_legs) DO
        SELECT schedule_id INTO v_schedule_id
        FROM tmp_connecting_route_legs
        WHERE leg_index = v_idx;

        DELETE FROM schedule_days WHERE schedule_id = v_schedule_id;

        SET v_day_idx = 0;
        WHILE v_day_idx < v_day_count DO
            SET v_day = JSON_UNQUOTE(JSON_EXTRACT(v_operating_days_json, CONCAT('$[', v_day_idx, ']')));
            INSERT INTO schedule_days (schedule_id, day_of_week)
            VALUES (v_schedule_id, v_day);
            SET v_day_idx = v_day_idx + 1;
        END WHILE;

        SET v_idx = v_idx + 1;
    END WHILE;

    DROP TEMPORARY TABLE IF EXISTS tmp_connecting_route_legs;
END //

CREATE PROCEDURE upsert_promotion (
    IN p_promo_id         INT,
    IN p_promo_code       VARCHAR(30),
    IN p_description      VARCHAR(255),
    IN p_schedule_id      INT,
    IN p_dep_airport      CHAR(3),
    IN p_arr_airport      CHAR(3),
    IN p_class_id         INT,
    IN p_discount_percent DECIMAL(5,2),
    IN p_valid_from       DATE,
    IN p_valid_to         DATE,
    IN p_is_active        BOOLEAN
)
BEGIN
    INSERT INTO promotions (
        promo_id, promo_code, description,
        schedule_id, dep_airport, arr_airport, class_id,
        discount_percent, valid_from, valid_to, is_active
    )
    VALUES (
        p_promo_id, p_promo_code, p_description,
        p_schedule_id, p_dep_airport, p_arr_airport, p_class_id,
        p_discount_percent, p_valid_from, p_valid_to, p_is_active
    )
    ON DUPLICATE KEY UPDATE
        promo_code = VALUES(promo_code),
        description = VALUES(description),
        schedule_id = VALUES(schedule_id),
        dep_airport = VALUES(dep_airport),
        arr_airport = VALUES(arr_airport),
        class_id = VALUES(class_id),
        discount_percent = VALUES(discount_percent),
        valid_from = VALUES(valid_from),
        valid_to = VALUES(valid_to),
        is_active = VALUES(is_active);
END //

CREATE PROCEDURE deactivate_promotion (
    IN p_promo_id INT
)
BEGIN
    UPDATE promotions SET is_active = FALSE WHERE promo_id = p_promo_id;
END //

DELIMITER ;


-- ============================================================
-- DEMO VALIDATION QUERIES
-- ============================================================

-- Demo 1. Generate flights from schedule
-- CALL generate_flights_from_schedule(1, 101, '2026-06-01', '2026-06-30');
-- SELECT * FROM flights WHERE schedule_id = 1 ORDER BY flight_date;

-- Demo 2. Generate flight seats
-- CALL generate_flight_seats(1001, 300.00, 800.00, 1500.00);
-- SELECT * FROM flight_seats WHERE flight_id = 1001 ORDER BY seat_number;

-- Demo 3. Flight search (all variants)
-- CALL search_flights('ICN', 'JFK', '2026-06-01', NULL, NULL);
-- CALL advanced_search_flights('ICN', 'JFK', '2026-06-01', 1, 500.00);
-- CALL search_flights_with_promotions('ICN', 'JFK', '2026-06-01', 1, 500.00);
-- CALL search_direct_and_connecting_flights('ICN', 'JFK', '2026-06-01', 1);
-- CALL recommend_routes('ICN', 'JFK', '2026-06-01', 1);

-- Demo 4. Real-time seat selection
-- CALL view_available_seats(1001);
-- CALL hold_seat(1, 'cust01', 1001, '12A');
-- CALL view_available_seats(1001);
-- SELECT * FROM seat_holds;

-- Demo 5. Name splitting
-- CALL split_name_last_first();

-- Demo 6. Atomic booking
-- CALL make_reservation(5001, 7001, 9001, 'cust01', 1001, '12A', 'CARD');
-- SELECT * FROM bookings      WHERE booking_id = 5001;
-- SELECT * FROM booking_seats WHERE booking_id = 5001;
-- SELECT * FROM payments      WHERE booking_id = 5001;
-- SELECT * FROM tickets       WHERE booking_id = 5001;
-- SELECT * FROM flight_seats  WHERE flight_id = 1001 AND seat_number = '12A';

-- Demo 7. Double-booking prevention (should fail)
-- CALL make_reservation(5002, 7002, 9002, 'cust02', 1001, '12A', 'CARD');

-- Demo 8. Cancel booking and refund
-- CALL cancel_reservation(3001, 5001);
-- SELECT * FROM bookings     WHERE booking_id = 5001;
-- SELECT * FROM refunds      WHERE booking_id = 5001;
-- SELECT * FROM flight_seats WHERE flight_id = 1001 AND seat_number = '12A';

-- Demo 9. Revenue and load factor
-- CALL revenue_report_by_flight();
-- CALL revenue_report_by_month();
-- CALL revenue_and_load_factor_report();
