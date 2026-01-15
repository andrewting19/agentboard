/// <reference lib="webworker" />
import os from 'node:os'
import { performance } from 'node:perf_hooks'
import { getLogSearchDirs, getLogTimes, isCodexSubagent } from './logDiscovery'
import {
  DEFAULT_SCROLLBACK_LINES,
  createExactMatchProfiler,
  getLogTokenCount,
  matchWindowsToLogsByExactRg,
} from './logMatcher'
import { getEntriesNeedingMatch } from './logMatchGate'
import { collectLogEntryBatch, type LogEntrySnapshot } from './logPollData'
import type {
  MatchWorkerRequest,
  MatchWorkerResponse,
  OrphanCandidate,
} from './logMatchWorkerTypes'

const ctx =
  typeof self === 'undefined'
    ? null
    : (self as DedicatedWorkerGlobalScope | null)

export function handleMatchWorkerRequest(
  payload: MatchWorkerRequest
): MatchWorkerResponse {
  try {
    const search = payload.search ?? {}
    const { entries, scanMs, sortMs } = collectLogEntryBatch(
      payload.maxLogsPerPoll
    )
    const logDirs = payload.logDirs ?? getLogSearchDirs()
    const profile = search.profile ? createExactMatchProfiler() : undefined
    let matchMs = 0
    let matchWindowCount = 0
    let matchLogCount = 0
    let matchSkipped = false
    let resolved: Array<{ logPath: string; tmuxWindow: string }> = []
    let orphanEntries: LogEntrySnapshot[] = []
    let orphanMatches: Array<{ logPath: string; tmuxWindow: string }> = []

    const entriesToMatch = getEntriesNeedingMatch(entries, payload.sessions, {
      minTokens: payload.minTokensForMatch ?? 0,
    })
    if (entriesToMatch.length === 0) {
      matchSkipped = true
    } else {
      const matchStart = performance.now()
      const matchLogPaths = entriesToMatch.map((entry) => entry.logPath)
      const matches = matchWindowsToLogsByExactRg(
        payload.windows,
        logDirs,
        payload.scrollbackLines ?? DEFAULT_SCROLLBACK_LINES,
        {
          logPaths: matchLogPaths,
          tailBytes: search.tailBytes,
          rgThreads: search.rgThreads,
          profile,
        }
      )
      matchMs = performance.now() - matchStart
      matchWindowCount = payload.windows.length
      matchLogCount = matchLogPaths.length
      resolved = Array.from(matches.entries()).map(([logPath, window]) => ({
        logPath,
        tmuxWindow: window.tmuxWindow,
      }))
    }

    const orphanCandidates = payload.orphanCandidates ?? []
    if (payload.forceOrphanRematch && orphanCandidates.length > 0) {
      orphanEntries = buildOrphanEntries(
        orphanCandidates,
        entries,
        payload.minTokensForMatch ?? 0
      )
      if (orphanEntries.length > 0) {
        const startupRgThreads = Math.max(
          search.rgThreads ?? 1,
          Math.min(os.cpus().length, 4)
        )
        const matches = matchWindowsToLogsByExactRg(
          payload.windows,
          logDirs,
          payload.scrollbackLines ?? DEFAULT_SCROLLBACK_LINES,
          {
            logPaths: orphanEntries.map((entry) => entry.logPath),
            rgThreads: startupRgThreads,
            profile,
          }
        )
        orphanMatches = Array.from(matches.entries()).map(
          ([logPath, window]) => ({
            logPath,
            tmuxWindow: window.tmuxWindow,
          })
        )
      }
    }

    return {
      id: payload.id,
      type: 'result',
      entries,
      orphanEntries,
      scanMs,
      sortMs,
      matchMs,
      matchWindowCount,
      matchLogCount,
      matchSkipped,
      matches: resolved,
      orphanMatches,
      profile,
    }
  } catch (error) {
    return {
      id: payload.id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function buildOrphanEntries(
  candidates: OrphanCandidate[],
  entries: LogEntrySnapshot[],
  minTokens: number
): LogEntrySnapshot[] {
  const existingLogPaths = new Set(entries.map((entry) => entry.logPath))
  const orphanEntries: LogEntrySnapshot[] = []

  for (const record of candidates) {
    const logPath = record.logFilePath
    if (!logPath || existingLogPaths.has(logPath)) continue

    const agentType = record.agentType
    if (agentType === 'codex' && isCodexSubagent(logPath)) {
      continue
    }

    const times = getLogTimes(logPath)
    if (!times) continue

    const logTokenCount = getLogTokenCount(logPath)
    if (minTokens > 0 && logTokenCount < minTokens) {
      continue
    }

    orphanEntries.push({
      logPath,
      mtime: times.mtime.getTime(),
      birthtime: times.birthtime.getTime(),
      sessionId: record.sessionId,
      projectPath: record.projectPath ?? null,
      agentType: agentType ?? null,
      isCodexSubagent: false,
      logTokenCount,
    })
  }

  return orphanEntries
}

if (ctx) {
  ctx.onmessage = (event: MessageEvent<MatchWorkerRequest>) => {
    const payload = event.data
    if (!payload || !payload.id) {
      return
    }

    const response = handleMatchWorkerRequest(payload)
    ctx.postMessage(response)
  }
}
