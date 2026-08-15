// Key Rotation Scheduler
// Automated background job scheduling for monthly key rotation and weekly testing

import {
  executeKeyRotation,
  testKeyRotation,
  getRotationHistory,
  getRotationStats,
  initializeKeyRotationSystem,
} from './keyRotationService';

// ============================================
// TYPES AND INTERFACES
// ============================================

interface ScheduledJob {
  jobName: string;
  schedule: string; // Cron expression
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  running: boolean;
}

interface SchedulerConfig {
  rotationCron: string;
  testCron: string;
  enableAutoRotation: boolean;
  enableAutoTesting: boolean;
  timezone?: string;
}

// ============================================
// SCHEDULER STATE
// ============================================

const scheduledJobs: Map<string, ScheduledJob> = new Map();
let schedulerRunning = false;

const defaultConfig: SchedulerConfig = {
  rotationCron: '0 2 1 * *', // 2 AM on the 1st of each month
  testCron: '0 3 * * 0', // 3 AM every Sunday
  enableAutoRotation: true,
  enableAutoTesting: true,
  timezone: 'UTC',
};

let config = { ...defaultConfig };

// ============================================
// CRON EXPRESSION PARSING
// ============================================

/**
 * Simple cron parser - converts cron expression to next execution time
 * Format: minute hour day month dayOfWeek
 */
function parseNextExecutionTime(cronExpression: string, fromDate = new Date()): Date {
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) {
    throw new Error('Invalid cron expression format');
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts.map((p) => {
    if (p === '*') return null;
    return parseInt(p);
  });

  let nextRun = new Date(fromDate);
  nextRun.setSeconds(0);
  nextRun.setMilliseconds(0);
  nextRun.setMinutes((nextRun.getMinutes() + 1) % 60);

  // Simple next execution calculation
  let attempts = 0;
  while (attempts < 366 * 24 * 60) {
    attempts++;

    const isMinuteMatch = minute === null || nextRun.getMinutes() === minute;
    const isHourMatch = hour === null || nextRun.getHours() === hour;
    const isDayMatch = dayOfMonth === null || nextRun.getDate() === dayOfMonth;
    const isMonthMatch = month === null || nextRun.getMonth() + 1 === month;
    const isDayOfWeekMatch = dayOfWeek === null || nextRun.getDay() === dayOfWeek;

    if (isMinuteMatch && isHourMatch && isDayMatch && isMonthMatch && isDayOfWeekMatch) {
      return nextRun;
    }

    nextRun.setMinutes(nextRun.getMinutes() + 1);
  }

  throw new Error('Could not calculate next execution time');
}

/**
 * Check if job should run at current time
 */
function shouldJobRun(cronExpression: string, lastRun?: Date): boolean {
  const now = new Date();

  // If this is the first run, execute it
  if (!lastRun) {
    return true;
  }

  try {
    const nextRun = parseNextExecutionTime(cronExpression, lastRun);
    return now >= nextRun;
  } catch (error) {
    console.error('Error checking job schedule:', error);
    return false;
  }
}

// ============================================
// JOB DEFINITIONS
// ============================================

/**
 * Monthly key rotation job
 */
async function executeRotationJob(): Promise<void> {
  const jobName = 'key-rotation';
  console.log(`🔄 [${jobName}] Starting monthly key rotation...`);

  try {
    const startTime = Date.now();

    // Execute rotation
    const result = await executeKeyRotation(
      'system', // userId
      'key-rotation-scheduler', // userAgent
      'localhost' // ip
    );

    const duration = Date.now() - startTime;

    if (result) {
      console.log(
        `✅ [${jobName}] Rotation completed in ${duration}ms. Job ID: ${result.jobId}`
      );

      // Log to monitoring system
      logJobExecution(jobName, 'success', duration, result);
    }
  } catch (error) {
    console.error(`❌ [${jobName}] Rotation failed:`, error);
    logJobExecution(jobName, 'failed', 0, { error: (error as Error).message });
  }
}

/**
 * Weekly key rotation test job
 */
