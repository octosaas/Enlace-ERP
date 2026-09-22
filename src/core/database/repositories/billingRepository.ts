/**
 * Enlace ERP - Billing & Recurring Billing Repository
 * PRD PARTE 05: Faturamento, Competências e Contratos Recorrentes
 */

import { BillingDocument, RecurringBilling, BillingGenerationLog } from '../../../shared/types.js';
import { PostgresService } from '../postgres.js';

export interface IBillingRepository {
  listBilling(cleanCnpj: string, filter?: { status?: string; customerId?: string }): Promise<BillingDocument[]>;
  findBillingById(cleanCnpj: string, id: string): Promise<BillingDocument | undefined>;
  findBillingByNumber(cleanCnpj: string, number: string): Promise<BillingDocument | undefined>;
  createBilling(cleanCnpj: string, doc: BillingDocument): Promise<BillingDocument>;
  updateBilling(cleanCnpj: string, id: string, doc: Partial<BillingDocument>): Promise<BillingDocument | undefined>;

  listRecurring(cleanCnpj: string): Promise<RecurringBilling[]>;
  findRecurringById(cleanCnpj: string, id: string): Promise<RecurringBilling | undefined>;
  createRecurring(cleanCnpj: string, rec: RecurringBilling): Promise<RecurringBilling>;
  updateRecurring(cleanCnpj: string, id: string, rec: Partial<RecurringBilling>): Promise<RecurringBilling | undefined>;

  logGeneration(cleanCnpj: string, log: BillingGenerationLog): Promise<void>;
  listGenerationLogs(cleanCnpj: string, recurringBillingId?: string): Promise<BillingGenerationLog[]>;
}

