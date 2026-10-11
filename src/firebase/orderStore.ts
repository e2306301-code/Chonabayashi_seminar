import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type { MenuDay } from '../domain/menu'
import {
  calculateTotals,
  validateOrder,
  type CheckoutDraft,
  type OrderDraft,
} from '../domain/order'
import { getFirebaseServices } from './client'
import {
  TICKET_NUMBERS,
  type ActiveOrderStatus,
  type ClosedOrderStatus,
  type OrderRecord,
  type OrderStatus,
  type SaleRecord,
  type SlotRecord,
  type StoreConfig,
  type TicketNumber,
} from './types'

export class FullCapacityError extends Error {
  constructor() {
    super('ただいま受付上限です。空きが出るまでお待ちください')
    this.name = 'FullCapacityError'
  }
}

export interface OrderReservation {
  orderId: string
  ticketNumber: TicketNumber
}

export interface CheckoutReservation extends OrderReservation {
  checkoutId: string
}

export interface OrderPersistence {
  reserveOrder(draft: OrderDraft): Promise<OrderReservation>
}

export interface CheckoutPersistence {
  reserveCheckout(draft: CheckoutDraft): Promise<CheckoutReservation>
}

export function getNextTicketNumber(
  slots: readonly SlotRecord[],
): TicketNumber {
  const available = slots
    .filter((slot) => slot.state === 'available')
    .map((slot) => slot.ticketNumber)
    .sort((a, b) => a - b)[0]
  if (!available) throw new FullCapacityError()
  return available
}

const ALLOWED_TRANSITIONS: Record<
  ActiveOrderStatus,
  readonly OrderStatus[]
> = {
  received: ['cooking', 'completed', 'cancelled'],
  cooking: ['ready', 'completed', 'cancelled'],
  ready: ['completed', 'cancelled'],
}

