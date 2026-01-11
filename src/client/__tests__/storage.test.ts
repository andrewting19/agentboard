import { afterEach, describe, expect, test } from 'bun:test'
import { safeStorage } from '../utils/storage'

const globalAny = globalThis as any
const originalLocalStorage = globalAny.localStorage

afterEach(() => {
  if (originalLocalStorage === undefined) {
    delete globalAny.localStorage
  } else {
    globalAny.localStorage = originalLocalStorage
  }
})

function createStorage() {
  const store = new Map<string, string>()
  return {
    store,
    storage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    } as Storage,
  }
}

describe('safeStorage', () => {
  test('uses memory storage when localStorage is missing', () => {
    delete globalAny.localStorage

    safeStorage.setItem('memory-key', 'value')
    expect(safeStorage.getItem('memory-key')).toBe('value')

    safeStorage.removeItem('memory-key')
    expect(safeStorage.getItem('memory-key')).toBeNull()
  })

  test('uses localStorage when available', () => {
    const { storage, store } = createStorage()
    globalAny.localStorage = storage

    safeStorage.setItem('local-key', 'local-value')
    expect(store.get('local-key')).toBe('local-value')
    expect(safeStorage.getItem('local-key')).toBe('local-value')

    safeStorage.removeItem('local-key')
    expect(store.has('local-key')).toBe(false)
  })

  test('falls back to memory storage on localStorage errors', () => {
    globalAny.localStorage = {
      getItem: () => {
        throw new Error('read-failed')
      },
      setItem: () => {
        throw new Error('write-failed')
      },
      removeItem: () => {
        throw new Error('remove-failed')
      },
    } as unknown as Storage

    safeStorage.setItem('fallback-key', 'fallback')
    expect(safeStorage.getItem('fallback-key')).toBe('fallback')

    safeStorage.removeItem('fallback-key')
    expect(safeStorage.getItem('fallback-key')).toBeNull()
  })
})
