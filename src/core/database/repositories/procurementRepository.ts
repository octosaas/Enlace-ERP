/**
 * Enlace ERP - Procurement & Purchasing Repository
 * PRD 08: Requisição de Compras, Cotação de Fornecedores, Pedido e 3-Way Matching
 */

import { PurchaseRequisition, PurchaseOrder } from '../../../shared/types.js';
import { PostgresService } from '../postgres.js';

export interface IProcurementRepository {
  listRequisitions(cleanCnpj: string, filter?: { status?: string }): Promise<PurchaseRequisition[]>;
  findRequisitionById(cleanCnpj: string, id: string): Promise<PurchaseRequisition | undefined>;
  createRequisition(cleanCnpj: string, req: PurchaseRequisition): Promise<PurchaseRequisition>;
  updateRequisition(cleanCnpj: string, id: string, updates: Partial<PurchaseRequisition>): Promise<PurchaseRequisition | undefined>;

  listOrders(cleanCnpj: string, filter?: { status?: string; supplierId?: string }): Promise<PurchaseOrder[]>;
  findOrderById(cleanCnpj: string, id: string): Promise<PurchaseOrder | undefined>;
  createOrder(cleanCnpj: string, order: PurchaseOrder): Promise<PurchaseOrder>;
  updateOrder(cleanCnpj: string, id: string, updates: Partial<PurchaseOrder>): Promise<PurchaseOrder | undefined>;
}

export class PostgresProcurementRepository implements IProcurementRepository {
  async listRequisitions(cleanCnpj: string, filter?: { status?: string }): Promise<PurchaseRequisition[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".purchase_requisitions WHERE 1=1`;
      const values: any[] = [];
      if (filter?.status) {
        query += ' AND status = $1';
        values.push(filter.status);
      }
      query += ' ORDER BY created_at DESC';
      const res = await client.query(query, values);
      return res.rows.map((r) => this.mapReqRow(r));
    });
  }

  async findRequisitionById(cleanCnpj: string, id: string): Promise<PurchaseRequisition | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".purchase_requisitions WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapReqRow(res.rows[0]);
    });
  }

  async createRequisition(cleanCnpj: string, req: PurchaseRequisition): Promise<PurchaseRequisition> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const itemsJson = JSON.stringify(req.items || []);
      const res = await client.query(
        `INSERT INTO "${schemaName}".purchase_requisitions (
          id, requisition_number, requested_by, department, status,
          priority, needed_by, justification, total_estimated, items,
          created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
        ) RETURNING *`,
        [
          req.id && req.id.includes('-') && req.id.length >= 32 ? req.id : null,
          req.number,
          req.requestedByName || req.requestedById,
          req.department || 'Geral',
          req.status || 'PENDENTE_APROVACAO',
          req.priority || 'MEDIA',
          req.neededByDate,
          req.justification,
          req.totalEstimated,
          itemsJson,
        ]
      );
      return this.mapReqRow(res.rows[0], req);
    });
  }

  async updateRequisition(
    cleanCnpj: string,
    id: string,
    updates: Partial<PurchaseRequisition>
  ): Promise<PurchaseRequisition | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (updates.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(updates.status);
      }
      if (updates.approvedByName !== undefined) {
        fields.push(`approved_by = $${idx++}`);
        values.push(updates.approvedByName);
        fields.push(`approved_at = NOW()`);
      }
      if (updates.rejectionReason !== undefined) {
        fields.push(`rejection_reason = $${idx++}`);
        values.push(updates.rejectionReason);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE "${schemaName}".purchase_requisitions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) return undefined;
      return this.mapReqRow(res.rows[0]);
    });
  }

  async listOrders(cleanCnpj: string, filter?: { status?: string; supplierId?: string }): Promise<PurchaseOrder[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".purchase_orders WHERE 1=1`;
      const values: any[] = [];
      let idx = 1;
      if (filter?.status) {
        query += ` AND status = $${idx++}`;
        values.push(filter.status);
      }
      if (filter?.supplierId) {
        query += ` AND supplier_id = $${idx++}`;
        values.push(filter.supplierId);
      }
      query += ' ORDER BY created_at DESC';
      const res = await client.query(query, values);
      return res.rows.map((r) => this.mapOrderRow(r));
    });
  }

  async findOrderById(cleanCnpj: string, id: string): Promise<PurchaseOrder | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".purchase_orders WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapOrderRow(res.rows[0]);
    });
  }

  async createOrder(cleanCnpj: string, order: PurchaseOrder): Promise<PurchaseOrder> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const itemsJson = JSON.stringify(order.items || []);
      const res = await client.query(
        `INSERT INTO "${schemaName}".purchase_orders (
          id, order_number, requisition_id, supplier_id, supplier_name,
          supplier_document, status, issue_date, expected_delivery_date,
          subtotal, discount, freight, taxes, total, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
        ) RETURNING *`,
        [
          order.id && order.id.includes('-') && order.id.length >= 32 ? order.id : null,
          order.number,
          order.requisitionId || null,
          order.supplierId,
          order.supplierName,
          order.supplierDocument,
          order.status || 'PENDENTE_APROVACAO',
          order.expectedDeliveryDate || new Date().toISOString().split('T')[0],
          order.expectedDeliveryDate || null,
          order.subtotal,
          order.discountTotal || 0,
          order.freightTotal || 0,
          order.taxesTotal || 0,
          order.grandTotal,
        ]
      );
      return this.mapOrderRow(res.rows[0], order);
    });
  }

  async updateOrder(
    cleanCnpj: string,
    id: string,
    updates: Partial<PurchaseOrder>
  ): Promise<PurchaseOrder | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (updates.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(updates.status);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE "${schemaName}".purchase_orders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) return undefined;
      return this.mapOrderRow(res.rows[0]);
    });
  }

  private mapReqRow(row: any, fallback?: PurchaseRequisition): PurchaseRequisition {
    const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items || [];
    return {
      id: row.id,
      number: row.requisition_number,
      requestedById: fallback?.requestedById || 'user_id',
      requestedByName: row.requested_by,
      department: row.department,
      priority: row.priority,
      status: row.status,
      neededByDate: row.needed_by,
      justification: row.justification,
      items,
      totalEstimated: Number(row.total_estimated),
      approvedByName: row.approved_by || undefined,
      approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : undefined,
      rejectionReason: row.rejection_reason || undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : fallback?.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : fallback?.updatedAt || new Date().toISOString(),
    };
  }

  private mapOrderRow(row: any, fallback?: PurchaseOrder): PurchaseOrder {
    return {
      id: row.id,
      number: row.order_number,
      requisitionId: row.requisition_id || undefined,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      supplierDocument: row.supplier_document,
      status: row.status,
      expectedDeliveryDate: row.expected_delivery_date || new Date().toISOString().split('T')[0],
      items: fallback?.items || [],
      subtotal: Number(row.subtotal),
      discountTotal: Number(row.discount || 0),
      freightTotal: Number(row.freight || 0),
      taxesTotal: Number(row.taxes || 0),
      grandTotal: Number(row.total),
      paymentTerm: fallback?.paymentTerm || '30 dias',
      paymentMethod: fallback?.paymentMethod || 'BOLETO',
      deliveryAddress: typeof fallback?.deliveryAddress === 'string' ? fallback.deliveryAddress : 'Endereço Principal',
      warehouseId: fallback?.warehouseId || 'wh-default',
      warehouseName: fallback?.warehouseName || 'Almoxarifado Central',
      createdById: fallback?.createdById || 'user-default',
      createdByName: fallback?.createdByName || 'Operador Compras',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : fallback?.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : fallback?.updatedAt || new Date().toISOString(),
    };
  }
}

