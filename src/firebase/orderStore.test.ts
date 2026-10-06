import { describe, expect, it, vi } from 'vitest'
import {
  FullCapacityError,
  createOrder,
  getNextTicketNumber,
  getStoreInitializationPlan,
  isAllowedTransition,
  type OrderPersistence,
} from './orderStore'
import type { SlotRecord, TicketNumber } from './types'

function slot(
  ticketNumber: TicketNumber,
  state: SlotRecord['state'],
): SlotRecord {
  return { ticketNumber, state }
}

describe('getNextTicketNumber', () => {
  it('returns the smallest available ticket number', () => {
    expect(
      getNextTicketNumber([
        slot(1, 'received'),
        slot(2, 'available'),
        slot(3, 'ready'),
        slot(4, 'available'),
        slot(5, 'cooking'),
      ]),
    ).toBe(2)
  })

  it('throws when all ten tickets are active', () => {
    expect(() =>
      getNextTicketNumber([
        slot(1, 'received'),
        slot(2, 'cooking'),
        slot(3, 'ready'),
        slot(4, 'received'),
        slot(5, 'cooking'),
        slot(6, 'received'),
        slot(7, 'cooking'),
        slot(8, 'ready'),
        slot(9, 'received'),
        slot(10, 'cooking'),
      ]),
    ).toThrow(FullCapacityError)
  })
})

describe('isAllowedTransition', () => {
  it.each([
    ['received', 'cooking'],
    ['received', 'completed'],
    ['received', 'cancelled'],
    ['cooking', 'ready'],
    ['cooking', 'completed'],
    ['cooking', 'cancelled'],
    ['ready', 'completed'],
    ['ready', 'cancelled'],
  ] as const)('allows %s to become %s', (from, to) => {
    expect(isAllowedTransition(from, to)).toBe(true)
  })

  it.each([
    ['received', 'ready'],
    ['ready', 'cooking'],
  ] as const)('rejects %s to become %s', (from, to) => {
    expect(isAllowedTransition(from, to)).toBe(false)
  })
})

describe('createOrder', () => {
  it('does not call storage for an invalid order', async () => {
    const persistence: OrderPersistence = {
      reserveOrder: vi.fn(),
    }

    await expect(
      createOrder(
        { menuDay: 'day11', items: [] },
        persistence,
      ),
    ).rejects.toThrow('味とカップ数を選んでください')
    expect(persistence.reserveOrder).not.toHaveBeenCalled()
  })

  it('returns the physical ticket number assigned by storage', async () => {
    const persistence: OrderPersistence = {
      reserveOrder: vi.fn().mockResolvedValue({
        orderId: 'order-123',
        ticketNumber: 3,
      }),
    }

    await expect(
      createOrder(
        {
          menuDay: 'day11',
          items: [{ flavorId: 'nori-salt', cups: 2 }],
        },
        persistence,
      ),
    ).resolves.toEqual({ orderId: 'order-123', ticketNumber: 3 })
  })

  it('reports a communication failure without inventing a ticket number', async () => {
    const persistence: OrderPersistence = {
      reserveOrder: vi.fn().mockRejectedValue(new Error('network unavailable')),
    }

    await expect(
      createOrder(
        {
          menuDay: 'day12',
          items: [{ flavorId: 'consomme', cups: 1 }],
        },
        persistence,
      ),
    ).rejects.toThrow('network unavailable')
  })
})

describe('getStoreInitializationPlan', () => {
  it('keeps an existing active menu setting when an administrator logs in again', () => {
    expect(getStoreInitializationPlan(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], true)).toEqual({
      initializeConfig: false,
      missingTickets: [],
    })
  })

  it('initializes only missing ticket slots and a missing config', () => {
    expect(getStoreInitializationPlan(['1', '3', '10'], false)).toEqual({
      initializeConfig: true,
      missingTickets: [2, 4, 5, 6, 7, 8, 9],
    })
  })
})
