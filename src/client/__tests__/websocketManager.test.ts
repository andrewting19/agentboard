import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { ServerMessage } from '@shared/types'
import { WebSocketManager } from '../hooks/useWebSocket'

class FakeWebSocket {
  static OPEN = 1
  static CLOSED = 3
  static instances: FakeWebSocket[] = []

  readyState = FakeWebSocket.OPEN
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }

  triggerOpen() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  triggerMessage(payload: string) {
    this.onmessage?.({ data: payload })
  }

  triggerError() {
    this.onerror?.()
  }
}

type TimerEntry = { id: number; callback: () => void; delay: number }

const globalAny = globalThis as typeof globalThis & {
  window?: unknown
  WebSocket?: unknown
}
const originalWindow = globalAny.window
const originalWebSocket = globalAny.WebSocket

let timers: TimerEntry[] = []
let nextTimerId = 1

beforeEach(() => {
  timers = []
  nextTimerId = 1
  FakeWebSocket.instances = []

  globalAny.window = {
    location: { protocol: 'http:', host: 'localhost:1234' },
    setTimeout: (callback: () => void, delay: number) => {
      const id = nextTimerId++
      timers.push({ id, callback, delay })
      return id
    },
    clearTimeout: (id: number) => {
      timers = timers.filter((timer) => timer.id !== id)
    },
  } as typeof window

  globalAny.WebSocket = FakeWebSocket as unknown as typeof WebSocket
})

afterEach(() => {
  globalAny.window = originalWindow
  globalAny.WebSocket = originalWebSocket
})

describe('WebSocketManager', () => {
  test('connects and emits status updates', () => {
    const manager = new WebSocketManager()
    const statuses: string[] = []
    manager.subscribeStatus((status) => {
      statuses.push(status)
    })

    manager.connect()
    const ws = FakeWebSocket.instances[0]
    ws?.triggerOpen()

    expect(statuses[0]).toBe('connecting')
    expect(statuses[statuses.length - 1]).toBe('connected')
  })

  test('delivers messages and ignores malformed payloads', () => {
    const manager = new WebSocketManager()
    const messages: ServerMessage[] = []
    manager.subscribe((message) => messages.push(message))

    manager.connect()
    const ws = FakeWebSocket.instances[0]
    ws?.triggerMessage(JSON.stringify({ type: 'sessions', sessions: [] }))
    ws?.triggerMessage('{bad-json}')

    expect(messages).toHaveLength(1)
    expect(messages[0]?.type).toBe('sessions')
  })

  test('schedules reconnect on close and reconnects', () => {
    const manager = new WebSocketManager()
    const statuses: string[] = []
    manager.subscribeStatus((status) => statuses.push(status))

    manager.connect()
    const ws = FakeWebSocket.instances[0]
    ws?.triggerOpen()
    ws?.close()

    expect(statuses[statuses.length - 1]).toBe('reconnecting')
    expect(timers).toHaveLength(1)
    expect(timers[0]?.delay).toBe(1000)

    timers[0]?.callback()
    expect(FakeWebSocket.instances).toHaveLength(2)
  })

  test('disconnect stops reconnect and marks disconnected', () => {
    const manager = new WebSocketManager()
    const statuses: string[] = []
    manager.subscribeStatus((status) => statuses.push(status))

    manager.connect()
    const ws = FakeWebSocket.instances[0]
    ws?.triggerOpen()

    manager.disconnect()
    expect(statuses[statuses.length - 1]).toBe('disconnected')
  })

  test('send writes to open sockets only', () => {
    const manager = new WebSocketManager()
    manager.connect()
    const ws = FakeWebSocket.instances[0]
    ws?.triggerOpen()

    manager.send({ type: 'session-refresh' })
    expect(ws?.sent).toHaveLength(1)

    if (ws) {
      ws.readyState = FakeWebSocket.CLOSED
    }
    manager.send({ type: 'session-refresh' })
    expect(ws?.sent).toHaveLength(1)
  })

  test('error events update status with message', () => {
    const manager = new WebSocketManager()
    const statuses: Array<{ status: string; error: string | null }> = []
    manager.subscribeStatus((status, error) => {
      statuses.push({ status, error })
    })

    manager.connect()
    const ws = FakeWebSocket.instances[0]
    ws?.triggerError()

    expect(statuses[statuses.length - 1]).toEqual({
      status: 'error',
      error: 'WebSocket error',
    })
  })
})
