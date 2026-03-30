# Changelog

All notable changes to Mercury are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [3.7.5] — 2026-03-30

### Fixed
- **Child debate sessions hidden from sidebar** — debate child sessions now have a `parentId` column set. `listSessions()` filters them out, so they never appear in the sidebar or recent list.
- **Child sessions redirect to parent** — if a child session URL is opened directly (e.g. from browser history), the session page immediately redirects to `/session/:parentId`.
- `parent_id` column added to sessions table via safe `ALTER TABLE` migration.

---

## [3.7.4] — 2026-03-30

### Fixed
- **Debates are now append-only child sessions** — launching a debate no longer mutates the parent session or wipes any existing content. Each debate creates its own independent child session, which renders as a self-contained animated block appended below all previous content.
- `POST /api/sessions/:id/debate` now creates a child `Session` row, appends its ID to the parent's `debates` JSON column, and broadcasts `debate_started` to the parent's WebSocket channel. The parent session status is never changed.
- `DebateBlock` component in `session.tsx`: self-contained, opens its own WebSocket to the child session, renders live progress (phase timeline, round counter, model responses streaming), and shows history + consensus answer once complete.
- The full session thread is now strictly append-only: quick answer → debate blocks (each running and completing in sequence) → follow-ups. Nothing is ever overwritten or scrolled away.
- After each debate block completes, a new `DebateStarter` appears so another debate or workflow can be launched immediately.

---

## [3.7.3] — 2026-03-30

### Fixed
- **Markdown rendering** — complete rewrite of `renderMarkdown` as a proper line-by-line parser. Lists no longer get wrapped in `<p>` tags. Headings don't get double-wrapped. Unordered and ordered lists open/close cleanly. Bullet points now render correctly everywhere (quick answers, debate results, follow-ups).
- **Chronological render order** — session page now always shows content in strict order: initial quick answer → debate starter (if no debate yet) → debate history (rounds) → consensus answer → follow-ups → follow-up input.
- **Quick answer always visible** — the initial `gpt-4o-mini` answer is always shown at the top of the session, even after a full debate runs on top of it. It is labelled "Initial answer" with a note pointing to the debate below.
- **Separate `hasQuickAnswer` / `hasDebate` flags** replace the ambiguous `isQuick` boolean. The render logic is now explicit and correct in all combinations.
- **Quick answer visible during running debate** — the initial answer stays visible while the expert debate is streaming.

---

## [3.7.2] — 2026-03-30

### Fixed
- **Debate starter after follow-ups** — after any follow-up quick answer, a full debate starter (Quick / Saved workflow / Custom setup) now appears so the user can escalate any follow-up into a full debate.
- Debate and follow-up questions can be launched in any order and any number of times within the same session thread.
- `FollowUpEntryCard` now accepts and renders a `DebateStarter` when it is the last entry in the thread.
- `wizardQuery` state tracks which question the wizard is debating (original or a follow-up), and passes it as `queryOverride` to `POST /api/sessions/:id/debate`.

---

## [3.7.1] — 2026-03-30

### Fixed
- **Unified session tab** — submitting an inquiry now navigates immediately to `/session/:id`. The quick answer, debate starter, full debate, results, follow-ups, and rename/pin all live on that single page. No more separate tabs for the initial answer vs the debate.
- `chat.tsx` simplified to input-only: fires a quick-answer session and navigates to it. All inquiry state moved to `session.tsx`.
- `session.tsx` now embeds `DebateStarter` (Quick / Saved / Custom) and the `InquiryWizard` split-panel directly. Launching a debate from the session page creates a new session for the debate and navigates to it.

---

## [3.7.0] — 2026-03-30

### Added
- **Inline follow-up thread** — follow-up questions now append directly to the current session instead of creating a new one. The answer appears below the original results, indented with a thread connector. Multiple follow-ups stack in sequence, building a conversation thread inside the session.
- **Rename inquiry** — click the pencil icon next to the title to rename any session inline. Press Enter to save, Escape to cancel.
- **Pin inquiry** — pin any session to the top of the sidebar. Pinned sessions appear in a "Pinned" group above "Recent" with a filled amber pin icon. Click the pin again to unpin.
- `PATCH /api/sessions/:id/title` — rename endpoint.
- `PATCH /api/sessions/:id/pin` — pin/unpin endpoint.
- `POST /api/sessions/:id/followup` — appends a quick answer to an existing session via WebSocket, no new session created.

### Changed
- Follow-up bar on session page now calls the inline endpoint instead of navigating to `/chat?q=`.
- `sessions` table: new `is_pinned` (integer) and `follow_ups` (JSON text) columns, added via safe `ALTER TABLE` migration.
- Sidebar: pinned sessions render at the top with a pin icon; unpinned recents follow below.
- Session header: pencil rename button (visible on hover) and pin/unpin button always visible.

---

## [3.6.0] — 2026-03-29

### Added
- **Follow-up inquiry** — after any completed inquiry, a "Ask a follow-up" input appears so you can continue the thread without starting from scratch.
  - On the **chat page**: accepting a quick answer collapses it into a compact context card and reveals a follow-up input with auto-focus. The previous question and answer are shown as context above the new input.
  - On the **session page**: after a full debate or quick answer completes, a follow-up bar appears at the bottom of the page. Submitting navigates back to the chat page, auto-fills the new inquiry, and fires it immediately.
- **URL pre-fill** — `?q=` query param on `/chat` pre-populates and auto-fires the inquiry. Used internally by the session follow-up, but also useful for deep-linking.

---

## [3.5.0] — 2026-03-29

### Added
- **Multi-key API management** — multiple OpenRouter API keys can now be stored, labelled, starred as primary, and deleted from Settings. The primary key is used automatically for all requests.
- **Session-only key** — on the onboarding screen (and in Settings), users can activate an API key that lives in memory only. It is never written to disk or sent to the server's database. Cleared when the tab is closed.
- **Onboarding mode picker** — two explicit options when first setting up: _Save to server_ (persisted, shared across devices) or _This session only_ (in-memory, tab-scoped).
- **Key labels** — each saved key gets an optional human-readable label (e.g. "Personal", "Work", "Free tier").
- **Legacy key migration** — if a key was saved via the old `POST /api/settings` endpoint, a one-click "Migrate" button moves it into the new key manager.
- **New API endpoints**: `GET /api/keys`, `POST /api/keys`, `POST /api/keys/:id/primary`, `DELETE /api/keys/:id`, `POST /api/keys/migrate-legacy`.

### Changed
- `X-Api-Key` request header takes highest priority in key resolution — session key is injected automatically on every `apiRequest` call.
- Key resolution order: session header → primary saved key → legacy `openrouter_api_key` setting.
- `queryClient.ts` exports `setSessionKey` / `getSessionKey` helpers; all requests include session key header when active.
- `App.tsx` wraps the app in `SessionKeyProvider`; the onboarding guard passes through when a session key is active.
- Settings page redesigned: old single-key form replaced with full key manager + separate session key card.

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
