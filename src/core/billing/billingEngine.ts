/**
 * Enlace ERP - Motor de Faturamento Comercial, Competências e Recorrência
 * PRD PARTE 05 - Seções 07 (Competência), 15 (Cálculo), 16 (Valores Monetários),
 * 20 a 24 (Recorrência e Idempotência) e 34 a 38 (Vencimento, Cancelamento e Estados)
 */

import {
  BillingDocument,
  BillingItem,
  BillingDocumentStatus,
  BillingSourceType,
  RecurringFrequency,
  DueRule,
  RecurringBilling,
  BillingGenerationLog,
} from '../../shared/types.js';
import { logger } from '../logger/index.js';

// ============================================================================
// 1. MOTOR DE CÁLCULO COMERCIAL E ARREDONDAMENTO BRL (SEÇÃO 15 E 16)
// ============================================================================

export class BillingMath {
  /**
   * Arredondamento financeiro BRL padrão de 2 casas decimais
   */
  static round(val: number): number {
    if (isNaN(val) || !isFinite(val)) return 0.0;
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calcula o total de um item faturável (Snapshot comercial)
   * Quantidade × Preço Unitário - Desconto + Acréscimo
   */
  static calculateItem(
    quantity: number,
    unitPrice: number,
    discount: number = 0,
    surcharge: number = 0
  ): { subtotal: number; discount: number; surcharge: number; total: number } {
    const qty = Math.max(0, quantity);
    const price = Math.max(0, unitPrice);
    const disc = Math.max(0, discount);
    const surch = Math.max(0, surcharge);

    const subtotal = this.round(qty * price);
    const finalDiscount = Math.min(subtotal, this.round(disc));
    const finalSurcharge = this.round(surch);
    const total = this.round(subtotal - finalDiscount + finalSurcharge);

    return {
      subtotal,
      discount: finalDiscount,
      surcharge: finalSurcharge,
      total,
    };
  }

  /**
   * Consolida os totais do documento a partir da lista de itens
   * e aplica descontos/acréscimos globais do cabeçalho
   */
  static calculateDocumentTotals(
    items: Array<{
      quantity: number;
      unitPrice: number;
      discount?: number;
      surcharge?: number;
    }>,
    globalDiscount: number = 0,
    globalSurcharge: number = 0
  ): { subtotal: number; discount: number; surcharge: number; total: number } {
    let subtotalSum = 0;
    let itemsDiscountSum = 0;
    let itemsSurchargeSum = 0;

    for (const it of items) {
      const calc = this.calculateItem(
        it.quantity,
        it.unitPrice,
        it.discount || 0,
        it.surcharge || 0
      );
      subtotalSum += calc.subtotal;
      itemsDiscountSum += calc.discount;
      itemsSurchargeSum += calc.surcharge;
    }

    const subtotal = this.round(subtotalSum);
    const totalDiscount = this.round(itemsDiscountSum + Math.max(0, globalDiscount));
    const totalSurcharge = this.round(itemsSurchargeSum + Math.max(0, globalSurcharge));
    const total = Math.max(0, this.round(subtotal - totalDiscount + totalSurcharge));

    return {
      subtotal,
      discount: totalDiscount,
      surcharge: totalSurcharge,
      total,
    };
  }

  /**
   * Cálculo de Pro Rata die (Seção 35)
   * Calcula valor proporcional de mensalidade para contratos que iniciam ou encerram no meio do mês
   */
  static calculateProRata(
    monthlyAmount: number,
    startDateStr: string,
    endDateStr: string,
    daysInMonth?: number
  ): number {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    const totalDays =
      daysInMonth ||
      new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const activeDays = Math.min(
      totalDays,
      Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    );

    const dailyRate = monthlyAmount / totalDays;
    return this.round(dailyRate * activeDays);
  }
}

// ============================================================================
// 2. AUXILIAR DE COMPETÊNCIAS E DATAS (SEÇÃO 07, 08, 23 E 34)
// ============================================================================

export class CompetenceHelper {
  /**
   * Retorna datas de início, fim e rótulo da competência (ex: '09/2026')
   */
  static getCompetenceForDate(dateInput?: string | Date): {
    competenceStart: string;
    competenceEnd: string;
    competenceLabel: string;
  } {
    const d = dateInput ? new Date(dateInput) : new Date();
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth(); // 0-indexed

    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0));

    const pad = (n: number) => n.toString().padStart(2, '0');
    const startStr = `${year}-${pad(month + 1)}-01`;
    const endStr = `${year}-${pad(month + 1)}-${pad(end.getUTCDate())}`;
    const label = `${pad(month + 1)}/${year}`;

