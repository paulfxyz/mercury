# Changelog

All notable changes to Mercury are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [3.4.1] — 2026-03-29

### Changed
- **Sidebar** — removed the duplicate "Inquire" nav link; "New Inquiry" at the top already serves this purpose.

---

## [3.4.0] — 2026-03-29

### Added
- **Mobile-first layout** — full responsive overhaul across all pages.
- **Collapsible sidebar** — on mobile the sidebar is hidden by default; a hamburger button (☰) in the top bar opens a slide-in drawer with a dark backdrop overlay. Tapping the backdrop or any nav link closes it automatically.
- **Mobile top bar** — persistent header on mobile shows the Mercury logo, the hamburger, and a compact "+ New" button for quick access.

### Changed
- `Layout.tsx` rewritten: `hidden md:flex` desktop sidebar + fixed drawer for mobile (`z-50`, `translate-x` transition, backdrop `z-40`).
- `h-screen` replaced with `h-[100dvh]` to account for dynamic browser chrome on iOS Safari.
- `chat.tsx` — wizard panel takes full width on mobile (`w-full`), chat panel hides while wizard is open; padding adjusted for small screens; hint text changes from ⌘+Enter to “Tap to send”.
- `workflows.tsx` — slider grid `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`; form panel full-width on mobile.
- `session.tsx` — added bottom padding (`pb-12`) for comfortable scroll; action button row uses `flex-wrap`.
- `settings.tsx` — added bottom padding; page now correctly fills the screen when sidebar is hidden on mobile.

### Fixed
- Settings page was entirely blank on mobile — caused by sidebar consuming 100% of viewport width.
- Wizard panel was unreachable on mobile (hidden behind sidebar).
- Sliders in the workflow form overlapped on small screens.

---

## [3.1.1] — 2026-03-28

### Changed
- **Accept button** — "Accept this answer ↓" replaced with a 👍 `ThumbsUp` icon + "Accept this answer" for a cleaner, more inviting look.

---

## [3.1.0] — 2026-03-28

### Added
- **Debate starter** — After the quick answer, users now see a three-choice picker before any wizard opens: _Quick debate_ (top 3 models · 3 rounds · temp 0.3, one-click), _Saved workflows_ (any saved template, one-click), or _Custom setup_ (opens the full wizard). The common path requires zero configuration.
- **Quick debate defaults** — GPT-4o, Claude 3.5 Sonnet, and Gemini 2.0 Flash with 3 rounds and temperature 0.3; fast and reliable without any setup.
- **Version stamping** — `package.json` version is now kept in sync with releases; CHANGELOG and GitHub releases are updated with every meaningful change.

### Changed
- Wizard panel is now only opened on explicit "Custom setup" — it no longer auto-opens for users who have saved workflows, reducing unnecessary friction.
- `InquiryWizard` simplified from 5 steps to 4 (removed the "saved workflows" step; that choice now lives in the new debate starter).
- `QuickAnswerBanner` no longer contains a "Run expert debate" button — the debate starter replaces that role with richer options.
- Wizard header label changed from "Configure your expert team" to "Custom setup" to match the new flow.

### Fixed
- **Model selection in both wizards** — Replaced Radix `<Dialog>` overlays with sibling split-panel layouts in both `chat.tsx` and `workflows.tsx`. Root cause: Radix Dialog intercepts pointer events at the overlay level, making model dropdown selection impossible. Solution: panel slides in from the right as a plain sibling `div` with no overlay; `ModelSearch` uses `onMouseDown` so selection fires before any blur handler.
- `WorkflowFormDialog` in `workflows.tsx` replaced with `WorkflowFormPanel` using the same split-panel pattern.
- `ModelSearch` dropdown now uses relative positioning inside its container instead of `createPortal`, eliminating all z-index and pointer-capture conflicts.

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
