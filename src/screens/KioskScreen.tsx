import { useMemo, useRef, useState } from 'react'
import { getMenuForDay, MENU_DAY_LABELS, type FlavorId, type MenuDay } from '../domain/menu'
import { calculateTotals, MAX_CUPS_PER_ORDER, type OrderDraft } from '../domain/order'
import { FullCapacityError, type OrderReservation } from '../firebase/orderStore'
import { MAX_ACTIVE_ORDERS, type SlotRecord } from '../firebase/types'
import { FlavorCard } from '../components/FlavorCard'
import { OrderSummary } from '../components/OrderSummary'

interface KioskScreenProps {
  menuDay: MenuDay
  slots: SlotRecord[]
  onSubmit: (draft: OrderDraft) => Promise<OrderReservation>
  onSignOut: () => void
}

export function KioskScreen({ menuDay, slots, onSubmit, onSignOut }: KioskScreenProps) {
  const menu = getMenuForDay(menuDay)
  const [quantities, setQuantities] = useState<Partial<Record<FlavorId, number>>>({})
  const [reservation, setReservation] = useState<OrderReservation | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

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

  async function submitOrder() {
    if (submittingRef.current || totals.totalCups === 0 || isFull) return
    submittingRef.current = true
    setSubmitting(true)
    setError('')
    try {
      setReservation(await onSubmit({ menuDay, items }))
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
        busy={submitting}
        onSubmit={submitOrder}
      />
    </main>
  )
}
