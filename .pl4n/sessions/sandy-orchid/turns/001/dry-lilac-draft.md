# Agentboard Implementation Plan

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
| Terminal | xterm.js + xterm-addon-fit |
| Client state | Zustand |
| Backend | Node.js + Express |
| WebSocket | ws library |
| PTY | node-pty |
| File watching | chokidar |
| State machine | XState v5 |

### Key Data Structures

```typescript
// Session model
interface Session {
  id: string              // UUID
  name: string            // Display name (folder basename)
  tmuxSession: string     // e.g., "claude-myproject"
  projectPath: string     // /Users/gary/code/myproject
  status: SessionStatus
  lastActivity: Date
  logFile?: string        // Path to JSONL being watched
}

type SessionStatus =
  | 'working'         // Claude actively processing
  | 'needs_approval'  // Waiting for tool approval
  | 'waiting'         // Claude done, waiting for user
  | 'idle'            // No activity for 5+ minutes
  | 'unknown'         // Can't determine status

// WebSocket message types
type WSMessage =
  | { type: 'sessions'; sessions: Session[] }
  | { type: 'session-update'; session: Session }
  | { type: 'terminal-output'; sessionId: string; data: string }
  | { type: 'terminal-input'; sessionId: string; data: string }
  | { type: 'terminal-resize'; sessionId: string; cols: number; rows: number }
  | { type: 'terminal-attach'; sessionId: string }
  | { type: 'terminal-detach'; sessionId: string }
```

---

## Summary

Build a full-stack TypeScript application from scratch using Vite+React frontend and Express+node-pty backend. The implementation follows an incremental approach: (1) project scaffolding with working dev server, (2) session discovery and management via tmux commands, (3) terminal proxy using node-pty to attach to tmux sessions, (4) status detection by parsing Claude Code JSONL logs with XState, (5) responsive kanban UI with Tailwind, and (6) browser notifications for attention-needed states.

---

## Clarifications

### Assumptions

| # | Assumption | Rationale |
|---|------------|-----------|
| A1 | Monorepo structure with `src/client` and `src/server` | SPEC directory structure shows this; simpler than separate packages |
| A2 | Vite dev proxy forwards API/WebSocket to Express | Standard pattern; avoids CORS during development |
| A3 | Production bundles frontend into `dist/`, served by Express | Single-process deployment |
| A4 | Session naming uses `claude-{basename}` convention | SPEC defines this; dashboard filters to `claude-*` prefix |
| A5 | tmux CWD obtainable via `tmux display-message -p -t {session} '#{pane_current_path}'` | Standard tmux command |
| A6 | Claude Code logs are in `~/.claude/projects/{hash}/` with JSONL files | Per SPEC; format assumed similar to claude-code-ui parsing |
| A7 | Single WebSocket multiplexes both status updates and terminal I/O | Cleaner than multiple connections; differentiated by message type |
| A8 | node-pty compiles successfully on macOS with Xcode CLI tools | Standard setup; document prerequisites |

### Questions

**Q1: What is the exact Claude Code JSONL log format?**
- Context: Status detection depends on parsing specific event types
- Agent recommends: Use events from SPEC (`USER_PROMPT`, `ASSISTANT_TOOL_USE`, `TOOL_RESULT`, `TURN_END`) and add graceful fallback to 'unknown' for unparseable logs. Can refine once we see actual logs.
- **Answer:** _(pending)_

**Q2: How to match tmux session to its log file?**
- Context: Need to map `claude-myproject` tmux session to the correct JSONL in `~/.claude/projects/`
- Agent recommends: Get CWD from tmux session, then search `~/.claude/projects/*/` for a log file where the project path matches. Use most recently modified JSONL file.
- **Answer:** _(pending)_

**Q3: Default port number?**
- Context: Need a port for the web server
- Agent recommends: Port 4040 (avoids common dev ports like 3000, 5173, 8080)
- **Answer:** _(pending)_

**Q4: Session creation UI - directory picker approach?**
- Context: Web browsers can't do native directory pickers easily
- Agent recommends: Text input with recent directories autocomplete (read from `~/.claude/projects/`), or allow pasting absolute paths
- **Answer:** _(pending)_

---

## Tasks

### Phase 1: Project Skeleton

- [ ] **Task 1.1**: Initialize npm project with TypeScript configuration
  - **Files:** `package.json` (create), `tsconfig.json` (create), `tsconfig.node.json` (create)
  - **Rationale:** Foundation for TypeScript; need separate tsconfig for Node.js server code
  - **Dependencies:** none

- [ ] **Task 1.2**: Set up Vite with React and Tailwind CSS
  - **Files:** `vite.config.ts` (create), `tailwind.config.js` (create), `postcss.config.js` (create), `index.html` (create), `src/client/main.tsx` (create), `src/client/App.tsx` (create), `src/client/styles/index.css` (create)
  - **Rationale:** Frontend tooling with hot reload; Tailwind for responsive utility-first styling
  - **Dependencies:** Task 1.1

