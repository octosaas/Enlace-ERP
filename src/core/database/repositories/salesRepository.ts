/**
 * Enlace ERP - Quotes & Sales Repository
 * PRD 04: Comercial & Faturamento - Orçamentos, Vendas e Conversão com Idempotência
 */

import { Quote, Sale, SaleItem, ServiceOrder, Contract } from '../../../shared/types.js';
import { PostgresService } from '../postgres.js';

export interface ISalesRepository {
  listQuotes(cleanCnpj: string, filter?: { status?: string; customerId?: string }): Promise<Quote[]>;
  findQuoteById(cleanCnpj: string, id: string): Promise<Quote | undefined>;
  findQuoteByNumber(cleanCnpj: string, number: string): Promise<Quote | undefined>;
  createQuote(cleanCnpj: string, quote: Quote): Promise<Quote>;
  updateQuote(cleanCnpj: string, id: string, quote: Partial<Quote>): Promise<Quote | undefined>;

  listSales(cleanCnpj: string, filter?: { status?: string; customerId?: string }): Promise<Sale[]>;
  findSaleById(cleanCnpj: string, id: string): Promise<Sale | undefined>;
  findSaleByNumber(cleanCnpj: string, number: string): Promise<Sale | undefined>;
  createSale(cleanCnpj: string, sale: Sale): Promise<Sale>;
  updateSale(cleanCnpj: string, id: string, sale: Partial<Sale>): Promise<Sale | undefined>;

  convertQuoteToSaleTransaction(
    cleanCnpj: string,
    quoteId: string,
    saleNumber: string,
    idempotencyKey?: string
  ): Promise<Sale>;

  listServiceOrders(cleanCnpj: string, filter?: { status?: string; partnerId?: string }): Promise<ServiceOrder[]>;
  findServiceOrderById(cleanCnpj: string, id: string): Promise<ServiceOrder | undefined>;
  createServiceOrder(cleanCnpj: string, order: ServiceOrder): Promise<ServiceOrder>;
  updateServiceOrder(cleanCnpj: string, id: string, updates: Partial<ServiceOrder>): Promise<ServiceOrder | undefined>;

  listContracts(cleanCnpj: string, filter?: { status?: string; partnerId?: string }): Promise<Contract[]>;
  findContractById(cleanCnpj: string, id: string): Promise<Contract | undefined>;
  createContract(cleanCnpj: string, contract: Contract): Promise<Contract>;
  updateContract(cleanCnpj: string, id: string, updates: Partial<Contract>): Promise<Contract | undefined>;
}