export class PostgresBillingRepository implements IBillingRepository {
  async listBilling(
    cleanCnpj: string,
    filter?: { status?: string; customerId?: string }
  ): Promise<BillingDocument[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".billing WHERE 1=1`;
      const values: any[] = [];
      let idx = 1;

      if (filter?.status) {
        query += ` AND status = $${idx++}`;
        values.push(filter.status);
      }
      if (filter?.customerId) {
        query += ` AND customer_id = $${idx++}`;
        values.push(filter.customerId);
      }

      query += ' ORDER BY created_at DESC';
      const res = await client.query(query, values);
      return res.rows.map((r) => this.mapBillingRow(r));
    });
  }

  async findBillingById(cleanCnpj: string, id: string): Promise<BillingDocument | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`SELECT * FROM "${schemaName}".billing WHERE id = $1 LIMIT 1`, [id]);
      if (res.rows.length === 0) return undefined;
      return this.mapBillingRow(res.rows[0]);
    });
  }

  async findBillingByNumber(cleanCnpj: string, number: string): Promise<BillingDocument | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`SELECT * FROM "${schemaName}".billing WHERE number = $1 LIMIT 1`, [number]);
      if (res.rows.length === 0) return undefined;
      return this.mapBillingRow(res.rows[0]);
    });
  }

  async createBilling(cleanCnpj: string, doc: BillingDocument): Promise<BillingDocument> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `INSERT INTO "${schemaName}".billing (
          id, instance_id, customer_id, customer_name, customer_document,
          number, status, source_type, source_id, source_number, recurring_billing_id,
          issue_date, competence_start, competence_end, competence_label, due_date,
          subtotal, discount, surcharge, total, description, notes, created_by,
          created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
        ) RETURNING *`,
        [
          doc.id && doc.id.includes('-') && doc.id.length >= 32 ? doc.id : null,
          doc.instanceId,
          doc.customerId,
          doc.customerName,
          doc.customerDocument || null,
          doc.number,
          doc.status || 'DRAFT',
          doc.sourceType || 'MANUAL',
          doc.sourceId || null,
          doc.sourceNumber || null,
          doc.recurringBillingId || null,
          doc.issueDate,
          doc.competenceStart,
          doc.competenceEnd,
          doc.competenceLabel,
          doc.dueDate,
          doc.subtotal || doc.total,
          doc.discount || 0,
          doc.surcharge || 0,
          doc.total,
          doc.description || null,
          doc.notes || null,
          doc.createdBy || 'system',
          doc.createdAt || new Date().toISOString(),
          doc.updatedAt || new Date().toISOString(),
        ]
      );
      return this.mapBillingRow(res.rows[0], doc);
    });
  }

  async updateBilling(
    cleanCnpj: string,
    id: string,
    doc: Partial<BillingDocument>
  ): Promise<BillingDocument | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (doc.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(doc.status);
      }
      if (doc.issuedAt !== undefined) {
        fields.push(`issued_at = $${idx++}`);
        values.push(doc.issuedAt);
      }
      if (doc.issuedBy !== undefined) {
        fields.push(`issued_by = $${idx++}`);
        values.push(doc.issuedBy);
      }
      if (doc.canceledAt !== undefined) {
        fields.push(`canceled_at = $${idx++}`);
        values.push(doc.canceledAt);
      }
      if (doc.cancellationReason !== undefined) {
        fields.push(`cancellation_reason = $${idx++}`);
        values.push(doc.cancellationReason);
      }
      if (doc.collectionId !== undefined) {
        fields.push(`collection_id = $${idx++}`);
        values.push(doc.collectionId);
      }
      if (doc.fiscalDocumentId !== undefined) {
        fields.push(`fiscal_document_id = $${idx++}`);
        values.push(doc.fiscalDocumentId);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE "${schemaName}".billing SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) return undefined;
      return this.mapBillingRow(res.rows[0]);
    });
  }

  async listRecurring(cleanCnpj: string): Promise<RecurringBilling[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`SELECT * FROM "${schemaName}".recurring_billing ORDER BY created_at DESC`);
      return res.rows.map((r) => this.mapRecurringRow(r));
    });
  }

  async findRecurringById(cleanCnpj: string, id: string): Promise<RecurringBilling | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".recurring_billing WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapRecurringRow(res.rows[0]);
    });
  }

  async createRecurring(cleanCnpj: string, rec: RecurringBilling): Promise<RecurringBilling> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const itemsJson = JSON.stringify(rec.items || []);
      const res = await client.query(
        `INSERT INTO "${schemaName}".recurring_billing (
          id, instance_id, customer_id, customer_name, customer_document,
          contract_id, contract_number, status, frequency, custom_interval_months,
          start_date, end_date, next_billing_date, day_of_month, due_rule,
          due_days, amount, description, items, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        ) RETURNING *`,
        [
          rec.id && rec.id.includes('-') && rec.id.length >= 32 ? rec.id : null,
          rec.instanceId,
          rec.customerId,
          rec.customerName,
          rec.customerDocument || null,
          rec.contractId || null,
          rec.contractNumber || null,
          rec.status || 'ACTIVE',
          rec.frequency || 'MONTHLY',
          rec.customIntervalMonths ? String(rec.customIntervalMonths) : null,
          rec.startDate,
          rec.endDate || null,
          rec.nextBillingDate,
          rec.dayOfMonth || 10,
          rec.dueRule || 'FIXED_DAY',
          rec.dueDays || 10,
          rec.amount,
          rec.description,
          itemsJson,
          rec.createdAt || new Date().toISOString(),
          rec.updatedAt || new Date().toISOString(),
        ]
      );
      return this.mapRecurringRow(res.rows[0], rec);
    });
  }

  async updateRecurring(
    cleanCnpj: string,
    id: string,
    rec: Partial<RecurringBilling>
  ): Promise<RecurringBilling | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (rec.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(rec.status);
      }
      if (rec.nextBillingDate !== undefined) {
        fields.push(`next_billing_date = $${idx++}`);
        values.push(rec.nextBillingDate);
      }
      if (rec.lastGeneratedCompetence !== undefined) {
        fields.push(`last_generated_competence = $${idx++}`);
        values.push(rec.lastGeneratedCompetence);
      }
      if (rec.lastGeneratedBillingId !== undefined) {
        fields.push(`last_generated_billing_id = $${idx++}`);
        values.push(rec.lastGeneratedBillingId);
      }
      if (rec.lastGeneratedBillingNumber !== undefined) {
        fields.push(`last_generated_billing_number = $${idx++}`);
        values.push(rec.lastGeneratedBillingNumber);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE "${schemaName}".recurring_billing SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) return undefined;
      return this.mapRecurringRow(res.rows[0]);
    });
  }

  async logGeneration(cleanCnpj: string, log: BillingGenerationLog): Promise<void> {
    await PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      await client.query(
        `INSERT INTO "${schemaName}".billing_generation_logs (
          id, instance_id, recurring_billing_id, competence_start, competence_end,
          competence_label, billing_id, billing_number, status, attempt_count,
          error_code, error_message, executed_at, worker_id
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14
        )`,
        [
          log.id && log.id.includes('-') && log.id.length >= 32 ? log.id : null,
          log.instanceId,
          log.recurringBillingId,
          log.competenceStart,
          log.competenceEnd,
          log.competenceLabel,
          log.billingId || null,
          log.billingNumber || null,
          log.status,
          log.attemptCount || 1,
          log.errorCode || null,
          log.errorMessage || null,
          log.executedAt || new Date().toISOString(),
          log.workerId || null,
        ]
      );
    });
  }

  async listGenerationLogs(cleanCnpj: string, recurringBillingId?: string): Promise<BillingGenerationLog[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".billing_generation_logs`;
      const values: any[] = [];
      if (recurringBillingId) {
        query += ' WHERE recurring_billing_id = $1';
        values.push(recurringBillingId);
      }
      query += ' ORDER BY executed_at DESC';
      const res = await client.query(query, values);
      return res.rows.map((r) => ({
        id: r.id,
        instanceId: r.instance_id,
        recurringBillingId: r.recurring_billing_id,
        competenceStart: r.competence_start,
        competenceEnd: r.competence_end,
        competenceLabel: r.competence_label,
        billingId: r.billing_id || undefined,
        billingNumber: r.billing_number || undefined,
        status: r.status,
        attemptCount: r.attempt_count,
        errorCode: r.error_code || undefined,
        errorMessage: r.error_message || undefined,
        executedAt: r.executed_at ? r.executed_at.toISOString() : new Date().toISOString(),
        workerId: r.worker_id || undefined,
      }));
    });
  }

  private mapBillingRow(row: any, fallback?: BillingDocument): BillingDocument {
    return {
      id: row.id,
      instanceId: row.instance_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerDocument: row.customer_document || undefined,
      number: row.number,
      status: row.status,
      sourceType: row.source_type,
      sourceId: row.source_id || undefined,
      sourceNumber: row.source_number || undefined,
      recurringBillingId: row.recurring_billing_id || undefined,
      issueDate: row.issue_date,
      competenceStart: row.competence_start,
      competenceEnd: row.competence_end,
      competenceLabel: row.competence_label,
      dueDate: row.due_date,
      subtotal: Number(row.subtotal) || 0,
      discount: Number(row.discount) || 0,
      surcharge: Number(row.surcharge) || 0,
      total: Number(row.total) || 0,
      items: fallback?.items || [],
      description: row.description || undefined,
      notes: row.notes || undefined,
      internalNotes: row.internal_notes || undefined,
      cancellationReason: row.cancellation_reason || undefined,
      canceledAt: row.canceled_at ? row.canceled_at.toISOString() : undefined,
      canceledBy: row.canceled_by || undefined,
      issuedAt: row.issued_at ? row.issued_at.toISOString() : undefined,
      issuedBy: row.issued_by || undefined,
      createdBy: row.created_by,
      updatedBy: row.updated_by || undefined,
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
      collectionId: row.collection_id || undefined,
      fiscalDocumentId: row.fiscal_document_id || undefined,
    };
  }

  private mapRecurringRow(row: any, fallback?: RecurringBilling): RecurringBilling {
    const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items || [];
    return {
      id: row.id,
      instanceId: row.instance_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerDocument: row.customer_document || undefined,
      contractId: row.contract_id || undefined,
      contractNumber: row.contract_number || undefined,
      status: row.status,
      frequency: row.frequency,
      customIntervalMonths: row.custom_interval_months ? Number(row.custom_interval_months) : undefined,
      startDate: row.start_date,
      endDate: row.end_date || undefined,
      nextBillingDate: row.next_billing_date,
      dayOfMonth: row.day_of_month,
      dueRule: row.due_rule,
      dueDays: row.due_days,
      amount: Number(row.amount) || 0,
      description: row.description,
      items,
      lastGeneratedCompetence: row.last_generated_competence || undefined,
      lastGeneratedAt: row.last_generated_at ? row.last_generated_at.toISOString() : undefined,
      lastGeneratedBillingId: row.last_generated_billing_id || undefined,
      lastGeneratedBillingNumber: row.last_generated_billing_number || undefined,
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
    };
  }
}

