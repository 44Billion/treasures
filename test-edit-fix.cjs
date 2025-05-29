// Updated debug script to test the edit fix
const WebSocket = require('ws');

const yourPubkey = '59e16130589c43f1dcd87edd373f85e79f68e97f04b3e47b6afb37de661f86d0';

async function debugEditFix() {
  return new Promise((resolve) => {
    const ws = new WebSocket('wss://ditto.pub/relay');
    const events = [];
    
    ws.on('open', () => {
      console.log('🔌 Connected - checking geocache events after edit fix');
      
      // Get geocache events with the updated approach
      ws.send(JSON.stringify(['REQ', 'test', {
        kinds: [30078],
        '#t': ['geocache'],  // Look for geocache type tag
        authors: [yourPubkey],
        limit: 50
      }]));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message[0] === 'EVENT') {
        const event = message[2];
        const dTag = event.tags.find(t => t[0] === 'd')?.[1];
        const tTag = event.tags.find(t => t[0] === 't')?.[1];
        
        // Parse content safely
        let content = {};
        try {
          content = JSON.parse(event.content || '{}');
        } catch (e) {
          console.log('Failed to parse content for event', event.id.slice(0, 8));
        }
        
        events.push({
          id: event.id,
          dTag: dTag || 'N/A',
          tTag: tTag || 'N/A',
          name: content.name || 'N/A',
          created: new Date(event.created_at * 1000).toISOString().slice(0, 19),
          isGeocache: (dTag === 'geocache') || (tTag === 'geocache') || (dTag?.startsWith('geocache-')),
          allTags: event.tags.map(t => `${t[0]}:${t[1] || ''}`).join(', ')
        });
        
      } else if (message[0] === 'EOSE') {
        ws.close();
      }
    });
    
    ws.on('close', () => {
      console.log(`📊 Found ${events.length} events:\n`);
      
      // Filter to actual geocaches
      const geocaches = events.filter(e => e.isGeocache);
      console.log(`🎯 Actual geocaches: ${geocaches.length}\n`);
      
      geocaches.forEach(e => {
        console.log(`📍 Event ID: ${e.id.slice(0, 12)}...`);
        console.log(`   D-Tag:    "${e.dTag}"`);
        console.log(`   T-Tag:    "${e.tTag}"`);
        console.log(`   Name:     "${e.name}"`);
        console.log(`   Created:  ${e.created}`);
        console.log(`   Tags:     ${e.allTags}`);
        console.log('');
      });
      
      // Group by d-tag to detect duplicate/replacement issues
      const byDTag = {};
      geocaches.forEach(e => {
        if (!byDTag[e.dTag]) byDTag[e.dTag] = [];
        byDTag[e.dTag].push(e);
      });
      
      console.log('🔍 ANALYSIS BY D-TAG:');
      Object.keys(byDTag).forEach(dtag => {
        const group = byDTag[dtag];
        console.log(`\nD-Tag: "${dtag}" (${group.length} events)`);
        
        if (group.length === 1) {
          console.log(`  ✅ Perfect! Single event: "${group[0].name}"`);
        } else {
          console.log(`  ⚠️  PROBLEM! Multiple events with same d-tag:`);
          group.forEach(e => {
            console.log(`     - ${e.id.slice(0, 8)}: "${e.name}" (${e.created})`);
          });
          console.log(`  💡 This suggests edits are creating new events instead of replacing`);
        }
      });
      
      // Also check for event ID being used as d-tag (old bug)
      console.log('\n🐛 CHECKING FOR OLD BUG (event ID used as d-tag):');
      const suspiciousEvents = geocaches.filter(e => {
        // D-tags that look like event IDs (64 hex chars)
        return e.dTag.match(/^[a-f0-9]{64}$/);
      });
      
      if (suspiciousEvents.length > 0) {
        console.log(`❌ Found ${suspiciousEvents.length} events with event-ID-like d-tags:`);
        suspiciousEvents.forEach(e => {
          console.log(`   ${e.id.slice(0, 8)}: d-tag="${e.dTag.slice(0, 16)}..." (suspicious!)`);
        });
      } else {
        console.log(`✅ No suspicious d-tags found (good!)`);
      }
      
      resolve(events);
    });
    
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
      resolve(events);
    }, 15000);
  });
}

debugEditFix().catch(console.error);