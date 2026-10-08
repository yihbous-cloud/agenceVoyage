import mysql from "mysql2/promise";

// Pool unique par processus, mis en cache dans globalThis : en développement,
// chaque rechargement à chaud réévalue ce module ; sans ce cache, un nouveau
// pool de 10 connexions était créé à chaque fois et les anciens restaient
// ouverts, jusqu'à saturer MySQL (« Too many connections », constaté).
let pool = globalThis.__gfDbPool;

export function getPool() {
  if (!pool) {
    pool = globalThis.__gfDbPool = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "golden_fantastic",
      waitForConnections: true,
      connectionLimit: 10,
      dateStrings: true,
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}
