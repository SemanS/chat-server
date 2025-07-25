# Multi-stage build pre optimalizáciu Oracle Voice Chat Backend
FROM node:18-alpine AS builder

# Nastavenie pracovného adresára
WORKDIR /app

# Kopírovanie package files
COPY package*.json ./

# Inštalácia dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Inštalácia potrebných systémových balíkov
RUN apk add --no-cache \
    curl \
    tzdata \
    ca-certificates \
    ffmpeg \
    && rm -rf /var/cache/apk/*

# Vytvorenie non-root používateľa
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Nastavenie pracovného adresára
WORKDIR /app

# Kopírovanie dependencies z builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Kopírovanie aplikačných súborov
COPY --chown=nodejs:nodejs . .

# Vytvorenie potrebných adresárov
RUN mkdir -p logs tmp/tts_cache tmp/audio_uploads && \
    chown -R nodejs:nodejs logs tmp

# Nastavenie timezone na Europe/Bratislava
ENV TZ=Europe/Bratislava
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Prepnutie na non-root používateľa
USER nodejs

# Spustenie aplikácie
CMD ["node", "server.js"]
