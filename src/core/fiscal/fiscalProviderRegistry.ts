/**
 * Enlace ERP - Registro e Fábrica de Provedores Fiscais (FiscalProviderRegistry)
 * PRD 07: Gerencia o ciclo de vida dos adapters de emissão eletrônica de forma desacoplada
 */

import { FiscalProvider, FiscalProviderConfig } from './fiscalProvider.interface.js';
import { SefazSandboxAdapter } from './adapters/sefazSandboxAdapter.js';
import { FocusNFeAdapter } from './adapters/focusNFeAdapter.js';

export class FiscalProviderRegistry {
  private static instance: FiscalProviderRegistry;
  private adapters = new Map<string, FiscalProvider>();

  private constructor() {
    this.register(new SefazSandboxAdapter());
    this.register(new FocusNFeAdapter());
  }

  static getInstance(): FiscalProviderRegistry {
    if (!FiscalProviderRegistry.instance) {
      FiscalProviderRegistry.instance = new FiscalProviderRegistry();
    }
    return FiscalProviderRegistry.instance;
  }

  register(adapter: FiscalProvider): void {
    this.adapters.set(adapter.providerType.toUpperCase(), adapter);
  }

  getAdapter(providerType: string): FiscalProvider {
    const key = (providerType || '').toUpperCase();
    const adapter = this.adapters.get(key);
    if (!adapter) {
      // Fallback seguro para o simulador oficial de homologação SEFAZ
      return this.adapters.get('SEFAZ_SANDBOX')!;
    }
    return adapter;
  }

  /**
   * Resolve a configuração ativa do provedor fiscal
   */
  resolveConfig(customConfigs?: FiscalProviderConfig[]): FiscalProviderConfig {
    if (customConfigs && customConfigs.length > 0) {
      const active = customConfigs.find((c) => c.isActive);
      if (active) return active;
    }

    return {
      id: 'cfg_default_sefaz_sandbox',
      providerType: 'SEFAZ_SANDBOX',
      environment: 'SANDBOX',
      isActive: true,
      credentials: {},
    };
  }
}
