import type { DonationNetworkId } from "./donation-config";
interface Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
}
interface SolProvider {
  connect(): Promise<unknown>;
  publicKey?: { toString(): string };
  signMessage(message: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array }>;
}
interface TronProvider {
  defaultAddress?: { base58?: string };
  trx: { signMessageV2(message: string): Promise<string> };
}
type WalletWindow = Window & {
  ethereum?: Provider;
  solana?: SolProvider;
  tronWeb?: TronProvider;
  tronLink?: Provider;
  trustwallet?: { ethereum?: Provider; solana?: SolProvider };
};
export async function connectDonationWallet(network: DonationNetworkId) {
  const win = window as WalletWindow;
  if (network === "ethereum" || network === "bnb") {
    const provider = win.trustwallet?.ethereum ?? win.ethereum;
    if (!provider)
      throw new Error(
        "Open this game in your wallet browser or install its extension. You can also paste a signed message below.",
      );
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (!Array.isArray(accounts) || typeof accounts[0] !== "string")
      throw new Error("No sending wallet account was selected.");
    return accounts[0];
  }
  if (network === "solana") {
    const provider = win.trustwallet?.solana ?? win.solana;
    if (!provider)
      throw new Error(
        "Open this game in a Solana wallet browser, or paste its signed message below.",
      );
    await provider.connect();
    if (!provider.publicKey) throw new Error("No Solana wallet account was selected.");
    return provider.publicKey.toString();
  }
  if (network === "tron") {
    if (win.tronLink) await win.tronLink.request({ method: "tron_requestAccounts" });
    const sender = win.tronWeb?.defaultAddress?.base58;
    if (!sender)
      throw new Error(
        "Use a TRON wallet with message signing, or paste a TRON V2 signature below.",
      );
    return sender;
  }
  throw new Error(
    "For Bitcoin, enter the sending address and paste its BIP-322 or legacy message signature below. Check that your wallet supports message signing before donating.",
  );
}
export async function signDonationMessage(
  network: DonationNetworkId,
  sender: string,
  message: string,
) {
  const win = window as WalletWindow;
  const current = await connectDonationWallet(network);
  if (
    network === "ethereum" || network === "bnb"
      ? current.toLowerCase() !== sender.toLowerCase()
      : current !== sender
  )
    throw new Error("Select the wallet address that sent this donation.");
  if (network === "ethereum" || network === "bnb") {
    const hex = [...new TextEncoder().encode(message)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    return String(
      await (win.trustwallet?.ethereum ?? win.ethereum)!.request({
        method: "personal_sign",
        params: ["0x" + hex, sender],
      }),
    );
  }
  if (network === "solana") {
    const result = await (win.trustwallet?.solana ?? win.solana)!.signMessage(
      new TextEncoder().encode(message),
      "utf8",
    );
    return btoa(String.fromCharCode(...result.signature));
  }
  if (network === "tron") return win.tronWeb!.trx.signMessageV2(message);
  throw new Error("Paste your Bitcoin message signature below.");
}
