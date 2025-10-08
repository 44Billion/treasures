#!/bin/bash

# Simple, fast deployment for treasures.to
# Builds locally and syncs directly to Caddy file server
# Usage: ./deploy.sh DROPLET_IP [--debug]

set -e  # Exit on any error

DROPLET_IP=$1
DEBUG=false

# Parse arguments
while [[ $# -gt 1 ]]; do
    case $2 in
        --debug)
            DEBUG=true
            shift
            ;;
        *)
            echo "Unknown option: $2"
            exit 1
            ;;
    esac
done

if [ -z "$DROPLET_IP" ]; then
    echo "Usage: $0 <droplet-ip> [--debug]"
    echo ""
    echo "Examples:"
    echo "  $0 192.168.1.100         # Deploy to server"
    echo "  $0 192.168.1.100 --debug # Verbose debugging"
    echo ""
    exit 1
fi

log() {
    echo "$(date '+%H:%M:%S') $1"
}

debug() {
    if [ "$DEBUG" = true ]; then
        echo "DEBUG: $1"
    fi
}

error_exit() {
    echo "❌ ERROR: $1" >&2
    exit 1
}

# Test HTTP response
test_http() {
    local url=$1
    local response=$(curl -s -o /dev/null -w "%{http_code}" $url --connect-timeout 5 --max-time 10 2>/dev/null || echo "000")
    echo $response
}

log "⚡ Fast deployment to $DROPLET_IP"

# Step 1: Build locally
log "🔨 Building locally..."
npm run build || error_exit "Local build failed"

# Step 2: Create backup of current files
log "💾 Creating backup..."
ssh root@$DROPLET_IP << 'EOF' || error_exit "Backup failed"
    mkdir -p /opt/treasures/backup
    if [ -d "/opt/treasures/current" ]; then
        cp -r /opt/treasures/current /opt/treasures/backup/$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
        # Keep only last 5 backups
        ls -dt /opt/treasures/backup/* | tail -n +6 | xargs rm -rf 2>/dev/null || true
    fi
    mkdir -p /opt/treasures/new
EOF

# Step 3: Sync files to server
log "📁 Syncing files..."
rsync -az --delete dist/ root@$DROPLET_IP:/opt/treasures/new/ || error_exit "File sync failed"

# Step 4: Ensure Caddy is set up for file serving
log "⚙️  Configuring Caddy..."
ssh root@$DROPLET_IP << 'EOF' || error_exit "Caddy setup failed"
    cd /opt/treasures
    
    # Create Caddyfile for direct file serving
    cat > Caddyfile << 'CADDY_CONFIG'
treasures.to {
    root * /opt/treasures/current
    file_server
    try_files {path} /index.html
    
    header {
        X-Frame-Options SAMEORIGIN
        X-XSS-Protection "1; mode=block"
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        Content-Security-Policy "default-src 'self' wss: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:;"
    }
    
    @static path *.js *.css *.png *.jpg *.jpeg *.gif *.ico *.svg *.woff *.woff2 *.ttf *.eot *.json *.webmanifest
    header @static Cache-Control "public, max-age=31536000, immutable"
    
    @health path /health
    respond @health "healthy" 200
    header @health Content-Type text/plain
    
    encode gzip
}
CADDY_CONFIG

    # Ensure Caddy is running with the right setup
    if ! docker ps | grep -q caddy; then
        echo "Starting Caddy..."
        docker run -d \
            --name caddy \
            --restart unless-stopped \
            -p 80:80 \
            -p 443:443 \
            -v /opt/treasures/Caddyfile:/etc/caddy/Caddyfile \
            -v /opt/treasures:/opt/treasures \
            -v caddy_data:/data \
            -v caddy_config:/config \
            caddy:latest
    fi
EOF

# Step 5: Atomic switch
log "🔄 Switching to new files..."
ssh root@$DROPLET_IP << 'EOF' || error_exit "File switch failed"
    cd /opt/treasures
    
    # Ensure new directory has content
    if [ ! -f "new/index.html" ]; then
        echo "ERROR: No index.html found in new deployment!"
        ls -la new/ || echo "New directory is empty"
        exit 1
    fi
    
    # Atomic switch with validation
    if [ -d "current" ]; then
        mv current old || true
    fi
    mv new current
    
    # Verify current directory has content
    if [ ! -f "current/index.html" ]; then
        echo "ERROR: Switch failed - no index.html in current directory"
        # Try to restore from old
        if [ -d "old" ] && [ -f "old/index.html" ]; then
            echo "Restoring from backup..."
            mv current failed_deploy || true
            mv old current
        fi
        exit 1
    fi
    
    echo "Files switched successfully, current directory contains:"
    ls -la current/ | head -5
    
    # Update Caddy configuration safely
    # Method 1: Try graceful reload first (Caddy can auto-detect file changes via volume mount)
    if docker exec caddy caddy reload 2>/dev/null; then
        echo "Caddy configuration reloaded successfully"
    else
        echo "Graceful reload failed, trying container restart..."
        # Method 2: Restart the container if reload fails
        docker restart caddy
        sleep 5
        
        # Verify Caddy is running
        if ! docker ps | grep -q "caddy.*Up"; then
            echo "Caddy restart failed, recreating container..."
            docker rm -f caddy 2>/dev/null || true
            docker run -d \
                --name caddy \
                --restart unless-stopped \
                -p 80:80 \
                -p 443:443 \
                -v /opt/treasures/Caddyfile:/etc/caddy/Caddyfile \
                -v /opt/treasures:/opt/treasures \
                -v caddy_data:/data \
                -v caddy_config:/config \
                caddy:latest
            sleep 3
        fi
    fi
    
    # Final verification that Caddy is running
    if docker ps | grep -q "caddy.*Up"; then
        echo "✅ Caddy is running"
        docker logs caddy --tail 5 2>/dev/null || true
    else
        echo "❌ Caddy failed to start"
        docker logs caddy --tail 10 2>/dev/null || true
        exit 1
    fi
    
    # Clean up old files
    rm -rf old failed_deploy 2>/dev/null || true
EOF

# Step 6: Verification
log "🔍 Verifying deployment..."
sleep 3

SITE_RESPONSE=$(test_http "https://treasures.to/")
OG_RESPONSE=$(test_http "https://treasures.to/og-image.png")

if [ "$SITE_RESPONSE" = "200" ] && [ "$OG_RESPONSE" = "200" ]; then
    log "✅ Deployment successful!"
    echo ""
    echo "🌐 Site: https://treasures.to/"
    echo "🖼️ OG Image: https://treasures.to/og-image.png"
    echo "💚 Health: https://treasures.to/health"
    echo ""
    echo "🎉 Total deployment time: ~15 seconds"
else
    log "⚠️ Deployment may have issues:"
    log "   Site response: HTTP $SITE_RESPONSE (expected 200)"
    log "   OG image: HTTP $OG_RESPONSE (expected 200)"
    echo ""
    echo "🔍 Debug: ssh root@$DROPLET_IP 'docker logs caddy --tail 20'"
fi

debug "Deploy completed at $(date)"
log "📊 Monitor: ssh root@$DROPLET_IP 'docker logs caddy -f'"