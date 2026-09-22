/**
 * Enlace ERP - PRD PARTE 06: Motor Central de Cobrança e Contas a Receber
 * Orquestra o ciclo completo: Faturamento -> Contas a Receber -> Cobrança -> Pagamento
 * Isolamento estrito por schema de CNPJ, adapters de gateways, idempotência e auditoria.
 */

import crypto from 'crypto';
import { BoletoMath } from '../banking/bankingEngine.js';
import { ReceivableCalculationService } from './receivableCalculationService.js';
import { PaymentProviderRegistry } from './paymentProviderRegistry.js';
import {
  Receivable,
  ReceivableInstallment,
  Collection,
  PaymentRecord,
  PaymentProviderConfig,
  WebhookEventRecord,
  ReceivablesDashboardMetrics,
  CustomerReceivablesSummary,
  CollectionMethod,
  AuditLogEntry,
} from '../../shared/types.js';

export interface CreateReceivableInput {
  customerId: string;
  customerName: string;
  customerDocument: string;
  billingId?: string;
  description: string;
  originalAmount: number;
  dueDate: string;
  issueDate?: string;
  installmentsCount?: number;
  discountType?: 'PERCENTAGE' | 'FIXED';
  discountValue?: number;
  discountDeadline?: string;
  interestType?: 'PERCENTAGE' | 'FIXED';
  interestValue?: number;
  fineType?: 'PERCENTAGE' | 'FIXED';
  fineValue?: number;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface CreateCollectionInput {
  receivableId: string;
  installmentId?: string;
  providerId?: string;
  method: CollectionMethod;
  amount?: number;
  dueDate?: string;
  idempotencyKey?: string;
  description?: string;
}

export interface ManualPaymentInput {
  receivableId: string;
  installmentId?: string;
  amount: number;
  paymentDate?: string;
  method?: 'PIX' | 'BOLETO' | 'PAYMENT_LINK' | 'MANUAL' | 'TRANSFER' | 'CASH';
  notes?: string;
}

export class CollectionEngine {
  private static instance: CollectionEngine;
  private registry = PaymentProviderRegistry.getInstance();

  static getInstance(): CollectionEngine {
    if (!CollectionEngine.instance) {
      CollectionEngine.instance = new CollectionEngine();
    }
    return CollectionEngine.instance;
  }

  // ==========================================================================
  // 1. CONTAS A RECEBER (RECEIVABLES)
  // ==========================================================================

