import mysql, { type Pool, type PoolConnection } from "mysql2/promise";

type MysqlGlobal = typeof globalThis & { aimsMysqlPool?: Pool };
const mysqlGlobal = globalThis as MysqlGlobal;

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

export function getPool(): Pool {
  if (mysqlGlobal.aimsMysqlPool) return mysqlGlobal.aimsMysqlPool;

  const user = process.env.DB_USER;
  if (!user) {
    throw new DatabaseConfigurationError("Set DB_USER in .env.local to connect to aims_db.");
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || "aims_db",
    user,
    password: process.env.DB_PASSWORD || "",
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
  });
  mysqlGlobal.aimsMysqlPool = pool;
  return pool;
}

export async function withConnection<T>(action: (connection: PoolConnection) => Promise<T>) {
  const connection = await getPool().getConnection();
  try {
    return await action(connection);
  } finally {
    connection.release();
  }
}

export function databaseErrorResponse(error: unknown) {
  if (error instanceof DatabaseConfigurationError) {
    return Response.json({ error: error.message }, { status: 503 });
  }
  console.error("AIMS database request failed:", error);
  return Response.json(
    { error: "Could not complete the database request. Check the MySQL server and aims_db schema." },
    { status: 503 },
  );
}
