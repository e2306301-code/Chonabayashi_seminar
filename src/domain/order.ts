import { getMenuForDay, type FlavorId, type MenuDay } from './menu'

export const PRICE_PER_CUP = 300
export const PIECES_PER_CUP = 4
export const MAX_CUPS_PER_ORDER = 20

export interface OrderItem {
  flavorId: FlavorId
  cups: number
}

export interface OrderDraft {
  menuDay: MenuDay
  items: OrderItem[]
}

export interface OrderTotals {
  totalCups: number
  totalPieces: number
  totalAmount: number
}

export function calculateTotals(items: readonly OrderItem[]): OrderTotals {
  const totalCups = items.reduce((sum, item) => sum + item.cups, 0)
  return {
    totalCups,
    totalPieces: totalCups * PIECES_PER_CUP,
    totalAmount: totalCups * PRICE_PER_CUP,
  }
}

export function validateOrder(
  items: readonly OrderItem[],
  day: MenuDay,
): string | null {
  if (items.length === 0) {
    return '味とカップ数を選んでください'
  }

  if (items.some((item) => !Number.isInteger(item.cups) || item.cups <= 0)) {
    return 'カップ数が正しくありません'
  }

  const availableFlavorIds = new Set(
    getMenuForDay(day).map((flavor) => flavor.id),
  )
  if (items.some((item) => !availableFlavorIds.has(item.flavorId))) {
    return '選択できない味が含まれています'
  }

  const flavorIds = items.map((item) => item.flavorId)
  if (new Set(flavorIds).size !== flavorIds.length) {
    return '同じ味が重複しています'
  }

  if (calculateTotals(items).totalCups > MAX_CUPS_PER_ORDER) {
    return `1回の注文は${MAX_CUPS_PER_ORDER}カップまでです`
  }

  return null
}