- [ ] **Task 1.3**: Create Express server with WebSocket support
  - **Files:** `src/server/index.ts` (create), `src/server/types.ts` (create)
  - **Rationale:** Backend entry point; ws library for WebSocket handling
  - **Dependencies:** Task 1.1

- [ ] **Task 1.4**: Configure Vite proxy to forward /api and /ws to Express
  - **Files:** `vite.config.ts` (modify), `package.json` (modify - add dev scripts)
  - **Rationale:** Enables frontend-backend communication during development
  - **Dependencies:** Task 1.2, Task 1.3

- [ ] **Task 1.5**: Add npm scripts for dev, build, and start
  - **Files:** `package.json` (modify)
  - **Rationale:** `npm run dev` runs both Vite and Express concurrently; `npm start` for production
  - **Dependencies:** Task 1.4

- [ ] **Task 1.6**: Verify hello-world WebSocket communication
  - **Files:** (testing only)
  - **Rationale:** Confirm full-stack setup works before adding features
  - **Dependencies:** Task 1.5

### Phase 2: Session Management Backend

- [ ] **Task 2.1**: Create SessionManager class with tmux discovery
  - **Files:** `src/server/SessionManager.ts` (create)
  - **Rationale:** List tmux sessions matching `claude-*` prefix; extract CWD for each
  - **Dependencies:** Phase 1

- [ ] **Task 2.2**: Implement session creation (tmux new-session)
  - **Files:** `src/server/SessionManager.ts` (modify)
  - **Rationale:** Create detached tmux session running `claude` in specified directory
  - **Dependencies:** Task 2.1

- [ ] **Task 2.3**: Implement session termination (tmux kill-session)
  - **Files:** `src/server/SessionManager.ts` (modify)
  - **Rationale:** Allow dashboard to close sessions
  - **Dependencies:** Task 2.1

- [ ] **Task 2.4**: Create Session Registry with event emission
  - **Files:** `src/server/SessionRegistry.ts` (create)
  - **Rationale:** In-memory Map of sessions; emits events when sessions change
  - **Dependencies:** Task 2.1

- [ ] **Task 2.5**: Add WebSocket endpoints for session list/create/delete
  - **Files:** `src/server/index.ts` (modify)
  - **Rationale:** Frontend needs to query and mutate sessions
  - **Dependencies:** Task 2.4

- [ ] **Task 2.6**: Periodic session refresh (poll tmux every 5s)
  - **Files:** `src/server/SessionManager.ts` (modify), `src/server/index.ts` (modify)
  - **Rationale:** Detect sessions created/killed outside dashboard
  - **Dependencies:** Task 2.4

### Phase 3: Terminal Proxy

- [ ] **Task 3.1**: Create TerminalProxy class with node-pty
  - **Files:** `src/server/TerminalProxy.ts` (create)
  - **Rationale:** Spawn PTY that attaches to tmux session
  - **Dependencies:** Phase 2

- [ ] **Task 3.2**: Implement attach/detach lifecycle
  - **Files:** `src/server/TerminalProxy.ts` (modify)
  - **Rationale:** Create PTY on client connect, kill on disconnect; handle resize
  - **Dependencies:** Task 3.1

- [ ] **Task 3.3**: Wire PTY I/O to WebSocket messages
  - **Files:** `src/server/TerminalProxy.ts` (modify), `src/server/index.ts` (modify)
  - **Rationale:** Forward PTY output to client, client input to PTY
  - **Dependencies:** Task 3.2

- [ ] **Task 3.4**: Add xterm.js to frontend
  - **Files:** `src/client/components/Terminal.tsx` (create), `package.json` (modify - add xterm deps)
  - **Rationale:** Web terminal emulator rendering PTY output
  - **Dependencies:** Phase 1

- [ ] **Task 3.5**: Create useTerminal hook for WebSocket terminal I/O
  - **Files:** `src/client/hooks/useTerminal.ts` (create)
  - **Rationale:** Encapsulate terminal attach/detach/input/resize logic
  - **Dependencies:** Task 3.4

- [ ] **Task 3.6**: Wire Terminal component to useTerminal hook
  - **Files:** `src/client/components/Terminal.tsx` (modify)
  - **Rationale:** Connect xterm.js to backend terminal proxy
  - **Dependencies:** Task 3.4, Task 3.5

- [ ] **Task 3.7**: Test interactive terminal - typing flows to tmux
  - **Files:** (testing only)
  - **Rationale:** Verify bidirectional I/O works correctly
  - **Dependencies:** Task 3.6

### Phase 4: Status Detection

