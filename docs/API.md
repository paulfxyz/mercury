# Mercury API

Mercury can be used as a debate organiser by other programs: send a question, several AI models research it, challenge each other and vote, and you get back one answer with a consensus score and the cost. Every call runs on your own [OpenRouter](https://openrouter.ai) key.

There are two ways in: a REST API (this page) and an MCP server for agent clients ([MCP.md](MCP.md)). Both use the same engine, limits and credentials. A machine-readable description is served at `/api/v1/openapi.json`.

## Authentication

| Instance | What to send |
|---|---|
| Public demo (`MERCURY_DEMO=1`, for example demo.mercury.sh) | `X-OpenRouter-Key: sk-or-v1-...`. No Mercury token. The key is used for that request only and is never stored. Your debates are stored under a hash of the key and can only be read with the same key. |
| Self-hosted | `Authorization: Bearer <MERCURY_API_TOKEN>`. Set `MERCURY_API_TOKEN` on the server to enable the API; without it the API answers 503. You may also send `X-OpenRouter-Key`; otherwise the key saved in Mercury is used. |

If the web app is protected with `MERCURY_PASSWORD`, `/api/v1` and `/mcp` skip that Basic-auth prompt and rely on the bearer token instead.

Use HTTPS in front of a self-hosted instance, and treat the token like a password: whoever holds it can spend your OpenRouter credit. The API sends permissive CORS headers (no cookies are involved), so browser-based tools can call it.

Demo limits: at most 5 models and 10 rounds per debate, and 20 new debates or quick answers per hour per key. A debate makes many model calls, so set a credit limit on your OpenRouter key.

## Endpoints

### Start a debate: `POST /api/v1/debates`

```bash
curl -X POST https://demo.mercury.sh/api/v1/debates \
  -H "X-OpenRouter-Key: sk-or-v1-..." \
  -H "Content-Type: application/json" \
  -d '{"query": "Should a five-person startup use microservices from day one?", "workflow": "budget", "wait": 60}'
```

| Field | Type | Meaning |
|---|---|---|
| `query` | string, required | The question or decision. Include all the context the panel needs. |
| `workflow` | string | A workflow id or name. Built in: `precision` (Claude Opus 5.5, GPT-6.1 Sol, Gemini 4 Argon; 10 rounds; consensus threshold 0.9; roles analyst, sceptic, fact-checker) and `budget` (Claude Haiku 5.5, GPT-6 Luna, DeepSeek V4.1 Flash; 4 rounds; threshold 0.7). On a self-hosted instance your saved workflows work too. |
| `models` | string[] | OpenRouter model IDs. Overrides the workflow's models. With no `workflow` and no `models`, the quick low-cost panel is used (4 rounds). |
| `roles` | string[] | Optional role text per model, in the same order as `models`. |
| `rounds` | integer | 1 to 30 (1 to 10 on the demo). |
| `temperature` | number | 0 to 1.5. |
| `consensus_threshold` | number | 0.3 to 1. After at least two debate rounds, a vote at or above it skips the remaining debate rounds. |
| `wait` | integer | Seconds to wait for the result (0 to 110, default 0). |
| `title` | string | Optional label for the web UI. |

Responses: `200` with the finished debate when it completes within `wait`; `202` with the running debate when it does not (poll it); `400` invalid input; `401` missing credentials; `429` demo rate limit; `503` API disabled.

A debate looks like this:

```json
{
  "id": "83613695-cab1-4e1c-be7f-a95ab40422f8",
  "session_id": "1d7927e5-4120-41b7-b20f-002602d0d4cb",
  "status": "completed",
  "query": "Should a five-person startup use microservices from day one?",
  "models": ["anthropic/claude-haiku-5.5", "openai/gpt-6-luna", "deepseek/deepseek-v4.1-flash-1017"],
  "rounds_planned": 4,
  "rounds_completed": 4,
  "consensus": 0.87,
  "final_answer": "No. A five-person startup should start with a modular monolith ...",
  "cost_usd": 0.0054,
  "created_at": 1793589896317,
  "rounds": [
    { "round": 1, "phase": "research", "consensus": null },
    { "round": 2, "phase": "debate", "consensus": 0.87 },
    { "round": 3, "phase": "synthesis", "consensus": null },
    { "round": 4, "phase": "final", "consensus": null }
  ]
}
```

`status` is `running`, `completed` or `error`. `consensus` is the mean score the models gave themselves on their last voting round, between 0 and 1. It tells you how settled the panel was, not whether it is right (see [BENCHMARK.md](BENCHMARK.md)). `cost_usd` is the total reported by OpenRouter.

### Get a debate: `GET /api/v1/debates/{id}`

Query parameters: `wait` (0 to 110 seconds, long-poll while the debate runs) and `include` (`none`, `rounds` by default, or `responses`, which adds every model's text for every round).

### List debates: `GET /api/v1/debates?limit=20`

Your recent debates, without the round list.

### Quick answer: `POST /api/v1/quick`

`{"query": "..."}` returns `{ "answer", "model", "cost_usd" }` from a single fast, low-cost model. Use it to decide whether a debate is worth the cost.

### Other

- `GET /api/v1/workflows`: the built-in workflows and, on a self-hosted instance, your saved ones.
- `GET /api/v1/panels`: suggested model panels (`quick`, `balanced`, `frontier`, `global`).
- `GET /api/v1/models`: text models currently available on OpenRouter.
- `GET /api/v1`: version, mode and limits (no authentication needed).

Errors are JSON: `{ "error": "A sentence ending with a period." }`.

## Patterns

Poll instead of holding a connection:

```bash
ID=$(curl -s -X POST "$MERCURY/api/v1/debates" -H "X-OpenRouter-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"query": "...", "workflow": "precision"}' | jq -r .id)
curl -s "$MERCURY/api/v1/debates/$ID?wait=100" -H "X-OpenRouter-Key: $KEY" | jq '{status, consensus, final_answer}'
```

Python:

```python
import requests
r = requests.post("https://demo.mercury.sh/api/v1/debates",
                  headers={"X-OpenRouter-Key": KEY},
                  json={"query": "Is this contract clause enforceable?", "workflow": "precision", "wait": 100})
debate = r.json()
if debate["status"] != "completed":
    debate = requests.get(f"https://demo.mercury.sh/api/v1/debates/{debate['id']}?wait=100", headers={"X-OpenRouter-Key": KEY}).json()
print(debate["final_answer"], debate["consensus"], debate["cost_usd"])
```

## Self-hosted debates in the web UI

On a self-hosted instance, debates started through the API appear in the web UI like any other inquiry, so you can read the rounds there. On the public demo they are private to the key that started them and do not appear in anyone's browser session.

## Not included

There is no streaming or webhook callback; use `wait` or poll. Rate limits exist only on the demo and are held in memory.
