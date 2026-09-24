/**
 * Enlace ERP - Financial, Payables & Treasury Repository
 * PRD 05 & PRD 09: Contas a Pagar, Contas Bancárias, Liquidação e Conciliação
 */

import { AccountPayable, BankAccount, BankSlip, PixCharge } from '../../../shared/types.js';
import { PostgresService } from '../postgres.js';

export interface IFinancialRepository {
  listPayables(cleanCnpj: string, filter?: { status?: string; supplierId?: string }): Promise<AccountPayable[]>;
  findPayableById(cleanCnpj: string, id: string): Promise<AccountPayable | undefined>;
  createPayable(cleanCnpj: string, payable: AccountPayable): Promise<AccountPayable>;
  updatePayable(cleanCnpj: string, id: string, updates: Partial<AccountPayable>): Promise<AccountPayable | undefined>;
  settlePayableTransaction(
    cleanCnpj: string,
    payableId: string,
    amount: number,
    bankAccountId?: string
  ): Promise<AccountPayable>;

  listBankAccounts(cleanCnpj: string): Promise<BankAccount[]>;
  findBankAccountById(cleanCnpj: string, id: string): Promise<BankAccount | undefined>;
  createBankAccount(cleanCnpj: string, account: BankAccount): Promise<BankAccount>;
  updateBankBalance(cleanCnpj: string, id: string, newBalance: number): Promise<BankAccount | undefined>;

  listBankSlips(cleanCnpj: string): Promise<BankSlip[]>;
  findBankSlipById(cleanCnpj: string, id: string): Promise<BankSlip | undefined>;
  createBankSlip(cleanCnpj: string, slip: BankSlip): Promise<BankSlip>;
  updateBankSlip(cleanCnpj: string, id: string, updates: Partial<BankSlip>): Promise<BankSlip | undefined>;

  listPixCharges(cleanCnpj: string): Promise<PixCharge[]>;
  findPixChargeByTxid(cleanCnpj: string, txid: string): Promise<PixCharge | undefined>;
  createPixCharge(cleanCnpj: string, charge: PixCharge): Promise<PixCharge>;
  updatePixCharge(cleanCnpj: string, txid: string, updates: Partial<PixCharge>): Promise<PixCharge | undefined>;
}

