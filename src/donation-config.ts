export const donationNetworks = [
  {
    id: "bnb",
    name: "BNB Smart Chain",
    symbol: "BNB",
    decimals: 18,
    address: "0x947fF43ca7A9db60608Adf40cddcD6Af99e21104",
    confirmations: 15,
    explorer: "https://bscscan.com/tx/",
  },
  {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    decimals: 8,
    address: "bc1qnjnqfyd8l82yshxsc8w502v0wuz3pan63hdqhn",
    confirmations: 3,
    explorer: "https://mempool.space/tx/",
  },
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    address: "0x947fF43ca7A9db60608Adf40cddcD6Af99e21104",
    confirmations: 12,
    explorer: "https://etherscan.io/tx/",
  },
  {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
    address: "2uVTELbVrQMUpiBXZpR6prUqgTkFbpcf38vubjh242Y9",
    confirmations: 1,
    explorer: "https://solscan.io/tx/",
  },
  {
    id: "tron",
    name: "TRON",
    symbol: "TRX",
    decimals: 6,
    address: "TYoTiv3eNpzfEgZg1f3o326DwJLJdiZFQC",
    confirmations: 1,
    explorer: "https://tronscan.org/#/transaction/",
  },
] as const;
export type DonationNetwork = (typeof donationNetworks)[number];
export type DonationNetworkId = DonationNetwork["id"];
export const supporterCharacters = ["cinder-crown", "solar-wraith"] as const;
export function isSupporterCharacter(id: string) {
  return (supporterCharacters as readonly string[]).includes(id);
}
export function donationNetwork(id: unknown) {
  return donationNetworks.find((n) => n.id === id);
}
export function formatDonation(units: string, decimals: number) {
  const value = BigInt(units),
    scale = 10n ** BigInt(decimals);
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return (value / scale).toString() + (fraction ? "." + fraction : "");
}
