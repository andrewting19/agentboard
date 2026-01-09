# Agentboard Implementation Plan

## Background and Context

### Project State
This is a **greenfield project** with no existing code. The only file is `SPEC.md`, which contains:
- Detailed architecture diagram showing Browser → WebSocket → Backend → tmux/logs flow
- TypeScript interfaces for `Session` and `SessionStatus` types
- XState machine definition for status detection
- UX mockups for desktop and mobile layouts
- Tech stack decisions and directory structure
- A phased implementation plan

### Key Architecture Components

```
┌───────────────┐     WebSocket      ┌───────────────────────────────┐
│    Browser    │ ◄─────────────────►│        Node.js Server         │
│  (React/Vite) │                    │                               │
│               │                    │  SessionManager (tmux ops)    │
│  - Dashboard  │                    │  StatusWatcher (log parsing)  │
│  - Terminal   │                    │  TerminalProxy (PTY bridge)   │
│  - xterm.js   │                    │  Session Registry (Map)       │
└───────────────┘                    └───────────────────────────────┘
                                                │           │
                                                ▼           ▼
                                     ~/.claude/projects/   tmux sessions
                                         (JSONL logs)      (claude-*)
```

### Tech Stack (from SPEC)
| Layer | Technology |
|-------|------------|
| Frontend | React + Vite + Tailwind CSS |
| Terminal | xterm.js + xterm-addon-fit |
| State | Zustand |
| Backend | Node.js + Express |
| WebSocket | ws |
| PTY | node-pty |
| File watching | chokidar |
| State machine | XState |

### Data Structures

```typescript
interface Session {
  id: string                    // UUID
  name: string                  // Display name (project folder name)
  tmuxSession: string           // tmux session name, e.g., "claude-myproject"
  projectPath: string           // /Users/gary/code/myproject
  status: SessionStatus
  lastActivity: Date
  logFile?: string              // Path to JSONL log being watched
}

type SessionStatus =
  | 'working'         // Claude actively processing
  | 'needs_approval'  // Waiting for tool approval
  | 'waiting'         // Claude done, waiting for user input
  | 'idle'            // No activity for 5+ minutes
  | 'unknown'         // Can't determine (no log file found)
```

---

## Summary

Build a full-stack web application from scratch that provides a kanban-style dashboard for monitoring Claude Code tmux sessions. The implementation follows a bottom-up approach: first establish the project skeleton with build tooling, then implement backend session management and terminal proxy, followed by status detection via log parsing, and finally the responsive kanban UI with notifications.

---

## Clarifications

### Assumptions

| # | Assumption | Rationale |
|---|------------|-----------|
| A1 | Single monorepo with shared tsconfig for client/server | SPEC shows unified `src/client` and `src/server` structure, simpler than separate packages |
| A2 | Development uses Vite proxy to Express backend | Standard pattern for Vite + Express apps; avoids CORS issues |
| A3 | Production serves static frontend from Express | Simpler deployment; single process to run |
| A4 | Claude Code JSONL logs contain parseable event types | Referenced from claude-code-ui project; logs contain structured events |
| A5 | tmux session CWD can be reliably obtained | Using `tmux display-message -p -t {session} '#{pane_current_path}'` |
| A6 | Project hash for log folder follows Claude Code's algorithm | Need to investigate or use file system search as fallback |
| A7 | `node-pty` works on macOS without additional setup | Standard npm install should work; may need Xcode command line tools |
| A8 | Single WebSocket connection multiplexes status updates + terminal I/O | Cleaner than multiple connections; use message types to differentiate |

### Questions

**Q1: What is the Claude Code JSONL log format?**
- Context: The status detection depends on parsing log events. The spec mentions `USER_PROMPT`, `ASSISTANT_TOOL_USE`, `TOOL_RESULT`, `TURN_END` events, but the actual log format needs verification.
- My lean: Reference claude-code-ui implementation for parsing logic; the format is likely `{"type": "...", "timestamp": "...", ...}` per line.
- **Answer:** _Pending user input_

**Q2: Should the dashboard auto-discover ALL tmux sessions or only `claude-*` prefixed ones?**
- Context: The spec proposes `claude-{project-name}` naming convention. But users might have existing sessions with different names.
- My lean: Start with `claude-*` prefix filter as spec suggests, but add a settings toggle to "show all tmux sessions" for flexibility.
- **Answer:** _Pending user input - Agent recommends starting with `claude-*` prefix only_

