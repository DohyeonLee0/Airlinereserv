import mysql from "mysql2/promise";
import { loadLocalEnv } from "./env.mjs";

loadLocalEnv();

const config = {
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME,
  multipleStatements: true
};

try {
  const connection = await mysql.createConnection(config);
  const [rows] = await connection.query("SELECT VERSION() AS version");
  await connection.end();
  console.log(`MariaDB connected: ${rows[0].version}`);
} catch (error) {
  console.error("MariaDB connection failed.");
  console.error(error.message);
  process.exit(1);
}
