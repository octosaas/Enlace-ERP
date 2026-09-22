/**
 * Enlace ERP - Inventory & WMS Repository
 * PRD 06: Múltiplos Depósitos, Kardex, CMP e Trava de Saldo Negativo
 */

import { Warehouse, StockItem, StockMovement } from '../../../shared/types.js';
import { PostgresService } from '../postgres.js';
import { InventoryMath } from '../../inventory/inventoryEngine.js';

export interface IInventoryRepository {
  listWarehouses(cleanCnpj: string): Promise<Warehouse[]>;
  findWarehouseById(cleanCnpj: string, id: string): Promise<Warehouse | undefined>;
  createWarehouse(cleanCnpj: string, warehouse: Warehouse): Promise<Warehouse>;

  listStockItems(cleanCnpj: string, warehouseId?: string): Promise<StockItem[]>;
  findStockItem(cleanCnpj: string, warehouseId: string, productId: string): Promise<StockItem | undefined>;

  listStockMovements(cleanCnpj: string, productId?: string, warehouseId?: string): Promise<StockMovement[]>;
  recordStockMovementTransaction(cleanCnpj: string, movement: StockMovement): Promise<StockMovement>;
}

export class PostgresInventoryRepository implements IInventoryRepository {
  async listWarehouses(cleanCnpj: string): Promise<Warehouse[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".warehouses WHERE is_active = true ORDER BY code ASC`
      );
      return res.rows.map((r) => this.mapWarehouseRow(r));
    });
  }

  async findWarehouseById(cleanCnpj: string, id: string): Promise<Warehouse | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".warehouses WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapWarehouseRow(res.rows[0]);
    });
  }

  async createWarehouse(cleanCnpj: string, w: Warehouse): Promise<Warehouse> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `INSERT INTO "${schemaName}".warehouses (
          id, code, name, is_default, is_active, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, NOW(), NOW()
        ) RETURNING *`,
        [
          w.id && w.id.includes('-') && w.id.length >= 32 ? w.id : null,
          w.code,
          w.name,
          w.isDefault || false,
          w.isActive !== false,
        ]
      );
      return this.mapWarehouseRow(res.rows[0], w);
    });
  }

  async listStockItems(cleanCnpj: string, warehouseId?: string): Promise<StockItem[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".stock_items`;
      const values: any[] = [];
      if (warehouseId) {
        query += ' WHERE warehouse_id = $1';
        values.push(warehouseId);
      }
      query += ' ORDER BY product_id ASC';
      const res = await client.query(query, values);
      return res.rows.map((r) => this.mapStockItemRow(r));
    });
  }

  async findStockItem(
    cleanCnpj: string,
    warehouseId: string,
    productId: string
  ): Promise<StockItem | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".stock_items WHERE warehouse_id = $1 AND product_id = $2 LIMIT 1`,
        [warehouseId, productId]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapStockItemRow(res.rows[0]);
    });
  }

  async listStockMovements(
    cleanCnpj: string,
    productId?: string,
    warehouseId?: string
  ): Promise<StockMovement[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".stock_movements WHERE 1=1`;
      const values: any[] = [];
      let idx = 1;
      if (productId) {
        query += ` AND product_id = $${idx++}`;
        values.push(productId);
      }
      if (warehouseId) {
        query += ` AND warehouse_id = $${idx++}`;
        values.push(warehouseId);
      }
      query += ' ORDER BY created_at DESC';
      const res = await client.query(query, values);
      return res.rows.map((r) => this.mapStockMovementRow(r));
    });
  }

  /**
   * Executa a movimentação de estoque com atomicidade transacional e lock pessimista
   * Trava de saldo negativo e recálculo de Custo Médio Ponderado (CMP)
   */
  async recordStockMovementTransaction(
    cleanCnpj: string,
    movement: StockMovement
  ): Promise<StockMovement> {
    return PostgresService.withTenantTransaction(cleanCnpj, async (client, schemaName) => {
      // 1. Lock do item de estoque para evitar race conditions
      const itemRes = await client.query(
        `SELECT * FROM "${schemaName}".stock_items WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
        [movement.warehouseId, movement.productId]
      );

      let prevQty = 0;
      let prevCmp = 0;
      let stockItemId: string | null = null;

      if (itemRes.rows.length > 0) {
        stockItemId = itemRes.rows[0].id;
        prevQty = Number(itemRes.rows[0].quantity) || 0;
        prevCmp = Number(itemRes.rows[0].cmp) || 0;
      }

      let newQty = prevQty;
      let newCmp = prevCmp;

      const isInput =
        movement.movementType === 'INBOUND_PURCHASE' ||
        movement.movementType === 'INBOUND_ADJUSTMENT' ||
        movement.movementType === 'TRANSFER_IN';

      const isOutput =
        movement.movementType === 'OUTBOUND_SALE' ||
        movement.movementType === 'OUTBOUND_SERVICE_ORDER' ||
        movement.movementType === 'OUTBOUND_ADJUSTMENT' ||
        movement.movementType === 'TRANSFER_OUT';

      if (isInput) {
        const cmpCalc = InventoryMath.calculateCMP(prevQty, prevCmp, movement.quantity, movement.unitCost);
        newQty = cmpCalc.newQuantity;
        newCmp = cmpCalc.newAverageCost;
      } else if (isOutput) {
        if (prevQty < movement.quantity) {
          throw new Error(
            `Saldo insuficiente para saída no depósito. Solicitado: ${movement.quantity}, Disponível: ${prevQty}.`
          );
        }
        newQty = prevQty - movement.quantity;
      }

      // 2. Atualiza ou insere o saldo do item de estoque
      if (stockItemId) {
        await client.query(
          `UPDATE "${schemaName}".stock_items
           SET quantity = $1, cmp = $2, updated_at = NOW()
           WHERE id = $3`,
          [newQty, newCmp, stockItemId]
        );
      } else {
        await client.query(
          `INSERT INTO "${schemaName}".stock_items (
            id, warehouse_id, product_id, quantity, cmp, min_quantity, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, 0, NOW()
          )`,
          [movement.warehouseId, movement.productId, newQty, newCmp]
        );
      }

      // 3. Insere o registro imutável no Kardex (stock_movements)
      const moveRes = await client.query(
        `INSERT INTO "${schemaName}".stock_movements (
          id, type, warehouse_id, product_id, quantity, unit_cost, total_cost,
          previous_balance, new_balance, previous_cmp, new_cmp, document_type,
          document_id, notes, created_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
        ) RETURNING *`,
        [
          movement.id && movement.id.includes('-') && movement.id.length >= 32 ? movement.id : null,
          movement.movementType,
          movement.warehouseId,
          movement.productId,
          movement.quantity,
          movement.unitCost,
          movement.totalCost || movement.quantity * movement.unitCost,
          prevQty,
          newQty,
          prevCmp,
          newCmp,
          movement.referenceType || null,
          movement.referenceId || null,
          movement.notes || null,
        ]
      );

      return this.mapStockMovementRow(moveRes.rows[0], movement);
    });
  }

  private mapWarehouseRow(row: any, fallback?: Warehouse): Warehouse {
    return {
      id: row.id,
      companyId: fallback?.companyId || 'company_id',
      code: row.code,
      name: row.name,
      isDefault: row.is_default,
      isActive: row.is_active,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : fallback?.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : fallback?.updatedAt || new Date().toISOString(),
    };
  }

  private mapStockItemRow(row: any, fallback?: StockItem): StockItem {
    const qty = Number(row.quantity);
    const avgCost = Number(row.cmp);
    return {
      id: row.id,
      companyId: fallback?.companyId || 'company_id',
      warehouseId: row.warehouse_id,
      warehouseName: fallback?.warehouseName || 'Depósito',
      productId: row.product_id,
      productCode: fallback?.productCode || 'PRD-01',
      productName: fallback?.productName || 'Produto',
      productUnit: fallback?.productUnit || 'UN',
      quantity: qty,
      reservedQuantity: 0,
      availableQuantity: qty,
      minQuantity: Number(row.min_quantity || 0),
      maxQuantity: 999999,
      averageCost: avgCost,
      lastCost: avgCost,
      totalValue: qty * avgCost,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  private mapStockMovementRow(row: any, fallback?: StockMovement): StockMovement {
    return {
      id: row.id,
      companyId: fallback?.companyId || 'company_id',
      movementNumber: fallback?.movementNumber || `MOV-${String(row.id).slice(0, 8)}`,
      movementType: row.type as any,
      warehouseId: row.warehouse_id,
      warehouseName: fallback?.warehouseName || 'Depósito',
      productId: row.product_id,
      productCode: fallback?.productCode || 'PRD',
      productName: fallback?.productName || 'Produto',
      productUnit: fallback?.productUnit || 'UN',
      quantity: Number(row.quantity),
      unitCost: Number(row.unit_cost),
      totalCost: Number(row.total_cost),
      previousStock: Number(row.previous_balance),
      currentStock: Number(row.new_balance),
      previousAverageCost: Number(row.previous_cmp),
      newAverageCost: Number(row.new_cmp),
      referenceType: row.document_type || undefined,
      referenceId: row.document_id || undefined,
      notes: row.notes || undefined,
      createdById: fallback?.createdById || 'user_id',
      createdByName: fallback?.createdByName || 'Operador',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : fallback?.createdAt || new Date().toISOString(),
    };
  }
}

export class InMemoryInventoryRepository implements IInventoryRepository {
  constructor(
    private getWarehouses: (cleanCnpj: string) => Warehouse[],
    private getStockItems: (cleanCnpj: string) => StockItem[],
    private getStockMovements: (cleanCnpj: string) => StockMovement[]
  ) {}

  async listWarehouses(cleanCnpj: string): Promise<Warehouse[]> {
    return [...this.getWarehouses(cleanCnpj)];
  }

  async findWarehouseById(cleanCnpj: string, id: string): Promise<Warehouse | undefined> {
    return this.getWarehouses(cleanCnpj).find((w) => w.id === id);
  }

  async createWarehouse(cleanCnpj: string, warehouse: Warehouse): Promise<Warehouse> {
    this.getWarehouses(cleanCnpj).unshift(warehouse);
    return warehouse;
  }

  async listStockItems(cleanCnpj: string, warehouseId?: string): Promise<StockItem[]> {
    let items = this.getStockItems(cleanCnpj);
    if (warehouseId) {
      items = items.filter((i) => i.warehouseId === warehouseId);
    }
    return [...items];
  }

  async findStockItem(cleanCnpj: string, warehouseId: string, productId: string): Promise<StockItem | undefined> {
    return this.getStockItems(cleanCnpj).find((i) => i.warehouseId === warehouseId && i.productId === productId);
  }

  async listStockMovements(cleanCnpj: string, productId?: string, warehouseId?: string): Promise<StockMovement[]> {
    let moves = this.getStockMovements(cleanCnpj);
    if (productId) moves = moves.filter((m) => m.productId === productId);
    if (warehouseId) moves = moves.filter((m) => m.warehouseId === warehouseId);
    return [...moves];
  }

  async recordStockMovementTransaction(cleanCnpj: string, movement: StockMovement): Promise<StockMovement> {
    const items = this.getStockItems(cleanCnpj);
    let item = items.find((i) => i.warehouseId === movement.warehouseId && i.productId === movement.productId);

    const prevQty = item ? item.quantity : 0;
    const prevCmp = item ? item.averageCost : 0;

    let newQty = prevQty;
    let newCmp = prevCmp;

    const isInput =
      movement.movementType === 'INBOUND_PURCHASE' ||
      movement.movementType === 'INBOUND_ADJUSTMENT' ||
      movement.movementType === 'TRANSFER_IN';

    const isOutput =
      movement.movementType === 'OUTBOUND_SALE' ||
      movement.movementType === 'OUTBOUND_SERVICE_ORDER' ||
      movement.movementType === 'OUTBOUND_ADJUSTMENT' ||
      movement.movementType === 'TRANSFER_OUT';

    if (isInput) {
      const cmpCalc = InventoryMath.calculateCMP(prevQty, prevCmp, movement.quantity, movement.unitCost);
      newQty = cmpCalc.newQuantity;
      newCmp = cmpCalc.newAverageCost;
    } else if (isOutput) {
      if (prevQty < movement.quantity) {
        throw new Error(`Saldo insuficiente para saída no depósito.`);
      }
      newQty = prevQty - movement.quantity;
    }

    if (item) {
      item.quantity = newQty;
      item.availableQuantity = newQty;
      item.averageCost = newCmp;
      item.totalValue = newQty * newCmp;
      item.updatedAt = new Date().toISOString();
    } else {
      items.push({
        id: `sti-${Math.random()}`,
        companyId: cleanCnpj,
        warehouseId: movement.warehouseId,
        warehouseName: movement.warehouseName || 'Depósito',
        productId: movement.productId,
        productCode: movement.productCode,
        productName: movement.productName,
        productUnit: movement.productUnit,
        quantity: newQty,
        reservedQuantity: 0,
        availableQuantity: newQty,
        minQuantity: 0,
        maxQuantity: 99999,
        averageCost: newCmp,
        lastCost: movement.unitCost,
        totalValue: newQty * newCmp,
        updatedAt: new Date().toISOString(),
      });
    }

    this.getStockMovements(cleanCnpj).unshift(movement);
    return movement;
  }
}
