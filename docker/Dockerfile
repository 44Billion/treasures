# Simple production stage - serve pre-built files
FROM node:22-alpine

# Install simple http server and wget for healthcheck
RUN npm install -g serve && apk add --no-cache wget

# Install security updates
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

# Copy pre-built files (built locally)
COPY dist/ /app/

# Set working directory
WORKDIR /app

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

# Expose port 80
EXPOSE 80

# Start serve with SPA support
CMD ["serve", "-s", ".", "-l", "80"]