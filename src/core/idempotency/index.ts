/**
 * Enlace ERP - Infraestrutura de Idempotência
 * PRD 01 - Seção 20 (Proteção contra reprocessamento e duplicidades)
 */

interface IdempotencyRecord {
  key: string;
  companyId: string;
  statusCode: number;
  responseBody: unknown;
  createdAt: number;
}

class IdempotencyManager {
  private cache = new Map<string, IdempotencyRecord>();
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

  private buildKey(companyId: string, clientKey: string): string {
    return `${companyId}:${clientKey}`;
  }

  getRecord(companyId: string, clientKey: string): IdempotencyRecord | undefined {
    const fullKey = this.buildKey(companyId, clientKey);
    const record = this.cache.get(fullKey);
    if (!record) return undefined;

    if (Date.now() - record.createdAt > this.TTL_MS) {
      this.cache.delete(fullKey);
      return undefined;
    }

    return record;
  }

  saveRecord(companyId: string, clientKey: string, statusCode: number, responseBody: unknown) {
    const fullKey = this.buildKey(companyId, clientKey);
    this.cache.set(fullKey, {
      key: clientKey,
      companyId,
      statusCode,
      responseBody,
      createdAt: Date.now(),
    });
  }
}

export const idempotencyManager = new IdempotencyManager();
