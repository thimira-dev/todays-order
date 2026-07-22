import { useEffect, useState } from 'react'
import { IsoCreditCard, IsoBanknote, IsoCheckCircle, IsoLock, IsoUndo } from '../components/icons'
import LoadingScreen from '../components/LoadingScreen'
import pb from '../lib/pocketbase'
import {
  getLatestRun,
  getOrdersForRun,
  updateOrderSettlement,
  completeRun,
  reopenRunToLocked,
} from '../lib/api'
import { sendPushToAll } from '../lib/push'

function getEffectiveItem(order, isOutOfStock) {
  if (!isOutOfStock) {
    return { item: order.expand?.primary_item ?? null, cancelled: false }
  }
  const fallback = order.expand?.fallback_item ?? null
  return fallback ? { item: fallback, cancelled: false } : { item: null, cancelled: true }
}

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

function getMoneySummary(rows, costMap) {
  let cashCollected = 0
  let bakerySpend = 0
  let changeReturn = 0
  let collectMore = 0
  let cardCount = 0

  for (const { order, effective } of rows) {
    const cost = Number(costMap[order.id] ?? 0)
    if (order.payment_method === 'cash') {
      cashCollected += order.amount_handed_over ?? 0
      if (effective.cancelled) {
        changeReturn += order.amount_handed_over ?? 0
      } else {
        bakerySpend += cost
        const diff = (order.amount_handed_over ?? 0) - cost
        if (diff >= 0) {
          changeReturn += diff
        } else {
          collectMore += -diff
        }
      }
    } else {
      cardCount++
    }
  }
  return { cashCollected, bakerySpend, changeReturn, collectMore, cardCount }
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
  const locked = run !== null && run.status === 'locked'
  const editable = locked && !completed

  // ── Load the latest run, then follow run changes in realtime ─────────────
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
          setOosMap(
            Object.fromEntries(runOrders.map((o) => [o.id, Boolean(o.out_of_stock)])),
          )
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

    pb.collection('runs').subscribe('*', async () => {
      try {
        const latestRun = await getLatestRun()
        if (!cancelled) setRun(latestRun)
      } catch {
        // transient — next event retries
      }
    })

    return () => {
      cancelled = true
      pb.collection('runs').unsubscribe('*')
    }
  }, [])

  // ── Orders for the current run: initial load + realtime with merge ───────
  useEffect(() => {
    if (!run?.id) {
      setOrders([])
      setOosMap({})
      setCostMap({})
      return
    }

    let cancelled = false

    async function loadOrders() {
      try {
        const fresh = await getOrdersForRun(run.id)
        if (cancelled) return
        setOrders(fresh)
        setOosMap(
          Object.fromEntries(fresh.map((o) => [o.id, Boolean(o.out_of_stock)])),
        )
        setCostMap((prev) => {
          const newIds = new Set(fresh.map((o) => o.id))
          const next = { ...prev }
          for (const o of fresh) {
            if (o.actual_cost != null) {
              next[o.id] = String(o.actual_cost)
            } else if (!(o.id in prev)) {
              const effective = getEffectiveItem(o, Boolean(o.out_of_stock))
              next[o.id] = effective.item ? String(effective.item.price) : ''
            }
          }
          for (const id of Object.keys(next)) {
            if (!newIds.has(id)) delete next[id]
          }
          return next
        })
      } catch {
        // transient — next event retries
      }
    }

    loadOrders()
    pb.collection('orders').subscribe('*', loadOrders, {
      filter: `run = "${run.id}"`,
    })

    return () => {
      cancelled = true
      pb.collection('orders').unsubscribe('*')
    }
  }, [run?.id])

  const rows = orders.map((order) => {
    const isOutOfStock = Boolean(oosMap[order.id])
    const effective = getEffectiveItem(order, isOutOfStock)
    return { order, isOutOfStock, effective }
  })

  const canComplete =
    editable &&
    rows.every(
      ({ effective, order }) =>
        effective.cancelled ||
        (costMap[order.id] !== '' && Number(costMap[order.id]) >= 0),
    )

  async function toggleOutOfStock(order) {
    if (!editable) return
    const next = !oosMap[order.id]
    const previous = oosMap[order.id]

    setOosMap((prev) => ({ ...prev, [order.id]: next }))
    const effective = getEffectiveItem(order, next)
    setCostMap((prev) => ({
      ...prev,
      [order.id]: effective.item ? String(effective.item.price) : '',
    }))

    try {
      await updateOrderSettlement(order.id, {
        out_of_stock: next,
        actual_cost: null,
      })
    } catch {
      setOosMap((prev) => ({ ...prev, [order.id]: previous }))
      const reverted = getEffectiveItem(order, Boolean(previous))
      setCostMap((prev) => ({
        ...prev,
        [order.id]: reverted.item ? String(reverted.item.price) : '',
      }))
    }
  }

  async function handleComplete() {
    if (!canComplete || completing) return
    setCompleting(true)
    setActionError(null)
    try {
      for (const { order, isOutOfStock, effective } of rows) {
        try {
          await updateOrderSettlement(order.id, {
            out_of_stock: isOutOfStock,
            actual_cost: effective.cancelled ? null : Number(costMap[order.id]),
          })
        } catch (err) {
          throw new Error(
            `Failed to settle "${order.coworker_name}": ${err.message ?? 'server error'}`,
          )
        }
      }

      const closed = await completeRun(run.id)
      setRun(closed)

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
      setActionError(err.message)
    } finally {
      setCompleting(false)
    }
  }

  async function handleReopen() {
    if (
      !window.confirm(
        'Reopen settlement? The run will be set back to locked so you can adjust costs.',
      )
    ) {
      return
    }
    try {
      const updated = await reopenRunToLocked(run.id)
      setRun(updated)
    } catch (err) {
      setActionError(err.message ?? 'Failed to reopen the settlement')
    }
  }

  // ── Loading / error / no-run states ──────────────────────────────────────
  if (loading) {
    return <LoadingScreen message="Loading settlement…" />
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
            Open a run from the Checklist tab to get started.
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
            completed
              ? 'bg-green-100 text-green-800'
              : locked
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-600'
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

      {!locked && !completed && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <IsoLock className="h-4 w-4 shrink-0" />
          Lock the run from the Checklist tab before settling.
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
                          {' — '}cancelled, no fallback
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
                      disabled={!editable}
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
                        disabled={!editable}
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

          {/* Money summary */}
          {(() => {
            const summary = getMoneySummary(rows, costMap)
            if (summary.cashCollected === 0 && summary.cardCount === 0) return null
            return (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-900">Money Summary</h3>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cash collected</span>
                    <span className="font-medium">Rs. {summary.cashCollected}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bakery spend</span>
                    <span className="font-medium">Rs. {summary.bakerySpend}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Change to return</span>
                    <span className="font-medium">Rs. {summary.changeReturn}</span>
                  </div>
                  {summary.collectMore > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">To collect more</span>
                      <span className="font-medium text-amber-700">
                        Rs. {summary.collectMore}
                      </span>
                    </div>
                  )}
                  {summary.cardCount > 0 && (
                    <div className="flex justify-between border-t border-gray-100 pt-1.5">
                      <span className="text-gray-600">Card orders</span>
                      <span className="font-medium">
                        {summary.cardCount} card{summary.cardCount !== 1 ? 's' : ''} to return
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

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

      {/* Complete run or reopen */}
      {completed ? (
        <button
          type="button"
          onClick={handleReopen}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 py-3 text-sm font-medium text-gray-600 transition hover:border-gray-400"
        >
          <IsoUndo className="h-4 w-4" />
          Reopen settlement
        </button>
      ) : editable ? (
        <div>
          <button
            type="button"
            disabled={!canComplete || completing || rows.length === 0}
            onClick={handleComplete}
            className="w-full rounded-lg bg-gray-900 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {completing ? 'Completing…' : 'Complete Run'}
          </button>
          {!canComplete && rows.length > 0 && (
            <p className="mt-2 text-center text-xs text-gray-500">
              Enter actual costs for all purchased items to complete the run.
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 py-3 text-sm font-medium text-gray-500">
          <IsoLock className="h-4 w-4" />
          Lock the run to begin settlement
        </div>
      )}
    </div>
  )
}

export default RunSettlement