export class InMemoryBillingRepository implements IBillingRepository {
  constructor(
    private getBillingDocs: (cleanCnpj: string) => BillingDocument[],
    private getRecurringDocs: (cleanCnpj: string) => RecurringBilling[],
    private getLogs: (cleanCnpj: string) => BillingGenerationLog[]
  ) {}

  async listBilling(
    cleanCnpj: string,
    filter?: { status?: string; customerId?: string }
  ): Promise<BillingDocument[]> {
    let list = this.getBillingDocs(cleanCnpj);
    if (filter?.status) list = list.filter((b) => b.status === filter.status);
    if (filter?.customerId) list = list.filter((b) => b.customerId === filter.customerId);
    return list;
  }

  async findBillingById(cleanCnpj: string, id: string): Promise<BillingDocument | undefined> {
    return this.getBillingDocs(cleanCnpj).find((b) => b.id === id);
  }

  async findBillingByNumber(cleanCnpj: string, number: string): Promise<BillingDocument | undefined> {
    return this.getBillingDocs(cleanCnpj).find((b) => b.number === number);
  }

  async createBilling(cleanCnpj: string, doc: BillingDocument): Promise<BillingDocument> {
    const list = this.getBillingDocs(cleanCnpj);
    if (!list.some((b) => b.id === doc.id)) {
      list.push(doc);
    }
    return doc;
  }

