import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BasicSensorTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [rawData, setRawData] = useState<any>({});

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 29)]);
    console.log(message);
  };

  const startBasicTest = () => {
    addLog("=== STARTING BASIC SENSOR TEST ===");
    addLog(`URL: ${window.location.href}`);
    addLog(`Protocol: ${window.location.protocol}`);
    addLog(`User Agent: ${navigator.userAgent}`);
    addLog(`Platform: ${navigator.platform}`);
    
    // Check basic API availability
    addLog(`window.DeviceOrientationEvent: ${!!window.DeviceOrientationEvent}`);
    addLog(`window.DeviceMotionEvent: ${!!window.DeviceMotionEvent}`);
    addLog(`navigator.permissions: ${!!navigator.permissions}`);
    
    // Check for permission methods
    const hasOrientationPermission = !!(window.DeviceOrientationEvent as any)?.requestPermission;
    const hasMotionPermission = !!(window.DeviceMotionEvent as any)?.requestPermission;
    addLog(`DeviceOrientationEvent.requestPermission: ${hasOrientationPermission}`);
    addLog(`DeviceMotionEvent.requestPermission: ${hasMotionPermission}`);

    setIsListening(true);

    // Test 1: Basic orientation listener
    const orientationHandler = (event: DeviceOrientationEvent) => {
      addLog(`ORIENTATION EVENT: alpha=${event.alpha}, beta=${event.beta}, gamma=${event.gamma}, absolute=${event.absolute}`);
      setRawData(prev => ({ ...prev, orientation: event }));
    };

    // Test 2: Basic motion listener  
    const motionHandler = (event: DeviceMotionEvent) => {
      addLog(`MOTION EVENT: x=${event.acceleration?.x}, y=${event.acceleration?.y}, z=${event.acceleration?.z}`);
      setRawData(prev => ({ ...prev, motion: event }));
    };

    // Test 3: Try all possible event names
    const eventNames = [
      'deviceorientation',
      'deviceorientationabsolute', 
      'devicemotion'
    ];

    eventNames.forEach(eventName => {
      addLog(`Adding listener for: ${eventName}`);
      if (eventName === 'devicemotion') {
        window.addEventListener(eventName, motionHandler, false);
      } else {
        window.addEventListener(eventName, orientationHandler, false);
      }
    });

    // Test 4: Check if events fire at all
    let eventCount = 0;
    const anyEventHandler = (event: Event) => {
      eventCount++;
      addLog(`Generic event fired: ${event.type} (count: ${eventCount})`);
    };

    eventNames.forEach(eventName => {
      window.addEventListener(eventName, anyEventHandler, false);
    });

    // Test 5: Try to trigger events manually
    setTimeout(() => {
      addLog("=== 5 SECOND CHECK ===");
      if (eventCount === 0) {
        addLog("❌ NO EVENTS FIRED AT ALL");
        addLog("This indicates a fundamental browser/device issue");
      } else {
        addLog(`✅ ${eventCount} events fired`);
      }
    }, 5000);

    // Test 6: Check screen orientation API
    if (screen.orientation) {
      addLog(`Screen orientation: ${screen.orientation.angle}° ${screen.orientation.type}`);
      screen.orientation.addEventListener('change', () => {
        addLog(`Screen orientation changed: ${screen.orientation.angle}° ${screen.orientation.type}`);
      });
    } else {
      addLog("❌ screen.orientation not available");
    }

    // Test 7: Check if we're in a secure context
    addLog(`Secure context: ${window.isSecureContext}`);
    
    // Test 8: Check permissions API
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'accelerometer' as PermissionName }).then(result => {
        addLog(`Accelerometer permission: ${result.state}`);
      }).catch(e => {
        addLog(`Accelerometer permission check failed: ${e.message}`);
      });

      navigator.permissions.query({ name: 'gyroscope' as PermissionName }).then(result => {
        addLog(`Gyroscope permission: ${result.state}`);
      }).catch(e => {
        addLog(`Gyroscope permission check failed: ${e.message}`);
      });

      navigator.permissions.query({ name: 'magnetometer' as PermissionName }).then(result => {
        addLog(`Magnetometer permission: ${result.state}`);
      }).catch(e => {
        addLog(`Magnetometer permission check failed: ${e.message}`);
      });
    }

    // Cleanup function
    (window as any).cleanupBasicTest = () => {
      eventNames.forEach(eventName => {
        window.removeEventListener(eventName, orientationHandler);
        window.removeEventListener(eventName, motionHandler);
        window.removeEventListener(eventName, anyEventHandler);
      });
      setIsListening(false);
      addLog("=== CLEANUP COMPLETE ===");
    };
  };

  const stopTest = () => {
    if ((window as any).cleanupBasicTest) {
      (window as any).cleanupBasicTest();
    }
  };

  const requestAllPermissions = async () => {
    addLog("=== REQUESTING ALL PERMISSIONS ===");
    
    // Try iOS-style permissions
    if ((window.DeviceOrientationEvent as any)?.requestPermission) {
      try {
        const result = await (window.DeviceOrientationEvent as any).requestPermission();
        addLog(`DeviceOrientation permission result: ${result}`);
      } catch (e) {
        addLog(`DeviceOrientation permission error: ${e}`);
      }
    }

    if ((window.DeviceMotionEvent as any)?.requestPermission) {
      try {
        const result = await (window.DeviceMotionEvent as any).requestPermission();
        addLog(`DeviceMotion permission result: ${result}`);
      } catch (e) {
        addLog(`DeviceMotion permission error: ${e}`);
      }
    }

    // Try generic sensor API permissions
    if (navigator.permissions) {
      const permissions = ['accelerometer', 'gyroscope', 'magnetometer'];
      for (const permission of permissions) {
        try {
          const result = await navigator.permissions.query({ name: permission as PermissionName });
          addLog(`${permission} permission: ${result.state}`);
        } catch (e) {
          addLog(`${permission} permission check failed: ${e}`);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Sensor Test - Android Debug</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={startBasicTest} disabled={isListening}>
                Start Basic Test
              </Button>
              <Button onClick={stopTest} disabled={!isListening} variant="outline">
                Stop Test
              </Button>
              <Button onClick={requestAllPermissions} variant="outline">
                Request Permissions
              </Button>
              <Button onClick={() => setLogs([])} variant="outline">
                Clear Logs
              </Button>
            </div>
            
            <div className="text-sm space-y-2">
              <div><strong>Instructions:</strong></div>
              <div>1. Click "Start Basic Test"</div>
              <div>2. Move/tilt your device</div>
              <div>3. Watch the logs below</div>
              <div>4. If no events fire after 5 seconds, there's a fundamental issue</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Raw Event Data</CardTitle>
          </CardHeader>
          <CardContent className="text-xs">
            <div className="space-y-2">
              <div><strong>Last Orientation:</strong></div>
              <pre className="bg-gray-100 p-2 rounded overflow-auto">
                {rawData.orientation ? JSON.stringify({
                  alpha: rawData.orientation.alpha,
                  beta: rawData.orientation.beta,
                  gamma: rawData.orientation.gamma,
                  absolute: rawData.orientation.absolute
                }, null, 2) : 'No data'}
              </pre>
              
              <div><strong>Last Motion:</strong></div>
              <pre className="bg-gray-100 p-2 rounded overflow-auto">
                {rawData.motion ? JSON.stringify({
                  acceleration: rawData.motion.acceleration,
                  rotationRate: rawData.motion.rotationRate,
                  interval: rawData.motion.interval
                }, null, 2) : 'No data'}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto space-y-1 text-xs font-mono">
              {logs.map((log, idx) => (
                <div key={idx} className={`${
                  log.includes('❌') ? 'text-red-600' : 
                  log.includes('✅') ? 'text-green-600' : 
                  log.includes('EVENT:') ? 'text-blue-600 font-bold' :
                  'text-gray-700'
                }`}>
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}