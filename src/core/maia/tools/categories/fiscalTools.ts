/**
 * Enlace ERP - MaIA v2 Fiscal Tools
 * PRD 07 - Módulo Fiscal, NF-e e Documentos Eletrônicos
 */

import { AIToolDefinition, AIPrincipalContext } from '../types.js';
import { PERMISSIONS } from '../../../../shared/permissions.js';
import { RepositoryManager } from '../../../database/repositories/index.js';

export const fiscalTools: AIToolDefinition[] = [
  {
    name: 'erp.consultar_documentos_fiscais',
    description: 'Consulta notas fiscais eletrônicas (NF-e/NFC-e/NFS-e) e seus status na SEFAZ.',
    category: 'fiscal',
    requiredPermission: PERMISSIONS.FISCAL_READ,
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filtro por status: DRAFT, AUTHORIZED, REJECTED, CANCELLED',
          enum: ['DRAFT', 'AUTHORIZED', 'REJECTED', 'CANCELLED'],
        },
      },
    },
    execute: async (context: AIPrincipalContext, params: { status?: string }) => {
      const cleanCnpj = context.activeCompany.cnpj.replace(/\D/g, '');
      const repos = RepositoryManager.getInstance().getRepositories();
      const docs = await repos.fiscal.listFiscalDocuments(cleanCnpj, {
        status: params.status,
      });

      return {
        totalRecords: docs.length,
        items: docs.slice(0, 20).map((d: any) => ({
          id: d.id,
          number: d.number,
          series: d.series,
          model: d.model,
          status: d.status,
          totalAmount: d.totalAmount,
          accessKey: d.accessKey,
          recipientName: d.recipientName,
          issueDate: d.issueDate,
        })),
      };
    },
  },
];
