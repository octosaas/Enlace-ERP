/**
 * Enlace ERP - Receivables, Collections & Payments Repository
 * PRD PARTE 06: Cobrança e Contas a Receber Desacopladas (Receivable -> Collection -> Payment)
 */

import {
  Receivable,
  Collection,
  PaymentRecord,
  PaymentProviderConfig,
  WebhookEventRecord,
} from '../../../shared/types.js';
import { PostgresService } from '../postgres.js';

export interface IReceivableRepository {
  listReceivables(cleanCnpj: string, filter?: { status?: string; customerId?: string }): Promise<Receivable[]>;
  findReceivableById(cleanCnpj: string, id: string): Promise<Receivable | undefined>;
  createReceivable(cleanCnpj: string, receivable: Receivable): Promise<Receivable>;
  updateReceivable(cleanCnpj: string, id: string, receivable: Partial<Receivable>): Promise<Receivable | undefined>;

  listCollections(cleanCnpj: string, receivableId?: string): Promise<Collection[]>;
  findCollectionById(cleanCnpj: string, id: string): Promise<Collection | undefined>;
  createCollection(cleanCnpj: string, collection: Collection): Promise<Collection>;
  updateCollection(cleanCnpj: string, id: string, collection: Partial<Collection>): Promise<Collection | undefined>;

  listPayments(cleanCnpj: string, receivableId?: string): Promise<PaymentRecord[]>;
  recordPaymentTransaction(
    cleanCnpj: string,
    payment: PaymentRecord,
    collectionId: string,
    receivableId: string
  ): Promise<PaymentRecord>;

  saveWebhookEvent(cleanCnpj: string, event: WebhookEventRecord): Promise<WebhookEventRecord>;
  findWebhookEventByHash(cleanCnpj: string, hash: string): Promise<WebhookEventRecord | undefined>;

  listPaymentProviders(cleanCnpj: string): Promise<PaymentProviderConfig[]>;
  savePaymentProvider(cleanCnpj: string, provider: PaymentProviderConfig): Promise<PaymentProviderConfig>;
}

