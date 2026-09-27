/**
 * Enlace ERP - MaIA v2 Inventory Tools
 * PRD 06 - Estoque, Almoxarifados e CMP
 */

import { AIToolDefinition, AIPrincipalContext } from '../types.js';
import { PERMISSIONS } from '../../../../shared/permissions.js';
import { RepositoryManager } from '../../../database/repositories/index.js';

export const inventoryTools: AIToolDefinition[] = [
  {
    name: 'erp.consultar_estoque',
    description: 'Consulta posições de estoque, saldos físicos, almoxarifados e Custo Médio Ponderado (CMP).',
    category: 'inventory',
    requiredPermission: PERMISSIONS.INVENTORY_READ,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        warehouseId: {
          type: 'string',
          description: 'Filtro opcional por ID do almoxarifado/depósito',
        },
      },
    },
    execute: async (context: AIPrincipalContext, params: { warehouseId?: string }) => {
      const cleanCnpj = context.activeCompany.cnpj.replace(/\D/g, '');
      const repos = RepositoryManager.getInstance().getRepositories();

      const [items, warehouses] = await Promise.all([
        repos.inventory.listStockItems(cleanCnpj, params.warehouseId),
        repos.inventory.listWarehouses(cleanCnpj),
      ]);

      const totalValuation = items.reduce((sum: number, item: any) => sum + (item.quantity * item.averageCost), 0);

      return {
        totalStockRecords: items.length,
        totalValuationBRL: Math.round(totalValuation * 100) / 100,
        warehouses: warehouses.map((w: any) => ({ id: w.id, name: w.name, code: w.code })),
        items: items.slice(0, 30).map((i: any) => ({
          id: i.id,
          productId: i.productId,
          warehouseId: i.warehouseId,
          quantity: i.quantity,
          availableQuantity: i.availableQuantity,
          averageCostBRL: i.averageCost,
          totalValueBRL: Math.round(i.quantity * i.averageCost * 100) / 100,
        })),
      };
    },
  },
];
