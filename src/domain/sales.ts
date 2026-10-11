import { FLAVORS, MENU_DAY_LABELS, getFlavor, type FlavorId, type MenuDay } from './menu'
import {
  PAYMENT_METHOD_LABELS,
  type SaleRecord,
} from '../firebase/types'

export type SalesPeriod = MenuDay | 'all'

export interface FlavorSalesSummary {
  flavorId: FlavorId
  cups: number
  percentage: number
}

export interface SalesSummary {
  totalAmount: number
  cashAmount: number
  paypayAmount: number
  transactionCount: number
  totalCups: number
  flavors: FlavorSalesSummary[]
}

function inPeriod(sale: SaleRecord, period: SalesPeriod): boolean {
  return period === 'all' || sale.menuDay === period
}

export function summarizeSales(
  sales: readonly SaleRecord[],
  period: SalesPeriod,
): SalesSummary {
  const recorded = sales.filter(
    (sale) => sale.status === 'recorded' && inPeriod(sale, period),
  )
  const totalCups = recorded.reduce((sum, sale) => sum + sale.totalCups, 0)
  const cupsByFlavor = new Map<FlavorId, number>()
  for (const sale of recorded) {
    for (const item of sale.items) {
      cupsByFlavor.set(
        item.flavorId,
        (cupsByFlavor.get(item.flavorId) ?? 0) + item.cups,
      )
    }
  }

  return {
    totalAmount: recorded.reduce((sum, sale) => sum + sale.totalAmount, 0),
    cashAmount: recorded
      .filter((sale) => sale.paymentMethod === 'cash')
      .reduce((sum, sale) => sum + sale.totalAmount, 0),
    paypayAmount: recorded
      .filter((sale) => sale.paymentMethod === 'paypay')
      .reduce((sum, sale) => sum + sale.totalAmount, 0),
    transactionCount: recorded.length,
    totalCups,
    flavors: FLAVORS.map((flavor) => {
      const cups = cupsByFlavor.get(flavor.id) ?? 0
      return {
        flavorId: flavor.id,
        cups,
        percentage: totalCups === 0 ? 0 : (cups / totalCups) * 100,
      }
    }),
  }
}

const CSV_HEADERS = [
  '会計ID',
  '売上登録日時',
  '営業日',
  '受付番号',
  '注文内容',
  '合計カップ数',
  '合計個数',
  '合計金額',
  '支払い方法',
  '状態',
  '取消日時',
]

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    return value.toDate() as Date
  }
  return null
}

function formatDateTime(value: unknown): string {
  const date = toDate(value)
  if (!date || Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  }).format(date)
}

function escapeCsv(value: string | number): string {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function createSalesCsv(
  sales: readonly SaleRecord[],
  period: SalesPeriod,
): string {
  const rows = sales
    .filter((sale) => inPeriod(sale, period))
    .map((sale) => [
      sale.checkoutId,
      formatDateTime(sale.recordedAt),
      MENU_DAY_LABELS[sale.menuDay],
      sale.ticketNumber,
      sale.items
        .map((item) => `${getFlavor(item.flavorId)?.name ?? item.flavorId} ${item.cups}カップ`)
        .join(' / '),
      sale.totalCups,
      sale.totalPieces,
      sale.totalAmount,
      PAYMENT_METHOD_LABELS[sale.paymentMethod],
      sale.status === 'recorded' ? '登録済み' : '取消済み',
      formatDateTime(sale.cancelledAt),
    ])
  return `\uFEFF${[CSV_HEADERS, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n')}`
}