  createReceivable(
    receivablesList: Receivable[],
    input: CreateReceivableInput,
    instanceId: string,
    user?: { id: string; name: string }
  ): { receivable: Receivable; audit: AuditLogEntry } {
    const rawAmount = input.originalAmount ?? (input as any).totalAmount ?? 0;
    const originalAmount = BoletoMath.roundBRL(rawAmount);
    if (originalAmount <= 0) {
      throw new Error('O valor original da conta a receber deve ser maior que zero.');
    }

    const id = `rec_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const issueDate = input.issueDate || new Date().toISOString().slice(0, 10);
    const installmentsCount = Math.max(1, input.installmentsCount || 1);

    // Geração de Parcelamento com divisão rigorosa de centavos
    const installments: ReceivableInstallment[] = [];
    const baseInstallmentAmount = Math.floor((originalAmount / installmentsCount) * 100) / 100;
    let accumulated = 0;

    const baseDueDate = new Date(`${input.dueDate.slice(0, 10)}T00:00:00Z`);

    for (let i = 1; i <= installmentsCount; i++) {
      let instAmount = baseInstallmentAmount;
      if (i === installmentsCount) {
        // Última parcela absorve a diferença dos centavos para precisão exata
        instAmount = BoletoMath.roundBRL(originalAmount - accumulated);
      } else {
        accumulated = BoletoMath.roundBRL(accumulated + instAmount);
      }

      // Calcula data de vencimento da parcela (mensal se > 1)
      const instDueDate = new Date(baseDueDate);
      if (i > 1) {
        instDueDate.setUTCMonth(instDueDate.getUTCMonth() + (i - 1));
      }

      installments.push({
        id: `${id}_inst_${i}`,
        receivableId: id,
        installmentNumber: i,
        totalInstallments: installmentsCount,
        amount: instAmount,
        paidAmount: 0,
        remainingAmount: instAmount,
        dueDate: instDueDate.toISOString().slice(0, 10),
        status: 'PENDING',
      });
    }

    const receivable: Receivable = {
      id,
      instanceId,
      customerId: input.customerId,
      customerName: input.customerName,
      customerDocument: input.customerDocument,
      billingId: input.billingId,
      status: 'PENDING',
      description: input.description,
      originalAmount,
      paidAmount: 0,
      remainingAmount: originalAmount,
      discountType: input.discountType,
      discountValue: input.discountValue,
      discountAmount: 0,
      discountDeadline: input.discountDeadline,
      interestType: input.interestType,
      interestValue: input.interestValue,
      interestAmount: 0,
      fineType: input.fineType,
      fineValue: input.fineValue,
      fineAmount: 0,
      currentAmount: originalAmount,
      issueDate,
      dueDate: input.dueDate.slice(0, 10),
      installments,
      notes: input.notes,
      metadata: input.metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Sincroniza cálculos
    ReceivableCalculationService.applyToReceivable(receivable);

    receivablesList.unshift(receivable);

    const audit: AuditLogEntry = {
      id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      userId: user?.id || null,
      userEmail: user?.name || null,
      companyId: null,
      companyCnpj: null,
      action: 'RECEIVABLE_CREATED',
      resource: 'Receivable',
      resourceId: receivable.id,
      status: 'SUCCESS',
      requestId: `req_${Date.now()}`,
      details: {
        originalAmount,
        installmentsCount,
        customerName: receivable.customerName,
        dueDate: receivable.dueDate,
      },
    };

    return { receivable, audit };
  }

  listReceivables(
    receivablesList: Receivable[],
    filters?: {
      status?: string;
      customerId?: string;
      startDate?: string;
      endDate?: string;
      isOverdue?: boolean;
    }
  ): Receivable[] {
    let result = [...receivablesList];

    // Atualiza status e encargos sob demanda em tempo de leitura
    result.forEach((r) => ReceivableCalculationService.applyToReceivable(r));

    if (filters?.status) {
      result = result.filter((r) => r.status === filters.status);
    }
    if (filters?.customerId) {
      result = result.filter((r) => r.customerId === filters.customerId);
    }
    if (filters?.startDate) {
      result = result.filter((r) => r.dueDate >= filters.startDate!);
    }
    if (filters?.endDate) {
      result = result.filter((r) => r.dueDate <= filters.endDate!);
    }
    if (filters?.isOverdue) {
      result = result.filter((r) => r.status === 'OVERDUE');
    }

    return result;
  }

  getReceivable(receivablesList: Receivable[], id: string): Receivable | undefined {
    const rec = receivablesList.find((r) => r.id === id);
    if (rec) {
      ReceivableCalculationService.applyToReceivable(rec);
    }
    return rec;
  }

  cancelReceivable(
    receivablesList: Receivable[],
    collectionsList: Collection[],
    providersList: PaymentProviderConfig[],
    id: string,
    reason: string,
    user?: { id: string; name: string }
  ): { receivable: Receivable; audit: AuditLogEntry } {
    const rec = this.getReceivable(receivablesList, id);
    if (!rec) {
      throw new Error(`Conta a receber [${id}] não encontrada.`);
    }

    if (rec.status === 'PAID') {
      throw new Error('Não é permitido cancelar uma conta já liquidada integralmente.');
    }
    if (rec.status === 'CANCELED') {
      throw new Error('Esta conta a receber já se encontra cancelada.');
    }

    rec.status = 'CANCELED';
    rec.updatedAt = new Date().toISOString();
    rec.notes = (rec.notes ? rec.notes + '\n' : '') + `Cancelada em ${new Date().toISOString()}: ${reason}`;

    // Cancela parcelas
    rec.installments.forEach((inst) => {
      if (inst.status !== 'PAID') inst.status = 'CANCELED';
    });

    // Cancela cobranças ativas vinculadas no provedor
    const activeCollections = collectionsList.filter(
      (c) => c.receivableId === id && (c.status === 'ACTIVE' || c.status === 'PENDING')
    );
    activeCollections.forEach((c) => {
      c.status = 'CANCELED';
      c.updatedAt = new Date().toISOString();
      const provConfig = providersList.find((p) => p.id === c.providerId);
      if (provConfig) {
        const adapter = this.registry.getAdapter(provConfig.providerType);
        adapter.cancelCharge(provConfig, c.externalId, reason).catch(() => {});
      }
    });

    const audit: AuditLogEntry = {
      id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      userId: user?.id || null,
      userEmail: user?.name || null,
      companyId: null,
      companyCnpj: null,
      action: 'RECEIVABLE_CANCELED',
      resource: 'Receivable',
      resourceId: rec.id,
      status: 'SUCCESS',
      requestId: `req_${Date.now()}`,
      details: { reason, canceledCollectionsCount: activeCollections.length },
    };

    return { receivable: rec, audit };
  }

  recordPayment(
    receivablesList: Receivable[],
    collectionsList: Collection[],
    paymentsList: PaymentRecord[],
    input: ManualPaymentInput & { collectionId?: string; externalId?: string },
    instanceId: string,
    user?: { id: string; name: string }
  ): { receivable: Receivable; payment: PaymentRecord; audit: AuditLogEntry } {
    const rec = this.getReceivable(receivablesList, input.receivableId);
    if (!rec) {
      throw new Error(`Conta a receber [${input.receivableId}] não encontrada.`);
    }

    if (rec.status === 'CANCELED' || rec.status === 'WRITTEN_OFF') {
      throw new Error(`Não é possível registrar pagamento para conta com status [${rec.status}].`);
    }

    const payAmount = BoletoMath.roundBRL(input.amount);
    if (payAmount <= 0) {
      throw new Error('O valor do pagamento deve ser positivo.');
    }

    // Se já estiver totalmente paga, rejeita pagamento duplicado
    if (rec.remainingAmount <= 0 && rec.status === 'PAID') {
      throw new Error(`A conta [${rec.id}] já foi totalmente quitada.`);
    }

    // Preserva o originalAmount intacto (Seção 30 do PRD)
    rec.paidAmount = BoletoMath.roundBRL(rec.paidAmount + payAmount);
    rec.remainingAmount = BoletoMath.roundBRL(Math.max(0, rec.originalAmount - rec.paidAmount));
    rec.updatedAt = new Date().toISOString();

    // Atualiza parcela específica se informada
    if (input.installmentId) {
      const inst = rec.installments.find((i) => i.id === input.installmentId);
      if (inst) {
        inst.paidAmount = BoletoMath.roundBRL(inst.paidAmount + payAmount);
        inst.remainingAmount = BoletoMath.roundBRL(Math.max(0, inst.amount - inst.paidAmount));
        inst.status = inst.remainingAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID';
      }
    } else {
      // Distribui pagamento nas parcelas abertas sequencialmente
      let remainingToAllocate = payAmount;
      for (const inst of rec.installments) {
        if (inst.status !== 'PAID' && remainingToAllocate > 0) {
          const allocation = Math.min(inst.remainingAmount, remainingToAllocate);
          inst.paidAmount = BoletoMath.roundBRL(inst.paidAmount + allocation);
          inst.remainingAmount = BoletoMath.roundBRL(inst.amount - inst.paidAmount);
          inst.status = inst.remainingAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID';
          remainingToAllocate = BoletoMath.roundBRL(remainingToAllocate - allocation);
        }
      }
    }

    // Derivação de status pelo backend (Seção 14 e 29)
    if (rec.paidAmount >= rec.originalAmount) {
      rec.status = 'PAID';
      rec.remainingAmount = 0;
    } else {
      rec.status = 'PARTIALLY_PAID';
    }

    // Cria registro imutável de Pagamento
    const paymentId = `pay_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const paymentRecord: PaymentRecord = {
      id: paymentId,
      instanceId,
      receivableId: rec.id,
      installmentId: input.installmentId,
      collectionId: input.collectionId,
      amount: payAmount,
      paymentDate: input.paymentDate || new Date().toISOString().slice(0, 10),
      method: (input.method as any) || 'MANUAL',
      externalId: input.externalId,
      status: 'CONFIRMED',
      recordedBy: user,
      notes: input.notes,
      createdAt: new Date().toISOString(),
    };
    paymentsList.unshift(paymentRecord);

    // Se houve cobrança associada, atualiza seu status para PAID
    if (input.collectionId) {
      const col = collectionsList.find((c) => c.id === input.collectionId);
      if (col) {
        col.status = 'PAID';
        col.updatedAt = new Date().toISOString();
      }
    }

    const audit: AuditLogEntry = {
      id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      userId: user?.id || null,
      userEmail: user?.name || null,
      companyId: null,
      companyCnpj: null,
      action: 'PAYMENT_CREATED',
      resource: 'Payment',
      resourceId: paymentRecord.id,
      status: 'SUCCESS',
      requestId: `req_${Date.now()}`,
      details: {
        receivableId: rec.id,
        amount: payAmount,
        remainingAmount: rec.remainingAmount,
        newReceivableStatus: rec.status,
      },
    };

    return { receivable: rec, payment: paymentRecord, audit };
  }

