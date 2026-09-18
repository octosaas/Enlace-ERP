/**
 * Enlace ERP - Rate Limiter & Brute Force Guard
 * PRD 02 - Seção 26 (API Security) & Seção 27 (Proteção contra Brute Force)
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger/index.js';
import { AuditService } from '../audit/service.js';

interface RateLimitRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

class RateLimiterService {
  // Guarda tentativas por chave (ex: ip:127.0.0.1 ou login:carlos@alfa.com.br:127.0.0.1)
  private store = new Map<string, RateLimitRecord>();

  /**
   * Limpa registros expirados a cada 10 minutos
   */
  constructor() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.store.entries()) {
        if (record.lockedUntil && record.lockedUntil < now) {
          this.store.delete(key);
        } else if (!record.lockedUntil && now - record.firstAttemptAt > 60 * 60 * 1000) {
          this.store.delete(key);
        }
      }
    }, 10 * 60 * 1000).unref();
  }

  /**
   * Registra falha e verifica se atingiu bloqueio
   */
  recordFailure(key: string, maxAttempts = 5, lockDurationSeconds = 900): { isLocked: boolean; remainingSeconds: number } {
    const now = Date.now();
    const record = this.store.get(key) || { count: 0, firstAttemptAt: now };

    record.count += 1;

    if (record.count >= maxAttempts) {
      record.lockedUntil = now + lockDurationSeconds * 1000;
      this.store.set(key, record);
      logger.warn(`[BruteForceGuard] Bloqueio ativado para [${key}]. Tentativas: ${record.count}.`);
      return { isLocked: true, remainingSeconds: lockDurationSeconds };
    }

    this.store.set(key, record);
    return { isLocked: false, remainingSeconds: 0 };
  }

  /**
   * Reseta o contador após sucesso
   */
  reset(key: string) {
    this.store.delete(key);
  }

  /**
   * Verifica se a chave está bloqueada no momento
   */
  checkStatus(key: string): { isLocked: boolean; remainingSeconds: number } {
    const record = this.store.get(key);
    if (!record) return { isLocked: false, remainingSeconds: 0 };

    const now = Date.now();
    if (record.lockedUntil && record.lockedUntil > now) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds };
    }

    // Se já passou o tempo de bloqueio, limpa
    if (record.lockedUntil && record.lockedUntil <= now) {
      this.store.delete(key);
      return { isLocked: false, remainingSeconds: 0 };
    }

    return { isLocked: false, remainingSeconds: 0 };
  }
}

export const rateLimiter = new RateLimiterService();

/**
 * Middleware para proteção contra brute force em endpoints de autenticação
 */
export function createRateLimitMiddleware(options: {
  maxAttempts: number;
  lockDurationSeconds: number;
  keyGenerator: (req: Request) => string;
  actionName: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyGenerator(req);
    const status = rateLimiter.checkStatus(key);

    if (status.isLocked) {
      res.setHeader('Retry-After', status.remainingSeconds.toString());

      AuditService.recordSecurityEvent({
        type: 'SECURITY_BRUTE_FORCE',
        severity: 'HIGH',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId || 'req-unknown',
        details: {
          key,
          action: options.actionName,
          remainingSeconds: status.remainingSeconds,
        },
        mitigationTaken: `Requisição rejeitada com HTTP 429. Bloqueio por mais ${status.remainingSeconds} segundos.`,
      });

      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: `Muitas tentativas consecutivas. Por motivos de segurança, o acesso está temporariamente bloqueado. Tente novamente em ${status.remainingSeconds} segundos.`,
          requestId: req.requestId,
        },
      });
    }

    next();
  };
}
