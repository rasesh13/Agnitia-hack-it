# ==============================================================================
# SURYA Frontend Multi-Stage Dockerfile
# Stage 0: 3D Campus Simulator Build (served at /simulator/)
# Stage 1: TypeScript Build & Vite Bundle Optimization
# Stage 2: High-Performance Alpine Nginx Static & Proxy Server
# ==============================================================================

# Stage 0: Build the 3D campus simulator embedded in the Digital Twin page
# (Vite 8 requires Node 20.19+ or 22.12+)
FROM node:22-alpine AS simulator

WORKDIR /simulator

COPY simulator/package.json simulator/package-lock.json ./
RUN npm ci

COPY simulator/ ./
RUN npm run build -- --outDir /simulator-dist --emptyOutDir

# Stage 1: Build Frontend SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors and install clean dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy frontend source tree, add the simulator build, and build production bundle
COPY frontend/ ./
COPY --from=simulator /simulator-dist ./public/simulator
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:alpine AS runner

# Remove default nginx html files
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled SPA bundle from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom reverse proxy configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