export class PostgresSalesRepository implements ISalesRepository {
  async listQuotes(
    cleanCnpj: string,
    filter?: { status?: string; customerId?: string }
  ): Promise<Quote[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".quotes WHERE 1=1`;
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
      return res.rows.map((r) => this.mapQuoteRow(r));
    });
  }

  async findQuoteById(cleanCnpj: string, id: string): Promise<Quote | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`SELECT * FROM "${schemaName}".quotes WHERE id = $1 LIMIT 1`, [id]);
      if (res.rows.length === 0) return undefined;
      return this.mapQuoteRow(res.rows[0]);
    });
  }

  async findQuoteByNumber(cleanCnpj: string, number: string): Promise<Quote | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".quotes WHERE quote_number = $1 LIMIT 1`,
        [number]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapQuoteRow(res.rows[0]);
    });
  }

  async createQuote(cleanCnpj: string, quote: Quote): Promise<Quote> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const itemsJson = JSON.stringify(quote.items || []);
      const res = await client.query(
        `INSERT INTO "${schemaName}".quotes (
          id, customer_id, customer_name, customer_document, quote_number,
          status, valid_until, subtotal, discount, total, notes, items,
          created_by, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        ) RETURNING *`,
        [
          quote.id && quote.id.includes('-') && quote.id.length >= 32 ? quote.id : null,
          quote.customerId,
          quote.customerName || null,
          quote.customerDocument || null,
          quote.number,
          quote.status || 'DRAFT',
          quote.validUntil || null,
          quote.subtotal || quote.total,
          quote.discount || 0,
          quote.total,
          quote.notes || null,
          itemsJson,
          quote.createdBy || 'system',
          quote.createdAt || new Date().toISOString(),
          quote.updatedAt || new Date().toISOString(),
        ]
      );
      return this.mapQuoteRow(res.rows[0], quote);
    });
  }

  async updateQuote(
    cleanCnpj: string,
    id: string,
    quote: Partial<Quote>
  ): Promise<Quote | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (quote.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(quote.status);
      }
      if (quote.convertedSaleId !== undefined) {
        fields.push(`converted_sale_id = $${idx++}`);
        values.push(quote.convertedSaleId);
      }
      if (quote.total !== undefined) {
        fields.push(`total = $${idx++}`);
        values.push(quote.total);
      }
      if (quote.items !== undefined) {
        fields.push(`items = $${idx++}`);
        values.push(JSON.stringify(quote.items));
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE "${schemaName}".quotes SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) return undefined;
      return this.mapQuoteRow(res.rows[0]);
    });
  }

  async listSales(
    cleanCnpj: string,
    filter?: { status?: string; customerId?: string }
  ): Promise<Sale[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".sales WHERE 1=1`;
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
      return res.rows.map((r) => this.mapSaleRow(r));
    });
  }

  async findSaleById(cleanCnpj: string, id: string): Promise<Sale | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`SELECT * FROM "${schemaName}".sales WHERE id = $1 LIMIT 1`, [id]);
      if (res.rows.length === 0) return undefined;
      return this.mapSaleRow(res.rows[0]);
    });
  }

  async findSaleByNumber(cleanCnpj: string, number: string): Promise<Sale | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".sales WHERE sale_number = $1 LIMIT 1`,
        [number]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapSaleRow(res.rows[0]);
    });
  }

  async createSale(cleanCnpj: string, sale: Sale): Promise<Sale> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const itemsJson = JSON.stringify(sale.items || []);
      const res = await client.query(
        `INSERT INTO "${schemaName}".sales (
          id, customer_id, customer_name, customer_document, sale_number,
          quote_id, status, issue_date, subtotal, discount, total, payment_conditions,
          notes, items, created_by, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) RETURNING *`,
        [
          sale.id && sale.id.includes('-') && sale.id.length >= 32 ? sale.id : null,
          sale.customerId,
          sale.customerName || null,
          sale.customerDocument || null,
          sale.number,
          sale.sourceId || null,
          sale.status || 'CONFIRMED',
          sale.saleDate || new Date().toISOString().split('T')[0],
          sale.subtotal || sale.total,
          sale.discount || 0,
          sale.total,
          null,
          sale.notes || null,
          itemsJson,
          sale.createdBy || 'system',
          sale.createdAt || new Date().toISOString(),
          sale.updatedAt || new Date().toISOString(),
        ]
      );
      return this.mapSaleRow(res.rows[0], sale);
    });
  }

  async updateSale(
    cleanCnpj: string,
    id: string,
    sale: Partial<Sale>
  ): Promise<Sale | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (sale.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(sale.status);
      }
      if (sale.total !== undefined) {
        fields.push(`total = $${idx++}`);
        values.push(sale.total);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE "${schemaName}".sales SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) return undefined;
      return this.mapSaleRow(res.rows[0]);
    });
  }

  async convertQuoteToSaleTransaction(
    cleanCnpj: string,
    quoteId: string,
    saleNumber: string,
    idempotencyKey?: string
  ): Promise<Sale> {
    return PostgresService.withTenantTransaction(cleanCnpj, async (client, schemaName) => {
      // 1. Trava e lê o Quote com FOR UPDATE para evitar concorrência/race conditions
      const quoteRes = await client.query(
        `SELECT * FROM "${schemaName}".quotes WHERE id = $1 FOR UPDATE`,
        [quoteId]
      );
      if (quoteRes.rows.length === 0) {
        throw new Error(`Orçamento com ID ${quoteId} não encontrado.`);
      }

      const quoteRow = quoteRes.rows[0];

      // Idempotência: se já convertido, retorna a venda já existente
      if (quoteRow.status === 'CONVERTED' && quoteRow.converted_sale_id) {
        const existingSaleRes = await client.query(
          `SELECT * FROM "${schemaName}".sales WHERE id = $1 LIMIT 1`,
          [quoteRow.converted_sale_id]
        );
        if (existingSaleRes.rows.length > 0) {
          return this.mapSaleRow(existingSaleRes.rows[0]);
        }
      }

      // 2. Cria a nova Venda atomicamente
      const saleInsertRes = await client.query(
        `INSERT INTO "${schemaName}".sales (
          id, customer_id, customer_name, customer_document, sale_number,
          quote_id, status, issue_date, subtotal, discount, total, payment_conditions,
          notes, items, created_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, 'CONFIRMED', $6, $7, $8, $9, $10,
          $11, $12, $13, NOW(), NOW()
        ) RETURNING *`,
        [
          quoteRow.customer_id,
          quoteRow.customer_name,
          quoteRow.customer_document,
          saleNumber,
          quoteId,
          new Date().toISOString().split('T')[0],
          quoteRow.subtotal,
          quoteRow.discount,
          quoteRow.total,
          null,
          `Convertido do Orçamento ${quoteRow.quote_number}`,
          quoteRow.items,
          quoteRow.created_by,
        ]
      );

      const createdSale = saleInsertRes.rows[0];

      // 3. Atualiza o status do Quote para CONVERTED com o ID da nova venda
      await client.query(
        `UPDATE "${schemaName}".quotes
         SET status = 'CONVERTED', converted_sale_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [createdSale.id, quoteId]
      );

      return this.mapSaleRow(createdSale);
    });
  }

  private mapQuoteRow(row: any, fallback?: Quote): Quote {
    const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items || [];
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name || undefined,
      customerDocument: row.customer_document || undefined,
      number: row.quote_number,
      status: row.status,
      issueDate: row.created_at ? row.created_at.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      validUntil: row.valid_until || '',
      description: row.notes || 'Orçamento Comercial',
      subtotal: Number(row.subtotal) || 0,
      discount: Number(row.discount) || 0,
      surcharge: 0,
      total: Number(row.total) || 0,
      notes: row.notes || undefined,
      convertedSaleId: row.converted_sale_id || undefined,
      createdBy: row.created_by || 'system',
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
      items,
    };
  }

  private mapSaleRow(row: any, fallback?: Sale): Sale {
    const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items || [];
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name || undefined,
      customerDocument: row.customer_document || undefined,
      number: row.sale_number,
      status: row.status,
      saleDate: row.issue_date || new Date().toISOString().split('T')[0],
      sourceType: row.quote_id ? 'QUOTE' : 'MANUAL',
      sourceId: row.quote_id || undefined,
      subtotal: Number(row.subtotal) || 0,
      discount: Number(row.discount) || 0,
      surcharge: 0,
      total: Number(row.total) || 0,
      notes: row.notes || undefined,
      createdBy: row.created_by || 'system',
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
      items,
    };
  }

  async listServiceOrders(
    cleanCnpj: string,
    filter?: { status?: string; partnerId?: string }
  ): Promise<ServiceOrder[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".service_orders WHERE 1=1`;
      const values: any[] = [];
      let idx = 1;
      if (filter?.status) {
        query += ` AND status = $${idx++}`;
        values.push(filter.status);
      }
      if (filter?.partnerId) {
        query += ` AND partner_id = $${idx++}`;
        values.push(filter.partnerId);
      }
      query += ` ORDER BY created_at DESC`;
      const res = await client.query(query, values);
      return res.rows.map((r) => this.mapServiceOrderRow(r));
    });
  }

  async findServiceOrderById(cleanCnpj: string, id: string): Promise<ServiceOrder | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".service_orders WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapServiceOrderRow(res.rows[0]);
    });
  }

  async createServiceOrder(cleanCnpj: string, order: ServiceOrder): Promise<ServiceOrder> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `INSERT INTO "${schemaName}".service_orders (
          id, number, partner_id, status, title, description, labor_cost, parts_cost, total, services, parts, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        ) RETURNING *`,
        [
          order.id && order.id.includes('-') && order.id.length >= 32 ? order.id : null,
          order.number,
          order.customerId,
          order.status || 'OPEN',
          order.title,
          order.description || null,
          0,
          0,
          order.items?.reduce((acc, i) => acc + (i.total || 0), 0) || 0,
          JSON.stringify(order.items || []),
          JSON.stringify([]),
        ]
      );
      return this.mapServiceOrderRow(res.rows[0], order);
    });
  }

  async updateServiceOrder(
    cleanCnpj: string,
    id: string,
    updates: Partial<ServiceOrder>
  ): Promise<ServiceOrder | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (updates.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(updates.status);
      }
      if (updates.title !== undefined) {
        fields.push(`title = $${idx++}`);
        values.push(updates.title);
      }
      if (updates.description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(updates.description);
      }
      if (updates.items !== undefined) {
        fields.push(`services = $${idx++}`);
        values.push(JSON.stringify(updates.items));
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE "${schemaName}".service_orders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (res.rows.length === 0) return undefined;
      return this.mapServiceOrderRow(res.rows[0]);
    });
  }

  async listContracts(
    cleanCnpj: string,
    filter?: { status?: string; partnerId?: string }
  ): Promise<Contract[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".contracts WHERE 1=1`;
      const values: any[] = [];
      let idx = 1;
      if (filter?.status) {
        query += ` AND status = $${idx++}`;
        values.push(filter.status);
      }
      if (filter?.partnerId) {
        query += ` AND partner_id = $${idx++}`;
        values.push(filter.partnerId);
      }
      query += ` ORDER BY created_at DESC`;
      const res = await client.query(query, values);
      return res.rows.map((r) => this.mapContractRow(r));
    });
  }

  async findContractById(cleanCnpj: string, id: string): Promise<Contract | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".contracts WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapContractRow(res.rows[0]);
    });
  }

  async createContract(cleanCnpj: string, contract: Contract): Promise<Contract> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `INSERT INTO "${schemaName}".contracts (
          id, number, partner_id, status, start_date, end_date, monthly_amount, billing_day, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        ) RETURNING *`,
        [
          contract.id && contract.id.includes('-') && contract.id.length >= 32 ? contract.id : null,
          contract.number,
          contract.customerId,
          contract.status || 'ACTIVE',
          contract.startDate,
          contract.endDate || null,
          contract.value || 0,
          10,
        ]
      );
      return this.mapContractRow(res.rows[0], contract);
    });
  }

  async updateContract(
    cleanCnpj: string,
    id: string,
    updates: Partial<Contract>
  ): Promise<Contract | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (updates.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(updates.status);
      }
      if (updates.value !== undefined) {
        fields.push(`monthly_amount = $${idx++}`);
        values.push(updates.value);
      }
      if (updates.endDate !== undefined) {
        fields.push(`end_date = $${idx++}`);
        values.push(updates.endDate);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE "${schemaName}".contracts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (res.rows.length === 0) return undefined;
      return this.mapContractRow(res.rows[0]);
    });
  }

  private mapServiceOrderRow(row: any, fallback?: ServiceOrder): ServiceOrder {
    const items = typeof row.services === 'string' ? JSON.parse(row.services) : row.services || [];
    return {
      id: row.id,
      customerId: row.partner_id,
      number: row.number,
      title: row.title,
      description: row.description || '',
      status: row.status,
      priority: 'NORMAL',
      sourceType: 'AVULSA',
      createdBy: fallback?.createdBy || 'system',
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
      items,
      assignments: fallback?.assignments || [],
      events: fallback?.events || [],
      comments: fallback?.comments || [],
    };
  }

  private mapContractRow(row: any, fallback?: Contract): Contract {
    return {
      id: row.id,
      customerId: row.partner_id,
      number: row.number,
      title: fallback?.title || `Contrato ${row.number}`,
      description: fallback?.description || '',
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date || undefined,
      renewalType: fallback?.renewalType || 'AUTOMATIC',
      billingFrequency: fallback?.billingFrequency || 'MENSAL',
      value: Number(row.monthly_amount) || 0,
      createdBy: fallback?.createdBy || 'system',
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
      items: fallback?.items || [],
    };
  }
}

