/**
 * Enlace ERP - Fiscal & NF-e Repository
 * PRD 07: Emissão, Assinatura Digital, Transmissão SEFAZ e Inutilização
 */

import { FiscalDocument, FiscalInutilization } from '../../../shared/types.js';
import { PostgresService } from '../postgres.js';

export interface IFiscalRepository {
  listFiscalDocuments(cleanCnpj: string, filter?: { status?: string; model?: string }): Promise<FiscalDocument[]>;
  findFiscalDocumentById(cleanCnpj: string, id: string): Promise<FiscalDocument | undefined>;
  findFiscalDocumentByAccessKey(cleanCnpj: string, accessKey: string): Promise<FiscalDocument | undefined>;
  createFiscalDocument(cleanCnpj: string, doc: FiscalDocument): Promise<FiscalDocument>;
  updateFiscalDocument(cleanCnpj: string, id: string, updates: Partial<FiscalDocument>): Promise<FiscalDocument | undefined>;

  listInutilizations(cleanCnpj: string): Promise<FiscalInutilization[]>;
  createInutilization(cleanCnpj: string, inut: FiscalInutilization): Promise<FiscalInutilization>;
}

export class PostgresFiscalRepository implements IFiscalRepository {
  async listFiscalDocuments(
    cleanCnpj: string,
    filter?: { status?: string; model?: string }
  ): Promise<FiscalDocument[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".fiscal_documents WHERE 1=1`;
      const values: any[] = [];
      let idx = 1;

      if (filter?.status) {
        query += ` AND status = $${idx++}`;
        values.push(filter.status);
      }
      if (filter?.model) {
        query += ` AND model = $${idx++}`;
        values.push(filter.model);
      }

      query += ' ORDER BY created_at DESC';
      const res = await client.query(query, values);
      return res.rows.map((r) => this.mapDocRow(r));
    });
  }

  async findFiscalDocumentById(cleanCnpj: string, id: string): Promise<FiscalDocument | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".fiscal_documents WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapDocRow(res.rows[0]);
    });
  }

  async findFiscalDocumentByAccessKey(cleanCnpj: string, accessKey: string): Promise<FiscalDocument | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".fiscal_documents WHERE access_key = $1 LIMIT 1`,
        [accessKey]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapDocRow(res.rows[0]);
    });
  }

  async createFiscalDocument(cleanCnpj: string, doc: FiscalDocument): Promise<FiscalDocument> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const partnerAddressJson = JSON.stringify(doc.partnerAddress || {});
      const itemsJson = JSON.stringify(doc.items || []);

      const res = await client.query(
        `INSERT INTO "${schemaName}".fiscal_documents (
          id, model, series, number, access_key, issue_date, type, status,
          nature_of_operation, cfop_principal, partner_id, partner_name,
          partner_document, partner_address, items, total_amount, total_taxes,
          xml_content, sefaz_protocol, sefaz_status_code, sefaz_status_reason,
          created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW()
        ) RETURNING *`,
        [
          doc.id && doc.id.includes('-') && doc.id.length >= 32 ? doc.id : null,
          doc.model,
          doc.series,
          doc.number,
          doc.accessKey,
          doc.issueDate,
          doc.type,
          doc.status,
          doc.natureOfOperation,
          doc.cfopPrincipal,
          doc.partnerId || null,
          doc.partnerName,
          doc.partnerCnpjCpf,
          partnerAddressJson,
          itemsJson,
          doc.totalTaxableAmount || doc.totalProducts || 0,
          doc.totalICMS || 0,
          doc.xmlPayload || null,
          doc.protocolNumber || null,
          doc.status || null,
          doc.rejectionReason || null,
        ]
      );
      return this.mapDocRow(res.rows[0], doc);
    });
  }

  async updateFiscalDocument(
    cleanCnpj: string,
    id: string,
    updates: Partial<FiscalDocument>
  ): Promise<FiscalDocument | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (updates.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(updates.status);
      }
      if (updates.protocolNumber !== undefined) {
        fields.push(`sefaz_protocol = $${idx++}`);
        values.push(updates.protocolNumber);
      }
      if (updates.rejectionReason !== undefined) {
        fields.push(`sefaz_status_reason = $${idx++}`);
        values.push(updates.rejectionReason);
      }
      if (updates.xmlPayload !== undefined) {
        fields.push(`xml_content = $${idx++}`);
        values.push(updates.xmlPayload);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE "${schemaName}".fiscal_documents SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) return undefined;
      return this.mapDocRow(res.rows[0]);
    });
  }

  async listInutilizations(cleanCnpj: string): Promise<FiscalInutilization[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".audit_logs WHERE action = 'FISCAL_INUTILIZATION' ORDER BY timestamp DESC`
      );
      return res.rows.map((r) => {
        const details = typeof r.details === 'string' ? JSON.parse(r.details) : r.details || {};
        return {
          id: r.id,
          model: details.model || 'NFE_55',
          series: details.series || '1',
          startNumber: details.startNumber || 0,
          endNumber: details.endNumber || 0,
          year: details.year || new Date().getFullYear(),
          justification: details.justification || '',
          protocolNumber: details.protocolNumber || 'SEFAZ-INUT-MOCK',
          registeredAt: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
          registeredByName: details.registeredByName || 'Auditor Fiscal',
        };
      });
    });
  }

  async createInutilization(cleanCnpj: string, inut: FiscalInutilization): Promise<FiscalInutilization> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      await client.query(
        `INSERT INTO "${schemaName}".audit_logs (
          id, timestamp, action, resource, resource_id, status, request_id, details
        ) VALUES (
          COALESCE($1, gen_random_uuid()), NOW(), 'FISCAL_INUTILIZATION', 'fiscal_documents', $2, 'SUCCESS', 'req-inut', $3
        )`,
        [
          inut.id && inut.id.includes('-') && inut.id.length >= 32 ? inut.id : null,
          `inut-${inut.series}-${inut.startNumber}-${inut.endNumber}`,
          JSON.stringify(inut),
        ]
      );
      return inut;
    });
  }

  private mapDocRow(row: any, fallback?: FiscalDocument): FiscalDocument {
    const partnerAddress = typeof row.partner_address === 'string' ? JSON.parse(row.partner_address) : row.partner_address || {};
    const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items || [];

    return {
      id: row.id,
      companyId: fallback?.companyId || 'company_id',
      model: row.model,
      series: row.series,
      number: Number(row.number),
      accessKey: row.access_key,
      issueDate: row.issue_date,
      issueTime: fallback?.issueTime || '12:00:00',
      type: row.type,
      status: row.status,
      natureOfOperation: row.nature_of_operation,
      cfopPrincipal: row.cfop_principal,
      partnerId: row.partner_id || undefined,
      partnerName: row.partner_name,
      partnerCnpjCpf: row.partner_document,
      partnerAddress,
      items,
      totalProducts: Number(row.total_amount),
      totalServices: 0,
      totalDiscounts: 0,
      totalFreight: 0,
      totalInsurance: 0,
      totalOtherExpenses: 0,
      totalTaxableAmount: Number(row.total_amount),
      totalICMS: Number(row.total_taxes),
      totalIPI: 0,
      totalPIS: 0,
      totalCOFINS: 0,
      totalISS: 0,
      totalWithheldTaxes: 0,
      totalApproximateTaxes: 0,
      netTotal: Number(row.total_amount),
      protocolNumber: row.sefaz_protocol || undefined,
      rejectionReason: row.sefaz_status_reason || undefined,
      correctionLetters: [],
      xmlPayload: row.xml_content || undefined,
      createdById: fallback?.createdById || 'system',
      createdByName: fallback?.createdByName || 'Sistema',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : fallback?.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : fallback?.updatedAt || new Date().toISOString(),
    };
  }
}

