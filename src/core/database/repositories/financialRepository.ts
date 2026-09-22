/**
 * Enlace ERP - Financial, Payables & Treasury Repository
 * PRD 05 & PRD 09: Contas a Pagar, Contas Bancárias, Liquidação e Conciliação
 */

import { AccountPayable, BankAccount } from '../../../shared/types.js';
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
}

export class InMemoryFinancialRepository implements IFinancialRepository {
  constructor(
    private getPayables: (cleanCnpj: string) => AccountPayable[],
    private getBankAccounts: (cleanCnpj: string) => BankAccount[]
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
}
