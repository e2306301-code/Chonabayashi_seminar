import type { MenuDay } from '../domain/menu'
import type { OrderItem, OrderTotals } from '../domain/order'

export type UserRole = 'kiosk' | 'admin'
export type PaymentMethod = 'cash' | 'paypay'
export type SaleStatus = 'recorded' | 'cancelled'

export type StoreAction =
  | 'read-config'
  | 'read-slots'
  | 'read-orders'
  | 'get-checkout'
  | 'advance-ticket-sequence'
  | 'create-order'
  | 'create-checkout'
  | 'read-sales'
  | 'cancel-sale'
  | 'change-menu'
  | 'transition-order'
  | 'delete-history'
  | 'initialize-store'

const ROLE_ACTIONS: Record<UserRole, readonly StoreAction[]> = {
  kiosk: [
    'read-config',
    'read-slots',
    'get-checkout',
    'advance-ticket-sequence',
    'create-order',
    'create-checkout',
  ],
  admin: [
    'read-config',
    'read-slots',
    'read-orders',
    'get-checkout',
    'advance-ticket-sequence',
    'change-menu',
    'transition-order',
    'delete-history',
    'initialize-store',
    'read-sales',
    'cancel-sale',
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
  nextTicketNumber?: TicketNumber
}

export interface SlotRecord extends Partial<OrderTotals> {
  ticketNumber: TicketNumber
  state: SlotState
  orderId?: string
  menuDay?: MenuDay
  items?: OrderItem[]
  createdAt?: unknown
  checkoutId?: string
  paymentMethod?: PaymentMethod
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
  checkoutId?: string
  paymentMethod?: PaymentMethod
}

export interface SaleRecord extends OrderTotals {
  id: string
  checkoutId: string
  orderId: string
  ticketNumber: TicketNumber
  menuDay: MenuDay
  items: OrderItem[]
  paymentMethod: PaymentMethod
  status: SaleStatus
  recordedAt: unknown
  cancelledAt?: unknown
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

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: '現金',
  paypay: 'PayPay',
}
