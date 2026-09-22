/**
 * Enlace ERP - Audit & Security Event Repository
 * PRD 01 & PRD 02: Trilha de Auditoria Imutável e Registro de Incidentes de Segurança
 */

import { AuditLogEntry, SecurityEvent } from '../../../shared/types.js';
import { PostgresService } from '../postgres.js';

export interface IAuditRepository {
  recordTenantAudit(cleanCnpj: string, log: AuditLogEntry): Promise<void>;
  listTenantAudits(cleanCnpj: string, limit?: number): Promise<AuditLogEntry[]>;

  recordSecurityEvent(event: SecurityEvent): Promise<void>;
  listSecurityEvents(companyId?: string, limit?: number): Promise<SecurityEvent[]>;
}

export class PostgresAuditRepository implements IAuditRepository {
  async recordTenantAudit(cleanCnpj: string, log: AuditLogEntry): Promise<void> {
    await PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      await client.query(
        `INSERT INTO "${schemaName}".audit_logs (
          id, timestamp, user_id, user_email, action, resource, resource_id,
          status, ip_address, user_agent, request_id, details
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )`,
        [
          log.id && log.id.includes('-') && log.id.length >= 32 ? log.id : null,
          log.timestamp || new Date().toISOString(),
          log.userId || null,
          log.userEmail || null,
          log.action,
          log.resource,
          log.resourceId || null,
          log.status,
          log.ipAddress || null,
          log.userAgent || null,
          log.requestId,
          JSON.stringify(log.details || {}),
        ]
      );
    });
  }

  async listTenantAudits(cleanCnpj: string, limit = 100): Promise<AuditLogEntry[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".audit_logs ORDER BY timestamp DESC LIMIT $1`,
        [limit]
      );
      return res.rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp.toISOString(),
        userId: r.user_id || null,
        userEmail: r.user_email || null,
        companyId: null,
        companyCnpj: cleanCnpj,
        action: r.action,
        resource: r.resource,
        resourceId: r.resource_id || undefined,
        status: r.status,
        ipAddress: r.ip_address || undefined,
        userAgent: r.user_agent || undefined,
        requestId: r.request_id,
        details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details || {},
      }));
    });
  }

  async recordSecurityEvent(event: SecurityEvent): Promise<void> {
    await PostgresService.withControlPlaneClient(async (client) => {
      await client.query(
        `INSERT INTO cp_security_events (
          id, type, severity, user_id, user_email, company_id,
          schema_namespace, request_id, details, mitigation_taken, created_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )`,
        [
          event.id && event.id.includes('-') && event.id.length >= 32 ? event.id : null,
          event.type,
          event.severity,
          event.userId || null,
          event.userEmail || null,
          event.companyId || null,
          event.schemaNamespace || null,
          event.requestId,
          JSON.stringify(event.details || {}),
          event.mitigationTaken || '',
          event.timestamp || new Date().toISOString(),
        ]
      );
    });
  }

  async listSecurityEvents(companyId?: string, limit = 100): Promise<SecurityEvent[]> {
    return PostgresService.withControlPlaneClient(async (client) => {
      let query = 'SELECT * FROM cp_security_events';
      const values: any[] = [];
      if (companyId) {
        query += ' WHERE company_id = $1';
        values.push(companyId);
      }
      query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
      values.push(limit);

      const res = await client.query(query, values);
      return res.rows.map((r) => ({
        id: r.id,
        timestamp: r.created_at.toISOString(),
        type: r.type,
        severity: r.severity,
        userId: r.user_id || undefined,
        userEmail: r.user_email || undefined,
        companyId: r.company_id || undefined,
        schemaNamespace: r.schema_namespace || undefined,
        ipAddress: undefined,
        userAgent: undefined,
        requestId: r.request_id,
        details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details || {},
        mitigationTaken: r.mitigation_taken || '',
      }));
    });
  }
}

export class InMemoryAuditRepository implements IAuditRepository {
  constructor(
    private getTenantLogs: (cleanCnpj: string) => AuditLogEntry[],
    private securityEvents: SecurityEvent[]
  ) {}

  async recordTenantAudit(cleanCnpj: string, log: AuditLogEntry): Promise<void> {
    const list = this.getTenantLogs(cleanCnpj);
    list.unshift(log);
  }

  async listTenantAudits(cleanCnpj: string, limit = 100): Promise<AuditLogEntry[]> {
    return this.getTenantLogs(cleanCnpj).slice(0, limit);
  }

  async recordSecurityEvent(event: SecurityEvent): Promise<void> {
    this.securityEvents.unshift(event);
  }

  async listSecurityEvents(companyId?: string, limit = 100): Promise<SecurityEvent[]> {
    let list = this.securityEvents;
    if (companyId) {
      list = list.filter((e) => e.companyId === companyId);
    }
    return list.slice(0, limit);
  }
}
