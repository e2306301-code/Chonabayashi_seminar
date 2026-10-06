import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { KioskScreen } from './KioskScreen'
import type { SlotRecord } from '../firebase/types'

const availableSlots: SlotRecord[] = ([1, 2, 3, 4, 5] as const).map(
  (ticketNumber) => ({ ticketNumber, state: 'available' }),
)

describe('KioskScreen', () => {
  it('shows daily flavors and updates the order totals with touch controls', async () => {
    const user = userEvent.setup()
    render(
      <KioskScreen
        menuDay="day11"
        slots={availableSlots}
        onSubmit={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: '味とカップ数を選んでください' })).toBeInTheDocument()
    expect(screen.getByText('のり塩')).toBeInTheDocument()
    expect(screen.queryByText('明太子バター')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '塩レモンを1カップ増やす' }))
    await user.click(screen.getByRole('button', { name: '塩レモンを1カップ増やす' }))
    await user.click(screen.getByRole('button', { name: 'のり塩を1カップ増やす' }))

    expect(screen.getByText('合計 3カップ')).toBeInTheDocument()
    expect(screen.getByText('12個')).toBeInTheDocument()
    expect(screen.getByText('900円')).toBeInTheDocument()
  })

  it('submits once, shows the assigned number, and resets for the next customer', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue({
      orderId: 'order-1',
      ticketNumber: 1,
    })
    render(
      <KioskScreen
        menuDay="day12"
        slots={availableSlots}
        onSubmit={onSubmit}
        onSignOut={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'コンソメを1カップ増やす' }))
    const submit = screen.getByRole('button', { name: 'この内容で注文する' })
    await Promise.all([user.click(submit), user.click(submit)])

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByText('受付番号')).toBeInTheDocument()
    expect(screen.getByText('1', { selector: '.ticket-number' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '次の注文へ' }))
    expect(screen.getByText('合計 0カップ')).toBeInTheDocument()
  })

  it('stops accepting orders while all five tickets are active', () => {
    const fullSlots: SlotRecord[] = ([1, 2, 3, 4, 5] as const).map(
      (ticketNumber) => ({ ticketNumber, state: 'received' }),
    )
    render(
      <KioskScreen
        menuDay="day11"
        slots={fullSlots}
        onSubmit={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'ただいま受付上限です' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'この内容で注文する' })).toBeDisabled()
  })

  it('keeps the order editable and shows a clear message after a network failure', async () => {
    const user = userEvent.setup()
    render(
      <KioskScreen
        menuDay="day11"
        slots={availableSlots}
        onSubmit={vi.fn().mockRejectedValue(new Error('network'))}
        onSignOut={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: '塩レモンを1カップ増やす' }))
    await user.click(screen.getByRole('button', { name: 'この内容で注文する' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      '通信を確認して、もう一度お試しください',
    )
    expect(screen.getByText('合計 1カップ')).toBeInTheDocument()
  })
})
