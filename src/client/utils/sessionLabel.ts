import type { Session } from '@shared/types'

export function formatCommandLabel(session: Session): string | null {
  const agentLabel = session.agentType ?? inferAgentFromLogFile(session.logFile)
  const dirLabel = getPathLeaf(session.projectPath)
  const baseLabel = agentLabel || session.command || ''
  const parts = [baseLabel, dirLabel].filter(Boolean)

  if (parts.length === 0) {
    return null
  }

  return parts.join(' / ')
}

export function getPathLeaf(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed.replace(/[\\/]+$/, '')
  if (!normalized) {
    return null
  }

  const parts = normalized.split(/[\\/]/)
  return parts[parts.length - 1] || null
}

export function inferAgentFromLogFile(
  logFile?: string
): Session['agentType'] {
  if (!logFile) {
    return undefined
  }

  const normalized = logFile.replace(/\\/g, '/').toLowerCase()

  if (normalized.includes('/.claude/projects/')) {
    return 'claude'
  }

  if (normalized.includes('/.codex/sessions/')) {
    return 'codex'
  }

  return undefined
}