export class PostgresReceivableRepository implements IReceivableRepository {
  async listReceivables(
    cleanCnpj: string,
    filter?: { status?: string; customerId?: string }
  ): Promise<Receivable[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".receivables_v2 WHERE 1=1`;
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

      query += ' ORDER BY due_date ASC';
      const res = await client.query(query, values);
      return res.rows.map((r) => this.mapReceivableRow(r));
    });
  }

  async findReceivableById(cleanCnpj: string, id: string): Promise<Receivable | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".receivables_v2 WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapReceivableRow(res.rows[0]);
    });
  }

  async createReceivable(cleanCnpj: string, rec: Receivable): Promise<Receivable> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `INSERT INTO "${schemaName}".receivables_v2 (
          id, instance_id, code, contract_id, billing_id, customer_id, customer_name,
          customer_document, original_amount, balance_amount, due_date, status,
          interest_rate_monthly, penalty_rate_percent, notes, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17
        ) RETURNING *`,
        [
          rec.id && rec.id.includes('-') && rec.id.length >= 32 ? rec.id : null,
          rec.instanceId,
          rec.id,
          null,
          rec.billingId || null,
          rec.customerId,
          rec.customerName,
          rec.customerDocument,
          rec.originalAmount,
          rec.remainingAmount,
          rec.dueDate,
          rec.status || 'OPEN',
          rec.interestValue || 1.0,
          rec.fineValue || 2.0,
          rec.description || null,
          rec.createdAt || new Date().toISOString(),
          rec.updatedAt || new Date().toISOString(),
        ]
      );
      return this.mapReceivableRow(res.rows[0], rec);
    });
  }

  async updateReceivable(
    cleanCnpj: string,
    id: string,
    rec: Partial<Receivable>
  ): Promise<Receivable | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (rec.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(rec.status);
      }
      if (rec.remainingAmount !== undefined) {
        fields.push(`balance_amount = $${idx++}`);
        values.push(rec.remainingAmount);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE "${schemaName}".receivables_v2 SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) return undefined;
      return this.mapReceivableRow(res.rows[0]);
    });
  }

  async listCollections(cleanCnpj: string, receivableId?: string): Promise<Collection[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".collections_v2`;
      const values: any[] = [];
      if (receivableId) {
        query += ' WHERE receivable_id = $1';
        values.push(receivableId);
      }
      query += ' ORDER BY created_at DESC';
      const res = await client.query(query, values);
      return res.rows.map((r) => this.mapCollectionRow(r));
    });
  }

  async findCollectionById(cleanCnpj: string, id: string): Promise<Collection | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".collections_v2 WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapCollectionRow(res.rows[0]);
    });
  }

  async createCollection(cleanCnpj: string, col: Collection): Promise<Collection> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `INSERT INTO "${schemaName}".collections_v2 (
          id, instance_id, receivable_id, method, provider, provider_transaction_id,
          status, amount, due_date, barcode, digitable_line, pix_copy_paste,
          qr_code_url, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15
        ) RETURNING *`,
        [
          col.id && col.id.includes('-') && col.id.length >= 32 ? col.id : null,
          col.instanceId,
          col.receivableId,
          col.method,
          col.providerType,
          col.externalId || null,
          col.status || 'PENDING',
          col.amount,
          col.dueDate,
          col.barcode || null,
          col.digitableLine || null,
          col.pixCode || null,
          col.paymentUrl || null,
          col.createdAt || new Date().toISOString(),
          col.updatedAt || new Date().toISOString(),
        ]
      );
      return this.mapCollectionRow(res.rows[0], col);
    });
  }

  async updateCollection(
    cleanCnpj: string,
    id: string,
    col: Partial<Collection>
  ): Promise<Collection | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (col.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(col.status);
      }
      if (col.status === 'PAID') {
        fields.push(`paid_at = NOW()`);
      }
      if (col.status === 'CANCELED') {
        fields.push(`canceled_at = NOW()`);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE "${schemaName}".collections_v2 SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) return undefined;
      return this.mapCollectionRow(res.rows[0]);
    });
  }

  async listPayments(cleanCnpj: string, receivableId?: string): Promise<PaymentRecord[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".payments_v2`;
      const values: any[] = [];
      if (receivableId) {
        query += ' WHERE receivable_id = $1';
        values.push(receivableId);
      }
      query += ' ORDER BY created_at DESC';
      const res = await client.query(query, values);
      return res.rows.map((r) => this.mapPaymentRow(r));
    });
  }

  async recordPaymentTransaction(
    cleanCnpj: string,
    payment: PaymentRecord,
    collectionId: string,
    receivableId: string
  ): Promise<PaymentRecord> {
    return PostgresService.withTenantTransaction(cleanCnpj, async (client, schemaName) => {
      // 1. Verifica duplicidade por hash de idempotência
      const existingPay = await client.query(
        `SELECT * FROM "${schemaName}".payments_v2 WHERE idempotency_hash = $1 LIMIT 1`,
        [payment.externalId || payment.id]
      );
      if (existingPay.rows.length > 0) {
        return this.mapPaymentRow(existingPay.rows[0]);
      }

      // 2. Trava e lê o Receivable
      const recRes = await client.query(
        `SELECT * FROM "${schemaName}".receivables_v2 WHERE id = $1 FOR UPDATE`,
        [receivableId]
      );
      if (recRes.rows.length === 0) {
        throw new Error('Título a receber não encontrado para baixa de pagamento.');
      }
      const recRow = recRes.rows[0];
      const currentBalance = Number(recRow.balance_amount);
      const newBalance = Math.max(0, currentBalance - payment.amount);
      const newStatus = newBalance <= 0.001 ? 'PAID' : 'PARTIALLY_PAID';

      // 3. Registra o pagamento
      const payRes = await client.query(
        `INSERT INTO "${schemaName}".payments_v2 (
          id, instance_id, collection_id, receivable_id, amount_paid,
          payment_date, channel, idempotency_hash, created_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, NOW()
        ) RETURNING *`,
        [
          payment.id && payment.id.includes('-') && payment.id.length >= 32 ? payment.id : null,
          payment.instanceId,
          collectionId,
          receivableId,
          payment.amount,
          payment.paymentDate,
          payment.method,
          payment.externalId || payment.id,
        ]
      );

      // 4. Atualiza o saldo do Receivable
      await client.query(
        `UPDATE "${schemaName}".receivables_v2
         SET balance_amount = $1, status = $2, updated_at = NOW()
         WHERE id = $3`,
        [newBalance, newStatus, receivableId]
      );

      // 5. Atualiza o status da Collection para PAID
      await client.query(
        `UPDATE "${schemaName}".collections_v2
         SET status = 'PAID', paid_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [collectionId]
      );

      return this.mapPaymentRow(payRes.rows[0], payment);
    });
  }

  async saveWebhookEvent(cleanCnpj: string, event: WebhookEventRecord): Promise<WebhookEventRecord> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `INSERT INTO "${schemaName}".webhook_events_v2 (
          id, instance_id, provider, event_hash, event_type, payload,
          status, received_at, processed_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9
        ) ON CONFLICT (event_hash) DO UPDATE
          SET status = EXCLUDED.status, processed_at = EXCLUDED.processed_at
        RETURNING *`,
        [
          event.id && event.id.includes('-') && event.id.length >= 32 ? event.id : null,
          event.instanceId,
          event.provider,
          event.payloadHash || event.externalEventId,
          event.event,
          JSON.stringify(event.payload),
          event.status,
          event.receivedAt || new Date().toISOString(),
          event.processedAt || new Date().toISOString(),
        ]
      );
      const r = res.rows[0];
      return {
        id: r.id,
        instanceId: r.instance_id,
        provider: r.provider,
        externalEventId: r.event_hash,
        payloadHash: r.event_hash,
        event: r.event_type,
        payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
        receivedAt: r.received_at.toISOString(),
        processedAt: r.processed_at ? r.processed_at.toISOString() : undefined,
        status: r.status,
      };
    });
  }

  async findWebhookEventByHash(cleanCnpj: string, hash: string): Promise<WebhookEventRecord | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".webhook_events_v2 WHERE event_hash = $1 LIMIT 1`,
        [hash]
      );
      if (res.rows.length === 0) return undefined;
      const r = res.rows[0];
      return {
        id: r.id,
        instanceId: r.instance_id,
        provider: r.provider,
        externalEventId: r.event_hash,
        payloadHash: r.event_hash,
        event: r.event_type,
        payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
        receivedAt: r.received_at.toISOString(),
        processedAt: r.processed_at ? r.processed_at.toISOString() : undefined,
        status: r.status,
      };
    });
  }

  async listPaymentProviders(cleanCnpj: string): Promise<PaymentProviderConfig[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`SELECT * FROM "${schemaName}".payment_providers_v2 ORDER BY name ASC`);
      return res.rows.map((r) => this.mapProviderRow(r));
    });
  }

  async savePaymentProvider(cleanCnpj: string, provider: PaymentProviderConfig): Promise<PaymentProviderConfig> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const credsJson = JSON.stringify(provider.credentials || {});
      const methodsJson = JSON.stringify(provider.supportedMethods || ['PIX', 'BOLETO']);
      const res = await client.query(
        `INSERT INTO "${schemaName}".payment_providers_v2 (
          id, instance_id, provider, name, status, environment,
          encrypted_credentials, supported_methods, is_default, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        ) RETURNING *`,
        [
          provider.id && provider.id.includes('-') && provider.id.length >= 32 ? provider.id : null,
          provider.instanceId,
          provider.providerType,
          provider.name,
          provider.isActive ? 'ACTIVE' : 'INACTIVE',
          provider.environment || 'SANDBOX',
          credsJson,
          methodsJson,
          provider.isDefault || false,
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );
      return this.mapProviderRow(res.rows[0], provider);
    });
  }

  private mapReceivableRow(row: any, fallback?: Receivable): Receivable {
    return {
      id: row.id,
      instanceId: row.instance_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerDocument: row.customer_document,
      billingId: row.billing_id || undefined,
      status: row.status,
      description: row.notes || 'Título Financeiro',
      originalAmount: Number(row.original_amount) || 0,
      paidAmount: (Number(row.original_amount) || 0) - (Number(row.balance_amount) || 0),
      remainingAmount: Number(row.balance_amount) || 0,
      discountAmount: Number(row.discount_amount) || 0,
      interestAmount: 0,
      fineAmount: 0,
      currentAmount: Number(row.balance_amount) || 0,
      issueDate: fallback?.issueDate || new Date().toISOString().split('T')[0],
      dueDate: row.due_date,
      installments: fallback?.installments || [],
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
    };
  }

  private mapCollectionRow(row: any, fallback?: Collection): Collection {
    return {
      id: row.id,
      instanceId: row.instance_id,
      receivableId: row.receivable_id,
      providerId: fallback?.providerId || 'prov-001',
      providerType: row.provider,
      externalId: row.provider_transaction_id || row.id,
      method: row.method,
      status: row.status,
      amount: Number(row.amount) || 0,
      dueDate: row.due_date,
      pixCode: row.pix_copy_paste || undefined,
      barcode: row.barcode || undefined,
      digitableLine: row.digitable_line || undefined,
      paymentUrl: row.qr_code_url || undefined,
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
    };
  }

  private mapPaymentRow(row: any, fallback?: PaymentRecord): PaymentRecord {
    return {
      id: row.id,
      instanceId: row.instance_id,
      receivableId: row.receivable_id,
      collectionId: row.collection_id,
      amount: Number(row.amount_paid) || 0,
      paymentDate: row.payment_date,
      method: row.channel,
      externalId: row.idempotency_hash,
      status: 'CONFIRMED',
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
    };
  }

  private mapProviderRow(row: any, fallback?: PaymentProviderConfig): PaymentProviderConfig {
    const creds =
      typeof row.encrypted_credentials === 'string'
        ? JSON.parse(row.encrypted_credentials)
        : row.encrypted_credentials || {};
    const methods =
      typeof row.supported_methods === 'string'
        ? JSON.parse(row.supported_methods)
        : row.supported_methods || ['PIX', 'BOLETO'];

    return {
      id: row.id,
      instanceId: row.instance_id,
      name: row.name,
      providerType: row.provider as any,
      environment: row.environment as any,
      isActive: row.status === 'ACTIVE',
      isDefault: row.is_default,
      supportedMethods: methods,
      credentials: creds,
      maskedCredentials: fallback?.maskedCredentials || {},
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
    };
  }
}