- [ ] **Task 4.1**: Implement log file discovery
  - **Files:** `src/server/StatusWatcher.ts` (create)
  - **Rationale:** Given project path, find JSONL log in `~/.claude/projects/`
  - **Dependencies:** Phase 2

- [ ] **Task 4.2**: Create JSONL log parser
  - **Files:** `src/server/logParser.ts` (create)
  - **Rationale:** Parse log lines into typed events (USER_PROMPT, ASSISTANT_TOOL_USE, etc.)
  - **Dependencies:** Task 4.1

- [ ] **Task 4.3**: Implement XState status machine
  - **Files:** `src/server/statusMachine.ts` (create)
  - **Rationale:** State machine per SPEC: unknown → idle → working → needs_approval/waiting
  - **Dependencies:** Task 4.2

- [ ] **Task 4.4**: Set up chokidar file watching
  - **Files:** `src/server/StatusWatcher.ts` (modify)
  - **Rationale:** Watch log files for appended lines; feed to state machine
  - **Dependencies:** Task 4.3

- [ ] **Task 4.5**: Connect StatusWatcher to Session Registry
  - **Files:** `src/server/StatusWatcher.ts` (modify), `src/server/SessionRegistry.ts` (modify)
  - **Rationale:** Update session status when state machine transitions
  - **Dependencies:** Task 4.4

- [ ] **Task 4.6**: Broadcast status updates via WebSocket
  - **Files:** `src/server/index.ts` (modify)
  - **Rationale:** Push status changes to all connected clients in real-time
  - **Dependencies:** Task 4.5

### Phase 5: Kanban Dashboard UI

- [ ] **Task 5.1**: Create Zustand store for sessions
  - **Files:** `src/client/stores/sessionStore.ts` (create)
  - **Rationale:** Client-side state: sessions list, selected session, terminal state
  - **Dependencies:** Phase 1

- [ ] **Task 5.2**: Create useWebSocket hook for session updates
  - **Files:** `src/client/hooks/useWebSocket.ts` (create)
  - **Rationale:** Connect to backend WebSocket, update Zustand store on messages
  - **Dependencies:** Task 5.1

- [ ] **Task 5.3**: Create SessionCard component
  - **Files:** `src/client/components/SessionCard.tsx` (create)
  - **Rationale:** Display session name, status badge, last activity, open button
  - **Dependencies:** Task 5.1

- [ ] **Task 5.4**: Create Dashboard component with 4 kanban columns
  - **Files:** `src/client/components/Dashboard.tsx` (create)
  - **Rationale:** Working | Needs Approval | Waiting | Idle columns
  - **Dependencies:** Task 5.3

- [ ] **Task 5.5**: Style kanban with Tailwind (desktop layout)
  - **Files:** `src/client/components/Dashboard.tsx` (modify), `src/client/components/SessionCard.tsx` (modify)
  - **Rationale:** CSS Grid layout, status-based colors (red for needs_approval), hover effects
  - **Dependencies:** Task 5.4

- [ ] **Task 5.6**: Integrate Terminal panel in App layout
  - **Files:** `src/client/App.tsx` (modify)
  - **Rationale:** Dashboard top, Terminal bottom (collapsible); click card opens terminal
  - **Dependencies:** Task 5.4, Task 3.6

- [ ] **Task 5.7**: Implement mobile responsive layout
  - **Files:** `src/client/components/Dashboard.tsx` (modify), `src/client/App.tsx` (modify)
  - **Rationale:** Stack columns vertically on mobile; fullscreen terminal overlay
  - **Dependencies:** Task 5.5, Task 5.6

### Phase 6: Session Creation UI

- [ ] **Task 6.1**: Create NewSessionModal component
  - **Files:** `src/client/components/NewSessionModal.tsx` (create)
  - **Rationale:** Modal with project path input, optional session name override
  - **Dependencies:** Phase 5

- [ ] **Task 6.2**: Add "+ New Session" button to header
  - **Files:** `src/client/App.tsx` (modify)
  - **Rationale:** Trigger to open NewSessionModal
  - **Dependencies:** Task 6.1

- [ ] **Task 6.3**: Wire up session creation via WebSocket
  - **Files:** `src/client/components/NewSessionModal.tsx` (modify)
  - **Rationale:** Send create request, handle success/error, close modal
  - **Dependencies:** Task 6.1, Task 2.5

- [ ] **Task 6.4**: Add session delete/kill button on cards
  - **Files:** `src/client/components/SessionCard.tsx` (modify)
  - **Rationale:** Allow terminating sessions from dashboard
  - **Dependencies:** Task 5.3, Task 2.5

### Phase 7: Notifications & Polish

- [ ] **Task 7.1**: Request notification permission on first visit
  - **Files:** `src/client/hooks/useNotifications.ts` (create)
  - **Rationale:** Need permission before showing browser notifications
  - **Dependencies:** Phase 5

