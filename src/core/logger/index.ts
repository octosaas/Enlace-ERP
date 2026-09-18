/**
 * Enlace ERP - Logger Estruturado (Observabilidade & Auditoria de Sistema)
 * PRD 01 - Seção 18 (Logs estruturados, correlation ID, proteção de dados sensíveis)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  correlationId?: string;
  companyId?: string;
  companyCnpj?: string;
  userId?: string;
  schemaNamespace?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'senha',
  'token',
  'jwt',
  'secret',
  'authorization',
  'cookie',
  'creditcard',
  'apikey',
  'gemini_api_key',
]);

function sanitizeData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED_SENSITIVE_DATA]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class StructuredLogger {
  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const logObject = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      service: 'enlace-erp-core',
      context: context ? sanitizeData(context) : undefined,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          }
        : undefined,
    };

    const output = JSON.stringify(logObject);
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  info(message: string, context?: LogContext) {
    this.formatLog('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.formatLog('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.formatLog('error', message, context, error);
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') {
      this.formatLog('debug', message, context);
    }
  }
}

export const logger = new StructuredLogger();
