-- ============================================================
-- DEMO BOOKINGS / PAYMENTS / TICKETS
-- Loaded by npm run db:setup AFTER flight_seats are regenerated.
-- Powers revenue reports, load factor, My Bookings, and refunds demo.
-- ============================================================

-- ----------------------------------------------------------
-- Active one-way bookings (June 2026)
-- ----------------------------------------------------------

INSERT INTO bookings (booking_id, user_id, itinerary_id, booking_time, status)
VALUES
(5001, 'cust01', 6001, '2026-05-28 09:15:00', 'Active'),
(5002, 'cust02', 7001, '2026-05-28 11:40:00', 'Active'),
(5003, 'cust03', 6004, '2026-05-29 08:05:00', 'Active'),
(5004, 'cust04', 6005, '2026-05-29 14:22:00', 'Active'),
(5005, 'cust01', 6006, '2026-05-30 10:00:00', 'Active'),
(5006, 'cust02', 6007, '2026-05-30 16:45:00', 'Active'),
(5007, 'cust03', 6008, '2026-05-31 07:30:00', 'Active'),
(5008, 'cust04', 6009, '2026-05-31 19:10:00', 'Active'),
(5010, 'cust01', 6013, '2026-06-02 12:00:00', 'Active'),
(5011, 'cust02', 6011, '2026-06-02 15:30:00', 'Active'),
(5012, 'cust03', 6001, '2026-05-29 18:00:00', 'Active'),
(5013, 'cust04', 6001, '2026-05-30 09:45:00', 'Active'),
(5014, 'cust02', 6001, '2026-05-31 20:00:00', 'Active'),
(5031, 'cust01', 6013, '2026-06-05 09:30:00', 'Active'),
(5032, 'cust01', 6027, '2026-06-06 14:00:00', 'Active');

-- Cancelled booking (refunded — no tickets, seat released)
INSERT INTO bookings (booking_id, user_id, itinerary_id, booking_time, status)
VALUES
(5009, 'cust03', 6010, '2026-05-27 13:20:00', 'Cancelled');

INSERT INTO booking_seats (booking_id, flight_id, seat_number)
VALUES
(5001, 1001, '28A'),
(5002, 1002, '28B'),
(5002, 1003, '28A'),
(5003, 1004, '7A'),
(5004, 1005, '28C'),
(5005, 1006, '1A'),
(5006, 1007, '8D'),
(5007, 1008, '28D'),
(5008, 1009, '7D'),
(5009, 1010, '28F'),
(5010, 1013, '29A'),
(5011, 1011, '28E'),
(5012, 1001, '28B'),
(5013, 1001, '29C'),
(5014, 1001, '1K'),
(5031, 1013, '28C'),
(5032, 1027, '28D');

INSERT INTO tickets (ticket_id, booking_id, flight_id, seat_number, issue_time)
VALUES
(7001, 5001, 1001, '28A', '2026-05-28 09:16:00'),
(7002, 5002, 1002, '28B', '2026-05-28 11:41:00'),
(7003, 5002, 1003, '28A', '2026-05-28 11:41:00'),
(7004, 5003, 1004, '7A',  '2026-05-29 08:06:00'),
(7005, 5004, 1005, '28C', '2026-05-29 14:23:00'),
(7006, 5005, 1006, '1A',  '2026-05-30 10:01:00'),
(7007, 5006, 1007, '8D',  '2026-05-30 16:46:00'),
(7008, 5007, 1008, '28D', '2026-05-31 07:31:00'),
(7009, 5008, 1009, '7D',  '2026-05-31 19:11:00'),
(7010, 5010, 1013, '29A', '2026-06-02 12:01:00'),
(7011, 5011, 1011, '28E', '2026-06-02 15:31:00'),
(7012, 5012, 1001, '28B', '2026-05-29 18:01:00'),
(7013, 5013, 1001, '29C', '2026-05-30 09:46:00'),
(7014, 5014, 1001, '1K',  '2026-05-31 20:01:00'),
(7031, 5031, 1013, '28C', '2026-06-05 09:31:00'),
(7032, 5032, 1027, '28D', '2026-06-06 14:01:00');

