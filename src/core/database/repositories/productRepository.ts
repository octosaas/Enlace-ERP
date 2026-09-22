/**
 * Enlace ERP - Product & Stock Catalog Repository
 * PRD 04 & PRD 06: Catálogo de Produtos, Serviços e Inventário
 */

import { Product } from '../../../shared/types.js';
import { PostgresService } from '../postgres.js';

export interface IProductRepository {
  list(cleanCnpj: string): Promise<Product[]>;
  findById(cleanCnpj: string, id: string): Promise<Product | undefined>;
  findByCode(cleanCnpj: string, code: string): Promise<Product | undefined>;
  create(cleanCnpj: string, product: Product): Promise<Product>;
  update(cleanCnpj: string, id: string, product: Partial<Product>): Promise<Product | undefined>;
  delete(cleanCnpj: string, id: string): Promise<boolean>;
}

export class PostgresProductRepository implements IProductRepository {
  async list(cleanCnpj: string): Promise<Product[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`SELECT * FROM "${schemaName}".products ORDER BY name ASC`);
      return res.rows.map((r) => this.mapRow(r));
    });
  }

  async findById(cleanCnpj: string, id: string): Promise<Product | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`SELECT * FROM "${schemaName}".products WHERE id = $1 LIMIT 1`, [id]);
      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async findByCode(cleanCnpj: string, code: string): Promise<Product | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`SELECT * FROM "${schemaName}".products WHERE code = $1 LIMIT 1`, [code]);
      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async create(cleanCnpj: string, product: Product): Promise<Product> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `INSERT INTO "${schemaName}".products (
          id, code, name, type, ncm, cfop, unit, sale_price, cost_price,
          cmp, stock_quantity, min_stock, status, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        ) RETURNING *`,
        [
          product.id && product.id.includes('-') && product.id.length >= 32 ? product.id : null,
          product.code,
          product.name,
          product.type || 'PRODUCT',
          '00000000',
          '5102',
          product.unit || 'UN',
          product.unitPrice || 0,
          product.costPrice || 0,
          product.costPrice || 0,
          0,
          0,
          product.status || 'ATIVO',
          product.createdAt || new Date().toISOString(),
          product.updatedAt || new Date().toISOString(),
        ]
      );
      return this.mapRow(res.rows[0], product);
    });
  }

  async update(cleanCnpj: string, id: string, product: Partial<Product>): Promise<Product | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (product.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(product.name);
      }
      if (product.unitPrice !== undefined) {
        fields.push(`sale_price = $${idx++}`);
        values.push(product.unitPrice);
      }
      if (product.costPrice !== undefined) {
        fields.push(`cost_price = $${idx++}`);
        values.push(product.costPrice);
      }
      if (product.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(product.status);
      }
      if (product.unit !== undefined) {
        fields.push(`unit = $${idx++}`);
        values.push(product.unit);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE "${schemaName}".products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async delete(cleanCnpj: string, id: string): Promise<boolean> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`DELETE FROM "${schemaName}".products WHERE id = $1`, [id]);
      return (res.rowCount ?? 0) > 0;
    });
  }

  private mapRow(row: any, fallback?: Product): Product {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type || 'PRODUCT',
      description: fallback?.description,
      unit: row.unit || 'UN',
      unitPrice: Number(row.sale_price) || 0,
      costPrice: Number(row.cost_price) || 0,
      status: row.status === 'INATIVO' ? 'INATIVO' : 'ATIVO',
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
    };
  }
}

export class InMemoryProductRepository implements IProductRepository {
  constructor(private getList: (cleanCnpj: string) => Product[]) {}

  async list(cleanCnpj: string): Promise<Product[]> {
    return this.getList(cleanCnpj);
  }

  async findById(cleanCnpj: string, id: string): Promise<Product | undefined> {
    return this.getList(cleanCnpj).find((p) => p.id === id);
  }

  async findByCode(cleanCnpj: string, code: string): Promise<Product | undefined> {
    return this.getList(cleanCnpj).find((p) => p.code === code);
  }

  async create(cleanCnpj: string, product: Product): Promise<Product> {
    const list = this.getList(cleanCnpj);
    if (!list.some((p) => p.id === product.id)) {
      list.push(product);
    }
    return product;
  }

  async update(cleanCnpj: string, id: string, product: Partial<Product>): Promise<Product | undefined> {
    const list = this.getList(cleanCnpj);
    const index = list.findIndex((p) => p.id === id);
    if (index === -1) return undefined;
    list[index] = { ...list[index], ...product, updatedAt: new Date().toISOString() };
    return list[index];
  }

  async delete(cleanCnpj: string, id: string): Promise<boolean> {
    const list = this.getList(cleanCnpj);
    const index = list.findIndex((p) => p.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    return true;
  }
}
