/**
 * Enlace ERP - MaIA v2 Financial Tools
 * PRD 05 - Finanças, Tesouraria e Contas
 */

import { AIToolDefinition, AIPrincipalContext } from '../types.js';
import { PERMISSIONS } from '../../../../shared/permissions.js';
import { RepositoryManager } from '../../../database/repositories/index.js';

export const financialTools: AIToolDefinition[] = [
  {
    name: 'erp.consultar_contas_receber',
    description: 'Consulta títulos e valores a receber da empresa ativa, com filtros por status e cliente.',
    category: 'financial',
    requiredPermission: PERMISSIONS.RECEIVABLES_READ,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filtro opcional por status: PENDING, PAID, OVERDUE, CANCELLED',
          enum: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'],
        },
        limit: {
          type: 'number',
          description: 'Número máximo de registros a retornar (padrão 20)',
        },
      },
    },
    execute: async (context: AIPrincipalContext, params: { status?: string; limit?: number }) => {
      const cleanCnpj = context.activeCompany.cnpj.replace(/\D/g, '');
      const repos = RepositoryManager.getInstance().getRepositories();
      const receivables = await repos.receivables.listReceivables(cleanCnpj, {
        status: params.status,
      });

      const limit = params.limit || 20;
      const sliced = receivables.slice(0, limit);

      const totalPending = receivables
        .filter((r: any) => r.status === 'PENDING')
        .reduce((sum: number, r: any) => sum + (r.remainingAmount || r.originalAmount), 0);

      const totalOverdue = receivables
        .filter((r: any) => r.status === 'OVERDUE')
        .reduce((sum: number, r: any) => sum + (r.remainingAmount || r.originalAmount), 0);

      const totalPaid = receivables
        .filter((r: any) => r.status === 'PAID')
        .reduce((sum: number, r: any) => sum + (r.paidAmount || r.originalAmount), 0);

      return {
        totalRecords: receivables.length,
        returnedRecords: sliced.length,
        summary: {
          totalPendingBRL: Math.round(totalPending * 100) / 100,
          totalOverdueBRL: Math.round(totalOverdue * 100) / 100,
          totalPaidBRL: Math.round(totalPaid * 100) / 100,
        },
        items: sliced.map((r: any) => ({
          id: r.id,
          customerName: r.customerName,
          originalAmount: r.originalAmount,
          remainingAmount: r.remainingAmount,
          status: r.status,
          dueDate: r.dueDate,
          description: r.description,
        })),
      };
    },
  },

  {
    name: 'erp.consultar_contas_pagar',
    description: 'Consulta títulos e contas a pagar a fornecedores no schema da empresa ativa.',
    category: 'financial',
    requiredPermission: PERMISSIONS.PAYABLES_READ,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filtro opcional por status da conta a pagar: PENDING, PAID, OVERDUE',
          enum: ['PENDING', 'PAID', 'OVERDUE'],
        },
      },
    },
    execute: async (context: AIPrincipalContext, params: { status?: string }) => {
      const cleanCnpj = context.activeCompany.cnpj.replace(/\D/g, '');
      const repos = RepositoryManager.getInstance().getRepositories();
      const payables = await repos.financial.listPayables(cleanCnpj);

      let filtered = payables;
      if (params.status) {
        filtered = payables.filter((p: any) => p.status === params.status);
      }

      const totalAmount = filtered.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      return {
        totalRecords: filtered.length,
        totalAmountBRL: Math.round(totalAmount * 100) / 100,
        items: filtered.slice(0, 20).map((p: any) => ({
          id: p.id,
          supplierName: p.supplierName,
          amount: p.amount,
          dueDate: p.dueDate,
          status: p.status,
          description: p.description,
        })),
      };
    },
  },

  {
    name: 'erp.consultar_fluxo_caixa',
    description: 'Consulta saldos consolidados de contas bancárias e posição de liquidez de tesouraria.',
    category: 'financial',
    requiredPermission: PERMISSIONS.CASHFLOW_VIEW,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (context: AIPrincipalContext) => {
      const cleanCnpj = context.activeCompany.cnpj.replace(/\D/g, '');
      const repos = RepositoryManager.getInstance().getRepositories();
      const accounts = await repos.financial.listBankAccounts(cleanCnpj);

      const totalBalance = accounts.reduce((sum: number, a: any) => sum + (a.balance || 0), 0);

      return {
        activeAccountsCount: accounts.length,
        totalConsolidatedLiquidityBRL: Math.round(totalBalance * 100) / 100,
        accounts: accounts.map((a: any) => ({
          id: a.id,
          bankName: a.bankName,
          accountType: a.accountType,
          balance: a.balance,
          agency: a.agency,
          accountNumber: a.accountNumber,
        })),
      };
    },
  },
];
