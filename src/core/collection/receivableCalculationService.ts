/**
 * Enlace ERP - PRD PARTE 06: Serviço de Cálculo de Contas a Receber
 * Responsável por calcular juros, multas, descontos e valor atualizado com precisão decimal estrita
 */

import { BoletoMath } from '../banking/bankingEngine.js';
import {
  DiscountType,
  FineType,
  InterestType,
  Receivable,
} from '../../shared/types.js';

export interface CalculationInput {
  originalAmount: number;
  dueDate: string;
  referenceDate?: string;
  interestType?: InterestType;
  interestValue?: number; // % ao mês ou fixo por dia
  fineType?: FineType;
  fineValue?: number; // % ou fixo
  discountType?: DiscountType;
  discountValue?: number;
  discountDeadline?: string;
  paidAmount?: number;
}

export interface CalculationResult {
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  isOverdue: boolean;
  overdueDays: number;
  interestAmount: number;
  fineAmount: number;
  discountAmount: number;
  currentAmount: number;
}

export class ReceivableCalculationService {
  /**
   * Arredondamento monetário estrito brasileiro em 2 casas decimais
   */
  static round(val: number): number {
    return BoletoMath.roundBRL(val);
  }

  /**
   * Calcula a diferença em dias entre duas datas no formato YYYY-MM-DD
   */
  static getDaysDiff(fromDateStr: string, toDateStr: string): number {
    const from = new Date(fromDateStr.slice(0, 10) + 'T00:00:00Z');
    const to = new Date(toDateStr.slice(0, 10) + 'T00:00:00Z');
    const diffMs = to.getTime() - from.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Calcula o valor atualizado de um título/recebível
   */
  static calculate(input: CalculationInput): CalculationResult {
    const originalAmount = this.round(input.originalAmount);
    const paidAmount = this.round(input.paidAmount || 0);
    const baseAmount = Math.max(0, this.round(originalAmount - paidAmount));

    const todayStr = (input.referenceDate || new Date().toISOString()).slice(0, 10);
    const dueDateStr = input.dueDate.slice(0, 10);

    const overdueDays = Math.max(0, this.getDaysDiff(dueDateStr, todayStr));
    const isOverdue = overdueDays > 0;

    let interestAmount = 0;
    let fineAmount = 0;
    let discountAmount = 0;

    // 1. Juros e Multa (Aplicados apenas após o vencimento sobre o saldo devedor)
    if (isOverdue && baseAmount > 0) {
      // Multa moratória
      if (input.fineValue && input.fineValue > 0) {
        if (input.fineType === 'FIXED') {
          fineAmount = this.round(input.fineValue);
        } else {
          // Padrão: Percentual sobre o saldo em atraso
          fineAmount = this.round((baseAmount * input.fineValue) / 100);
        }
      }

      // Juros de mora pro-rata die
      if (input.interestValue && input.interestValue > 0) {
        if (input.interestType === 'FIXED') {
          interestAmount = this.round(input.interestValue * overdueDays);
        } else {
          // Padrão: % ao mês pro-rata die (taxa mensal / 30 * dias)
          const dailyRate = input.interestValue / 30 / 100;
          interestAmount = this.round(baseAmount * dailyRate * overdueDays);
        }
      }
    }

    // 2. Desconto por pontualidade (Aplicável se pago até a data limite)
    const discountDeadline = (input.discountDeadline || input.dueDate).slice(0, 10);
    const canApplyDiscount = todayStr <= discountDeadline && !isOverdue;

    if (canApplyDiscount && input.discountValue && input.discountValue > 0 && baseAmount > 0) {
      if (input.discountType === 'FIXED') {
        discountAmount = this.round(Math.min(baseAmount, input.discountValue));
      } else {
        discountAmount = this.round((baseAmount * input.discountValue) / 100);
      }
    }

    // 3. Valor Atualizado Final
    const currentAmount = this.round(
      Math.max(0, baseAmount + interestAmount + fineAmount - discountAmount)
    );

    return {
      originalAmount,
      paidAmount,
      remainingAmount: baseAmount,
      isOverdue,
      overdueDays,
      interestAmount,
      fineAmount,
      discountAmount,
      currentAmount,
    };
  }

  /**
   * Atualiza e sincroniza os valores calculados de um objeto Receivable
   */
  static applyToReceivable(rec: Receivable, referenceDate?: string): Receivable {
    const calc = this.calculate({
      originalAmount: rec.originalAmount,
      paidAmount: rec.paidAmount,
      dueDate: rec.dueDate,
      referenceDate,
      interestType: rec.interestType,
      interestValue: rec.interestValue,
      fineType: rec.fineType,
      fineValue: rec.fineValue,
      discountType: rec.discountType,
      discountValue: rec.discountValue,
      discountDeadline: rec.discountDeadline,
    });

    rec.interestAmount = calc.interestAmount;
    rec.fineAmount = calc.fineAmount;
    rec.discountAmount = calc.discountAmount;
    rec.remainingAmount = calc.remainingAmount;
    rec.currentAmount = calc.currentAmount;

    // Derivação estrita do status pelo backend (Seção 14 do PRD)
    if (rec.status !== 'CANCELED' && rec.status !== 'WRITTEN_OFF') {
      if (rec.paidAmount >= rec.originalAmount && rec.originalAmount > 0) {
        rec.status = 'PAID';
      } else if (rec.paidAmount > 0) {
        rec.status = 'PARTIALLY_PAID';
      } else if (calc.isOverdue) {
        rec.status = 'OVERDUE';
      } else {
        rec.status = 'PENDING';
      }
    }

    return rec;
  }
}
