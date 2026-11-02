import "dotenv/config";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Pool } from "pg";
import { validSave } from "../src/cloud-save";

export async function readAccountBody(req: IncomingMessage & { body?: unknown }) {
  let parsed: unknown = req.body;
  if (parsed === undefined) {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      size += buffer.length;
      if (size > 110000) throw new AccountError(413, "Save is too large.");
      chunks.push(buffer);
    }
    parsed = Buffer.concat(chunks).toString("utf8");
  }
  if (Buffer.isBuffer(parsed)) parsed = parsed.toString("utf8");
  if (typeof parsed === "string") {
    if (Buffer.byteLength(parsed) > 110000) throw new AccountError(413, "Save is too large.");
    try {
      parsed = JSON.parse(parsed || "{}");
    } catch {
      throw new AccountError(400, "Invalid request.");
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new AccountError(400, "Invalid request.");
  if (Buffer.byteLength(JSON.stringify(parsed)) > 110000)
    throw new AccountError(413, "Save is too large.");
  return parsed as Record<string, unknown>;
}

export async function createAccountService(
  connectionString: string,
  secret: string,
  baseURL: string,
) {
  const [{ betterAuth }, { username }, { hashPassword, verifyPassword }] = await Promise.all([
    import("better-auth"),
    import("better-auth/plugins"),
    import("better-auth/crypto"),
  ]);
  const pool = new Pool({ connectionString, max: 4, connectionTimeoutMillis: 15000 });
  const auth = betterAuth({
    database: pool,
    secret,
    baseURL,
    basePath: "/api/auth",
    emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
    plugins: [username({ minUsernameLength: 3, maxUsernameLength: 24 })],
    user: { modelName: "emberline_user" },
    session: { modelName: "emberline_session", expiresIn: 60 * 60 * 24 * 30 },
    account: { modelName: "emberline_account" },
    verification: { modelName: "emberline_verification" },
    advanced: { database: { generateId: () => randomBytes(16).toString("hex") } },
  });
  const digest = (value: string) => createHash("sha256").update(value).digest("hex");
  const code = () =>
    randomBytes(24)
      .toString("hex")
      .match(/.{1,8}/g)!
      .join("-");
  const normalizedCode = (value: unknown) =>
    String(value ?? "")
      .replace(/[^a-f0-9]/gi, "")
      .toLowerCase();
  const normalizeUsername = (value: unknown) =>
    String(value ?? "")
      .trim()
      .toLowerCase();

  let nextRateCleanup = 0;
  async function limit(key: string, maximum: number, seconds: number) {
    if (Date.now() >= nextRateCleanup) {
      nextRateCleanup = Date.now() + 60000;
      await pool.query(
        "DELETE FROM emberline_rate_limit WHERE key IN (SELECT key FROM emberline_rate_limit WHERE expires_at < NOW() LIMIT 1000)",
      );
    }
    const result = await pool.query<{ count: number }>(
      `INSERT INTO emberline_rate_limit (key, count, expires_at) VALUES ($1, 1, NOW() + $2 * INTERVAL '1 second')
       ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN emberline_rate_limit.expires_at < NOW() THEN 1 ELSE emberline_rate_limit.count + 1 END,
       expires_at = CASE WHEN emberline_rate_limit.expires_at < NOW() THEN EXCLUDED.expires_at ELSE emberline_rate_limit.expires_at END RETURNING count`,
      [digest(new URL(baseURL).origin + ":" + key), seconds],
    );
    if (result.rows[0].count > maximum)
      throw new AccountError(429, "Too many attempts. Please try again later.");
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const route = new URL(req.url || "/", baseURL).pathname;
    if (!route.startsWith("/api/account/")) return false;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const send = (status: number, value: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(value));
    };
    try {
      const configuredOrigin = new URL(baseURL).origin;
      if (req.headers.origin && req.headers.origin !== configuredOrigin)
        throw new AccountError(403, "Open accounts on the configured game address.");
      if (req.method !== "GET" && req.method !== "POST" && req.method !== "PUT")
        throw new AccountError(405, "Method not allowed.");
      if (req.method !== "GET" && req.headers["x-emberline-request"] !== "1")
        throw new AccountError(403, "Invalid request.");
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers))
        if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      let body: Record<string, unknown> = {};
      if (req.method !== "GET") body = await readAccountBody(req);
      const ip = process.env.VERCEL
        ? String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown")
            .split(",")[0]
            .trim()
        : req.socket.remoteAddress || "unknown";
      await limit("requests:" + ip, 180, 60);
      const userName = normalizeUsername(body.username);
      const password = typeof body.password === "string" ? body.password : "";
      const validCredentials = () => {
        if (!/^[a-z0-9_]{3,24}$/.test(userName))
          throw new AccountError(
            400,
            "Use 3–24 letters, numbers or underscores for your username.",
          );
        if (password.length < 10 || password.length > 128)
          throw new AccountError(400, "Use a password of 10–128 characters.");
      };
      const forward = async (response: Response) => {
        const cookies = response.headers.getSetCookie();
        if (cookies.length) res.setHeader("Set-Cookie", cookies);
        return response.json() as Promise<Record<string, unknown>>;
      };
      if (route === "/api/account/register" && req.method === "POST") {
        validCredentials();
        await limit("register:" + ip, 6, 3600);
        const response = await auth.api.signUpEmail({
          headers,
          asResponse: true,
          body: {
            username: userName,
            name: userName,
            email: userName + "@accounts.emberline.invalid",
            password,
          },
        });
        const result = await forward(response);
        if (!response.ok)
          throw new AccountError(
            response.status,
            String(result.message || "Unable to create account."),
          );
        const user = result.user as { id: string; username: string };
        const recoveryCode = code();
        await pool.query("INSERT INTO emberline_recovery (user_id, code_hash) VALUES ($1, $2)", [
          user.id,
          digest(normalizedCode(recoveryCode)),
        ]);
        send(201, { user: { id: user.id, username: userName }, recoveryCode });
        return true;
      }
      if (route === "/api/account/login" && req.method === "POST") {
        validCredentials();
        await limit("login-ip:" + ip, 30, 900);
        await limit("login-user:" + userName, 12, 900);
        const response = await auth.api.signInUsername({
          headers,
          asResponse: true,
          body: { username: userName, password },
        });
        const result = await forward(response);
        if (!response.ok) throw new AccountError(401, "Username or password is incorrect.");
        const user = result.user as { id: string };
        send(200, { user: { id: user.id, username: userName } });
        return true;
      }
      if (route === "/api/account/recover" && req.method === "POST") {
        validCredentials();
        await limit("recover-ip:" + ip, 15, 900);
        await limit("recover-user:" + userName, 8, 900);
        const recoveryCode = code();
        const passwordHash = await hashPassword(password);
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await client.query<{ user_id: string; code_hash: string }>(
            `SELECT r.user_id, r.code_hash FROM emberline_recovery r JOIN emberline_user u ON u.id = r.user_id
             WHERE u.username = $1 FOR UPDATE OF r`,
            [userName],
          );
          const entry = result.rows[0];
          const supplied = digest(normalizedCode(body.recoveryCode));
          if (
            !entry ||
            !timingSafeEqual(Buffer.from(entry.code_hash, "hex"), Buffer.from(supplied, "hex"))
          )
            throw new AccountError(400, "Username or recovery code is incorrect.");
          await client.query(
            'UPDATE emberline_account SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2 AND "providerId" = \'credential\'',
            [passwordHash, entry.user_id],
          );
          await client.query('DELETE FROM emberline_session WHERE "userId" = $1', [entry.user_id]);
          await client.query("UPDATE emberline_recovery SET code_hash = $1 WHERE user_id = $2", [
            digest(normalizedCode(recoveryCode)),
            entry.user_id,
          ]);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
        send(200, { recoveryCode });
        return true;
      }
      const session = await auth.api.getSession({ headers });
      if (route === "/api/account/session" && req.method === "GET") {
        send(200, {
          user: session ? { id: session.user.id, username: session.user.username } : null,
        });
        return true;
      }
      if (!session) throw new AccountError(401, "Log in to sync your save.");
      const userId = session.user.id;
      if (route === "/api/account/logout" && req.method === "POST") {
        await forward(await auth.api.signOut({ headers, asResponse: true }));
        send(200, { ok: true });
        return true;
      }
      if (route === "/api/account/recovery-code" && req.method === "POST") {
        await limit("rotate:" + userId, 6, 900);
        const result = await pool.query<{ password: string }>(
          'SELECT password FROM emberline_account WHERE "userId" = $1 AND "providerId" = \'credential\'',
          [userId],
        );
        if (!result.rows[0] || !(await verifyPassword({ hash: result.rows[0].password, password })))
          throw new AccountError(400, "Current password is incorrect.");
        const recoveryCode = code();
        await pool.query(
          "INSERT INTO emberline_recovery (user_id, code_hash) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash",
          [userId, digest(normalizedCode(recoveryCode))],
        );
        send(200, { recoveryCode });
        return true;
      }
      if (route === "/api/account/save" && req.method === "GET") {
        const result = await pool.query(
          'SELECT data, version, updated_at AS "updatedAt" FROM emberline_save WHERE user_id = $1',
          [userId],
        );
        send(200, { ...(result.rows[0] ?? { data: null, version: 0 }), userId });
        return true;
      }
      if (route === "/api/account/save" && req.method === "PUT") {
        if (body.userId !== userId)
          throw new AccountError(401, "This account changed in another tab. Log in again.");
        if (
          !validSave(body.data) ||
          !Number.isSafeInteger(body.version) ||
          Number(body.version) < 0
        )
          throw new AccountError(400, "Invalid save.");
        const result = await pool.query(
          `INSERT INTO emberline_save (user_id, data, version) SELECT $1, $2, 1 WHERE $3::integer = 0
           ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, version = emberline_save.version + 1, updated_at = NOW()
           WHERE emberline_save.version = $3 RETURNING data, version, updated_at AS "updatedAt"`,
          [userId, JSON.stringify(body.data), body.version],
        );
        // Existing saves need a separate UPDATE because the insert SELECT is intentionally empty for nonzero versions.
        const updated =
          result.rows[0] ??
          (Number(body.version) > 0
            ? (
                await pool.query(
                  `UPDATE emberline_save SET data = $2, version = version + 1, updated_at = NOW() WHERE user_id = $1 AND version = $3 RETURNING data, version, updated_at AS "updatedAt"`,
                  [userId, JSON.stringify(body.data), body.version],
                )
              ).rows[0]
            : undefined);
        if (!updated) {
          const latest = await pool.query(
            'SELECT data, version, updated_at AS "updatedAt" FROM emberline_save WHERE user_id = $1',
            [userId],
          );
          send(409, {
            message: "Your cloud save changed on another device. Choose which save to keep.",
            ...(latest.rows[0] ?? { data: null, version: 0 }),
          });
        } else send(200, updated);
        return true;
      }
      throw new AccountError(404, "Account action not found.");
    } catch (error) {
      if (error instanceof AccountError) send(error.status, { message: error.message });
      else {
        console.error("Account request failed:", error instanceof Error ? error.name : "unknown");
        send(503, {
          message: "Account service is unavailable. Your local save is safe; try again shortly.",
        });
      }
      return true;
    }
  }
  return { handle, pool, auth, close: () => pool.end() };
}

class AccountError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let service: ReturnType<typeof createAccountService> | undefined;
export async function handleAccountRequest(req: IncomingMessage, res: ServerResponse) {
  if (!req.url?.startsWith("/api/account/")) return false;
  const { DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL } = process.env;
  if (!DATABASE_URL || !BETTER_AUTH_SECRET || !BETTER_AUTH_URL) {
    res.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(
      JSON.stringify({
        message:
          "Cloud accounts are not configured on this host. Your progress is saved on this device.",
      }),
    );
    return true;
  }
  service ??= createAccountService(DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL).catch(
    (error: unknown) => {
      service = undefined;
      throw error;
    },
  );
  return (await service).handle(req, res);
}
