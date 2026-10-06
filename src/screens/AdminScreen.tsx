import { useState } from 'react'
import { MENU_DAY_LABELS, type MenuDay } from '../domain/menu'
import type { OrderRecord, OrderStatus, SlotRecord, TicketNumber } from '../firebase/types'
import { OrderCard } from '../components/OrderCard'

interface AdminScreenProps {
  menuDay: MenuDay
  slots: SlotRecord[]
  history?: OrderRecord[]
  onMenuDayChange: (day: MenuDay) => Promise<void>
  onTransition: (ticketNumber: TicketNumber, status: OrderStatus) => Promise<void>
  onSignOut: () => void
}

export function AdminScreen({
  menuDay,
  slots,
  history = [],
  onMenuDayChange,
  onTransition,
  onSignOut,
}: AdminScreenProps) {
  const [busyTickets, setBusyTickets] = useState<Set<TicketNumber>>(new Set())
  const [error, setError] = useState('')
  const activeCount = slots.filter((slot) => slot.state !== 'available').length

  async function handleTransition(ticketNumber: TicketNumber, status: OrderStatus) {
    if (busyTickets.has(ticketNumber)) return
    setBusyTickets((current) => new Set(current).add(ticketNumber))
    setError('')
    try {
      await onTransition(ticketNumber, status)
    } catch {
      setError('状態を更新できませんでした。通信を確認してください。')
    } finally {
      setBusyTickets((current) => {
        const next = new Set(current)
        next.delete(ticketNumber)
        return next
      })
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="brand-kicker">ちょなちょナゲット</p>
          <h1>注文管理</h1>
        </div>
        <div className="admin-header__actions">
          <div className="menu-switcher" aria-label="営業日メニュー">
            {(['day11', 'day12'] as const).map((day) => (
              <button
                key={day}
                type="button"
                className={menuDay === day ? 'is-active' : ''}
                aria-label={`${MENU_DAY_LABELS[day]}のメニューに切り替える`}
                onClick={() => void onMenuDayChange(day)}
              >
                {MENU_DAY_LABELS[day]}
              </button>
            ))}
          </div>
          <button type="button" className="text-button" onClick={onSignOut}>ログアウト</button>
        </div>
      </header>

      <section className="admin-summary">
        <div><strong>{activeCount}</strong><span>受付中</span></div>
        <div><strong>{5 - activeCount}</strong><span>受付可能</span></div>
        <p>現在：{MENU_DAY_LABELS[menuDay]}のメニュー</p>
      </section>

      {error && <p className="alert alert--error" role="alert">{error}</p>}

      <section aria-labelledby="active-orders-heading">
        <div className="section-heading section-heading--admin">
          <div>
            <p>リアルタイムで自動更新されます</p>
            <h2 id="active-orders-heading">受付番号 1〜5</h2>
          </div>
        </div>
        <div className="orders-grid">
          {slots.map((slot) => (
            <OrderCard
              key={slot.ticketNumber}
              slot={slot}
              busy={busyTickets.has(slot.ticketNumber)}
              onTransition={(status) => void handleTransition(slot.ticketNumber, status)}
            />
          ))}
        </div>
      </section>

      <details className="history-panel">
        <summary>本日の注文履歴（最新50件）</summary>
        {history.length === 0 ? (
          <p>履歴はまだありません。</p>
        ) : (
          <div className="history-table-wrap">
            <table>
              <thead><tr><th>番号</th><th>状態</th><th>カップ</th><th>金額</th></tr></thead>
              <tbody>
                {history.map((order) => (
                  <tr key={order.id}>
                    <td>{order.ticketNumber}</td>
                    <td>{order.status === 'completed' ? '完了' : order.status === 'cancelled' ? '取消' : '受付中'}</td>
                    <td>{order.totalCups}</td>
                    <td>{order.totalAmount.toLocaleString('ja-JP')}円</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </main>
  )
}