export class InMemorySalesRepository implements ISalesRepository {
  constructor(
    private getQuotes: (cleanCnpj: string) => Quote[],
    private getSales: (cleanCnpj: string) => Sale[],
    private getServiceOrders?: (cleanCnpj: string) => ServiceOrder[],
    private getContracts?: (cleanCnpj: string) => Contract[]
  ) {}

  async listQuotes(
    cleanCnpj: string,
    filter?: { status?: string; customerId?: string }
  ): Promise<Quote[]> {
    let list = this.getQuotes(cleanCnpj);
    if (filter?.status) list = list.filter((q) => q.status === filter.status);
    if (filter?.customerId) list = list.filter((q) => q.customerId === filter.customerId);
    return list;
  }

  async findQuoteById(cleanCnpj: string, id: string): Promise<Quote | undefined> {
    return this.getQuotes(cleanCnpj).find((q) => q.id === id);
  }

  async findQuoteByNumber(cleanCnpj: string, number: string): Promise<Quote | undefined> {
    return this.getQuotes(cleanCnpj).find((q) => q.number === number);
  }

  async createQuote(cleanCnpj: string, quote: Quote): Promise<Quote> {
    const list = this.getQuotes(cleanCnpj);
    if (!list.some((q) => q.id === quote.id)) {
      list.push(quote);
    }
    return quote;
  }

