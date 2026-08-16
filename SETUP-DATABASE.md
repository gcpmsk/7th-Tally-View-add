# ☁️ Cloud Bills — PostgreSQL Setup (पूरी गाइड)

इस app में bills अब **PostgreSQL database** में save होंगे और website पर **पुरानी history** दिखेगी।

नई files:

| File | काम |
|---|---|
| `schema.sql` | Adminer में paste करने वाला `CREATE TABLE` |
| `functions/api/submit.js` | **POST** `/api/submit` — नया bill insert |
| `functions/api/history.js` | **GET** `/api/history` — पुरानी history fetch |
| `cloud.js` | Frontend JS (fetch API) — submit + history table |
| `index.html` | नया tile **☁️ Cloud Bills** + form + history table |
| `package.json` | `postgres` driver (Cloudflare इसे अपने-आप install करेगा) |
| `devserver.mjs` | सिर्फ़ local testing के लिए (Cloudflare पर ज़रूरत नहीं) |

---

# STEP 1 — Adminer में SQL paste करें

आपकी screen पर Adminer खुला है: `140.245.7.25:5051`

1. बाईं तरफ़ ऊपर **DB: `postgres`** चुना हुआ है — वही रहने दें
2. **Schema: `public`** चुना हुआ है — वही रहने दें
3. बाईं sidebar में **`SQL command`** link पर click करें
   (यह `Import` / `Export` / `Create table` के बग़ल में सबसे ऊपर है)
4. जो बड़ा खाली box खुलेगा उसमें **नीचे वाला पूरा text copy करके paste करें**
5. नीचे **`Execute`** button दबाएँ

### 👇 यही paste करना है (पूरा, ज्यों का त्यों)

```sql
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

CREATE INDEX IF NOT EXISTS transactions_created_at_idx
    ON transactions (created_at DESC);
```

✅ सही चलने पर हरे रंग में `Query executed OK` जैसा message आएगा
और बाईं sidebar की table list में **`transactions`** दिखने लगेगा
(list अभी 28 tables दिखा रही है — refresh के बाद 29 हो जाएगी)।

### Column किसलिए है

| Column | Type | क्या रखेगा |
|---|---|---|
| `id` | BIGSERIAL | Bill number — अपने-आप 1,2,3… बढ़ेगा |
| `customer_name` | TEXT | ग्राहक का नाम (हिंदी भी चलेगा) |
| `mobile_number` | TEXT | मोबाइल (TEXT इसलिए कि आगे `0` न कटे) |
| `items` | JSONB | Atta/Sattu/Besan/Chokar की पूरी detail — qty, unit, rate, amount सब |
| `total_amount` | NUMERIC(12,2) | कुल रक़म (पैसे समेत) |
| `due_amount` | NUMERIC(12,2) | बक़ाया |
| `pdf_receipt_url` | TEXT | PDF का सिर्फ़ **link** (file cloud storage में) |
| `created_at` | TIMESTAMPTZ | **तारीख़ + समय दोनों**, timezone समेत — कुछ भी miss नहीं होगा |

> **समय क्यों पूरा सही रहेगा:** `TIMESTAMPTZ` तारीख़ + घंटा + मिनट + सेकंड + timezone सब रखता है।
> Website form में जो समय आप चुनेंगे वही save होगा, और history में IST (भारतीय समय) में
> `16/08/2026 05:25:31 pm` की तरह दिखेगा।

---

# STEP 2 — Cloudflare में DATABASE_URL डालें

Cloudflare Dashboard खोलें → **Workers & Pages** → अपना Pages project चुनें →
**Settings** → **Environment variables** → **Add variable**

| खाना | क्या भरें |
|---|---|
| Variable name | `DATABASE_URL` |
| Value | `postgresql://postgres:आपका_असली_password@140.245.7.25:5432/postgres` |
| Type | **Secret** ⬅ ज़रूरी (Encrypt करें, ताकि password छिपा रहे) |
| Environment | **Production** (और चाहें तो Preview में भी वही डालें) |

फिर **Save** दबाएँ।

> ⚠️ Password में अगर `@ : / # ?` जैसा कोई चिह्न है तो उसे URL-encode करें
> (जैसे `@` → `%40`, `#` → `%23`)। Password सिर्फ़ यहीं जाएगा — code या GitHub में कहीं नहीं है।

**बहुत ज़रूरी:** Environment variable save करने के बाद
**Deployments** tab → सबसे ऊपर वाली deployment के आगे **⋯** → **Retry deployment**
दबाएँ। नई value तभी लागू होगी।

---

# STEP 3 — अपने PostgreSQL server पर बाहर से connection allow करें

आपका Postgres एक IP (`140.245.7.25`) पर है, इसलिए Cloudflare को उससे जुड़ने देना होगा।
Server पर ये तीन चीज़ें एक बार कर लें:

