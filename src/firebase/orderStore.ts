import {
  collection,
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
  type OrderDraft,
} from '../domain/order'
import { getFirebaseServices } from './client'
import {
  TICKET_NUMBERS,
  type ActiveOrderStatus,
  type ClosedOrderStatus,
  type OrderRecord,
  type OrderStatus,
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

export interface OrderPersistence {
  reserveOrder(draft: OrderDraft): Promise<OrderReservation>
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
  received: ['cooking', 'cancelled'],
  cooking: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
}

export function isAllowedTransition(
  from: ActiveOrderStatus,
  to: OrderStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export async function createOrder(
  draft: OrderDraft,
  persistence: OrderPersistence = firestoreOrderPersistence,
): Promise<OrderReservation> {
  const validationError = validateOrder(draft.items, draft.menuDay)
  if (validationError) throw new Error(validationError)
  return persistence.reserveOrder(draft)
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
  })
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
