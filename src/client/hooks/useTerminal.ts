import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebglAddon } from 'xterm-addon-webgl'
import { ClipboardAddon } from '@xterm/addon-clipboard'
import type { ServerMessage } from '@shared/types'
import type { ITheme } from 'xterm'

interface UseTerminalOptions {
  sessionId: string | null
  sendMessage: (message: any) => void
  subscribe: (listener: (message: ServerMessage) => void) => () => void
  theme: ITheme
}

export function useTerminal({
  sessionId,
  sendMessage,
  subscribe,
  theme,
}: UseTerminalOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const webglAddonRef = useRef<WebglAddon | null>(null)
  const resizeTimer = useRef<number | null>(null)

  // Use refs for values that callbacks need to access
  const sessionIdRef = useRef<string | null>(sessionId)
  const sendMessageRef = useRef(sendMessage)

  // Keep refs in sync
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  // Terminal initialization - only once on mount
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Already initialized
    if (terminalRef.current) return

    // Clear container
    container.innerHTML = ''

    const terminal = new Terminal({
      fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      scrollback: 5000,
      cursorBlink: true,
      convertEol: true,
      theme,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new ClipboardAddon())

    try {
      const webglAddon = new WebglAddon()
      terminal.loadAddon(webglAddon)
      webglAddonRef.current = webglAddon
    } catch {
      // WebGL addon is optional
    }

    terminal.open(container)
    fitAddon.fit()

    terminal.attachCustomKeyEventHandler((event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        if (terminal.hasSelection()) {
          const selection = terminal.getSelection()
          if (selection && navigator.clipboard) {
            void navigator.clipboard.writeText(selection)
          }
          return false
        }
      }
      return true
    })

    // Handle input
    terminal.onData((data) => {
      const activeSession = sessionIdRef.current
      if (activeSession) {
        sendMessageRef.current({ type: 'terminal-input', sessionId: activeSession, data })
      }
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    return () => {
      if (webglAddonRef.current) {
        try {
          webglAddonRef.current.dispose()
        } catch {
          // Ignore
        }
        webglAddonRef.current = null
      }
      try {
        terminal.dispose()
      } catch {
        // Ignore
      }
      if (container) {
        container.innerHTML = ''
      }
      terminalRef.current = null
      fitAddonRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Update theme
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = theme
    }
  }, [theme])

  // Handle session changes - attach/detach
  const prevSessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return

    const prevSessionId = prevSessionIdRef.current

    // Detach from previous session
    if (prevSessionId && prevSessionId !== sessionId) {
      sendMessage({ type: 'terminal-detach', sessionId: prevSessionId })
    }

    // Attach to new session
    if (sessionId && sessionId !== prevSessionId) {
      // Clear and reset for new session
      terminal.clear()
      terminal.write('\x1b[2J\x1b[H') // Clear screen and move cursor to home
      sendMessage({ type: 'terminal-attach', sessionId })
    }

    prevSessionIdRef.current = sessionId
  }, [sessionId, sendMessage])

  // Subscribe to terminal output - stable subscription that checks sessionId via ref
  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      if (
        message.type === 'terminal-output' &&
        message.sessionId === sessionIdRef.current &&
        terminalRef.current
      ) {
        terminalRef.current.write(message.data)
      }
    })

    return unsubscribe
  }, [subscribe])

  // Handle resize
  useEffect(() => {
    const container = containerRef.current
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current

    if (!container || !terminal || !fitAddon) return

    const handleResize = () => {
      if (resizeTimer.current) {
        window.clearTimeout(resizeTimer.current)
      }

      resizeTimer.current = window.setTimeout(() => {
        fitAddon.fit()
        const currentSessionId = sessionIdRef.current
        if (currentSessionId) {
          sendMessageRef.current({
            type: 'terminal-resize',
            sessionId: currentSessionId,
            cols: terminal.cols,
            rows: terminal.rows,
          })
        }
      }, 100)
    }

    const observer = new ResizeObserver(handleResize)
    observer.observe(container)
    handleResize()

    return () => {
      observer.disconnect()
      if (resizeTimer.current) {
        window.clearTimeout(resizeTimer.current)
      }
    }
  }, [])

  return { containerRef }
}
