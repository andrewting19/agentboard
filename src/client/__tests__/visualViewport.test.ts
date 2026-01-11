import { describe, expect, test } from 'bun:test'
import { clearKeyboardInset, updateKeyboardInset } from '../hooks/useVisualViewport'

describe('visual viewport helpers', () => {
  test('updates keyboard inset and clears it', () => {
    const style = {
      value: '',
      setProperty: (_key: string, val: string) => {
        style.value = val
      },
      removeProperty: (_key: string) => {
        style.value = ''
      },
    }
    const doc = {
      documentElement: { style },
    } as unknown as Document
    const win = { innerHeight: 900 } as Window
    const viewport = { height: 700 } as VisualViewport

    const updated = updateKeyboardInset({ viewport, win, doc })
    expect(updated).toBe(true)
    expect(style.value).toBe('200px')

    clearKeyboardInset(doc)
    expect(style.value).toBe('')
  })

  test('returns false when viewport is missing', () => {
    const doc = {
      documentElement: { style: { setProperty: () => {} } },
    } as unknown as Document
    const win = { innerHeight: 900 } as Window

    expect(updateKeyboardInset({ viewport: null, win, doc })).toBe(false)
  })

  test('clamps negative keyboard inset to zero', () => {
    const style = {
      value: '',
      setProperty: (_key: string, val: string) => {
        style.value = val
      },
    }
    const doc = {
      documentElement: { style },
    } as unknown as Document
    const win = { innerHeight: 600 } as Window
    const viewport = { height: 800 } as VisualViewport

    const updated = updateKeyboardInset({ viewport, win, doc })
    expect(updated).toBe(true)
    expect(style.value).toBe('0px')
  })
})
