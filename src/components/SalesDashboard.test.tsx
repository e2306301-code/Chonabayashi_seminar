import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SaleRecord } from '../firebase/types'
import { SalesDashboard } from './SalesDashboard'

function sale(overrides: Partial<SaleRecord> = {}): SaleRecord {
  return {
    id: 'sale-1',
    checkoutId: 'sale-1',
    orderId: 'sale-1',
    ticketNumber: 1,
    menuDay: 'day11',
    items: [
      { flavorId: 'plain', cups: 1 },
      { flavorId: 'salt-lemon', cups: 1 },
    ],
    totalCups: 2,
    totalPieces: 8,
    totalAmount: 600,
    paymentMethod: 'cash',
    status: 'recorded',
    recordedAt: { toDate: () => new Date('2026-10-11T01:15:00.000Z') },
    ...overrides,
  }
}

afterEach(() => vi.restoreAllMocks())

describe('SalesDashboard', () => {
  it('shows payment totals, flavor shares, and switches sales periods', async () => {
    const user = userEvent.setup()
    render(
      <SalesDashboard
        sales={[
          sale(),
          sale({
            id: 'paypay',
            checkoutId: 'paypay',
            orderId: 'paypay',
            ticketNumber: 2,
            paymentMethod: 'paypay',
            items: [{ flavorId: 'plain', cups: 2 }],
            totalCups: 2,
          }),
          sale({ id: 'cancelled', status: 'cancelled', totalAmount: 900 }),
          sale({ id: 'day12', menuDay: 'day12', totalAmount: 300, totalCups: 1 }),
        ]}
        onCancelSale={vi.fn()}
      />,
    )

    expect(screen.getByText('1,200円', { selector: '[data-metric="total"] strong' })).toBeInTheDocument()
    expect(screen.getByText('600円', { selector: '[data-metric="cash"] strong' })).toBeInTheDocument()
    expect(screen.getByText('600円', { selector: '[data-metric="paypay"] strong' })).toBeInTheDocument()
    const plain = screen.getByRole('listitem', { name: 'プレーンの売上割合' })
    expect(within(plain).getByText('3カップ')).toBeInTheDocument()
    expect(within(plain).getByText('75.0%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '2日間合計の売上を表示' }))
    expect(screen.getByText('1,500円', { selector: '[data-metric="total"] strong' })).toBeInTheDocument()
  })

  it('shows cancelled records and confirms cancellation only once', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onCancelSale = vi.fn().mockResolvedValue(undefined)
    render(
      <SalesDashboard
        sales={[sale(), sale({ id: 'cancelled', status: 'cancelled', ticketNumber: 2 })]}
        onCancelSale={onCancelSale}
      />,
    )

    expect(screen.getByText('取消済み')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '受付番号2の売上を取り消す' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '受付番号1の売上を取り消す' }))
    expect(confirm).toHaveBeenCalledWith('受付番号1の売上を取り消しますか？')
    expect(onCancelSale).toHaveBeenCalledWith(expect.objectContaining({ id: 'sale-1' }))
  })

  it('downloads the selected period as a CSV file', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn().mockReturnValue('blob:test')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    render(<SalesDashboard sales={[sale()]} onCancelSale={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '売上CSVをダウンロード' }))
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })
})
