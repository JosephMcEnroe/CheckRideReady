import mysql from "mysql2/promise";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

declare global {
   
  var __mysqlPool: mysql.Pool | undefined;
}

export const pool =
  global.__mysqlPool ||
  mysql.createPool({
    uri: requireEnv("MYSQL_URL"),
    connectionLimit: 2,
    waitForConnections: true,
    enableKeepAlive: true,
  });

if (!global.__mysqlPool) global.__mysqlPool = pool;
