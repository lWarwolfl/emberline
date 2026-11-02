import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { once } from "node:events";
import { createAccountService, readAccountBody } from "../server/accounts";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { validSave, sameSave } from "../src/cloud-save";

test("account bodies accept Vercel's parsed JSON and native Node streams with the same limits", async () => {
  const parsed = { username: "courier", password: "secret-phrase" };
  const request = (body?: unknown) =>
    Object.assign(Readable.from([]), { body }) as IncomingMessage & { body?: unknown };
  assert.deepEqual(await readAccountBody(request(parsed)), parsed);
  assert.deepEqual(await readAccountBody(request(JSON.stringify(parsed))), parsed);
  assert.deepEqual(await readAccountBody(request(Buffer.from(JSON.stringify(parsed)))), parsed);
  assert.deepEqual(
    await readAccountBody(Readable.from([JSON.stringify(parsed)]) as IncomingMessage),
    parsed,
  );
  await assert.rejects(readAccountBody(request([])), /Invalid request/);
  await assert.rejects(readAccountBody(request("{broken")), /Invalid request/);
  await assert.rejects(readAccountBody(request({ data: "a".repeat(110001) })), /too large/);
  await assert.rejects(
    readAccountBody(Readable.from(["a".repeat(110001)]) as IncomingMessage),
    /too large/,
  );
});

test("cloud save validation preserves explicit resets and excludes unrelated origin data", () => {
  assert.ok(
    validSave({
      economy: '{"balance":"9007199254740993"}',
      best: "12000",
      loadout: null,
      effects: "false",
    }),
  );
  assert.equal(validSave({ token: "secret" }), false);
  assert.equal(validSave({ best: 123 }), false);
  assert.equal(validSave({ economy: "a".repeat(50001) }), false);
  assert.equal(sameSave({ best: null }, {}), true);
  assert.equal(sameSave({ best: "100" }, { best: "101" }), false);
});

test(
  "live Neon accounts isolate saves, reject stale writes, and rotate recovery with session revocation",
  {
    skip: process.env.EMBERLINE_TEST_DATABASE !== "1",
  },
  async () => {
    assert.ok(process.env.DATABASE_URL);
    const server = createServer((req, res) => {
      void service.handle(req, res);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = "http://127.0.0.1:" + address.port;
    const service = await createAccountService(
      process.env.DATABASE_URL!,
      randomBytes(32).toString("hex"),
      origin,
    );
    const names = [
      "test_" + randomBytes(6).toString("hex"),
      "test_" + randomBytes(6).toString("hex"),
    ];
    const users: string[] = [];
    let cookie = "";
    const request = async (action: string, method = "GET", body?: unknown, useCookie = cookie) => {
      const response = await fetch(origin + "/api/account/" + action, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Emberline-Request": "1",
          Origin: origin,
          Cookie: useCookie,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const cookies = response.headers.getSetCookie();
      const newCookie = cookies.map((item) => item.split(";")[0]).join("; ");
      const data = (await response.json()) as Record<string, unknown>;
      return { status: response.status, data, cookie: newCookie };
    };
    try {
      const unauth = await request("save");
      assert.equal(unauth.status, 401);
      const registered = await request("register", "POST", {
        username: names[0],
        password: "test-password-1234",
      });
      assert.equal(registered.status, 201, JSON.stringify(registered.data));
      users.push((registered.data.user as { id: string }).id);
      assert.ok(registered.cookie);
      cookie = registered.cookie;
      const firstCookie = cookie;
      const first = await request("save", "PUT", {
        userId: users[0],
        data: { best: "500", loadout: null },
        version: 0,
      });
      assert.equal(first.status, 200);
      assert.equal(first.data.version, 1);
      const stale = await request("save", "PUT", {
        userId: users[0],
        data: { best: "1" },
        version: 0,
      });
      assert.equal(stale.status, 409);
      const saved = await request("save", "PUT", {
        userId: users[0],
        data: { best: "600" },
        version: 1,
      });
      assert.equal(saved.status, 200);
      assert.equal(saved.data.version, 2);
      const other = await request(
        "register",
        "POST",
        { username: names[1], password: "other-password-1234" },
        "",
      );
      assert.equal(other.status, 201);
      users.push((other.data.user as { id: string }).id);
      const otherSave = await request("save", "GET", undefined, other.cookie);
      assert.equal(otherSave.data.data, null);
      const switchedAccount = await request(
        "save",
        "PUT",
        { userId: users[0], data: { best: "700" }, version: 0 },
        other.cookie,
      );
      assert.equal(switchedAccount.status, 401);
      const invalidOrigin = await fetch(origin + "/api/account/save", {
        method: "PUT",
        headers: {
          Origin: "https://attacker.invalid",
          "Content-Type": "application/json",
          "X-Emberline-Request": "1",
          Cookie: cookie,
        },
        body: "{}",
      });
      assert.equal(invalidOrigin.status, 403);
      const recovery = await request(
        "recover",
        "POST",
        {
          username: names[0],
          password: "replacement-password-456",
          recoveryCode: registered.data.recoveryCode,
        },
        "",
      );
      assert.equal(recovery.status, 200, JSON.stringify(recovery.data));
      assert.notEqual(recovery.data.recoveryCode, registered.data.recoveryCode);
      assert.equal((await request("save", "GET", undefined, firstCookie)).status, 401);
      assert.equal(
        (
          await request(
            "recover",
            "POST",
            {
              username: names[0],
              password: "replacement-password-456",
              recoveryCode: registered.data.recoveryCode,
            },
            "",
          )
        ).status,
        400,
      );
      assert.equal(
        (await request("login", "POST", { username: names[0], password: "test-password-1234" }, ""))
          .status,
        401,
      );
      const loggedIn = await request(
        "login",
        "POST",
        { username: names[0], password: "replacement-password-456" },
        "",
      );
      assert.equal(loggedIn.status, 200, JSON.stringify(loggedIn.data));
      cookie = loggedIn.cookie;
      const restored = await request("save");
      assert.deepEqual(restored.data.data, { best: "600" });
      const rotated = await request("recovery-code", "POST", {
        password: "replacement-password-456",
      });
      assert.equal(rotated.status, 200);
      const loggedOut = await request("logout", "POST", {});
      assert.equal(loggedOut.status, 200);
      assert.equal((await request("save")).status, 401);
    } finally {
      const rateKeys = [
        "requests:127.0.0.1",
        "register:127.0.0.1",
        "login-ip:127.0.0.1",
        "recover-ip:127.0.0.1",
        ...names.map((name) => "login-user:" + name),
        ...names.map((name) => "recover-user:" + name),
        ...users.map((id) => "rotate:" + id),
      ].map((key) =>
        createHash("sha256")
          .update(origin + ":" + key)
          .digest("hex"),
      );
      await service.pool.query("DELETE FROM emberline_rate_limit WHERE key = ANY($1::text[])", [
        rateKeys,
      ]);
      if (users.length) {
        await service.pool.query('DELETE FROM emberline_session WHERE "userId" = ANY($1::text[])', [
          users,
        ]);
        await service.pool.query('DELETE FROM emberline_account WHERE "userId" = ANY($1::text[])', [
          users,
        ]);
        await service.pool.query("DELETE FROM emberline_user WHERE id = ANY($1::text[])", [users]);
      }
      await service.close();
      server.close();
      await once(server, "close");
    }
  },
);
