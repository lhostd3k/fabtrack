# ─── FabTrack Production Dockerfile ──────────────────────────────────
# Single container: builds React frontend, runs Express server

# Stage 1: Build frontend
FROM node:20-alpine AS builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --production

# Copy server code
COPY server/ ./server/

# Copy built frontend
COPY --from=builder /app/client/dist ./client/dist

# Create uploads directory
RUN mkdir -p server/uploads/thumbs

# Set production env
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

WORKDIR /app/server
CMD ["node", "index.js"]
