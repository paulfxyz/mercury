# Engineering notes

> Status: this file keeps the architecture write-up, the hardest bugs and the lessons from building Mercury. It was split out of the README in v3.8.0 after an audit (see [AUDIT.md](AUDIT.md)); statements that the audit found to be wrong or unsupported were corrected or removed. For what has been measured, see [BENCHMARK.md](BENCHMARK.md).

## 🏗️ Architecture — how it works

### The orchestration loop

`server/orchestrator.ts` builds a plan of phases with `planPhases(n)` and runs them in order:

```
n = 2   research, final
n = 3   research, debate, final
n >= 4  research, (debate, vote, debate, vote, ...), synthesis, final
```

Each phase sends the original inquiry plus a record of the previous rounds (the latest round in full, up to 1,800 characters per expert, the two before it at 700) to every expert in parallel. The `debate` and `vote` phases ask each model to end with a footer, `VOTE: AGREE|PARTIALLY_AGREE|DISAGREE | SCORE: 1-10`. The server parses it (`parseVote`) and the round's consensus is the mean self-reported score of the models that voted. The final round is written by a single model (the first healthy one) so the result is one coherent answer, and it falls back to the next model if that call fails.

Early exit: after a `vote` round that follows at least two debate rounds, if consensus is at or above the threshold, the remaining debate and vote rounds are dropped from the plan and the run continues with `synthesis` and `final`. The synthesis and final answer always run.

Consensus here is what the models say about their own agreement. It is a useful signal for when to stop, but it is not a measure of correctness (see `docs/BENCHMARK.md`).

### The initial answer path

Every inquiry starts here, before a debate is considered:

```typescript
// POST /api/quick-answer  (model: QUICK_MODEL from shared/defaults.ts)
const { content } = await callModel(apiKey, QUICK_MODEL, [{ role: "user", content: query }], system, 0.3);
storage.updateSession(sessionId, { status: "completed", quickAnswer: content });
```

The session page listens on the WebSocket and also polls the session every 2 seconds, so a missed event never leaves the page stale. There is no complexity classifier on this path.

`callModel` applies a 120-second timeout and retries up to three times with backoff on HTTP 429, 5xx, network errors and empty completions. It asks OpenRouter for usage accounting, so each call returns its exact cost.

### Key resolution (v3.5+)

API keys are resolved in priority order per request:

```typescript
function resolveApiKey(req: Request): string | undefined {
  // 1. X-Api-Key header — session-only key, never stored
  const header = req.headers["x-api-key"];
  if (header) return header.trim();

  // 2. Primary saved key from the api_keys table
  const primary = storage.getPrimaryApiKey();
  if (primary) return primary.value;

  // 3. Legacy openrouter_api_key setting (backwards compat)
  return storage.getSetting("openrouter_api_key")?.value;
}
```

The session key is set in React state and injected by `queryClient.ts` as an `X-Api-Key` header on every request. It is not written to the database or to localStorage. In demo mode (`MERCURY_DEMO=1`) steps 2 and 3 are disabled, so only the header is accepted.

Keys saved with "Save on server" are stored as plain text in the SQLite file. That is a deliberate trade-off for a self-hosted single-user tool, so protect the volume and set `MERCURY_PASSWORD` if the instance is reachable from the internet.

### Internationalisation (v3.7.9+)

Mercury's React app is fully internationalised. Every visible string — onboarding, settings, chat, session, live progress, wizard, sidebar, error messages, toasts, and the 404 page — is served from a single translation file.

**Architecture:**

```
client/src/lib/i18n.ts
├── TRANSLATIONS        — 194 keys × 15 languages = 2,910 strings
├── I18nProvider        — React context provider, wraps <App />
├── useI18n()           — hook: returns { t, lang, setLang }
├── getStoredLang()     — reads localStorage, falls back to navigator.language
└── setStoredLang()     — persists selection to localStorage
```

**Usage in components:**

```tsx
import { useI18n } from "@/lib/i18n";

function MyComponent() {
  const { t } = useI18n();
  return <button>{t("btn_save_start")}</button>;
}
```

