import { useState, useEffect } from 'react';
import { useNostr } from '@nostrify/react';
import { NRelay1 } from '@nostrify/nostrify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { isSafari, createSafariNostr } from '@/lib/safariNostr';

interface DebugLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: any;
}

export default function Debug() {
  const { nostr } = useNostr();
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const addLog = (level: DebugLog['level'], message: string, data?: any) => {
    const log: DebugLog = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      data
    };
    setLogs(prev => [...prev, log]);
    console.log(`[${level.toUpperCase()}] ${message}`, data);
  };

  const clearLogs = () => {
    setLogs([]);
    setResults(null);
  };

  const testBasicNostrConnection = async () => {
    setIsRunning(true);
    clearLogs();
    
    try {
      addLog('info', 'Starting Nostr connection test...');
      
      // Test 1: Check if nostr object exists
      if (!nostr) {
        addLog('error', 'Nostr object is null/undefined');
        return;
      }
      addLog('success', 'Nostr object exists');

      // Test 2: Simple query test with detailed debugging
      addLog('info', 'Testing simple query...');
      const startTime = Date.now();
      
      try {
        addLog('info', 'About to call nostr.query...');
        addLog('info', 'Filter being used:', { kinds: [1], limit: 1 });
        
        // Check if query method exists and is callable
        if (!nostr.query) {
          addLog('error', 'nostr.query method does not exist');
          return;
        }
        
        if (typeof nostr.query !== 'function') {
          addLog('error', 'nostr.query is not a function, it is:', typeof nostr.query);
          return;
        }
        
        addLog('info', 'Calling nostr.query...');
        const queryPromise = nostr.query([{ kinds: [1], limit: 1 }]);
        
        addLog('info', 'Query promise created, waiting for result...');
        addLog('info', 'Promise type:', typeof queryPromise);
        addLog('info', 'Is Promise?', queryPromise instanceof Promise);
        
        const simpleEvents = await Promise.race([
          queryPromise,
          new Promise<never>((_, reject) => 
            setTimeout(() => {
              addLog('warn', 'Query timeout reached after 8s');
              reject(new Error('Query timeout after 8s'));
            }, 8000)
          )
        ]);
        
        const duration = Date.now() - startTime;
        addLog('success', `Simple query completed in ${duration}ms`);
        addLog('info', `Found ${simpleEvents.length} events`);
        addLog('info', 'Result type:', typeof simpleEvents);
        addLog('info', 'Is array?', Array.isArray(simpleEvents));
        
        if (simpleEvents.length > 0) {
          addLog('info', 'Sample event structure:', {
            id: simpleEvents[0].id?.slice(0, 8) + '...',
            kind: simpleEvents[0].kind,
            created_at: simpleEvents[0].created_at,
            pubkey: simpleEvents[0].pubkey?.slice(0, 8) + '...',
            tags_count: simpleEvents[0].tags?.length || 0
          });
        }
      } catch (queryError) {
        const duration = Date.now() - startTime;
        addLog('error', `Simple query failed after ${duration}ms:`, {
          message: queryError instanceof Error ? queryError.message : String(queryError),
          name: queryError instanceof Error ? queryError.name : 'Unknown',
          stack: queryError instanceof Error ? queryError.stack?.slice(0, 300) : 'No stack'
        });
        
        // Additional debugging
        addLog('info', 'Error analysis:', {
          isTimeoutError: queryError instanceof Error && queryError.message.includes('timeout'),
          isNetworkError: queryError instanceof Error && queryError.message.includes('network'),
          errorType: typeof queryError
        });
      }

      // Test 3: Safari-optimized geocache query test
      addLog('info', 'Testing Safari-optimized geocache query (kind 37515)...');
      const geocacheStartTime = Date.now();
      
      try {
        // Use shorter timeout and smaller limit for Safari
        const geocacheEvents = await Promise.race([
          nostr.query([{ kinds: [37515], limit: 5 }]),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Geocache query timeout after 8s')), 8000)
          )
        ]);
        
        const geocacheDuration = Date.now() - geocacheStartTime;
        addLog('success', `Geocache query completed in ${geocacheDuration}ms`);
        addLog('info', `Found ${geocacheEvents.length} geocache events`);
        
        if (geocacheEvents.length > 0) {
          const sampleEvent = geocacheEvents[0];
          const name = sampleEvent.tags.find(t => t[0] === 'name')?.[1];
          const location = sampleEvent.tags.find(t => t[0] === 'location')?.[1];
          const difficulty = sampleEvent.tags.find(t => t[0] === 'difficulty')?.[1];
          
          addLog('info', 'Sample geocache event:', {
            id: sampleEvent.id,
            name: name || 'No name',
            location: location || 'No location',
            difficulty: difficulty || 'No difficulty',
            tags_count: sampleEvent.tags.length,
            content_length: sampleEvent.content.length
          });
        } else {
          addLog('warn', 'No geocache events found - this might be the issue!');
        }
        
        setResults({
          totalEvents: geocacheEvents.length,
          sampleEvent: geocacheEvents[0] || null,
          queryDuration: geocacheDuration
        });
        
      } catch (geocacheError) {
        addLog('error', 'Geocache query failed:', {
          message: geocacheError instanceof Error ? geocacheError.message : String(geocacheError),
          name: geocacheError instanceof Error ? geocacheError.name : 'Unknown'
        });
      }

    } catch (error) {
      addLog('error', 'Test failed with unexpected error:', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const testRelayConnections = async () => {
    setIsRunning(true);
    clearLogs();
    
    const testRelays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
      'wss://nostr.wine',
      'wss://relay.snort.social'
    ];

    addLog('info', 'Testing individual relay connections...');

    for (const relayUrl of testRelays) {
      try {
        addLog('info', `Testing ${relayUrl}...`);
        const startTime = Date.now();
        
        // Create a simple WebSocket test
        const ws = new WebSocket(relayUrl);
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Connection timeout'));
          }, 5000);
          
          ws.onopen = () => {
            clearTimeout(timeout);
            const duration = Date.now() - startTime;
            addLog('success', `${relayUrl} connected in ${duration}ms`);
            ws.close();
            resolve(true);
          };
          
          ws.onerror = (error) => {
            clearTimeout(timeout);
            addLog('error', `${relayUrl} connection failed:`, error);
            reject(error);
          };
        });
        
      } catch (error) {
        addLog('error', `${relayUrl} failed:`, {
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    setIsRunning(false);
  };

  const testSafariSpecific = async () => {
    setIsRunning(true);
    clearLogs();
    
    addLog('info', 'Running Safari-specific tests...');
    
    try {
      // Test 0: Inspect nostr object
      addLog('info', 'Inspecting nostr object...');
      addLog('info', 'Nostr object type:', typeof nostr);
      addLog('info', 'Nostr object keys:', Object.keys(nostr || {}));
      addLog('info', 'Query method type:', typeof nostr?.query);
      
      if (!nostr) {
        addLog('error', 'Nostr object is null/undefined');
        return;
      }
      
      if (typeof nostr.query !== 'function') {
        addLog('error', 'Nostr query is not a function');
        return;
      }
      
      // Test 1: Very simple query with detailed error handling
      addLog('info', 'Testing minimal query...');
      try {
        addLog('info', 'Calling nostr.query with filter:', { kinds: [1], limit: 1 });
        
        const queryPromise = nostr.query([{ kinds: [1], limit: 1 }]);
        addLog('info', 'Query promise created, type:', typeof queryPromise);
        addLog('info', 'Is promise?', queryPromise instanceof Promise);
        
        const simpleEvents = await Promise.race([
          queryPromise,
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Simple query timeout after 5s')), 5000)
          )
        ]);
        
        addLog('success', `Simple query worked: ${simpleEvents.length} events`);
        addLog('info', 'Events type:', typeof simpleEvents);
        addLog('info', 'Is array?', Array.isArray(simpleEvents));
        
        if (simpleEvents.length > 0) {
          addLog('info', 'Sample event:', {
            id: simpleEvents[0].id?.slice(0, 8) + '...',
            kind: simpleEvents[0].kind,
            created_at: simpleEvents[0].created_at
          });
        }
        
      } catch (queryError) {
        addLog('error', 'Simple query failed with error:', {
          message: queryError instanceof Error ? queryError.message : String(queryError),
          name: queryError instanceof Error ? queryError.name : 'Unknown',
          stack: queryError instanceof Error ? queryError.stack?.slice(0, 200) : 'No stack'
        });
        
        // Try to understand what went wrong
        addLog('info', 'Error details:', {
          errorType: typeof queryError,
          errorConstructor: queryError?.constructor?.name,
          isError: queryError instanceof Error,
          isTimeoutError: queryError instanceof Error && queryError.message.includes('timeout')
        });
        
        return; // Don't continue if basic query fails
      }
      
      // Test 2: Direct relay connection test
      addLog('info', 'Testing direct relay connection...');
      try {
        const relay = new NRelay1('wss://relay.damus.io');
        addLog('info', 'Created direct relay connection');
        
        const directEvents = await Promise.race([
          relay.query([{ kinds: [1], limit: 1 }]),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Direct relay timeout')), 5000)
          )
        ]);
        
        addLog('success', `Direct relay query worked: ${directEvents.length} events`);
        
        // Clean up
        try {
          relay.close();
          addLog('info', 'Closed direct relay connection');
        } catch (closeError) {
          addLog('warn', 'Error closing relay:', closeError);
        }
        
      } catch (error) {
        addLog('error', 'Direct relay test failed:', {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Unknown'
        });
      }
      
      // Test 3: Safari-specific client test
      if (isSafari()) {
        addLog('info', 'Testing Safari-specific Nostr client...');
        try {
          const safariClient = createSafariNostr(['wss://relay.damus.io', 'wss://nos.lol']);
          
          const safariEvents = await safariClient.query([{ kinds: [1], limit: 2 }], { 
            timeout: 5000, 
            maxRetries: 2 
          });
          
          addLog('success', `Safari client worked: ${safariEvents.length} events`);
          
          if (safariEvents.length > 0) {
            addLog('info', 'Safari client sample event:', {
              id: safariEvents[0].id?.slice(0, 8) + '...',
              kind: safariEvents[0].kind,
              created_at: safariEvents[0].created_at
            });
          }
          
          safariClient.close();
          
        } catch (error) {
          addLog('error', 'Safari client failed:', {
            message: error instanceof Error ? error.message : String(error)
          });
        }
      } else {
        addLog('info', 'Not Safari, skipping Safari-specific client test');
      }
      
      // Test 4: Geocache query with very small limit
      addLog('info', 'Testing tiny geocache query...');
      try {
        const tinyEvents = await Promise.race([
          nostr.query([{ kinds: [37515], limit: 2 }]),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Tiny query timeout')), 4000)
          )
        ]);
        addLog('success', `Tiny geocache query worked: ${tinyEvents.length} events`);
      } catch (error) {
        addLog('error', 'Tiny geocache query failed:', {
          message: error instanceof Error ? error.message : String(error)
        });
      }
      
    } catch (error) {
      addLog('error', 'Safari-specific test failed:', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const testBrowserInfo = () => {
    clearLogs();
    
    addLog('info', 'Browser Information:');
    addLog('info', `User Agent: ${navigator.userAgent}`);
    addLog('info', `Platform: ${navigator.platform}`);
    addLog('info', `Language: ${navigator.language}`);
    addLog('info', `Online: ${navigator.onLine}`);
    addLog('info', `Cookie Enabled: ${navigator.cookieEnabled}`);
    
    // Check for Safari-specific features
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    
    addLog('info', `Is Safari: ${isSafari}`);
    addLog('info', `Is iOS: ${isIOS}`);
    addLog('info', `Is Mobile: ${isMobile}`);
    
    // Check WebSocket support
    addLog('info', `WebSocket Support: ${typeof WebSocket !== 'undefined'}`);
    
    // Check for any blocked features
    try {
      const testWs = new WebSocket('wss://echo.websocket.org');
      testWs.close();
      addLog('success', 'WebSocket creation test passed');
    } catch (error) {
      addLog('error', 'WebSocket creation failed:', error);
    }
  };

  useEffect(() => {
    testBrowserInfo();
  }, []);

  const getLogIcon = (level: DebugLog['level']) => {
    switch (level) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warn': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default: return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  const getLogColor = (level: DebugLog['level']) => {
    switch (level) {
      case 'success': return 'text-green-700 bg-green-50 border-green-200';
      case 'error': return 'text-red-700 bg-red-50 border-red-200';
      case 'warn': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-700 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Nostr Cache Debug Tool
            </CardTitle>
            <p className="text-sm text-gray-600">
              This page helps diagnose cache loading issues on Safari/iOS
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={testBasicNostrConnection} 
                disabled={isRunning}
                className="flex items-center gap-2"
              >
                {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Test Cache Loading
              </Button>
              <Button 
                onClick={testSafariSpecific} 
                disabled={isRunning}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Safari Tests
              </Button>
              <Button 
                onClick={testRelayConnections} 
                disabled={isRunning}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Test Relays
              </Button>
              <Button 
                onClick={clearLogs} 
                variant="outline"
              >
                Clear Logs
              </Button>
            </div>
          </CardContent>
        </Card>

        {results && (
          <Card>
            <CardHeader>
              <CardTitle>Results Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{results.totalEvents}</div>
                  <div className="text-sm text-gray-600">Caches Found</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{results.queryDuration}ms</div>
                  <div className="text-sm text-gray-600">Query Time</div>
                </div>
                <div className="text-center">
                  <Badge variant={results.totalEvents > 0 ? "default" : "destructive"}>
                    {results.totalEvents > 0 ? "Working" : "Failed"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Debug Logs</CardTitle>
            <p className="text-sm text-gray-600">
              {logs.length} log entries
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No logs yet. Run a test to see debug information.</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className={`p-3 rounded-lg border ${getLogColor(log.level)}`}>
                    <div className="flex items-start gap-2">
                      {getLogIcon(log.level)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono">{log.timestamp}</span>
                          <Badge variant="outline" className="text-xs">
                            {log.level.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">{log.message}</p>
                        {log.data && (
                          <details className="mt-2">
                            <summary className="text-xs cursor-pointer text-gray-600 hover:text-gray-800">
                              Show details
                            </summary>
                            <pre className="mt-1 text-xs bg-white/50 p-2 rounded border overflow-x-auto">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Diagnosis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>If you see "No geocache events found":</strong> The relays might not have any geocache data, or there's a network issue.</p>
              <p><strong>If queries timeout:</strong> Safari might be blocking WebSocket connections or there are network restrictions.</p>
              <p><strong>If WebSocket creation fails:</strong> Safari has strict security policies that might be blocking connections.</p>
              <p><strong>If you see connection errors:</strong> Try switching to a different network (WiFi vs cellular).</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}