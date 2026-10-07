// server/app.js (excerpt) — one Hono router for every /api route.
// Handlers are imported at call time so a cold start only loads what the
// request actually needs.

import { Hono } from 'hono'
import { bearer } from './auth.js'

const app = new Hono()

function clientIp(c) {
  const fwd = c.req.header('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return c.req.header('x-real-ip') || c.env?.ip || ''
}

// Every route reads the same. `load` is a function so nothing is imported
// until somebody actually asks for it.
function serve(load, { auth = true } = {}) {
  return async c => {
    // sendBeacon posts a Blob and some hosts leave the body as a string, so
    // the parse is ours and a bad one is an empty object rather than a crash.
    let body = {}
    try { body = (await c.req.json()) || {} } catch { body = {} }
    const run = await load(body)
    const { status, body: out } = await run({
      ...body,
      // Identity comes from the token, never from the body.
      ...(auth ? { token: bearer(c.req.header('authorization')) } : {}),
      origin: c.req.header('origin'),
      ip: clientIp(c),
    })
    return c.json(out, status)
  }
}

app.post('/api/ai',        serve(async () => (await import('./aiProxy.js')).proxyAI))
app.post('/api/article',   serve(async () => (await import('./articleProxy.js')).proxyArticle))
app.post('/api/podcast',   serve(async () => (await import('./podcastProxy.js')).proxyPodcast))
app.post('/api/speech',    serve(async () => (await import('./speechProxy.js')).proxySpeech))
// … one line per concern; the dev server mounts this same app as middleware.

export default app
