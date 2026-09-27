/**
 * Enlace ERP - MaIA v2 Action Tools (Operações de Escrita com Confirmação)
 * PRD 05 & PRD 09 - Cobrança, Títulos e Pagamentos
 */

import crypto from 'crypto';
import { AIToolDefinition, AIPrincipalContext } from '../types.js';
import { PERMISSIONS } from '../../../../shared/permissions.js';
import { RepositoryManager } from '../../../database/repositories/index.js';
import { ValidationError, NotFoundError } from '../../../errors/index.js';

export const actionTools: AIToolDefinition[] = [
  {
    name: 'erp.criar_cobranca',
    description: 'Gera um novo título de cobrança a receber no ERP para um cliente.',
    category: 'action',
    requiredPermission: PERMISSIONS.RECEIVABLES_CREATE,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        customerId: {
          type: 'string',
          description: 'Identificador do cliente (UUID)',
        },
        customerName: {
          type: 'string',
          description: 'Nome completo ou Razão Social do cliente',
        },
        originalAmount: {
          type: 'number',
          description: 'Valor original da cobrança em Reais (BRL)',
        },
        dueDate: {
          type: 'string',
          description: 'Data de vencimento (formato YYYY-MM-DD)',
        },
        description: {
          type: 'string',
          description: 'Descrição do lançamento/serviço',
        },
      },
      required: ['customerName', 'originalAmount', 'dueDate'],
    },
    execute: async (
      context: AIPrincipalContext,
      params: {
        customerId?: string;
        customerName: string;
        originalAmount: number;
        dueDate: string;
        description?: string;
      }
    ) => {
      const cleanCnpj = context.activeCompany.cnpj.replace(/\D/g, '');
      const repos = RepositoryManager.getInstance().getRepositories();

      if (params.originalAmount <= 0) {
        throw new ValidationError('O valor original da cobrança deve ser estritamente positivo.');
      }

      const amt = Math.round(params.originalAmount * 100) / 100;
      const receivable = await repos.receivables.createReceivable(cleanCnpj, {
        id: `rec-${crypto.randomUUID().slice(0, 8)}`,
        instanceId: context.activeCompany.id,
        customerId: params.customerId || `cust-${Date.now()}`,
        customerName: params.customerName,
        customerDocument: '00000000000',
        originalAmount: amt,
        paidAmount: 0,
        remainingAmount: amt,
        currentAmount: amt,
        discountAmount: 0,
        interestAmount: 0,
        fineAmount: 0,
        installments: [],
        dueDate: params.dueDate,
        issueDate: new Date().toISOString().split('T')[0],
        status: 'PENDING',
        description: params.description || 'Cobrança gerada com assistência da MaIA',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return {
        success: true,
        message: `Cobrança #${receivable.id} gerada com sucesso para ${params.customerName}.`,
        receivable: {
          id: receivable.id,
          customerName: receivable.customerName,
          amountBRL: receivable.originalAmount,
          dueDate: receivable.dueDate,
          status: receivable.status,
        },
      };
    },
  },

  {
    name: 'erp.cancelar_cobranca',
    description: 'Cancela um título de cobrança pendente no ERP.',
    category: 'action',
    requiredPermission: PERMISSIONS.RECEIVABLES_CANCEL,
    riskLevel: 'high',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        receivableId: {
          type: 'string',
          description: 'Identificador único do título (UUID)',
        },
        reason: {
          type: 'string',
          description: 'Motivo do cancelamento',
        },
      },
      required: ['receivableId'],
    },
    execute: async (context: AIPrincipalContext, params: { receivableId: string; reason?: string }) => {
      const cleanCnpj = context.activeCompany.cnpj.replace(/\D/g, '');
      const repos = RepositoryManager.getInstance().getRepositories();

      const existing = await repos.receivables.findReceivableById(cleanCnpj, params.receivableId);
      if (!existing) {
        throw new NotFoundError(`Título '${params.receivableId}' não localizado no schema da empresa ativa.`);
      }

      if (existing.status === 'PAID') {
        throw new ValidationError('Títulos liquidados não podem ser cancelados diretamente.');
      }

      const updated = await repos.receivables.updateReceivable(cleanCnpj, params.receivableId, {
        status: 'CANCELED',
      });

      return {
        success: true,
        message: `Título #${params.receivableId} cancelado com sucesso. Motivo: ${params.reason || 'Solicitação operacional via MaIA'}.`,
        receivable: updated,
      };
    },
  },

  {
    name: 'erp.registrar_pagamento',
    description: 'Registra a liquidação/pagamento manual de um título no ERP.',
    category: 'action',
    requiredPermission: PERMISSIONS.RECEIVABLES_PAY,
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        receivableId: {
          type: 'string',
          description: 'Identificador do título a liquidar (UUID)',
        },
        paidAmount: {
          type: 'number',
          description: 'Valor pago em Reais (BRL)',
        },
        paymentMethod: {
          type: 'string',
          description: 'Meio de liquidação: PIX, BOLETO, TRANSFERENCIA, CARTAO, DINHEIRO',
          enum: ['PIX', 'BOLETO', 'TRANSFERENCIA', 'CARTAO', 'DINHEIRO'],
        },
      },
      required: ['receivableId', 'paidAmount'],
    },
    execute: async (
      context: AIPrincipalContext,
      params: { receivableId: string; paidAmount: number; paymentMethod?: string }
    ) => {
      const cleanCnpj = context.activeCompany.cnpj.replace(/\D/g, '');
      const repos = RepositoryManager.getInstance().getRepositories();

      const existing = await repos.receivables.findReceivableById(cleanCnpj, params.receivableId);
      if (!existing) {
        throw new NotFoundError(`Título '${params.receivableId}' não localizado.`);
      }

      const newPaid = (existing.paidAmount || 0) + params.paidAmount;
      const isFull = newPaid >= existing.originalAmount;

      const updated = await repos.receivables.updateReceivable(cleanCnpj, params.receivableId, {
        paidAmount: Math.round(newPaid * 100) / 100,
        remainingAmount: Math.max(0, Math.round((existing.originalAmount - newPaid) * 100) / 100),
        status: isFull ? 'PAID' : 'PENDING',
      });

      return {
        success: true,
        message: `Pagamento de R$ ${params.paidAmount} registrado com sucesso para o título #${params.receivableId}. Novo status: ${updated?.status}`,
        receivable: updated,
      };
    },
  },
];
