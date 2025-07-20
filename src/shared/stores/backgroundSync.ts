/**
 * Advanced background synchronization system
 */

import { useCallback, useRef, useEffect } from 'react';
import { useThrottle } from './performanceMonitor';

export interface SyncTask {
  id: string;
  name: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  interval: number;
  lastRun: Date | null;
  nextRun: Date;
  retryCount: number;
  maxRetries: number;
  execute: () => Promise<void>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface SyncSchedulerConfig {
  maxConcurrentTasks: number;
  retryDelay: number;
  enableAdaptiveScheduling: boolean;
  pauseOnError: boolean;
  networkAwareScheduling: boolean;
}

export interface SyncStatus {
  isRunning: boolean;
  activeTasks: string[];
  completedTasks: number;
  failedTasks: number;
  lastSync: Date | null;
  nextSync: Date | null;
  networkStatus: 'online' | 'offline' | 'slow';
}

const DEFAULT_SYNC_CONFIG: SyncSchedulerConfig = {
  maxConcurrentTasks: 3,
  retryDelay: 5000,
  enableAdaptiveScheduling: true,
  pauseOnError: false,
  networkAwareScheduling: true,
};

/**
 * Advanced background sync scheduler
 */
export function useBackgroundSyncScheduler(config: Partial<SyncSchedulerConfig> = {}) {
  const fullConfig = { ...DEFAULT_SYNC_CONFIG, ...config };
  const tasksRef = useRef<Map<string, SyncTask>>(new Map());
  const activeTasksRef = useRef<Set<string>>(new Set());
  const schedulerRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<SyncStatus>({
    isRunning: false,
    activeTasks: [],
    completedTasks: 0,
    failedTasks: 0,
    lastSync: null,
    nextSync: null,
    networkStatus: 'online',
  });

  // Network status monitoring
  const updateNetworkStatus = useCallback(() => {
    if (!navigator.onLine) {
      statusRef.current.networkStatus = 'offline';
      return;
    }

    // Check connection quality (simplified)
    const connection = (navigator as any).connection;
    if (connection) {
      const effectiveType = connection.effectiveType;
      if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        statusRef.current.networkStatus = 'slow';
      } else {
        statusRef.current.networkStatus = 'online';
      }
    } else {
      statusRef.current.networkStatus = 'online';
    }
  }, []);

  // Adaptive scheduling based on performance
  const getAdaptiveInterval = useCallback((task: SyncTask): number => {
    if (!fullConfig.enableAdaptiveScheduling) {
      return task.interval;
    }

    // Increase interval if task has been failing
    if (task.retryCount > 0) {
      return task.interval * Math.pow(1.5, task.retryCount);
    }

    // Adjust based on network status
    switch (statusRef.current.networkStatus) {
      case 'offline':
        return task.interval * 10; // Much longer when offline
      case 'slow':
        return task.interval * 2; // Longer when slow
      default:
        return task.interval;
    }
  }, [fullConfig.enableAdaptiveScheduling]);

  // Execute a single task
  const executeTask = useCallback(async (task: SyncTask): Promise<void> => {
    if (activeTasksRef.current.has(task.id)) {
      return; // Task already running
    }

    activeTasksRef.current.add(task.id);
    statusRef.current.activeTasks = Array.from(activeTasksRef.current);

    try {
      await task.execute();
      
      // Success
      task.lastRun = new Date();
      task.retryCount = 0;
      task.nextRun = new Date(Date.now() + getAdaptiveInterval(task));
      statusRef.current.completedTasks++;
      statusRef.current.lastSync = new Date();
      
      task.onSuccess?.();
    } catch (error) {
      // Failure
      task.retryCount++;
      statusRef.current.failedTasks++;
      
      if (task.retryCount < task.maxRetries) {
        // Schedule retry
        const retryDelay = fullConfig.retryDelay * Math.pow(2, task.retryCount - 1);
        task.nextRun = new Date(Date.now() + retryDelay);
      } else {
        // Max retries reached, schedule next regular run
        task.nextRun = new Date(Date.now() + getAdaptiveInterval(task));
        task.retryCount = 0;
      }
      
      task.onError?.(error as Error);
      
      if (fullConfig.pauseOnError) {
        console.warn(`Sync task ${task.name} failed, pausing scheduler`);
        stopScheduler();
      }
    } finally {
      activeTasksRef.current.delete(task.id);
      statusRef.current.activeTasks = Array.from(activeTasksRef.current);
    }
  }, [fullConfig.retryDelay, fullConfig.pauseOnError, getAdaptiveInterval]);

