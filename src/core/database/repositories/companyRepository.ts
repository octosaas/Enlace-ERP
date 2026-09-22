/**
 * Enlace ERP - Company Repository
 * PRD 01: Instâncias ERP e Schemas Isolados por CNPJ
 */

import { Company } from '../../../shared/types.js';
import { PostgresService } from '../postgres.js';

export interface ICompanyRepository {
  findById(id: string): Promise<Company | undefined>;
  findByCnpj(cleanCnpj: string): Promise<Company | undefined>;
  findBySchema(schemaNamespace: string): Promise<Company | undefined>;
  create(company: Company): Promise<Company>;
  listAll(): Promise<Company[]>;
  update(id: string, updates: Partial<Company>): Promise<Company | undefined>;
}

export class PostgresCompanyRepository implements ICompanyRepository {
  async findById(id: string): Promise<Company | undefined> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query('SELECT * FROM cp_companies WHERE id = $1 LIMIT 1', [id]);
      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async findByCnpj(cleanCnpj: string): Promise<Company | undefined> {
    const sanitized = cleanCnpj.replace(/\D/g, '');
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query('SELECT * FROM cp_companies WHERE clean_cnpj = $1 LIMIT 1', [sanitized]);
      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async findBySchema(schemaNamespace: string): Promise<Company | undefined> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query('SELECT * FROM cp_companies WHERE schema_namespace = $1 LIMIT 1', [schemaNamespace]);
      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async create(company: Company): Promise<Company> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query(
        `INSERT INTO cp_companies (
          id, cnpj, clean_cnpj, legal_name, trade_name, segment,
          schema_namespace, status, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) RETURNING *`,
        [
          company.id.includes('-') && company.id.length >= 32 ? company.id : null,
          company.cnpj,
          company.cleanCnpj,
          company.legalName,
          company.tradeName,
          company.segment,
          company.schemaNamespace,
          company.status || 'active',
          company.createdAt || new Date().toISOString(),
          company.updatedAt || new Date().toISOString(),
        ]
      );
      return this.mapRow(res.rows[0]);
    });
  }

  async listAll(): Promise<Company[]> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query('SELECT * FROM cp_companies ORDER BY trade_name');
      return res.rows.map((r) => this.mapRow(r));
    });
  }

  async update(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (updates.legalName !== undefined) {
        fields.push(`legal_name = $${idx++}`);
        values.push(updates.legalName);
      }
      if (updates.tradeName !== undefined) {
        fields.push(`trade_name = $${idx++}`);
        values.push(updates.tradeName);
      }
      if (updates.segment !== undefined) {
        fields.push(`segment = $${idx++}`);
        values.push(updates.segment);
      }
      if (updates.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(updates.status);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE cp_companies SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  private mapRow(row: any): Company {
    return {
      id: row.id,
      cnpj: row.cnpj,
      cleanCnpj: row.clean_cnpj,
      legalName: row.legal_name,
      tradeName: row.trade_name,
      segment: row.segment,
      schemaNamespace: row.schema_namespace,
      status: row.status,
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
    };
  }
}

export class InMemoryCompanyRepository implements ICompanyRepository {
  constructor(private storage: Map<string, Company>) {}

  async findById(id: string): Promise<Company | undefined> {
    return this.storage.get(id);
  }

  async findByCnpj(cleanCnpj: string): Promise<Company | undefined> {
    const sanitized = cleanCnpj.replace(/\D/g, '');
    return Array.from(this.storage.values()).find((c) => c.cleanCnpj === sanitized);
  }

  async findBySchema(schemaNamespace: string): Promise<Company | undefined> {
    return Array.from(this.storage.values()).find((c) => c.schemaNamespace === schemaNamespace);
  }

  async create(company: Company): Promise<Company> {
    this.storage.set(company.id, { ...company });
    return company;
  }

  async listAll(): Promise<Company[]> {
    return Array.from(this.storage.values());
  }

  async update(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    const existing = this.storage.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.storage.set(id, updated);
    return updated;
  }
}
