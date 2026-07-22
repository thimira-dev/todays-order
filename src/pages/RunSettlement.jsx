import { useEffect, useState } from 'react'
import { IsoCreditCard, IsoBanknote, IsoCheckCircle, IsoUndo } from '../components/icons'
import LoadingScreen from '../components/LoadingScreen'
import {
  getLatestRun,
  getOrdersForRun,
  updateOrderSettlement,
  completeRun,
} from '../lib/api'
import { sendPushToAll } from '../lib/push'

// What the coworker actually receives, given out-of-stock status:
// { item, cancelled } — cancelled when the primary is out and there is no fallback.
function getEffectiveItem(order, isOutOfStock) {
  if (!isOutOfStock) {
    return { item: order.expand?.primary_item ?? null, cancelled: false }
  }
  const fallback = order.expand?.fallback_item ?? null
  return fallback ? { item: fallback, cancelled: false } : { item: null, cancelled: true }
}

// The instruction for what to hand back to the coworker at the office.
function getDistribution(order, effective, cost) {
  if (order.payment_method === 'card') {
    return { kind: 'card', label: `Return ${order.payment_note || 'Physical Card'}` }
  }
  if (effective.cancelled) {
    return { kind: 'cancelled', label: `Return full Rs. ${order.amount_handed_over}` }
  }
  const diff = order.amount_handed_over - cost
  if (diff >= 0) {
    return { kind: 'change', label: `Return Rs. ${diff} change` }
  }
  return { kind: 'collect', label: `Collect Rs. ${-diff} more` }
}

const DISTRIBUTION_STYLES = {
  card: 'border-blue-200 bg-blue-50 text-blue-800',
  change: 'border-green-200 bg-green-50 text-green-800',
  collect: 'border-amber-200 bg-amber-50 text-amber-800',
  cancelled: 'border-gray-200 bg-gray-100 text-gray-600',
}

