// src/lib/shipped.js (excerpt) — what is on the shelf today.
// One list drives nav link, home card, landing card, library chip, import tab
// and route together — and the SERVER reads it too, so a paused feature's
// endpoint answers 503 feature_paused instead of spending quota.

export const GATES = [
  'listen', 'speak', 'read', 'write',   // the skills (also their routes)
  'books',                              // course books: import tab and /book
  'podcast', 'audio',                   // imports that only listening can use
  'notes', 'progress',                  // notebook and history
  'plan',                               // membership tier and upgrade door
]

// Default: what the public sees today. VITE_SHIPPED overrides at build time:
//   VITE_SHIPPED=all                  staging build, every door open
//   VITE_SHIPPED=read,listen,podcast  one door at a time
const shipped = (import.meta.env?.VITE_SHIPPED || process.env.VITE_SHIPPED || 'read')
  .split(',').map(s => s.trim()).filter(Boolean)

export const LAUNCH = Object.fromEntries(
  GATES.map(g => [g, shipped.includes('all') || shipped.includes(g)])
)
