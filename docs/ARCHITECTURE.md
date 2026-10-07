# Architecture (sanitized)

## Runtime shape

- **Client:** React 19 SPA built with Vite, installable as a PWA. Local cache in IndexedDB; document editing with BlockNote; PDF rendering with pdf.js; HEIC photos converted client-side.
- **API:** one Hono router deployed as a single Vercel serverless function; the same router is mounted as Vite middleware in development, so dev and prod share one route table.
- **Data:** Supabase Postgres with row-level security on every user-owned table, Supabase Auth (email, Google OAuth), a private storage bucket for audio; large media on Cloudflare R2.
- **Payments:** Stripe one-time purchase (subscriptions are not supported by Alipay/WeChat Pay on Stripe), webhook writes the plan server-side.
- **AI:** any OpenAI-compatible provider, chosen by environment; transcription via a second provider.

## Request path for `/api/ai`

```
browser ──POST /api/ai──▶ router.serve()
                           │ parse body defensively (sendBeacon can send a string)
                           │ identity from Authorization header, never from body
                           ▼
                        guard.originAllowed(origin)      → 403
                        guard.rateLimited(ip, bucket)    → 429
                        auth.verifyUser(token)           → 401
                        inviteGate (pre-launch access)   → 403
                        quota.checkAiQuota(user, plan)   → 429 (fails open on error)
                        shipped.LAUNCH[feature]          → 503 feature_paused
                           ▼
                        clamp: model ∈ allow-list, max_tokens ≤ ceiling, payload ≤ size
                        pick text vs vision model by presence of an image
                           ▼
                        provider fetch ──▶ response ──▶ noteAiCall() ──▶ JSON to client
```

## Server modules

28 modules under `server/`, one per external concern. The pattern is identical everywhere: a pure `proxyX({ ...fields, token, origin, ip })` function returning `{ status, body }`, testable with injected doubles, mounted by the router with a lazy `import()`.

| Concern | Module(s) |
|---|---|
| LLM text & vision | `aiProxy.js` |
| Speech, transcription, podcasts, video | `speechProxy.js`, `transcribeProxy.js`, `podcastProxy.js`, `videoProxy.js` |
| Article extraction & web search | `articleProxy.js`, `webSearchProxy.js`, `feedCheck.js` |
| Grammar, recommendations | `grammarProxy.js`, `recommendProxy.js` |
| Identity, access, quotas | `auth.js`, `guard.js`, `quota.js`, `inviteGate.js`, `inviteProxy.js` |
| Billing | `billingProxy.js`, `stripeHook.js` |
| Storage, snapshots, account | `r2.js`, `storeProxy.js`, `snapshotProxy.js`, `accountProxy.js` |
| Analytics, feedback, surveys | `analyticsProxy.js`, `feedbackProxy.js`, `surveyProxy.js`, `signupNotify.js` |

## Data model (user-owned tables, all under RLS)

`materials` (imported documents and their derived exercises) · `user_settings` (plan, preferences) · `vocab` · `events` (analytics, insert-own only) · `ai_usage` (daily meter) · `survey` · `deleted_accounts` · storage bucket `audio`.

## Front-end modules of note

`src/lib/` holds ~70 modules: SRS and grading, dictation alignment, diffing, grammar drills and mistake logging, document formatting and export, i18n, IndexedDB persistence, account sync, image preparation. Pages compose these; business rules do not live in components.

## Testing

- `tests/`: 130+ Vitest files, jsdom for UI logic, injected `fetch` doubles for server modules.
- `e2e/`: Playwright specs (landing, API, mobile) plus screenshot scripts per feature.
- `scripts/evalArticle.mjs`: offline fixture suite + live quality report for the article extractor.
- `scripts/smoke.mjs`: post-deploy smoke run.
