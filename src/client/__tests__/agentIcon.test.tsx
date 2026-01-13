import { describe, expect, test, mock } from 'bun:test'
import TestRenderer from 'react-test-renderer'
import type { Session } from '@shared/types'

const iconStub =
  (testId: string) =>
  ({ className }: { className?: string }) => (
    <svg data-testid={testId} className={className} />
  )

mock.module('@untitledui-icons/react/line', () => ({
  HandIcon: iconStub('hand-icon'),
  PlusIcon: iconStub('plus-icon'),
  FolderIcon: iconStub('folder-icon'),
  MoveIcon: iconStub('move-icon'),
  TerminalIcon: iconStub('terminal-icon'),
  CornerDownLeftIcon: iconStub('corner-down-left-icon'),
  XCloseIcon: iconStub('x-close-icon'),
  DotsVerticalIcon: iconStub('dots-vertical-icon'),
  Menu01Icon: iconStub('menu-01-icon'),
}))

const { default: AgentIcon } = await import('../components/AgentIcon')

const baseSession: Session = {
  id: 'session-1',
  name: 'alpha',
  tmuxWindow: 'agentboard:1',
  projectPath: '/tmp/alpha',
  status: 'working',
  lastActivity: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  source: 'managed',
}

describe('AgentIcon', () => {
  test('renders Anthropic icon for claude sessions', () => {
    const renderer = TestRenderer.create(
      <AgentIcon session={{ ...baseSession, agentType: 'claude' }} className="icon" />
    )

    const icon = renderer.root.findByProps({ 'aria-label': 'Anthropic' })
    expect(icon.props.className).toBe('icon')
  })

  test('renders OpenAI icon based on command', () => {
    const renderer = TestRenderer.create(
      <AgentIcon session={{ ...baseSession, command: 'Codex --help' }} />
    )

    expect(renderer.root.findByProps({ 'aria-label': 'OpenAI' })).toBeTruthy()
  })

  test('falls back to terminal icon for unknown agent', () => {
    const renderer = TestRenderer.create(
      <AgentIcon session={{ ...baseSession, command: 'bash' }} className="fallback" />
    )

    const fallback = renderer.root.findByProps({ 'data-testid': 'terminal-icon' })
    expect(fallback.props.className).toBe('fallback')
  })
})