  async updateQuote(
    cleanCnpj: string,
    id: string,
    quote: Partial<Quote>
  ): Promise<Quote | undefined> {
    const list = this.getQuotes(cleanCnpj);
    const index = list.findIndex((q) => q.id === id);
    if (index === -1) return undefined;
    list[index] = { ...list[index], ...quote, updatedAt: new Date().toISOString() };
    return list[index];
  }

  async listSales(
    cleanCnpj: string,
    filter?: { status?: string; customerId?: string }
  ): Promise<Sale[]> {
    let list = this.getSales(cleanCnpj);
    if (filter?.status) list = list.filter((s) => s.status === filter.status);
    if (filter?.customerId) list = list.filter((s) => s.customerId === filter.customerId);
    return list;
  }

  async findSaleById(cleanCnpj: string, id: string): Promise<Sale | undefined> {
    return this.getSales(cleanCnpj).find((s) => s.id === id);
  }

  async findSaleByNumber(cleanCnpj: string, number: string): Promise<Sale | undefined> {
    return this.getSales(cleanCnpj).find((s) => s.number === number);
  }

  async createSale(cleanCnpj: string, sale: Sale): Promise<Sale> {
    const list = this.getSales(cleanCnpj);
    if (!list.some((s) => s.id === sale.id)) {
      list.push(sale);
    }
    return sale;
  }

