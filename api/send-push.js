// Vercel serverless function — sends a web-push notification to every
// subscription stored in PocketBase, pruning dead ones.
//
// Required env vars (Vercel project settings):
//   VITE_PUSH_SECRET      shared secret checked against the x-push-secret header
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
//   POCKETBASE_URL (or VITE_POCKETBASE_URL), PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
import webpush from 'web-push'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.VITE_PUSH_SECRET
  if (!secret || req.headers['x-push-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { title, body, url = '/' } = req.body ?? {}
  if (!title) {
    return res.status(400).json({ error: 'title is required' })
  }

  const pbUrl = process.env.POCKETBASE_URL ?? process.env.VITE_POCKETBASE_URL
  if (!pbUrl) {
    return res.status(500).json({ error: 'PocketBase URL not configured' })
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY ?? process.env.VITE_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  try {
    // Authenticate as superuser (push_subscriptions list is admin-only)
    const authRes = await fetch(
      `${pbUrl}/api/collections/_superusers/auth-with-password`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: process.env.PB_ADMIN_EMAIL,
          password: process.env.PB_ADMIN_PASSWORD,
        }),
      },
    )
    if (!authRes.ok) {
      return res.status(502).json({ error: 'PocketBase admin auth failed' })
    }
    const { token } = await authRes.json()

    const listRes = await fetch(
      `${pbUrl}/api/collections/push_subscriptions/records?perPage=200`,
      { headers: { Authorization: token } },
    )
    if (!listRes.ok) {
      return res.status(502).json({ error: 'Failed to fetch subscriptions' })
    }
    const { items: subs } = await listRes.json()

    const payload = JSON.stringify({ title, body, url })
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        ),
      ),
    )

    // Prune subscriptions the push service says are gone (404/410)
    const dead = subs.filter((_, i) => {
      const r = results[i]
      return (
        r.status === 'rejected' &&
        (r.reason?.statusCode === 404 || r.reason?.statusCode === 410)
      )
    })
    await Promise.allSettled(
      dead.map((s) =>
        fetch(`${pbUrl}/api/collections/push_subscriptions/records/${s.id}`, {
          method: 'DELETE',
          headers: { Authorization: token },
        }),
      ),
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length
    return res
      .status(200)
      .json({ sent, failed: results.length - sent, pruned: dead.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
