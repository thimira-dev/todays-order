// Tracks which order IDs were placed from this browser, keyed by run id.
// Device-local only (no auth) — powers the "Your orders" cancel/edit section.

const STORAGE_KEY = 'bakery-my-orders'

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // storage full / unavailable — non-fatal
  }
}

export function getMyOrderIds(runId) {
  return readAll()[runId] ?? []
}

export function addMyOrderId(runId, orderId) {
  const all = readAll()
  const ids = all[runId] ?? []
  if (!ids.includes(orderId)) {
    all[runId] = [...ids, orderId]
    writeAll(all)
  }
}

export function removeMyOrderId(runId, orderId) {
  const all = readAll()
  all[runId] = (all[runId] ?? []).filter((id) => id !== orderId)
  writeAll(all)
}
