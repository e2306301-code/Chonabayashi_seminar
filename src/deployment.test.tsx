import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { registerServiceWorker } from './pwa/register'

describe('deployment safeguards', () => {
  it('shows setup guidance instead of a broken login when Firebase variables are missing', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'Firebaseの初期設定が必要です' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/docs\/FIREBASE_SETUP\.md/)).toBeInTheDocument()
  })

  it('registers the service worker under the GitHub Pages project subpath', async () => {
    const register = vi.fn().mockResolvedValue(undefined)
    await registerServiceWorker(
      { serviceWorker: { register } },
      '/Chonabayashi_seminar/',
    )
    expect(register).toHaveBeenCalledWith('/Chonabayashi_seminar/sw.js')
  })

  it('does nothing when service workers are unavailable', async () => {
    await expect(
      registerServiceWorker({}, '/Chonabayashi_seminar/'),
    ).resolves.toBeUndefined()
  })
})
