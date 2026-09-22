/**
 * Enlace ERP - Contrato Formal de Provedores Fiscais (FiscalProvider Interface)
 * PRD 07 - Emissão Eletrônica (NF-e, NFS-e, NFC-e) com Suporte Multi-Adapter
 */

import { FiscalDocument, FiscalDocumentModel } from '../../shared/types.js';

export interface FiscalProviderConfig {
  id: string;
  providerType: 'SEFAZ_SANDBOX' | 'FOCUS_NFE' | 'NUVEM_FISCAL';
  environment: 'SANDBOX' | 'PRODUCTION';
  isActive: boolean;
  credentials: {
    apiKey?: string;
    certificateA1Base64?: string;
    certificatePassword?: string;
    sefazUf?: string;
    sefazAmbiente?: '1' | '2'; // 1 = Produção, 2 = Homologação
  };
}

export interface FiscalTransmitParams {
  document: FiscalDocument;
  company: {
    legalName: string;
    tradeName?: string;
    cnpj: string;
    stateRegistration?: string;
    state?: string;
  };
}

export interface FiscalTransmitResult {
  success: boolean;
  status: 'AUTHORIZED' | 'REJECTED' | 'PROCESSING';
  protocolNumber?: string;
  accessKey: string;
  authorizedAt?: string;
  xmlPayload: string;
  rejectionReason?: string;
  statusCode: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  provider: string;
}

export interface FiscalCancelParams {
  accessKey: string;
  protocolNumber: string;
  reason: string;
  cancellationCode?: string;
}

export interface FiscalCancelResult {
  success: boolean;
  canceledAt: string;
  protocolNumber: string;
  message: string;
}

export interface FiscalInutilizeParams {
  model: FiscalDocumentModel;
  series: string;
  startNumber: number;
  endNumber: number;
  justification: string;
}

export interface FiscalInutilizeResult {
  success: boolean;
  protocolNumber: string;
  inutilizedAt: string;
  message: string;
}

export interface FiscalProvider {
  readonly providerType: string;
  testConnection(
    config: FiscalProviderConfig
  ): Promise<{ success: boolean; message: string; latencyMs: number }>;
  transmit(
    config: FiscalProviderConfig,
    params: FiscalTransmitParams
  ): Promise<FiscalTransmitResult>;
  cancel(
    config: FiscalProviderConfig,
    params: FiscalCancelParams
  ): Promise<FiscalCancelResult>;
  inutilize(
    config: FiscalProviderConfig,
    params: FiscalInutilizeParams
  ): Promise<FiscalInutilizeResult>;
}
