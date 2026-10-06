import { useState, type FormEvent } from 'react'
import type { SessionUser } from '../firebase/types'

interface LoginScreenProps {
  mode: 'kiosk' | 'admin'
  onLogin: (email: string, password: string) => Promise<SessionUser>
}

export function LoginScreen({ mode, onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const user = await onLogin(email.trim(), password)
      if (user.role !== mode) {
        setError(
          mode === 'admin'
            ? '管理者アカウントでログインしてください'
            : '注文端末アカウントでログインしてください',
        )
      }
    } catch {
      setError('メールアドレスまたはパスワードを確認してください')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark" aria-hidden="true">🍗</div>
        <p className="brand-kicker">ちょなちょナゲット</p>
        <h1>{mode === 'admin' ? 'スタッフ管理画面' : '注文端末を開始'}</h1>
        <p className="login-card__description">
          {mode === 'admin'
            ? '管理者アカウントでログインしてください。'
            : '店舗の注文端末アカウントで最初の一度だけログインします。'}
        </p>
        <form onSubmit={handleSubmit}>
          <label>
            メールアドレス
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            パスワード
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <p role="alert" className="alert alert--error">{error}</p>}
          <button type="submit" className="button button--primary button--wide" disabled={busy}>
            {busy ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>
        <a className="mode-link" href={mode === 'admin' ? '#/' : '#/admin'}>
          {mode === 'admin' ? '注文端末を開く' : 'スタッフ管理画面を開く'}
        </a>
      </section>
    </main>
  )
}
