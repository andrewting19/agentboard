import { useState, useCallback, useEffect, useRef } from 'react'
import type { Session } from '@shared/types'
import type { ConnectionStatus } from '../stores/sessionStore'
import { useTerminal } from '../hooks/useTerminal'
import { useThemeStore, terminalThemes } from '../stores/themeStore'
import { isIOSDevice } from '../utils/device'
import TerminalControls from './TerminalControls'

interface TerminalProps {
  session: Session | null
  sessions: Session[]
  connectionStatus: ConnectionStatus
  sendMessage: (message: any) => void
  subscribe: (listener: any) => () => void
  onClose: () => void
  onSelectSession: (sessionId: string) => void
  pendingApprovals: number
}

const statusText: Record<Session['status'], string> = {
  working: 'Working',
  needs_approval: 'Approval',
  waiting: 'Waiting',
  unknown: 'Unknown',
}

const statusClass: Record<Session['status'], string> = {
  working: 'text-working',
  needs_approval: 'text-approval',
  waiting: 'text-waiting',
  unknown: 'text-muted',
}

const statusDot: Record<Session['status'], string> = {
  working: 'bg-working',
  needs_approval: 'bg-approval',
  waiting: 'bg-waiting',
  unknown: 'bg-muted',
}

function triggerHaptic() {
  if ('vibrate' in navigator) {
    navigator.vibrate(10)
  }
}

