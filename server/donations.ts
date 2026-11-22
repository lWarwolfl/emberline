import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { claimInput, DonationError, verifyDonationTransfer } from "./donation-chain";
import { verifyDonationSignature } from "./donation-signatures";
import type { DonationNetworkId } from "../src/donation-config";

interface User {
  id: string;
  username: string;
}
export async function hasSupporterReward(pool: Pool, userId: string) {
  return (
    (await pool.query("SELECT 1 FROM emberline_donation WHERE user_id=$1 LIMIT 1", [userId]))
      .rowCount !== 0
  );
}
export function donationService(
  pool: Pool,
  origin: string,
  verifyTransfer = verifyDonationTransfer,
  verifySignature = verifyDonationSignature,
) {
  return async function handle(
    action: string,
    method: string,
    body: Record<string, unknown>,
    user: User,
  ) {
    if (action === "donations" && method === "GET") {
      const result = await pool.query(
        `SELECT network,tx_id AS "txId",asset,amount_units::text AS "amountUnits",decimals,verified_at AS "verifiedAt" FROM emberline_donation WHERE user_id=$1 ORDER BY verified_at DESC LIMIT 50`,
        [user.id],
      );
      return { supporter: result.rows.length > 0, donations: result.rows };
    }
    if (action === "donation-challenge" && method === "POST") {
      const { network, txId, sender } = claimInput(body.network, body.txId, body.sender);
      const nonce = randomBytes(24).toString("hex"),
        expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const message = [
        "Emberline donation claim",
        `Website: ${origin}`,
        `Account: ${user.id}`,
        `Network: ${network.id}`,
        `Transaction: ${txId}`,
        `Sender: ${sender}`,
        `Nonce: ${nonce}`,
        `Expires: ${expiresAt}`,
        "This signature only claims a cosmetic reward. It does not authorize a transfer or token approval.",
      ].join("\n");
      await pool.query(
        `INSERT INTO emberline_donation_challenge (user_id,nonce,network,tx_id,sender,message,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id) DO UPDATE SET nonce=EXCLUDED.nonce,network=EXCLUDED.network,tx_id=EXCLUDED.tx_id,sender=EXCLUDED.sender,message=EXCLUDED.message,expires_at=EXCLUDED.expires_at,used_at=NULL`,
        [user.id, nonce, network.id, txId, sender, message, expiresAt],
      );
      return { nonce, message, expiresAt };
    }
    if (action !== "donation-claim" || method !== "POST")
      throw new DonationError(404, "Donation action not found.");
    const nonce = typeof body.nonce === "string" ? body.nonce : "";
    const signature = typeof body.signature === "string" ? body.signature.trim() : "";
    const donorName = typeof body.name === "string" ? body.name.trim() : user.username;
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (
      donorName.length > 80 ||
      [...donorName].some((c) => c.charCodeAt(0) < 32) ||
      email.length > 254 ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    )
      throw new DonationError(400, "Check your supporter name and optional email.");
    const { rows } = await pool.query<{
      network: DonationNetworkId;
      tx_id: string;
      sender: string;
      message: string;
      nonce: string;
    }>(
      "SELECT * FROM emberline_donation_challenge WHERE user_id=$1 AND nonce=$2 AND used_at IS NULL AND expires_at>NOW()",
      [user.id, nonce],
    );
    const challenge = rows[0];
    if (!challenge)
      throw new DonationError(
        409,
        "Your claim message expired or was replaced. Prepare a new message and sign it again.",
      );
    if (!(await verifySignature(challenge.network, challenge.sender, challenge.message, signature)))
      throw new DonationError(
        400,
        "The signature does not match the sending wallet and claim message.",
      );
    const transfer = await verifyTransfer(challenge.network, challenge.tx_id, challenge.sender);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const consumed = await client.query(
        "UPDATE emberline_donation_challenge SET used_at=NOW() WHERE user_id=$1 AND nonce=$2 AND used_at IS NULL AND expires_at>NOW() RETURNING user_id",
        [user.id, nonce],
      );
      if (!consumed.rowCount)
        throw new DonationError(
          409,
          "This claim message expired or was already used. Prepare another one.",
        );
      const inserted = await client.query(
        `INSERT INTO emberline_donation (user_id,username,donor_name,email,network,tx_id,sender,recipient,asset,amount_units,decimals,block_reference) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(network,tx_id) DO NOTHING RETURNING id`,
        [
          user.id,
          user.username,
          donorName || user.username,
          email || null,
          transfer.network,
          transfer.txId,
          transfer.sender,
          transfer.recipient,
          transfer.asset,
          transfer.amountUnits,
          transfer.decimals,
          transfer.blockReference,
        ],
      );
      if (!inserted.rowCount) {
        const existing = await client.query(
          "SELECT user_id FROM emberline_donation WHERE network=$1 AND tx_id=$2",
          [transfer.network, transfer.txId],
        );
        if (existing.rows[0]?.user_id !== user.id)
          throw new DonationError(
            409,
            "This donation has already been claimed by another account.",
          );
      }
      await client.query("COMMIT");
      return {
        supporter: true,
        message: "Donation verified. Your full Flamebound skin collection is unlocked.",
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };
}
