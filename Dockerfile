FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev 2>/dev/null || npm install

# Copy source and pre-built dist
COPY . .

# Build if dist not present
RUN if [ ! -f "dist/index.cjs" ]; then npm run build; fi

# Data directory for SQLite persistence
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=8080

# Point DB to persistent volume
ENV DB_PATH=/app/data/mercury.db

EXPOSE 8080

CMD ["node", "dist/index.cjs"]
