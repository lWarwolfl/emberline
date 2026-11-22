import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { Wallet, concat, keccak256, toUtf8Bytes } from "ethers";
import base58 from "bs58";
import { Signer, Address } from "bip322-js";
import { verifyDonationSignature } from "../server/donation-signatures";
import { execFileSync } from "node:child_process";
import path from "node:path";

test("EVM signatures bind sender and exact claim message on both networks", async () => {
  const wallet = Wallet.createRandom(),
    message = "Emberline claim / account A / nonce one";
  const signature = await wallet.signMessage(message);
  for (const network of ["bnb", "ethereum"] as const) {
    assert(await verifyDonationSignature(network, wallet.address, message, signature));
    assert(
      !(await verifyDonationSignature(network, wallet.address, message + "changed", signature)),
    );
    assert(
      !(await verifyDonationSignature(network, Wallet.createRandom().address, message, signature)),
    );
  }
});
test("Solana Ed25519 and TRON TIP-191 proofs reject changed messages", async () => {
  const message = "Emberline donation ownership proof";
  const keys = generateKeyPairSync("ed25519"),
    pub = keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const sender = base58.encode(pub),
    signature = sign(null, Buffer.from(message), keys.privateKey).toString("base64");
  assert(await verifyDonationSignature("solana", sender, message, signature));
  assert(!(await verifyDonationSignature("solana", sender, message + "x", signature)));
  const wallet = Wallet.createRandom(),
    payload = Buffer.from("41" + wallet.address.slice(2), "hex");
  const check = createHash("sha256")
    .update(createHash("sha256").update(payload).digest())
    .digest()
    .subarray(0, 4);
  const tron = base58.encode(Buffer.concat([payload, check]));
  const digest = keccak256(
    concat([
      toUtf8Bytes("\x19TRON Signed Message:\n" + Buffer.byteLength(message)),
      toUtf8Bytes(message),
    ]),
  );
  const tronSignature = wallet.signingKey.sign(digest).serialized;
  assert(await verifyDonationSignature("tron", tron, message, tronSignature));
  assert(!(await verifyDonationSignature("tron", tron, message + "x", tronSignature)));
  assert(!(await verifyDonationSignature("ethereum", wallet.address, message, tronSignature)));
});
test("Bitcoin BIP-322 ownership verifies on a CommonJS-only runtime", async () => {
  const wallet = Wallet.createRandom(),
    pub = Buffer.from(wallet.signingKey.compressedPublicKey.slice(2), "hex");
  const sender = Address.convertPubKeyIntoAddress(pub, "p2wpkh").mainnet;
  const payload = Buffer.concat([
    Buffer.from([128]),
    Buffer.from(wallet.privateKey.slice(2), "hex"),
    Buffer.from([1]),
  ]);
  const check = createHash("sha256")
    .update(createHash("sha256").update(payload).digest())
    .digest()
    .subarray(0, 4);
  const wif = base58.encode(Buffer.concat([payload, check]));
  const message = "Claim for account A only",
    signature = Signer.sign(wif, sender, message);
  assert(await verifyDonationSignature("bitcoin", sender, message, signature));
  assert(!(await verifyDonationSignature("bitcoin", sender, message + "B", signature)));
  const script = `const {Verifier}=require(${JSON.stringify(path.resolve(__dirname, "../server/bitcoin-proof.cjs"))}); if(!Verifier.verifySignature(${JSON.stringify(sender)},${JSON.stringify(message)},${JSON.stringify(signature)}))process.exitCode=1;`;
  execFileSync(process.execPath, ["--no-experimental-require-module", "-e", script]);
});
