-- Run this once as a MariaDB administrator if your root account uses
-- Windows/GSSAPI authentication. The Next.js mysql2 driver needs a
-- normal password-based application user.

CREATE DATABASE IF NOT EXISTS airline_reservation
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'ars_app'@'localhost'
  IDENTIFIED BY 'ars_app_password_change_me';

CREATE USER IF NOT EXISTS 'ars_app'@'127.0.0.1'
  IDENTIFIED BY 'ars_app_password_change_me';

GRANT ALL PRIVILEGES ON airline_reservation.* TO 'ars_app'@'localhost';
GRANT ALL PRIVILEGES ON airline_reservation.* TO 'ars_app'@'127.0.0.1';

FLUSH PRIVILEGES;
