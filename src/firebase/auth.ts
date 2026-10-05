import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { getFirebaseServices } from './client'
import type { SessionUser, UserRole } from './types'

export async function signIn(
  email: string,
  password: string,
): Promise<SessionUser> {
  const { auth, db } = getFirebaseServices()
  await setPersistence(auth, browserLocalPersistence)
  const credential = await signInWithEmailAndPassword(auth, email, password)
  const roleSnapshot = await getDoc(doc(db, 'users', credential.user.uid))
  const role = roleSnapshot.data()?.role as UserRole | undefined
  if (role !== 'kiosk' && role !== 'admin') {
    await firebaseSignOut(auth)
    throw new Error('このアカウントには利用権限がありません')
  }
  return { uid: credential.user.uid, email: credential.user.email, role }
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseServices().auth)
}

export function observeSession(
  callback: (user: SessionUser | null) => void,
  onError?: (error: Error) => void,
): () => void {
  const { auth, db } = getFirebaseServices()
  return onAuthStateChanged(
    auth,
    async (firebaseUser) => {
      if (!firebaseUser) {
        callback(null)
        return
      }
      try {
        const roleSnapshot = await getDoc(doc(db, 'users', firebaseUser.uid))
        const role = roleSnapshot.data()?.role as UserRole | undefined
        if (role !== 'kiosk' && role !== 'admin') {
          callback(null)
          return
        }
        callback({ uid: firebaseUser.uid, email: firebaseUser.email, role })
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('認証確認に失敗しました'))
      }
    },
    (error) => onError?.(error),
  )
}
