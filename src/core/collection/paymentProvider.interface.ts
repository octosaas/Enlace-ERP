/**
 * Enlace ERP - PRD PARTE 06: Interface Abstrata de Provedor Financeiro (PaymentProvider)
 * Garante que o ERP não dependa exclusivamente de nenhum gateway/banco específico.
 */

import {
  Collection,
  CollectionMethod,
  PaymentProviderConfig,
} from '../../shared/types.js';

export interface CreateChargeParams {
  receivableId: string;
  installmentId?: string;
  method: CollectionMethod;
  amount: number;
  dueDate: string;
  customer: {
    id: string;
    name: string;
    document: string;
    email?: string;
    phone?: string;
    address?: {
      street?: string;
      number?: string;
      complement?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
  };
  description: string;
  idempotencyKey?: string;
  instructions?: string[];
  finePercent?: number;
  interestMonthlyPercent?: number;
}

export interface ProviderChargeResult {
  externalId: string;
  status: 'ACTIVE' | 'PENDING' | 'PAID' | 'CANCELED' | 'FAILED';
  method: CollectionMethod;
  amount: number;
  dueDate: string;
  paymentUrl?: string;
  pixCode?: string; // Payload EMV Copia e Cola
  pixQrCodeSvg?: string; // QR Code vetorial SVG
  txid?: string;
  barcode?: string; // 44 dígitos FEBRABAN
  digitableLine?: string; // 47 dígitos linha digitável
  bank?: string;
  ourNumber?: string;
  documentNumber?: string;
  rawResponse?: Record<string, any>;
}

export interface WebhookParsedPayment {
  externalId: string;
  txid?: string;
  amount: number;
  paymentDate: string;
  method: CollectionMethod;
  status: 'CONFIRMED' | 'REFUNDED';
  payerDocument?: string;
  endToEndId?: string;
  notes?: string;
}

export interface ProviderWebhookResult {
  isValid: boolean;
  externalEventId: string;
  eventType: string;
  payment?: WebhookParsedPayment;
  rejectionReason?: string;
  rawPayload: Record<string, any>;
}

export interface PaymentProvider {
  readonly providerType: string;

  /**
   * Valida conectividade segura e credenciais com o provedor sem efetuar cobrança real
   */
  testConnection(
    config: PaymentProviderConfig
  ): Promise<{ success: boolean; message: string; latencyMs: number }>;

  /**
   * Cria uma nova cobrança externa (Pix, Boleto, Link)
   */
  createCharge(
    config: PaymentProviderConfig,
    params: CreateChargeParams
  ): Promise<ProviderChargeResult>;

  /**
   * Consulta os dados atualizados de uma cobrança no provedor
   */
  getCharge(
    config: PaymentProviderConfig,
    externalId: string
  ): Promise<ProviderChargeResult>;

  /**
   * Cancela uma cobrança no provedor
   */
  cancelCharge(
    config: PaymentProviderConfig,
    externalId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }>;

  /**
   * Reemite a cobrança com nova data de vencimento (2ª Via)
   */
  reissueCharge(
    config: PaymentProviderConfig,
    externalId: string,
    newDueDate: string
  ): Promise<ProviderChargeResult>;

  /**
   * Processa e valida a assinatura/origem de um webhook recebido
   */
  handleWebhook(
    config: PaymentProviderConfig,
    payload: any,
    headers?: Record<string, string>
  ): Promise<ProviderWebhookResult>;
}
