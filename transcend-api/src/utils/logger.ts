// Structured application logger.
//
// Several services imported '../utils/logger' which did not exist, so those
// modules never compiled. Small console-backed implementation with the
// interface those call sites expect; swap the sinks for pino/winston later
// without touching callers.
//
// NEVER log privileged content: message bodies, document contents, or client
// confidences. Log identifiers and outcomes.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVEL_ORDER[(process.env.LOG_LEVEL as LogLevel) || 'info'] ?? 20;

const emit = (level: LogLevel, scope: string | undefined, args: unknown[]) => {
  if (LEVEL_ORDER[level] < threshold) return;
  const prefix = scope ? `[${scope}]` : '';
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  sink(`${new Date().toISOString()} ${level.toUpperCase()} ${prefix}`.trim(), ...args);
};

export class Logger {
  constructor(private readonly scope?: string) {}
  debug = (...args: unknown[]) => emit('debug', this.scope, args);
  info = (...args: unknown[]) => emit('info', this.scope, args);
  warn = (...args: unknown[]) => emit('warn', this.scope, args);
  error = (...args: unknown[]) => emit('error', this.scope, args);
  child = (scope: string) => new Logger(this.scope ? `${this.scope}:${scope}` : scope);
}

export const logger = new Logger();
export default logger;
