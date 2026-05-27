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
-- 0. CLEANUP FOR RE-RUNNING THIS SCRIPT
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
    IN p_schedule_id INT,
    IN p_aircraft_id INT,
    IN p_start_date  DATE,
    IN p_end_date    DATE
)
BEGIN
    DECLARE v_current_date    DATE;
    DECLARE v_day_name        VARCHAR(3);
    DECLARE v_next_flight_id  INT;
    DECLARE v_valid_from      DATE;
    DECLARE v_valid_to        DATE;
    DECLARE v_aircraft_exists INT;

    IF p_start_date > p_end_date THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Start date cannot be after end date';
    END IF;

    SELECT valid_from, valid_to
    INTO   v_valid_from, v_valid_to
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

    SET v_current_date = p_start_date;

    SELECT COALESCE(MAX(flight_id), 0) + 1
    INTO   v_next_flight_id
    FROM   flights;

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

            INSERT IGNORE INTO flights (
                flight_id, schedule_id, flight_date, aircraft_id, status
            )
            VALUES (
                v_next_flight_id, p_schedule_id,
                v_current_date, p_aircraft_id, 'Scheduled'
            );

            SET v_next_flight_id = v_next_flight_id + 1;

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
    IN p_flight_date DATE
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
        f.status,
        COUNT(CASE WHEN fls.is_available = 1 THEN 1 END)     AS available_seats,
        MIN(CASE WHEN fls.is_available = 1 THEN fls.price END) AS lowest_available_price
    FROM   flights f
    JOIN   flight_schedules fs ON f.schedule_id = fs.schedule_id
    LEFT JOIN flight_seats fls ON f.flight_id   = fls.flight_id
    WHERE  fs.dep_airport = p_dep_airport
      AND  fs.arr_airport = p_arr_airport
      AND  f.flight_date  = p_flight_date
      AND  f.status       = 'Scheduled'
    GROUP BY
        f.flight_id, fs.airline_id, fs.flight_number,
        fs.dep_airport, fs.arr_airport,
        f.flight_date, fs.dep_time, fs.arr_time, f.status
    ORDER BY fs.dep_time;
END //

DELIMITER ;

-- Example:
-- CALL search_flights('ICN', 'JFK', '2026-06-01');


