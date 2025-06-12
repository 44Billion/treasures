/**
 * Enhanced connectivity checker that actually tests internet connectivity
 * rather than just relying on navigator.onLine
 */

export interface ConnectivityStatus {
  isOnline: boolean;
  isConnected: boolean;
  connectionQuality: 'good' | 'poor' | 'offline';
  lastChecked: number;
  latency?: number;
  error?: string;
  isInitialCheck?: boolean;
}

export interface ConnectivityOptions {
  timeout: number;
  checkInterval: number;
  testUrls: string[];
  maxRetries: number;
}

class ConnectivityChecker {
  private status: ConnectivityStatus = {
    isOnline: navigator.onLine,
    isConnected: false,
    connectionQuality: 'offline',
    lastChecked: 0,
    isInitialCheck: true,
  };

  private listeners: ((status: ConnectivityStatus) => void)[] = [];
  private checkInterval: number | null = null;
  private isChecking = false;
  private hasCompletedInitialCheck = false;

  private options: ConnectivityOptions = {
    timeout: 3000, // Reduced timeout for faster initial check
    checkInterval: 30000, // Check every 30 seconds
    testUrls: [
      // Use reliable, fast endpoints for connectivity testing
      'https://www.google.com/favicon.ico',
      'https://cloudflare.com/favicon.ico',
      'https://httpbin.org/status/200',
    ],
    maxRetries: 1, // Reduced retries for faster initial check
  };

  constructor(options?: Partial<ConnectivityOptions>) {
    if (options) {
      this.options = { ...this.options, ...options };
    }

    this.setupNetworkListeners();
    this.startPeriodicChecks();
    
    // Do fast initial connectivity check
    this.performInitialCheck();
  }

  private setupNetworkListeners(): void {
    // Still listen to navigator.onLine for immediate feedback
    window.addEventListener('online', () => {
      this.status.isOnline = true;
      this.notifyListeners();
      // Verify actual connectivity when browser says we're online
      this.checkConnectivity();
    });

    window.addEventListener('offline', () => {
      this.status.isOnline = false;
      this.status.isConnected = false;
      this.status.connectionQuality = 'offline';
      this.status.lastChecked = Date.now();
      this.status.isInitialCheck = false;
      this.hasCompletedInitialCheck = true;
      this.notifyListeners();
    });

    // Check connectivity when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkConnectivity();
      }
    });
  }

  private startPeriodicChecks(): void {
    this.checkInterval = window.setInterval(() => {
      if (!this.isChecking) {
        this.checkConnectivity();
      }
    }, this.options.checkInterval);
  }

  async checkConnectivity(): Promise<ConnectivityStatus> {
    if (this.isChecking) {
      return this.status;
    }

    this.isChecking = true;
    const startTime = Date.now();

    try {
      // If navigator says we're offline, don't bother testing
      if (!navigator.onLine) {
        this.status = {
          isOnline: false,
          isConnected: false,
          connectionQuality: 'offline',
          lastChecked: Date.now(),
          isInitialCheck: false,
        };
        this.hasCompletedInitialCheck = true;
        this.notifyListeners();
        return this.status;
      }

      // Test actual connectivity
      const isConnected = await this.testConnectivity();
      const latency = Date.now() - startTime;

      this.status = {
        isOnline: navigator.onLine,
        isConnected,
        connectionQuality: this.determineConnectionQuality(isConnected, latency),
        lastChecked: Date.now(),
        latency: isConnected ? latency : undefined,
        error: undefined,
        isInitialCheck: false,
      };

    } catch (error) {
      this.status = {
        isOnline: navigator.onLine,
        isConnected: false,
        connectionQuality: 'offline',
        lastChecked: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
        isInitialCheck: false,
      };
    } finally {
      this.isChecking = false;
      this.hasCompletedInitialCheck = true;
      this.notifyListeners();
    }

    return this.status;
  }

  private async testConnectivity(): Promise<boolean> {
    // Try multiple URLs to increase reliability
    for (const url of this.options.testUrls) {
      for (let retry = 0; retry < this.options.maxRetries; retry++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

          const response = await fetch(url, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // For no-cors requests, we can't check response.ok, 
          // but if we get here without an error, we have connectivity
          return true;

        } catch (error) {
          // If it's an abort error and we're on the last retry, continue to next URL
          if (error instanceof Error && error.name === 'AbortError' && retry === this.options.maxRetries - 1) {
            break;
          }
          // For other errors, try again
          if (retry < this.options.maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }

    return false;
  }

  private determineConnectionQuality(isConnected: boolean, latency: number): 'good' | 'poor' | 'offline' {
    if (!isConnected) {
      return 'offline';
    }

    // Consider connection quality based on latency
    if (latency < 1000) {
      return 'good';
    } else if (latency < 3000) {
      return 'poor';
    } else {
      return 'poor';
    }
  }

  getStatus(): ConnectivityStatus {
    return { ...this.status };
  }

  addListener(listener: (status: ConnectivityStatus) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener({ ...this.status });
      } catch (error) {
        console.error('Error in connectivity listener:', error);
      }
    });
  }

  // Perform fast initial connectivity check
  private async performInitialCheck(): Promise<void> {
    // Use a faster, simpler check for the initial load
    if (!navigator.onLine) {
      this.status = {
        isOnline: false,
        isConnected: false,
        connectionQuality: 'offline',
        lastChecked: Date.now(),
        isInitialCheck: false,
      };
      this.hasCompletedInitialCheck = true;
      this.notifyListeners();
      return;
    }

    // For initial check, just assume we're online if navigator.onLine is true
    // The full connectivity check will run in the background
    this.status = {
      isOnline: true,
      isConnected: true,
      connectionQuality: 'good',
      lastChecked: Date.now(),
      isInitialCheck: false,
    };
    this.hasCompletedInitialCheck = true;
    this.notifyListeners();

    // Then perform the full check in the background
    setTimeout(() => this.checkConnectivity(), 100);
  }

  // Force an immediate connectivity check
  async forceCheck(): Promise<ConnectivityStatus> {
    return await this.checkConnectivity();
  }

  // Update configuration
  updateOptions(options: Partial<ConnectivityOptions>): void {
    this.options = { ...this.options, ...options };
    
    // Restart periodic checks with new interval if it changed
    if (options.checkInterval && this.checkInterval) {
      clearInterval(this.checkInterval);
      this.startPeriodicChecks();
    }
  }

  // Cleanup
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.listeners = [];
  }
}

// Singleton instance
export const connectivityChecker = new ConnectivityChecker();

// Convenience hook-like function for React components
export function useConnectivity() {
  return connectivityChecker;
}