  async updateBilling(
    cleanCnpj: string,
    id: string,
    doc: Partial<BillingDocument>
  ): Promise<BillingDocument | undefined> {
    const list = this.getBillingDocs(cleanCnpj);
    const index = list.findIndex((b) => b.id === id);
    if (index === -1) return undefined;
    list[index] = { ...list[index], ...doc, updatedAt: new Date().toISOString() };
    return list[index];
  }

  async listRecurring(cleanCnpj: string): Promise<RecurringBilling[]> {
    return this.getRecurringDocs(cleanCnpj);
  }

  async findRecurringById(cleanCnpj: string, id: string): Promise<RecurringBilling | undefined> {
    return this.getRecurringDocs(cleanCnpj).find((r) => r.id === id);
  }

  async createRecurring(cleanCnpj: string, rec: RecurringBilling): Promise<RecurringBilling> {
    const list = this.getRecurringDocs(cleanCnpj);
    if (!list.some((r) => r.id === rec.id)) {
      list.push(rec);
    }
    return rec;
  }

  async updateRecurring(
    cleanCnpj: string,
    id: string,
    rec: Partial<RecurringBilling>
  ): Promise<RecurringBilling | undefined> {
    const list = this.getRecurringDocs(cleanCnpj);
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return undefined;
    list[index] = { ...list[index], ...rec, updatedAt: new Date().toISOString() };
    return list[index];
  }

  async logGeneration(cleanCnpj: string, log: BillingGenerationLog): Promise<void> {
    const list = this.getLogs(cleanCnpj);
    list.push(log);
  }

  async listGenerationLogs(cleanCnpj: string, recurringBillingId?: string): Promise<BillingGenerationLog[]> {
    const list = this.getLogs(cleanCnpj);
    if (recurringBillingId) return list.filter((l) => l.recurringBillingId === recurringBillingId);
    return list;
  }
}
