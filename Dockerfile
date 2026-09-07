# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the NestJS app
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

# Install ONLY production dependencies
RUN npm ci --only=production

# Generate prisma client for production
RUN npx prisma generate

# Copy built app from builder
COPY --from=builder /usr/src/app/dist ./dist

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs && \
    mkdir -p uploads/receipts uploads/cvs && \
    chown -R nestjs:nodejs uploads
USER nestjs

# Expose port (nginx proxies /api/ to backend:3000)
EXPOSE 3000

# Start the application with automated migration + seed
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/main"]