**Q3: How should we handle the "New Session" dialog - directory picker vs text input?**
- Context: Creating a new session requires a project path. Web browsers can't do native directory pickers easily.
- My lean: Text input field with autocomplete from recent projects (read from `~/.claude/projects/`), plus optional drag-and-drop folder path from Finder.
- **Answer:** _Pending user input - Agent recommends text input with recent projects autocomplete_

**Q4: Port number for the web server?**
- Context: Need to pick a default port. Common choices: 3000, 8080, 5000.
- My lean: Use port 3333 (memorable, unlikely to conflict with common dev servers).
- **Answer:** _Pending user input - Agent recommends port 3333_

---

## Tasks

### Phase 1: Project Skeleton

- [ ] **Task 1.1**: Initialize npm project with TypeScript
  - **Files:** `package.json` (create), `tsconfig.json` (create), `tsconfig.node.json` (create)
  - **Rationale:** Foundation for all TypeScript code; separate tsconfig for Node.js server
  - **Dependencies:** none

- [ ] **Task 1.2**: Set up Vite with React and Tailwind
  - **Files:** `vite.config.ts` (create), `tailwind.config.js` (create), `postcss.config.js` (create), `src/client/main.tsx` (create), `src/client/App.tsx` (create), `src/client/styles/index.css` (create), `index.html` (create)
  - **Rationale:** Frontend build tooling; Tailwind for responsive styling
  - **Dependencies:** Task 1.1

- [ ] **Task 1.3**: Create Express server with WebSocket support
  - **Files:** `src/server/index.ts` (create), `src/server/types.ts` (create)
  - **Rationale:** Backend entry point; WebSocket handler setup
  - **Dependencies:** Task 1.1

- [ ] **Task 1.4**: Configure dev server with Vite proxy to Express
  - **Files:** `vite.config.ts` (modify), `package.json` (modify - add scripts)
  - **Rationale:** Enable frontend to connect to backend during development
  - **Dependencies:** Task 1.2, Task 1.3

- [ ] **Task 1.5**: Verify end-to-end "Hello World" communication
  - **Files:** none (testing)
  - **Rationale:** Ensure build setup works before adding features
  - **Dependencies:** Task 1.4

### Phase 2: Session Management Backend

- [ ] **Task 2.1**: Implement SessionManager class
  - **Files:** `src/server/SessionManager.ts` (create)
  - **Rationale:** Core logic for tmux session discovery, creation, and termination
  - **Dependencies:** Phase 1

- [ ] **Task 2.2**: Implement session discovery via tmux commands
  - **Files:** `src/server/SessionManager.ts` (modify)
  - **Rationale:** List `claude-*` sessions, extract CWD for each
  - **Dependencies:** Task 2.1

- [ ] **Task 2.3**: Implement session creation
  - **Files:** `src/server/SessionManager.ts` (modify)
  - **Rationale:** Create new detached tmux session running `claude` in specified directory
  - **Dependencies:** Task 2.1

- [ ] **Task 2.4**: Create Session Registry (in-memory Map)
  - **Files:** `src/server/SessionRegistry.ts` (create)
  - **Rationale:** Central data store for sessions; emit events on changes
  - **Dependencies:** Task 2.1

- [ ] **Task 2.5**: Add REST/WebSocket endpoints for session operations
  - **Files:** `src/server/index.ts` (modify)
  - **Rationale:** API for frontend to list/create/delete sessions
  - **Dependencies:** Task 2.4

### Phase 3: Terminal Proxy

- [ ] **Task 3.1**: Implement TerminalProxy class with node-pty
  - **Files:** `src/server/TerminalProxy.ts` (create)
  - **Rationale:** Bridge between WebSocket and tmux PTY
  - **Dependencies:** Phase 2

- [ ] **Task 3.2**: Handle terminal attach/detach lifecycle
  - **Files:** `src/server/TerminalProxy.ts` (modify)
  - **Rationale:** Spawn PTY on connect, kill on disconnect; handle resize
  - **Dependencies:** Task 3.1

- [ ] **Task 3.3**: Implement WebSocket message protocol for terminal I/O
  - **Files:** `src/server/TerminalProxy.ts` (modify), `src/server/types.ts` (modify)
  - **Rationale:** Define message types: `{type: 'output', data}`, `{type: 'input', data}`, `{type: 'resize', cols, rows}`
  - **Dependencies:** Task 3.1

