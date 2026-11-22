import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Wallet } from "ethers";
import { createAccountService } from "../server/accounts";
import { donationService, hasSupporterReward } from "../server/donations";
import { DonationError } from "../server/donation-chain";
import { donationNetwork } from "../src/donation-config";

test(
  "live donation ledger grants once atomically, rejects replay/cross-account claims, and stores exact amount",
  { skip: process.env.EMBERLINE_TEST_DATABASE !== "1" },
  async () => {
    assert(process.env.DATABASE_URL);
    const service = await createAccountService(
      process.env.DATABASE_URL,
      randomBytes(32).toString("hex"),
      "http://127.0.0.1:4199",
    );
    const users: { id: string; username: string }[] = [];
    const txId = "0x" + randomBytes(32).toString("hex"),
      wallet = Wallet.createRandom();
    const network = donationNetwork("ethereum")!;
    let unavailable = false;
    const handler = donationService(service.pool, "http://127.0.0.1:4199", async () => {
      if (unavailable) throw new DonationError(503, "busy");
      return {
        network: "ethereum",
        txId,
        sender: wallet.address.toLowerCase(),
        recipient: network.address,
        asset: "ETH",
        amountUnits: "1",
        decimals: 18,
        blockReference: "test-block",
      };
    });
    try {
      for (let i = 0; i < 2; i++) {
        const username = "test_donate_" + randomBytes(5).toString("hex");
        const result = await service.auth.api.signUpEmail({
          body: {
            name: username,
            username,
            email: username + "@accounts.emberline.invalid",
            password: randomBytes(16).toString("hex"),
          },
        });
        users.push({ id: result.user.id, username });
      }
      const prepare = async (user: (typeof users)[number]) => {
        const result = (await handler(
          "donation-challenge",
          "POST",
          { network: "ethereum", txId, sender: wallet.address },
          user,
        )) as { nonce: string; message: string };
        return {
          nonce: result.nonce,
          signature: await wallet.signMessage(result.message),
          name: "Kind courier",
          email: "donor@example.com",
        };
      };
      const old = await prepare(users[0]),
        fresh = await prepare(users[0]);
      await assert.rejects(handler("donation-claim", "POST", old, users[0]), DonationError);
      unavailable = true;
      await assert.rejects(handler("donation-claim", "POST", fresh, users[0]));
      assert(!(await hasSupporterReward(service.pool, users[0].id)));
      unavailable = false;
      const attempts = await Promise.allSettled([
        handler("donation-claim", "POST", fresh, users[0]),
        handler("donation-claim", "POST", fresh, users[0]),
      ]);
      assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 1);
      assert(await hasSupporterReward(service.pool, users[0].id));
      await assert.rejects(handler("donation-claim", "POST", fresh, users[0]), DonationError);
      const other = await prepare(users[1]);
      await assert.rejects(handler("donation-claim", "POST", other, users[1]), /another account/);
      assert(!(await hasSupporterReward(service.pool, users[1].id)));
      const { rows } = await service.pool.query(
        "SELECT username,donor_name,email,amount_units::text FROM emberline_donation WHERE tx_id=$1",
        [txId],
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].amount_units, "1");
      assert.equal(rows[0].username, users[0].username);
      assert.equal(rows[0].donor_name, "Kind courier");
      assert.equal(rows[0].email, "donor@example.com");
      const again = await prepare(users[0]);
      await handler("donation-claim", "POST", again, users[0]);
      assert.equal(
        (await service.pool.query("SELECT id FROM emberline_donation WHERE tx_id=$1", [txId]))
          .rowCount,
        1,
      );
      const expired = await prepare(users[0]);
      await service.pool.query(
        "UPDATE emberline_donation_challenge SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1",
        [users[0].id],
      );
      await assert.rejects(handler("donation-claim", "POST", expired, users[0]), /expired/);
    } finally {
      await service.pool.query("DELETE FROM emberline_donation WHERE tx_id=$1", [txId]);
      for (const user of users)
        await service.pool.query("DELETE FROM emberline_user WHERE id=$1", [user.id]);
      await service.close();
    }
  },
);
