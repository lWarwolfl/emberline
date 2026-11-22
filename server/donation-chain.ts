import { donationNetwork, type DonationNetworkId } from "../src/donation-config";
export class DonationError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as ObjectValue) : {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
function integer(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new DonationError(503, "The chain service returned an invalid amount. Try again later.");
  return BigInt(value as number);
}
function hex(value: unknown) {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value))
    throw new DonationError(503, "The chain service returned incomplete data. Try again later.");
  return BigInt(value);
}
const same = (a: unknown, b: string) =>
  typeof a === "string" && a.toLowerCase() === b.toLowerCase();
export function claimInput(networkValue: unknown, txValue: unknown, senderValue: unknown) {
  const network = donationNetwork(networkValue);
  if (!network) throw new DonationError(400, "Choose a supported network.");
  const txId = typeof txValue === "string" ? txValue.trim() : "";
  const sender = typeof senderValue === "string" ? senderValue.trim() : "";
  const evm = network.id === "bnb" || network.id === "ethereum";
  const txPattern =
    network.id === "solana"
      ? /^[1-9A-HJ-NP-Za-km-z]{80,90}$/
      : evm
        ? /^0x[0-9a-fA-F]{64}$/
        : /^[0-9a-fA-F]{64}$/;
  const senderPattern = evm
    ? /^0x[0-9a-fA-F]{40}$/
    : network.id === "solana"
      ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
      : network.id === "tron"
        ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/
        : /^(bc1[ac-hj-np-z02-9]{11,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/;
  if (!txPattern.test(txId) || !senderPattern.test(sender))
    throw new DonationError(
      400,
      "Check the transaction ID and sending wallet address for this network.",
    );
  if (evm ? same(sender, network.address) : sender === network.address)
    throw new DonationError(
      400,
      "Use the wallet that sent the donation, not the receiving wallet.",
    );
  return {
    network,
    txId: network.id === "solana" ? txId : txId.toLowerCase(),
    sender: evm ? sender.toLowerCase() : sender,
  };
}
export type ChainFetch = typeof fetch;
async function read(
  url: string,
  body: unknown,
  fetcher: ChainFetch,
  headers: Record<string, string> = {},
) {
  try {
    const response = await fetcher(url, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(7000),
      redirect: "error",
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("upstream");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("empty");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2500000) throw new Error("large");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const text = Buffer.concat(chunks).toString("utf8");
    return JSON.parse(text) as unknown;
  } catch {
    throw new DonationError(
      503,
      "The blockchain verification service is busy or unavailable. Your payment is safe; retry this transaction ID later.",
    );
  }
}
async function rpc(url: string, method: string, params: unknown[], fetcher: ChainFetch) {
  const data = object(await read(url, { jsonrpc: "2.0", id: 1, method, params }, fetcher));
  if (data.error || !("result" in data))
    throw new DonationError(
      503,
      "The blockchain service could not verify this payment. Please retry later.",
    );
  return data.result;
}
const pending = () =>
  new DonationError(
    409,
    "Payment is not confirmed enough yet. Wait a little, then verify the same transaction ID again.",
  );
const unmatched = () =>
  new DonationError(
    400,
    "No supported direct native-coin payment from this sending wallet to the donation address was found. Check the network and transaction ID.",
  );

export async function verifyDonationTransfer(
  id: DonationNetworkId,
  txId: string,
  sender: string,
  fetcher: ChainFetch = fetch,
) {
  const network = donationNetwork(id)!;
  let units = 0n;
  let block: string;
  if (id === "ethereum" || id === "bnb") {
    const url =
      (id === "ethereum" ? process.env.DONATION_ETH_RPC : process.env.DONATION_BNB_RPC) ||
      (id === "ethereum"
        ? "https://ethereum-rpc.publicnode.com"
        : "https://bsc-dataseed.bnbchain.org");
    const chain = await rpc(url, "eth_chainId", [], fetcher);
    if (hex(chain) !== (id === "ethereum" ? 1n : 56n))
      throw new DonationError(
        503,
        "Donation RPC is on the wrong network. Contact the game creator.",
      );
    const [rawTx, rawReceipt, rawHeight] = await Promise.all([
      rpc(url, "eth_getTransactionByHash", [txId], fetcher),
      rpc(url, "eth_getTransactionReceipt", [txId], fetcher),
      rpc(url, "eth_blockNumber", [], fetcher),
    ]);
    if (!rawTx || !rawReceipt) throw pending();
    const tx = object(rawTx),
      receipt = object(rawReceipt);
    if (
      !same(tx.hash, txId) ||
      !same(receipt.transactionHash, txId) ||
      !same(tx.from, sender) ||
      !same(tx.to, network.address) ||
      !same(receipt.from, sender) ||
      !same(receipt.to, network.address)
    )
      throw unmatched();
    if (hex(receipt.status) !== 1n)
      throw new DonationError(
        400,
        "This transaction failed on the blockchain and cannot unlock rewards.",
      );
    if (!tx.blockNumber || !receipt.blockNumber) throw pending();
    if (
      hex(tx.blockNumber) !== hex(receipt.blockNumber) ||
      tx.blockHash !== receipt.blockHash ||
      typeof receipt.blockHash !== "string"
    )
      throw pending();
    if (hex(rawHeight) - hex(receipt.blockNumber) + 1n < BigInt(network.confirmations))
      throw pending();
    const canonical = object(
      await rpc(url, "eth_getBlockByNumber", [receipt.blockNumber, false], fetcher),
    );
    if (canonical.hash !== receipt.blockHash) throw pending();
    units = hex(tx.value);
    block = String(receipt.blockHash);
  } else if (id === "bitcoin") {
    const base = (process.env.DONATION_BTC_API || "https://blockstream.info/api").replace(
      /\/$/,
      "",
    );
    const raw = await read(base + "/tx/" + txId, undefined, fetcher);
    if (!raw) throw pending();
    const tx = object(raw),
      status = object(tx.status);
    if (tx.txid !== txId) throw unmatched();
    if (!status.confirmed) throw pending();
    const height = await read(base + "/blocks/tip/height", undefined, fetcher);
    if (integer(height) - integer(status.block_height) + 1n < 3n) throw pending();
    const inputs = array(tx.vin);
    // Mixed-sender/CoinJoin and exchange withdrawals cannot prove sole donor ownership.
    if (
      !inputs.length ||
      !inputs.every((v) => object(object(v).prevout).scriptpubkey_address === sender)
    )
      throw unmatched();
    for (const v of array(tx.vout)) {
      const out = object(v);
      if (out.scriptpubkey_address === network.address) units += integer(out.value);
    }
    if (typeof status.block_hash !== "string") throw pending();
    block = status.block_hash;
  } else if (id === "solana") {
    const url = process.env.DONATION_SOL_RPC || "https://api.mainnet-beta.solana.com";
    const raw = await rpc(
      url,
      "getTransaction",
      [
        txId,
        { encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 0 },
      ],
      fetcher,
    );
    if (!raw) throw pending();
    const tx = object(raw),
      meta = object(tx.meta),
      transaction = object(tx.transaction),
      message = object(transaction.message);
    if (meta.err !== null) throw new DonationError(400, "This Solana transaction did not succeed.");
    if (array(transaction.signatures)[0] !== txId) throw unmatched();
    if (
      !array(message.accountKeys).some(
        (k) => object(k).pubkey === sender && object(k).signer === true,
      )
    )
      throw unmatched();
    for (const rawInstruction of array(message.instructions)) {
      const instruction = object(rawInstruction),
        parsed = object(instruction.parsed),
        info = object(parsed.info);
      if (
        instruction.programId === "11111111111111111111111111111111" &&
        parsed.type === "transfer" &&
        info.source === sender &&
        info.destination === network.address
      )
        units += integer(info.lamports);
    }
    block = String(integer(tx.slot));
  } else {
    const base = (process.env.DONATION_TRON_API || "https://api.trongrid.io").replace(/\/$/, "");
    const headers: Record<string, string> = process.env.TRONGRID_API_KEY
      ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY }
      : {};
    const [rawTx, rawInfo] = await Promise.all([
      read(
        base + "/walletsolidity/gettransactionbyid",
        { value: txId, visible: true },
        fetcher,
        headers,
      ),
      read(
        base + "/walletsolidity/gettransactioninfobyid",
        { value: txId, visible: true },
        fetcher,
        headers,
      ),
    ]);
    const tx = object(rawTx),
      info = object(rawInfo);
    if (!tx.txID || !info.id) throw pending();
    if (tx.txID !== txId || info.id !== txId) throw unmatched();
    if (object(array(tx.ret)[0]).contractRet !== "SUCCESS")
      throw new DonationError(400, "This TRON transaction did not succeed.");
    const contracts = array(object(tx.raw_data).contract);
    for (const rawContract of contracts) {
      const contract = object(rawContract),
        value = object(object(contract.parameter).value);
      if (
        contract.type === "TransferContract" &&
        value.owner_address === sender &&
        value.to_address === network.address
      )
        units += integer(value.amount);
    }
    block = String(integer(info.blockNumber));
  }
  if (units <= 0n) throw unmatched();
  return {
    network: id,
    txId,
    sender,
    recipient: network.address,
    asset: network.symbol,
    amountUnits: units.toString(),
    decimals: network.decimals,
    blockReference: block,
  };
}