    return {
      competenceStart: startStr,
      competenceEnd: endStr,
      competenceLabel: label,
    };
  }

  /**
   * Normaliza rótulo de competência (aceita '09/2026' ou '2026-09')
   */
  static parseCompetenceLabel(label: string): {
    competenceStart: string;
    competenceEnd: string;
    competenceLabel: string;
  } {
    let year: number;
    let month: number;

    if (label.includes('/')) {
      const parts = label.split('/');
      month = parseInt(parts[0], 10);
      year = parseInt(parts[1], 10);
    } else if (label.includes('-')) {
      const parts = label.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    } else {
      return this.getCompetenceForDate();
    }

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return this.getCompetenceForDate();
    }

    const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const pad = (n: number) => n.toString().padStart(2, '0');

    return {
      competenceStart: `${year}-${pad(month)}-01`,
      competenceEnd: `${year}-${pad(month)}-${pad(endDay)}`,
      competenceLabel: `${pad(month)}/${year}`,
    };
  }

  /**
   * Calcula a data de vencimento com base na regra de negócio (Seção 34)
   */
  static calculateDueDate(
    issueDateStr: string,
    competenceEndStr: string,
    dueRule: DueRule,
    dueDays: number = 10,
    dayOfMonth: number = 10
  ): string {
    const issueDate = new Date(issueDateStr);
    const pad = (n: number) => n.toString().padStart(2, '0');

    if (dueRule === 'FIXED_DAY') {
      const year = issueDate.getUTCFullYear();
      const month = issueDate.getUTCMonth(); // 0-indexed
      const targetDay = Math.min(28, Math.max(1, dayOfMonth));

      // Se a emissão foi depois do dia fixo, o vencimento vai para o dia fixo do mês seguinte
      let dueYear = year;
      let dueMonth = month;
      if (issueDate.getUTCDate() > targetDay) {
        dueMonth += 1;
        if (dueMonth > 11) {
          dueMonth = 0;
          dueYear += 1;
        }
      }

      return `${dueYear}-${pad(dueMonth + 1)}-${pad(targetDay)}`;
    }

    if (dueRule === 'DAYS_AFTER_ISSUE') {
      const d = new Date(issueDate);
      d.setUTCDate(d.getUTCDate() + Math.max(1, dueDays));
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }

    if (dueRule === 'DAYS_AFTER_COMPETENCE') {
      const d = new Date(competenceEndStr);
      d.setUTCDate(d.getUTCDate() + Math.max(1, dueDays));
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }

    // Default: 10 dias após emissão
    const d = new Date(issueDate);
    d.setUTCDate(d.getUTCDate() + 10);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  /**
   * Calcula a próxima competência e data de faturamento com base na frequência (Seção 21)
   */
  static advanceNextBillingDate(
    currentBillingDate: string,
    frequency: RecurringFrequency,
    customIntervalMonths: number = 1,
    dayOfMonth: number = 10
  ): string {
    const d = new Date(currentBillingDate);
    let stepMonths = 1;

    switch (frequency) {
      case 'MONTHLY':
        stepMonths = 1;
        break;
      case 'QUARTERLY':
        stepMonths = 3;
        break;
      case 'SEMIANNUAL':
        stepMonths = 6;
        break;
      case 'YEARLY':
        stepMonths = 12;
        break;
      case 'CUSTOM':
        stepMonths = Math.max(1, customIntervalMonths);
        break;
    }

    let year = d.getUTCFullYear();
    let month = d.getUTCMonth() + stepMonths;

    while (month > 11) {
      month -= 12;
      year += 1;
    }

    const pad = (n: number) => n.toString().padStart(2, '0');
    const maxDayInNextMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const finalDay = Math.min(dayOfMonth, maxDayInNextMonth);

    return `${year}-${pad(month + 1)}-${pad(finalDay)}`;
  }
}

// ============================================================================
// 3. MÁQUINA DE ESTADOS DO FATURAMENTO (SEÇÃO 12 E 38)
// ============================================================================

export class BillingStateMachine {
  private static VALID_TRANSITIONS: Record<BillingDocumentStatus, BillingDocumentStatus[]> = {
    DRAFT: ['PENDING', 'ISSUED', 'CANCELED'],
    PENDING: ['ISSUED', 'CANCELED'],
    ISSUED: ['CANCELED'], // Cancelamento formal com justificativa
    CANCELED: [], // Estado terminal
  };

  /**
   * Verifica se a transição de status é permitida
   */
  static canTransition(
    currentStatus: BillingDocumentStatus,
    targetStatus: BillingDocumentStatus
  ): boolean {
    const allowed = this.VALID_TRANSITIONS[currentStatus] || [];
    return allowed.includes(targetStatus);
  }

  /**
   * Valida se o documento pode sofrer edição estrutural (itens, valores, cliente)
   * Conforme Seção 38: Depois de ISSUED ou CANCELED, alterações estruturais são estritamente proibidas
   */
  static assertEditable(doc: BillingDocument): void {
    if (doc.status === 'ISSUED') {
      throw new Error(
        `[BillingStateMachine] Faturamento ${doc.number} já foi EMITIDO (ISSUED). Alterações estruturais após emissão são bloqueadas. Cancele e gere novo faturamento.`
      );
    }
    if (doc.status === 'CANCELED') {
      throw new Error(
        `[BillingStateMachine] Faturamento ${doc.number} está CANCELADO. Nenhuma alteração é permitida.`
      );
    }
  }
}

// ============================================================================
// 4. GERENCIADOR DE CONCORRÊNCIA & IDEMPOTÊNCIA (SEÇÕES 24, 64 E 65)
// ============================================================================

export class RecurringBillingConcurrencyManager {
  private static activeLocks = new Set<string>();

  /**
   * Executa uma função com lock transacional baseado na tupla (instanceId, recurringId, competenceStart)
   * Se dois workers tentarem rodar simultaneamente, o segundo aguarda ou é rejeitado de forma controlada
   */
  static async withLock<T>(
    instanceId: string,
    recurringBillingId: string,
    competenceStart: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const lockKey = `${instanceId}:${recurringBillingId}:${competenceStart}`;

    if (this.activeLocks.has(lockKey)) {
      logger.warn(
        `[RecurringBillingConcurrencyManager] Concorrência detectada para chave ${lockKey}. Bloqueando execução concorrente.`
      );
      // Aguarda 100ms e tenta novamente ou rejeita
      await new Promise((r) => setTimeout(r, 100));
      if (this.activeLocks.has(lockKey)) {
        throw new Error(
          `[RecurringBillingConcurrencyManager] Operação concorrente em andamento para a recorrência ${recurringBillingId} na competência ${competenceStart}.`
        );
      }
    }

    this.activeLocks.add(lockKey);
    try {
      return await fn();
    } finally {
      this.activeLocks.delete(lockKey);
    }
  }
}
