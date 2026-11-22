# Donations and Flamebound rewards

The hosted game accepts direct **native-coin** donations on five mainnets: BNB
Smart Chain (BNB), Bitcoin (BTC), Ethereum (ETH), Solana (SOL), and TRON (TRX).
Receiving addresses are in `src/donation-config.ts`. These are public receiving
addresses. The app never needs the creator's private keys or recovery phrase.
USDT, USDC, other tokens, internal contract transfers, exchange withdrawals, and
mixed-sender Bitcoin transactions do not qualify for automatic claims.

Any verified positive amount permanently unlocks **both Cinder Crown and Solar
Wraith** for the claiming account. There are no tiers or gameplay advantages.
The wardrobe shows locked previews and opens DONATE for exclusive items.

## Player flow

1. Open the amber DONATE button and log in/create an account.
2. Choose the exact coin/network; copy or scan its receiving address. Send any
   positive amount from a wallet that supports message signing. Network fees are
   separate. Check signing support **before** sending.
3. Paste the transaction ID and the sending wallet address. The name defaults to
   the username. Supporter name and contact email are optional; email does not
   change account login and is not published.
4. Prepare the claim message. It contains this website, account ID, network,
   transaction, sender, random nonce, and a ten-minute expiry. Sign the exact
   message with the sending wallet, then VERIFY & UNLOCK BOTH SKINS.
5. Equip either skin in the donation dialog or wardrobe. Log into the same
   account elsewhere to restore the verified entitlement.

Ethereum/BNB browser wallets use `personal_sign`, Solana uses Ed25519
`signMessage`, and compatible TRON browser wallets use `signMessageV2` (TIP-191).
All networks have a manual signature field. Bitcoin accepts Base64 BIP-322 simple
proofs for supported single-key addresses and compatible legacy message proofs.
Bitcoin browser signing is intentionally manual because provider APIs differ.
A wallet without message signing cannot claim. Never paste private keys into a
message tool. A signature is ownership proof, not another payment.

## Verification and persistence

Only the server checks transfers and grants rewards. Public transaction IDs are
not ownership proof. The sender signature must verify against the exact account
challenge. Challenges are account-scoped and single-use; a new challenge replaces
the previous one. API mutations reuse the account route's origin/header checks,
authentication, request-size bounds, and database rate limits. Donation attempts
also have per-account and per-IP limits.

- Ethereum: chain ID 1, successful direct ETH transfer to the configured address,
  matching sender, receipt/transaction/block hash, canonical block, 12 confirmations.
- BNB: the same native-transfer checks on chain ID 56, 15 confirmations.
- Bitcoin: confirmed received outputs to the configured address, three
  confirmations, all input addresses matching the signing wallet. CoinJoin,
  mixed-sender payments and exchange withdrawals cannot establish sole ownership.
- Solana: finalized successful transaction; a signer must make the direct System
  Program SOL transfer. SPL token transfers are excluded.
- TRON: successful native `TransferContract` from the configured sender/recipient
  through the solidified-node endpoints. TRC-20 transfers are excluded.

Amounts come from on-chain data, never the form. Integer base units are stored as
PostgreSQL `NUMERIC(78,0)` and decimal counts; the app formats decimal strings
without floating point. Unsafe numeric RPC responses fail closed.

`npm run db:migrate` additively creates `emberline_donation` and
`emberline_donation_challenge`. The ledger stores account ID, username snapshot,
supporter name, optional email, network, transaction ID, sender, recipient, asset,
exact amount, decimals, block reference, and verification time. A unique
`(network, tx_id)` constraint prevents double claims. Consuming the challenge and
inserting the ledger row are atomic. Reclaiming with a new valid proof for the
same account is idempotent; another account cannot claim that payment.

Donor ownership is derived from verified ledger rows, not uploaded saves or earned
coins. Signing out removes that account's entitlement from memory. Progress reset
cannot delete verified donations. Online login is required to restore entitlements
after a fresh page load; the underlying local game remains playable offline.
As with all client-rendered games, someone modifying the game code can alter their
own local appearance; that does not create a verified donation or account reward.

Only the signed-in user's last 50 verified donations are exposed by the API.
There is no public donor list or client admin endpoint. To inspect records as the
DB owner (email is private), use:

