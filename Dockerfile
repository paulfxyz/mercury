FROM node:20-alpine

# Build dependencies for native modules (better-sqlite3 needs python + make + gcc)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install ALL dependencies (including dev — needed for build)
RUN npm install

# Copy source
COPY . .

# Build client + server bundle
RUN npm run build

# Rebuild native modules for this platform (fixes better-sqlite3 on Alpine/musl)
RUN npm rebuild better-sqlite3

# Remove dev deps after build to slim the image
RUN npm prune --omit=dev

# Re-rebuild native modules after prune (prune can remove compiled binaries)
RUN npm rebuild better-sqlite3

# Persistent data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/app/data/mercury.db

EXPOSE 8080

CMD ["node", "dist/index.cjs"]