  async updateSale(
    cleanCnpj: string,
    id: string,
    sale: Partial<Sale>
  ): Promise<Sale | undefined> {
    const list = this.getSales(cleanCnpj);
    const index = list.findIndex((s) => s.id === id);
    if (index === -1) return undefined;
    list[index] = { ...list[index], ...sale, updatedAt: new Date().toISOString() };
    return list[index];
  }

  async convertQuoteToSaleTransaction(
    cleanCnpj: string,
    quoteId: string,
    saleNumber: string,
    idempotencyKey?: string
  ): Promise<Sale> {
    const quote = this.getQuotes(cleanCnpj).find((q) => q.id === quoteId);
    if (!quote) throw new Error(`Orçamento com ID ${quoteId} não encontrado.`);

    if (quote.status === 'APPROVED' && quote.convertedSaleId) {
      const existingSale = this.getSales(cleanCnpj).find((s) => s.id === quote.convertedSaleId);
      if (existingSale) return existingSale;
    }

    const saleItems: SaleItem[] = quote.items.map((item, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      saleId: '',
      itemType: item.itemType,
      productId: item.productId,
      serviceId: item.serviceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      surcharge: item.surcharge || 0,
      total: item.total,
      sortOrder: item.sortOrder || idx,
    }));

    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      customerId: quote.customerId,
      customerName: quote.customerName,
      customerDocument: quote.customerDocument,
      number: saleNumber,
      status: 'CONFIRMED',
      saleDate: new Date().toISOString().split('T')[0],
      sourceType: 'QUOTE',
      sourceId: quote.id,
      subtotal: quote.subtotal,
      discount: quote.discount,
      surcharge: quote.surcharge,
      total: quote.total,
      notes: quote.notes,
      createdBy: quote.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: saleItems,
    };

    this.getSales(cleanCnpj).push(newSale);
    quote.status = 'APPROVED';
    quote.convertedSaleId = newSale.id;
    quote.updatedAt = new Date().toISOString();

    return newSale;
  }

  async listServiceOrders(
    cleanCnpj: string,
    filter?: { status?: string; partnerId?: string }
  ): Promise<ServiceOrder[]> {
    if (!this.getServiceOrders) return [];
    let list = this.getServiceOrders(cleanCnpj);
    if (filter?.status) list = list.filter((s) => s.status === filter.status);
    if (filter?.partnerId) list = list.filter((s) => s.customerId === filter.partnerId);
    return [...list];
  }

  async findServiceOrderById(cleanCnpj: string, id: string): Promise<ServiceOrder | undefined> {
    if (!this.getServiceOrders) return undefined;
    return this.getServiceOrders(cleanCnpj).find((s) => s.id === id);
  }

  async createServiceOrder(cleanCnpj: string, order: ServiceOrder): Promise<ServiceOrder> {
    if (this.getServiceOrders) {
      const list = this.getServiceOrders(cleanCnpj);
      if (!list.some((s) => s.id === order.id)) {
        list.push(order);
      }
    }
    return order;
  }

  async updateServiceOrder(
    cleanCnpj: string,
    id: string,
    updates: Partial<ServiceOrder>
  ): Promise<ServiceOrder | undefined> {
    if (!this.getServiceOrders) return undefined;
    const list = this.getServiceOrders(cleanCnpj);
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return undefined;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    return list[idx];
  }

  async listContracts(
    cleanCnpj: string,
    filter?: { status?: string; partnerId?: string }
  ): Promise<Contract[]> {
    if (!this.getContracts) return [];
    let list = this.getContracts(cleanCnpj);
    if (filter?.status) list = list.filter((c) => c.status === filter.status);
    if (filter?.partnerId) list = list.filter((c) => c.customerId === filter.partnerId);
    return [...list];
  }

  async findContractById(cleanCnpj: string, id: string): Promise<Contract | undefined> {
    if (!this.getContracts) return undefined;
    return this.getContracts(cleanCnpj).find((c) => c.id === id);
  }

  async createContract(cleanCnpj: string, contract: Contract): Promise<Contract> {
    if (this.getContracts) {
      const list = this.getContracts(cleanCnpj);
      if (!list.some((c) => c.id === contract.id)) {
        list.push(contract);
      }
    }
    return contract;
  }

  async updateContract(
    cleanCnpj: string,
    id: string,
    updates: Partial<Contract>
  ): Promise<Contract | undefined> {
    if (!this.getContracts) return undefined;
    const list = this.getContracts(cleanCnpj);
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    return list[idx];
  }
}
