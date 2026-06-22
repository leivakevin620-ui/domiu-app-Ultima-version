type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'audit';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  userId?: string;
  action?: string;
}

const isDev = process.env.NODE_ENV === 'development';

class Logger {
  private createEntry(level: LogLevel, message: string, data?: unknown, userId?: string, action?: string): LogEntry {
    return { timestamp: new Date().toISOString(), level, message, data, userId, action };
  }

  private log(entry: LogEntry) {
    if (isDev) {
      const fn = entry.level === 'error' ? console.error : entry.level === 'warn' ? console.warn : console.log;
      fn(`[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`, entry.data ?? '');
    }
    // TODO: send to logging service in production
  }

  debug(message: string, data?: unknown) { this.log(this.createEntry('debug', message, data)); }
  info(message: string, data?: unknown) { this.log(this.createEntry('info', message, data)); }
  warn(message: string, data?: unknown) { this.log(this.createEntry('warn', message, data)); }
  error(message: string, data?: unknown, userId?: string, action?: string) { this.log(this.createEntry('error', message, data, userId, action)); }
  audit(action: string, userId: string, data?: unknown) { this.log(this.createEntry('audit', `Audit: ${action}`, data, userId, action)); }
}

export const logger = new Logger();
