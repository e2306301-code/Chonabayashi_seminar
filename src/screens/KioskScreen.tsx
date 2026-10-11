import { useMemo, useRef, useState } from 'react'
import { getFlavor, getMenuForDay, MENU_DAY_LABELS, type FlavorId, type MenuDay } from '../domain/menu'
import { calculateTotals, MAX_CUPS_PER_ORDER, type CheckoutDraft } from '../domain/order'
import { FullCapacityError, type CheckoutReservation } from '../firebase/orderStore'
import { MAX_ACTIVE_ORDERS, PAYMENT_METHOD_LABELS, type PaymentMethod, type SlotRecord } from '../firebase/types'
import { FlavorCard } from '../components/FlavorCard'
import { OrderSummary } from '../components/OrderSummary'

interface KioskScreenProps {
  menuDay: MenuDay
  slots: SlotRecord[]
  onSubmit: (draft: CheckoutDraft) => Promise<CheckoutReservation>
  onSignOut: () => void
}

export function KioskScreen({ menuDay, slots, onSubmit, onSignOut }: KioskScreenProps) {
  const menu = getMenuForDay(menuDay)
  const [quantities, setQuantities] = useState<Partial<Record<FlavorId, number>>>({})
  const [reservation, setReservation] = useState<CheckoutReservation | null>(null)
  const [stage, setStage] = useState<'selection' | 'checkout'>('selection')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const checkoutIdRef = useRef<string | null>(null)

  const items = useMemo(
    () =>
      menu
        .map((flavor) => ({ flavorId: flavor.id, cups: quantities[flavor.id] ?? 0 }))
        .filter((item) => item.cups > 0),
    [menu, quantities],
  )
  const totals = calculateTotals(items)
  const isFull =
    slots.filter((slot) => slot.state !== 'available').length >= MAX_ACTIVE_ORDERS

  function changeQuantity(flavorId: FlavorId, cups: number) {
    if (cups < 0 || totals.totalCups - (quantities[flavorId] ?? 0) + cups > MAX_CUPS_PER_ORDER) return
    setQuantities((current) => ({ ...current, [flavorId]: cups }))
    setError('')
  }

  function startCheckout() {
    if (totals.totalCups === 0 || isFull) return
    checkoutIdRef.current ??= crypto.randomUUID()
    setStage('checkout')
    setError('')
  }

  async function submitOrder() {
    if (
      submittingRef.current ||
      totals.totalCups === 0 ||
      isFull ||
      !paymentMethod ||
      !checkoutIdRef.current
    ) return
    if (!navigator.onLine) {
      setError('インターネットに接続してから再度お試しください')
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setError('')
    try {
      setReservation(await onSubmit({
        checkoutId: checkoutIdRef.current,
        menuDay,
        items,
        paymentMethod,
      }))
    } catch (cause) {
      setError(
        cause instanceof FullCapacityError
          ? cause.message
          : '通信を確認して、もう一度お試しください',
      )
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function nextCustomer() {
    setQuantities({})
    setReservation(null)
    setStage('selection')
    setPaymentMethod(null)
    checkoutIdRef.current = null
    setError('')
  }

  if (reservation) {
    return (
      <main className="ticket-screen">
        <div className="ticket-panel">
          <p className="ticket-panel__brand">ちょなちょナゲット</p>
          <h1>受付番号</h1>
          <div className="ticket-number">{reservation.ticketNumber}</div>
          <p className="ticket-panel__message">
            スタッフから同じ番号の番号札を受け取ってください
          </p>
          <button type="button" className="button button--next" onClick={nextCustomer}>
            次の注文へ
          </button>
        </div>
      </main>
    )
  }

  if (stage === 'checkout') {
    return (
      <main className="checkout-screen">
        <section className="checkout-panel" aria-labelledby="checkout-heading">
          <p className="brand-kicker">ちょなちょナゲット</p>
          <h1 id="checkout-heading">注文内容とお支払いの確認</h1>
          <p className="checkout-panel__day">{MENU_DAY_LABELS[menuDay]}のメニュー</p>

          <ul className="checkout-items">
            {items.map((item) => (
              <li key={item.flavorId}>
                <span>{getFlavor(item.flavorId)?.name ?? item.flavorId}</span>
                <strong>{item.cups}カップ</strong>
              </li>
            ))}
          </ul>

          <div className="checkout-totals">
            <span>合計 {totals.totalCups}カップ・{totals.totalPieces}個</span>
            <strong>{totals.totalAmount.toLocaleString('ja-JP')}円</strong>
          </div>

          <fieldset className="payment-methods">
            <legend>お支払い方法を選んでください</legend>
            {(['cash', 'paypay'] as const).map((method) => (
              <button
                key={method}
                type="button"
                className={paymentMethod === method ? 'is-selected' : ''}
                aria-label={`${PAYMENT_METHOD_LABELS[method]}で支払う`}
                aria-pressed={paymentMethod === method}
                disabled={submitting}
                onClick={() => {
                  setPaymentMethod(method)
                  setError('')
                }}
              >
                <span aria-hidden="true">{method === 'cash' ? '💴' : '📱'}</span>
                {PAYMENT_METHOD_LABELS[method]}
              </button>
            ))}
          </fieldset>

          {error && <p className="alert alert--error" role="alert">{error}</p>}
          <button
            type="button"
            className="button button--order button--wide"
            disabled={!paymentMethod || submitting || isFull}
            onClick={() => void submitOrder()}
          >
            {submitting ? '売上を登録中…' : '売上を登録して受付番号を発行'}
          </button>
          <button
            type="button"
            className="text-button checkout-back"
            disabled={submitting}
            onClick={() => {
              setStage('selection')
              setError('')
            }}
          >
            注文内容へ戻る
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="kiosk-shell">
      <header className="app-header">
        <div>
          <p className="brand-kicker">ちょなちょナゲット</p>
          <h1>ご注文</h1>
        </div>
        <div className="header-meta">
          <span className="day-badge">{MENU_DAY_LABELS[menuDay]}のメニュー</span>
          <button type="button" className="text-button" onClick={onSignOut}>端末設定</button>
        </div>
      </header>

      {isFull ? (
        <section className="capacity-notice" role="status">
          <span aria-hidden="true">⏳</span>
          <div>
            <h2>ただいま受付上限です</h2>
            <p>受け取りが完了すると、次の注文を受付できます。</p>
          </div>
        </section>
      ) : (
        <div className="availability-banner">
          受付できます・空き {slots.filter((slot) => slot.state === 'available').length}組
        </div>
      )}

      <section className="menu-section" aria-labelledby="menu-heading">
        <div className="section-heading">
          <div>
            <p>1カップ 4個入り・300円</p>
            <h2 id="menu-heading">味とカップ数を選んでください</h2>
          </div>
          <span>最大 {MAX_CUPS_PER_ORDER}カップ</span>
        </div>
        <div className="flavor-grid">
          {menu.map((flavor) => (
            <FlavorCard
              key={flavor.id}
              flavor={flavor}
              cups={quantities[flavor.id] ?? 0}
              disabled={isFull || totals.totalCups >= MAX_CUPS_PER_ORDER}
              onChange={(cups) => changeQuantity(flavor.id, cups)}
            />
          ))}
        </div>
      </section>

      {error && <p className="alert alert--error kiosk-error" role="alert">{error}</p>}
      <OrderSummary
        totals={totals}
        disabled={totals.totalCups === 0 || isFull}
        onSubmit={startCheckout}
      />
    </main>
  )
}