**Languages:** English, French, Spanish, German, Italian, Portuguese, Arabic (RTL), Hebrew (RTL), Chinese, Japanese, Danish, Dutch, Hindi, Russian, Korean.

RTL languages (`ar`, `he`) automatically set `document.dir = "rtl"` via the landing page's `applyLang()` function. The React app itself is LTR-only for now — the i18n system is ready for RTL CSS overrides when needed.

**Adding a new language:** Add an entry to `TRANSLATIONS` in `i18n.ts` (copy the `en` block and translate all 194 values), then add the language to the `LangCode` union type and to the landing page's `LANGUAGES` array and `TRANSLATIONS` object.

### Follow-up + debate thread model (v3.7+)

Each session is a parent record. When you run a debate, a child session is created with `parentId` set and is excluded from the sidebar (`listSessions` filters on `parentId IS NULL`). If a child URL is opened directly, the session page immediately redirects to the parent.

Follow-ups are stored as a `followUps` JSON column on the parent session — an append-only array of `{ query, answer, createdAt }` objects. Each follow-up fires `POST /api/sessions/:id/followup`, which calls `gpt-4o-mini` for a quick answer and appends the result to the array.

Debates are stored as a `debates` JSON column — an array of `{ sessionId, query, createdAt }` entries pointing at child sessions.

On the frontend, the session page builds a **merged timeline** from both arrays, sorted by `createdAt`:

```typescript
// Initial debates (before first follow-up)
const initialDebates = debates.filter(d => d.createdAt < firstFollowUpTs);

// Each follow-up, followed by any debate it spawned
const timeline = [
  ...initialDebates.map(d => ({ kind: "debate", entry: d })),
  ...followUps.map((fu, i) => ({
    kind: "followup",
    entry: fu,
    relatedDebates: debates.filter(
      d => d.createdAt > fu.createdAt &&
           d.createdAt < (followUps[i+1]?.createdAt ?? Infinity)
    ),
  })),
];
```

This guarantees correct reading order regardless of how many debates and follow-ups are interleaved, and survives concurrent updates from polling without re-ordering visible content.

### Real-time WebSocket

```typescript
// Relative URL — works correctly under any proxy subpath
const base = new URL("./ws", location.href);
base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${base.href}?sessionId=${id}`;
```

### SQLite schema

```
api_keys    — id, label, value, is_primary, created_at
sessions    — one row per inquiry: status, query, final answer, workflow reference
iterations  — one row per debate round: all model responses as JSON
workflows   — saved team configs: steps, iterations, temperature, consensus threshold
settings    — key-value: legacy API key, theme
```

`better-sqlite3` is fully synchronous — no async/await on database calls. Drizzle provides type-safe queries. The database is a single file at `mercury.db` locally or `/app/data/mercury.db` on Fly.io (persistent volume).

---

## ⚡ Bottlenecks & design constraints

Building a multi-model debate engine surfaces constraints you don't hit in standard CRUD apps. These are the real ones.

### 1. The cold start latency problem

A full debate (3 models, 10 rounds, about 30 API calls) takes minutes: in the benchmark a 4-round debate with three small models had a median latency of about 30 seconds and a worst case of several minutes on reasoning-heavy questions. Rounds are sequential by design (each builds on the previous), and each round waits for its slowest model.

The solution was architectural: **decouple the two latency tiers**. The initial quick-model call usually takes a few seconds. The debate is optional and clearly labelled. Users almost never abandon because they had *something* immediately. Without the quick answer, the blank-screen wait kills engagement entirely.

**There is no way to make a 10-round debate fast. The correct answer is to make it optional.**

### 2. Polling plus WebSocket for live progress

Debate progress is pushed over a WebSocket (`/ws?sessionId=...`). An early prototype used polling only and had two problems: several open tabs duplicated state updates, and the interval was always either wasteful or laggy. The WebSocket gives immediate updates, with the cost of connection management: Fly.io's proxy closes idle connections after about 60 seconds, so the client reconnects on `close`.

The session page still polls the session every 2 seconds (3 seconds for child debates). This covers the case where the socket was not connected when something finished, for example after a page refresh mid-debate or a machine restart. There is no server-sent-events fallback.

### 3. Concurrent debate prevention

Early versions had no guard against launching multiple simultaneous debates. Users found this by accident — double-clicking the debate button fired two parallel child sessions, each writing to the same parent's `debates[]` array. The result was a race condition: whichever finished last won, and the other's data was overwritten.

The fix required two layers:

**Server-side** (`routes.ts`):
```typescript
// Reject if any child session is still running
const children = storage.getChildSessions(sessionId);
if (children.some(c => c.status === "running")) {
  return res.status(409).json({ error: "A debate is already running." });
}
```

**Client-side** (`session.tsx`):
```typescript
// Poll the last child's status every 2s while it may be running
const isAnyDebateRunning = debateMutation.isPending ||
  (!!lastDebateId && (!lastDebateSession || lastDebateSession.status === "running"));