- [ ] **Task 3.4**: Add xterm.js to frontend with fit addon
  - **Files:** `src/client/components/Terminal.tsx` (create), `package.json` (modify)
  - **Rationale:** Web terminal emulator that renders PTY output
  - **Dependencies:** Phase 1

- [ ] **Task 3.5**: Wire up WebSocket in Terminal component
  - **Files:** `src/client/components/Terminal.tsx` (modify), `src/client/hooks/useWebSocket.ts` (create)
  - **Rationale:** Connect xterm.js to backend terminal proxy
  - **Dependencies:** Task 3.3, Task 3.4

- [ ] **Task 3.6**: Test interactive terminal - typing flows to tmux
  - **Files:** none (testing)
  - **Rationale:** Verify bidirectional I/O works
  - **Dependencies:** Task 3.5

### Phase 4: Status Detection

- [ ] **Task 4.1**: Implement log file discovery
  - **Files:** `src/server/StatusWatcher.ts` (create)
  - **Rationale:** Map project path → `~/.claude/projects/{hash}/` directory
  - **Dependencies:** Phase 2

- [ ] **Task 4.2**: Implement JSONL log parsing
  - **Files:** `src/server/StatusWatcher.ts` (modify), `src/server/logParser.ts` (create)
  - **Rationale:** Parse log lines into events (USER_PROMPT, ASSISTANT_TOOL_USE, etc.)
  - **Dependencies:** Task 4.1

- [ ] **Task 4.3**: Implement XState status machine
  - **Files:** `src/server/statusMachine.ts` (create)
  - **Rationale:** State machine for session status transitions
  - **Dependencies:** Task 4.2

- [ ] **Task 4.4**: Set up chokidar file watching
  - **Files:** `src/server/StatusWatcher.ts` (modify)
  - **Rationale:** Watch log files for new lines, feed to state machine
  - **Dependencies:** Task 4.3

- [ ] **Task 4.5**: Emit status changes to Session Registry
  - **Files:** `src/server/StatusWatcher.ts` (modify), `src/server/SessionRegistry.ts` (modify)
  - **Rationale:** Update session status when state machine transitions
  - **Dependencies:** Task 4.4

- [ ] **Task 4.6**: Broadcast status updates via WebSocket
  - **Files:** `src/server/index.ts` (modify)
  - **Rationale:** Push status changes to all connected clients
  - **Dependencies:** Task 4.5

### Phase 5: Kanban Dashboard UI

- [ ] **Task 5.1**: Create Zustand store for sessions
  - **Files:** `src/client/stores/sessionStore.ts` (create)
  - **Rationale:** Client-side state management for sessions
  - **Dependencies:** Phase 1

- [ ] **Task 5.2**: Implement useSessions hook
  - **Files:** `src/client/hooks/useSessions.ts` (create)
  - **Rationale:** Hook that connects WebSocket and updates Zustand store
  - **Dependencies:** Task 5.1, Task 3.5

- [ ] **Task 5.3**: Create SessionCard component
  - **Files:** `src/client/components/SessionCard.tsx` (create)
  - **Rationale:** Individual session display with name, status indicator, open button
  - **Dependencies:** Task 5.1

- [ ] **Task 5.4**: Create Dashboard component with kanban columns
  - **Files:** `src/client/components/Dashboard.tsx` (create)
  - **Rationale:** Four columns: Working, Needs Approval, Waiting, Idle
  - **Dependencies:** Task 5.3

- [ ] **Task 5.5**: Style kanban with Tailwind (desktop layout)
  - **Files:** `src/client/components/Dashboard.tsx` (modify), `src/client/components/SessionCard.tsx` (modify)
  - **Rationale:** Clean grid layout, status colors, hover effects
  - **Dependencies:** Task 5.4

- [ ] **Task 5.6**: Add terminal panel below dashboard
  - **Files:** `src/client/App.tsx` (modify)
  - **Rationale:** Click card → open terminal in bottom panel
  - **Dependencies:** Task 5.4, Task 3.4

- [ ] **Task 5.7**: Implement mobile responsive layout
  - **Files:** `src/client/components/Dashboard.tsx` (modify), `src/client/App.tsx` (modify)
  - **Rationale:** Stack columns vertically, fullscreen terminal on mobile
  - **Dependencies:** Task 5.5, Task 5.6

### Phase 6: Session Creation UI

- [ ] **Task 6.1**: Create NewSessionModal component
  - **Files:** `src/client/components/NewSessionModal.tsx` (create)
  - **Rationale:** Dialog for entering project path to create new session
  - **Dependencies:** Phase 5

