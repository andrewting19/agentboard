import { afterEach, describe, expect, test } from 'bun:test'
import TestRenderer, { act } from 'react-test-renderer'
import Header from '../components/Header'
import { getNavShortcutMod } from '../utils/device'

const globalAny = globalThis as typeof globalThis & {
  navigator?: Navigator
}

const originalNavigator = globalAny.navigator

afterEach(() => {
  globalAny.navigator = originalNavigator
})

describe('Header', () => {
  test('renders status dot and triggers new session', () => {
    globalAny.navigator = {
      platform: 'Win32',
      userAgent: 'Chrome',
      maxTouchPoints: 0,
    } as unknown as Navigator

    let created = 0
    const renderer = TestRenderer.create(
      <Header connectionStatus="connected" onNewSession={() => { created += 1 }} tailscaleIp={null} />
    )

    const statusDot = renderer.root.findAllByType('span').find((node) =>
      typeof node.props.className === 'string' &&
      node.props.className.includes('rounded-full')
    )
    if (!statusDot) {
      throw new Error('Expected status dot')
    }
    expect(statusDot.props.className).toContain('bg-working')

    const button = renderer.root.findByType('button')
    expect(button.props.title).toBe(`New session (${getNavShortcutMod()}N)`)

    act(() => {
      button.props.onClick()
    })

    expect(created).toBe(1)

    act(() => {
      renderer.unmount()
    })
  })

  test('shows error status styling', () => {
    const renderer = TestRenderer.create(
      <Header connectionStatus="error" onNewSession={() => {}} tailscaleIp={null} />
    )

    const statusDot = renderer.root.findAllByType('span').find((node) =>
      typeof node.props.className === 'string' &&
      node.props.className.includes('rounded-full')
    )
    if (!statusDot) {
      throw new Error('Expected status dot')
    }

    expect(statusDot.props.className).toContain('bg-danger')

    act(() => {
      renderer.unmount()
    })
  })

  test('displays tailscale IP when provided', () => {
    const renderer = TestRenderer.create(
      <Header connectionStatus="connected" onNewSession={() => {}} tailscaleIp="100.64.1.2" />
    )

    const buttons = renderer.root.findAllByType('button')
    const ipButton = buttons.find((node) =>
      node.children.includes('100.64.1.2')
    )
    expect(ipButton).toBeDefined()
    expect(ipButton?.props.title).toBe('Tailscale IP - click to copy remote access URL')

    act(() => {
      renderer.unmount()
    })
  })

  test('does not display tailscale IP when null', () => {
    const renderer = TestRenderer.create(
      <Header connectionStatus="connected" onNewSession={() => {}} tailscaleIp={null} />
    )

    const spans = renderer.root.findAllByType('span')
    const ipSpan = spans.find((node) =>
      Array.isArray(node.children) && node.children.some((c) => typeof c === 'string' && c.includes('100.'))
    )
    expect(ipSpan).toBeUndefined()

    act(() => {
      renderer.unmount()
    })
  })
})