async function executeTestJob(): Promise<void> {
  const jobName = 'key-rotation-test';
  console.log(`🧪 [${jobName}] Starting weekly key rotation test...`);

  try {
    const startTime = Date.now();

    // Execute test
    const result = await testKeyRotation();

    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(
        `✅ [${jobName}] Test passed in ${duration}ms. All key rotation operations verified.`
      );
      logJobExecution(jobName, 'success', duration, result);
    } else {
      console.warn(`⚠️ [${jobName}] Test failed: ${result.message}`);
      logJobExecution(jobName, 'failed', duration, result);
    }
  } catch (error) {
    console.error(`❌ [${jobName}] Test execution failed:`, error);
    logJobExecution(jobName, 'failed', 0, { error: (error as Error).message });
  }
}

// ============================================
// SCHEDULER CONTROL
// ============================================

/**
 * Initialize scheduler with configuration
 */
export async function initializeScheduler(customConfig?: Partial<SchedulerConfig>): Promise<void> {
  try {
    console.log('📋 Initializing key rotation scheduler...');

    // Initialize key rotation system
    await initializeKeyRotationSystem();

    // Apply custom config
    if (customConfig) {
      config = { ...config, ...customConfig };
    }

    // Register jobs
    scheduledJobs.set('key-rotation', {
      jobName: 'key-rotation',
      schedule: config.rotationCron,
      enabled: config.enableAutoRotation,
      running: false,
    });

    scheduledJobs.set('key-rotation-test', {
      jobName: 'key-rotation-test',
      schedule: config.testCron,
      enabled: config.enableAutoTesting,
      running: false,
    });

    console.log(`✅ Scheduler initialized with ${scheduledJobs.size} jobs`);

    // Start scheduler
    startScheduler();
  } catch (error) {
    console.error('Failed to initialize scheduler:', error);
    throw error;
  }
}

/**
 * Start the scheduler loop
 */
export function startScheduler(): void {
  if (schedulerRunning) {
    console.log('⚠️ Scheduler is already running');
    return;
  }

  schedulerRunning = true;
  console.log('▶️ Key rotation scheduler started');

  // Check jobs every minute
  const scheduler = setInterval(async () => {
    for (const [jobId, job] of scheduledJobs.entries()) {
      if (!job.enabled) continue;
      if (job.running) continue;

      if (shouldJobRun(job.schedule, job.lastRun)) {
        job.running = true;
        job.lastRun = new Date();

        try {
          if (jobId === 'key-rotation') {
            await executeRotationJob();
          } else if (jobId === 'key-rotation-test') {
            await executeTestJob();
          }

          job.nextRun = new Date(parseNextExecutionTime(job.schedule));
        } catch (error) {
          console.error(`Job execution error for ${jobId}:`, error);
        } finally {
          job.running = false;
        }
      }
    }
  }, 60000); // Check every minute

  // Store interval ID for later cleanup
  (global as any).keyRotationSchedulerInterval = scheduler;
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (!schedulerRunning) {
    console.log('⚠️ Scheduler is not running');
    return;
  }

  if ((global as any).keyRotationSchedulerInterval) {
    clearInterval((global as any).keyRotationSchedulerInterval);
  }

  schedulerRunning = false;
  console.log('⏹️ Key rotation scheduler stopped');
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return schedulerRunning;
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  running: boolean;
  jobs: ScheduledJob[];
  config: SchedulerConfig;
} {
  return {
    running: schedulerRunning,
    jobs: Array.from(scheduledJobs.values()),
    config,
  };
}

/**
 * Get job details
 */
export function getJobStatus(jobName: string): ScheduledJob | null {
  return scheduledJobs.get(jobName) || null;
}

/**
 * Manually trigger a job
 */
export async function triggerJob(jobName: string): Promise<any> {
  const job = scheduledJobs.get(jobName);

  if (!job) {
    throw new Error(`Job ${jobName} not found`);
  }

  if (job.running) {
    throw new Error(`Job ${jobName} is already running`);
  }

  console.log(`⚡ Manually triggering job: ${jobName}`);

  job.running = true;
  job.lastRun = new Date();

  try {
    if (jobName === 'key-rotation') {
      await executeRotationJob();
    } else if (jobName === 'key-rotation-test') {
      await executeTestJob();
    } else {
      throw new Error(`Unknown job: ${jobName}`);
    }
  } finally {
    job.running = false;
  }
}

/**
 * Enable/disable a job
 */
