# Agentboard Implementation Plan (Revised)

## Background and Context

### Project State
This is a **greenfield project** with only `SPEC.md` containing the complete specification. No code exists yet.

### What We're Building
A web dashboard that combines:
- **Kanban board** - Sessions grouped by status (Working, Needs Approval, Waiting, Idle)
- **Terminal embed** - Interactive xterm.js connected to actual tmux sessions via WebSocket
- **Status detection** - Real-time parsing of Claude Code JSONL logs
- **Notifications** - Browser alerts when sessions need approval

### Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                        Browser (React + Vite)                          │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Kanban Dashboard                Terminal Panel (xterm.js)       │  │
│  │  [Working] [Approval] [Waiting] [Idle]    ┌─────────────────┐   │  │
│  │   [card]    [card]                        │ $ claude        │   │  │
│  │   [card]                                  │ Reading file... │   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
                              │ WebSocket
                              ▼
┌───────────────────────────────────────────────────────────────────────┐
│                      Node.js + Express Backend                         │
│                                                                        │
│  SessionManager         StatusWatcher           TerminalProxy          │
│  - tmux list-sessions   - chokidar watch       - node-pty spawn        │
│  - tmux new-session     - JSONL parsing        - attach to tmux        │
│  - tmux kill-session    - XState machine       - bidirectional I/O     │
│                                                                        │
│                    Session Registry (in-memory Map)                    │
└───────────────────────────────────────────────────────────────────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐      ┌─────────────────────┐
│  tmux sessions  │      │  ~/.claude/projects │
│  claude-*       │      │  {hash}/*.jsonl     │
└─────────────────┘      └─────────────────────┘
```

### Tech Stack (per SPEC)
| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| Terminal | xterm.js + xterm-addon-fit + xterm-addon-webgl |
| Client state | Zustand |
| Backend | Node.js + Express (ESM) |
| WebSocket | ws library |
| PTY | node-pty |
| File watching | chokidar |
| State machine | XState v5 |

### Key Data Structures

```typescript
// src/shared/types.ts - Shared between client and server

export interface Session {
  id: string              // UUID
  name: string            // Display name (folder basename)
  tmuxSession: string     // e.g., "claude-myproject"
  projectPath: string     // /Users/gary/code/myproject
  status: SessionStatus
  lastActivity: Date
  logFile?: string        // Path to JSONL being watched
}

export type SessionStatus =
  | 'working'         // Claude actively processing
  | 'needs_approval'  // Waiting for tool approval
  | 'waiting'         // Claude done, waiting for user
  | 'idle'            // No activity for 5+ minutes
  | 'unknown'         // Can't determine status

// WebSocket message types (discriminated union)
export type ServerMessage =
  | { type: 'sessions'; sessions: Session[] }
  | { type: 'session-update'; session: Session }
  | { type: 'terminal-output'; sessionId: string; data: string }
  | { type: 'error'; message: string }

export type ClientMessage =
  | { type: 'terminal-attach'; sessionId: string }
  | { type: 'terminal-detach'; sessionId: string }
  | { type: 'terminal-input'; sessionId: string; data: string }
  | { type: 'terminal-resize'; sessionId: string; cols: number; rows: number }
  | { type: 'session-create'; projectPath: string; name?: string }
  | { type: 'session-kill'; sessionId: string }
```

---

## Summary

Build a full-stack TypeScript application from scratch using Vite+React frontend and Express+node-pty backend with **shared types** for type safety. The implementation follows an incremental approach: (1) project scaffolding with shared types and working dev server, (2) session discovery and management via tmux commands, (3) terminal proxy using node-pty to attach to tmux sessions, (4) status detection by parsing Claude Code JSONL logs with XState (reading from log tail for efficiency), (5) responsive kanban UI with Tailwind, and (6) browser notifications for attention-needed states.

---

## Clarifications

### Assumptions

| # | Assumption | Rationale |
|---|------------|-----------|
| A1 | Monorepo structure with `src/client`, `src/server`, and `src/shared` | Shared types between client/server eliminates drift; SPEC directory structure supports this |
| A2 | Vite dev proxy forwards API/WebSocket to Express on port 4040 | Standard pattern; avoids CORS during development |
| A3 | Production bundles frontend into `dist/client/`, served by Express | Single-process deployment; Express serves static files |
| A4 | Session naming uses `claude-{basename}` convention | SPEC defines this; dashboard filters to `claude-*` prefix |
| A5 | tmux CWD obtainable via `tmux display-message -p -t {session} '#{pane_current_path}'` | Standard tmux command for getting pane working directory |
| A6 | Claude Code logs are in `~/.claude/projects/{hash}/` with JSONL files | Per SPEC; hash is SHA256 of project path (verified against claude-code-ui) |
| A7 | Single WebSocket connection per client, multiplexed by message type | Cleaner than multiple connections; differentiated by `type` field |
| A8 | node-pty compiles successfully on macOS with Xcode CLI tools | Standard setup; will document prerequisites |
| A9 | Use ESM (`"type": "module"`) for both client and server | Modern standard; Vite requires ESM |
| A10 | Large log files handled by reading only recent lines (tail-like behavior) | JSONL logs can grow large; don't want to parse entire history |

### Questions

**Q1: What is the exact Claude Code JSONL log format?**
- Context: Status detection depends on parsing specific event types
- Agent recommends: Use events from SPEC (`USER_PROMPT`, `ASSISTANT_TOOL_USE`, `TOOL_RESULT`, `TURN_END`) and add graceful fallback to 'unknown' for unparseable logs. Can refine once we see actual logs. Reference claude-code-ui's parser for guidance.
- **Answer:** _(pending)_

**Q2: How to match tmux session to its log file?**
- Context: Need to map `claude-myproject` tmux session to the correct JSONL in `~/.claude/projects/`
- Agent recommends: (1) Get CWD from tmux session via `tmux display-message`, (2) SHA256 hash the project path, (3) Look for `~/.claude/projects/{hash}/` directory, (4) Use most recently modified JSONL file in that directory.
- **Answer:** _(pending)_

**Q3: Default port number?**
- Context: Need a port for the web server
- Agent recommends: Port 4040 (avoids common dev ports like 3000, 5173, 8080). Configurable via `PORT` env var.
- **Answer:** _(pending)_

**Q4: Session creation UI - directory picker approach?**
- Context: Web browsers can't do native directory pickers easily
- Agent recommends: Text input with autocomplete from `~/.claude/projects/` (which stores known project paths). Allow pasting absolute paths.
- **Answer:** _(pending)_

**Q5: How does Claude Code hash project paths for log directories?**
- Context: Need exact algorithm to find log files from project path
- Agent recommends: Assume SHA256 hash of absolute project path (like claude-code-ui). Verify by inspecting existing log directories.
- **Answer:** _(pending)_

---

## Tasks

### Phase 1: Project Skeleton

- [ ] **Task 1.1**: Initialize npm project with TypeScript and ESM configuration
  - **Files:** `package.json` (create), `tsconfig.json` (create), `tsconfig.node.json` (create), `.gitignore` (create), `.nvmrc` (create)
  - **Rationale:** Foundation for TypeScript ESM project; separate tsconfig for Node.js server code; .nvmrc ensures consistent Node version (20+)
  - **Dependencies:** none

- [ ] **Task 1.2**: Create shared types module
  - **Files:** `src/shared/types.ts` (create)
  - **Rationale:** Single source of truth for Session, SessionStatus, and WebSocket message types used by both client and server
  - **Dependencies:** Task 1.1

- [ ] **Task 1.3**: Set up Vite with React and Tailwind CSS
  - **Files:** `vite.config.ts` (create), `tailwind.config.js` (create), `postcss.config.js` (create), `index.html` (create), `src/client/main.tsx` (create), `src/client/App.tsx` (create), `src/client/styles/index.css` (create)
  - **Rationale:** Frontend tooling with hot reload; Tailwind for responsive utility-first styling
  - **Dependencies:** Task 1.1, Task 1.2

- [ ] **Task 1.4**: Create Express server with WebSocket support
  - **Files:** `src/server/index.ts` (create), `src/server/config.ts` (create)
  - **Rationale:** Backend entry point; ws library for WebSocket; config.ts for PORT and other env vars
  - **Dependencies:** Task 1.1, Task 1.2

- [ ] **Task 1.5**: Configure Vite proxy to forward /ws to Express
  - **Files:** `vite.config.ts` (modify), `package.json` (modify - add concurrently, dev scripts)
  - **Rationale:** WebSocket proxy enables frontend-backend communication during development without CORS
  - **Dependencies:** Task 1.3, Task 1.4

- [ ] **Task 1.6**: Add npm scripts for dev, build, and start
  - **Files:** `package.json` (modify)
  - **Rationale:** `npm run dev` runs Vite and Express concurrently; `npm run build` bundles frontend; `npm start` runs production server
  - **Dependencies:** Task 1.5

- [ ] **Task 1.7**: Verify hello-world WebSocket communication
  - **Files:** (testing only - modify App.tsx temporarily)
  - **Rationale:** Confirm full-stack setup works: client connects to WebSocket, receives message, logs it
  - **Dependencies:** Task 1.6

### Phase 2: Session Management Backend

- [ ] **Task 2.1**: Add prerequisite check utility
  - **Files:** `src/server/prerequisites.ts` (create)
  - **Rationale:** Check that tmux and claude are installed; fail fast with helpful error message if not
  - **Dependencies:** Phase 1

- [ ] **Task 2.2**: Create SessionManager class with tmux discovery
  - **Files:** `src/server/SessionManager.ts` (create)
  - **Rationale:** List tmux sessions matching `claude-*` prefix; extract CWD for each via `tmux display-message`
  - **Dependencies:** Task 2.1

- [ ] **Task 2.3**: Implement session creation (tmux new-session)
  - **Files:** `src/server/SessionManager.ts` (modify)
  - **Rationale:** Create detached tmux session running `claude` in specified directory; handle name conflicts with numeric suffix
  - **Dependencies:** Task 2.2

- [ ] **Task 2.4**: Implement session termination (tmux kill-session)
  - **Files:** `src/server/SessionManager.ts` (modify)
  - **Rationale:** Allow dashboard to close sessions; clean up any associated watchers
  - **Dependencies:** Task 2.2

- [ ] **Task 2.5**: Create Session Registry with EventEmitter
  - **Files:** `src/server/SessionRegistry.ts` (create)
  - **Rationale:** In-memory Map of sessions; emits 'session-added', 'session-updated', 'session-removed' events
  - **Dependencies:** Task 2.2

- [ ] **Task 2.6**: Add WebSocket message handlers for session operations
  - **Files:** `src/server/index.ts` (modify)
  - **Rationale:** Handle `session-create`, `session-kill` messages; broadcast session list on connect
  - **Dependencies:** Task 2.5

- [ ] **Task 2.7**: Periodic session refresh (poll tmux every 5s)
  - **Files:** `src/server/SessionManager.ts` (modify), `src/server/index.ts` (modify)
  - **Rationale:** Detect sessions created/killed outside dashboard; reconcile with registry
  - **Dependencies:** Task 2.5

### Phase 3: Terminal Proxy

- [ ] **Task 3.1**: Create TerminalProxy class with node-pty
  - **Files:** `src/server/TerminalProxy.ts` (create)
  - **Rationale:** Spawn PTY that attaches to tmux session; track active attachments per session
  - **Dependencies:** Phase 2

- [ ] **Task 3.2**: Implement attach/detach lifecycle
  - **Files:** `src/server/TerminalProxy.ts` (modify)
  - **Rationale:** Create PTY on attach, kill on detach; handle WebSocket close cleanup
  - **Dependencies:** Task 3.1

- [ ] **Task 3.3**: Implement resize handler with debouncing
  - **Files:** `src/server/TerminalProxy.ts` (modify)
  - **Rationale:** Debounce resize events (100ms) to avoid PTY thrashing during window drag
  - **Dependencies:** Task 3.2

- [ ] **Task 3.4**: Wire PTY I/O to WebSocket messages
  - **Files:** `src/server/TerminalProxy.ts` (modify), `src/server/index.ts` (modify)
  - **Rationale:** Forward PTY output to client as `terminal-output`, client `terminal-input` to PTY
  - **Dependencies:** Task 3.3

- [ ] **Task 3.5**: Add xterm.js with addons to frontend
  - **Files:** `src/client/components/Terminal.tsx` (create), `package.json` (modify - add xterm, xterm-addon-fit, xterm-addon-webgl)
  - **Rationale:** Web terminal emulator; fit addon for auto-resize; webgl addon for performance
  - **Dependencies:** Phase 1

- [ ] **Task 3.6**: Create useTerminal hook for WebSocket terminal I/O
  - **Files:** `src/client/hooks/useTerminal.ts` (create)
  - **Rationale:** Encapsulate terminal attach/detach/input/resize logic; manage xterm lifecycle
  - **Dependencies:** Task 3.5

- [ ] **Task 3.7**: Wire Terminal component to useTerminal hook
  - **Files:** `src/client/components/Terminal.tsx` (modify)
  - **Rationale:** Connect xterm.js instance to hook; handle fit on container resize
  - **Dependencies:** Task 3.5, Task 3.6

- [ ] **Task 3.8**: Test interactive terminal - typing flows to tmux
  - **Files:** (testing only)
  - **Rationale:** Verify bidirectional I/O: keystrokes reach tmux, output renders in browser
  - **Dependencies:** Task 3.7, Task 3.4

### Phase 4: Status Detection

- [ ] **Task 4.1**: Implement log file discovery with path hashing
  - **Files:** `src/server/logDiscovery.ts` (create)
  - **Rationale:** Given project path, SHA256 hash it, find `~/.claude/projects/{hash}/` directory, return most recent JSONL
  - **Dependencies:** Phase 2

- [ ] **Task 4.2**: Create JSONL log parser with tail-reading
  - **Files:** `src/server/logParser.ts` (create)
  - **Rationale:** Parse log lines into typed events; read only last N lines initially (tail -1000 equivalent); handle malformed lines gracefully
  - **Dependencies:** Task 4.1

- [ ] **Task 4.3**: Implement XState status machine
  - **Files:** `src/server/statusMachine.ts` (create)
  - **Rationale:** State machine per SPEC: unknown → idle → working → needs_approval/waiting with delayed transitions
  - **Dependencies:** Task 4.2

- [ ] **Task 4.4**: Set up chokidar file watching for log changes
  - **Files:** `src/server/StatusWatcher.ts` (create)
  - **Rationale:** Watch log files for appended lines; use chokidar's 'change' event with size tracking to detect appends
  - **Dependencies:** Task 4.3

- [ ] **Task 4.5**: Process log appends through state machine
  - **Files:** `src/server/StatusWatcher.ts` (modify)
  - **Rationale:** On file change, read only new lines (track file position), parse events, send to state machine
  - **Dependencies:** Task 4.4

- [ ] **Task 4.6**: Connect StatusWatcher to Session Registry
  - **Files:** `src/server/StatusWatcher.ts` (modify), `src/server/SessionRegistry.ts` (modify)
  - **Rationale:** Update session.status when state machine transitions; emit 'session-updated' event
  - **Dependencies:** Task 4.5

- [ ] **Task 4.7**: Broadcast status updates via WebSocket
  - **Files:** `src/server/index.ts` (modify)
  - **Rationale:** Listen to registry 'session-updated' events; broadcast `session-update` message to all clients
  - **Dependencies:** Task 4.6

### Phase 5: Kanban Dashboard UI

- [ ] **Task 5.1**: Create Zustand store for sessions
  - **Files:** `src/client/stores/sessionStore.ts` (create)
  - **Rationale:** Client-side state: sessions list, selected session ID, connection status
  - **Dependencies:** Phase 1

- [ ] **Task 5.2**: Create useWebSocket hook for session updates
  - **Files:** `src/client/hooks/useWebSocket.ts` (create)
  - **Rationale:** Connect to backend WebSocket; update Zustand store on `sessions` and `session-update` messages; track connection state
  - **Dependencies:** Task 5.1

- [ ] **Task 5.3**: Create SessionCard component
  - **Files:** `src/client/components/SessionCard.tsx` (create)
  - **Rationale:** Display session name, status badge (colored by status), last activity relative time, open button
  - **Dependencies:** Task 5.1

- [ ] **Task 5.4**: Create Dashboard component with 4 kanban columns
  - **Files:** `src/client/components/Dashboard.tsx` (create)
  - **Rationale:** Working | Needs Approval | Waiting | Idle columns; filter sessions by status
  - **Dependencies:** Task 5.3

- [ ] **Task 5.5**: Style kanban with Tailwind (desktop layout)
  - **Files:** `src/client/components/Dashboard.tsx` (modify), `src/client/components/SessionCard.tsx` (modify)
  - **Rationale:** CSS Grid 4-column layout; status-based colors (amber/red for needs_approval); hover/focus states
  - **Dependencies:** Task 5.4

- [ ] **Task 5.6**: Integrate Terminal panel in App layout
  - **Files:** `src/client/App.tsx` (modify)
  - **Rationale:** Dashboard top (flex-1), Terminal bottom (fixed height, collapsible); click card sets selectedSession, opens terminal
  - **Dependencies:** Task 5.4, Task 3.7

- [ ] **Task 5.7**: Implement mobile responsive layout
  - **Files:** `src/client/components/Dashboard.tsx` (modify), `src/client/App.tsx` (modify)
  - **Rationale:** Tailwind `md:` breakpoint: stack columns vertically on mobile; terminal as fullscreen overlay with back button
  - **Dependencies:** Task 5.5, Task 5.6

### Phase 6: Session Creation UI

- [ ] **Task 6.1**: Create NewSessionModal component
  - **Files:** `src/client/components/NewSessionModal.tsx` (create)
  - **Rationale:** Modal with project path input, optional session name override, create/cancel buttons
  - **Dependencies:** Phase 5

- [ ] **Task 6.2**: Add "+ New Session" button to header
  - **Files:** `src/client/App.tsx` (modify), `src/client/components/Header.tsx` (create)
  - **Rationale:** Header component with title and new session button; extract for cleaner App.tsx
  - **Dependencies:** Task 6.1

- [ ] **Task 6.3**: Wire up session creation via WebSocket
  - **Files:** `src/client/components/NewSessionModal.tsx` (modify), `src/client/hooks/useWebSocket.ts` (modify)
  - **Rationale:** Send `session-create` message; show loading state; handle success (close modal) and error (show message)
  - **Dependencies:** Task 6.1, Task 2.6

- [ ] **Task 6.4**: Add session delete/kill button on cards
  - **Files:** `src/client/components/SessionCard.tsx` (modify)
  - **Rationale:** Small trash icon button; confirm dialog before sending `session-kill`
  - **Dependencies:** Task 5.3, Task 2.6

### Phase 7: Notifications & Polish

- [ ] **Task 7.1**: Create useNotifications hook with permission request
  - **Files:** `src/client/hooks/useNotifications.ts` (create)
  - **Rationale:** Request notification permission on mount; track permission state; provide notify() function
  - **Dependencies:** Phase 5

- [ ] **Task 7.2**: Show browser notification when session needs approval
  - **Files:** `src/client/hooks/useNotifications.ts` (modify), `src/client/App.tsx` (modify)
  - **Rationale:** Watch for status changes to 'needs_approval'; show notification if tab hidden; use session.id as tag to prevent duplicates
  - **Dependencies:** Task 7.1

- [ ] **Task 7.3**: Add notification sound
  - **Files:** `public/notification.mp3` (create - source a short alert sound), `src/client/hooks/useNotifications.ts` (modify)
  - **Rationale:** Play audio when needs_approval triggered; respect user preference (add mute toggle to header)
  - **Dependencies:** Task 7.2

- [ ] **Task 7.4**: Implement favicon badge for attention state
  - **Files:** `src/client/hooks/useFaviconBadge.ts` (create), `public/favicon.svg` (create), `public/favicon-badge.svg` (create)
  - **Rationale:** Swap favicon when any session is needs_approval; red dot overlay indicates attention needed
  - **Dependencies:** Task 7.1

- [ ] **Task 7.5**: Add loading states and error handling
  - **Files:** `src/client/components/Dashboard.tsx` (modify), `src/client/components/Terminal.tsx` (modify)
  - **Rationale:** Show skeleton cards during initial load; show error banner on WebSocket disconnect; terminal shows "Connecting..." overlay
  - **Dependencies:** Phase 5, Phase 3

- [ ] **Task 7.6**: Handle terminal resize on window change
  - **Files:** `src/client/components/Terminal.tsx` (modify)
  - **Rationale:** ResizeObserver on terminal container; debounce (100ms); call xterm.fit() and send `terminal-resize` message
  - **Dependencies:** Task 3.7

- [ ] **Task 7.7**: Add WebSocket reconnection with exponential backoff
  - **Files:** `src/client/hooks/useWebSocket.ts` (modify)
  - **Rationale:** On disconnect, retry with delays: 1s, 2s, 4s, 8s, max 30s; reset on successful connect
  - **Dependencies:** Task 5.2

- [ ] **Task 7.8**: Connection status indicator in header
  - **Files:** `src/client/components/Header.tsx` (modify)
  - **Rationale:** Small dot (green=connected, yellow=reconnecting, red=disconnected) with tooltip showing state
  - **Dependencies:** Task 7.7, Task 6.2

---

## Diagrams

### Status State Machine

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
┌─────────┐    LOG_FOUND    ┌─────────┐    USER_PROMPT    ┌───┴─────┐
│ unknown │ ───────────────►│  idle   │ ─────────────────►│ working │
└─────────┘                 └─────────┘                   └────┬────┘
     │                           ▲                             │
     │                           │                             │
     │         after 5 min       │                             │
     │      ┌────────────────────┘        ASSISTANT_TOOL_USE   │
     │      │                                                  ▼
     │      │                                        ┌─────────────────┐
     │      │                                        │ needs_approval  │
     │      │                                        └────────┬────────┘
     │      │                                                 │
     │      │                              TOOL_RESULT        │
     │      │                       ┌─────────────────────────┘
     │      │                       │
     │      │                       ▼
     │      │  USER_PROMPT    ┌─────────┐
     └──────┼────────────────►│ waiting │
            │                 └─────────┘
            │                       │
            └───────────────────────┘
                 after 5 min
```

### WebSocket Message Flow

```
┌────────────┐                              ┌────────────┐
│   Client   │                              │   Server   │
└─────┬──────┘                              └─────┬──────┘
      │                                           │
      │  ──────── connect ────────────────────►   │
      │                                           │
      │  ◄─────── {type: 'sessions', [...]} ───   │
      │                                           │
      │  ◄─────── {type: 'session-update', s} ─   │  (on status change)
      │                                           │
      │  ──────── {type: 'session-create', p} ──► │
      │                                           │
      │  ◄─────── {type: 'sessions', [...]} ───   │  (updated list)
      │                                           │
      │  ──────── {type: 'terminal-attach', id} ► │
      │                                           │
      │  ◄─────── {type: 'terminal-output', d} ─  │  (PTY output stream)
      │                                           │
      │  ──────── {type: 'terminal-input', d} ──► │  (user keystrokes)
      │                                           │
      │  ──────── {type: 'terminal-resize', c,r}► │  (debounced)
      │                                           │
      │  ──────── {type: 'terminal-detach', id} ► │
      │                                           │
      │  ◄─────── {type: 'error', msg} ─────────  │  (on any error)
      │                                           │
```

### Directory Structure

```
agentboard/
├── SPEC.md
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── .gitignore
├── .nvmrc
│
├── src/
│   ├── shared/                 # Shared between client & server
│   │   └── types.ts            # Session, SessionStatus, WSMessage types
│   │
│   ├── client/                 # Frontend
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── SessionCard.tsx
│   │   │   ├── Terminal.tsx
│   │   │   └── NewSessionModal.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useTerminal.ts
│   │   │   ├── useNotifications.ts
│   │   │   └── useFaviconBadge.ts
│   │   ├── stores/
│   │   │   └── sessionStore.ts
│   │   └── styles/
│   │       └── index.css
│   │
│   └── server/                 # Backend
│       ├── index.ts            # Entry point, WebSocket handler
│       ├── config.ts           # Environment variables
│       ├── prerequisites.ts    # Check tmux/claude installed
│       ├── SessionManager.ts   # tmux discovery/creation
│       ├── SessionRegistry.ts  # In-memory session store
│       ├── StatusWatcher.ts    # Log file watching orchestration
│       ├── logDiscovery.ts     # Find log files from project path
│       ├── logParser.ts        # Parse JSONL log lines
│       ├── statusMachine.ts    # XState status machine
│       └── TerminalProxy.ts    # WebSocket ↔ PTY bridge
│
├── public/
│   ├── favicon.svg
│   ├── favicon-badge.svg
│   └── notification.mp3
│
└── scripts/
    └── claude-session.sh       # Helper script for manual session creation
```

---

## Risks

- **node-pty compilation issues** (severity: medium)
  - Requires native compilation; may fail without proper build tools
  - **Mitigation:** Document prerequisites (Xcode CLI tools on macOS, build-essential on Linux). Add check in prerequisites.ts. Provide troubleshooting in README.

- **Claude Code JSONL format instability** (severity: medium)
  - Log format is not a public API; could change between Claude Code versions
  - **Mitigation:** Isolate parsing in `logParser.ts`. Gracefully fall back to 'unknown' status on parse errors. Log parsing failures for debugging. Version-check Claude Code if possible.

- **tmux or Claude not installed** (severity: high)
  - Server will fail to start or produce confusing errors
  - **Mitigation:** `prerequisites.ts` checks for `tmux` and `claude` binaries on startup. Fail fast with clear error message.

- **tmux session CWD detection failure** (severity: low)
  - CWD might be wrong if session started with unusual command or changed directories
  - **Mitigation:** Use pane CWD via tmux command. Show project path in UI so user can verify. Allow manual path override in future.

- **Large log files cause performance issues** (severity: medium)
  - JSONL logs can grow to many MB; parsing entire file is slow
  - **Mitigation:** Implement tail-reading: track file position, only read appended content. Initial parse reads last 1000 lines only.

- **WebSocket connection instability** (severity: medium)
  - Network interruptions disconnect dashboard; lose terminal connection
  - **Mitigation:** Exponential backoff reconnection. Show connection status clearly. Terminal detaches cleanly on disconnect.

- **Multiple clients editing same terminal** (severity: low)
  - Two browser tabs could send conflicting input to same terminal
  - **Mitigation:** Accept for MVP (tmux handles this naturally). Document behavior.

- **Project hash mismatch** (severity: medium)
  - If we hash project paths differently than Claude Code, can't find logs
  - **Mitigation:** Test against known project to verify hash algorithm. Fall back to directory scanning if hash fails.

---

## Alternatives Considered

- **Separate frontend/backend npm packages**: Rejected - monorepo simpler; shared types in `src/shared/` eliminates type drift
- **Socket.io instead of ws**: Rejected - ws is lighter; we don't need Socket.io's room/namespace features
- **Redux instead of Zustand**: Rejected - Zustand has less boilerplate for small app; TypeScript support excellent
- **Using ttyd as subprocess**: Rejected - ttyd is binary, not library; would need one process per terminal; can't integrate with our WebSocket
- **Electron app**: Rejected - web app enables remote access (phone, other devices) per requirements
- **Polling instead of WebSocket**: Rejected - real-time updates essential for terminal I/O and instant status changes
- **Binary WebSocket for terminal I/O**: Deferred - JSON is simpler; can optimize later if needed
- **Separate WebSocket for terminal vs status**: Rejected - single multiplexed connection simpler; reduces connection overhead

---

## Notes for Agents

### Reference Code in SPEC.md
- Status machine: SPEC lines 138-170 has exact XState configuration
- Terminal proxy: SPEC lines 185-216 has node-pty spawn arguments for tmux attach
- Session manager: SPEC lines 223-250 has tmux command examples
- Notifications: SPEC lines 366-388 has browser notification code

### Implementation Guidance
- Mobile layout: Use Tailwind responsive classes (`md:grid-cols-4`, below that stack vertically)
- "Needs Approval" column: Use amber/red background (`bg-amber-50 border-amber-200`), optional pulse animation on cards
- Terminal sizing: Use CSS `height: 300px` on desktop, `100vh` minus header on mobile
- Frontend connects to WebSocket at same origin `/ws` path (proxied in dev)
- Use `concurrently` npm package to run Vite and Express dev servers together

### Key Implementation Details
- **Log tail reading**: Track file size, on 'change' event read only bytes after previous position
- **Resize debouncing**: 100ms debounce prevents PTY thrashing during window resize drag
- **Session refresh interval**: 5000ms poll catches external session changes
- **State machine timeouts**: 5min idle transition (300000ms), 5s approval fallback (5000ms)
- **WebSocket reconnect backoff**: 1s, 2s, 4s, 8s... max 30s

### Testing Checklist
- [ ] Can discover existing `claude-*` tmux sessions
- [ ] Can create new session and see it appear
- [ ] Terminal shows real tmux output
- [ ] Keystrokes in browser reach tmux
- [ ] Status changes when Claude starts/stops working
- [ ] Notification fires when session needs approval
- [ ] Mobile layout works on narrow viewport
- [ ] Reconnects after simulated network drop
