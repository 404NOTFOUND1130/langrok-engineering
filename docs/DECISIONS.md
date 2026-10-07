# Engineering decisions

Written as lightweight ADRs: context, decision, consequences. Dates are approximate.

---

## 1. One router, one serverless function

**Context.** Twelve files under `api/`, twenty lines each, all doing the same four things (refuse non-POST, pull fields, attach identity, return JSON). The hosting plan allows exactly twelve functions. Two deployments were refused *after* a clean build, at "Deploying outputs". The next feature (a signing endpoint for object storage) would have been the thirteenth, and the design had already started bending: fetching a recording was folded into the snapshot route behind `want: 'bytes'` to stay under the cap.

**Decision.** A single Hono app mounts every `/api/*` route. The dev server (Vite middleware) and the production function mount the *same* router, so there is one definition of the routes instead of two lists that drift.

**Consequences.** No ceiling on routes. Cold starts could have gotten worse (loading Stripe, the video extractor and the speech client to answer a request that wanted none of them), so every route `import()`s its handler at call time — cost stays proportional to what was asked for.

---

## 2. The AI proxy assumes it is a free relay under attack

**Context.** `/api/ai` spends our provider key. Anything the browser can call, a script can call faster.

**Decision.** Every request is clamped server-side regardless of what the client sent: origin allowlist, sliding-window rate limit with *named buckets* (so transcribing a 40-minute episode cannot lock the reader out of every AI panel), model allow-list, token ceiling, payload size, JWT verification, and per-user metering.

**Consequences.** Rate limiting is in-memory, therefore per-instance on serverless: a heavy user gets a fresh window on every cold start. It is a burst throttle, not a budget. The budget lives in decision 3.

---

## 3. The real quota lives in Postgres and fails open

**Context.** See above: in-memory counters cannot protect a monthly bill.

**Decision.** One RPC, `increment_ai_usage`, counts the call and returns the running total atomically, called with the service-role key. The user's plan is read from `user_settings.plan`, which only the Stripe webhook writes — server-side truth, never the client's word. On *any* accounting error (missing key, network, missing table) the call is allowed and a `console.warn` is emitted.

**Consequences.** A bookkeeping outage costs at most a day of unmetered calls, bounded by the provider's spend cap. Refusing everyone because our own table was down would cost more. Every open failure is visible in function logs.

---

## 4. Isolation is the database's job

**Context.** A library of personal documents, audio and vocabulary per user.

**Decision.** Row-level security on every user-owned table (`materials`, `user_settings`, `vocab`, `events`, `ai_usage`, …) and on the private `audio` storage bucket. Policies are `select / insert / update / delete` per table, keyed on `auth.uid()`. The schema script is idempotent and re-runnable.

**Consequences.** The client can be fully compromised and still only reach its own rows. Server-side jobs that must cross users (analytics sink, Stripe webhook, quota RPC) use the service-role key explicitly, which makes the privileged paths easy to list.

---

## 5. Feature flags are enforced on the server

**Context.** Listening (podcast transcription) shipped, then the transcription host turned out to bill *seconds of audio per hour for the whole key*: 7,200 on the free tier, an episode costs ~1,200, paid tiers were closed. Six episodes per hour for everyone combined — not "sometimes slow", broken for the seventh person.

**Decision.** One list (`shipped.js`) decides what is on the shelf. Adding or removing a key brings back or removes the nav link, home card, landing card, library chip, import tab and route together. The same list is read **server-side**: `/api/transcribe` answers `503 feature_paused` while listening is off, so an already-open tab cannot keep spending the quota. `VITE_SHIPPED=all` builds a staging version with every door open.

**Consequences.** Nothing was deleted; the feature returns with one key when a paid tier exists. Hiding a button is not the same as turning a feature off, and the code now says so.

---

## 6. Provider-agnostic AI layer

**Context.** DeepSeek was the first provider. A mainland-China deployment or a provider outage should not be a rewrite.

**Decision.** The proxy targets any OpenAI-compatible chat-completions API, chosen by `AI_BASE_URL` / `AI_MODEL` / `AI_VISION_MODEL`, with sensible fallbacks so an existing deployment keeps working with zero new env. Provider-specific parameters (DeepSeek's thinking switch) are only sent to the default provider, because strict implementations reject unknown fields.

**Consequences.** Switching providers is configuration. The vision model falls back to the text model when the provider is overridden, since a DeepSeek vision id would be meaningless elsewhere.

---

## 7. SQL before dashboards

**Context.** After launch, the questions that matter are few and specific: signups, time to first read, retention, imports that fail, AI cost per user, paid plans, reasons for account deletion.

**Decision.** `supabase/ops.sql`: only `SELECT`s, grouped by question, pasted section by section into the SQL editor. No admin UI until three of these queries have become a daily reflex — they are what will write its spec.

**Consequences.** Zero admin code to maintain before there is anything to administer.