function RunSettlement() {
  const [run, setRun] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [oosMap, setOosMap] = useState({})
  const [costMap, setCostMap] = useState({})
  const [completing, setCompleting] = useState(false)
  const [actionError, setActionError] = useState(null)

  const completed = run !== null && run.status === 'closed'

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
          setOosMap(Object.fromEntries(runOrders.map((o) => [o.id, Boolean(o.out_of_stock)])))
          setCostMap(
            Object.fromEntries(
              runOrders.map((o) => {
                const effective = getEffectiveItem(o, Boolean(o.out_of_stock))
                const cost = o.actual_cost ?? effective.item?.price ?? ''
                return [o.id, String(cost)]
              }),
            ),
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

  const rows = orders.map((order) => {
    const isOutOfStock = Boolean(oosMap[order.id])
    const effective = getEffectiveItem(order, isOutOfStock)
    return { order, isOutOfStock, effective }
  })

  // Every purchased (non-cancelled) order needs an actual cost before completing.
  const canComplete = rows.every(
    ({ effective, order }) =>
      effective.cancelled || (costMap[order.id] !== '' && Number(costMap[order.id]) >= 0),
  )

  async function toggleOutOfStock(order) {
    const next = !oosMap[order.id]
    const previous = oosMap[order.id]

    // Optimistic update + refill cost with the newly effective item's price
    setOosMap((prev) => ({ ...prev, [order.id]: next }))
    const effective = getEffectiveItem(order, next)
    setCostMap((prev) => ({
      ...prev,
      [order.id]: effective.item ? String(effective.item.price) : '',
    }))

    try {
      await updateOrderSettlement(order.id, {
        out_of_stock: next,
        actual_cost: null, // reset until the runner enters the real cost
      })
    } catch {
      // Revert on failure
      setOosMap((prev) => ({ ...prev, [order.id]: previous }))
      const reverted = getEffectiveItem(order, Boolean(previous))
      setCostMap((prev) => ({
        ...prev,
        [order.id]: reverted.item ? String(reverted.item.price) : '',
      }))
    }
  }

  async function handleComplete() {
    if (completing) return
    setCompleting(true)
    setActionError(null)
    try {
      await Promise.all(
        rows.map(({ order, isOutOfStock, effective }) =>
          updateOrderSettlement(order.id, {
            out_of_stock: isOutOfStock,
            actual_cost: effective.cancelled ? null : Number(costMap[order.id]),
          }),
        ),
      )
      const closed = await completeRun(run.id)
      setRun(closed)

      // Best-effort push — completing succeeded even if this fails
      try {
        await sendPushToAll({
          title: 'Bakery Run',
          body: 'Run done — come collect your items and your change!',
          url: '/',
        })
      } catch {
        // ignore push failures
      }
    } catch (err) {
      setActionError(err.message ?? 'Failed to complete the run')
    } finally {
      setCompleting(false)
    }
  }

  // ── Loading / error / no-run states ──────────────────────────────────────
  if (loading) {
    return <LoadingScreen message="Loading settlement…" />
  }

  if (loadError) {
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
          <h2 className="text-lg font-semibold text-gray-900">Run settlement</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Run of {run.date ? run.date.slice(0, 10) : '—'} — {orders.length} orders
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            completed ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {run.status}
        </span>
      </div>

      {completed && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800">
          <IsoCheckCircle className="h-4 w-4 shrink-0" />
          Run completed — settled and closed.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-center text-sm text-gray-500">
          No orders in this run.
        </div>
      ) : (
        <>
          {/* Bakery: ordered items */}
          <ul className="space-y-2">
            {rows.map(({ order, isOutOfStock, effective }) => {
              const primary = order.expand?.primary_item
              const fallback = order.expand?.fallback_item

              return (
                <li
                  key={order.id}
                  className={`rounded-xl border p-3.5 ${
                    effective.cancelled
                      ? 'border-gray-200 bg-gray-100'
                      : isOutOfStock
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {order.coworker_name}
                      </p>

                      {effective.cancelled ? (
                        <p className="mt-0.5 text-sm text-gray-500">
                          <span className="line-through">{primary?.name}</span>
                          {' '}— cancelled, no fallback
                        </p>
                      ) : isOutOfStock ? (
                        <p className="mt-0.5 text-sm">
                          <span className="text-gray-400 line-through">{primary?.name}</span>
                          {' → '}
                          <span className="font-medium text-gray-900">{fallback?.name}</span>
                          <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            fallback
                          </span>
                        </p>
                      ) : (
                        <p className="mt-0.5 text-sm text-gray-600">{primary?.name}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={completed}
                      onClick={() => toggleOutOfStock(order)}
                      className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                        isOutOfStock
                          ? 'bg-amber-600 text-white hover:bg-amber-500'
                          : 'border border-gray-300 text-gray-600 hover:border-gray-400'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {isOutOfStock && <IsoUndo className="h-3 w-3" />}
                      {isOutOfStock ? 'Restock' : 'Out of Stock'}
                    </button>
                  </div>

                  {!effective.cancelled && (
                    <div className="mt-3 flex items-center gap-2">
                      <label
                        htmlFor={`cost-${order.id}`}
                        className="text-xs font-medium text-gray-500"
                      >
                        Actual cost (Rs.)
                      </label>
                      <input
                        id={`cost-${order.id}`}
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        disabled={completed}
                        value={costMap[order.id] ?? ''}
                        onChange={(e) =>
                          setCostMap((prev) => ({ ...prev, [order.id]: e.target.value }))
                        }
                        className="w-28 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {/* Distribution list */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900">Distribution List</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              What to hand back to each coworker at the office.
            </p>
            <ul className="mt-3 space-y-2">
              {rows.map(({ order, effective }) => {
                const cost = Number(costMap[order.id] ?? 0)
                const dist = getDistribution(order, effective, cost)
                const Icon = order.payment_method === 'card' ? IsoCreditCard : IsoBanknote

                return (
                  <li
                    key={order.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${DISTRIBUTION_STYLES[dist.kind]}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{order.coworker_name}</p>
                      <p className="text-xs opacity-80">
                        {effective.cancelled ? 'Nothing to collect' : effective.item?.name}
                      </p>
                    </div>
                    <p className="flex shrink-0 items-center gap-1.5 text-xs font-medium">
                      <Icon className="h-3.5 w-3.5" />
                      {dist.label}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}

      {actionError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {/* Complete run */}
      {completed ? (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-green-600 py-3 text-sm font-medium text-white">
          <IsoCheckCircle className="h-4 w-4" />
          Run completed
        </div>
      ) : (
        <div>
          <button
            type="button"
            disabled={!canComplete || completing || rows.length === 0}
            onClick={handleComplete}
            className="w-full rounded-lg bg-gray-900 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {completing ? 'Completing…' : 'Complete Run'}
          </button>
          {!canComplete && (
            <p className="mt-2 text-center text-xs text-gray-500">
              Enter actual costs for all purchased items to complete the run.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default RunSettlement