- [ ] **Task 7.2**: Show browser notification when session needs approval
  - **Files:** `src/client/hooks/useNotifications.ts` (modify)
  - **Rationale:** Alert user even when tab is not focused
  - **Dependencies:** Task 7.1

- [ ] **Task 7.3**: Add notification sound
  - **Files:** `public/notification.mp3` (create or source), `src/client/hooks/useNotifications.ts` (modify)
  - **Rationale:** Audio cue for attention-needed state
  - **Dependencies:** Task 7.2

- [ ] **Task 7.4**: Implement favicon badge for attention state
  - **Files:** `src/client/hooks/useNotifications.ts` (modify), `public/favicon.svg` (create)
  - **Rationale:** Red dot badge when any session needs approval
  - **Dependencies:** Task 7.1

- [ ] **Task 7.5**: Add loading states and error handling
  - **Files:** `src/client/components/Dashboard.tsx` (modify), `src/client/components/Terminal.tsx` (modify)
  - **Rationale:** Show skeletons during load, error messages on failure
  - **Dependencies:** Phase 5, Phase 3

- [ ] **Task 7.6**: Handle terminal resize on window change
  - **Files:** `src/client/components/Terminal.tsx` (modify)
  - **Rationale:** Re-fit xterm.js dimensions and notify backend
  - **Dependencies:** Task 3.6

- [ ] **Task 7.7**: Add WebSocket reconnection with exponential backoff
  - **Files:** `src/client/hooks/useWebSocket.ts` (modify)
  - **Rationale:** Gracefully handle network interruptions
  - **Dependencies:** Task 5.2

- [ ] **Task 7.8**: Connection status indicator in header
  - **Files:** `src/client/App.tsx` (modify)
  - **Rationale:** Show green/red dot for WebSocket connection state
  - **Dependencies:** Task 7.7

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
      │  ◄─────── {type: 'session-update', s} ─   │  (when status changes)
      │                                           │
      │  ──────── {type: 'terminal-attach', id} ► │
      │                                           │
      │  ◄─────── {type: 'terminal-output', d} ─  │  (PTY output stream)
      │                                           │
      │  ──────── {type: 'terminal-input', d} ──► │  (user keystrokes)
      │                                           │
      │  ──────── {type: 'terminal-resize', c,r}► │  (on window resize)
      │                                           │
      │  ──────── {type: 'terminal-detach', id} ► │
      │                                           │
```

---

## Risks

- **node-pty compilation issues** (severity: medium)
  - Requires native compilation; may fail without proper build tools
  - **Mitigation:** Document prerequisites (Xcode CLI tools on macOS). Add troubleshooting section to README.

- **Claude Code JSONL format instability** (severity: medium)
  - Log format is not a public API; could change between versions
  - **Mitigation:** Isolate parsing in `logParser.ts`. Gracefully fall back to 'unknown' status on parse errors. Log parsing failures for debugging.

- **tmux session CWD detection failure** (severity: low)
  - CWD might be wrong if session started with unusual command
  - **Mitigation:** Use initial tmux CWD. Allow manual path override in session card settings.

- **WebSocket connection instability** (severity: medium)
  - Network interruptions will disconnect dashboard
  - **Mitigation:** Implement reconnection with exponential backoff. Show connection status indicator.

- **Multiple clients editing same terminal** (severity: low)
  - Two browser tabs could send conflicting input to same terminal
  - **Mitigation:** Accept this for MVP. Document single-active-terminal limitation.

---

## Alternatives Considered

- **Separate frontend/backend npm packages**: Rejected - monorepo simpler for solo development; shared types easier
- **Socket.io instead of ws**: Rejected - ws is lighter; we don't need Socket.io features
- **Redux instead of Zustand**: Rejected - Zustand has less boilerplate for small app
- **Using ttyd as subprocess**: Rejected - ttyd is binary, not library; would need one process per terminal
- **Electron app**: Rejected - web app enables remote access (phone, other devices) per requirements
- **Polling instead of WebSocket**: Rejected - real-time updates essential for terminal I/O

---

## Notes for Agents

- SPEC.md contains detailed TypeScript code snippets for each backend component. Reference these when implementing.
- The status machine in SPEC lines 138-170 shows the exact XState configuration to use.
- Terminal proxy code in SPEC lines 185-216 shows node-pty spawn arguments for tmux attach.
- Mobile layout should use Tailwind responsive classes (`md:`, `lg:`) to stack columns vertically.
- "Needs Approval" column should have visual prominence - red/amber background, optional pulse animation.
- Frontend connects to WebSocket at `/ws` path (proxied in dev, same origin in prod).
- Use `concurrently` npm package to run Vite and Express in parallel during development.
