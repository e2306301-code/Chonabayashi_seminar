import type { MenuDay } from '../domain/menu'
import type { OrderItem, OrderTotals } from '../domain/order'

export type UserRole = 'kiosk' | 'admin'

export type StoreAction =
  | 'read-config'
  | 'read-slots'
  | 'read-orders'
  | 'create-order'
  | 'change-menu'
  | 'transition-order'
  | 'delete-history'
  | 'initialize-store'

const ROLE_ACTIONS: Record<UserRole, readonly StoreAction[]> = {
  kiosk: ['read-config', 'read-slots', 'create-order'],
  admin: [
    'read-config',
    'read-slots',
    'read-orders',
    'change-menu',
    'transition-order',
    'delete-history',
    'initialize-store',
  ],
}

export function canPerform(
  role: UserRole | null,
  action: StoreAction,
): boolean {
  return role !== null && ROLE_ACTIONS[role].includes(action)
}

export type ActiveOrderStatus = 'received' | 'cooking' | 'ready'
export type ClosedOrderStatus = 'completed' | 'cancelled'
export type OrderStatus = ActiveOrderStatus | ClosedOrderStatus
export type SlotState = 'available' | ActiveOrderStatus
export const TICKET_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
export const MAX_ACTIVE_ORDERS = TICKET_NUMBERS.length
export type TicketNumber = (typeof TICKET_NUMBERS)[number]

export interface StoreConfig {
  activeMenuDay: MenuDay
}

export interface SlotRecord extends Partial<OrderTotals> {
  ticketNumber: TicketNumber
  state: SlotState
  orderId?: string
  menuDay?: MenuDay
  items?: OrderItem[]
  createdAt?: unknown
}

export interface OrderRecord extends OrderTotals {
  id: string
  ticketNumber: TicketNumber
  menuDay: MenuDay
  items: OrderItem[]
  status: OrderStatus
  createdAt: unknown
  updatedAt: unknown
  closedAt?: unknown
}

export interface SessionUser {
  uid: string
  email: string | null
  role: UserRole
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: '受付済み',
  cooking: '調理中',
  ready: '受け渡し待ち',
  completed: '完了',
  cancelled: '取消',
}