export class InMemoryReceivableRepository implements IReceivableRepository {
  constructor(
    private getReceivables: (cleanCnpj: string) => Receivable[],
    private getCollections: (cleanCnpj: string) => Collection[],
    private getPayments: (cleanCnpj: string) => PaymentRecord[],
    private getProviders: (cleanCnpj: string) => PaymentProviderConfig[],
    private getWebhooks: (cleanCnpj: string) => WebhookEventRecord[]
  ) {}

  async listReceivables(
    cleanCnpj: string,
    filter?: { status?: string; customerId?: string }
  ): Promise<Receivable[]> {
    let list = this.getReceivables(cleanCnpj);
    if (filter?.status) list = list.filter((r) => r.status === filter.status);
    if (filter?.customerId) list = list.filter((r) => r.customerId === filter.customerId);
    return list;
  }

  async findReceivableById(cleanCnpj: string, id: string): Promise<Receivable | undefined> {
    return this.getReceivables(cleanCnpj).find((r) => r.id === id);
  }

  async createReceivable(cleanCnpj: string, receivable: Receivable): Promise<Receivable> {
    const list = this.getReceivables(cleanCnpj);
    if (!list.some((r) => r.id === receivable.id)) {
      list.push(receivable);
    }
    return receivable;
  }

  async updateReceivable(
    cleanCnpj: string,
    id: string,
    receivable: Partial<Receivable>
  ): Promise<Receivable | undefined> {
    const list = this.getReceivables(cleanCnpj);
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return undefined;
    list[index] = { ...list[index], ...receivable, updatedAt: new Date().toISOString() };
    return list[index];
  }

