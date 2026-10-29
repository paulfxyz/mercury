# Installation Guide

## Requirements

| Requirement | Version |
|---|---|
| Node.js | 20+ |
| npm | 9+ |
| OpenRouter API key | Free at [openrouter.ai/keys](https://openrouter.ai/keys) |

---

## Local development

```bash
# Clone
git clone https://github.com/paulfxyz/mercury.git
cd mercury

# Install dependencies
npm install

# Start dev server (hot reload)
npm run dev
```

Open [http://localhost:5000](http://localhost:5000).  
Enter your OpenRouter API key on the onboarding screen.

---

## Production (self-hosted)

```bash
# Build client + server
npm run build

# Start production server
npm start
```

The server listens on `PORT` (default: `5000`).  
SQLite database stored at `mercury.db` in the working directory, or set `DB_PATH` to a custom path.

```bash
# Custom DB location
DB_PATH=/data/mercury.db npm start
```

---

## Deploy to Fly.io

### 1. Install flyctl

```bash
curl -L https://fly.io/install.sh | sh
flyctl auth login
```

### 2. Create the app

```bash
flyctl apps create mercury-sh   # or any name you want
```

### 3. Create a persistent volume for SQLite

```bash
flyctl volumes create mercury_data \
  --app mercury-sh \
  --size 1 \
  --region cdg        # Change to your preferred region
```

Available regions: `cdg` (Paris), `lhr` (London), `iad` (Virginia), `sjc` (San Jose), `nrt` (Tokyo)

### 4. Deploy

```bash
flyctl deploy
```

That's it. Your app is at `https://your-app-name.fly.dev`.

### 5. Scale to zero (free tier)

`fly.toml` is configured with `auto_stop_machines = "stop"` and `min_machines_running = 0` so the app idles to zero cost when not in use. It wakes up automatically on first request (~2-3 seconds cold start).

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP port to listen on |
| `NODE_ENV` | — | Set to `production` for production mode |
| `DB_PATH` | `mercury.db` | Path to SQLite database file |
| `MERCURY_PASSWORD` | unset | If set, the app and its WebSocket require this password (HTTP Basic, any username) |
| `MERCURY_DEMO` | unset | `1` for a public demo: no server-side keys, per-visitor data, request limits |

---

## Docker

```dockerfile
# Build and run locally with Docker
docker build -t mercury .
docker run -p 5000:8080 -v mercury_data:/app/data mercury
```

Or use `docker-compose`:

```yaml
services:
  mercury:
    build: .
    ports:
      - "5000:8080"
    volumes:
      - mercury_data:/app/data
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/mercury.db

volumes:
  mercury_data:
```

---

## Updating

```bash
git pull origin master
npm install
npm run build
npm start    # or: flyctl deploy
```

---

## Security notes

- Mercury has no user accounts. If the instance is reachable from the internet, set `MERCURY_PASSWORD`, or run it behind your own authentication.
- Keys saved with "Save on server" are stored in the SQLite file in plain text. Prefer "This session only" on shared or public instances, or set `MERCURY_DEMO=1`, which refuses to store keys.
- In Fly.io, set the password as a secret rather than in `fly.toml`: `flyctl secrets set MERCURY_PASSWORD=...`.

---

## Checks

```bash
npm run check    # TypeScript
npm test         # unit tests (phase planning, vote parsing)
npm run build    # client and server bundles
python3 benchmark/verify_models.py   # confirms the hard-coded model IDs exist on OpenRouter
```

---

## Getting an OpenRouter key

1. Go to [openrouter.ai/keys](https://openrouter.ai/keys)
2. Create a free account
3. Generate a new API key
4. Paste it into Mercury's onboarding screen or Settings

OpenRouter bills per token, at the price of the model you choose. Mercury shows no spend limit of its own, so set a credit limit on the key in OpenRouter.