export function isAllowedTransition(
  from: ActiveOrderStatus,
  to: OrderStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function getSaleCancellationEffect(
  orderStatus: OrderStatus | null,
): { cancelOrder: boolean; releaseSlot: boolean } {
  const active =
    orderStatus !== null && ['received', 'cooking', 'ready'].includes(orderStatus)
  return { cancelOrder: active, releaseSlot: active }
}

export async function createOrder(
  draft: OrderDraft,
  persistence: OrderPersistence = firestoreOrderPersistence,
): Promise<OrderReservation> {
  const validationError = validateOrder(draft.items, draft.menuDay)
  if (validationError) throw new Error(validationError)
  return persistence.reserveOrder(draft)
}

export async function registerCheckout(
  draft: CheckoutDraft,
  persistence: CheckoutPersistence = firestoreCheckoutPersistence,
): Promise<CheckoutReservation> {
  const validationError = validateOrder(draft.items, draft.menuDay)
  if (validationError) throw new Error(validationError)
  if (!draft.paymentMethod || !['cash', 'paypay'].includes(draft.paymentMethod)) {
    throw new Error('支払い方法を選んでください')
  }
  if (!draft.checkoutId.trim()) throw new Error('会計IDが正しくありません')
  return persistence.reserveCheckout(draft)
}

function asSlot(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): SlotRecord {
  return snapshot.data() as SlotRecord
}

class FirestoreOrderPersistence implements OrderPersistence {
  async reserveOrder(draft: OrderDraft): Promise<OrderReservation> {
    const { db } = getFirebaseServices()
    const orderRef = doc(collection(db, 'orders'))
    const slotRefs = TICKET_NUMBERS.map((ticket) =>
      doc(db, 'slots', String(ticket)),
    )

    return runTransaction(db, async (transaction) => {
      const slotSnapshots = await Promise.all(
        slotRefs.map((slotRef) => transaction.get(slotRef)),
      )
      const slots = slotSnapshots.map((snapshot, index) =>
        snapshot.exists()
          ? (snapshot.data() as SlotRecord)
          : ({ ticketNumber: (index + 1) as TicketNumber, state: 'available' } satisfies SlotRecord),
      )
      const ticketNumber = getNextTicketNumber(slots)
      const totals = calculateTotals(draft.items)
      const order = {
        ticketNumber,
        menuDay: draft.menuDay,
        items: draft.items,
        ...totals,
        status: 'received' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      transaction.set(orderRef, order)
      transaction.set(slotRefs[ticketNumber - 1], {
        ticketNumber,
        state: 'received',
        orderId: orderRef.id,
        menuDay: draft.menuDay,
        items: draft.items,
        ...totals,
        createdAt: serverTimestamp(),
      })
      return { orderId: orderRef.id, ticketNumber }
    })
  }
}

export const firestoreOrderPersistence: OrderPersistence =
  new FirestoreOrderPersistence()

class FirestoreCheckoutPersistence implements CheckoutPersistence {
  async reserveCheckout(draft: CheckoutDraft): Promise<CheckoutReservation> {
    const { db } = getFirebaseServices()
    const orderRef = doc(db, 'orders', draft.checkoutId)
    const saleRef = doc(db, 'sales', draft.checkoutId)
    const slotRefs = TICKET_NUMBERS.map((ticket) =>
      doc(db, 'slots', String(ticket)),
    )

    return runTransaction(db, async (transaction) => {
      const [existingOrder, existingSale, ...slotSnapshots] = await Promise.all([
        transaction.get(orderRef),
        transaction.get(saleRef),
        ...slotRefs.map((slotRef) => transaction.get(slotRef)),
      ])
      if (existingOrder.exists() || existingSale.exists()) {
        if (!existingOrder.exists() || !existingSale.exists()) {
          throw new Error('会計データが不完全です。管理者へ連絡してください')
        }
        const order = existingOrder.data() as OrderRecord
        return {
          checkoutId: draft.checkoutId,
          orderId: draft.checkoutId,
          ticketNumber: order.ticketNumber,
        }
      }

      const slots = slotSnapshots.map((snapshot, index) =>
        snapshot.exists()
          ? (snapshot.data() as SlotRecord)
          : ({ ticketNumber: (index + 1) as TicketNumber, state: 'available' } satisfies SlotRecord),
      )
      const ticketNumber = getNextTicketNumber(slots)
      const totals = calculateTotals(draft.items)
      const timestamp = serverTimestamp()
      const common = {
        checkoutId: draft.checkoutId,
        ticketNumber,
        menuDay: draft.menuDay,
        items: draft.items,
        paymentMethod: draft.paymentMethod,
        ...totals,
      }
      transaction.set(orderRef, {
        ...common,
        status: 'received',
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      transaction.set(saleRef, {
        ...common,
        orderId: draft.checkoutId,
        status: 'recorded',
        recordedAt: timestamp,
      })
      transaction.set(slotRefs[ticketNumber - 1], {
        ...common,
        state: 'received',
        orderId: draft.checkoutId,
        createdAt: timestamp,
      })
      return {
        checkoutId: draft.checkoutId,
        orderId: draft.checkoutId,
        ticketNumber,
      }
    })
  }
}

export const firestoreCheckoutPersistence: CheckoutPersistence =
  new FirestoreCheckoutPersistence()

export function observeSlots(
  callback: (slots: SlotRecord[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const { db } = getFirebaseServices()
  return onSnapshot(
    collection(db, 'slots'),
    (snapshot) => {
      const records = snapshot.docs.map(asSlot)
      callback(
        TICKET_NUMBERS.map(
          (ticketNumber) =>
            records.find((slot) => slot.ticketNumber === ticketNumber) ?? {
              ticketNumber,
              state: 'available',
            },
        ),
      )
    },
    (error) => onError?.(error),
  )
}

export function observeStoreConfig(
  callback: (config: StoreConfig) => void,
  onError?: (error: Error) => void,
): () => void {
  const { db } = getFirebaseServices()
  return onSnapshot(
    doc(db, 'config', 'store'),
    (snapshot) => {
      if (snapshot.exists()) callback(snapshot.data() as StoreConfig)
    },
    (error) => onError?.(error),
  )
}

export function observeOrderHistory(
  callback: (orders: OrderRecord[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const { db } = getFirebaseServices()
  const historyQuery = query(
    collection(db, 'orders'),
    orderBy('createdAt', 'desc'),
    limit(50),
  )
  return onSnapshot(
    historyQuery,
    (snapshot) =>
      callback(
        snapshot.docs.map(
          (record) => ({ id: record.id, ...record.data() }) as OrderRecord,
        ),
      ),
    (error) => onError?.(error),
  )
}

export function observeSales(
  callback: (sales: SaleRecord[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const { db } = getFirebaseServices()
  const salesQuery = query(collection(db, 'sales'), orderBy('recordedAt', 'desc'))
  return onSnapshot(
    salesQuery,
    (snapshot) =>
      callback(
        snapshot.docs.map(
          (record) => ({ id: record.id, ...record.data() }) as SaleRecord,
        ),
      ),
    (error) => onError?.(error),
  )
}

export async function transitionOrder(
  ticketNumber: TicketNumber,
  nextStatus: ActiveOrderStatus | ClosedOrderStatus,
): Promise<void> {
  const { db } = getFirebaseServices()
  const slotRef = doc(db, 'slots', String(ticketNumber))
  await runTransaction(db, async (transaction) => {
    const slotSnapshot = await transaction.get(slotRef)
    if (!slotSnapshot.exists()) throw new Error('受付番号が見つかりません')
    const slot = slotSnapshot.data() as SlotRecord
    if (slot.state === 'available' || !slot.orderId) {
      throw new Error('この受付番号には注文がありません')
    }
    if (!isAllowedTransition(slot.state, nextStatus)) {
      throw new Error('この状態には変更できません')
    }
    const orderRef = doc(db, 'orders', slot.orderId)
    const orderSnapshot = await transaction.get(orderRef)
    if (!orderSnapshot.exists()) throw new Error('注文履歴が見つかりません')
    const saleRef = doc(db, 'sales', slot.checkoutId ?? slot.orderId)
    const saleSnapshot = await transaction.get(saleRef)

    transaction.update(orderRef, {
      status: nextStatus,
      updatedAt: serverTimestamp(),
      ...(nextStatus === 'completed' || nextStatus === 'cancelled'
        ? { closedAt: serverTimestamp() }
        : {}),
    })
    if (nextStatus === 'completed' || nextStatus === 'cancelled') {
      transaction.set(slotRef, { ticketNumber, state: 'available' })
    } else {
      transaction.update(slotRef, { state: nextStatus })
    }
    if (nextStatus === 'cancelled' && saleSnapshot.exists()) {
      transaction.update(saleRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
      })
    }
  })
}

export async function cancelSale(sale: SaleRecord): Promise<void> {
  const { db } = getFirebaseServices()
  const saleRef = doc(db, 'sales', sale.id)
  const orderRef = doc(db, 'orders', sale.orderId)
  await runTransaction(db, async (transaction) => {
    const [saleSnapshot, orderSnapshot] = await Promise.all([
      transaction.get(saleRef),
      transaction.get(orderRef),
    ])
    if (!saleSnapshot.exists()) throw new Error('売上履歴が見つかりません')
    const currentSale = saleSnapshot.data() as SaleRecord
    if (currentSale.status === 'cancelled') return

    const order = orderSnapshot.exists()
      ? ({ id: orderSnapshot.id, ...orderSnapshot.data() } as OrderRecord)
      : null
    const effect = getSaleCancellationEffect(order?.status ?? null)
    const slotRef = effect.releaseSlot && order
      ? doc(db, 'slots', String(order.ticketNumber))
      : null
    const slotSnapshot = slotRef ? await transaction.get(slotRef) : null

    transaction.update(saleRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
    })
    if (effect.cancelOrder && order) {
      transaction.update(orderRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
        closedAt: serverTimestamp(),
      })
      if (
        slotRef &&
        slotSnapshot?.exists() &&
        (slotSnapshot.data() as SlotRecord).orderId === order.id
      ) {
        transaction.set(slotRef, {
          ticketNumber: order.ticketNumber,
          state: 'available',
        })
      }
    }
  })
}

export async function deleteOrderHistory(orderId: string): Promise<void> {
  const { db } = getFirebaseServices()
  await deleteDoc(doc(db, 'orders', orderId))
}

export async function setActiveMenuDay(day: MenuDay): Promise<void> {
  const { db } = getFirebaseServices()
  await setDoc(doc(db, 'config', 'store'), { activeMenuDay: day }, { merge: true })
}

export async function ensureStoreInitialized(
  db: Firestore = getFirebaseServices().db,
): Promise<void> {
  const [slotsSnapshot, configSnapshot] = await Promise.all([
    getDocs(collection(db, 'slots')),
    getDoc(doc(db, 'config', 'store')),
  ])
  const plan = getStoreInitializationPlan(
    slotsSnapshot.docs.map((slot) => slot.id),
    configSnapshot.exists(),
  )
  const writes: Promise<void>[] = plan.missingTickets.map((ticketNumber) =>
    setDoc(doc(db, 'slots', String(ticketNumber)), {
      ticketNumber,
      state: 'available',
    }),
  )
  if (plan.initializeConfig) {
    writes.push(
      setDoc(doc(db, 'config', 'store'), {
        activeMenuDay: 'day11' satisfies MenuDay,
      }),
    )
  }
  await Promise.all(writes)
}

export function getStoreInitializationPlan(
  existingSlotIds: readonly string[],
  configExists: boolean,
): { initializeConfig: boolean; missingTickets: TicketNumber[] } {
  const existing = new Set(existingSlotIds)
  return {
    initializeConfig: !configExists,
    missingTickets: TICKET_NUMBERS.filter(
      (ticketNumber) => !existing.has(String(ticketNumber)),
    ),
  }
}
