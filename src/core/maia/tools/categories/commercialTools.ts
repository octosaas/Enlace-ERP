/**
 * Enlace ERP - MaIA v2 Commercial Tools
 * PRD 03 & PRD 04 - Clientes, Produtos, Vendas e Ordens de Serviço
 */

import { AIToolDefinition, AIPrincipalContext } from '../types.js';
import { PERMISSIONS } from '../../../../shared/permissions.js';
import { RepositoryManager } from '../../../database/repositories/index.js';

export const commercialTools: AIToolDefinition[] = [
  {
    name: 'erp.consultar_clientes',
    description: 'Consulta parceiros de negócios (clientes e fornecedores) cadastrados na empresa ativa.',
    category: 'commercial',
    requiredPermission: PERMISSIONS.CUSTOMERS_READ,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Termo de busca por razão social, nome fantasia ou CNPJ/CPF',
        },
        role: {
          type: 'string',
          description: 'Papel do parceiro: CUSTOMER, SUPPLIER, CARRIER',
          enum: ['CUSTOMER', 'SUPPLIER', 'CARRIER'],
        },
      },
    },
    execute: async (context: AIPrincipalContext, params: { search?: string; role?: string }) => {
      const cleanCnpj = context.activeCompany.cnpj.replace(/\D/g, '');
      const repos = RepositoryManager.getInstance().getRepositories();
      const partners = await repos.partners.list(cleanCnpj, {
        search: params.search,
        role: params.role,
      });

      return {
        totalRecords: partners.length,
        items: partners.slice(0, 20).map((p: any) => ({
          id: p.id,
          legalName: p.legalName,
          tradeName: p.tradeName,
          document: p.document,
          email: p.email,
          phone: p.phone,
          status: p.status,
          roles: p.roles,
        })),
      };
    },
  },

  {
    name: 'erp.consultar_produtos',
    description: 'Consulta o catálogo de produtos e serviços cadastrados na empresa ativa.',
    category: 'commercial',
    requiredPermission: PERMISSIONS.PRODUCTS_READ,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Termo de busca por nome do produto, SKU ou código de barras',
        },
      },
    },
    execute: async (context: AIPrincipalContext, params: { search?: string }) => {
      const cleanCnpj = context.activeCompany.cnpj.replace(/\D/g, '');
      const repos = RepositoryManager.getInstance().getRepositories();
      let products = await repos.products.list(cleanCnpj);
      if (params.search) {
        const s = params.search.toLowerCase();
        products = products.filter(
          (p: any) =>
            (p.name && p.name.toLowerCase().includes(s)) ||
            (p.sku && p.sku.toLowerCase().includes(s))
        );
      }

      return {
        totalRecords: products.length,
        items: products.slice(0, 25).map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          price: p.price,
          unit: p.unit,
          status: p.status,
          ncm: p.ncm,
        })),
      };
    },
  },

  {
    name: 'erp.consultar_vendas',
    description: 'Consulta pedidos de venda emitidos para a empresa ativa.',
    category: 'commercial',
    requiredPermission: PERMISSIONS.SALES_READ,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filtro opcional por status: DRAFT, CONFIRMED, CANCELLED',
          enum: ['DRAFT', 'CONFIRMED', 'CANCELLED'],
        },
      },
    },
    execute: async (context: AIPrincipalContext, params: { status?: string }) => {
      const cleanCnpj = context.activeCompany.cnpj.replace(/\D/g, '');
      const repos = RepositoryManager.getInstance().getRepositories();
      const sales = await repos.sales.listSales(cleanCnpj, {
        status: params.status,
      });

      const totalValue = sales.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);

      return {
        totalRecords: sales.length,
        totalSalesValueBRL: Math.round(totalValue * 100) / 100,
        items: sales.slice(0, 20).map((s: any) => ({
          id: s.id,
          orderNumber: s.orderNumber,
          customerName: s.customerName,
          totalAmount: s.totalAmount,
          status: s.status,
          saleDate: s.saleDate,
        })),
      };
    },
  },

  {
    name: 'erp.consultar_ordens_servico',
    description: 'Consulta ordens de serviço (OS) cadastradas e seus estágios de execução.',
    category: 'commercial',
    requiredPermission: PERMISSIONS.SERVICE_ORDERS_READ,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Status da OS: OPEN, IN_PROGRESS, COMPLETED, CANCELLED',
          enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        },
      },
    },
    execute: async (context: AIPrincipalContext, params: { status?: string }) => {
      const cleanCnpj = context.activeCompany.cnpj.replace(/\D/g, '');
      const repos = RepositoryManager.getInstance().getRepositories();
      const orders = await repos.sales.listServiceOrders(cleanCnpj, {
        status: params.status,
      });

      return {
        totalRecords: orders.length,
        items: orders.slice(0, 20).map((o: any) => ({
          id: o.id,
          code: o.code,
          customerName: o.customerName,
          status: o.status,
          totalAmount: o.totalAmount,
          scheduledDate: o.scheduledDate,
        })),
      };
    },
  },
];
