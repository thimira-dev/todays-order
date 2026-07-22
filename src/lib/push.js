import { savePushSubscription } from './api'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

// VAPID public keys are base64url — pushManager wants a Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// Ask permission, subscribe this browser, and save the subscription to PocketBase.
export async function subscribeToPush(coworkerName = null) {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported on this browser.')
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is not configured.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  const json = subscription.toJSON()
  await savePushSubscription({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    coworker_name: coworkerName,
  })

  return subscription
}

// Ask the serverless function to push a message to every subscriber.
// Best-effort — callers should catch and continue their main flow.
export async function sendPushToAll({ title, body, url = '/' }) {
  const res = await fetch('/api/send-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Note: a client-side secret is obfuscation, not real security — it keeps
      // casual abuse out for this internal app. Move sends server-side
      // (PocketBase hooks) if this ever goes beyond a trusted group.
      'x-push-secret': import.meta.env.VITE_PUSH_SECRET ?? '',
    },
    body: JSON.stringify({ title, body, url }),
  })
  if (!res.ok) {
    throw new Error(`Push send failed (${res.status})`)
  }
  return res.json()
}