```sql
SELECT username, donor_name, email, network, asset,
       amount_units / power(10::numeric, decimals) AS donated_amount,
       tx_id, verified_at
FROM emberline_donation
ORDER BY verified_at DESC;
```

Deleting an account detaches its ledger rows while retaining the recorded
username/name/email. Handle data erasure requests explicitly; there is no automatic
emailing, marketing consent, analytics, or third-party payment processor.

## Free services and deployment

Default read-only endpoints require no payment or private key:

| Network  | Default service              | Free option and limitations                                                                                         |
| -------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Ethereum | PublicNode Ethereum RPC      | Public free endpoint; provider limits/availability apply. Alchemy also offers a free Node API tier.                 |
| BNB      | BNB Chain public RPC         | Official endpoint; documented request limits. Receipt lookup avoids disabled bulk log queries.                      |
| Bitcoin  | Blockstream Esplora          | Public API, subject to service availability/rate limits.                                                            |
| Solana   | Solana public mainnet RPC    | Public and rate-limited; production use should use an appropriate private/free-tier provider.                       |
| TRON     | TronGrid solidified-node API | Free tier exists; production requests should include a free API key. Unkeyed requests may be throttled or rejected. |

All five endpoints responded to read-only probes during implementation. This is
not an uptime guarantee from Vercel or every geography. Free verification is
possible within provider quotas; blockchain fees and existing hosting/database
charges remain separate. No paid processor is required, and no paid plan is
automatically enabled. A quota failure leaves rewards locked and allows retrying
the same paid transaction later. There is no background chain-scanning service:
verification happens when the signed-in donor submits a claim.

Optional **server-only** environment variables can replace the default endpoints:
`DONATION_ETH_RPC`, `DONATION_BNB_RPC`, `DONATION_BTC_API` (Esplora base URL),
`DONATION_SOL_RPC`, `DONATION_TRON_API` (TRON base URL), and `TRONGRID_API_KEY`.
Use mainnet services only. Keep API-key-bearing URLs out of client configuration.
Create a free TronGrid key and add it to Vercel for dependable production access;
check its current quota in the provider dashboard. Other free-tier keys can be
used in the optional endpoint variables if public RPC availability is insufficient.

Deploy with the existing Better Auth/Neon configuration and run the additive
migration before enabling the new API. Vercel includes the generated server-only
`server/bitcoin-proof.cjs` verifier. `npm run build` bundles its ESM dependencies
into CommonJS so the serverless loader does not repeat the previous ESM crash.
It is not copied into the public game assets. The browser bundle contains no
server signature libraries, RPC credentials, database access or private keys.

## Sources checked

- [Alchemy free Node API tier and limits](https://www.alchemy.com/docs/reference/pricing-plans)
- [PublicNode free Ethereum endpoint](https://ethereum.publicnode.com/)
- [BNB public RPC endpoints and limits](https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/)
- [Blockstream Esplora API](https://github.com/Blockstream/esplora/blob/master/API.md)
- [Solana clusters and public RPC limitations](https://solana.com/docs/references/clusters)
- [Solana transaction lookup](https://solana.com/docs/rpc/http/gettransaction)
- [TronGrid free tier](https://www.trongrid.io/price)
- [TronGrid production rate-limit guidance](https://developers.tron.network/reference/rate-limits)
- [TRON message signing](https://docs.tronlink.org/dapp/message-signing/)
- [BIP-322 signature verifier](https://github.com/ACken2/bip322-js)

## Verification

`npm run check` covers signature proofs, chain success/failure/mismatch fixtures,
exact amounts, client entitlement gates, platform changes, and the existing suite.
The Bitcoin proof also runs in Node with ESM `require` disabled.

For the opt-in ledger/account integration against the configured DB:

```powershell
$env:EMBERLINE_TEST_DATABASE = '1'
node --import tsx --test tests/donations-db.test.ts tests/accounts.test.ts
Remove-Item Env:EMBERLINE_TEST_DATABASE
```

The donation test uses real signatures and a stubbed transfer lookup (no funds
sent), checks concurrency, replay, idempotency, cross-account uniqueness and exact
amount storage, and deletes its test accounts and donation rows. Never label this
as a real paid donation or a live-wallet end-to-end test. Browser wallet popups,
mobile fit and real donations require runtime verification; these were not run
under the standing no-live-browser restriction.
