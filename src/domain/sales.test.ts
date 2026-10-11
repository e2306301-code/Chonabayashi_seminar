import { describe, expect, it } from 'vitest'
import type { SaleRecord } from '../firebase/types'
import { createSalesCsv, summarizeSales } from './sales'

function sale(overrides: Partial<SaleRecord> = {}): SaleRecord {
  return {
    id: 'sale-1',
    checkoutId: 'sale-1',
    orderId: 'sale-1',
    ticketNumber: 1,
    menuDay: 'day11',
    items: [{ flavorId: 'plain', cups: 2 }],
    totalCups: 2,
    totalPieces: 8,
    totalAmount: 600,
    paymentMethod: 'cash',
    status: 'recorded',
    recordedAt: { toDate: () => new Date('2026-10-11T01:15:00.000Z') },
    ...overrides,
  }
}

describe('summarizeSales', () => {
  it('summarizes only recorded sales in the selected day', () => {
    const summary = summarizeSales([
      sale(),
      sale({
        id: 'sale-2',
        checkoutId: 'sale-2',
        orderId: 'sale-2',
        ticketNumber: 2,
        paymentMethod: 'paypay',
        items: [
          { flavorId: 'plain', cups: 1 },
          { flavorId: 'salt-lemon', cups: 1 },
        ],
      }),
      sale({ id: 'cancelled', status: 'cancelled' }),
      sale({ id: 'day12', menuDay: 'day12', totalAmount: 300 }),
    ], 'day11')

    expect(summary).toMatchObject({
      totalAmount: 1200,
      cashAmount: 600,
      paypayAmount: 600,
      transactionCount: 2,
      totalCups: 4,
    })
    expect(summary.flavors.find((item) => item.flavorId === 'plain')).toEqual({
      flavorId: 'plain',
      cups: 3,
      percentage: 75,
    })
    expect(summary.flavors.find((item) => item.flavorId === 'salt-lemon')).toEqual({
      flavorId: 'salt-lemon',
      cups: 1,
      percentage: 25,
    })
  })

  it('includes both days for all and returns zero percentages with no recorded sales', () => {
    const bothDays = summarizeSales([
      sale(),
      sale({ id: 'day12', menuDay: 'day12', totalAmount: 300, totalCups: 1 }),
    ], 'all')
    expect(bothDays.transactionCount).toBe(2)

    const empty = summarizeSales([sale({ status: 'cancelled' })], 'all')
    expect(empty.totalAmount).toBe(0)
    expect(empty.flavors.every((item) => item.percentage === 0)).toBe(true)
  })
})

describe('createSalesCsv', () => {
  it('exports recorded and cancelled sales with a BOM and Japanese timestamps', () => {
    const csv = createSalesCsv([
      sale(),
      sale({
        id: 'cancelled',
        checkoutId: 'cancelled',
        orderId: 'cancelled',
        ticketNumber: 2,
        status: 'cancelled',
        paymentMethod: 'paypay',
        cancelledAt: { toDate: () => new Date('2026-10-11T02:30:00.000Z') },
      }),
    ], 'day11')

    expect(csv.startsWith('\uFEFF会計ID,売上登録日時,営業日,受付番号')).toBe(true)
    expect(csv).toContain('sale-1,2026/10/11 10:15,10月11日,1,プレーン 2カップ,2,8,600,現金,登録済み,')
    expect(csv).toContain('cancelled,2026/10/11 10:15,10月11日,2,プレーン 2カップ,2,8,600,PayPay,取消済み,2026/10/11 11:30')
  })
})