  reversePayment(
    receivablesList: Receivable[],
    paymentsList: PaymentRecord[],
    paymentId: string,
    reason: string,
    user?: { id: string; name: string }
  ): { payment: PaymentRecord; receivable: Receivable; audit: AuditLogEntry } {
    const payment = paymentsList.find((p) => p.id === paymentId);
    if (!payment) {
      throw new Error(`Pagamento [${paymentId}] não encontrado.`);
    }

    if (payment.status === 'REVERSED') {
      throw new Error('Este pagamento já foi estornado anteriormente.');
    }

    const rec = this.getReceivable(receivablesList, payment.receivableId);
    if (!rec) {
      throw new Error(`Recebível associado [${payment.receivableId}] não encontrado.`);
    }

    payment.status = 'REVERSED';
    payment.reversalReason = reason;
    payment.reversedAt = new Date().toISOString();

    // Recompõe saldos do recebível
    rec.paidAmount = BoletoMath.roundBRL(Math.max(0, rec.paidAmount - payment.amount));
    rec.remainingAmount = BoletoMath.roundBRL(rec.originalAmount - rec.paidAmount);
    rec.updatedAt = new Date().toISOString();

    ReceivableCalculationService.applyToReceivable(rec);

    const audit: AuditLogEntry = {
      id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      userId: user?.id || null,
      userEmail: user?.name || null,
      companyId: null,
      companyCnpj: null,
      action: 'PAYMENT_REVERSED',
      resource: 'Payment',
      resourceId: payment.id,
      status: 'SUCCESS',
      requestId: `req_${Date.now()}`,
      details: {
        amountReversed: payment.amount,
        receivableId: rec.id,
        newStatus: rec.status,
        reason,
      },
    };

    return { payment, receivable: rec, audit };
  }

