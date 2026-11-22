import test from "node:test";
import assert from "node:assert/strict";
import { connectDonationWallet, signDonationMessage } from "../src/donation-wallet";

test("browser adapters request only account access and exact ownership signatures", async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  let win: Record<string, unknown> = {};
  Object.defineProperty(globalThis, "window", { configurable: true, get: () => win });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  });
  const sender = "0x" + "1".repeat(40),
    calls: { method: string; params?: unknown[] }[] = [];
  const provider = {
    request: async (args: { method: string; params?: unknown[] }) => {
      calls.push(args);
      return args.method === "eth_requestAccounts" ? [sender] : "0xsignature";
    },
  };
  win = { ethereum: provider };
  for (const network of ["bnb", "ethereum"] as const) {
    assert.equal(await connectDonationWallet(network), sender);
    assert.equal(await signDonationMessage(network, sender, "Exact message"), "0xsignature");
    assert.deepEqual(calls.at(-1), {
      method: "personal_sign",
      params: ["0x" + Buffer.from("Exact message").toString("hex"), sender],
    });
  }
  assert(!calls.some((c) => c.method.includes("sendTransaction")));
  await assert.rejects(
    signDonationMessage("bnb", "0x" + "2".repeat(40), "message"),
    /address that sent/,
  );
  win = {
    ethereum: {
      request: async () => {
        throw new Error("User rejected request");
      },
    },
  };
  await assert.rejects(signDonationMessage("ethereum", sender, "message"), /rejected/);
  let signed: Uint8Array | undefined;
  win = {
    solana: {
      connect: async () => {},
      publicKey: { toString: () => "solana-sender" },
      signMessage: async (bytes: Uint8Array) => {
        signed = bytes;
        return { signature: new Uint8Array(64).fill(7) };
      },
    },
  };
  assert.equal(
    await signDonationMessage("solana", "solana-sender", "Exact message"),
    Buffer.alloc(64, 7).toString("base64"),
  );
  assert.equal(new TextDecoder().decode(signed), "Exact message");
  let tronMessage = "";
  win = {
    tronWeb: {
      defaultAddress: { base58: "tron-sender" },
      trx: {
        signMessageV2: async (message: string) => {
          tronMessage = message;
          return "tron-signature";
        },
      },
    },
  };
  assert.equal(await signDonationMessage("tron", "tron-sender", "Exact message"), "tron-signature");
  assert.equal(tronMessage, "Exact message");
  win = {};
  await assert.rejects(connectDonationWallet("bitcoin"), /BIP-322/);
});
