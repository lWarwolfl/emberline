import "dotenv/config";
import { getMigrations } from "better-auth/db/migration";
import { createAccountService } from "./accounts";

async function main() {
  const { DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL } = process.env;
  if (!DATABASE_URL || !BETTER_AUTH_SECRET || !BETTER_AUTH_URL)
    throw new Error("Set the three server environment variables from .env.example first.");
  const service = await createAccountService(DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL);
  try {
    const migration = await getMigrations(service.auth.options);
    await migration.runMigrations();
    await service.pool.query(`
      CREATE TABLE IF NOT EXISTS emberline_recovery (
        user_id TEXT PRIMARY KEY REFERENCES emberline_user(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS emberline_save (
        user_id TEXT PRIMARY KEY REFERENCES emberline_user(id) ON DELETE CASCADE,
        data JSONB NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS emberline_rate_limit (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS emberline_rate_limit_expiry ON emberline_rate_limit(expires_at);
    `);
    console.log("Emberline account tables are ready (additive migration).");
  } finally {
    await service.close();
  }
}
void main().catch(() => {
  console.error("Account migration failed. Check server environment and database connectivity.");
  process.exitCode = 1;
});