export class InMemoryProcurementRepository implements IProcurementRepository {
  constructor(
    private getReqs: (cleanCnpj: string) => PurchaseRequisition[],
    private getOrders: (cleanCnpj: string) => PurchaseOrder[]
  ) {}

  async listRequisitions(cleanCnpj: string, filter?: { status?: string }): Promise<PurchaseRequisition[]> {
    let reqs = this.getReqs(cleanCnpj);
    if (filter?.status) reqs = reqs.filter((r) => r.status === filter.status);
    return [...reqs];
  }

  async findRequisitionById(cleanCnpj: string, id: string): Promise<PurchaseRequisition | undefined> {
    return this.getReqs(cleanCnpj).find((r) => r.id === id);
  }

  async createRequisition(cleanCnpj: string, req: PurchaseRequisition): Promise<PurchaseRequisition> {
    this.getReqs(cleanCnpj).unshift(req);
    return req;
  }

  async updateRequisition(cleanCnpj: string, id: string, updates: Partial<PurchaseRequisition>): Promise<PurchaseRequisition | undefined> {
    const reqs = this.getReqs(cleanCnpj);
    const idx = reqs.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    reqs[idx] = { ...reqs[idx], ...updates };
    return reqs[idx];
  }

  async listOrders(cleanCnpj: string, filter?: { status?: string; supplierId?: string }): Promise<PurchaseOrder[]> {
    let orders = this.getOrders(cleanCnpj);
    if (filter?.status) orders = orders.filter((o) => o.status === filter.status);
    if (filter?.supplierId) orders = orders.filter((o) => o.supplierId === filter.supplierId);
    return [...orders];
  }

  async findOrderById(cleanCnpj: string, id: string): Promise<PurchaseOrder | undefined> {
    return this.getOrders(cleanCnpj).find((o) => o.id === id);
  }

  async createOrder(cleanCnpj: string, order: PurchaseOrder): Promise<PurchaseOrder> {
    this.getOrders(cleanCnpj).unshift(order);
    return order;
  }

  async updateOrder(cleanCnpj: string, id: string, updates: Partial<PurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const orders = this.getOrders(cleanCnpj);
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) return undefined;
    orders[idx] = { ...orders[idx], ...updates };
    return orders[idx];
  }
}