INSERT INTO payments (payment_id, booking_id, amount, payment_method, status, payment_time)
VALUES
(9001, 5001,  780.00,  'CARD',     'SUCCESS',  '2026-05-28 09:16:00'),
(9002, 5002, 1560.00,  'CARD',     'SUCCESS',  '2026-05-28 11:41:00'),
(9003, 5003,  620.00,  'TRANSFER', 'SUCCESS',  '2026-05-29 08:06:00'),
(9004, 5004,  780.00,  'CARD',     'SUCCESS',  '2026-05-29 14:23:00'),
(9005, 5005, 5200.00,  'CARD',     'SUCCESS',  '2026-05-30 10:01:00'),
(9006, 5006, 2400.00,  'CARD',     'SUCCESS',  '2026-05-30 16:46:00'),
(9007, 5007,  360.00,  'CASH',     'SUCCESS',  '2026-05-31 07:31:00'),
(9008, 5008, 2400.00,  'TRANSFER', 'SUCCESS',  '2026-05-31 19:11:00'),
(9009, 5009,  210.00,  'CARD',     'REFUNDED', '2026-05-27 13:21:00'),
(9010, 5010,  780.00,  'CARD',     'SUCCESS',  '2026-06-02 12:01:00'),
(9011, 5011,  360.00,  'CARD',     'SUCCESS',  '2026-06-02 15:31:00'),
(9012, 5012,  780.00,  'TRANSFER', 'SUCCESS',  '2026-05-29 18:01:00'),
(9013, 5013,  780.00,  'CARD',     'SUCCESS',  '2026-05-30 09:46:00'),
(9014, 5014, 5200.00,  'CARD',     'SUCCESS',  '2026-05-31 20:01:00'),
(9031, 5031,  780.00,  'CARD',     'SUCCESS',  '2026-06-05 09:31:00'),
(9032, 5032,  780.00,  'TRANSFER', 'SUCCESS',  '2026-06-06 14:01:00');

INSERT INTO refunds (refund_id, booking_id, payment_id, refund_amount, refund_time)
VALUES
(3001, 5009, 9009, 210.00, '2026-05-28 08:00:00');

-- ----------------------------------------------------------
-- 12-month revenue history (Jul 2025 – May 2026)
-- One anchor booking per monthly flight; db-setup spreads additional sales for chart variety.
-- June 2026 revenue comes from the active June bookings above plus db-setup distribution.
-- ----------------------------------------------------------

INSERT INTO bookings (booking_id, user_id, itinerary_id, booking_time, status)
VALUES
(5020, 'cust01', 8001, '2025-07-05 10:00:00', 'Active'),
(5021, 'cust02', 8002, '2025-08-02 11:00:00', 'Active'),
(5022, 'cust03', 8003, '2025-08-30 09:30:00', 'Active'),
(5023, 'cust04', 8004, '2025-10-04 14:00:00', 'Active'),
(5024, 'cust01', 8005, '2025-11-01 16:20:00', 'Active'),
(5025, 'cust02', 8006, '2025-11-28 08:45:00', 'Active'),
(5026, 'cust03', 8007, '2026-01-03 12:10:00', 'Active'),
(5027, 'cust04', 8008, '2026-01-31 17:00:00', 'Active'),
(5028, 'cust01', 8009, '2026-02-28 10:30:00', 'Active'),
(5029, 'cust02', 8010, '2026-04-04 13:15:00', 'Active'),
(5030, 'cust03', 8011, '2026-05-02 09:00:00', 'Active');

INSERT INTO booking_seats (booking_id, flight_id, seat_number)
VALUES
(5020, 2001, '28A'),
(5021, 2002, '7A'),
(5022, 2003, '28B'),
(5023, 2004, '1K'),
(5024, 2005, '28C'),
(5025, 2006, '8D'),
(5026, 2007, '28D'),
(5027, 2008, '7D'),
(5028, 2009, '29A'),
(5029, 2010, '28E'),
(5030, 2011, '29B');

