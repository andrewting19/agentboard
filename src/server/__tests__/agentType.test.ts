import { describe, expect, test } from 'bun:test'
import path from 'node:path'
import { config } from '../config'
import { inferAgentType } from '../StatusWatcher'

describe('inferAgentType', () => {
  test('detects claude log paths', () => {
    const logFile = path.join(
      config.claudeProjectsDir,
      'sample-project',
      'session.jsonl'
    )
    expect(inferAgentType(logFile)).toBe('claude')
  })

  test('detects codex log paths', () => {
    const logFile = path.join(
      config.codexSessionsDir,
      'sample-session.jsonl'
    )
    expect(inferAgentType(logFile)).toBe('codex')
  })

  test('returns undefined for unrelated paths', () => {
    const logFile = path.join(process.cwd(), 'tmp', 'session.jsonl')
    expect(inferAgentType(logFile)).toBeUndefined()
  })
})
