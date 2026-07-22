import { useEffect, useState } from 'react'
import { IsoBanknote, IsoCreditCard, IsoLock, IsoCart, IsoCheckCircle } from '../components/icons'
import LoadingScreen from '../components/LoadingScreen'
import { getLatestRun, getOrdersForRun, markPaymentCollected, lockRun } from '../lib/api'
import { sendPushToAll } from '../lib/push'

// Human-readable description of what the coworker is handing over.
function describePayment(order) {
  if (order.payment_method === 'card') {
    return order.payment_note || 'Physical Card'
  }
  const price = order.expand?.primary_item?.price ?? 0
  const amount = order.amount_handed_over
  if (amount === price) {
    return `Exact cash — Rs. ${amount}`
  }
  return `Rs. ${amount} note (needs Rs. ${amount - price} change)`
}

// Aggregate item quantities, e.g. { 'Samosa': 2, 'Fish Bun': 1 }
function countItems(orders, key) {
  return orders.reduce((totals, order) => {
    const item = order.expand?.[key]
    if (item) {
      totals[item.name] = (totals[item.name] ?? 0) + 1
    }
    return totals
  }, {})
}

function PreRunChecklist() {
  const [run, setRun] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [collected, setCollected] = useState(() => new Set())
  const [locking, setLocking] = useState(false)

  const locked = run !== null && run.status !== 'open'

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const latestRun = await getLatestRun()
        if (cancelled) return
        setRun(latestRun)
        if (latestRun) {
          const runOrders = await getOrdersForRun(latestRun.id)
          if (cancelled) return
          setOrders(runOrders)
          setCollected(
            new Set(runOrders.filter((o) => o.payment_collected).map((o) => o.id)),
          )
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message ?? 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const primaryTotals = countItems(orders, 'primary_item')
  const fallbackTotals = countItems(orders, 'fallback_item')
  const totalItems = Object.values(primaryTotals).reduce((sum, n) => sum + n, 0)

  async function toggleCollected(orderId) {
    const isCollected = !collected.has(orderId)

    // Optimistic update
    setCollected((prev) => {
      const next = new Set(prev)
      if (isCollected) {
        next.add(orderId)
      } else {
        next.delete(orderId)
      }
      return next
    })

    try {
      await markPaymentCollected(orderId, isCollected)
    } catch {
      // Revert on failure
      setCollected((prev) => {
        const next = new Set(prev)
        if (isCollected) {
          next.delete(orderId)
        } else {
          next.add(orderId)
        }
        return next
      })
    }
  }

  async function handleStartShopping() {
    if (locking) return
    setLocking(true)
    try {
      const updated = await lockRun(run.id)
      setRun(updated)

      // Best-effort push — locking succeeded even if this fails
      try {
        await sendPushToAll({
          title: 'Bakery Run',
          body: 'Run locked — the runner is heading out. No more orders!',
          url: '/',
        })
      } catch {
        // ignore push failures
      }
    } catch (err) {
      setLoadError(err.message ?? 'Failed to lock the run')
    } finally {
      setLocking(false)
    }
  }

  // ── Loading / error / no-run states ──────────────────────────────────────
  if (loading) {
    return <LoadingScreen message="Loading checklist…" />
  }

  if (loadError && !run) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center shadow-sm">
          <p className="text-sm text-red-700">Couldn&apos;t load the run: {loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">No runs yet</h2>
          <p className="mt-1 text-sm text-gray-500">
            Create a run in PocketBase to get started.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Pre-run checklist</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Run of {run.date ? run.date.slice(0, 10) : '—'} — {orders.length} orders
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            locked ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
          }`}
        >
          {run.status}
        </span>
      </div>

      {locked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <IsoLock className="h-4 w-4 shrink-0" />
          Run locked — no new orders accepted.
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-center text-sm text-gray-500">
          No orders yet — share the link with your coworkers.
        </div>
      ) : (
        <>
          {/* Orders */}
          <ul className="space-y-2">
            {orders.map((order) => {
              const isCollected = collected.has(order.id)
              const PaymentIcon = order.payment_method === 'card' ? IsoCreditCard : IsoBanknote
              const primary = order.expand?.primary_item
              const fallback = order.expand?.fallback_item

              return (
                <li
                  key={order.id}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 transition ${
                    isCollected
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {order.coworker_name}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-gray-600">
                      {primary?.name}
                      {fallback ? ` — fallback: ${fallback.name}` : ''}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                      <PaymentIcon className="h-3.5 w-3.5 shrink-0" />
                      {describePayment(order)}
                    </p>
                  </div>
                  <label className="flex shrink-0 cursor-pointer flex-col items-center gap-1">
                    <input
                      type="checkbox"
                      checked={isCollected}
                      onChange={() => toggleCollected(order.id)}
                      className="h-5 w-5 accent-green-600"
                    />
                    <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      Collected
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>

          {/* Shopping list summary */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <IsoCart className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">
                Shopping List Summary
              </h3>
            </div>
            <ul className="mt-3 space-y-1.5">
              {Object.entries(primaryTotals).map(([name, qty]) => (
                <li key={name} className="flex justify-between text-sm text-gray-700">
                  <span>{name}</span>
                  <span className="font-medium">× {qty}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-gray-100 pt-1.5 text-sm font-medium text-gray-900">
                <span>Total</span>
                <span>× {totalItems}</span>
              </li>
            </ul>

            {Object.keys(fallbackTotals).length > 0 && (
              <div className="mt-3 rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500">
                  Fallbacks (buy only if primary is out of stock)
                </p>
                <ul className="mt-1.5 space-y-1">
                  {Object.entries(fallbackTotals).map(([name, qty]) => (
                    <li key={name} className="flex justify-between text-xs text-gray-600">
                      <span>{name}</span>
                      <span>× {qty}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      {loadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      )}

      {/* Start shopping */}
      {locked ? (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-gray-900 py-3 text-sm font-medium text-white">
          <IsoCheckCircle className="h-4 w-4" />
          Run locked — happy shopping!
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={handleStartShopping}
            disabled={locking}
            className="w-full rounded-lg bg-gray-900 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {locking ? 'Locking…' : 'Start Shopping'}
          </button>
          <p className="mt-2 text-center text-xs text-gray-500">
            {collected.size} of {orders.length} payments collected
          </p>
        </div>
      )}
    </div>
  )
}

export default PreRunChecklist
