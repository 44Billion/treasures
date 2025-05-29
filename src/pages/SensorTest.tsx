import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SensorTest() {
  const [orientationData, setOrientationData] = useState<any>(null);
  const [motionData, setMotionData] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<any>({});

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 19)]);
  };

  useEffect(() => {
    // Collect device information
    setDeviceInfo({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      isHttps: location.protocol === 'https:',
      hasDeviceOrientationEvent: !!window.DeviceOrientationEvent,
      hasDeviceMotionEvent: !!window.DeviceMotionEvent,
      hasRequestPermission: !!(window.DeviceOrientationEvent as any)?.requestPermission,
      screenOrientation: screen.orientation?.angle || 'unknown',
    });

    addLog('Page loaded - device info collected');
  }, []);

  const startListening = () => {
    addLog('Starting sensor listeners...');
    setIsListening(true);

    const orientationHandler = (event: DeviceOrientationEvent) => {
      setOrientationData({
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        absolute: event.absolute,
        webkitCompassHeading: (event as any).webkitCompassHeading,
        timestamp: Date.now()
      });
      addLog(`Orientation: α=${event.alpha?.toFixed(1)} β=${event.beta?.toFixed(1)} γ=${event.gamma?.toFixed(1)}`);
    };

    const motionHandler = (event: DeviceMotionEvent) => {
      setMotionData({
        acceleration: event.acceleration,
        accelerationIncludingGravity: event.accelerationIncludingGravity,
        rotationRate: event.rotationRate,
        interval: event.interval,
        timestamp: Date.now()
      });
      addLog(`Motion: acc=${event.acceleration?.x?.toFixed(2)}, ${event.acceleration?.y?.toFixed(2)}, ${event.acceleration?.z?.toFixed(2)}`);
    };

    // Add all possible event listeners
    window.addEventListener('deviceorientation', orientationHandler);
    window.addEventListener('deviceorientationabsolute', orientationHandler);
    window.addEventListener('devicemotion', motionHandler);

    addLog('Event listeners added');

    // Store cleanup function
    (window as any).sensorCleanup = () => {
      window.removeEventListener('deviceorientation', orientationHandler);
      window.removeEventListener('deviceorientationabsolute', orientationHandler);
      window.removeEventListener('devicemotion', motionHandler);
      setIsListening(false);
      addLog('Event listeners removed');
    };
  };

  const stopListening = () => {
    if ((window as any).sensorCleanup) {
      (window as any).sensorCleanup();
    }
  };

  const requestPermissions = async () => {
    addLog('Requesting permissions...');
    
    try {
      if ((window.DeviceOrientationEvent as any)?.requestPermission) {
        const permission = await (window.DeviceOrientationEvent as any).requestPermission();
        addLog(`Orientation permission: ${permission}`);
      } else {
        addLog('No requestPermission method available');
      }

      if ((window.DeviceMotionEvent as any)?.requestPermission) {
        const permission = await (window.DeviceMotionEvent as any).requestPermission();
        addLog(`Motion permission: ${permission}`);
      } else {
        addLog('No motion requestPermission method available');
      }
    } catch (error) {
      addLog(`Permission error: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Device Sensor Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={startListening} disabled={isListening}>
                Start Listening
              </Button>
              <Button onClick={stopListening} disabled={!isListening} variant="outline">
                Stop Listening
              </Button>
              <Button onClick={requestPermissions} variant="outline">
                Request Permissions
              </Button>
              {navigator.userAgent.includes('Android') && !motionData && (
                <Button 
                  onClick={() => {
                    addLog('Opening Chrome flags page...');
                    window.open('chrome://flags/#enable-generic-sensor', '_blank');
                  }}
                  variant="outline"
                  className="bg-yellow-50 border-yellow-300 text-yellow-800"
                >
                  Open Chrome Flags
                </Button>
              )}
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Badge variant={isListening ? "default" : "secondary"}>
                {isListening ? "Listening" : "Stopped"}
              </Badge>
              <Badge variant={deviceInfo.isHttps ? "default" : "destructive"}>
                {deviceInfo.isHttps ? "HTTPS" : "HTTP"}
              </Badge>
              {navigator.userAgent.includes('Android') && (
                <Badge variant={motionData ? "default" : "destructive"}>
                  {motionData ? "Motion OK" : "Chrome Flags Needed"}
                </Badge>
              )}
              {navigator.userAgent.includes('Android') && (
                <Badge variant={orientationData ? "default" : "destructive"}>
                  {orientationData ? "Orientation OK" : "No Compass Data"}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Device Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><strong>User Agent:</strong> {deviceInfo.userAgent}</div>
              <div><strong>Platform:</strong> {deviceInfo.platform}</div>
              <div><strong>HTTPS:</strong> {deviceInfo.isHttps ? 'Yes' : 'No'}</div>
              <div><strong>DeviceOrientationEvent:</strong> {deviceInfo.hasDeviceOrientationEvent ? 'Yes' : 'No'}</div>
              <div><strong>DeviceMotionEvent:</strong> {deviceInfo.hasDeviceMotionEvent ? 'Yes' : 'No'}</div>
              <div><strong>requestPermission:</strong> {deviceInfo.hasRequestPermission ? 'Yes' : 'No'}</div>
              <div><strong>Screen Orientation:</strong> {deviceInfo.screenOrientation}°</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orientation Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {orientationData ? (
                <>
                  <div><strong>Alpha:</strong> {orientationData.alpha?.toFixed(2) || 'null'}</div>
                  <div><strong>Beta:</strong> {orientationData.beta?.toFixed(2) || 'null'}</div>
                  <div><strong>Gamma:</strong> {orientationData.gamma?.toFixed(2) || 'null'}</div>
                  <div><strong>Absolute:</strong> {orientationData.absolute ? 'Yes' : 'No'}</div>
                  <div><strong>WebKit Heading:</strong> {orientationData.webkitCompassHeading?.toFixed(2) || 'none'}</div>
                  <div><strong>Last Update:</strong> {new Date(orientationData.timestamp).toLocaleTimeString()}</div>
                </>
              ) : (
                <div className="text-gray-500">No orientation data received</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Motion Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {motionData ? (
                <>
                  <div><strong>Acceleration X:</strong> {motionData.acceleration?.x?.toFixed(2) || 'null'}</div>
                  <div><strong>Acceleration Y:</strong> {motionData.acceleration?.y?.toFixed(2) || 'null'}</div>
                  <div><strong>Acceleration Z:</strong> {motionData.acceleration?.z?.toFixed(2) || 'null'}</div>
                  <div><strong>Rotation Rate Alpha:</strong> {motionData.rotationRate?.alpha?.toFixed(2) || 'null'}</div>
                  <div><strong>Rotation Rate Beta:</strong> {motionData.rotationRate?.beta?.toFixed(2) || 'null'}</div>
                  <div><strong>Rotation Rate Gamma:</strong> {motionData.rotationRate?.gamma?.toFixed(2) || 'null'}</div>
                  <div><strong>Interval:</strong> {motionData.interval || 'null'}ms</div>
                  <div><strong>Last Update:</strong> {new Date(motionData.timestamp).toLocaleTimeString()}</div>
                </>
              ) : (
                <div className="text-gray-500">No motion data received</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto space-y-1 text-xs">
                {logs.map((log, idx) => (
                  <div key={idx} className="text-gray-600">{log}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Android Chrome Sensor Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <div className="font-medium text-yellow-800 mb-2">⚠️ No Motion Data = Chrome Flags Disabled</div>
              <div className="text-yellow-700">If you see "No motion data received", Chrome sensor flags are likely disabled.</div>
            </div>
            
            <div className="space-y-2">
              <div className="font-medium">Required Chrome Flags:</div>
              <div><strong>1.</strong> Copy and paste: <code className="bg-gray-100 px-1 rounded">chrome://flags/#enable-generic-sensor</code></div>
              <div><strong>2.</strong> Set to "Enabled"</div>
              <div><strong>3.</strong> Copy and paste: <code className="bg-gray-100 px-1 rounded">chrome://flags/#enable-generic-sensor-extra-classes</code></div>
              <div><strong>4.</strong> Set to "Enabled"</div>
              <div><strong>5.</strong> Tap "Relaunch" button in Chrome</div>
              <div><strong>6.</strong> Return to this page and test again</div>
            </div>
            
            <div className="space-y-2">
              <div className="font-medium">Additional Requirements:</div>
              <div><strong>HTTPS:</strong> Must use secure connection (https://)</div>
              <div><strong>Device Movement:</strong> Try moving/tilting device while testing</div>
              <div><strong>Chrome Version:</strong> Use latest Chrome for Android</div>
            </div>
            
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="font-medium text-blue-800 mb-1">💡 Quick Test</div>
              <div className="text-blue-700">After enabling flags and restarting Chrome, you should see motion data appear when you tilt your device.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}