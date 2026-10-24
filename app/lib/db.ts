import { readFileSync, existsSync } from "node:fs";
import { Pool, type QueryResult, type QueryResultRow } from "pg";

const globalForPostgres = globalThis as typeof globalThis & {
  postgresPool?: Pool;
};

function createPool() {
  const configuredUrl = process.env.DATABASE_URL;

  if (!configuredUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  // pg's URL SSL parameters can override the explicit SSL object below.
  // Remove them from this in-memory copy so the RDS CA bundle is used.
  const url = new URL(configuredUrl);
  const sslMode = url.searchParams.get("sslmode");
  const sslRootCert = url.searchParams.get("sslrootcert");
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslrootcert");
  url.searchParams.delete("sslcert");
  url.searchParams.delete("sslkey");

  const caPath =
    process.env.RDS_CA_CERT_PATH ?? "/etc/ssl/certs/rds/global-bundle.pem";

  let ssl: Pool["options"]["ssl"];

  if (sslRootCert) {
    // Respect an explicitly configured root certificate path.
    if (!existsSync(sslRootCert)) {
      throw new Error("The configured PostgreSQL SSL root certificate was not found");
    }
    ssl = {
      ca: readFileSync(sslRootCert, "utf8"),
      rejectUnauthorized: true,
    };
  } else if (existsSync(caPath)) {
    ssl = {
      ca: readFileSync(caPath, "utf8"),
      rejectUnauthorized: true,
    };
  } else if (url.hostname.endsWith(".rds.amazonaws.com")) {
    throw new Error(
      `RDS CA bundle not found. Set RDS_CA_CERT_PATH to the AWS RDS CA bundle file (currently expected at ${caPath}).`,
    );
  } else if (sslMode) {
    // Non-RDS development databases may rely on the platform's trusted CAs.
    ssl = { rejectUnauthorized: true };
  }

  return new Pool({
    connectionString: url.toString(),
    ...(ssl ? { ssl } : {}),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export const db = globalForPostgres.postgresPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForPostgres.postgresPool = db;
}

db.on("error", (error) => {
  // Do not log connection strings or other secret configuration.
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<T>> {
  return db.query<T>(text, values);
}
