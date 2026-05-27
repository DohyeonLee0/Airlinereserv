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
    JOIN aircraft_seats s ON f.aircraft_id = s.aircraft_id
  `);
  const [flights] = await connection.query("SELECT COUNT(*) AS count FROM flights");
  const [seats] = await connection.query("SELECT COUNT(*) AS count FROM flight_seats");
  await connection.end();

  console.log(`Database ready: ${dbName}`);
  console.log(`Seeded flights: ${flights[0].count}`);
  console.log(`Seeded flight seats: ${seats[0].count}`);
} catch (error) {
  console.error("Database setup failed.");
  console.error(error.message);
  process.exit(1);
}
