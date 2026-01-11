import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import TestRenderer, { act } from 'react-test-renderer'
import SettingsModal from '../components/SettingsModal'
import {
  DEFAULT_COMMAND,
  DEFAULT_PROJECT_DIR,
  useSettingsStore,
} from '../stores/settingsStore'

const globalAny = globalThis as typeof globalThis & {
  localStorage?: Storage
}

const originalLocalStorage = globalAny.localStorage

function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

beforeEach(() => {
  globalAny.localStorage = createStorage()
  useSettingsStore.setState({
    defaultProjectDir: '/projects',
    defaultCommand: 'codex',
    lastProjectPath: null,
    sessionSortMode: 'created',
    sessionSortDirection: 'desc',
  })
})

afterEach(() => {
  globalAny.localStorage = originalLocalStorage
  useSettingsStore.setState({
    defaultProjectDir: DEFAULT_PROJECT_DIR,
    defaultCommand: DEFAULT_COMMAND,
    lastProjectPath: null,
    sessionSortMode: 'created',
    sessionSortDirection: 'desc',
  })
})

describe('SettingsModal', () => {
  test('submits trimmed values and falls back to defaults', () => {
    let closed = 0
    let renderer!: TestRenderer.ReactTestRenderer

    act(() => {
      renderer = TestRenderer.create(
        <SettingsModal isOpen onClose={() => { closed += 1 }} />
      )
    })

    const inputs = renderer.root.findAllByType('input')

    act(() => {
      inputs[0].props.onChange({ target: { value: '   ' } })
      inputs[1].props.onChange({ target: { value: '   ' } })
    })

    const statusButton = renderer.root
      .findAllByType('button')
      .find((button) => button.props.children === 'Status')

    if (!statusButton) {
      throw new Error('Expected status button')
    }

    act(() => {
      statusButton.props.onClick()
    })

    const form = renderer.root.findByType('form')

    act(() => {
      form.props.onSubmit({ preventDefault: () => {} })
    })

    const state = useSettingsStore.getState()
    expect(state.defaultProjectDir).toBe(DEFAULT_PROJECT_DIR)
    expect(state.defaultCommand).toBe(DEFAULT_COMMAND)
    expect(state.sessionSortMode).toBe('status')
    expect(state.sessionSortDirection).toBe('desc')
    expect(closed).toBe(1)

    act(() => {
      renderer.unmount()
    })
  })

  test('resets draft values when reopened', () => {
    let renderer!: TestRenderer.ReactTestRenderer
    const onClose = () => {}

    act(() => {
      renderer = TestRenderer.create(
        <SettingsModal isOpen onClose={onClose} />
      )
    })

    let inputs = renderer.root.findAllByType('input')

    act(() => {
      inputs[0].props.onChange({ target: { value: '/dirty' } })
      inputs[1].props.onChange({ target: { value: 'dirty' } })
    })

    act(() => {
      useSettingsStore.setState({
        defaultProjectDir: '/next',
        defaultCommand: 'claude',
        sessionSortMode: 'status',
        sessionSortDirection: 'asc',
      })
    })

    act(() => {
      renderer.update(<SettingsModal isOpen={false} onClose={onClose} />)
    })

    act(() => {
      renderer.update(<SettingsModal isOpen onClose={onClose} />)
    })

    inputs = renderer.root.findAllByType('input')
    expect(inputs[0].props.value).toBe('/next')
    expect(inputs[1].props.value).toBe('claude')

    const statusButton = renderer.root
      .findAllByType('button')
      .find((button) => button.props.children === 'Status')

    if (!statusButton) {
      throw new Error('Expected status button')
    }

    expect(statusButton.props.className).toContain('btn-primary')

    act(() => {
      renderer.unmount()
    })
  })
})
