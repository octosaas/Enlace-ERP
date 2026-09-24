/**
 * Enlace ERP - Adapter Padrão: Enlace Sandbox Provider
 * Provedor oficial interno para testes, homologação e transações sandbox com suporte a Pix EMV e Boletos FEBRABAN
 */

import crypto from 'crypto';
import { BoletoMath, PixEngine, SUPPORTED_BANKS } from '../../banking/bankingEngine.js';
import {
  PaymentProvider,
  CreateChargeParams,
  ProviderChargeResult,
  ProviderWebhookResult,
} from '../paymentProvider.interface.js';
import { PaymentProviderConfig } from '../../../shared/types.js';

export class EnlaceSandboxAdapter implements PaymentProvider {
  readonly providerType = 'ENLACE_SANDBOX';

  async testConnection(
    config: PaymentProviderConfig
  ): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    // Simula validação de credenciais ou chave
    const hasSecret = !!config.credentials?.apiKey || !!config.accountInfo?.pixKey || true;
    const latencyMs = Math.max(8, Date.now() - start);

    if (hasSecret) {
      return {
        success: true,
        message: `Gateway [${config.name}] conectado e homologado com sucesso em modo ${config.environment}.`,
        latencyMs,
      };
    }

    return {
      success: false,
      message: 'Credenciais de autenticação não configuradas.',
      latencyMs,
    };
  }

  async createCharge(
    config: PaymentProviderConfig,
    params: CreateChargeParams
  ): Promise<ProviderChargeResult> {
    const externalId = `sbx_${params.method.toLowerCase()}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const amount = BoletoMath.roundBRL(params.amount);

    if (params.method === 'PIX') {
      const txid = `tx${Date.now()}${crypto.randomBytes(3).toString('hex')}`.slice(0, 25);
      const pixKey = config.accountInfo?.pixKey || '00.000.000/0001-91';

      const emvPayload = PixEngine.generatePixPayload({
        key: pixKey,
        amount,
        merchantName: 'ENLACE ERP SANDBOX',
        merchantCity: 'SAO PAULO',
        txid,
        description: params.description.slice(0, 30),
      });

      const qrCodeSvg = PixEngine.generateQrCodeSvg(emvPayload);

      return {
        externalId,
        status: 'ACTIVE',
        method: 'PIX',
        amount,
        dueDate: params.dueDate,
        txid,
        pixCode: emvPayload,
        pixQrCodeSvg: qrCodeSvg,
        paymentUrl: `https://pay.enlace.com.br/pix/${txid}`,
      };
    }

    if (params.method === 'BOLETO') {
      const bankCode = config.accountInfo?.bankCode || '001';
      const bank = SUPPORTED_BANKS[bankCode] || SUPPORTED_BANKS['001'];
      const ourNumber = `${Math.floor(10000000000 + Math.random() * 90000000000)}`;
      const documentNumber = params.installmentId || params.receivableId.slice(0, 10);

      const freeField = BoletoMath.generateFreeField({
        bankCode: bank.code,
        agency: '1234',
        account: '12345678',
        wallet: bank.defaultWallet || '17',
        ourNumber,
      });

      const { barcode } = BoletoMath.buildBarcode({
        bankCode: bank.code,
        dueDate: params.dueDate,
        amount,
        freeField,
      });

      const digitableLine = BoletoMath.buildDigitableLine(barcode);

      return {
        externalId,
        status: 'ACTIVE',
        method: 'BOLETO',
        amount,
        dueDate: params.dueDate,
        barcode,
        digitableLine,
        bank: bank.name,
        ourNumber,
        documentNumber,
        paymentUrl: `https://pay.enlace.com.br/boleto/${externalId}`,
      };
    }

    if (params.method === 'PAYMENT_LINK') {
      const paymentUrl = `https://pay.enlace.com.br/checkout/${externalId}`;
      return {
        externalId,
        status: 'ACTIVE',
        method: 'PAYMENT_LINK',
        amount,
        dueDate: params.dueDate,
        paymentUrl,
      };
    }

    // Método MANUAL
    return {
      externalId,
      status: 'ACTIVE',
      method: 'MANUAL',
      amount,
      dueDate: params.dueDate,
      rawResponse: { mode: 'MANUAL_ENTRY' },
    };
  }

  async getCharge(
    config: PaymentProviderConfig,
    externalId: string
  ): Promise<ProviderChargeResult> {
    return {
      externalId,
      status: 'ACTIVE',
      method: 'PIX',
      amount: 100.0,
      dueDate: new Date().toISOString().slice(0, 10),
    };
  }

  async cancelCharge(
    config: PaymentProviderConfig,
    externalId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `Cobrança [${externalId}] cancelada com sucesso no provedor Enlace Sandbox. Motivo: ${reason || 'Solicitação do operador'}`,
    };
  }

  async reissueCharge(
    config: PaymentProviderConfig,
    externalId: string,
    newDueDate: string
  ): Promise<ProviderChargeResult> {
    const newExternalId = `sbx_reissue_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    return {
      externalId: newExternalId,
      status: 'ACTIVE',
      method: 'BOLETO',
      amount: 100.0,
      dueDate: newDueDate,
      paymentUrl: `https://pay.enlace.com.br/reissue/${newExternalId}`,
    };
  }

  async handleWebhook(
    config: PaymentProviderConfig,
    payload: any,
    headers?: Record<string, string>
  ): Promise<ProviderWebhookResult> {
    const rawPayload = payload || {};
    const externalEventId =
      rawPayload.id ||
      rawPayload.eventId ||
      rawPayload.txid ||
      `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const eventType = rawPayload.event || rawPayload.type || 'PAYMENT_CONFIRMED';
    
    // Verificação estrita do secret de webhook quando configurado
    if (config.webhookSecret) {
      const token = headers?.['x-webhook-secret'] || headers?.['authorization'];
      if (token !== config.webhookSecret) {
        return {
          isValid: false,
          externalEventId,
          eventType,
          rejectionReason: 'Assinatura ou secret de webhook inválido.',
          rawPayload,
        };
      }
    }

    const externalId =
      rawPayload.externalId ||
      rawPayload.chargeId ||
      rawPayload.paymentId ||
      rawPayload.payment?.id ||
      rawPayload.data?.id;
    const rawAmount =
      rawPayload.amount ??
      rawPayload.value ??
      rawPayload.payment?.value ??
      rawPayload.payment?.amount ??
      rawPayload.data?.value ??
      0;
    const amount = Number(rawAmount);
    const paymentDate =
      rawPayload.paymentDate ||
      rawPayload.payment?.paymentDate ||
      new Date().toISOString();
    const method =
      (rawPayload.method as any) ||
      (rawPayload.payment?.billingType as any) ||
      'PIX';

    return {
      isValid: true,
      externalEventId,
      eventType,
      payment: externalId
        ? {
            externalId,
            txid: rawPayload.txid || rawPayload.payment?.txid,
            amount: BoletoMath.roundBRL(amount),
            paymentDate,
            method,
            status: 'CONFIRMED',
            payerDocument: rawPayload.payerDocument || rawPayload.payment?.payerDocument,
            endToEndId: rawPayload.endToEndId || rawPayload.payment?.endToEndId,
            notes: 'Liquidação processada via webhook Enlace Sandbox',
          }
        : undefined,
      rawPayload,
    };
  }
}
