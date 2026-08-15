# Production-grade Dockerfile for Transcend Law API
# Node 18 Alpine + security hardening + health checks

FROM node:18-alpine AS builder

WORKDIR /build

# Copy package files
COPY transcend-api/package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY transcend-api/src ./src

# Production stage
FROM node:18-alpine

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=nodejs:nodejs /build/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /build/src ./src
COPY --from=builder --chown=nodejs:nodejs /build/package*.json ./

# Copy only necessary config
COPY --chown=nodejs:nodejs transcend-api/.env.example ./.env.example

USER nodejs

EXPOSE 3001

# Health check (Docker will restart if unhealthy)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["node", "src/index.js"]
