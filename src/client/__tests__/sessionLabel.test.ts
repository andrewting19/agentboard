import { describe, expect, test } from 'bun:test'
import type { Session } from '@shared/types'
import {
  formatCommandLabel,
  getPathLeaf,
  inferAgentFromLogFile,
} from '../utils/sessionLabel'

const baseSession: Session = {
  id: 'test-session',
  name: 'test',
  tmuxWindow: 'agentboard:1',
  projectPath: '/Users/example/project',
  status: 'unknown',
  lastActivity: new Date(0).toISOString(),
  source: 'managed',
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return { ...baseSession, ...overrides }
}

describe('formatCommandLabel', () => {
  test('uses agent type and cwd leaf', () => {
    const label = formatCommandLabel(
      makeSession({ agentType: 'claude', projectPath: '/Users/me/app' })
    )
    expect(label).toBe('claude / app')
  })

  test('falls back to command when agent type is missing', () => {
    const label = formatCommandLabel(
      makeSession({
        agentType: undefined,
        command: 'bun',
        projectPath: '/Users/me/app',
      })
    )
    expect(label).toBe('bun / app')
  })

  test('shows directory when no command is available', () => {
    const label = formatCommandLabel(
      makeSession({
        agentType: undefined,
        command: '',
        projectPath: '/Users/me/app',
      })
    )
    expect(label).toBe('app')
  })
})

describe('getPathLeaf', () => {
  test('handles trailing slashes', () => {
    expect(getPathLeaf('/Users/me/project/')).toBe('project')
  })

  test('handles Windows separators', () => {
    expect(getPathLeaf('C:\\Users\\me\\project')).toBe('project')
  })
})

describe('inferAgentFromLogFile', () => {
  test('detects claude logs', () => {
    expect(
      inferAgentFromLogFile('/Users/me/.claude/projects/app/123.jsonl')
    ).toBe('claude')
  })

  test('detects codex logs', () => {
    expect(
      inferAgentFromLogFile('/Users/me/.codex/sessions/abc.jsonl')
    ).toBe('codex')
  })

  test('returns undefined for unrelated logs', () => {
    expect(inferAgentFromLogFile('/tmp/agentboard.jsonl')).toBeUndefined()
  })
})
