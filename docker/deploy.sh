#!/bin/bash

# Single deployment script for treasures.to
# Handles zero-downtime deployment with automatic fallbacks
# Usage: ./deploy.sh DROPLET_IP [--force-fresh] [--debug]

set -e  # Exit on any error

DROPLET_IP=$1
FORCE_FRESH=false
DEBUG=false

# Parse arguments
while [[ $# -gt 1 ]]; do
    case $2 in
        --force-fresh)
            FORCE_FRESH=true
            shift
            ;;
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
    echo "Usage: $0 <droplet-ip> [--force-fresh] [--debug]"
    echo ""
    echo "Examples:"
    echo "  $0 192.168.1.100                 # Zero-downtime deployment"
    echo "  $0 192.168.1.100 --force-fresh   # Force complete rebuild"
    echo "  $0 192.168.1.100 --debug         # Verbose debugging output"
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

# Test if site is currently running
test_site_running() {
    local response=$(ssh root@$DROPLET_IP "cd /opt/treasures 2>/dev/null && docker compose ps --format json 2>/dev/null" | grep -q '"State":"running"' && echo "true" || echo "false")
    echo $response
}

# Test HTTP response
test_http() {
    local url=$1
    local response=$(curl -s -o /dev/null -w "%{http_code}" $url --connect-timeout 5 --max-time 10 2>/dev/null || echo "000")
    echo $response
}

log "🚀 Deploying treasures.to to $DROPLET_IP"

if [ "$FORCE_FRESH" = true ]; then
    log "⚠️  Force fresh deployment mode"
fi

# Step 1: Build locally
log "🔨 Building locally..."
cd ..
npm run build || error_exit "Local build failed"
cd docker

# Step 2: Sync files
log "📁 Syncing files to server..."
rsync -az --delete --exclude 'node_modules' --exclude '.git' ../ root@$DROPLET_IP:/opt/treasures/ || error_exit "File sync failed"

# Step 3: Check current state and decide deployment strategy
SITE_RUNNING=$(test_site_running)
debug "Site currently running: $SITE_RUNNING"

if [ "$SITE_RUNNING" = "false" ] || [ "$FORCE_FRESH" = true ]; then
    log "🆕 Performing fresh deployment..."
    
    ssh root@$DROPLET_IP << 'EOF' || error_exit "Fresh deployment failed"
        cd /opt/treasures
        
        # Ensure proper file structure
        cp docker/docker-compose.yml . 2>/dev/null || true
        cp docker/Caddyfile . 2>/dev/null || true
        
        # Fix docker-compose.yml paths
        if grep -q "context: .." docker-compose.yml 2>/dev/null; then
            sed -i 's|context: ..|context: .|' docker-compose.yml
        fi
        
        # Clean slate
        docker compose down -v 2>/dev/null || true
        docker image prune -a -f 2>/dev/null || true
        
        # Deploy
        docker compose up -d --build
        
        # Wait for services to be ready
        sleep 10
        
        # Check containers are running
        docker compose ps | grep -q "Up" || exit 1
EOF

else
    log "🔄 Performing zero-downtime deployment..."
    
    ssh root@$DROPLET_IP << 'EOF' || error_exit "Zero-downtime deployment failed"
        cd /opt/treasures
        
        # Ensure proper file structure
        cp docker/docker-compose.yml . 2>/dev/null || true
        cp docker/Caddyfile . 2>/dev/null || true
        
        # Fix docker-compose.yml paths  
        if grep -q "context: .." docker-compose.yml 2>/dev/null; then
            sed -i 's|context: ..|context: .|' docker-compose.yml
        fi
        
        # Build new image with unique tag (no interference with running containers)
        NEW_TAG="treasures-$(date +%s)"
        echo "🏗️  Building new image with tag: $NEW_TAG"
        
        # Build with a completely separate context to avoid any interference
        docker build -t $NEW_TAG -f docker/Dockerfile . --no-cache || exit 1
        
        echo "✅ New image built successfully: $NEW_TAG"
        
        # Start new container with different name and network isolation
        echo "🚀 Starting new container (isolated)..."
        
        # Create temporary network for testing
        docker network create treasures-temp-network 2>/dev/null || true
        
        # Start new container on temporary network first
        docker run -d \
            --name treasures-app-staging \
            --network treasures-temp-network \
            -p 8081:80 \
            -e NODE_ENV=production \
            --health-cmd="wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1" \
            --health-interval=10s \
            --health-timeout=5s \
            --health-retries=6 \
            --health-start-period=30s \
            $NEW_TAG || exit 1
        
        echo "⏳ Waiting for staging container to be healthy..."
        for i in {1..36}; do
            HEALTH=$(docker inspect treasures-app-staging --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
            if [ "$HEALTH" = "healthy" ]; then
                echo "✅ Staging container is healthy!"
                break
            fi
            if [ $i -eq 36 ]; then
                echo "❌ Staging container failed to become healthy after 3 minutes"
                echo "Container logs:"
                docker logs treasures-app-staging --tail 20
                docker stop treasures-app-staging 2>/dev/null || true
                docker rm treasures-app-staging 2>/dev/null || true
                docker network rm treasures-temp-network 2>/dev/null || true
                exit 1
            fi
            echo "   Health check $i/36: $HEALTH (waiting 5s)"
            sleep 5
        done
        
        # Test staging container directly
        echo "🧪 Testing staging container on isolated port..."
        for i in {1..12}; do
            TEST_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/ --max-time 5 2>/dev/null || echo "000")
            if [ "$TEST_RESPONSE" = "200" ]; then
                echo "✅ Staging container responds correctly (HTTP 200)"
                break
            fi
            if [ $i -eq 12 ]; then
                echo "❌ Staging container test failed after 1 minute (HTTP: $TEST_RESPONSE)"
                echo "Container logs:"
                docker logs treasures-app-staging --tail 20
                docker stop treasures-app-staging 2>/dev/null || true
                docker rm treasures-app-staging 2>/dev/null || true
                docker network rm treasures-temp-network 2>/dev/null || true
                exit 1
            fi
            echo "   Test attempt $i/12: HTTP $TEST_RESPONSE (waiting 5s)"
            sleep 5
        done
        
        # Now connect staging container to production network (hot-swap preparation)
        echo "🔄 Preparing hot-swap: connecting to production network..."
        docker network connect treasures_treasures-network treasures-app-staging || exit 1
        
        # Disconnect from temp network and remove it
        docker network disconnect treasures-temp-network treasures-app-staging 2>/dev/null || true
        docker network rm treasures-temp-network 2>/dev/null || true
        
        # Note: Container still has port 8081 exposed but it's not used in production
        
        # Quick test on production network  
        sleep 2
        STAGING_IP=$(docker inspect treasures-app-staging --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' | grep -v "^$" | head -1)
        echo "🌐 Testing staging container on production network (IP: $STAGING_IP)..."
        
        NETWORK_TEST=$(docker run --rm --network treasures_treasures-network curlimages/curl:latest curl -s -o /dev/null -w "%{http_code}" http://$STAGING_IP:80/ --max-time 10 2>/dev/null || echo "000")
        
        if [ "$NETWORK_TEST" != "200" ]; then
            echo "❌ Staging container network test failed (HTTP: $NETWORK_TEST)"
            echo "Rolling back..."
            docker stop treasures-app-staging 2>/dev/null || true
            docker rm treasures-app-staging 2>/dev/null || true
            exit 1
        fi
        
        echo "✅ Staging container ready for traffic switch!"
        
        # ATOMIC TRAFFIC SWITCH - this is the only moment of potential disruption
        echo "🔀 Performing atomic traffic switch..."
        
        # Create new Caddyfile pointing to staging container
        sed 's/treasures-app:80/treasures-app-staging:80/' Caddyfile > Caddyfile.staging
        
        # Atomic switch: update Caddy configuration (this should be instant)
        docker cp Caddyfile.staging caddy:/etc/caddy/Caddyfile.new
        docker exec caddy sh -c "mv /etc/caddy/Caddyfile.new /etc/caddy/Caddyfile && caddy reload" || {
            echo "❌ Failed to switch traffic! Rolling back..."
            docker cp Caddyfile caddy:/etc/caddy/Caddyfile
            docker exec caddy caddy reload
            docker stop treasures-app-staging 2>/dev/null || true
            docker rm treasures-app-staging 2>/dev/null || true
            rm -f Caddyfile.staging
            exit 1
        }
        
        echo "🎯 Traffic switched! Testing new setup..."
        
        # Wait a moment for Caddy to fully reload
        sleep 3
        
        # Test through Caddy (this verifies the whole chain works)
        FINAL_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/ --max-time 15 2>/dev/null || echo "000")
        
        if [ "$FINAL_TEST" != "200" ]; then
            echo "❌ Final test failed (HTTP: $FINAL_TEST)! Rolling back immediately..."
            # Immediate rollback
            docker cp Caddyfile caddy:/etc/caddy/Caddyfile
            docker exec caddy caddy reload
            docker stop treasures-app-staging 2>/dev/null || true
            docker rm treasures-app-staging 2>/dev/null || true
            rm -f Caddyfile.staging
            exit 1
        fi
        
        echo "🎉 SUCCESS! New deployment is live and working!"
        
        # Now it's safe to cleanup the old container
        echo "🧹 Cleaning up old container..."
        docker stop treasures-app 2>/dev/null || true
        docker rm treasures-app 2>/dev/null || true
        
        # Rename staging container to production name
        docker rename treasures-app-staging treasures-app
        
        # Update Caddyfile to use standard name and reload
        sed 's/treasures-app-staging:80/treasures-app:80/' Caddyfile.staging > Caddyfile
        docker cp Caddyfile caddy:/etc/caddy/Caddyfile
        docker exec caddy caddy reload
        
        # Final cleanup
        rm -f Caddyfile.staging
        docker image rm $NEW_TAG 2>/dev/null || true  # Remove the tagged image (container now exists)
        docker image prune -f 2>/dev/null || true

EOF

fi

# Step 4: Final verification
log "🔍 Final verification..."

# Wait a moment for everything to settle
sleep 5

SITE_RESPONSE=$(test_http "https://treasures.to/")
OG_RESPONSE=$(test_http "https://treasures.to/og-image.png")

if [ "$SITE_RESPONSE" = "200" ] && [ "$OG_RESPONSE" = "200" ]; then
    log "✅ Deployment successful!"
    echo ""
    echo "🌐 Site: https://treasures.to/"
    echo "🖼️ OG Image: https://treasures.to/og-image.png"
    echo ""
    echo "🧪 Test social sharing:"
    echo "   • Facebook: https://developers.facebook.com/tools/debug/"
    echo "   • Twitter: https://cards-dev.twitter.com/validator"
    echo ""
else
    log "⚠️ Deployment may have issues:"
    log "   Site response: HTTP $SITE_RESPONSE (expected 200)"
    log "   OG image response: HTTP $OG_RESPONSE (expected 200)"
    echo ""
    echo "🔍 Debug with: ssh root@$DROPLET_IP 'cd /opt/treasures && docker compose logs'"
fi

log "📱 Monitor: ssh root@$DROPLET_IP 'cd /opt/treasures && docker compose logs -f'"