import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { KioskScreen } from './KioskScreen'
import type { SlotRecord } from '../firebase/types'

const availableSlots: SlotRecord[] = ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map(
  (ticketNumber) => ({ ticketNumber, state: 'available' }),
)

describe('KioskScreen', () => {
  it('shows daily flavors and updates the order totals with touch controls', async () => {
    const user = userEvent.setup()
    render(
      <KioskScreen menuDay="day11" slots={availableSlots} onSubmit={vi.fn()} onSignOut={vi.fn()} />,
    )

    expect(screen.getByRole('heading', { name: '味とカップ数を選んでください' })).toBeInTheDocument()
    expect(screen.getByText('プレーン')).toBeInTheDocument()
    expect(screen.getByText('のり塩')).toBeInTheDocument()
    expect(screen.queryByText('明太子バター')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'プレーンを1カップ増やす' }))
    await user.click(screen.getByRole('button', { name: '塩レモンを1カップ増やす' }))
    await user.click(screen.getByRole('button', { name: 'のり塩を1カップ増やす' }))

    expect(screen.getByText('合計 3カップ')).toBeInTheDocument()
    expect(screen.getByText('12個')).toBeInTheDocument()
    expect(screen.getByText('900円')).toBeInTheDocument()
  })

  it('reviews the order, requires payment, submits once, and resets for the next customer', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue({ checkoutId: 'checkout-1', orderId: 'checkout-1', ticketNumber: 1 })
    render(
      <KioskScreen menuDay="day12" slots={availableSlots} onSubmit={onSubmit} onSignOut={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: 'コンソメを1カップ増やす' }))
    await user.click(screen.getByRole('button', { name: 'お会計へ' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: '注文内容とお支払いの確認' })).toBeInTheDocument()
    const register = screen.getByRole('button', { name: '売上を登録して受付番号を発行' })
    expect(register).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '現金で支払う' }))
    expect(register).toBeEnabled()
    await Promise.all([user.click(register), user.click(register)])

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      checkoutId: expect.any(String),
      menuDay: 'day12',
      items: [{ flavorId: 'consomme', cups: 1 }],
      paymentMethod: 'cash',
    })
    expect(screen.getByText('受付番号')).toBeInTheDocument()
    expect(screen.getByText('1', { selector: '.ticket-number' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '次の注文へ' }))
    expect(screen.getByText('合計 0カップ')).toBeInTheDocument()
  })

  it('returns from checkout to edit the order before registration', async () => {
    const user = userEvent.setup()
    render(
      <KioskScreen menuDay="day11" slots={availableSlots} onSubmit={vi.fn()} onSignOut={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: 'プレーンを1カップ増やす' }))
    await user.click(screen.getByRole('button', { name: 'お会計へ' }))
    await user.click(screen.getByRole('button', { name: '注文内容へ戻る' }))
    await user.click(screen.getByRole('button', { name: 'プレーンを1カップ増やす' }))
    expect(screen.getByText('合計 2カップ')).toBeInTheDocument()
  })

  it('stops accepting orders while all ten tickets are active', () => {
    const fullSlots: SlotRecord[] = ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map(
      (ticketNumber) => ({ ticketNumber, state: 'received' }),
    )
    render(
      <KioskScreen menuDay="day11" slots={fullSlots} onSubmit={vi.fn()} onSignOut={vi.fn()} />,
    )

    expect(screen.getByRole('heading', { name: 'ただいま受付上限です' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'お会計へ' })).toBeDisabled()
  })

  it('keeps the checkout and selected payment after a network failure', async () => {
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
    await user.click(screen.getByRole('button', { name: 'お会計へ' }))
    await user.click(screen.getByRole('button', { name: 'PayPayで支払う' }))
    await user.click(screen.getByRole('button', { name: '売上を登録して受付番号を発行' }))

    expect(screen.getByRole('alert')).toHaveTextContent('通信を確認して、もう一度お試しください')
    expect(screen.getByRole('heading', { name: '注文内容とお支払いの確認' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PayPayで支払う' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('受付番号')).not.toBeInTheDocument()
  })
})
