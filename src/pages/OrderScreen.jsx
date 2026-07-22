import { useEffect, useState } from 'react'
import { IsoBanknote, IsoCoins, IsoCreditCard, IsoCheckCircle, IsoBell, IsoBellRing } from '../components/icons'
import LoadingScreen from '../components/LoadingScreen'
import { getAvailableMenuItems, getCurrentRun, createOrder } from '../lib/api'
import { subscribeToPush, isPushSupported } from '../lib/push'

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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [coworkerName, setCoworkerName] = useState('')
  const [primaryId, setPrimaryId] = useState('')
  const [fallbackId, setFallbackId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('exact_cash')
  const [amountHandedOver, setAmountHandedOver] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [notifyState, setNotifyState] = useState('idle') // idle | working | done | error

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const currentRun = await getCurrentRun()
        if (cancelled) return
        setRun(currentRun)
        if (currentRun) {
          const items = await getAvailableMenuItems()
          if (!cancelled) setMenuItems(items)
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

  const primaryItem = menuItems.find((item) => item.id === primaryId) ?? null
  const fallbackItem = menuItems.find((item) => item.id === fallbackId) ?? null
  const fallbackItems = menuItems.filter((item) => item.id !== primaryId)
  const paymentLabel = PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label

  const amount = Number(amountHandedOver)
  const isAmountValid =
    paymentMethod !== 'cash_change' ||
    (amountHandedOver !== '' && primaryItem !== null && amount >= primaryItem.price)

  const canSubmit = coworkerName.trim() !== '' && primaryItem !== null && isAmountValid

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || submitting) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      await createOrder({
        coworker_name: coworkerName.trim(),
        primary_item_id: primaryId,
        fallback_item_id: fallbackId || null,
        payment_method: paymentMethod === 'card' ? 'card' : 'cash',
        amount_handed_over:
          paymentMethod === 'exact_cash'
            ? primaryItem.price
            : paymentMethod === 'cash_change'
              ? amount
              : null,
      })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message ?? 'Failed to place the order')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setCoworkerName('')
    setPrimaryId('')
    setFallbackId('')
    setPaymentMethod('exact_cash')
    setAmountHandedOver('')
    setSubmitError(null)
    setNotifyState('idle')
    setSubmitted(false)
  }

  async function handleNotify() {
    setNotifyState('working')
    try {
      await subscribeToPush(coworkerName.trim() || null)
      setNotifyState('done')
    } catch {
      setNotifyState('error')
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
              <dd className="font-medium">{paymentLabel}</dd>
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
          <h2 className="text-lg font-semibold text-gray-900">Join today&apos;s run</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Pick your items and payment method below.
          </p>
        </div>

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
          disabled={!canSubmit || submitting}
          className="w-full rounded-lg bg-gray-900 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'Placing order…' : 'Place order'}
        </button>
      </form>
    </div>
  )
}

export default OrderScreen