- [ ] **Task 6.2**: Add "New Session" button to header
  - **Files:** `src/client/App.tsx` (modify)
  - **Rationale:** Trigger to open NewSessionModal
  - **Dependencies:** Task 6.1

- [ ] **Task 6.3**: Wire up session creation API
  - **Files:** `src/client/components/NewSessionModal.tsx` (modify)
  - **Rationale:** POST to backend, update store with new session
  - **Dependencies:** Task 6.1, Task 2.5

### Phase 7: Notifications & Polish

- [ ] **Task 7.1**: Implement browser notification for needs_approval
  - **Files:** `src/client/hooks/useNotifications.ts` (create)
  - **Rationale:** Request permission, show Notification when session needs attention
  - **Dependencies:** Phase 5

- [ ] **Task 7.2**: Add notification sound
  - **Files:** `public/notification.mp3` (create), `src/client/hooks/useNotifications.ts` (modify)
  - **Rationale:** Audio alert for attention-needed state
  - **Dependencies:** Task 7.1

- [ ] **Task 7.3**: Implement favicon badge
  - **Files:** `src/client/hooks/useNotifications.ts` (modify), `public/favicon.svg` (create)
  - **Rationale:** Visual indicator in browser tab when attention needed
  - **Dependencies:** Task 7.1

- [ ] **Task 7.4**: Add loading states and error handling
  - **Files:** `src/client/components/Dashboard.tsx` (modify), `src/client/components/Terminal.tsx` (modify)
  - **Rationale:** Show skeleton/spinner during load, error messages on failure
  - **Dependencies:** Phase 5, Phase 3

- [ ] **Task 7.5**: Handle terminal resize on window change
  - **Files:** `src/client/components/Terminal.tsx` (modify)
  - **Rationale:** Re-fit xterm.js and send resize to backend
  - **Dependencies:** Task 3.4

- [ ] **Task 7.6**: Add session kill/close functionality
  - **Files:** `src/client/components/SessionCard.tsx` (modify), `src/server/index.ts` (modify)
  - **Rationale:** Option to terminate tmux session from dashboard
  - **Dependencies:** Phase 5, Task 2.5

---

## Risks

- **node-pty compilation issues** (severity: medium)
  - node-pty requires native compilation. May fail on some systems without proper build tools.
  - **Mitigation:** Document prerequisites (Xcode CLI tools on macOS, build-essential on Linux). Provide troubleshooting guide.

- **JSONL log format changes** (severity: medium)
  - Claude Code's log format isn't a public API and could change.
  - **Mitigation:** Isolate parsing logic in `logParser.ts`. Add graceful handling for unknown event types. Fall back to 'unknown' status if parsing fails.

- **tmux session CWD detection fails** (severity: low)
  - If tmux session was started with a command that changed directory, CWD might be wrong.
  - **Mitigation:** Use the initial session CWD at creation time if available. Allow manual path override in UI.

- **WebSocket reconnection handling** (severity: medium)
  - Network interruptions could disconnect the dashboard.
  - **Mitigation:** Implement exponential backoff reconnection in useWebSocket hook. Show connection status indicator.

- **Multiple browser tabs/clients** (severity: low)
  - Multiple clients could send conflicting commands to same terminal.
  - **Mitigation:** For MVP, accept this limitation. Document that only one active terminal connection per session is supported.

---

## Alternatives Considered

- **Separate frontend/backend packages**: Rejected because monorepo is simpler for a single-developer project; shared types are easier.

- **Socket.io instead of ws**: Rejected because ws is lighter weight and we don't need Socket.io's room/namespace features.

- **Redux instead of Zustand**: Rejected because Zustand has less boilerplate for a small app.

- **Using ttyd directly**: Rejected because ttyd is a standalone binary, not a library. Would require running separate process per terminal.

- **Electron app instead of web**: Rejected because web app provides remote access capability (phone, other devices) which is a key requirement.

- **Polling instead of WebSocket**: Rejected because real-time updates are essential for status changes and terminal I/O.

---

## Notes for Agents

- The SPEC.md file contains detailed code snippets for each major component. Reference these when implementing.
- The status machine in SPEC.md shows the exact XState configuration to use.
- For the terminal proxy, the SPEC shows exact node-pty spawn arguments for tmux attach.
- Mobile layout should use collapsible columns that stack vertically.
- The "Needs Approval" column should have visual prominence (red/orange styling, animation).
