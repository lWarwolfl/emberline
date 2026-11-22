import test from "node:test";
import assert from "node:assert/strict";
import { claimInput, verifyDonationTransfer, DonationError } from "../server/donation-chain";
import { donationNetwork } from "../src/donation-config";
const evmSender = "0x" + "1".repeat(40),
  tx = "0x" + "a".repeat(64),
  hash = "0x" + "b".repeat(64);
const json = (data: unknown) => new Response(JSON.stringify(data));
function evm(
  options: {
    value?: string;
    status?: string;
    to?: string;
    from?: string;
    height?: string;
    chain?: string;
    canonical?: string;
  } = {},
) {
  return (async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { method: string };
    const from = options.from ?? evmSender,
      to = options.to ?? donationNetwork("ethereum")!.address;
    const values: Record<string, unknown> = {
      eth_chainId: options.chain ?? "0x1",
      eth_getTransactionByHash: {
        hash: tx,
        from,
        to,
        value: options.value ?? "0x20000000000001",
        blockNumber: "0x10",
        blockHash: hash,
      },
      eth_getTransactionReceipt: {
        transactionHash: tx,
        from,
        to,
        status: options.status ?? "0x1",
        blockNumber: "0x10",
        blockHash: hash,
      },
      eth_blockNumber: options.height ?? "0x30",
      eth_getBlockByNumber: { hash: options.canonical ?? hash },
    };
    return json({ result: values[body.method] });
  }) as typeof fetch;
}
test("EVM verification uses actual exact units and rejects wrong recipient, sender, status, chain and reorg", async () => {
  const result = await verifyDonationTransfer("ethereum", tx, evmSender, evm());
  assert.equal(result.amountUnits, "9007199254740993");
  for (const option of [
    { value: "0x0" },
    { status: "0x0" },
    { to: evmSender },
    { from: "0x" + "2".repeat(40) },
    { height: "0x11" },
    { chain: "0x38" },
    { canonical: "other" },
  ])
    await assert.rejects(
      verifyDonationTransfer("ethereum", tx, evmSender, evm(option)),
      DonationError,
    );
  await assert.rejects(
    verifyDonationTransfer(
      "ethereum",
      tx,
      evmSender,
      async () => new Response("busy", { status: 429 }),
    ),
    (e) => e instanceof DonationError && e.status === 503,
  );
  await assert.rejects(
    verifyDonationTransfer("ethereum", tx, evmSender, async () => json({ result: null })),
    DonationError,
  );
  const bnb = await verifyDonationTransfer("bnb", tx, evmSender, evm({ chain: "0x38" }));
  assert.equal(bnb.asset, "BNB");
});
test("Bitcoin verifies received outputs and rejects mixed-sender or unconfirmed transactions", async () => {
  const sender = "bc1q" + "a".repeat(38),
    id = "a".repeat(64),
    recipient = donationNetwork("bitcoin")!.address;
  const fixture = {
    txid: id,
    status: { confirmed: true, block_height: 100, block_hash: "block" },
    vin: [{ prevout: { scriptpubkey_address: sender } }],
    vout: [
      { scriptpubkey_address: recipient, value: 1234 },
      { scriptpubkey_address: sender, value: 77 },
    ],
  };
  const fetcher = (async (url) =>
    json(String(url).endsWith("/height") ? 103 : fixture)) as typeof fetch;
  assert.equal((await verifyDonationTransfer("bitcoin", id, sender, fetcher)).amountUnits, "1234");
  fixture.status.confirmed = false;
  await assert.rejects(verifyDonationTransfer("bitcoin", id, sender, fetcher));
  fixture.status.confirmed = true;
  fixture.vin.push({ prevout: { scriptpubkey_address: "other" } });
  await assert.rejects(verifyDonationTransfer("bitcoin", id, sender, fetcher));
});
test("Solana accepts only successful finalized native transfers from a transaction signer", async () => {
  const sender = "1".repeat(32),
    id = "2".repeat(88),
    recipient = donationNetwork("solana")!.address;
  const fixture = {
    slot: 123,
    meta: { err: null as unknown },
    transaction: {
      signatures: [id],
      message: {
        accountKeys: [{ pubkey: sender, signer: true }],
        instructions: [
          {
            programId: "11111111111111111111111111111111",
            parsed: {
              type: "transfer",
              info: { source: sender, destination: recipient, lamports: 20 },
            },
          },
        ],
      },
    },
  };
  const fetcher = (async (_url, init) => {
    const params = JSON.parse(String(init?.body)).params;
    assert.equal(params[1].commitment, "finalized");
    return json({ result: fixture });
  }) as typeof fetch;
  assert.equal((await verifyDonationTransfer("solana", id, sender, fetcher)).amountUnits, "20");
  fixture.meta.err = { failed: true };
  await assert.rejects(verifyDonationTransfer("solana", id, sender, fetcher));
  fixture.meta.err = null;
  fixture.transaction.message.accountKeys[0].signer = false;
  await assert.rejects(verifyDonationTransfer("solana", id, sender, fetcher));
});
test("TRON checks solidified successful TRX transfers and excludes token contracts", async () => {
  const id = "b".repeat(64),
    sender = "T" + "A".repeat(33),
    recipient = donationNetwork("tron")!.address;
  const contract = {
    type: "TransferContract",
    parameter: { value: { owner_address: sender, to_address: recipient, amount: 42 } },
  };
  const fixture = {
    txID: id,
    ret: [{ contractRet: "SUCCESS" }],
    raw_data: { contract: [contract] },
  };
  const fetcher = (async (url) => {
    assert.match(String(url), /walletsolidity/);
    return json(
      String(url).includes("gettransactioninfobyid") ? { id, blockNumber: 123 } : fixture,
    );
  }) as typeof fetch;
  assert.equal((await verifyDonationTransfer("tron", id, sender, fetcher)).amountUnits, "42");
  contract.type = "TriggerSmartContract";
  await assert.rejects(verifyDonationTransfer("tron", id, sender, fetcher));
});
test("claim input rejects network mismatches, receiving addresses as senders and invalid hashes", () => {
  assert.equal(claimInput("ethereum", tx.toUpperCase().replace("0X", "0x"), evmSender).txId, tx);
  assert.throws(() => claimInput("ethereum", tx, donationNetwork("ethereum")!.address));
  assert.throws(() => claimInput("bitcoin", tx, evmSender));
  assert.throws(() => claimInput("unknown", tx, evmSender));
});
