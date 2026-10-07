// server/guard.js (excerpt) — shared hardening for every endpoint that spends
// an API key. Each proxy owns its own limits; only the mechanism is shared.

// Comma-separated, e.g. "https://langrok.app,https://www.langrok.app".
// Unset => allow any origin (fine for local dev; set it in production).
export function originAllowed(origin) {
  const list = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  if (list.length === 0) return true
  return !!origin && list.includes(origin)
}

// Sliding window, in memory. On a long-lived Node server this is a real
// limit; on serverless it is per-instance and therefore best-effort — pair it
// with the platform's own rate limiting and a spend cap on the provider.
//
// Buckets are named so one feature cannot exhaust another's allowance:
// transcribing a 40-minute episode fires many calls in a row and would
// otherwise lock the reader out of every AI panel for a minute.
const hits = new Map() // `${bucket}:${ip}` -> number[] (timestamps)

export function rateLimited(ip, { bucket = 'default', max = 30, windowMs = 60_000 } = {}) {
  if (!ip) return false
  const key = `${bucket}:${ip}`
  const now = Date.now()
  const recent = (hits.get(key) || []).filter(t => now - t < windowMs)
  recent.push(now)
  hits.set(key, recent)
  return recent.length > max
}
