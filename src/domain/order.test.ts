import { describe, expect, it } from 'vitest'
import { getMenuForDay } from './menu'
import { calculateTotals, validateOrder } from './order'

describe('calculateTotals', () => {
  it('calculates cups, pieces, and amount at four pieces and 300 yen per cup', () => {
    expect(
      calculateTotals([
        { flavorId: 'salt-lemon', cups: 2 },
        { flavorId: 'chili-cheese', cups: 1 },
      ]),
    ).toEqual({ totalCups: 3, totalPieces: 12, totalAmount: 900 })
  })
})

describe('daily menu', () => {
  it('offers the three common flavors and the two day-11 flavors', () => {
    expect(getMenuForDay('day11').map((flavor) => flavor.id)).toEqual([
      'salt-lemon',
      'chili-cheese',
      'sour-cream',
      'nori-salt',
      'strong-garlic',
    ])
  })

  it('offers the three common flavors and the two day-12 flavors', () => {
    expect(getMenuForDay('day12').map((flavor) => flavor.id)).toEqual([
      'salt-lemon',
      'chili-cheese',
      'sour-cream',
      'mentaiko-butter',
      'consomme',
    ])
  })
})

describe('validateOrder', () => {
  it('rejects an empty order', () => {
    expect(validateOrder([], 'day11')).toBe('味とカップ数を選んでください')
  })

  it.each([0, -1, 1.5])('rejects an invalid cup count: %s', (cups) => {
    expect(validateOrder([{ flavorId: 'salt-lemon', cups }], 'day11')).toBe(
      'カップ数が正しくありません',
    )
  })

  it('rejects a flavor that is unavailable on the selected day', () => {
    expect(
      validateOrder([{ flavorId: 'mentaiko-butter', cups: 1 }], 'day11'),
    ).toBe('選択できない味が含まれています')
  })

  it('rejects duplicate flavors', () => {
    expect(
      validateOrder(
        [
          { flavorId: 'salt-lemon', cups: 1 },
          { flavorId: 'salt-lemon', cups: 1 },
        ],
        'day11',
      ),
    ).toBe('同じ味が重複しています')
  })

  it('rejects more than 20 cups in one order', () => {
    expect(validateOrder([{ flavorId: 'salt-lemon', cups: 21 }], 'day11')).toBe(
      '1回の注文は20カップまでです',
    )
  })

  it('accepts a valid mixed order', () => {
    expect(
      validateOrder(
        [
          { flavorId: 'salt-lemon', cups: 2 },
          { flavorId: 'strong-garlic', cups: 1 },
        ],
        'day11',
      ),
    ).toBeNull()
  })
})
