import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ModernSensorTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [sensorData, setSensorData] = useState<any>({});
  const [isListening, setIsListening] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 29)]);
    console.log(message);
  };

  const testModernSensors = async () => {
    addLog("=== TESTING MODERN SENSOR APIs ===");
    
    // Test 1: Generic Sensor API (newer approach)
    if ('Accelerometer' in window) {
      addLog("✅ Generic Sensor API available");
      try {
        // @ts-ignore - Generic Sensor API
        const accelerometer = new Accelerometer({ frequency: 60 });
        accelerometer.addEventListener('reading', () => {
          addLog(`Accelerometer: x=${accelerometer.x}, y=${accelerometer.y}, z=${accelerometer.z}`);
          setSensorData(prev => ({ ...prev, accelerometer: { x: accelerometer.x, y: accelerometer.y, z: accelerometer.z } }));
        });
        accelerometer.start();
        addLog("Accelerometer started");
        
        setTimeout(() => {
          accelerometer.stop();
          addLog("Accelerometer stopped");
        }, 10000);
      } catch (e) {
        addLog(`❌ Accelerometer error: ${e}`);
      }
    } else {
      addLog("❌ Generic Sensor API not available");
    }

    // Test 2: Gyroscope
    if ('Gyroscope' in window) {
      try {
        // @ts-ignore - Generic Sensor API
        const gyroscope = new Gyroscope({ frequency: 60 });
        gyroscope.addEventListener('reading', () => {
          addLog(`Gyroscope: x=${gyroscope.x}, y=${gyroscope.y}, z=${gyroscope.z}`);
          setSensorData(prev => ({ ...prev, gyroscope: { x: gyroscope.x, y: gyroscope.y, z: gyroscope.z } }));
        });
        gyroscope.start();
        addLog("Gyroscope started");
        
        setTimeout(() => {
          gyroscope.stop();
          addLog("Gyroscope stopped");
        }, 10000);
      } catch (e) {
        addLog(`❌ Gyroscope error: ${e}`);
      }
    } else {
      addLog("❌ Gyroscope API not available");
    }

    // Test 3: Magnetometer
    if ('Magnetometer' in window) {
      try {
        // @ts-ignore - Generic Sensor API
        const magnetometer = new Magnetometer({ frequency: 60 });
        magnetometer.addEventListener('reading', () => {
          addLog(`Magnetometer: x=${magnetometer.x}, y=${magnetometer.y}, z=${magnetometer.z}`);
          setSensorData(prev => ({ ...prev, magnetometer: { x: magnetometer.x, y: magnetometer.y, z: magnetometer.z } }));
        });
        magnetometer.start();
        addLog("Magnetometer started");
        
        setTimeout(() => {
          magnetometer.stop();
          addLog("Magnetometer stopped");
        }, 10000);
      } catch (e) {
        addLog(`❌ Magnetometer error: ${e}`);
      }
    } else {
      addLog("❌ Magnetometer API not available");
    }

    // Test 4: AbsoluteOrientationSensor
    if ('AbsoluteOrientationSensor' in window) {
      try {
        // @ts-ignore - Generic Sensor API
        const sensor = new AbsoluteOrientationSensor({ frequency: 60 });
        sensor.addEventListener('reading', () => {
          addLog(`AbsoluteOrientation: ${JSON.stringify(sensor.quaternion)}`);
          setSensorData(prev => ({ ...prev, absoluteOrientation: sensor.quaternion }));
        });
        sensor.start();
        addLog("AbsoluteOrientationSensor started");
        
        setTimeout(() => {
          sensor.stop();
          addLog("AbsoluteOrientationSensor stopped");
        }, 10000);
      } catch (e) {
        addLog(`❌ AbsoluteOrientationSensor error: ${e}`);
      }
    } else {
      addLog("❌ AbsoluteOrientationSensor not available");
    }

    // Test 5: RelativeOrientationSensor
    if ('RelativeOrientationSensor' in window) {
      try {
        // @ts-ignore - Generic Sensor API
        const sensor = new RelativeOrientationSensor({ frequency: 60 });
        sensor.addEventListener('reading', () => {
          addLog(`RelativeOrientation: ${JSON.stringify(sensor.quaternion)}`);
          setSensorData(prev => ({ ...prev, relativeOrientation: sensor.quaternion }));
        });
        sensor.start();
        addLog("RelativeOrientationSensor started");
        
        setTimeout(() => {
          sensor.stop();
          addLog("RelativeOrientationSensor stopped");
        }, 10000);
      } catch (e) {
        addLog(`❌ RelativeOrientationSensor error: ${e}`);
      }
    } else {
      addLog("❌ RelativeOrientationSensor not available");
    }
  };

  const testLegacySensors = () => {
    addLog("=== TESTING LEGACY SENSOR APIs ===");
    setIsListening(true);

    // Test legacy DeviceOrientationEvent with all possible variations
    const orientationHandler = (event: DeviceOrientationEvent) => {
      addLog(`Legacy Orientation: α=${event.alpha?.toFixed(2)}, β=${event.beta?.toFixed(2)}, γ=${event.gamma?.toFixed(2)}, abs=${event.absolute}`);
      setSensorData(prev => ({ ...prev, legacyOrientation: event }));
    };

    const motionHandler = (event: DeviceMotionEvent) => {
      const acc = event.acceleration;
      const accGrav = event.accelerationIncludingGravity;
      const rot = event.rotationRate;
      addLog(`Legacy Motion: acc=[${acc?.x?.toFixed(2)}, ${acc?.y?.toFixed(2)}, ${acc?.z?.toFixed(2)}], rot=[${rot?.alpha?.toFixed(2)}, ${rot?.beta?.toFixed(2)}, ${rot?.gamma?.toFixed(2)}]`);
      setSensorData(prev => ({ ...prev, legacyMotion: event }));
    };

    // Try all event variations
    window.addEventListener('deviceorientation', orientationHandler, false);
    window.addEventListener('deviceorientationabsolute', orientationHandler, false);
    window.addEventListener('devicemotion', motionHandler, false);

    addLog("Legacy event listeners added");

    (window as any).cleanupLegacy = () => {
      window.removeEventListener('deviceorientation', orientationHandler);
      window.removeEventListener('deviceorientationabsolute', orientationHandler);
      window.removeEventListener('devicemotion', motionHandler);
      setIsListening(false);
      addLog("Legacy listeners removed");
    };
  };

  const stopLegacyTest = () => {
    if ((window as any).cleanupLegacy) {
      (window as any).cleanupLegacy();
    }
  };

  const checkPermissions = async () => {
    addLog("=== CHECKING ALL PERMISSIONS ===");
    
    if (!navigator.permissions) {
      addLog("❌ Permissions API not available");
      return;
    }

    const permissionsToCheck = [
      'accelerometer',
      'gyroscope', 
      'magnetometer',
      'ambient-light-sensor',
      'geolocation'
    ];

    for (const permission of permissionsToCheck) {
      try {
        const result = await navigator.permissions.query({ name: permission as PermissionName });
        addLog(`${permission}: ${result.state}`);
        
        result.addEventListener('change', () => {
          addLog(`${permission} permission changed to: ${result.state}`);
        });
      } catch (e) {
        addLog(`❌ ${permission} permission check failed: ${e}`);
      }
    }
  };

  const checkDeviceCapabilities = () => {
    addLog("=== DEVICE CAPABILITIES CHECK ===");
    
    // Check what APIs are available
    const apis = [
      'DeviceOrientationEvent',
      'DeviceMotionEvent', 
      'Accelerometer',
      'Gyroscope',
      'Magnetometer',
      'AbsoluteOrientationSensor',
      'RelativeOrientationSensor',
      'AmbientLightSensor'
    ];

    apis.forEach(api => {
      const available = api in window;
      addLog(`${api}: ${available ? '✅' : '❌'}`);
    });

    // Check for permission methods
    addLog(`DeviceOrientationEvent.requestPermission: ${!!(window.DeviceOrientationEvent as any)?.requestPermission ? '✅' : '❌'}`);
    addLog(`DeviceMotionEvent.requestPermission: ${!!(window.DeviceMotionEvent as any)?.requestPermission ? '✅' : '❌'}`);
    
    // Check secure context
    addLog(`Secure context: ${window.isSecureContext ? '✅' : '❌'}`);
    addLog(`HTTPS: ${location.protocol === 'https:' ? '✅' : '❌'}`);
    
    // Check user agent
    addLog(`User Agent: ${navigator.userAgent}`);
    addLog(`Platform: ${navigator.platform}`);
  };

  useEffect(() => {
    checkDeviceCapabilities();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Modern vs Legacy Sensor Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={testModernSensors}>
                Test Modern APIs
              </Button>
              <Button onClick={testLegacySensors} disabled={isListening}>
                Test Legacy APIs
              </Button>
              <Button onClick={stopLegacyTest} disabled={!isListening} variant="outline">
                Stop Legacy Test
              </Button>
              <Button onClick={checkPermissions} variant="outline">
                Check Permissions
              </Button>
            </div>
            
            <Button onClick={() => setLogs([])} variant="outline" className="w-full">
              Clear Logs
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live Sensor Data</CardTitle>
          </CardHeader>
          <CardContent className="text-xs">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="font-medium mb-2">Modern APIs:</div>
                <div className="space-y-2">
                  <div><strong>Accelerometer:</strong></div>
                  <pre className="bg-gray-100 p-2 rounded text-xs">
                    {sensorData.accelerometer ? JSON.stringify(sensorData.accelerometer, null, 2) : 'No data'}
                  </pre>
                  
                  <div><strong>Gyroscope:</strong></div>
                  <pre className="bg-gray-100 p-2 rounded text-xs">
                    {sensorData.gyroscope ? JSON.stringify(sensorData.gyroscope, null, 2) : 'No data'}
                  </pre>
                  
                  <div><strong>Magnetometer:</strong></div>
                  <pre className="bg-gray-100 p-2 rounded text-xs">
                    {sensorData.magnetometer ? JSON.stringify(sensorData.magnetometer, null, 2) : 'No data'}
                  </pre>
                </div>
              </div>
              
              <div>
                <div className="font-medium mb-2">Legacy APIs:</div>
                <div className="space-y-2">
                  <div><strong>DeviceOrientation:</strong></div>
                  <pre className="bg-gray-100 p-2 rounded text-xs">
                    {sensorData.legacyOrientation ? JSON.stringify({
                      alpha: sensorData.legacyOrientation.alpha,
                      beta: sensorData.legacyOrientation.beta,
                      gamma: sensorData.legacyOrientation.gamma,
                      absolute: sensorData.legacyOrientation.absolute
                    }, null, 2) : 'No data'}
                  </pre>
                  
                  <div><strong>DeviceMotion:</strong></div>
                  <pre className="bg-gray-100 p-2 rounded text-xs">
                    {sensorData.legacyMotion ? JSON.stringify({
                      acceleration: sensorData.legacyMotion.acceleration,
                      rotationRate: sensorData.legacyMotion.rotationRate
                    }, null, 2) : 'No data'}
                  </pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto space-y-1 text-xs font-mono">
              {logs.map((log, idx) => (
                <div key={idx} className={`${
                  log.includes('❌') ? 'text-red-600' : 
                  log.includes('✅') ? 'text-green-600' : 
                  log.includes('Orientation:') || log.includes('Motion:') ? 'text-blue-600' :
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