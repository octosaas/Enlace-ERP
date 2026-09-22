/**
 * Enlace ERP - Registro e Fábrica de Provedores de Pagamento (PaymentProviderRegistry)
 * PRD PARTE 06: Gerencia o ciclo de vida dos adapters de gateways/bancos sem acoplamento.
 */

import { PaymentProvider } from './paymentProvider.interface.js';
import { EnlaceSandboxAdapter } from './adapters/enlaceSandboxAdapter.js';
import { AsaasAdapter } from './adapters/asaasAdapter.js';
import { C6BankAdapter } from './adapters/c6BankAdapter.js';
import { CoraAdapter } from './adapters/coraAdapter.js';
import {
  CollectionMethod,
  PaymentProviderConfig,
} from '../../shared/types.js';

export class PaymentProviderRegistry {
  private static instance: PaymentProviderRegistry;
  private adapters = new Map<string, PaymentProvider>();

  private constructor() {
    this.register(new EnlaceSandboxAdapter());
    this.register(new AsaasAdapter());
    this.register(new C6BankAdapter());
    this.register(new CoraAdapter());
  }

  static getInstance(): PaymentProviderRegistry {
    if (!PaymentProviderRegistry.instance) {
      PaymentProviderRegistry.instance = new PaymentProviderRegistry();
    }
    return PaymentProviderRegistry.instance;
  }

  register(adapter: PaymentProvider): void {
    this.adapters.set(adapter.providerType.toUpperCase(), adapter);
  }

  getAdapter(providerType: string): PaymentProvider {
    const key = (providerType || '').toUpperCase();
    const adapter = this.adapters.get(key);
    if (!adapter) {
      // Fallback seguro para o sandbox do Enlace
      return this.adapters.get('ENLACE_SANDBOX')!;
    }
    return adapter;
  }

  /**
   * Resolve a configuração do provedor ideal para um método de cobrança específico
   * Respeita: Override por Método -> Provedor Padrão -> Primeiro Provedor Ativo -> Sandbox
   */
  resolveConfigForMethod(
    configs: PaymentProviderConfig[],
    method: CollectionMethod
  ): PaymentProviderConfig {
    const activeConfigs = (configs || []).filter((c) => c.isActive);

    // 1. Provedor com override explícito para este método
    const override = activeConfigs.find(
      (c) => c.methodOverrides && c.methodOverrides[method] === c.id
    );
    if (override) return override;

    // 2. Provedor marcado como padrão que suporta este método
    const defaultProvider = activeConfigs.find(
      (c) => c.isDefault && (c.supportedMethods || []).includes(method)
    );
    if (defaultProvider) return defaultProvider;

    // 3. Qualquer provedor ativo que suporte este método
    const supported = activeConfigs.find((c) =>
      (c.supportedMethods || []).includes(method)
    );
    if (supported) return supported;

    // 4. Se não encontrar nenhum configurado, gera fallback Enlace Sandbox temporário
    return {
      id: 'cfg_default_sandbox',
      instanceId: 'default',
      name: 'Enlace Sandbox Padrão',
      providerType: 'ENLACE_SANDBOX',
      environment: 'SANDBOX',
      isActive: true,
      isDefault: true,
      supportedMethods: ['PIX', 'BOLETO', 'PAYMENT_LINK', 'MANUAL'],
      credentials: {},
      maskedCredentials: {},
      accountInfo: {
        pixKey: '00.000.000/0001-91',
        pixKeyType: 'CNPJ',
        bankCode: '001',
        bankName: 'Banco do Brasil',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
