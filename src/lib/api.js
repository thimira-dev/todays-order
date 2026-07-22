import pb from './pocketbase'

// ============================================================================
// PocketBase schema expected by this module
// ----------------------------------------------------------------------------
// Create these collections in the PocketBase admin UI (http://127.0.0.1:8090/_)
// with the columns shown below. `id`, `created`, and `updated` are automatic.
//
// Collection: menu
// {
//   "id": "a1b2c3d4e5f6g7h",        // auto-generated
//   "name": "Chicken Kottu",        // text
//   "price": 850,                   // number
//   "is_available": true,           // bool
//   "created": "2026-07-21 08:00:00.000Z",  // auto
//   "updated": "2026-07-21 08:00:00.000Z"   // auto
// }
//
// Collection: runs
// {
//   "id": "r1r2r3r4r5r6r7r",
//   "date": "2026-07-21 00:00:00.000Z",     // date
//   "status": "open",               // select: 'open' | 'locked' | 'closed'
//   "created": "2026-07-21 08:00:00.000Z",  // auto
//   "updated": "2026-07-21 09:30:00.000Z"   // auto
// }
//
// Collection: orders
// {
//   "id": "o1o2o3o4o5o6o7o",
//   "run": "r1r2r3r4r5r6r7r",       // relation -> runs (required)
//   "coworker_name": "Nimal Perera",      // text (required)
//   "primary_item": "a1b2c3d4e5f6g7h",   // relation -> menu (required)
//   "fallback_item": "c3d4e5f6g7h8i9j",  // relation -> menu (optional)
//   "payment_method": "cash",       // select: 'cash' | 'card'
//   "amount_handed_over": 1000,     // number
//   "payment_note": "Commercial Bank Card",  // text (optional, e.g. card label)
//   "payment_collected": false,     // bool (default false)
//   "out_of_stock": false,          // bool (default false) — primary unavailable,
//                                   //   order fulfilled with fallback_item instead
//   "actual_cost": 130,             // number (optional) — what the runner actually paid
//   "created": "2026-07-21 08:15:00.000Z",  // auto
//   "updated": "2026-07-21 08:15:00.000Z"   // auto
// }
//
// Collection: push_subscriptions
// {
//   "id": "p1p2p3p4p5p6p7p",
//   "endpoint": "https://fcm.googleapis.com/fcm/send/...",  // text (unique)
//   "p256dh": "BNcRd...",             // text — subscription keys.p256dh
//   "auth": "tBHItJ...",              // text — subscription keys.auth
//   "coworker_name": "Nimal Perera",  // text (optional)
//   "created": "2026-07-21 08:00:00.000Z",  // auto
//   "updated": "2026-07-21 08:00:00.000Z"   // auto
// }
// ============================================================================

// 1. Fetch all currently available menu items, alphabetically sorted.
export async function getAvailableMenuItems() {
  return pb.collection('menu').getFullList({
    filter: 'is_available = true',
    sort: 'name',
  })
}

// 2. Fetch the current open run. Returns the run record, or null if none is open.
export async function getCurrentRun() {
  try {
    return await pb.collection('runs').getFirstListItem('status = "open"')
  } catch (err) {
    // PocketBase throws a 404 when no record matches the filter
    if (err.status === 404) return null
    throw err
  }
}

// 2b. Fetch the most recent run regardless of status (open/locked/closed).
//     Used by the runner screens, which operate on locked runs too.
export async function getLatestRun() {
  try {
    return await pb.collection('runs').getFirstListItem('', { sort: '-created' })
  } catch (err) {
    if (err.status === 404) return null
    throw err
  }
}

// 3. Create a new order, automatically attached to the current open run.
export async function createOrder({
  coworker_name,
  primary_item_id,
  fallback_item_id = null,
  payment_method,
  amount_handed_over,
}) {
  const run = await getCurrentRun()
  if (!run) {
    throw new Error('No open run — cannot place an order right now.')
  }

  return pb.collection('orders').create({
    run: run.id,
    coworker_name,
    primary_item: primary_item_id,
    fallback_item: fallback_item_id,
    payment_method,
    amount_handed_over,
  })
}

// 4. Fetch all orders for a specific run, newest first.
//    Menu items are expanded so names/prices are available without extra queries.
export async function getOrdersForRun(runId) {
  return pb.collection('orders').getFullList({
    filter: `run = "${runId}"`,
    expand: 'primary_item,fallback_item',
    sort: '-created',
  })
}

// 5. Mark an order's physical payment as collected (or un-collect it).
export async function markPaymentCollected(orderId, collected) {
  return pb.collection('orders').update(orderId, {
    payment_collected: collected,
  })
}

// 6. Lock a run — no new orders accepted once the runner starts shopping.
export async function lockRun(runId) {
  return pb.collection('runs').update(runId, { status: 'locked' })
}

// 7. Record what actually happened at the bakery for an order:
//    whether the primary was out of stock, and what was actually paid.
export async function updateOrderSettlement(orderId, { out_of_stock, actual_cost }) {
  return pb.collection('orders').update(orderId, { out_of_stock, actual_cost })
}

// 8. Complete a run — settlement done, change distributed back at the office.
export async function completeRun(runId) {
  return pb.collection('runs').update(runId, { status: 'closed' })
}

// 9. Save a web-push subscription (one per browser endpoint).
//    Re-saving the same endpoint updates the existing record.
export async function savePushSubscription({ endpoint, p256dh, auth, coworker_name = null }) {
  try {
    const existing = await pb
      .collection('push_subscriptions')
      .getFirstListItem(`endpoint = "${endpoint}"`)
    return await pb.collection('push_subscriptions').update(existing.id, {
      p256dh,
      auth,
      coworker_name,
    })
  } catch (err) {
    if (err.status !== 404) throw err
    return pb.collection('push_subscriptions').create({
      endpoint,
      p256dh,
      auth,
      coworker_name,
    })
  }
}