export function setJobEnabled(jobName: string, enabled: boolean): void {
  const job = scheduledJobs.get(jobName);

  if (!job) {
    throw new Error(`Job ${jobName} not found`);
  }

  job.enabled = enabled;
  console.log(`Job ${jobName} is now ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Update scheduler configuration
 */
export function updateConfig(updates: Partial<SchedulerConfig>): void {
  config = { ...config, ...updates };

  // Update job schedules if changed
  if (updates.rotationCron) {
    const rotationJob = scheduledJobs.get('key-rotation');
    if (rotationJob) {
      rotationJob.schedule = updates.rotationCron;
    }
  }

  if (updates.testCron) {
    const testJob = scheduledJobs.get('key-rotation-test');
    if (testJob) {
      testJob.schedule = updates.testCron;
    }
  }

  console.log('✅ Scheduler configuration updated');
}

// ============================================
// MONITORING AND LOGGING
// ============================================

interface JobExecutionLog {
  timestamp: Date;
  jobName: string;
  status: 'success' | 'failed';
  duration: number;
  details?: any;
}

const executionLogs: JobExecutionLog[] = [];
const MAX_LOGS = 1000;

/**
 * Log job execution
 */
function logJobExecution(
  jobName: string,
  status: 'success' | 'failed',
  duration: number,
  details?: any
): void {
  const log: JobExecutionLog = {
    timestamp: new Date(),
    jobName,
    status,
    duration,
    details,
  };

  executionLogs.push(log);

  // Keep only recent logs
  if (executionLogs.length > MAX_LOGS) {
    executionLogs.shift();
  }
}

/**
 * Get execution history
 */
export function getExecutionHistory(
  limit = 100,
  jobNameFilter?: string
): JobExecutionLog[] {
  let history = [...executionLogs].reverse().slice(0, limit);

  if (jobNameFilter) {
    history = history.filter((log) => log.jobName === jobNameFilter);
  }

  return history;
}

/**
 * Get scheduler health status
 */
export async function getSchedulerHealth(): Promise<{
  running: boolean;
  lastRotation?: Date;
  nextRotation?: Date;
  lastTest?: Date;
  nextTest?: Date;
  recentErrors: number;
  stats?: any;
}> {
  const rotationJob = scheduledJobs.get('key-rotation');
  const testJob = scheduledJobs.get('key-rotation-test');

  // Count recent errors (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentErrors = executionLogs.filter(
    (log) => log.status === 'failed' && log.timestamp > oneDayAgo
  ).length;

  // Get rotation statistics
  const stats = await getRotationStats();
  const history = await getRotationHistory(5);

  return {
    running: schedulerRunning,
    lastRotation: rotationJob?.lastRun,
    nextRotation: rotationJob?.nextRun,
    lastTest: testJob?.lastRun,
    nextTest: testJob?.nextRun,
    recentErrors,
    stats,
  };
}

/**
 * Log all job executions to stdout
 */
export function printExecutionReport(): void {
  console.log('\n📊 Key Rotation Scheduler Execution Report');
  console.log('==========================================\n');

  // Group by job name
  const byJob: Record<string, JobExecutionLog[]> = {};
  for (const log of executionLogs) {
    if (!byJob[log.jobName]) {
      byJob[log.jobName] = [];
    }
    byJob[log.jobName].push(log);
  }

  // Print stats per job
  for (const [jobName, logs] of Object.entries(byJob)) {
    const successful = logs.filter((l) => l.status === 'success').length;
    const failed = logs.filter((l) => l.status === 'failed').length;
    const avgDuration =
      logs.reduce((sum, l) => sum + l.duration, 0) / logs.length;

    console.log(`Job: ${jobName}`);
    console.log(`  Total runs: ${logs.length}`);
    console.log(`  Successful: ${successful}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Avg duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`  Last run: ${logs[logs.length - 1]?.timestamp}`);
    console.log('');
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  // Control
  initializeScheduler,
  startScheduler,
  stopScheduler,
  isSchedulerRunning,

  // Status
  getSchedulerStatus,
  getJobStatus,
  getSchedulerHealth,

  // Management
  triggerJob,
  setJobEnabled,
  updateConfig,

  // Monitoring
  getExecutionHistory,
  printExecutionReport,
};
