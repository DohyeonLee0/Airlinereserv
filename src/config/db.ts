import mysql, { Pool, RowDataPacket } from "mysql2/promise";

declare global {
  var __arsMysqlPool: Pool | undefined;
}

export function getPool() {
  if (!global.__arsMysqlPool) {
    global.__arsMysqlPool = mysql.createPool({
      host: process.env.DB_HOST ?? "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME ?? "airline_reservation",
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_POOL_SIZE ?? 5),
      queueLimit: 0,
      multipleStatements: true,
      dateStrings: true,
      decimalNumbers: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
  }

  return global.__arsMysqlPool;
}

export async function callProcedure<T extends RowDataPacket[]>(
  sql: string,
  params: unknown[] = []
): Promise<T> {
  const [result] = await getPool().query(sql, params);
  const sets = result as unknown[];
  return (Array.isArray(sets) && Array.isArray(sets[0]) ? sets[0] : sets) as T;
}
