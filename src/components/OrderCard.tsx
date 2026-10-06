import { getFlavor } from '../domain/menu'
import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type SlotRecord,
} from '../firebase/types'

interface OrderCardProps {
  slot: SlotRecord
  busy?: boolean
  onTransition: (nextStatus: OrderStatus) => void
}

export function OrderCard({ slot, busy = false, onTransition }: OrderCardProps) {
  if (slot.state === 'available') {
    return (
      <article
        className="order-card order-card--available"
        aria-label={`受付番号 ${slot.ticketNumber}`}
      >
        <h3>受付番号 {slot.ticketNumber}</h3>
        <div className="available-mark">空き</div>
        <p>次の注文を受付できます</p>
      </article>
    )
  }

  const acceptedTime = formatOrderTime(slot.createdAt)
  return (
    <article
      className={`order-card order-card--${slot.state}`}
      aria-label={`受付番号 ${slot.ticketNumber}`}
    >
      <header className="order-card__header">
        <div>
          <span className="order-card__eyebrow">受付番号</span>
          <strong className="order-card__number">{slot.ticketNumber}</strong>
        </div>
        <span className="status-chip">{ORDER_STATUS_LABELS[slot.state]}</span>
      </header>

      {acceptedTime && <p className="order-card__time">受付 {acceptedTime}</p>}

      <ul className="order-items">
        {(slot.items ?? []).map((item) => (
          <li key={item.flavorId}>
            <span>{getFlavor(item.flavorId)?.name ?? item.flavorId}</span>
            <strong>× {item.cups}カップ</strong>
          </li>
        ))}
      </ul>

      <div className="order-card__totals">
        <span>
          合計 {slot.totalCups ?? 0}カップ・{slot.totalPieces ?? 0}個
        </span>
        <strong>{(slot.totalAmount ?? 0).toLocaleString('ja-JP')}円</strong>
      </div>

      <div className="order-card__actions">
        <button
          type="button"
          className="button button--primary"
          aria-label={`${slot.ticketNumber}番の受け取りを完了`}
          disabled={busy}
          onClick={() => onTransition('completed')}
        >
          受け取り完了
        </button>
        <button
          type="button"
          className="button button--danger-quiet"
          aria-label={`${slot.ticketNumber}番の注文を取り消す`}
          disabled={busy}
          onClick={() => onTransition('cancelled')}
        >
          取消
        </button>
      </div>
    </article>
  )
}

function formatOrderTime(value: unknown): string | null {
  let date: Date | null = null
  if (value instanceof Date) {
    date = value
  } else if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    date = value.toDate() as Date
  }
  if (!date || Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  }).format(date)
}