export default function Terminal({
  session,
  sessions,
  connectionStatus,
  sendMessage,
  subscribe,
  onClose,
  onSelectSession,
  pendingApprovals,
}: TerminalProps) {
  const theme = useThemeStore((state) => state.theme)
  const terminalTheme = terminalThemes[theme]
  const isiOS = isIOSDevice()
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [isSelectingText, setIsSelectingText] = useState(false)
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('terminal-font-size')
    return saved ? parseInt(saved, 10) : 13
  })
  const lastTouchY = useRef<number | null>(null)
  const accumulatedDelta = useRef<number>(0)

  const adjustFontSize = useCallback((delta: number) => {
    setFontSize((prev) => {
      const newSize = Math.max(8, Math.min(24, prev + delta))
      localStorage.setItem('terminal-font-size', String(newSize))
      return newSize
    })
  }, [])

  const { containerRef, terminalRef } = useTerminal({
    sessionId: session?.id ?? null,
    sendMessage,
    subscribe,
    theme: terminalTheme,
    fontSize,
    onScrollChange: (isAtBottom) => {
      setShowScrollButton(!isAtBottom)
    },
  })

  const scrollToBottom = useCallback(() => {
    terminalRef.current?.scrollToBottom()
  }, [terminalRef])

  useEffect(() => {
    if (!isiOS || !session) {
      setIsSelectingText(false)
      return
    }

    const container = containerRef.current
    if (!container) return

    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (!isMobile) return

    const isSelectionInside = (sel: Selection) => {
      const a11yTree = container.querySelector('.xterm-accessibility-tree')
      if (!a11yTree) return false
      const anchor = sel.anchorNode
      const focus = sel.focusNode
      return (!!anchor && a11yTree.contains(anchor)) || (!!focus && a11yTree.contains(focus))
    }

    const onSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) {
        // Only update if currently true to avoid unnecessary re-renders
        setIsSelectingText((prev) => prev ? false : prev)
        return
      }
      const newValue = isSelectionInside(sel) && !sel.isCollapsed
      // Only update if value changed
      setIsSelectingText((prev) => prev !== newValue ? newValue : prev)
    }

    const onCopy = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) return
      if (!isSelectionInside(sel)) return

      setTimeout(() => {
        try {
          sel.removeAllRanges()
        } catch {
          // Ignore selection cleanup errors
        }
      }, 0)
    }

    const onTouchEnd = (event: TouchEvent) => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setIsSelectingText(false)
        return
      }

      const a11yTree = container.querySelector('.xterm-accessibility-tree')
      if (!a11yTree) return

      if (!isSelectionInside(sel)) {
        setIsSelectingText(false)
        return
      }

      const target = event.target as Node | null
      const targetInTree = target ? a11yTree.contains(target) : false

      let targetInSelection = false
      if (targetInTree && target) {
        try {
          targetInSelection = sel.containsNode(target, true)
        } catch {
          targetInSelection = false
        }
      }

      if (!targetInTree || !targetInSelection) {
        setTimeout(() => {
          try {
            sel.removeAllRanges()
          } catch {
            // Ignore selection cleanup errors
          }
          setIsSelectingText(false)
        }, 0)
      }
    }

    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('copy', onCopy)
    document.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('selectionchange', onSelectionChange)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('touchend', onTouchEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- use session?.id to avoid re-running on session data changes
  }, [containerRef, isiOS, session?.id])

  useEffect(() => {
    if (!isiOS) return
    const container = containerRef.current
    if (!container) return

    const updateA11yMetrics = () => {
      const row = container.querySelector('.xterm-accessibility-tree > div') as HTMLElement | null
      if (row) {
        const rowHeight = row.getBoundingClientRect().height
        if (rowHeight) {
          container.style.setProperty('--xterm-cell-height', `${rowHeight}px`)
          container.style.setProperty('--xterm-a11y-offset', `${Math.round(rowHeight / 2)}px`)
        }
      }

      const xterm = container.querySelector('.xterm') as HTMLElement | null
      const computedFontSize = xterm ? window.getComputedStyle(xterm).fontSize : `${fontSize}px`
      if (computedFontSize) {
        container.style.setProperty('--xterm-font-size', computedFontSize)
      }
    }

    updateA11yMetrics()
    const rafId = window.requestAnimationFrame(updateA11yMetrics)
    const retryId = window.setTimeout(updateA11yMetrics, 100)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(retryId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- use session?.id to avoid re-running on session data changes
  }, [containerRef, fontSize, isiOS, session?.id])

  // Track isSelectingText in a ref to avoid re-running effect
  const isSelectingTextRef = useRef(isSelectingText)
  useEffect(() => {
    isSelectingTextRef.current = isSelectingText
  }, [isSelectingText])

  // Track session ID in a ref for use in handlers without causing effect re-runs
  const sessionIdRef = useRef(session?.id)
  useEffect(() => {
    sessionIdRef.current = session?.id
  }, [session?.id])

  // Track sendMessage in a ref to avoid effect re-runs
  const sendMessageRef = useRef(sendMessage)
  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  // Touch scroll with native long-press selection
  // Single tap focuses terminal for keyboard input
  useEffect(() => {
    const container = containerRef.current
    if (!container || !session?.id) return

    // Check if mobile
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (!isMobile) return
    const TAP_MOVE_THRESHOLD = 10 // pixels - if moved more, it's not a tap

    let touchStartPos = { x: 0, y: 0 }
    let hasMoved = false

    // Get textarea and keep it disabled to prevent auto-focus
    const textarea = container.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null
    if (textarea) {
      textarea.setAttribute('disabled', 'true')
    }

    const focusTerminalInput = () => {
      // Enable and focus - don't re-disable on blur to prevent keyboard dismissal
      // The textarea will be re-disabled when session changes (effect cleanup)
      if (textarea) {
        textarea.removeAttribute('disabled')
        textarea.focus()
      }
    }

    const resetTouchState = () => {
      lastTouchY.current = null
      accumulatedDelta.current = 0
    }

    const hasActiveSelection = () => {
      if (!isiOS) return false
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) return false
      const a11yTree = container.querySelector('.xterm-accessibility-tree')
      if (!a11yTree) return false
      const anchor = selection.anchorNode
      const focus = selection.focusNode
      return (!!anchor && a11yTree.contains(anchor)) || (!!focus && a11yTree.contains(focus))
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (isSelectingTextRef.current) {
        resetTouchState()
        return
      }

      if (e.touches.length === 1) {
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        hasMoved = false
        lastTouchY.current = e.touches[0].clientY
        accumulatedDelta.current = 0
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isSelectingTextRef.current) {
        resetTouchState()
        return
      }

      if (e.touches.length !== 1 || lastTouchY.current === null) return

      const x = e.touches[0].clientX
      const y = e.touches[0].clientY

      // Check if moved beyond tap threshold
      const dx = Math.abs(x - touchStartPos.x)
      const dy = Math.abs(y - touchStartPos.y)
      if (dx > TAP_MOVE_THRESHOLD || dy > TAP_MOVE_THRESHOLD) {
        hasMoved = true
      }

      const deltaY = lastTouchY.current - y
      lastTouchY.current = y

      accumulatedDelta.current += deltaY
      const threshold = 30 // pixels per scroll event
      const scrollEvents = Math.trunc(accumulatedDelta.current / threshold)

      if (scrollEvents !== 0) {
        // Send mouse wheel escape sequences (SGR mode)
        const button = scrollEvents < 0 ? 64 : 65
        const count = Math.abs(scrollEvents)
        const cols = terminalRef.current?.cols ?? 80
        const rows = terminalRef.current?.rows ?? 24
        const col = Math.floor(cols / 2)
        const row = Math.floor(rows / 2)

        for (let i = 0; i < count; i++) {
          const currentSessionId = sessionIdRef.current
          if (currentSessionId) {
            sendMessageRef.current({
              type: 'terminal-input',
              sessionId: currentSessionId,
              data: `\x1b[<${button};${col};${row}M`
            })
          }
        }
        accumulatedDelta.current -= scrollEvents * threshold
      }
    }

    const handleTouchEnd = () => {
      resetTouchState()

      if (isSelectingTextRef.current || hasActiveSelection()) return

      // Only count as tap if didn't move much
      if (hasMoved) return

      // Single tap - focus terminal for keyboard input
      focusTerminalInput()
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      // Re-enable textarea on cleanup
      if (textarea) {
        textarea.removeAttribute('disabled')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- use session?.id and refs to avoid re-running on unrelated changes
  }, [session?.id, containerRef, terminalRef, isiOS])

  const handleSendKey = useCallback(
    (key: string) => {
      if (!session) return
      sendMessage({ type: 'terminal-input', sessionId: session.id, data: key })
    },
    [session, sendMessage]
  )

  const hasSession = Boolean(session)

  return (
    <section
      className={`flex flex-1 flex-col bg-base ${hasSession ? 'terminal-mobile-overlay md:relative md:inset-auto' : 'hidden md:flex'} ${isiOS ? 'ios-native-term-selection' : ''}`}
      data-testid="terminal-panel"
    >
      {/* Terminal header - only show when session selected */}
      {session && (
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-elevated px-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="btn py-1 text-[11px] md:hidden"
            >
              Back
            </button>
            <span className="text-sm font-medium text-primary">
              {session.name}
            </span>
            <span className={`text-xs ${statusClass[session.status]}`}>
              {statusText[session.status]}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {pendingApprovals > 0 && (
              <span className="flex items-center gap-1.5 rounded bg-approval/20 px-2 py-0.5 text-xs font-medium text-approval md:hidden">
                {pendingApprovals} pending
              </span>
            )}
            {connectionStatus !== 'connected' && (
              <span className="text-xs text-approval">
                {connectionStatus}
              </span>
            )}
            {/* Font size controls - mobile only */}
            <div className="flex items-center gap-1 md:hidden">
              <button
                onClick={() => adjustFontSize(-1)}
                className="flex h-7 w-7 items-center justify-center rounded bg-surface border border-border text-secondary active:bg-hover"
                title="Decrease font size"
              >
                <span className="text-sm font-bold">−</span>
              </button>
              <button
                onClick={() => adjustFontSize(1)}
                className="flex h-7 w-7 items-center justify-center rounded bg-surface border border-border text-secondary active:bg-hover"
                title="Increase font size"
              >
                <span className="text-sm font-bold">+</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile session switcher - top of terminal */}
      {session && sessions.length > 1 && (
        <div className="flex items-center gap-1 px-2 py-1.5 bg-elevated border-b border-border md:hidden">
          {sessions.slice(0, 6).map((s, index) => {
            const isActive = s.id === session.id
            return (
              <button
                key={s.id}
                type="button"
                className={`
                  flex-1 flex items-center justify-center gap-1.5
                  h-8 px-1 text-xs font-medium rounded-md
                  active:scale-95 transition-transform duration-75
                  select-none touch-manipulation
                  ${isActive
                    ? 'bg-accent/20 text-accent border border-accent/40'
                    : 'bg-surface border border-border text-secondary'}
                `}
                onClick={() => {
                  triggerHaptic()
                  onSelectSession(s.id)
                }}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[s.status]}`} />
                <span className="truncate">{index + 1}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Terminal content - always rendered so ref is attached */}
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        {!session && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            Select a session to view terminal
          </div>
        )}

        {/* Scroll to bottom button */}
        {showScrollButton && session && !isSelectingText && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface border border-border shadow-lg hover:bg-hover transition-colors"
            title="Scroll to bottom"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-secondary"
            >
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Mobile control strip */}
      {session && (
        <TerminalControls
          onSendKey={handleSendKey}
          disabled={connectionStatus !== 'connected'}
          sessions={sessions.map(s => ({ id: s.id, name: s.name, status: s.status }))}
          currentSessionId={session.id}
          onSelectSession={onSelectSession}
          hideSessionSwitcher
        />
      )}
    </section>
  )
}