-- ============================================================
-- OPERATION 2-B
-- Customer: Advanced Flight Search
--
-- Adds seat class filter and maximum price filter
-- on top of basic search.
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
        COUNT(fls.seat_number) AS available_seats,
        MIN(fls.price)         AS lowest_price
    FROM   flights f
    JOIN   flight_schedules fs ON f.schedule_id = fs.schedule_id
    JOIN   flight_seats fls    ON f.flight_id   = fls.flight_id
    JOIN   seat_classes sc     ON fls.class_id  = sc.class_id
    WHERE  fs.dep_airport  = p_dep_airport
      AND  fs.arr_airport  = p_arr_airport
      AND  f.flight_date   = p_flight_date
      AND  f.status        = 'Scheduled'
      AND  fls.is_available = 1
      AND  (p_class_id  IS NULL OR fls.class_id = p_class_id)
      AND  (p_max_price IS NULL OR fls.price   <= p_max_price)
    GROUP BY
        f.flight_id, fs.airline_id, fs.flight_number,
        fs.dep_airport, fs.arr_airport,
        f.flight_date, fs.dep_time, fs.arr_time, sc.class_name
    ORDER BY lowest_price ASC, fs.dep_time ASC;
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

    -- One-stop connecting flights
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
        -- Approximation: cross-join inflates counts; LEAST is a conservative estimate.
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
        name AS full_name,

        CASE
            WHEN name LIKE '% %'
            THEN SUBSTRING_INDEX(name, ' ', -1)
            ELSE name
        END AS last_name,

        CASE
            WHEN name LIKE '% %'
            THEN TRIM(
                SUBSTRING(
                    name,
                    1,
                    LENGTH(name) - LENGTH(SUBSTRING_INDEX(name, ' ', -1))
                )
            )
            ELSE ''
        END AS first_name,

        email

    FROM  users
    WHERE role = 'Customer';
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
        name AS full_name,
        email
    FROM users
    WHERE role = 'Customer'
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
    SELECT status
    INTO   v_flight_status
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

    -- Create booking
    INSERT INTO bookings (booking_id, user_id, flight_id, status)
    VALUES (p_booking_id, p_user_id, p_flight_id, 'Active');

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
    IN p_booking_id INT
)
BEGIN
    DECLARE v_flight_id   INT;
    DECLARE v_seat_number VARCHAR(5);
    DECLARE v_payment_id  INT;
    DECLARE v_amount      DECIMAL(10,2);
    DECLARE v_status      VARCHAR(10);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Lock booking row
    SELECT status, flight_id
    INTO   v_status, v_flight_id
    FROM   bookings
    WHERE  booking_id = p_booking_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Booking does not exist';
    END IF;

    IF v_status <> 'Active' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Booking is not active';
    END IF;

    -- Find the assigned seat
    SELECT seat_number
    INTO   v_seat_number
    FROM   booking_seats
    WHERE  booking_id = p_booking_id
    LIMIT 1;

    IF v_seat_number IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No seat assigned to this booking';
    END IF;

    -- Find the successful payment
    SELECT payment_id, amount
    INTO   v_payment_id, v_amount
    FROM   payments
    WHERE  booking_id = p_booking_id
      AND  status     = 'SUCCESS'
    LIMIT 1;

    IF v_payment_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No successful payment found';
    END IF;

    -- Cancel booking
    UPDATE bookings
    SET    status = 'Cancelled'
    WHERE  booking_id = p_booking_id;

    -- Release seat
    UPDATE flight_seats
    SET    is_available = 1
    WHERE  flight_id   = v_flight_id
      AND  seat_number = v_seat_number;

    -- Create full refund record
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
        f.flight_date,
        fs.dep_airport,
        fs.arr_airport,
        COUNT(DISTINCT t.ticket_id) AS tickets_sold,
        COALESCE(SUM(p.amount), 0)  AS total_revenue
    FROM   flights f
    JOIN   flight_schedules fs ON f.schedule_id = fs.schedule_id
    LEFT JOIN bookings b
           ON f.flight_id  = b.flight_id
          AND b.status     = 'Active'
    LEFT JOIN tickets t    ON b.booking_id = t.booking_id
    LEFT JOIN payments p
           ON b.booking_id = p.booking_id
          AND p.status     = 'SUCCESS'
    GROUP BY
        fs.airline_id, fs.flight_number, f.flight_id,
        f.flight_date, fs.dep_airport, fs.arr_airport
    ORDER BY total_revenue DESC, f.flight_date ASC;
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
        COUNT(DISTINCT t.ticket_id)          AS tickets_sold,
        COALESCE(SUM(p.amount), 0)           AS monthly_revenue
    FROM   flights f
    JOIN   flight_schedules fs ON f.schedule_id = fs.schedule_id
    LEFT JOIN bookings b
           ON f.flight_id  = b.flight_id
          AND b.status     = 'Active'
    LEFT JOIN tickets t    ON b.booking_id = t.booking_id
    LEFT JOIN payments p
           ON b.booking_id = p.booking_id
          AND p.status     = 'SUCCESS'
    GROUP BY
        fs.airline_id,
        DATE_FORMAT(f.flight_date, '%Y-%m')
    ORDER BY revenue_month, fs.airline_id;
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
        f.flight_date,
        fs.dep_airport,
        fs.arr_airport,
        COUNT(DISTINCT t.ticket_id)     AS sold_seats,
        COUNT(DISTINCT fls.seat_number) AS total_seats,
        ROUND(
            CASE
                WHEN COUNT(DISTINCT fls.seat_number) = 0 THEN 0
                ELSE COUNT(DISTINCT t.ticket_id)
                     / COUNT(DISTINCT fls.seat_number) * 100
            END, 2
        )                               AS load_factor_percent,
        COALESCE(SUM(p.amount), 0)      AS total_revenue
    FROM   flights f
    JOIN   flight_schedules fs ON f.schedule_id = fs.schedule_id
    LEFT JOIN flight_seats fls  ON f.flight_id   = fls.flight_id
    LEFT JOIN bookings b
           ON f.flight_id  = b.flight_id
          AND b.status     = 'Active'
    LEFT JOIN tickets t    ON b.booking_id = t.booking_id
    LEFT JOIN payments p
           ON b.booking_id = p.booking_id
          AND p.status     = 'SUCCESS'
    GROUP BY
        fs.airline_id, fs.flight_number, f.flight_id,
        f.flight_date, fs.dep_airport, fs.arr_airport
    ORDER BY f.flight_date, fs.flight_number;
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
        COUNT(DISTINCT f.flight_id) AS operated_flights,
        COUNT(DISTINCT t.ticket_id) AS tickets_sold,
        COALESCE(SUM(p.amount), 0)  AS total_revenue
    FROM   flights f
    JOIN   flight_schedules fs ON f.schedule_id = fs.schedule_id
    LEFT JOIN bookings b
           ON f.flight_id  = b.flight_id
          AND b.status     = 'Active'
    LEFT JOIN tickets t    ON b.booking_id = t.booking_id
    LEFT JOIN payments p
           ON b.booking_id = p.booking_id
          AND p.status     = 'SUCCESS'
    GROUP BY fs.dep_airport, fs.arr_airport
    ORDER BY total_revenue DESC, tickets_sold DESC;
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
        COALESCE(SUM(p.amount), 0)  AS total_revenue,
        ROUND(
            CASE
                WHEN (
                    SELECT COALESCE(SUM(p2.amount), 0)
                    FROM payments p2
                    JOIN bookings b2 ON p2.booking_id = b2.booking_id
                    WHERE p2.status = 'SUCCESS'
                      AND b2.status = 'Active'
                ) = 0 THEN 0
                ELSE COALESCE(SUM(p.amount), 0) / (
                    SELECT COALESCE(SUM(p2.amount), 0)
                    FROM payments p2
                    JOIN bookings b2 ON p2.booking_id = b2.booking_id
                    WHERE p2.status = 'SUCCESS'
                      AND b2.status = 'Active'
                ) * 100
            END,
            2
        ) AS revenue_percent
    FROM   seat_classes sc
    LEFT JOIN flight_seats fls ON sc.class_id = fls.class_id
    LEFT JOIN tickets t
           ON fls.flight_id    = t.flight_id
          AND fls.seat_number  = t.seat_number
    LEFT JOIN bookings b
           ON t.booking_id = b.booking_id
          AND b.status     = 'Active'
    LEFT JOIN payments p
           ON b.booking_id = p.booking_id
          AND p.status     = 'SUCCESS'
    GROUP BY sc.class_name
    ORDER BY total_revenue DESC, sc.class_name;
END //

DELIMITER ;

-- Example:
-- CALL revenue_breakdown_by_seat_class();


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
-- CALL search_flights('ICN', 'JFK', '2026-06-01');
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
