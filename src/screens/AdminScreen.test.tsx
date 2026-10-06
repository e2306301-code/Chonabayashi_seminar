import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AdminScreen } from './AdminScreen'
import type { OrderRecord, SlotRecord } from '../firebase/types'

const slots: SlotRecord[] = [
  {
    ticketNumber: 1,
    state: 'received',
    orderId: 'order-1',
    menuDay: 'day11',
    items: [
      { flavorId: 'salt-lemon', cups: 2 },
      { flavorId: 'nori-salt', cups: 1 },
    ],
    totalCups: 3,
    totalPieces: 12,
    totalAmount: 900,
    createdAt: { toDate: () => new Date('2026-10-11T01:15:00.000Z') },
  },
  { ticketNumber: 2, state: 'cooking', orderId: 'order-2', items: [], totalCups: 1, totalPieces: 4, totalAmount: 300 },
  { ticketNumber: 3, state: 'ready', orderId: 'order-3', items: [], totalCups: 1, totalPieces: 4, totalAmount: 300 },
  { ticketNumber: 4, state: 'available' },
  { ticketNumber: 5, state: 'available' },
  { ticketNumber: 6, state: 'available' },
  { ticketNumber: 7, state: 'available' },
  { ticketNumber: 8, state: 'available' },
  { ticketNumber: 9, state: 'available' },
  { ticketNumber: 10, state: 'available' },
]

describe('AdminScreen', () => {
  it('shows all ten ticket slots and the complete order details', () => {
    render(
      <AdminScreen
        menuDay="day11"
        slots={slots}
        onMenuDayChange={vi.fn()}
        onTransition={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )

    expect(
      screen.getAllByRole('article', { name: /^受付番号 (?:[1-9]|10)$/ }),
    ).toHaveLength(10)
    expect(screen.getByRole('heading', { name: '受付番号 1〜10' })).toBeInTheDocument()
    const firstOrder = screen.getByRole('article', { name: '受付番号 1' })
    expect(within(firstOrder).getByText('塩レモン')).toBeInTheDocument()
    expect(within(firstOrder).getByText('× 2カップ')).toBeInTheDocument()
    expect(within(firstOrder).getByText('のり塩')).toBeInTheDocument()
    expect(within(firstOrder).getByText('× 1カップ')).toBeInTheDocument()
    expect(within(firstOrder).getByText('合計 3カップ・12個')).toBeInTheDocument()
    expect(within(firstOrder).getByText('900円')).toBeInTheDocument()
    expect(within(firstOrder).getByText('受付 10:15')).toBeInTheDocument()
    expect(screen.getAllByText('空き')).toHaveLength(7)
    expect(screen.getByText('7', { selector: '.admin-summary strong' })).toBeInTheDocument()
  })

  it('provides the correct next action for each active state', async () => {
    const user = userEvent.setup()
    const onTransition = vi.fn().mockResolvedValue(undefined)
    render(
      <AdminScreen
        menuDay="day11"
        slots={slots}
        onMenuDayChange={vi.fn()}
        onTransition={onTransition}
        onSignOut={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: '1番の調理を開始' }))
    await user.click(screen.getByRole('button', { name: '2番を受け渡し待ちにする' }))
    await user.click(screen.getByRole('button', { name: '3番の受け取りを完了' }))

    expect(onTransition).toHaveBeenNthCalledWith(1, 1, 'cooking')
    expect(onTransition).toHaveBeenNthCalledWith(2, 2, 'ready')
    expect(onTransition).toHaveBeenNthCalledWith(3, 3, 'completed')
  })

  it('changes the active daily menu for the kiosk', async () => {
    const user = userEvent.setup()
    const onMenuDayChange = vi.fn().mockResolvedValue(undefined)
    render(
      <AdminScreen
        menuDay="day11"
        slots={slots}
        onMenuDayChange={onMenuDayChange}
        onTransition={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: '10月12日のメニューに切り替える' }))
    expect(onMenuDayChange).toHaveBeenCalledWith('day12')
  })

  it('shows only the selected day in the daily history', () => {
    const history: OrderRecord[] = [
      {
        id: 'day11-order',
        ticketNumber: 1,
        menuDay: 'day11',
        items: [],
        status: 'completed',
        totalCups: 2,
        totalPieces: 8,
        totalAmount: 600,
        createdAt: null,
        updatedAt: null,
      },
      {
        id: 'day12-order',
        ticketNumber: 2,
        menuDay: 'day12',
        items: [],
        status: 'completed',
        totalCups: 4,
        totalPieces: 16,
        totalAmount: 1200,
        createdAt: null,
        updatedAt: null,
      },
      {
        id: 'active-day11-order',
        ticketNumber: 3,
        menuDay: 'day11',
        items: [],
        status: 'cooking',
        totalCups: 5,
        totalPieces: 20,
        totalAmount: 1500,
        createdAt: null,
        updatedAt: null,
      },
    ]
    render(
      <AdminScreen
        menuDay="day11"
        slots={slots}
        history={history}
        onMenuDayChange={vi.fn()}
        onTransition={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )

    expect(screen.getByText('600円')).toBeInTheDocument()
    expect(screen.queryByText('1,200円')).not.toBeInTheDocument()
    expect(screen.queryByText('1,500円')).not.toBeInTheDocument()
  })
})
