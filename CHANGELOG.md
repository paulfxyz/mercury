# Changelog

All notable changes to Mercury are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [3.0.0] — 2026-03-28

### Added
- **Smart complexity detection** — Heuristic + LLM classifier routes simple queries to an instant quick-answer and complex ones to the full debate engine
- **5-step inquiry wizard** — Team size, model selection, debate rounds, temperature, and consensus threshold, all in a clean modal flow
- **Quick answer mode** — Single cheap model (`gpt-4o-mini`) answers straightforward questions instantly; user can still escalate to full debate
- **Quick answer banner** — Inline result with "Accept" or "Run expert debate anyway" actions
- **Temperature control** — Per-workflow temperature setting (0 = precise, 1 = creative)
- **Consensus threshold** — Set the required agreement level (50–100%) before Mercury considers the debate settled; early exit when reached
- **Live progress panel** — Real-time WebSocket stream shows every model's response as it arrives, grouped by round and phase
- **"View live progress" toggle** — Defaults open during active sessions; streams each expert response inline
- `POST /api/detect-complexity` — New endpoint for query classification
- `POST /api/quick-answer` — New endpoint for single-model fast path
- `POST /api/inquire` — New endpoint (replaces `/api/research`, which is kept for backwards compat)
- `temperature` and `consensus_threshold` fields on the `workflows` table
- `quick_answer` field on the `sessions` table
- `Dockerfile` and `fly.toml` for Fly.io deployment
- Persistent SQLite volume support via `DB_PATH` environment variable

### Changed
- **Terminology** — "Research" renamed to "Inquire"; "New Research" → "New Inquiry"; "Research query" → "Inquiry"; all session labels updated
- **Onboarding** — Simplified to API key only (no forced workflow creation); workflow creation happens naturally through the wizard
- **Onboarding guard** — Now only blocks on missing API key (was blocking on missing workflow too)
- Orchestrator now accepts `temperature` and `consensusThreshold` parameters
- Phase label `iteration_start` now emits both `phase` (type) and `phaseLabel` (human label)
- Session page defaults live panel to open during active runs
- Phase timeline dots now pulse during the active phase

### Fixed
- WebSocket URL constructed relative to page URL for correct proxy routing
- All API calls use relative `./api/...` paths for compatibility when deployed behind a proxy

---

## [2.0.0] — 2026-03-28

### Added
- Full UX overhaul — white/grey ChatGPT-style design system with Inter font
- Light + dark mode with server-side persistence
- Workflow system — named sequences of AI models with custom system prompts per step
- Onboarding guard — redirects new users through 2-step setup (API key + first workflow)
- ChatGPT-style chat interface with auto-resizing textarea and workflow selector
- Session page with live WebSocket progress bar and 5-phase timeline
- Beautiful results view — consensus %, model badges, markdown final answer, copy/download
- Workflows page — full CRUD, step builder with model search, default star
- Settings page — API key management, theme toggle, danger zone
- `POST /api/settings/theme` — Theme persistence endpoint
- `GET /api/onboarding` — Onboarding state check
- Workflows table in SQLite schema with full CRUD
- All API paths use relative `./api/...` for proxy compatibility

### Changed
- Migrated from old homepage (`home.tsx`) to new chat-centric layout (`chat.tsx`)
- Sidebar now shows recent sessions with status dots

---

## [1.0.0] — 2026-03-27

### Added
- Initial release of Mercury
- Multi-model orchestration via OpenRouter (parallel model calls)
- 5-phase debate cycle: Research → Debate → Vote → Synthesis → Final
- WebSocket real-time session updates
- SQLite persistence — sessions, iterations, settings
- React + TypeScript + Express + Drizzle ORM stack
- File upload support (multer, 5 files, 20MB max)
- Basic settings page with API key management
- Session history with results view
- `GET /api/models` — OpenRouter model list
- `POST /api/research` — Start a debate session
- `GET /api/sessions/:id/iterations` — Full iteration history

---

*Mercury is built and maintained by [@paulfxyz](https://github.com/paulfxyz)*
