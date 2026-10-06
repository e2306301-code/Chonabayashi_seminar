import { useEffect, useState } from 'react'
import type { MenuDay } from './domain/menu'
import { signIn, signOut, observeSession } from './firebase/auth'
import { isFirebaseConfigured } from './firebase/client'
import {
  createOrder,
  deleteOrderHistory,
  ensureStoreInitialized,
  observeOrderHistory,
  observeSlots,
  observeStoreConfig,
  setActiveMenuDay,
  transitionOrder,
} from './firebase/orderStore'
import {
  TICKET_NUMBERS,
  type OrderRecord,
  type SessionUser,
  type SlotRecord,
} from './firebase/types'
import { LoginScreen } from './screens/LoginScreen'
import { KioskScreen } from './screens/KioskScreen'
import { AdminScreen } from './screens/AdminScreen'

const EMPTY_SLOTS: SlotRecord[] = TICKET_NUMBERS.map(
  (ticketNumber) => ({ ticketNumber, state: 'available' }),
)

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [menuDay, setMenuDay] = useState<MenuDay>('day11')
  const [slots, setSlots] = useState<SlotRecord[]>(EMPTY_SLOTS)
  const [history, setHistory] = useState<OrderRecord[]>([])
  const [connectionError, setConnectionError] = useState('')

  useEffect(() => {
    if (!isFirebaseConfigured) return
    return observeSession(
      (session) => {
        setUser(session)
        setAuthReady(true)
      },
      () => {
        setConnectionError('ログイン状態を確認できませんでした')
        setAuthReady(true)
      },
    )
  }, [])

  useEffect(() => {
    if (!user) return
    const handleError = () => setConnectionError('データを受信できません。通信を確認してください。')
    const unsubscribeConfig = observeStoreConfig(
      (config) => {
        setMenuDay(config.activeMenuDay)
        setConnectionError('')
      },
      handleError,
    )
    const unsubscribeSlots = observeSlots(
      (nextSlots) => {
        setSlots(nextSlots)
        setConnectionError('')
      },
      handleError,
    )
    let unsubscribeHistory: () => void = () => undefined
    if (user.role === 'admin') {
      void ensureStoreInitialized().catch(handleError)
      unsubscribeHistory = observeOrderHistory(setHistory, handleError)
    }
    return () => {
      unsubscribeConfig()
      unsubscribeSlots()
      unsubscribeHistory()
    }
  }, [user])

  if (!isFirebaseConfigured) {
    return (
      <main className="setup-shell">
        <section className="setup-card">
          <div className="brand-mark" aria-hidden="true">🍗</div>
          <h1>Firebaseの初期設定が必要です</h1>
          <p>リポジトリ内の <code>docs/FIREBASE_SETUP.md</code> に沿って設定してください。</p>
        </section>
      </main>
    )
  }

  if (!authReady) {
    return <main className="loading-screen"><span className="spinner" />読み込み中…</main>
  }

  if (!user) {
    const mode = window.location.hash.startsWith('#/admin') ? 'admin' : 'kiosk'
    return <LoginScreen mode={mode} onLogin={signIn} />
  }

  return (
    <>
      {connectionError && <div className="connection-banner" role="alert">{connectionError}</div>}
      {user.role === 'admin' ? (
        <AdminScreen
          menuDay={menuDay}
          slots={slots}
          history={history}
          onMenuDayChange={setActiveMenuDay}
          onTransition={transitionOrder}
          onDeleteHistory={deleteOrderHistory}
          onSignOut={() => void signOut()}
        />
      ) : (
        <KioskScreen
          menuDay={menuDay}
          slots={slots}
          onSubmit={createOrder}
          onSignOut={() => void signOut()}
        />
      )}
    </>
  )
}
