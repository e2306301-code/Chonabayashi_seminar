export type MenuDay = 'day11' | 'day12'

export type FlavorId =
  | 'salt-lemon'
  | 'chili-cheese'
  | 'sour-cream'
  | 'nori-salt'
  | 'strong-garlic'
  | 'mentaiko-butter'
  | 'consomme'

export interface Flavor {
  id: FlavorId
  name: string
  emoji: string
  tone: string
  days: readonly MenuDay[]
}

export const MENU_DAY_LABELS: Record<MenuDay, string> = {
  day11: '10月11日',
  day12: '10月12日',
}

export const FLAVORS: readonly Flavor[] = [
  {
    id: 'salt-lemon',
    name: '塩レモン',
    emoji: '🍋',
    tone: 'lemon',
    days: ['day11', 'day12'],
  },
  {
    id: 'chili-cheese',
    name: 'チリチーズ',
    emoji: '🌶️',
    tone: 'chili',
    days: ['day11', 'day12'],
  },
  {
    id: 'sour-cream',
    name: 'サワークリーム',
    emoji: '🥣',
    tone: 'cream',
    days: ['day11', 'day12'],
  },
  {
    id: 'nori-salt',
    name: 'のり塩',
    emoji: '🌿',
    tone: 'nori',
    days: ['day11'],
  },
  {
    id: 'strong-garlic',
    name: 'ストロングガーリック',
    emoji: '🧄',
    tone: 'garlic',
    days: ['day11'],
  },
  {
    id: 'mentaiko-butter',
    name: '明太子バター',
    emoji: '🧈',
    tone: 'mentaiko',
    days: ['day12'],
  },
  {
    id: 'consomme',
    name: 'コンソメ',
    emoji: '🧂',
    tone: 'consomme',
    days: ['day12'],
  },
]

export function getMenuForDay(day: MenuDay): Flavor[] {
  return FLAVORS.filter((flavor) => flavor.days.includes(day))
}

export function getFlavor(flavorId: FlavorId): Flavor | undefined {
  return FLAVORS.find((flavor) => flavor.id === flavorId)
}
