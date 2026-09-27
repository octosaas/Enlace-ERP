/**
 * Enlace ERP - MaIA v2 Tool Registry
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 */

import { AIToolDefinition, AIPrincipalContext } from './types.js';
import { financialTools } from './categories/financialTools.js';
import { commercialTools } from './categories/commercialTools.js';
import { inventoryTools } from './categories/inventoryTools.js';
import { fiscalTools } from './categories/fiscalTools.js';
import { actionTools } from './categories/actionTools.js';

export class ToolRegistry {
  private static instance: ToolRegistry | null = null;
  private tools: Map<string, AIToolDefinition> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  static getInstance(): ToolRegistry {
    if (!this.instance) {
      this.instance = new ToolRegistry();
    }
    return this.instance;
  }

  private registerDefaults(): void {
    const allTools = [
      ...financialTools,
      ...commercialTools,
      ...inventoryTools,
      ...fiscalTools,
      ...actionTools,
    ];

    for (const tool of allTools) {
      this.register(tool);
    }
  }

  register(tool: AIToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AIToolDefinition | undefined {
    return this.tools.get(name);
  }

  listAll(): AIToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Retorna apenas as ferramentas que o usuário atual possui autorização RBAC para utilizar
   */
  getToolsForContext(context: AIPrincipalContext): AIToolDefinition[] {
    const userPermissions = new Set(context.membership.permissions);
    return Array.from(this.tools.values()).filter((tool) => {
      return userPermissions.has(tool.requiredPermission);
    });
  }
}