  // Get tasks ready to run
  const getReadyTasks = useCallback((): SyncTask[] => {
    const now = new Date();
    const readyTasks: SyncTask[] = [];

    for (const task of tasksRef.current.values()) {
      if (task.nextRun <= now && !activeTasksRef.current.has(task.id)) {
        readyTasks.push(task);
      }
    }

    // Sort by priority and next run time
    return readyTasks.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.nextRun.getTime() - b.nextRun.getTime();
    });
  }, []);

  // Main scheduler loop
  const runScheduler = useCallback(async () => {
    if (statusRef.current.networkStatus === 'offline' && fullConfig.networkAwareScheduling) {
      return; // Skip when offline
    }

    const readyTasks = getReadyTasks();
    const availableSlots = fullConfig.maxConcurrentTasks - activeTasksRef.current.size;
    const tasksToRun = readyTasks.slice(0, availableSlots);

    // Execute tasks concurrently
    const promises = tasksToRun.map(task => executeTask(task));
    await Promise.allSettled(promises);

    // Update next sync time
    const nextTask = Array.from(tasksRef.current.values())
      .filter(task => !activeTasksRef.current.has(task.id))
      .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime())[0];
    
    statusRef.current.nextSync = nextTask?.nextRun || null;
  }, [fullConfig.maxConcurrentTasks, fullConfig.networkAwareScheduling, getReadyTasks, executeTask]);

  // Throttled scheduler to prevent excessive runs
  const throttledScheduler = useThrottle(runScheduler, 1000);

  // Start the scheduler
  const startScheduler = useCallback(() => {
    if (statusRef.current.isRunning) return;

    statusRef.current.isRunning = true;
    updateNetworkStatus();

    schedulerRef.current = setInterval(() => {
      throttledScheduler();
    }, 5000); // Check every 5 seconds

    // Initial run
    throttledScheduler();
  }, [throttledScheduler, updateNetworkStatus]);

  // Stop the scheduler
  const stopScheduler = useCallback(() => {
    if (schedulerRef.current) {
      clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    }
    statusRef.current.isRunning = false;
  }, []);

  // Add a sync task
  const addTask = useCallback((taskConfig: Omit<SyncTask, 'id' | 'lastRun' | 'nextRun' | 'retryCount'>) => {
    const task: SyncTask = {
      ...taskConfig,
      id: taskConfig.name.toLowerCase().replace(/\s+/g, '-'),
      lastRun: null,
      nextRun: new Date(), // Run immediately
      retryCount: 0,
    };

    tasksRef.current.set(task.id, task);

    // Start scheduler if not running
    if (!statusRef.current.isRunning) {
      startScheduler();
    }

    return task.id;
  }, [startScheduler]);

  // Remove a sync task
  const removeTask = useCallback((taskId: string) => {
    tasksRef.current.delete(taskId);
    activeTasksRef.current.delete(taskId);
    statusRef.current.activeTasks = Array.from(activeTasksRef.current);
  }, []);

  // Update task configuration
  const updateTask = useCallback((taskId: string, updates: Partial<SyncTask>) => {
    const task = tasksRef.current.get(taskId);
    if (task) {
      Object.assign(task, updates);
    }
  }, []);

  // Force run a specific task
  const runTask = useCallback(async (taskId: string): Promise<void> => {
    const task = tasksRef.current.get(taskId);
    if (task) {
      await executeTask(task);
    }
  }, [executeTask]);

  // Get current status
  const getStatus = useCallback((): SyncStatus => {
    return { ...statusRef.current };
  }, []);

  // Get task list
  const getTasks = useCallback((): SyncTask[] => {
    return Array.from(tasksRef.current.values());
  }, []);

  // Network status change handler
  useEffect(() => {
    const handleOnline = () => {
      updateNetworkStatus();
      if (statusRef.current.isRunning) {
        throttledScheduler(); // Resume sync when back online
      }
    };

    const handleOffline = () => {
      updateNetworkStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Connection change handler
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateNetworkStatus);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus);
      }
    };
  }, [updateNetworkStatus, throttledScheduler]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScheduler();
    };
  }, [stopScheduler]);

  return {
    addTask,
    removeTask,
    updateTask,
    runTask,
    startScheduler,
    stopScheduler,
    getStatus,
    getTasks,
  };
}

/**
 * Simplified background sync hook for basic use cases
 */
export function useSimpleBackgroundSync(
  syncFn: () => Promise<void>,
  interval: number = 60000,
  options: {
    immediate?: boolean;
    priority?: SyncTask['priority'];
    maxRetries?: number;
  } = {}
) {
  const { priority = 'medium', maxRetries = 3 } = options;
  const scheduler = useBackgroundSyncScheduler();

  useEffect(() => {
    const taskId = scheduler.addTask({
      name: 'simple-sync',
      priority,
      interval,
      maxRetries,
      execute: syncFn,
    });

    return () => {
      scheduler.removeTask(taskId);
    };
  }, [scheduler, syncFn, interval, priority, maxRetries]);

  return {
    triggerSync: () => scheduler.runTask('simple-sync'),
    getStatus: scheduler.getStatus,
  };
}