// Gate everything behind this flag
{isAnyDebateRunning ? <LockedIndicator /> : <DebateStarter />}
```

The server check is the authoritative guard. The client check is UX — it hides the button so users never see a rejection.

### 4. Append-only state vs React re-render order

The thread model (follow-ups + debates stored as JSON columns) means new entries are appended server-side and the client receives them via polling. The naive render approach — `debates.map(...)` then `followUps.map(...)` — produces wrong order the moment a follow-up spawns its own debate: the debate block renders above the follow-up that triggered it.

The fix is the merged timeline (see architecture section). The key invariant: **render order must be derived from `createdAt` timestamps, never from array index order**.

This matters most during live updates. When React re-renders due to a poll result, the timeline is recomputed from scratch. Because timestamps are immutable and monotonically increasing, the timeline is stable across re-renders — no items jump position.

### 5. SQLite write concurrency on single-instance Fly

`better-sqlite3` is synchronous and SQLite uses file-level locking. In theory, two simultaneous requests that both write to the database should serialize automatically. In practice, the bottleneck is the orchestrator: debate rounds fire sequential writes over 60–180 seconds.

For the current use case (self-hosted, small concurrent user base) this is fine. The full debate write pattern is: `INSERT iteration` per round + `UPDATE session` on completion. These are fast writes, not table scans. The p99 latency of a write during a debate is <5ms even under concurrent read pressure.

If Mercury were multi-tenant at scale, the right move would be a write queue (single writer goroutine / worker) or PostgreSQL with `FOR UPDATE SKIP LOCKED`. For self-hosted single-user: SQLite is the correct choice, and the file-level lock is a feature, not a bug.

### 6. The DebateStarter UX hierarchy problem

The first instinct was to always show a `DebateStarter` after every block — after the quick answer, after each debate, after each follow-up. This produced chaotic UX: users launched chain debates on debate answers, creating orphaned child sessions with no follow-up context.

The final rule, arrived at after several iterations:

- `DebateStarter` appears **only** after the initial quick answer (if no debate has been launched yet)
- After a debate completes, the `DebateStarter` disappears — only a `FollowUpBar` remains
- After a follow-up answer, a new `DebateStarter` appears — scoped to the follow-up's query
- While any debate is running: both `DebateStarter` and `FollowUpBar` are hidden

This hierarchy enforces the intended mental model: **debate deepens an answer, follow-up advances the conversation**. You can only debate something you've actually read and decided to challenge.

---

## 🪨 The hardest bugs

### 1. Alpine Linux kills `better-sqlite3`

The first Fly.io deploy failed immediately:

```
Error relocating better_sqlite3.node: fcntl64: symbol not found
```

`better-sqlite3` compiles a native C++ addon. The build environment runs Ubuntu (glibc). Fly.io's container runs Alpine Linux (musl libc). `fcntl64` is a glibc symbol — musl doesn't export it. The pre-built binary was simply incompatible with the runtime.

The fix: compile the native addon *inside* the Alpine container, and do it *twice*:

```dockerfile
RUN apk add --no-cache python3 make g++  # build tools
RUN npm install
RUN npm run build
RUN npm rebuild better-sqlite3            # compile for musl
RUN npm prune --omit=dev                  # removes compiled binaries (!)
RUN npm rebuild better-sqlite3            # compile again — prune wiped them
```

The double rebuild is not a typo. `npm prune` removes native `.node` binaries even from production dependencies because they live in a cache directory that prune treats as purgeable. Without the second rebuild, the app deploys, starts, can't find the binary, and crashes silently.

### 2. An em dash breaks every API call

Every single OpenRouter call was failing with a cryptic error:

```
Cannot convert argument to a ByteString because the character at index 8
has a value of 8212 which is greater than 255.
```

Character 8212 is `—` (U+2014, em dash). It was in the `X-Title` HTTP header:

```typescript
"X-Title": "Mercury — Deep Research Engine",  // ← kills every request
```

HTTP headers are Latin-1 (bytes 0–255). The em dash is codepoint 8212. Node's `fetch` enforces this at the byte level. The error tells you exactly what happened — but only if you know that 8212 = em dash.

```typescript
"X-Title": "Mercury - Deep Research Engine",  // ✓ hyphen, not em dash
```

One character. Invisible in source. Lethal at runtime. The lesson: never put typographic punctuation in HTTP headers.

### 3. React Query `staleTime: Infinity` traps the onboarding guard

After saving the API key, the mutation invalidates `/api/onboarding`. But if navigation happens before the invalidation promise resolves, the component remounts with stale `{ hasApiKey: false }` in cache — and the guard redirects back to onboarding, clearing the just-saved state.

Fix: override `staleTime` specifically on the onboarding query:

```typescript
useQuery({
  queryKey: ["/api/onboarding"],
  staleTime: 0,           // always refetch on mount
  refetchOnMount: true,   // even if recently fetched
})
```

The global default of `staleTime: Infinity` is correct for most data. The onboarding check is the one exception — it must always reflect the server's current state.

### 4. WebSocket URL breaks under proxy subpaths

```typescript
// Wrong — constructs from origin root, breaks behind any subpath proxy
const wsUrl = `${protocol}//${window.location.host}/ws?sessionId=${id}`;

