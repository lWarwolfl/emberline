export const donationSchema = `
CREATE TABLE IF NOT EXISTS emberline_donation (
 id BIGSERIAL PRIMARY KEY,
 user_id TEXT REFERENCES emberline_user(id) ON DELETE SET NULL,
 username TEXT NOT NULL,
 donor_name TEXT NOT NULL CHECK (char_length(donor_name) <= 80),
 email TEXT CHECK (char_length(email) <= 254),
 network TEXT NOT NULL CHECK (network IN ('bnb','bitcoin','ethereum','solana','tron')),
 tx_id TEXT NOT NULL,
 sender TEXT NOT NULL,
 recipient TEXT NOT NULL,
 asset TEXT NOT NULL,
 amount_units NUMERIC(78,0) NOT NULL CHECK (amount_units > 0),
 decimals SMALLINT NOT NULL CHECK (decimals BETWEEN 0 AND 18),
 block_reference TEXT NOT NULL,
 verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE (network,tx_id)
);
CREATE INDEX IF NOT EXISTS emberline_donation_user ON emberline_donation(user_id);
CREATE TABLE IF NOT EXISTS emberline_donation_challenge (
 user_id TEXT PRIMARY KEY REFERENCES emberline_user(id) ON DELETE CASCADE,
 nonce TEXT NOT NULL UNIQUE,
 network TEXT NOT NULL,
 tx_id TEXT NOT NULL,
 sender TEXT NOT NULL,
 message TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 used_at TIMESTAMPTZ
);
`;
