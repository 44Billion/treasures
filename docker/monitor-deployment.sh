#!/bin/bash

# Monitor site availability during deployment
# Usage: ./monitor-deployment.sh [URL]

URL=${1:-"https://treasures.to"}
INTERVAL=1

echo "📱 Monitoring $URL for availability..."
echo "   Press Ctrl+C to stop monitoring"
echo ""

downtime_start=""
total_downtime=0
request_count=0
error_count=0

while true; do
    start_time=$(date +%s.%N)
    response=$(curl -s -o /dev/null -w "%{http_code}:%{time_total}" "$URL" --connect-timeout 5 --max-time 10 2>/dev/null || echo "000:0")
    end_time=$(date +%s.%N)
    
    http_code=${response%:*}
    response_time=${response#*:}
    request_count=$((request_count + 1))
    
    timestamp=$(date '+%H:%M:%S')
    
    if [ "$http_code" = "200" ]; then
        if [ -n "$downtime_start" ]; then
            downtime_end=$(date +%s.%N)
            duration=$(echo "$downtime_end - $downtime_start" | bc -l 2>/dev/null || echo "unknown")
            total_downtime=$(echo "$total_downtime + $duration" | bc -l 2>/dev/null || echo "$total_downtime")
            echo "🟢 $timestamp - SITE BACK UP! (Downtime: ${duration}s)"
            downtime_start=""
        else
            echo "🟢 $timestamp - OK (${response_time}s) [${request_count} requests, ${error_count} errors, ${total_downtime}s total downtime]"
        fi
    else
        error_count=$((error_count + 1))
        if [ -z "$downtime_start" ]; then
            downtime_start=$(date +%s.%N)
            echo "🔴 $timestamp - DOWNTIME STARTED (HTTP: $http_code)"
        else
            echo "🔴 $timestamp - Still down (HTTP: $http_code)"
        fi
    fi
    
    sleep $INTERVAL
done