/**
 * Enlace ERP - Business Partner Repository
 * PRD 03: Gestão de Clientes, Fornecedores e Transportadoras
 */

import { BusinessPartner } from '../../../shared/types.js';
import { PostgresService } from '../postgres.js';

export interface IPartnerRepository {
  list(cleanCnpj: string, filter?: { search?: string; role?: string; status?: string }): Promise<BusinessPartner[]>;
  findById(cleanCnpj: string, id: string): Promise<BusinessPartner | undefined>;
  findByDocument(cleanCnpj: string, document: string): Promise<BusinessPartner | undefined>;
  create(cleanCnpj: string, partner: BusinessPartner): Promise<BusinessPartner>;
  update(cleanCnpj: string, id: string, partner: Partial<BusinessPartner>): Promise<BusinessPartner | undefined>;
  delete(cleanCnpj: string, id: string): Promise<boolean>;
}

export class PostgresPartnerRepository implements IPartnerRepository {
  async list(
    cleanCnpj: string,
    filter?: { search?: string; role?: string; status?: string }
  ): Promise<BusinessPartner[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".partners WHERE 1=1`;
      const values: any[] = [];
      let idx = 1;

      if (filter?.status) {
        query += ` AND status = $${idx++}`;
        values.push(filter.status);
      }
      if (filter?.search) {
        query += ` AND (LOWER(legal_name) LIKE $${idx} OR LOWER(COALESCE(trade_name, '')) LIKE $${idx} OR document LIKE $${idx})`;
        values.push(`%${filter.search.toLowerCase()}%`);
        idx++;
      }

      query += ' ORDER BY legal_name ASC';
      const res = await client.query(query, values);
      let results = res.rows.map((r) => this.mapRow(r));
      if (filter?.role) {
        results = results.filter((p) => p.roles && p.roles.includes(filter.role as any));
      }
      return results;
    });
  }

  async findById(cleanCnpj: string, id: string): Promise<BusinessPartner | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`SELECT * FROM "${schemaName}".partners WHERE id = $1 LIMIT 1`, [id]);
      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async findByDocument(cleanCnpj: string, document: string): Promise<BusinessPartner | undefined> {
    const cleanDoc = document.replace(/\D/g, '');
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".partners WHERE document = $1 LIMIT 1`,
        [cleanDoc]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async create(cleanCnpj: string, partner: BusinessPartner): Promise<BusinessPartner> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const addressJson = JSON.stringify(partner.address || {});
      const res = await client.query(
        `INSERT INTO "${schemaName}".partners (
          id, type, legal_name, trade_name, document_type, document,
          state_registration, email, phone, address, status, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) RETURNING *`,
        [
          partner.id && partner.id.includes('-') && partner.id.length >= 32 ? partner.id : null,
          partner.personType || 'PJ',
          partner.name,
          partner.tradeName || null,
          partner.document.length > 11 ? 'CNPJ' : 'CPF',
          partner.document.replace(/\D/g, ''),
          partner.stateRegistration || null,
          partner.email || '',
          partner.phone || '',
          addressJson,
          partner.status || 'ACTIVE',
          partner.createdAt || new Date().toISOString(),
          partner.updatedAt || new Date().toISOString(),
        ]
      );
      return this.mapRow(res.rows[0], partner);
    });
  }

  async update(
    cleanCnpj: string,
    id: string,
    partner: Partial<BusinessPartner>
  ): Promise<BusinessPartner | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (partner.name !== undefined) {
        fields.push(`legal_name = $${idx++}`);
        values.push(partner.name);
      }
      if (partner.tradeName !== undefined) {
        fields.push(`trade_name = $${idx++}`);
        values.push(partner.tradeName);
      }
      if (partner.email !== undefined) {
        fields.push(`email = $${idx++}`);
        values.push(partner.email);
      }
      if (partner.phone !== undefined) {
        fields.push(`phone = $${idx++}`);
        values.push(partner.phone);
      }
      if (partner.address !== undefined) {
        fields.push(`address = $${idx++}`);
        values.push(JSON.stringify(partner.address));
      }
      if (partner.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(partner.status);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE "${schemaName}".partners SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async delete(cleanCnpj: string, id: string): Promise<boolean> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`DELETE FROM "${schemaName}".partners WHERE id = $1`, [id]);
      return (res.rowCount ?? 0) > 0;
    });
  }

  private mapRow(row: any, fallback?: BusinessPartner): BusinessPartner {
    const address = typeof row.address === 'string' ? JSON.parse(row.address) : row.address || {};
    return {
      id: row.id,
      personType: row.type || 'PJ',
      document: row.document,
      formattedDocument: fallback?.formattedDocument || row.document,
      roles: fallback?.roles || ['CLIENTE'],
      name: row.legal_name,
      tradeName: row.trade_name || undefined,
      stateRegistration: row.state_registration || undefined,
      municipalRegistration: fallback?.municipalRegistration,
      email: row.email || '',
      phone: row.phone || '',
      address,
      creditLimit: fallback?.creditLimit || 0,
      paymentTermsDays: fallback?.paymentTermsDays || 0,
      status: (row.status as any) || 'ACTIVE',
      notes: fallback?.notes,
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
    };
  }
}

export class InMemoryPartnerRepository implements IPartnerRepository {
  constructor(private getList: (cleanCnpj: string) => BusinessPartner[]) {}

  async list(
    cleanCnpj: string,
    filter?: { search?: string; role?: string; status?: string }
  ): Promise<BusinessPartner[]> {
    let items = this.getList(cleanCnpj);
    if (filter?.status) {
      items = items.filter((p) => p.status === filter.status);
    }
    if (filter?.role) {
      items = items.filter((p) => p.roles && p.roles.includes(filter.role as any));
    }
    if (filter?.search) {
      const s = filter.search.toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          (p.tradeName && p.tradeName.toLowerCase().includes(s)) ||
          p.document.includes(s)
      );
    }
    return items;
  }

  async findById(cleanCnpj: string, id: string): Promise<BusinessPartner | undefined> {
    return this.getList(cleanCnpj).find((p) => p.id === id);
  }

  async findByDocument(cleanCnpj: string, document: string): Promise<BusinessPartner | undefined> {
    const cleanDoc = document.replace(/\D/g, '');
    return this.getList(cleanCnpj).find((p) => p.document.replace(/\D/g, '') === cleanDoc);
  }

  async create(cleanCnpj: string, partner: BusinessPartner): Promise<BusinessPartner> {
    const list = this.getList(cleanCnpj);
    if (!list.some((p) => p.id === partner.id)) {
      list.push(partner);
    }
    return partner;
  }

  async update(
    cleanCnpj: string,
    id: string,
    partner: Partial<BusinessPartner>
  ): Promise<BusinessPartner | undefined> {
    const list = this.getList(cleanCnpj);
    const index = list.findIndex((p) => p.id === id);
    if (index === -1) return undefined;
    list[index] = { ...list[index], ...partner, updatedAt: new Date().toISOString() };
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