INSERT INTO tickets (ticket_id, booking_id, flight_id, seat_number, issue_time)
VALUES
(7020, 5020, 2001, '28A', '2025-07-05 10:01:00'),
(7021, 5021, 2002, '7A',  '2025-08-02 11:01:00'),
(7022, 5022, 2003, '28B', '2025-08-30 09:31:00'),
(7023, 5023, 2004, '1K',  '2025-10-04 14:01:00'),
(7024, 5024, 2005, '28C', '2025-11-01 16:21:00'),
(7025, 5025, 2006, '8D',  '2025-11-28 08:46:00'),
(7026, 5026, 2007, '28D', '2026-01-03 12:11:00'),
(7027, 5027, 2008, '7D',  '2026-01-31 17:01:00'),
(7028, 5028, 2009, '29A', '2026-02-28 10:31:00'),
(7029, 5029, 2010, '28E', '2026-04-04 13:16:00'),
(7030, 5030, 2011, '29B', '2026-05-02 09:01:00');

INSERT INTO payments (payment_id, booking_id, amount, payment_method, status, payment_time)
VALUES
(9020, 5020,  780.00, 'CARD',     'SUCCESS', '2025-07-05 10:01:00'),
(9021, 5021, 2400.00, 'CARD',     'SUCCESS', '2025-08-02 11:01:00'),
(9022, 5022,  780.00, 'TRANSFER', 'SUCCESS', '2025-08-30 09:31:00'),
(9023, 5023, 5200.00, 'CARD',     'SUCCESS', '2025-10-04 14:01:00'),
(9024, 5024,  780.00, 'CARD',     'SUCCESS', '2025-11-01 16:21:00'),
(9025, 5025, 2400.00, 'CARD',     'SUCCESS', '2025-11-28 08:46:00'),
(9026, 5026,  780.00, 'CASH',     'SUCCESS', '2026-01-03 12:11:00'),
(9027, 5027, 2400.00, 'TRANSFER', 'SUCCESS', '2026-01-31 17:01:00'),
(9028, 5028,  780.00, 'CARD',     'SUCCESS', '2026-02-28 10:31:00'),
(9029, 5029,  780.00, 'CARD',     'SUCCESS', '2026-04-04 13:16:00'),
(9030, 5030,  780.00, 'TRANSFER', 'SUCCESS', '2026-05-02 09:01:00');

-- Mark sold seats unavailable (cancelled 1010/28F stays available)
UPDATE flight_seats fs
JOIN (
    SELECT 1001 AS flight_id, '28A' AS seat_number UNION ALL
    SELECT 1001, '28B' UNION ALL SELECT 1001, '29C' UNION ALL SELECT 1001, '1K' UNION ALL
    SELECT 1002, '28B' UNION ALL SELECT 1003, '28A' UNION ALL
    SELECT 1004, '7A'  UNION ALL SELECT 1005, '28C' UNION ALL
    SELECT 1006, '1A'  UNION ALL SELECT 1007, '8D'  UNION ALL
    SELECT 1008, '28D' UNION ALL SELECT 1009, '7D'  UNION ALL
    SELECT 1011, '28E' UNION ALL SELECT 1013, '29A' UNION ALL SELECT 1013, '28C' UNION ALL
    SELECT 1027, '28D' UNION ALL
    SELECT 2001, '28A' UNION ALL SELECT 2002, '7A'  UNION ALL SELECT 2003, '28B' UNION ALL
    SELECT 2004, '1K'  UNION ALL SELECT 2005, '28C' UNION ALL SELECT 2006, '8D'  UNION ALL
    SELECT 2007, '28D' UNION ALL SELECT 2008, '7D'  UNION ALL SELECT 2009, '29A' UNION ALL
    SELECT 2010, '28E' UNION ALL SELECT 2011, '29B'
) sold ON fs.flight_id = sold.flight_id AND fs.seat_number = sold.seat_number
SET fs.is_available = 0;