// Correct — resolves relative to current page URL
const base = new URL("./ws", location.href);
base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${base.href}?sessionId=${id}`;
```

`new URL("./ws", location.href)` handles any subpath automatically — `/`, `/app/`, `/port/5000/` — without needing to know the deployment environment.

### 5. Radix Dialog captures pointer events, model selection impossible

The model search dropdown inside the inquiry wizard needed to float above the dialog. We used `createPortal()` to render it at `position: fixed` on `document.body`, and tried `onPointerDown` with `stopPropagation`.

It didn't work. Radix Dialog's overlay fires `onPointerDownOutside` at the document level — before any child handler runs. Every model selection closed the dialog.

The fix: stop fighting the abstraction. Remove `<Dialog>` entirely.

```typescript
// Before — Radix Dialog, model selection broken
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent><StepBuilder /></DialogContent>
</Dialog>

// After — sibling split-panel, no overlay, works perfectly
<div className="flex h-full overflow-hidden">
  <div className="flex-1">{/* chat */}</div>
  <div className={cn("border-l transition-all", open ? "w-[480px]" : "w-0")}>
    {/* wizard slides in from right */}
  </div>
</div>
```

No overlay, no z-index conflicts, no pointer capture. `onMouseDown` on dropdown items works because there is nothing above them.

### 6. Session key can't use localStorage — sandbox blocks it

The session-only API key (never persisted) needs to survive React re-renders and be available to all HTTP requests. The obvious answer — `localStorage` — is blocked in the sandboxed preview iframe used during development.

Solution: keep the key in React state via a context provider (`SessionKeyProvider` in `App.tsx`) and export a module-level setter so `queryClient.ts` can inject it as a request header without needing to be inside a React tree.

