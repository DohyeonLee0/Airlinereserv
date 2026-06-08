import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import mysql from "mysql2/promise";
import { loadLocalEnv } from "./env.mjs";

loadLocalEnv();
const root = process.cwd();
const dbName = process.env.DB_NAME ?? "airline_reservation";
const mysqlExeCandidates = [
  process.env.MYSQL_CLI,
  "mysql",
  "mariadb",
  "C:\\Program Files\\MariaDB 12.2\\bin\\mysql.exe",
  "C:\\Program Files\\MariaDB 12.2\\bin\\mariadb.exe"
].filter(Boolean);

const connectionConfig = {
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: dbName,
  multipleStatements: true
};

function mysqlPathForSource(fileName) {
  return path.join(root, fileName).replaceAll("\\", "/");
}

function findMysqlCli() {
  for (const candidate of mysqlExeCandidates) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8", shell: false });
    if (result.status === 0) return candidate;
  }
  return null;
}

function formatSqlTimestamp(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 19).replace("T", " ");
  }
  return String(value).slice(0, 19).replace("T", " ");
}

/** Spread seat sales across monthly flights for balanced revenue + load-factor demos. */
async function seedDemoDistribution(connection) {
  const flightTargets = [
    { flightId: 2001, targetSold: 168 },
    { flightId: 2002, targetSold: 198 },
    { flightId: 2003, targetSold: 118 },
    { flightId: 2004, targetSold: 218 },
    { flightId: 2005, targetSold: 132 },
    { flightId: 2006, targetSold: 205 },
    { flightId: 2007, targetSold: 112 },
    { flightId: 2008, targetSold: 212 },
    { flightId: 2009, targetSold: 145 },
    { flightId: 2010, targetSold: 192 },
    { flightId: 2011, targetSold: 125 },
    { flightId: 1001, targetSold: 88 },
    { flightId: 1006, targetSold: 82 }
  ];

  let bookingId = 6000;
  let ticketId = 8000;
  let paymentId = 10000;
  let inserted = 0;

  await connection.beginTransaction();

  try {
    for (const target of flightTargets) {
      const [flightRows] = await connection.query(
        `SELECT flight_id, itinerary_id, flight_date FROM flights WHERE flight_id = ?`,
        [target.flightId]
      );
      if (!flightRows.length) continue;

      const flight = flightRows[0];
      const bookingTime = formatSqlTimestamp(flight.flight_date);

      const [soldRows] = await connection.query(
        `SELECT COUNT(*) AS count
         FROM tickets t
         JOIN bookings b ON t.booking_id = b.booking_id AND b.status = 'Active'
         JOIN payments p ON b.booking_id = p.booking_id AND p.status = 'SUCCESS'
         WHERE t.flight_id = ?`,
        [target.flightId]
      );
      const alreadySold = Number(soldRows[0]?.count ?? 0);
      const seatsNeeded = Math.max(0, target.targetSold - alreadySold);
      if (seatsNeeded === 0) continue;

      const [seats] = await connection.query(
        `SELECT seat_number, price
         FROM flight_seats
         WHERE flight_id = ? AND is_available = TRUE
         ORDER BY RAND()
         LIMIT ?`,
        [target.flightId, seatsNeeded]
      );

      for (let i = 0; i < seats.length; i++) {
        const seat = seats[i];
        const userId = `cust0${(i % 4) + 1}`;

        await connection.query(
          `INSERT INTO bookings (booking_id, user_id, itinerary_id, booking_time, status)
           VALUES (?, ?, ?, ?, 'Active')`,
          [bookingId, userId, flight.itinerary_id, bookingTime]
        );
        await connection.query(
          `INSERT INTO booking_seats (booking_id, flight_id, seat_number) VALUES (?, ?, ?)`,
          [bookingId, target.flightId, seat.seat_number]
        );
        await connection.query(
          `INSERT INTO tickets (ticket_id, booking_id, flight_id, seat_number, issue_time)
           VALUES (?, ?, ?, ?, ?)`,
          [ticketId, bookingId, target.flightId, seat.seat_number, bookingTime]
        );
        await connection.query(
          `INSERT INTO payments (payment_id, booking_id, amount, payment_method, status, payment_time)
           VALUES (?, ?, ?, 'CARD', 'SUCCESS', ?)`,
          [paymentId, bookingId, seat.price, bookingTime]
        );
        await connection.query(
          `UPDATE flight_seats SET is_available = FALSE WHERE flight_id = ? AND seat_number = ?`,
          [target.flightId, seat.seat_number]
        );

        bookingId += 1;
        ticketId += 1;
        paymentId += 1;
        inserted += 1;
      }
    }

    await connection.commit();
    console.log(`Demo distribution seats sold: ${inserted}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

try {
  const mysqlCli = findMysqlCli();
  if (!mysqlCli) {
    throw new Error("mysql/mariadb CLI was not found. Set MYSQL_CLI to the full path of mysql.exe.");
  }

  const initSql = [
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    `USE \`${dbName}\`;`,
    `SOURCE ${mysqlPathForSource("schema.sql")};`,
    `SOURCE ${mysqlPathForSource("sample_data.sql")};`,
    `SOURCE ${mysqlPathForSource("operations.sql")};`
  ].join("\n");

  const tempPath = path.join(root, ".db-init.sql");
  fs.writeFileSync(tempPath, initSql, "utf8");

  const args = [
    `--host=${connectionConfig.host}`,
    `--port=${connectionConfig.port}`,
    `--user=${connectionConfig.user}`,
    "--default-character-set=utf8mb4",
    `--execute=SOURCE ${tempPath.replaceAll("\\", "/")};`
  ];

  const result = spawnSync(mysqlCli, args, {
    encoding: "utf8",
    env: { ...process.env, MYSQL_PWD: connectionConfig.password },
    shell: false
  });

  fs.rmSync(tempPath, { force: true });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "MariaDB CLI exited with a non-zero status.");
  }

  const connection = await mysql.createConnection(connectionConfig);
  const { seedSeatTemplates } = await import("./seed-seat-templates.mjs");
  await seedSeatTemplates(connection);
  await connection.query("SET FOREIGN_KEY_CHECKS=0");
  await connection.query("DELETE FROM flight_seats");
  await connection.query("SET FOREIGN_KEY_CHECKS=1");
  await connection.query(`
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
            WHEN fs.dep_airport IN ('JFK', 'LAX', 'SFO', 'SEA', 'CDG')
              OR fs.arr_airport IN ('JFK', 'LAX', 'SFO', 'SEA', 'CDG') THEN 5200.00
            WHEN fs.dep_airport IN ('SIN', 'BKK', 'HKG', 'NRT', 'KIX')
              OR fs.arr_airport IN ('SIN', 'BKK', 'HKG', 'NRT', 'KIX') THEN 2600.00
            ELSE 1600.00
          END
        WHEN s.class_id = 2 THEN
          CASE
            WHEN fs.dep_airport IN ('JFK', 'LAX', 'SFO', 'SEA', 'CDG')
              OR fs.arr_airport IN ('JFK', 'LAX', 'SFO', 'SEA', 'CDG') THEN 2400.00
            WHEN fs.dep_airport IN ('SIN', 'BKK', 'HKG', 'NRT', 'KIX')
              OR fs.arr_airport IN ('SIN', 'BKK', 'HKG', 'NRT', 'KIX') THEN 980.00
            ELSE 620.00
          END
        ELSE
          CASE
            WHEN fs.dep_airport IN ('JFK', 'LAX', 'SFO', 'SEA', 'CDG')
              OR fs.arr_airport IN ('JFK', 'LAX', 'SFO', 'SEA', 'CDG') THEN 780.00
            WHEN fs.dep_airport IN ('SIN', 'BKK', 'HKG', 'NRT', 'KIX')
              OR fs.arr_airport IN ('SIN', 'BKK', 'HKG', 'NRT', 'KIX') THEN 360.00
            ELSE 210.00
          END
      END AS price
    FROM flights f
    JOIN flight_schedules fs ON f.schedule_id = fs.schedule_id
    JOIN aircraft_seats s ON f.aircraft_id = s.aircraft_id
  `);

  const demoPath = path.join(root, "demo_transactions.sql");
  if (fs.existsSync(demoPath)) {
    const demoSql = fs.readFileSync(demoPath, "utf8");
    await connection.query(demoSql);
  }

  await seedDemoDistribution(connection);

  const [flights] = await connection.query("SELECT COUNT(*) AS count FROM flights");
  const [seats] = await connection.query("SELECT COUNT(*) AS count FROM flight_seats");
  const [bookings] = await connection.query("SELECT COUNT(*) AS count FROM bookings");
  const [tickets] = await connection.query("SELECT COUNT(*) AS count FROM tickets");
  const [soldSeats] = await connection.query(
    "SELECT COUNT(*) AS count FROM flight_seats WHERE is_available = 0"
  );
  await connection.end();

  console.log(`Database ready: ${dbName}`);
  console.log(`Seeded flights: ${flights[0].count}`);
  console.log(`Seeded flight seats: ${seats[0].count}`);
  console.log(`Demo bookings: ${bookings[0].count}`);
  console.log(`Demo tickets: ${tickets[0].count}`);
  console.log(`Sold seats: ${soldSeats[0].count}`);
} catch (error) {
  console.error("Database setup failed.");
  console.error(error.message);
  process.exit(1);
}
