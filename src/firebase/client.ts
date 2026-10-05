import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'] as const

export const isFirebaseConfigured = requiredConfigKeys.every(
  (key) => typeof firebaseConfig[key] === 'string' && firebaseConfig[key].length > 0,
)

export class FirebaseConfigurationError extends Error {
  constructor() {
    super('Firebaseの接続設定が完了していません')
    this.name = 'FirebaseConfigurationError'
  }
}

let services: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null

export function getFirebaseServices(): {
  app: FirebaseApp
  auth: Auth
  db: Firestore
} {
  if (!isFirebaseConfigured) {
    throw new FirebaseConfigurationError()
  }
  if (services) return services

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
  services = { app, auth: getAuth(app), db: getFirestore(app) }
  return services
}