```typescript
// queryClient.ts — module-level, accessible anywhere
let _sessionKey: string | null = null;
export function setSessionKey(k: string | null) { _sessionKey = k; }

// Injected automatically on every request
function sessionHeaders() {
  return _sessionKey ? { "X-Api-Key": _sessionKey } : {};
}
```

The context provider calls `setSessionKey` on every state change, keeping the module-level value in sync. No localStorage, no cookies, no sandboxing issues.

### 7. Mobile: sidebar consumes 100% viewport width

On screens < 768px, the `w-56` sidebar had no breakpoint. It rendered at full-height, full-width, leaving `~0px` for the main content. Settings was entirely blank — the content area had zero width.

The fix was architectural: replace the always-visible sidebar with a conditional layout — `hidden md:flex` on desktop, a fixed `translate-x` drawer on mobile with a backdrop overlay and a hamburger button in a top bar.

```tsx
// Desktop — always visible at ≥768px
<aside className="hidden md:flex flex-col w-56 ...">

// Mobile — slide-in drawer with z-50, backdrop at z-40
<aside className={cn(
  "fixed inset-y-0 left-0 z-50 flex flex-col w-72 md:hidden transition-transform",
  open ? "translate-x-0" : "-translate-x-full"
)}>
```

Also: `h-screen` replaced with `h-[100dvh]` to handle iOS Safari's dynamic viewport chrome (address bar appears/disappears on scroll, making `100vh` larger than the visible area).

---

## 🎓 Lessons learned

### Always give the user something immediately

An early version classified each query first (an extra API call) and showed different UI paths depending on the result. The current flow gives every inquiry a real answer within seconds, with no classification and no branching, and the debate becomes an optional deepening rather than a separate mode. This was a UX judgement, not a measured result.

### The debate starter reduces friction at the right moment

After the quick answer, the question is not "which models?" but "do I need a debate at all?" The three-option picker (Quick, Saved, Custom) answers that at a glance, and the full wizard only opens on request.

### Hypotheses that the benchmark did not confirm

Earlier versions of this document stated three claims as facts. They are design hypotheses, and `docs/BENCHMARK.md` does not support them:

- That panels of models from different vendors produce better answers than panels from one vendor. The benchmark did not compare these.
- That temperature 0.3 is a sweet spot. It is the default, chosen by hand, and was not tuned.
- That custom roles improve debates. Before v3.8.0 the role text was collected in the wizard but never sent to the server, so any earlier impression of this was not caused by the roles. Roles are now sent and used, and still untested.

What the benchmark did show: on 30 objectively gradable questions, three small models in a 4-round debate scored about the same as the best single models, at a higher latency and a higher cost than the cheapest single model.

### Follow-ups are more natural than new sessions

The original flow was: get answer → close → new inquiry → retype context. This is how most AI tools work, and it's wrong. Inquiry is iterative — you ask, learn something, refine, push back, explore a branch. The follow-up bar (visible after every completed inquiry) makes the natural loop zero-friction: the previous question and answer are visible as context, the new input is right there.

### The onboarding key choice matters

Offering "save to server" or "this session only" at first run is a trust decision for anyone evaluating an unfamiliar tool with their API key. The session-only option lets someone try the tool without storing anything on the server.

### SQLite is correct for self-hosted single-user tools

The choice of SQLite over PostgreSQL was deliberate. For one machine, one or a few concurrent users: a database server is pure overhead. SQLite is a file. It deploys with the app. It backs up with `cp`. It never needs a connection string, a username, or a port. `better-sqlite3` is synchronous — no async plumbing, no connection pool management. For this use case, it is strictly better than a client-server database in every dimension that matters.

### Split-panel beats modal for complex interactive UI

Every time you put a multi-step form with dropdowns inside a Radix modal, you fight the modal's pointer event capture. The split-panel pattern — content left, panel slides in from right — eliminates the entire class of z-index, pointer capture, and focus management bugs. It's also better UX: the user can see both the original context and the new panel simultaneously.

---
