import { createHash, createPublicKey, verify } from "node:crypto";
import type { DonationNetworkId } from "../src/donation-config";

export async function verifyDonationSignature(
  network: DonationNetworkId,
  sender: string,
  message: string,
  signature: string,
) {
  if (!signature || signature.length > 3000) return false;
  try {
    if (network === "bitcoin") {
      const { Verifier } = await import("./bitcoin-proof.cjs");
      return Verifier.verifySignature(sender, message, signature);
    }
    if (network === "solana") {
      const { default: base58 } = await import("bs58");
      const pub = base58.decode(sender),
        sig = Buffer.from(signature, "base64");
      if (pub.length !== 32 || sig.length !== 64) return false;
      const key = createPublicKey({
        key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), pub]),
        format: "der",
        type: "spki",
      });
      return verify(null, Buffer.from(message), key, sig);
    }
    const ethers = await import("ethers");
    if (network !== "tron")
      return ethers.verifyMessage(message, signature).toLowerCase() === sender.toLowerCase();
    const digest = ethers.keccak256(
      ethers.concat([
        ethers.toUtf8Bytes("\x19TRON Signed Message:\n" + Buffer.byteLength(message)),
        ethers.toUtf8Bytes(message),
      ]),
    );
    const address = ethers.recoverAddress(digest, signature);
    const payload = Buffer.from("41" + address.slice(2), "hex");
    const checksum = createHash("sha256")
      .update(createHash("sha256").update(payload).digest())
      .digest()
      .subarray(0, 4);
    const { default: base58 } = await import("bs58");
    return base58.encode(Buffer.concat([payload, checksum])) === sender;
  } catch {
    return false;
  }
}
