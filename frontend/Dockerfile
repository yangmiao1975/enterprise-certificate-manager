# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Accept build arguments for environment variables
ARG VITE_API_URL
ARG VITE_ENVIRONMENT=gcp-cloud-run
ARG BUILD_MODE=docker

# Set environment variables for Vite build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ENVIRONMENT=$VITE_ENVIRONMENT

# Build for production
RUN npm run build:${BUILD_MODE}

# Production stage with nginx
FROM nginx:alpine AS production
WORKDIR /usr/share/nginx/html

# Install wget for health checks
RUN apk add --no-cache wget

# Copy built files
COPY --from=builder /app/dist .

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create nginx user and set permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Test nginx configuration
RUN nginx -t

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 