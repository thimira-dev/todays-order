import { useEffect, useState } from 'react'
import { IsoBanknote, IsoCoins, IsoCreditCard, IsoCheckCircle, IsoBell, IsoBellRing, IsoLock } from '../components/icons'
import LoadingScreen from '../components/LoadingScreen'
import pb from '../lib/pocketbase'
import {
  getAvailableMenuItems,
  getCurrentRun,
  getOrdersForRun,
  createOrder,
  updateOrder,
  deleteOrder,
} from '../lib/api'
import { getMyOrderIds, addMyOrderId, removeMyOrderId } from '../lib/myOrders'
import { subscribeToPush, isPushSupported } from '../lib/push'
import { playMascotReaction } from '../components/Mascot/mascotBus'

const PAYMENT_METHODS = [
  {
    value: 'exact_cash',
    label: 'Exact Cash',
    description: 'You hand over the exact amount',
    icon: IsoBanknote,
  },
  {
    value: 'cash_change',
    label: 'Cash with Change',
    description: 'You need change back',
    icon: IsoCoins,
  },
  {
    value: 'card',
    label: 'Physical Card',
    description: 'Pay with a card on collection',
    icon: IsoCreditCard,
  },
]

function OrderScreen() {
  const [run, setRun] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [orders, setOrders] = useState([])
  const [myIds, setMyIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [coworkerName, setCoworkerName] = useState('')
  const [primaryId, setPrimaryId] = useState('')
  const [fallbackId, setFallbackId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('exact_cash')
  const [amountHandedOver, setAmountHandedOver] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [notifyState, setNotifyState] = useState('idle') // idle | working | done | error

  // ── Load the current run + menu, then follow run changes in realtime ─────
  useEffect(() => {
    let cancelled = false

    async function loadMenu() {
      const items = await getAvailableMenuItems()
      if (!cancelled) setMenuItems(items)
    }

    async function load() {
      try {
        const currentRun = await getCurrentRun()
        if (cancelled) return
        setRun(currentRun)
        if (currentRun) await loadMenu()
      } catch (err) {
        if (!cancelled) setLoadError(err.message ?? 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    // Live: form appears when a run opens, locks the moment the run locks.
    pb.collection('runs').subscribe('*', (e) => {
      if (cancelled) return
      if (e.action === 'delete') {
        setRun((prev) => (prev?.id === e.record.id ? null : prev))
        return
      }
      if (e.record.status === 'open') {
        setRun((prev) => {
          if (prev?.id !== e.record.id) loadMenu() // newly adopted run — refresh menu
          return e.record
        })
      } else {
        setRun((prev) => (prev?.id === e.record.id ? e.record : prev))
      }
    })

    return () => {
      cancelled = true
      pb.collection('runs').unsubscribe('*')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Orders for the current run: initial load + realtime refetch ──────────
  useEffect(() => {
    if (!run?.id) {
      setOrders([])
      setMyIds([])
      return
    }

    let cancelled = false
    setMyIds(getMyOrderIds(run.id))

    async function loadOrders() {
      try {
        const runOrders = await getOrdersForRun(run.id)
        if (!cancelled) setOrders(runOrders)
      } catch {
        // transient — the next realtime event retries
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

  const primaryItem = menuItems.find((item) => item.id === primaryId) ?? null
  const fallbackItem = menuItems.find((item) => item.id === fallbackId) ?? null
  const fallbackItems = menuItems.filter((item) => item.id !== primaryId)
  const paymentLabel = PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label

  const amount = Number(amountHandedOver)
  const isAmountValid =
    paymentMethod !== 'cash_change' ||
    (amountHandedOver !== '' && primaryItem !== null && amount >= primaryItem.price)

  const canSubmit = coworkerName.trim() !== '' && primaryItem !== null && isAmountValid

  const runOpen = run !== null && run.status === 'open'
  const myOrders = orders.filter((o) => myIds.includes(o.id))

  function resetForm() {
    setCoworkerName('')
    setPrimaryId('')
    setFallbackId('')
    setPaymentMethod('exact_cash')
    setAmountHandedOver('')
    setPaymentNote('')
    setEditingId(null)
    setSubmitError(null)
    setNotifyState('idle')
    setSubmitted(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || submitting) return

    const trimmedName = coworkerName.trim()

    // Duplicate guard — same name already has an order in this run.
    if (!editingId) {
      const duplicate = orders.some(
        (o) => o.coworker_name.trim().toLowerCase() === trimmedName.toLowerCase(),
      )
      if (
        duplicate &&
        !window.confirm(
          `${trimmedName} already has an order in this run — place another one anyway?`,
        )
      ) {
        return
      }
    }

    if (editingId && !runOpen) {
      setSubmitError('This run is locked — orders can no longer be changed.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const paymentFields = {
        payment_method: paymentMethod === 'card' ? 'card' : 'cash',
        amount_handed_over:
          paymentMethod === 'exact_cash'
            ? primaryItem.price
            : paymentMethod === 'cash_change'
              ? amount
              : null,
        payment_note: paymentMethod === 'card' ? paymentNote.trim() || null : null,
      }

      if (editingId) {
        await updateOrder(editingId, {
          coworker_name: trimmedName,
          primary_item: primaryId,
          fallback_item: fallbackId || null,
          ...paymentFields,
        })
        resetForm()
        playMascotReaction('success', 'Awesome job!', 3000)
      } else {
        const created = await createOrder({
          coworker_name: trimmedName,
          primary_item_id: primaryId,
          fallback_item_id: fallbackId || null,
          ...paymentFields,
        })
        addMyOrderId(run.id, created.id)
        setMyIds(getMyOrderIds(run.id))
        setSubmitted(true)
        playMascotReaction('success', 'Awesome job!', 3000)
      }
    } catch (err) {
      setSubmitError(
        err.message ?? `Failed to ${editingId ? 'update' : 'place'} the order`,
      )
      playMascotReaction('error', "Oh no! Your order didn't go through — try again?", 4000)
    } finally {
      setSubmitting(false)
    }
  }

  function handleEditOrder(order) {
    setEditingId(order.id)
    setCoworkerName(order.coworker_name)
    setPrimaryId(order.primary_item)
    setFallbackId(order.fallback_item ?? '')
    if (order.payment_method === 'card') {
      setPaymentMethod('card')
      setAmountHandedOver('')
      setPaymentNote(order.payment_note ?? '')
    } else {
      const price = order.expand?.primary_item?.price
      if (price != null && order.amount_handed_over === price) {
        setPaymentMethod('exact_cash')
        setAmountHandedOver('')
      } else {
        setPaymentMethod('cash_change')
        setAmountHandedOver(String(order.amount_handed_over ?? ''))
      }
      setPaymentNote('')
    }
    setSubmitted(false)
    setSubmitError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleCancelOrder(order) {
    const itemName = order.expand?.primary_item?.name ?? 'this item'
    if (!window.confirm(`Cancel your order for ${itemName}?`)) return
    try {
      await deleteOrder(order.id)
      removeMyOrderId(run.id, order.id)
      setMyIds(getMyOrderIds(run.id))
      setOrders((prev) => prev.filter((o) => o.id !== order.id))
      if (editingId === order.id) resetForm()
      playMascotReaction('success', 'Poof! Order cancelled.', 3000)
    } catch (err) {
      setSubmitError(err.message ?? 'Failed to cancel the order')
      playMascotReaction('error', "Hmm, I couldn't cancel that — one more try?", 4000)
    }
  }

  async function handleNotify() {
    setNotifyState('working')
    try {
      await subscribeToPush(coworkerName.trim() || null)
      setNotifyState('done')
      playMascotReaction('success', "You're on the list — I'll ping you!", 3000)
    } catch {
      setNotifyState('error')
      playMascotReaction('error', "Couldn't set up notifications, sorry!", 4000)
    }
  }

  // ── Loading / error / no-run states ──────────────────────────────────────
  if (loading) {
    return <LoadingScreen message="Loading today's run…" />
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center shadow-sm">
          <p className="text-sm text-red-700">Couldn&apos;t load today&apos;s run: {loadError}</p>
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
          <h2 className="text-lg font-semibold text-gray-900">No run open today</h2>
          <p className="mt-1 text-sm text-gray-500">
            Check back later — the run hasn&apos;t been opened yet.
          </p>
        </div>
      </div>
    )
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="mx-auto max-w-md">
        <div className="space-y-4 rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-green-800">
            <IsoCheckCircle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Order placed!</h2>
          </div>
          <dl className="space-y-2 text-sm text-green-900">
            <div className="flex justify-between">
              <dt>Name</dt>
              <dd className="font-medium">{coworkerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Primary item</dt>
              <dd className="font-medium">{primaryItem?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Fallback</dt>
              <dd className="font-medium">{fallbackItem?.name ?? 'Cancel if out of stock'}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Payment</dt>
              <dd className="font-medium">
                {paymentLabel}
                {paymentMethod === 'card' && paymentNote.trim()
                  ? ` (${paymentNote.trim()})`
                  : ''}
              </dd>
            </div>
            {paymentMethod === 'cash_change' && (
              <div className="flex justify-between">
                <dt>Handing over</dt>
                <dd className="font-medium">Rs. {amount}</dd>
              </div>
            )}
          </dl>

          {isPushSupported() && notifyState !== 'done' && (
            <button
              type="button"
              onClick={handleNotify}
              disabled={notifyState === 'working'}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-green-300 bg-white py-2.5 text-sm font-medium text-green-800 transition hover:bg-green-100 disabled:opacity-50"
            >
              <IsoBell className="h-4 w-4" />
              {notifyState === 'working' ? 'Subscribing…' : 'Notify me about this run'}
            </button>
          )}
          {notifyState === 'done' && (
            <p className="flex items-center justify-center gap-2 text-sm text-green-800">
              <IsoBellRing className="h-4 w-4" />
              You&apos;ll get a push notification when the run updates.
            </p>
          )}
          {notifyState === 'error' && (
            <p className="text-center text-xs text-red-600">
              Couldn&apos;t enable notifications — check browser permissions.
            </p>
          )}

          <button
            type="button"
            onClick={resetForm}
            className="w-full rounded-lg bg-gray-900 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Place another order
          </button>
        </div>
      </div>
    )
  }

  // ── Order form ───────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-md">
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {editingId ? 'Edit your order' : "Join today's run"}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {editingId
              ? 'Update your items or payment below.'
              : 'Pick your items and payment method below.'}
          </p>
        </div>

        {!runOpen && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <IsoLock className="h-4 w-4 shrink-0" />
            Run locked — no new orders or changes accepted.
          </div>
        )}

        {/* Coworker name */}
        <div>
          <label
            htmlFor="coworker-name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Your name
          </label>
          <input
            id="coworker-name"
            type="text"
            value={coworkerName}
            onChange={(e) => setCoworkerName(e.target.value)}
            placeholder="e.g. Nimal Perera"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        {/* Primary item */}
        <div>
          <label
            htmlFor="primary-item"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Primary item
          </label>
          <select
            id="primary-item"
            value={primaryId}
            onChange={(e) => {
              setPrimaryId(e.target.value)
              setFallbackId('')
            }}
            required
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            <option value="" disabled>
              Select an item
            </option>
            {menuItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — Rs. {item.price}
              </option>
            ))}
          </select>
        </div>

        {/* Fallback item */}
        <div>
          <label
            htmlFor="fallback-item"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Fallback item{' '}
            <span className="font-normal text-gray-400">(if primary is out of stock)</span>
          </label>
          <select
            id="fallback-item"
            value={fallbackId}
            onChange={(e) => setFallbackId(e.target.value)}
            disabled={!primaryItem}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">Cancel item if out of stock</option>
            {fallbackItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — Rs. {item.price}
              </option>
            ))}
          </select>
        </div>

        {/* Payment method */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700">
            Payment method
          </legend>
          <div className="space-y-2">
            {PAYMENT_METHODS.map(({ value, label, description, icon: Icon }) => (
              <div key={value}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition ${
                    paymentMethod === value
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    value={value}
                    checked={paymentMethod === value}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="h-4 w-4 accent-gray-900"
                  />
                  <Icon className="h-5 w-5 shrink-0 text-gray-500" />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">
                      {label}
                    </span>
                    <span className="block text-xs text-gray-500">{description}</span>
                  </span>
                </label>

                {value === 'cash_change' && paymentMethod === 'cash_change' && (
                  <div className="mt-2 pl-9">
                    <input
                      type="number"
                      min={primaryItem?.price ?? 0}
                      step="1"
                      inputMode="numeric"
                      value={amountHandedOver}
                      onChange={(e) => setAmountHandedOver(e.target.value)}
                      placeholder="Amount handing over (Rs.)"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {primaryItem
                        ? `Must be at least Rs. ${primaryItem.price} (price of ${primaryItem.name}).`
                        : 'Select a primary item first.'}
                    </p>
                  </div>
                )}

                {value === 'card' && paymentMethod === 'card' && (
                  <div className="mt-2 pl-9">
                    <input
                      type="text"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="Card label (optional), e.g. Commercial Bank"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Helps the runner return the right card.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </fieldset>

        {submitError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit || submitting || (!editingId && !runOpen)}
          className="w-full rounded-lg bg-gray-900 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting
            ? editingId
              ? 'Updating order…'
              : 'Placing order…'
            : editingId
              ? 'Update order'
              : 'Place order'}
        </button>

        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="w-full rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 transition hover:border-gray-400"
          >
            Cancel editing
          </button>
        )}
      </form>

      {/* Your orders in this run */}
      {myOrders.length > 0 && (
        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Your orders in this run</h3>
          <ul className="mt-3 space-y-2">
            {myOrders.map((order) => {
              const primary = order.expand?.primary_item
              const fallback = order.expand?.fallback_item
              return (
                <li
                  key={order.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {primary?.name ?? 'Item'}
                      {fallback ? (
                        <span className="font-normal text-gray-500"> — fallback: {fallback.name}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-500">
                      {order.payment_method === 'card'
                        ? `Card${order.payment_note ? ` — ${order.payment_note}` : ''}`
                        : order.amount_handed_over != null
                          ? `Cash — Rs. ${order.amount_handed_over}`
                          : 'Cash'}
                    </p>
                  </div>
                  {runOpen && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditOrder(order)}
                        className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:border-gray-400"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelOrder(order)}
                        className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {!runOpen && (
            <p className="mt-3 text-xs text-gray-500">
              Run locked — orders can no longer be changed.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default OrderScreen
