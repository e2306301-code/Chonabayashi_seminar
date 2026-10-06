import type { OrderTotals } from '../domain/order'

interface OrderSummaryProps {
  totals: OrderTotals
  disabled: boolean
  busy: boolean
  onSubmit: () => void
}

export function OrderSummary({
  totals,
  disabled,
  busy,
  onSubmit,
}: OrderSummaryProps) {
  return (
    <aside className="order-summary">
      <div>
        <p className="order-summary__cups">合計 {totals.totalCups}カップ</p>
        <p className="order-summary__pieces">{totals.totalPieces}個</p>
      </div>
      <p className="order-summary__amount">{totals.totalAmount.toLocaleString('ja-JP')}円</p>
      <button
        type="button"
        className="button button--order"
        disabled={disabled || busy}
        onClick={onSubmit}
      >
        {busy ? '注文を送信中…' : 'この内容で注文する'}
      </button>
    </aside>
  )
}
