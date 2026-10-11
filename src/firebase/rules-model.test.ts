import { describe, expect, it } from 'vitest'
import { canPerform, type StoreAction } from './types'

describe('authorization model mirrored by Firestore rules', () => {
  it.each<StoreAction>([
    'read-config',
    'read-slots',
    'create-order',
    'create-checkout',
  ])('allows a kiosk to %s', (action) => {
    expect(canPerform('kiosk', action)).toBe(true)
  })

  it.each<StoreAction>([
    'change-menu',
    'transition-order',
    'delete-history',
    'initialize-store',
    'read-sales',
    'cancel-sale',
  ])('does not allow a kiosk to %s', (action) => {
    expect(canPerform('kiosk', action)).toBe(false)
  })

  it('allows an administrator to read and manage the store', () => {
    const actions: StoreAction[] = [
      'read-config',
      'read-slots',
      'read-orders',
      'change-menu',
      'transition-order',
      'delete-history',
      'initialize-store',
      'read-sales',
      'cancel-sale',
    ]
    expect(actions.every((action) => canPerform('admin', action))).toBe(true)
  })

  it('does not allow an administrator to create a kiosk order', () => {
    expect(canPerform('admin', 'create-order')).toBe(false)
  })

  it('does not allow a signed-out visitor to perform any store action', () => {
    const actions: StoreAction[] = [
      'read-config',
      'read-slots',
      'read-orders',
      'create-order',
      'create-checkout',
      'change-menu',
      'transition-order',
      'delete-history',
      'initialize-store',
      'read-sales',
      'cancel-sale',
    ]
    expect(actions.some((action) => canPerform(null, action))).toBe(false)
  })
})
