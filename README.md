# ☿ Mercury — Expert Inquiry Engine

> *"One model gives you an answer. Many models give you the truth."*

Mercury is a **self-hosted, open-source AI research platform** that routes your inquiry through an expert panel of AI models. They research, debate, challenge, and vote over multiple rounds until they reach consensus.

Not a chatbot. A thinking process.

**Live demo → [mercury-sh.fly.dev](https://mercury-sh.fly.dev)**  
**Landing page → [mercury.sh](https://mercury.sh)**

---

## What it does

When you submit an inquiry, Mercury:

1. **Detects complexity** — simple factual questions get an instant answer; nuanced questions launch the expert debate engine
2. **Configures your expert team** — a 5-step wizard lets you pick models, team size, debate rounds, temperature, and required consensus threshold
3. **Orchestrates the debate** — models run in parallel across phases: Research → Debate → Vote → Synthesis → Final Answer
4. **Delivers consensus** — a structured final answer backed by collective reasoning, with full debate history preserved

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS v3 + shadcn/ui |
| Backend | Express.js + WebSocket (ws) |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| AI | OpenRouter API (100+ models: GPT-4o, Claude, Llama, Mistral, Gemini…) |
| Hosting | Fly.io (Docker) |

---

## Features

- **Smart routing** — Heuristic + LLM classifier detects simple vs. complex queries
- **5-step wizard** — Configure team size, exact models, debate rounds, temperature, consensus threshold
- **Workflow system** — Save and reuse configurations across inquiries
- **Real-time live panel** — WebSocket feed streams each expert response as it arrives
- **Phase timeline** — Visual tracker: Research → Debate → Vote → Synthesis → Final
- **Self-hosted** — Your API key, your server, your data
- **Light + dark mode** — Persistent, server-stored theme preference
- **Export answers** — Copy or download final consensus as Markdown

---

## Quick start

### Prerequisites

- Node.js 20+
- An [OpenRouter](https://openrouter.ai/keys) API key (free tier available)

### Install & run

```bash
git clone https://github.com/paulfxyz/mercury.git
cd mercury
npm install
npm run dev
```

Open [http://localhost:5000](http://localhost:5000), enter your OpenRouter API key, and start your first inquiry.

### Production build

```bash
npm run build
npm start
```

The server serves both the API and the static frontend on a single port.

---

## Deploy to Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Authenticate
flyctl auth login

# Create app + persistent volume
flyctl apps create your-app-name
flyctl volumes create mercury_data --size 1 --region cdg

# Deploy
flyctl deploy
```

The included `fly.toml` and `Dockerfile` handle everything. SQLite data is persisted to the `/app/data` volume.

---

## Configuration

All settings are stored in the SQLite database and persist across restarts.

| Setting | Where | Description |
|---|---|---|
| OpenRouter API key | Settings page | Required — stored server-side, never exposed to the browser |
| Theme | Settings page | Light or dark — persisted in DB |
| Workflows | Workflows page | Named model configurations with temperature, rounds, consensus threshold |

---

## Project structure

```
mercury/
├── client/
│   └── src/
│       ├── pages/
│       │   ├── chat.tsx        # Main inquiry input + smart routing + wizard
│       │   ├── session.tsx     # Live progress + debate history + results
│       │   ├── workflows.tsx   # Workflow CRUD
│       │   ├── settings.tsx    # API key, theme, danger zone
│       │   └── onboarding.tsx  # First-run API key setup
│       ├── components/
│       │   └── Layout.tsx      # Sidebar, navigation
│       └── App.tsx             # ThemeProvider, onboarding guard, routing
├── server/
│   ├── orchestrator.ts         # Multi-model debate engine + quick answer
│   ├── routes.ts               # API routes + WebSocket
│   ├── storage.ts              # SQLite persistence layer
│   └── index.ts                # Express server setup
├── shared/
│   └── schema.ts               # Drizzle ORM schema (sessions, iterations, workflows, settings)
├── fly.toml                    # Fly.io deployment config
└── Dockerfile                  # Production container
```

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/onboarding` | Check if API key is configured |
| `GET/POST` | `/api/settings` | API key management |
| `GET/POST` | `/api/settings/theme` | Theme persistence |
| `GET` | `/api/models` | Fetch available OpenRouter models |
| `POST` | `/api/detect-complexity` | Classify inquiry as simple or complex |
| `POST` | `/api/quick-answer` | Run single-model quick response |
| `POST` | `/api/inquire` | Launch full multi-model debate |
| `GET` | `/api/sessions` | List all inquiry sessions |
| `GET` | `/api/sessions/:id` | Get session details |
| `GET` | `/api/sessions/:id/iterations` | Get full debate history |
| `GET/POST/PUT/DELETE` | `/api/workflows` | Workflow CRUD |
| `WS` | `/ws?sessionId=:id` | Real-time debate progress |

---

## License

MIT — see [LICENSE](LICENSE)

---

Built by [@paulfxyz](https://github.com/paulfxyz)