  async listCollections(cleanCnpj: string, receivableId?: string): Promise<Collection[]> {
    let list = this.getCollections(cleanCnpj);
    if (receivableId) list = list.filter((c) => c.receivableId === receivableId);
    return list;
  }

  async findCollectionById(cleanCnpj: string, id: string): Promise<Collection | undefined> {
    return this.getCollections(cleanCnpj).find((c) => c.id === id);
  }

  async createCollection(cleanCnpj: string, collection: Collection): Promise<Collection> {
    const list = this.getCollections(cleanCnpj);
    list.push(collection);
    return collection;
  }

  async updateCollection(
    cleanCnpj: string,
    id: string,
    collection: Partial<Collection>
  ): Promise<Collection | undefined> {
    const list = this.getCollections(cleanCnpj);
    const index = list.findIndex((c) => c.id === id);
    if (index === -1) return undefined;
    list[index] = { ...list[index], ...collection, updatedAt: new Date().toISOString() };
    return list[index];
  }

  async listPayments(cleanCnpj: string, receivableId?: string): Promise<PaymentRecord[]> {
    let list = this.getPayments(cleanCnpj);
    if (receivableId) list = list.filter((p) => p.receivableId === receivableId);
    return list;
  }

  async recordPaymentTransaction(
    cleanCnpj: string,
    payment: PaymentRecord,
    collectionId: string,
    receivableId: string
  ): Promise<PaymentRecord> {
    const payments = this.getPayments(cleanCnpj);
    const existing = payments.find((p) => p.externalId === (payment.externalId || payment.id));
    if (existing) return existing;

    const receivables = this.getReceivables(cleanCnpj);
    const rec = receivables.find((r) => r.id === receivableId);
    if (!rec) throw new Error('Título a receber não encontrado.');

    payments.push(payment);
    rec.remainingAmount = Math.max(0, rec.remainingAmount - payment.amount);
    rec.paidAmount = rec.originalAmount - rec.remainingAmount;
    rec.status = rec.remainingAmount <= 0.001 ? 'PAID' : 'PARTIALLY_PAID';
    rec.updatedAt = new Date().toISOString();

    const collections = this.getCollections(cleanCnpj);
    const col = collections.find((c) => c.id === collectionId);
    if (col) {
      col.status = 'PAID';
      col.updatedAt = new Date().toISOString();
    }

    return payment;
  }

  async saveWebhookEvent(cleanCnpj: string, event: WebhookEventRecord): Promise<WebhookEventRecord> {
    const webhooks = this.getWebhooks(cleanCnpj);
    const existingIdx = webhooks.findIndex((w) => w.payloadHash === event.payloadHash);
    if (existingIdx !== -1) {
      webhooks[existingIdx] = { ...webhooks[existingIdx], ...event };
      return webhooks[existingIdx];
    }
    webhooks.push(event);
    return event;
  }

  async findWebhookEventByHash(cleanCnpj: string, hash: string): Promise<WebhookEventRecord | undefined> {
    return this.getWebhooks(cleanCnpj).find((w) => w.payloadHash === hash);
  }

  async listPaymentProviders(cleanCnpj: string): Promise<PaymentProviderConfig[]> {
    return this.getProviders(cleanCnpj);
  }

  async savePaymentProvider(cleanCnpj: string, provider: PaymentProviderConfig): Promise<PaymentProviderConfig> {
    const providers = this.getProviders(cleanCnpj);
    const index = providers.findIndex((p) => p.id === provider.id);
    if (index !== -1) {
      providers[index] = provider;
    } else {
      providers.push(provider);
    }
    return provider;
  }
}