**(a)** `postgresql.conf` में —
```
listen_addresses = '*'
```

**(b)** `pg_hba.conf` में सबसे नीचे —
```
hostssl  all  all  0.0.0.0/0  scram-sha-256
```

**(c)** फिर restart —
```
sudo systemctl restart postgresql
```

साथ ही firewall / Oracle-AWS Security Group में **port 5432** inbound खोलें।

> 🔒 सुरक्षित तरीक़ा: `postgres` superuser की जगह एक अलग user बनाएँ —
> ```sql
> CREATE USER millapp WITH PASSWORD 'कोई_मज़बूत_password';
> GRANT SELECT, INSERT ON transactions TO millapp;
> GRANT USAGE, SELECT ON SEQUENCE transactions_id_seq TO millapp;
> ```
> और `DATABASE_URL` में `postgres:` की जगह `millapp:` लगाएँ।

---

# STEP 4 — Cloudflare Pages build setting

Pages project → **Settings** → **Builds & deployments**:

| Setting | Value |
|---|---|
| Build command | *(खाली छोड़ दें)* |
| Build output directory | `/` |
| Root directory | `/` |

`package.json` repo में है, इसलिए Cloudflare `postgres` driver अपने-आप install कर लेगा।
`functions/` folder अपने-आप detect होकर API बन जाएगा — कुछ अलग नहीं करना।

---

# STEP 5 — Test करें

Deploy पूरा होने के बाद:

1. अपनी site खोलें → login करें
2. Home पर नया नीला tile **☁️ Cloud Bills** दबाएँ
3. नाम, mobile, items (Atta/Sattu/Besan/Chokar), rate भरें —
   **amount और total अपने-आप जुड़ जाएगा**
4. PDF URL डालें (जो cloud storage से मिला) → **💾 Database में Save करें**
5. नीचे **📜 पुरानी History** में bill तुरंत आ जाएगा — PDF link click करके खुल जाएगा

सीधे API भी check कर सकते हैं — browser में:
```
https://आपकी-site.pages.dev/api/history
```
JSON दिखे तो सब सही है। `DATABASE_URL not set` दिखे तो STEP 2 दोबारा देखें।

---

# (Optional) Hyperdrive — और तेज़ करने के लिए

Cloudflare Hyperdrive connection pooling करके API को काफ़ी तेज़ कर देता है।
Code में यह **पहले से support है** — Hyperdrive मिला तो वही, वरना `DATABASE_URL`।

1. Cloudflare Dashboard → **Storage & Databases → Hyperdrive → Create configuration**
2. वही connection string डालें
3. Pages project → **Settings → Functions → Hyperdrive bindings** → **Add binding**
   - Variable name: `HYPERDRIVE`
   - अपनी बनाई configuration चुनें
4. Redeploy करें

---

# API reference (छोटा सा)

### POST `/api/submit`
```json
{
  "customer_name": "राम कुमार",
  "mobile_number": "9631816666",
  "items": [
    { "name": "Atta",   "qty": 2, "unit": "बोरा", "rate": 1250, "amount": 2500 },
    { "name": "Chokar", "qty": 1, "unit": "बोरा", "rate": 800,  "amount": 800  }
  ],
  "total_amount": 3300,
  "due_amount": 500,
  "pdf_receipt_url": "https://.../receipt-101.pdf",
  "created_at": "2026-08-16T05:25:31+05:30"
}
```
जवाब → `201` + `{ "ok": true, "row": { ...पूरी saved row... } }`
(`created_at` न भेजें तो server अपने-आप उसी वक़्त का समय लगा देगा)

### GET `/api/history`
| Query | काम |
|---|---|
| `?limit=200` | कितनी rows (default 200, max 1000) |
| `?offset=0` | pagination |
| `?q=राम` | नाम या mobile से खोज |
| `?from=2026-08-01` | इस तारीख़ से (भारतीय समय के हिसाब से) |
| `?to=2026-08-31` | इस तारीख़ तक |

जवाब → `{ "ok": true, "count": 12, "rows": [ … ] }` — नया bill सबसे ऊपर।

---

# Local test (चाहें तो)

```bash
npm install
DATABASE_URL="postgresql://user:pass@140.245.7.25:5432/postgres" node devserver.mjs
# फिर browser में http://localhost:8788
```

---

# छोटी checklist

- [ ] Adminer → SQL command → ऊपर वाला SQL → Execute
- [ ] Cloudflare → Settings → Environment variables → `DATABASE_URL` (Secret)
- [ ] Deployments → Retry deployment
- [ ] Postgres server: `listen_addresses='*'` + `pg_hba.conf` + port 5432 खुला
- [ ] Site खोलकर ☁️ Cloud Bills में एक test bill save करें