export class InMemoryFiscalRepository implements IFiscalRepository {
  constructor(
    private getDocs: (cleanCnpj: string) => FiscalDocument[],
    private getInuts: (cleanCnpj: string) => FiscalInutilization[]
  ) {}

  async listFiscalDocuments(cleanCnpj: string, filter?: { status?: string; model?: string }): Promise<FiscalDocument[]> {
    let docs = this.getDocs(cleanCnpj);
    if (filter?.status) docs = docs.filter((d) => d.status === filter.status);
    if (filter?.model) docs = docs.filter((d) => d.model === filter.model);
    return [...docs];
  }

  async findFiscalDocumentById(cleanCnpj: string, id: string): Promise<FiscalDocument | undefined> {
    return this.getDocs(cleanCnpj).find((d) => d.id === id);
  }

  async findFiscalDocumentByAccessKey(cleanCnpj: string, accessKey: string): Promise<FiscalDocument | undefined> {
    return this.getDocs(cleanCnpj).find((d) => d.accessKey === accessKey);
  }

  async createFiscalDocument(cleanCnpj: string, doc: FiscalDocument): Promise<FiscalDocument> {
    this.getDocs(cleanCnpj).unshift(doc);
    return doc;
  }

  async updateFiscalDocument(cleanCnpj: string, id: string, updates: Partial<FiscalDocument>): Promise<FiscalDocument | undefined> {
    const docs = this.getDocs(cleanCnpj);
    const idx = docs.findIndex((d) => d.id === id);
    if (idx === -1) return undefined;
    docs[idx] = { ...docs[idx], ...updates };
    return docs[idx];
  }

  async listInutilizations(cleanCnpj: string): Promise<FiscalInutilization[]> {
    return [...this.getInuts(cleanCnpj)];
  }

  async createInutilization(cleanCnpj: string, inut: FiscalInutilization): Promise<FiscalInutilization> {
    this.getInuts(cleanCnpj).unshift(inut);
    return inut;
  }
}