export class PostgresFinancialRepository implements IFinancialRepository {
  async listPayables(
    cleanCnpj: string,
    filter?: { status?: string; supplierId?: string }
  ): Promise<AccountPayable[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      let query = `SELECT * FROM "${schemaName}".accounts_payable WHERE 1=1`;
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

      query += ' ORDER BY due_date ASC';
      const res = await client.query(query, values);
      return res.rows.map((r) => this.mapPayableRow(r));
    });
  }

  async findPayableById(cleanCnpj: string, id: string): Promise<AccountPayable | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".accounts_payable WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapPayableRow(res.rows[0]);
    });
  }

  async createPayable(cleanCnpj: string, p: AccountPayable): Promise<AccountPayable> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `INSERT INTO "${schemaName}".accounts_payable (
          id, document_number, supplier_id, supplier_name, description,
          issue_date, due_date, amount, balance_amount, status,
          bank_account_id, notes, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
        ) RETURNING *`,
        [
          p.id && p.id.includes('-') && p.id.length >= 32 ? p.id : null,
          p.number,
          p.supplierId,
          p.supplierName,
          p.description,
          p.issueDate,
          p.dueDate,
          p.originalValue,
          p.balanceValue || p.originalValue,
          p.status || 'ABERTO',
          p.bankAccountId || null,
          p.notes || null,
        ]
      );
      return this.mapPayableRow(res.rows[0], p);
    });
  }

  async updatePayable(
    cleanCnpj: string,
    id: string,
    updates: Partial<AccountPayable>
  ): Promise<AccountPayable | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (updates.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(updates.status);
      }
      if (updates.paidValue !== undefined) {
        fields.push(`paid_amount = $${idx++}`);
        values.push(updates.paidValue);
      }
      if (updates.balanceValue !== undefined) {
        fields.push(`balance_amount = $${idx++}`);
        values.push(updates.balanceValue);
      }
      if (updates.paidAt !== undefined) {
        fields.push(`paid_at = $${idx++}`);
        values.push(updates.paidAt);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE "${schemaName}".accounts_payable SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) return undefined;
      return this.mapPayableRow(res.rows[0]);
    });
  }

  async settlePayableTransaction(
    cleanCnpj: string,
    payableId: string,
    amount: number,
    bankAccountId?: string
  ): Promise<AccountPayable> {
    return PostgresService.withTenantTransaction(cleanCnpj, async (client, schemaName) => {
      const payRes = await client.query(
        `SELECT * FROM "${schemaName}".accounts_payable WHERE id = $1 FOR UPDATE`,
        [payableId]
      );
      if (payRes.rows.length === 0) {
        throw new Error(`Título a pagar com ID ${payableId} não encontrado.`);
      }

      const row = payRes.rows[0];
      const curBalance = Number(row.balance_amount);
      const newBalance = Math.max(0, curBalance - amount);
      const newStatus: 'PAID' | 'PARTIALLY_PAID' = newBalance <= 0.001 ? 'PAID' : 'PARTIALLY_PAID';
      const prevPaid = Number(row.paid_amount || 0);
      const newPaid = prevPaid + amount;

      await client.query(
        `UPDATE "${schemaName}".accounts_payable
         SET balance_amount = $1, paid_amount = $2, status = $3,
             paid_at = NOW(), bank_account_id = COALESCE($4, bank_account_id), updated_at = NOW()
         WHERE id = $5`,
        [newBalance, newPaid, newStatus, bankAccountId || null, payableId]
      );

      // Se informou conta bancária, debita do saldo da conta
      if (bankAccountId) {
        await client.query(
          `UPDATE "${schemaName}".bank_accounts
           SET balance = balance - $1, updated_at = NOW()
           WHERE id = $2`,
          [amount, bankAccountId]
        );
      }

      const updatedRes = await client.query(
        `SELECT * FROM "${schemaName}".accounts_payable WHERE id = $1 LIMIT 1`,
        [payableId]
      );
      return this.mapPayableRow(updatedRes.rows[0]);
    });
  }

  async listBankAccounts(cleanCnpj: string): Promise<BankAccount[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".bank_accounts WHERE is_active = true ORDER BY bank_name ASC`
      );
      return res.rows.map((r) => this.mapBankRow(r));
    });
  }

  async findBankAccountById(cleanCnpj: string, id: string): Promise<BankAccount | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `SELECT * FROM "${schemaName}".bank_accounts WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapBankRow(res.rows[0]);
    });
  }

  async createBankAccount(cleanCnpj: string, b: BankAccount): Promise<BankAccount> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `INSERT INTO "${schemaName}".bank_accounts (
          id, bank_code, bank_name, agency, account_number, account_type,
          balance, is_active, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, true, NOW(), NOW()
        ) RETURNING *`,
        [
          b.id && b.id.includes('-') && b.id.length >= 32 ? b.id : null,
          b.bankCode,
          b.name,
          b.agency,
          b.accountNumber,
          b.accountType || 'CHECKING',
          b.currentBalance || b.initialBalance || 0,
        ]
      );
      return this.mapBankRow(res.rows[0], b);
    });
  }

  async updateBankBalance(cleanCnpj: string, id: string, newBalance: number): Promise<BankAccount | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `UPDATE "${schemaName}".bank_accounts SET balance = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [newBalance, id]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapBankRow(res.rows[0]);
    });
  }

  private mapPayableRow(row: any, fallback?: AccountPayable): AccountPayable {
    return {
      id: row.id,
      number: row.document_number,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      chartOfAccountId: fallback?.chartOfAccountId || 'coa-default',
      chartOfAccountCode: fallback?.chartOfAccountCode || '2.1.01',
      description: row.description,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      originalValue: Number(row.amount),
      discountValue: 0,
      fineValue: 0,
      interestValue: 0,
      paidValue: Number(row.paid_amount || 0),
      balanceValue: Number(row.balance_amount),
      status: row.status,
      bankAccountId: row.bank_account_id || undefined,
      paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : undefined,
      notes: row.notes || undefined,
      createdBy: fallback?.createdBy || 'system',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : fallback?.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : fallback?.updatedAt || new Date().toISOString(),
    };
  }

  private mapBankRow(row: any, fallback?: BankAccount): BankAccount {
    return {
      id: row.id,
      name: row.bank_name,
      bankCode: row.bank_code,
      agency: row.agency,
      accountNumber: row.account_number,
      accountType: row.account_type,
      currentBalance: Number(row.balance),
      initialBalance: fallback?.initialBalance || Number(row.balance),
      color: fallback?.color || '#004A80',
      isActive: row.is_active,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : fallback?.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : fallback?.updatedAt || new Date().toISOString(),
    };
  }

  async listBankSlips(cleanCnpj: string): Promise<BankSlip[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`SELECT * FROM "${schemaName}".bank_slips ORDER BY created_at DESC`);
      return res.rows.map((r) => this.mapSlipRow(r));
    });
  }

  async findBankSlipById(cleanCnpj: string, id: string): Promise<BankSlip | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`SELECT * FROM "${schemaName}".bank_slips WHERE id = $1 LIMIT 1`, [id]);
      if (res.rows.length === 0) return undefined;
      return this.mapSlipRow(res.rows[0]);
    });
  }

  async createBankSlip(cleanCnpj: string, slip: BankSlip): Promise<BankSlip> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      // Find a valid bank account id from schema if slip bank account is not uuid
      let bankAccId = slip.bankCode;
      const bankRes = await client.query(`SELECT id FROM "${schemaName}".bank_accounts LIMIT 1`);
      if (bankRes.rows.length > 0) {
        bankAccId = bankRes.rows[0].id;
      }

      const res = await client.query(
        `INSERT INTO "${schemaName}".bank_slips (
          id, bank_account_id, our_number, barcode, digitable_line, amount, due_date, status, payer_name, payer_document, created_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
        ) RETURNING *`,
        [
          slip.id && slip.id.includes('-') && slip.id.length >= 32 ? slip.id : null,
          bankAccId,
          slip.ourNumber,
          slip.barcode,
          slip.digitableLine,
          slip.amount,
          slip.dueDate,
          slip.status || 'REGISTERED',
          slip.payerName,
          slip.payerDocument,
        ]
      );
      return this.mapSlipRow(res.rows[0], slip);
    });
  }

  async updateBankSlip(cleanCnpj: string, id: string, updates: Partial<BankSlip>): Promise<BankSlip | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (updates.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(updates.status);
      }
      if (updates.paidAmount !== undefined || updates.paidDate !== undefined) {
        fields.push(`paid_at = NOW()`);
      }

      if (fields.length === 0) return this.findBankSlipById(cleanCnpj, id);

      values.push(id);
      const res = await client.query(
        `UPDATE "${schemaName}".bank_slips SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (res.rows.length === 0) return undefined;
      return this.mapSlipRow(res.rows[0]);
    });
  }

  async listPixCharges(cleanCnpj: string): Promise<PixCharge[]> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`SELECT * FROM "${schemaName}".pix_charges ORDER BY created_at DESC`);
      return res.rows.map((r) => this.mapPixRow(r));
    });
  }

  async findPixChargeByTxid(cleanCnpj: string, txid: string): Promise<PixCharge | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(`SELECT * FROM "${schemaName}".pix_charges WHERE txid = $1 LIMIT 1`, [txid]);
      if (res.rows.length === 0) return undefined;
      return this.mapPixRow(res.rows[0]);
    });
  }

  async createPixCharge(cleanCnpj: string, charge: PixCharge): Promise<PixCharge> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const res = await client.query(
        `INSERT INTO "${schemaName}".pix_charges (
          id, txid, amount, pix_copia_e_cola, qr_code_svg, status, debtor_name, debtor_document, created_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, NOW()
        ) RETURNING *`,
        [
          charge.id && charge.id.includes('-') && charge.id.length >= 32 ? charge.id : null,
          charge.txid,
          charge.amount,
          charge.emvPayload,
          charge.qrCodeSvg || null,
          charge.status || 'ACTIVE',
          charge.customerName,
          charge.customerDocument,
        ]
      );
      return this.mapPixRow(res.rows[0], charge);
    });
  }

  async updatePixCharge(cleanCnpj: string, txid: string, updates: Partial<PixCharge>): Promise<PixCharge | undefined> {
    return PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (updates.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(updates.status);
      }
      if (updates.paidAt !== undefined) {
        fields.push(`paid_at = NOW()`);
      }

      if (fields.length === 0) return this.findPixChargeByTxid(cleanCnpj, txid);

      values.push(txid);
      const res = await client.query(
        `UPDATE "${schemaName}".pix_charges SET ${fields.join(', ')} WHERE txid = $${idx} RETURNING *`,
        values
      );
      if (res.rows.length === 0) return undefined;
      return this.mapPixRow(res.rows[0]);
    });
  }

  private mapSlipRow(row: any, fallback?: BankSlip): BankSlip {
    return {
      id: row.id,
      ourNumber: row.our_number,
      documentNumber: fallback?.documentNumber || `BOL-${row.our_number}`,
      barcode: row.barcode,
      digitableLine: row.digitable_line,
      bankCode: fallback?.bankCode || '341',
      bankName: fallback?.bankName || 'Banco Itaú',
      agency: fallback?.agency || '0001',
      account: fallback?.account || '00000',
      wallet: fallback?.wallet || '109',
      payerName: row.payer_name,
      payerDocument: row.payer_document,
      beneficiaryName: fallback?.beneficiaryName || 'Empresa',
      beneficiaryDocument: fallback?.beneficiaryDocument || '',
      issueDate: fallback?.issueDate || new Date().toISOString().split('T')[0],
      dueDate: row.due_date,
      amount: Number(row.amount),
      finePercent: fallback?.finePercent || 2.0,
      interestMonthlyPercent: fallback?.interestMonthlyPercent || 1.0,
      status: row.status,
      paidDate: row.paid_at ? new Date(row.paid_at).toISOString() : undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }

  private mapPixRow(row: any, fallback?: PixCharge): PixCharge {
    return {
      id: row.id,
      txid: row.txid,
      customerName: row.debtor_name,
      customerDocument: row.debtor_document,
      description: fallback?.description || 'Cobrança Pix Dinâmico',
      amount: Number(row.amount),
      keyType: fallback?.keyType || 'CNPJ',
      key: fallback?.key || '',
      emvPayload: row.pix_copia_e_cola,
      qrCodeSvg: row.qr_code_svg || '',
      status: row.status,
      expiresAt: fallback?.expiresAt || new Date(Date.now() + 86400000).toISOString(),
      paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }
}

export class InMemoryFinancialRepository implements IFinancialRepository {
  constructor(
    private getPayables: (cleanCnpj: string) => AccountPayable[],
    private getBankAccounts: (cleanCnpj: string) => BankAccount[],
    private getBankSlips?: (cleanCnpj: string) => BankSlip[],
    private getPixCharges?: (cleanCnpj: string) => PixCharge[]
  ) {}

  async listPayables(cleanCnpj: string, filter?: { status?: string; supplierId?: string }): Promise<AccountPayable[]> {
    let pays = this.getPayables(cleanCnpj);
    if (filter?.status) pays = pays.filter((p) => p.status === filter.status);
    if (filter?.supplierId) pays = pays.filter((p) => p.supplierId === filter.supplierId);
    return [...pays];
  }

  async findPayableById(cleanCnpj: string, id: string): Promise<AccountPayable | undefined> {
    return this.getPayables(cleanCnpj).find((p) => p.id === id);
  }

  async createPayable(cleanCnpj: string, payable: AccountPayable): Promise<AccountPayable> {
    this.getPayables(cleanCnpj).unshift(payable);
    return payable;
  }

  async updatePayable(cleanCnpj: string, id: string, updates: Partial<AccountPayable>): Promise<AccountPayable | undefined> {
    const pays = this.getPayables(cleanCnpj);
    const idx = pays.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    pays[idx] = { ...pays[idx], ...updates };
    return pays[idx];
  }

  async settlePayableTransaction(cleanCnpj: string, payableId: string, amount: number, bankAccountId?: string): Promise<AccountPayable> {
    const pays = this.getPayables(cleanCnpj);
    const p = pays.find((x) => x.id === payableId);
    if (!p) throw new Error(`Título a pagar não encontrado.`);
    p.balanceValue = Math.max(0, p.balanceValue - amount);
    p.paidValue = (p.paidValue || 0) + amount;
    p.status = p.balanceValue <= 0.001 ? 'PAID' : 'PARTIALLY_PAID';
    p.paidAt = new Date().toISOString();
    p.bankAccountId = bankAccountId || p.bankAccountId;

    if (bankAccountId) {
      const bank = this.getBankAccounts(cleanCnpj).find((b) => b.id === bankAccountId);
      if (bank) {
        bank.currentBalance -= amount;
        bank.updatedAt = new Date().toISOString();
      }
    }
    return p;
  }

  async listBankAccounts(cleanCnpj: string): Promise<BankAccount[]> {
    return [...this.getBankAccounts(cleanCnpj)];
  }

  async findBankAccountById(cleanCnpj: string, id: string): Promise<BankAccount | undefined> {
    return this.getBankAccounts(cleanCnpj).find((b) => b.id === id);
  }

  async createBankAccount(cleanCnpj: string, account: BankAccount): Promise<BankAccount> {
    this.getBankAccounts(cleanCnpj).unshift(account);
    return account;
  }

  async updateBankBalance(cleanCnpj: string, id: string, newBalance: number): Promise<BankAccount | undefined> {
    const bank = this.getBankAccounts(cleanCnpj).find((b) => b.id === id);
    if (!bank) return undefined;
    bank.currentBalance = newBalance;
    bank.updatedAt = new Date().toISOString();
    return bank;
  }

  async listBankSlips(cleanCnpj: string): Promise<BankSlip[]> {
    if (!this.getBankSlips) return [];
    return [...this.getBankSlips(cleanCnpj)];
  }

  async findBankSlipById(cleanCnpj: string, id: string): Promise<BankSlip | undefined> {
    if (!this.getBankSlips) return undefined;
    return this.getBankSlips(cleanCnpj).find((b) => b.id === id);
  }

  async createBankSlip(cleanCnpj: string, slip: BankSlip): Promise<BankSlip> {
    if (this.getBankSlips) {
      this.getBankSlips(cleanCnpj).unshift(slip);
    }
    return slip;
  }

  async updateBankSlip(cleanCnpj: string, id: string, updates: Partial<BankSlip>): Promise<BankSlip | undefined> {
    if (!this.getBankSlips) return undefined;
    const slips = this.getBankSlips(cleanCnpj);
    const idx = slips.findIndex((s) => s.id === id);
    if (idx === -1) return undefined;
    slips[idx] = { ...slips[idx], ...updates, updatedAt: new Date().toISOString() };
    return slips[idx];
  }

  async listPixCharges(cleanCnpj: string): Promise<PixCharge[]> {
    if (!this.getPixCharges) return [];
    return [...this.getPixCharges(cleanCnpj)];
  }

  async findPixChargeByTxid(cleanCnpj: string, txid: string): Promise<PixCharge | undefined> {
    if (!this.getPixCharges) return undefined;
    return this.getPixCharges(cleanCnpj).find((c) => c.txid === txid);
  }

  async createPixCharge(cleanCnpj: string, charge: PixCharge): Promise<PixCharge> {
    if (this.getPixCharges) {
      this.getPixCharges(cleanCnpj).unshift(charge);
    }
    return charge;
  }

  async updatePixCharge(cleanCnpj: string, txid: string, updates: Partial<PixCharge>): Promise<PixCharge | undefined> {
    if (!this.getPixCharges) return undefined;
    const charges = this.getPixCharges(cleanCnpj);
    const idx = charges.findIndex((c) => c.txid === txid);
    if (idx === -1) return undefined;
    charges[idx] = { ...charges[idx], ...updates, updatedAt: new Date().toISOString() };
    return charges[idx];
  }
}
