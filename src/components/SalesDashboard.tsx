import { useMemo, useState } from 'react'
import { createSalesCsv, summarizeSales, type SalesPeriod } from '../domain/sales'
import { getFlavor, MENU_DAY_LABELS } from '../domain/menu'
import {
  PAYMENT_METHOD_LABELS,
  type SaleRecord,
} from '../firebase/types'

interface SalesDashboardProps {
  sales: SaleRecord[]
  onCancelSale: (sale: SaleRecord) => Promise<void>
}

const PERIOD_LABELS: Record<SalesPeriod, string> = {
  day11: '10月11日',
  day12: '10月12日',
  all: '2日間合計',
}

function formatTime(value: unknown): string {
  let date: Date | null = null
  if (value instanceof Date) date = value
  else if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) date = value.toDate() as Date
  if (!date || Number.isNaN(date.getTime())) return '時刻不明'
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  }).format(date)
}

export function SalesDashboard({ sales, onCancelSale }: SalesDashboardProps) {
  const [period, setPeriod] = useState<SalesPeriod>('day11')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const summary = useMemo(() => summarizeSales(sales, period), [sales, period])
  const periodSales = sales.filter((sale) => period === 'all' || sale.menuDay === period)

  async function handleCancel(sale: SaleRecord) {
    if (
      busyId ||
      !window.confirm(`受付番号${sale.ticketNumber}の売上を取り消しますか？`)
    ) return
    setBusyId(sale.id)
    setError('')
    try {
      await onCancelSale(sale)
    } catch {
      setError('売上を取り消せませんでした。通信を確認してください。')
    } finally {
      setBusyId(null)
    }
  }

  function downloadCsv() {
    const blob = new Blob([createSalesCsv(sales, period)], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ちょなちょナゲット売上_${period}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="sales-dashboard" aria-labelledby="sales-heading">
      <div className="sales-heading-row">
        <div>
          <p>取消済みを除いて自動集計します</p>
          <h2 id="sales-heading">売上管理</h2>
        </div>
        <button type="button" className="button button--primary" onClick={downloadCsv}>
          売上CSVをダウンロード
        </button>
      </div>

      <div className="sales-period-switcher" aria-label="売上の表示期間">
        {(['day11', 'day12', 'all'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={period === value ? 'is-active' : ''}
            aria-label={`${PERIOD_LABELS[value]}の売上を表示`}
            onClick={() => setPeriod(value)}
          >
            {PERIOD_LABELS[value]}
          </button>
        ))}
      </div>

      <div className="sales-metrics">
        <article data-metric="total"><span>総売上</span><strong>{summary.totalAmount.toLocaleString('ja-JP')}円</strong></article>
        <article data-metric="cash"><span>現金売上</span><strong>{summary.cashAmount.toLocaleString('ja-JP')}円</strong></article>
        <article data-metric="paypay"><span>想定PayPay売上</span><strong>{summary.paypayAmount.toLocaleString('ja-JP')}円</strong></article>
        <article><span>会計件数</span><strong>{summary.transactionCount}件</strong></article>
        <article><span>販売カップ数</span><strong>{summary.totalCups}カップ</strong></article>
      </div>

      <section className="flavor-sales" aria-labelledby="flavor-sales-heading">
        <h3 id="flavor-sales-heading">味ごとの販売割合</h3>
        <ul>
          {summary.flavors.map((flavor) => (
            <li key={flavor.flavorId} aria-label={`${getFlavor(flavor.flavorId)?.name ?? flavor.flavorId}の売上割合`}>
              <div><span>{getFlavor(flavor.flavorId)?.name ?? flavor.flavorId}</span><strong>{flavor.cups}カップ</strong><b>{flavor.percentage.toFixed(1)}%</b></div>
              <div className="flavor-sales__bar"><span style={{ width: `${flavor.percentage}%` }} /></div>
            </li>
          ))}
        </ul>
      </section>

      {error && <p className="alert alert--error" role="alert">{error}</p>}

      <section className="sales-history" aria-labelledby="sales-history-heading">
        <h3 id="sales-history-heading">売上履歴</h3>
        {periodSales.length === 0 ? (
          <p>売上はまだありません。</p>
        ) : (
          <div className="history-table-wrap">
            <table>
              <thead><tr><th>時刻</th><th>番号</th><th>注文内容</th><th>支払い</th><th>金額</th><th>状態</th><th>操作</th></tr></thead>
              <tbody>
                {periodSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{formatTime(sale.recordedAt)}</td>
                    <td>{sale.ticketNumber}</td>
                    <td>{sale.items.map((item) => `${getFlavor(item.flavorId)?.name ?? item.flavorId} ${item.cups}`).join('、')}</td>
                    <td>{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</td>
                    <td>{sale.totalAmount.toLocaleString('ja-JP')}円</td>
                    <td>{sale.status === 'recorded' ? '登録済み' : '取消済み'}</td>
                    <td>
                      {sale.status === 'recorded' && (
                        <button
                          type="button"
                          className="history-delete-button"
                          aria-label={`受付番号${sale.ticketNumber}の売上を取り消す`}
                          disabled={busyId === sale.id}
                          onClick={() => void handleCancel(sale)}
                        >
                          売上取消
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