  // ==========================================================================
  // 2. COBRANÇAS (COLLECTIONS)
  // ==========================================================================

  async createCollection(
    receivablesList: Receivable[],
    collectionsList: Collection[],
    providersList: PaymentProviderConfig[],
    input: CreateCollectionInput,
    instanceId: string,
    user?: { id: string; name: string }
  ): Promise<{ collection: Collection; audit: AuditLogEntry }> {
    // 1. Idempotência Financeira (Seções 48 e 65)
    if (input.idempotencyKey) {
      const existing = collectionsList.find(
        (c) => c.idempotencyKey === input.idempotencyKey
      );
      if (existing) {
        return {
          collection: existing,
          audit: {
            id: `aud_idemp_${Date.now()}`,
            timestamp: new Date().toISOString(),
            userId: user?.id || null,
            userEmail: user?.name || null,
            companyId: null,
            companyCnpj: null,
            action: 'COLLECTION_IDEMPOTENT_REUSE',
            resource: 'Collection',
            resourceId: existing.id,
            status: 'SUCCESS',
            requestId: `req_idemp`,
            details: { reusedCollectionId: existing.id },
          },
        };
      }
    }

    const rec = this.getReceivable(receivablesList, input.receivableId);
    if (!rec) {
      throw new Error(`Recebível [${input.receivableId}] não encontrado.`);
    }

    if (rec.status === 'PAID') {
      throw new Error('Não é possível emitir cobrança para um título já quitado.');
    }
    if (rec.status === 'CANCELED') {
      throw new Error('Não é possível emitir cobrança para um título cancelado.');
    }

    const amount = BoletoMath.roundBRL(input.amount || rec.remainingAmount);
    const dueDate = input.dueDate || rec.dueDate;

    // 2. Resolução do Provedor e Adapter (Seções 5, 6, 7 e 45)
    let provConfig: PaymentProviderConfig | undefined;
    if (input.providerId) {
      provConfig = providersList.find((p) => p.id === input.providerId && p.isActive);
    }
    if (!provConfig) {
      provConfig = this.registry.resolveConfigForMethod(providersList, input.method);
    }

    const adapter = this.registry.getAdapter(provConfig.providerType);

    // 3. Execução no Adapter
    const providerResult = await adapter.createCharge(provConfig, {
      receivableId: rec.id,
      installmentId: input.installmentId,
      method: input.method,
      amount,
      dueDate,
      customer: {
        id: rec.customerId,
        name: rec.customerName,
        document: rec.customerDocument,
      },
      description: input.description || rec.description,
      idempotencyKey: input.idempotencyKey,
    });

    const collectionId = `col_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const collection: Collection = {
      id: collectionId,
      instanceId,
      receivableId: rec.id,
      installmentId: input.installmentId,
      providerId: provConfig.id,
      providerType: provConfig.providerType,
      externalId: providerResult.externalId,
      method: input.method,
      status: 'ACTIVE',
      amount,
      dueDate,
      paymentUrl: providerResult.paymentUrl,
      pixCode: providerResult.pixCode,
      pixQrCodeSvg: providerResult.pixQrCodeSvg,
      txid: providerResult.txid,
      barcode: providerResult.barcode,
      digitableLine: providerResult.digitableLine,
      bank: providerResult.bank,
      ourNumber: providerResult.ourNumber,
      documentNumber: providerResult.documentNumber,
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    collectionsList.unshift(collection);

    // Vínculo no recebível
    rec.collectionId = collection.id;
    rec.updatedAt = new Date().toISOString();

    const audit: AuditLogEntry = {
      id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      userId: user?.id || null,
      userEmail: user?.name || null,
      companyId: null,
      companyCnpj: null,
      action: 'COLLECTION_CREATED',
      resource: 'Collection',
      resourceId: collection.id,
      status: 'SUCCESS',
      requestId: `req_${Date.now()}`,
      details: {
        method: collection.method,
        amount: collection.amount,
        providerType: provConfig.providerType,
        externalId: collection.externalId,
      },
    };

    return { collection, audit };
  }

  async cancelCollection(
    collectionsList: Collection[],
    providersList: PaymentProviderConfig[],
    id: string,
    reason: string,
    user?: { id: string; name: string }
  ): Promise<{ collection: Collection; audit: AuditLogEntry }> {
    const col = collectionsList.find((c) => c.id === id);
    if (!col) {
      throw new Error(`Cobrança [${id}] não encontrada.`);
    }

    if (col.status === 'PAID') {
      throw new Error('Não é possível cancelar uma cobrança já paga.');
    }
    if (col.status === 'CANCELED') {
      throw new Error('A cobrança já está cancelada.');
    }

    const provConfig = providersList.find((p) => p.id === col.providerId);
    if (provConfig) {
      const adapter = this.registry.getAdapter(provConfig.providerType);
      await adapter.cancelCharge(provConfig, col.externalId, reason);
    }

    col.status = 'CANCELED';
    col.updatedAt = new Date().toISOString();

    const audit: AuditLogEntry = {
      id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      userId: user?.id || null,
      userEmail: user?.name || null,
      companyId: null,
      companyCnpj: null,
      action: 'COLLECTION_CANCELED',
      resource: 'Collection',
      resourceId: col.id,
      status: 'SUCCESS',
      requestId: `req_${Date.now()}`,
      details: { reason, externalId: col.externalId },
    };

    return { collection: col, audit };
  }

  async reissueCollection(
    receivablesList: Receivable[],
    collectionsList: Collection[],
    providersList: PaymentProviderConfig[],
    id: string,
    newDueDate: string,
    user?: { id: string; name: string }
  ): Promise<{ newCollection: Collection; audit: AuditLogEntry }> {
    const col = collectionsList.find((c) => c.id === id);
    if (!col) {
      throw new Error(`Cobrança [${id}] não encontrada.`);
    }

    const provConfig = providersList.find((p) => p.id === col.providerId);
    if (!provConfig) {
      throw new Error(`Provedor [${col.providerId}] não encontrado.`);
    }

    const adapter = this.registry.getAdapter(provConfig.providerType);
    const result = await adapter.reissueCharge(provConfig, col.externalId, newDueDate);

    // Marca anterior como CANCELED/REISSUED
    col.status = 'CANCELED';
    col.updatedAt = new Date().toISOString();

    // Cria nova cobrança de 2ª via
    const newId = `col_re_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const newCol: Collection = {
      ...col,
      id: newId,
      externalId: result.externalId,
      dueDate: newDueDate,
      status: 'ACTIVE',
      paymentUrl: result.paymentUrl || col.paymentUrl,
      pixCode: result.pixCode || col.pixCode,
      barcode: result.barcode || col.barcode,
      digitableLine: result.digitableLine || col.digitableLine,
      reissuedFromId: col.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    collectionsList.unshift(newCol);

    const rec = this.getReceivable(receivablesList, col.receivableId);
    if (rec) {
      rec.collectionId = newCol.id;
      rec.dueDate = newDueDate;
      rec.updatedAt = new Date().toISOString();
    }

    const audit: AuditLogEntry = {
      id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      userId: user?.id || null,
      userEmail: user?.name || null,
      companyId: null,
      companyCnpj: null,
      action: 'COLLECTION_REISSUED',
      resource: 'Collection',
      resourceId: newCol.id,
      status: 'SUCCESS',
      requestId: `req_${Date.now()}`,
      details: {
        reissuedFromId: col.id,
        newDueDate,
        newExternalId: newCol.externalId,
      },
    };

    return { newCollection: newCol, audit };
  }

  // ==========================================================================
  // 3. WEBHOOKS & IDEMPOTÊNCIA (Seções 32, 33, 34, 35, 64)
  // ==========================================================================

  async processWebhook(
    allTenantsStorages: Map<
      string,
      {
        receivablesV2?: Receivable[];
        collectionsV2?: Collection[];
        paymentsV2?: PaymentRecord[];
        paymentProvidersV2?: PaymentProviderConfig[];
        webhookEventsV2?: WebhookEventRecord[];
        auditLogs?: AuditLogEntry[];
      }
    >,
    providerName: string,
    payload: any,
    headers?: Record<string, string>
  ): Promise<{
    status: 'PROCESSED' | 'DUPLICATE' | 'REJECTED';
    message: string;
    details?: any;
  }> {
    const rawPayload = payload || {};
    const payloadStr = JSON.stringify(rawPayload);
    const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    // 1. Busca se o evento já foi processado em algum tenant (Controle de Idempotência - Seção 34)
    for (const [, storage] of allTenantsStorages.entries()) {
      const existingEvt = (storage.webhookEventsV2 || []).find(
        (e) => e.payloadHash === payloadHash && e.status === 'PROCESSED'
      );
      if (existingEvt) {
        return {
          status: 'DUPLICATE',
          message: 'Evento de webhook já processado anteriormente (Idempotência garantida).',
          details: { eventId: existingEvt.id },
        };
      }
    }

    // 2. Localiza qual tenant possui a cobrança referenciada
    const adapter = this.registry.getAdapter(providerName);
    let targetStorage: any = null;
    let targetCollection: Collection | null = null;
    let targetConfig: PaymentProviderConfig | null = null;

    const externalIdHint =
      rawPayload.id ||
      rawPayload.externalId ||
      rawPayload.payment?.id ||
      rawPayload.chargeId ||
      rawPayload.txid;

    for (const [, storage] of allTenantsStorages.entries()) {
      const col = (storage.collectionsV2 || []).find(
        (c) =>
          c.externalId === externalIdHint ||
          (c.txid && c.txid === externalIdHint) ||
          c.id === externalIdHint
      );
      if (col) {
        targetStorage = storage;
        targetCollection = col;
        targetConfig =
          (storage.paymentProvidersV2 || []).find((p) => p.id === col.providerId) || null;
        break;
      }
    }

    if (!targetStorage || !targetCollection) {
      // Se não encontrou cobrança, registra em um log neutro ou retorna rejeição segura
      return {
        status: 'REJECTED',
        message: 'Cobrança não localizada em nenhuma instância ativa.',
      };
    }

    if (!targetConfig) {
      targetConfig = this.registry.resolveConfigForMethod([], targetCollection.method);
    }

    // 3. Processa no adapter específico
    const webhookResult = await adapter.handleWebhook(targetConfig, rawPayload, headers);

    if (!webhookResult.isValid) {
      return {
        status: 'REJECTED',
        message: webhookResult.rejectionReason || 'Validação de webhook rejeitada.',
      };
    }

    // 4. Se contiver pagamento confirmado, efetua a baixa automática
    if (webhookResult.payment && webhookResult.payment.status === 'CONFIRMED') {
      const parsedPay = webhookResult.payment;

      if (targetCollection.status !== 'PAID') {
        this.recordPayment(
          targetStorage.receivablesV2 || [],
          targetStorage.collectionsV2 || [],
          targetStorage.paymentsV2 || [],
          {
            receivableId: targetCollection.receivableId,
            collectionId: targetCollection.id,
            installmentId: targetCollection.installmentId,
            amount: parsedPay.amount,
            paymentDate: parsedPay.paymentDate,
            method: (parsedPay.method as any) || targetCollection.method,
            externalId: parsedPay.externalId,
            notes: parsedPay.notes || `Baixa automática via webhook [${providerName}]`,
          },
          targetCollection.instanceId,
          { id: 'system_webhook', name: `Webhook Gateway (${providerName})` }
        );
      }
    }

    // 5. Registra o evento de webhook para controle de idempotência futuro
    if (!targetStorage.webhookEventsV2) {
      targetStorage.webhookEventsV2 = [];
    }

    targetStorage.webhookEventsV2.unshift({
      id: `whk_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      instanceId: targetCollection.instanceId,
      provider: providerName,
      externalEventId: webhookResult.externalEventId,
      payloadHash,
      event: webhookResult.eventType,
      payload: rawPayload,
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      status: 'PROCESSED',
    });

    return {
      status: 'PROCESSED',
      message: 'Webhook processado e baixa financeira realizada com sucesso.',
      details: {
        externalEventId: webhookResult.externalEventId,
        collectionId: targetCollection.id,
      },
    };
  }

  // ==========================================================================
  // 4. DASHBOARD & MÉTRICAS (Seções 38, 39, 40)
  // ==========================================================================

  getDashboardMetrics(
    receivablesList: Receivable[],
    collectionsList: Collection[]
  ): ReceivablesDashboardMetrics {
    const todayStr = new Date().toISOString().slice(0, 10);
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let totalOpen = 0;
    let totalOverdue = 0;
    let totalReceived = 0;
    let dueToday = 0;
    let dueNext7Days = 0;
    let partialPaymentsCount = 0;

    const receivablesByStatus: Record<any, number> = {
      PENDING: 0,
      PARTIALLY_PAID: 0,
      PAID: 0,
      OVERDUE: 0,
      CANCELED: 0,
      WRITTEN_OFF: 0,
    };

    const agingSummary = {
      onTime: 0,
      overdue1To30: 0,
      overdue31To60: 0,
      overdue61To90: 0,
      overdue90Plus: 0,
    };

    for (const rec of receivablesList) {
      ReceivableCalculationService.applyToReceivable(rec);

      receivablesByStatus[rec.status] = (receivablesByStatus[rec.status] || 0) + 1;

      if (rec.status !== 'CANCELED') {
        totalReceived = BoletoMath.roundBRL(totalReceived + rec.paidAmount);

        if (rec.status !== 'PAID') {
          totalOpen = BoletoMath.roundBRL(totalOpen + rec.remainingAmount);

          if (rec.dueDate === todayStr) {
            dueToday = BoletoMath.roundBRL(dueToday + rec.remainingAmount);
          } else if (rec.dueDate > todayStr && rec.dueDate <= in7Days) {
            dueNext7Days = BoletoMath.roundBRL(dueNext7Days + rec.remainingAmount);
          }

          if (rec.status === 'PARTIALLY_PAID') {
            partialPaymentsCount++;
          }

          if (rec.status === 'OVERDUE') {
            totalOverdue = BoletoMath.roundBRL(totalOverdue + rec.remainingAmount);
            const days = ReceivableCalculationService.getDaysDiff(rec.dueDate, todayStr);
            if (days <= 30) agingSummary.overdue1To30 += rec.remainingAmount;
            else if (days <= 60) agingSummary.overdue31To60 += rec.remainingAmount;
            else if (days <= 90) agingSummary.overdue61To90 += rec.remainingAmount;
            else agingSummary.overdue90Plus += rec.remainingAmount;
          } else {
            agingSummary.onTime += rec.remainingAmount;
          }
        }
      }
    }

    const collectionsByMethod: Record<CollectionMethod, number> = {
      PIX: 0,
      BOLETO: 0,
      PAYMENT_LINK: 0,
      MANUAL: 0,
    };
    let activeCollectionsCount = 0;
    let failedCollectionsCount = 0;

    for (const col of collectionsList) {
      collectionsByMethod[col.method] = (collectionsByMethod[col.method] || 0) + 1;
      if (col.status === 'ACTIVE' || col.status === 'PENDING') {
        activeCollectionsCount++;
      } else if (col.status === 'FAILED') {
        failedCollectionsCount++;
      }
    }

    return {
      totalOpen,
      totalOverdue,
      totalReceived,
      dueToday,
      dueNext7Days,
      partialPaymentsCount,
      activeCollectionsCount,
      failedCollectionsCount,
      receivablesByStatus,
      collectionsByMethod,
      agingSummary: {
        onTime: BoletoMath.roundBRL(agingSummary.onTime),
        overdue1To30: BoletoMath.roundBRL(agingSummary.overdue1To30),
        overdue31To60: BoletoMath.roundBRL(agingSummary.overdue31To60),
        overdue61To90: BoletoMath.roundBRL(agingSummary.overdue61To90),
        overdue90Plus: BoletoMath.roundBRL(agingSummary.overdue90Plus),
      },
    };
  }

  getCustomerSummary(
    receivablesList: Receivable[],
    customerId: string
  ): CustomerReceivablesSummary {
    const list = receivablesList.filter((r) => r.customerId === customerId);
    let totalOpen = 0;
    let totalOverdue = 0;
    let totalPaid = 0;
    let overdueCount = 0;
    let customerName = '';
    let customerDocument = '';

    for (const rec of list) {
      ReceivableCalculationService.applyToReceivable(rec);
      customerName = rec.customerName;
      customerDocument = rec.customerDocument;

      if (rec.status !== 'CANCELED') {
        totalPaid = BoletoMath.roundBRL(totalPaid + rec.paidAmount);
        if (rec.status !== 'PAID') {
          totalOpen = BoletoMath.roundBRL(totalOpen + rec.remainingAmount);
          if (rec.status === 'OVERDUE') {
            totalOverdue = BoletoMath.roundBRL(totalOverdue + rec.remainingAmount);
            overdueCount++;
          }
        }
      }
    }

    return {
      customerId,
      customerName,
      customerDocument,
      totalOpen,
      totalOverdue,
      totalPaid,
      isDefaulting: totalOverdue > 0,
      receivablesCount: list.length,
      overdueCount,
    };
  }
}
