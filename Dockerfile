# Multi-stage Dockerfile for Transcend Law

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app

COPY transcend-frontend/package*.json ./transcend-frontend/
RUN cd transcend-frontend && npm ci

COPY transcend-frontend ./transcend-frontend
RUN cd transcend-frontend && npm run build

# Stage 2: Build backend
FROM node:18-alpine AS backend-builder
WORKDIR /app

COPY transcend-api/package*.json ./transcend-api/
RUN cd transcend-api && npm ci --production

# Stage 3: Production runtime
FROM node:18-alpine
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy backend from builder
COPY --from=backend-builder /app/transcend-api ./transcend-api

# Copy frontend build from builder
COPY --from=frontend-builder /app/transcend-frontend/dist ./transcend-frontend/dist

# Copy root package files
COPY package*.json ./

# Create health check script
RUN echo '#!/bin/sh\ncurl -f http://localhost:3000/health || exit 1' > /healthcheck.sh && chmod +x /healthcheck.sh

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD /healthcheck.sh

# Start with dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "transcend-api/server.js"]
