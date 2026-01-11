import { describe, expect, test } from 'bun:test'
import { getNumAtPoint } from '../components/NumPad'

const CELL_WIDTH = 56
const CELL_HEIGHT = 48
const GAP = 6
const PADDING = 8
const INDICATOR_HEIGHT = 20 + GAP + 2
const PAD_WIDTH = 3 * CELL_WIDTH + 2 * GAP + 2 * PADDING
const PAD_HEIGHT = 3 * CELL_HEIGHT + 2 * GAP + 2 * PADDING + INDICATOR_HEIGHT

describe('NumPad helpers', () => {
  test('maps points to numbers', () => {
    const padPosition = { x: 200, y: 200 }
    const padLeft = padPosition.x - PAD_WIDTH / 2
    const padTop = padPosition.y - PAD_HEIGHT / 2

    // Top-left cell is 7 (calculator-style layout)
    const seven = getNumAtPoint(
      padLeft + PADDING + 1,
      padTop + PADDING + 1,
      padPosition
    )
    expect(seven).toBe('7')

    // Bottom-left cell is 1
    const one = getNumAtPoint(
      padLeft + PADDING + 1,
      padTop + PADDING + (CELL_HEIGHT + GAP) * 2 + 1,
      padPosition
    )
    expect(one).toBe('1')
  })

  test('returns null for gaps and out of bounds', () => {
    const padPosition = { x: 200, y: 200 }
    const padLeft = padPosition.x - PAD_WIDTH / 2
    const padTop = padPosition.y - PAD_HEIGHT / 2

    const inGap = getNumAtPoint(
      padLeft + PADDING + CELL_WIDTH + 1,
      padTop + PADDING + 1,
      padPosition
    )
    expect(inGap).toBeNull()

    const outOfBounds = getNumAtPoint(padLeft - 10, padTop - 10, padPosition)
    expect(outOfBounds).toBeNull()
  })
})
