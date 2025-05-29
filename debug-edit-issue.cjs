// Debug what happens when we edit
const WebSocket = require('ws');

const yourPubkey = '59e16130589c43f1dcd87edd373f85e79f68e97f04b3e47b6afb37de661f86d0';

async function debugAfterEdit() {
  return new Promise((resolve) => {
    const ws = new WebSocket('wss://ditto.pub/relay');
    const events = [];
    
    ws.on('open', () => {
      console.log('🔌 Connected - checking for duplicate geocaches');
      
      // Get your geocaches
      ws.send(JSON.stringify(['REQ', 'all', {
        kinds: [30078],
        '#t': ['geocache'],
        authors: [yourPubkey],
        limit: 20
      }]));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message[0] === 'EVENT') {
        const event = message[2];
        const dTag = event.tags.find(t => t[0] === 'd')?.[1];
        const name = JSON.parse(event.content || '{}').name || 'N/A';
        
        events.push({
          id: event.id,
          dTag,
          name,
          created: new Date(event.created_at * 1000).toISOString().slice(0, 19),
          allTags: event.tags
        });
        
      } else if (message[0] === 'EOSE') {
        ws.close();
      }
    });
    
    ws.on('close', () => {
      console.log(`📊 Found ${events.length} geocache events:\n`);
      
      events.forEach(e => {
        console.log(`ID: ${e.id.slice(0, 12)}`);
        console.log(`D-Tag: ${e.dTag}`);
        console.log(`Name: "${e.name}"`);
        console.log(`Created: ${e.created}`);
        console.log(`All tags:`, e.allTags);
        console.log('---');
      });
      
      // Group by d-tag to see if replacement is working
      const byDTag = {};
      events.forEach(e => {
        if (!byDTag[e.dTag]) byDTag[e.dTag] = [];
        byDTag[e.dTag].push(e);
      });
      
      console.log('\n🔍 GROUPING BY D-TAG:');
      Object.keys(byDTag).forEach(dtag => {
        const group = byDTag[dtag];
        console.log(`\nD-Tag: "${dtag}" (${group.length} events)`);
        group.forEach(e => {
          console.log(`  ${e.id.slice(0, 12)}: "${e.name}" (${e.created})`);
        });
        
        if (group.length > 1) {
          console.log('  ⚠️ MULTIPLE EVENTS WITH SAME D-TAG!');
        }
      });
      
      resolve(events);
    });
    
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
      resolve(events);
    }, 10000);
  });
}

debugAfterEdit().catch(console.error);