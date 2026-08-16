-- ============================================================
--  SATYAM GOLD  —  Transactions table (Atta / Sattu / Besan / Chokar mill)
--  इसको Adminer के "SQL command" box में paste करके Execute करें
-- ============================================================

CREATE TABLE IF NOT EXISTS transactions (
    id              BIGSERIAL       PRIMARY KEY,
    customer_name   TEXT            NOT NULL,
    mobile_number   TEXT,
    items           JSONB           NOT NULL DEFAULT '[]'::jsonb,
    total_amount    NUMERIC(12,2)   NOT NULL DEFAULT 0,
    due_amount      NUMERIC(12,2)   NOT NULL DEFAULT 0,
    pdf_receipt_url TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- history page तेज़ी से latest bill दिखा सके इसलिए
CREATE INDEX IF NOT EXISTS transactions_created_at_idx
    ON transactions (created_at DESC);
