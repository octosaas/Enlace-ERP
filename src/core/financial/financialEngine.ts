/**
 * Enlace ERP - Motor de Cálculo e Inteligência Financeira
 * PRD 05 - Gestão Financeira, Contas a Receber, Contas a Pagar, Tesouraria e DRE Gerencial
 */

import {
  AccountReceivable,
  AccountPayable,
  BankAccount,
  CashFlowDay,
  FinancialTitleStatus,
  IncomeStatementItem,
} from '../../shared/types.js';

export class FinancialMath {
  /**
   * Arredonda valores monetários estritamente para 2 casas decimais (BRL),
   * eliminando resíduos de ponto flutuante de JavaScript.
   */
  static round(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calcula encargos moratórios conforme a legislação e práticas financeiras do Brasil:
   * - Multa de mora contratual (ex: 2%) sobre o valor original.
   * - Juros de mora pro-rata die (ex: 1% ao mês dividido por 30 dias = ~0,0333% ao dia).
   */
  static calculateLateCharges(params: {
    dueDate: string;
    baseAmount: number;
    fineRatePercent?: number; // Padrão 2%
    monthlyInterestRatePercent?: number; // Padrão 1% ao mês
    currentDate?: string;
  }): {
    daysLate: number;
    isOverdue: boolean;
    fineValue: number;
    interestValue: number;
    totalPayable: number;
  } {
    const {
      dueDate,
      baseAmount,
      fineRatePercent = 2.0,
      monthlyInterestRatePercent = 1.0,
      currentDate = new Date().toISOString().split('T')[0],
    } = params;

    const dueTime = new Date(`${dueDate}T00:00:00Z`).getTime();
    const currTime = new Date(`${currentDate}T00:00:00Z`).getTime();

    const diffTime = currTime - dueTime;
    const daysLate = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    if (daysLate <= 0) {
      return {
        daysLate: 0,
        isOverdue: false,
        fineValue: 0,
        interestValue: 0,
        totalPayable: this.round(baseAmount),
      };
    }

    // Multa sobre o principal
    const fineValue = this.round(baseAmount * (fineRatePercent / 100));

    // Juros pro-rata die
    const dailyInterestRate = monthlyInterestRatePercent / 30 / 100;
    const interestValue = this.round(baseAmount * dailyInterestRate * daysLate);

    const totalPayable = this.round(baseAmount + fineValue + interestValue);

    return {
      daysLate,
      isOverdue: true,
      fineValue,
      interestValue,
      totalPayable,
    };
  }

  /**
   * Processa a liquidação total ou parcial de um título financeiro.
   */
  static calculateSettlement(params: {
    currentBalance: number;
    paidAmount: number;
    discountValue?: number;
    fineValue?: number;
    interestValue?: number;
  }): {
    newPaidIncrement: number;
    newBalance: number;
    newStatus: FinancialTitleStatus;
  } {
    const {
      currentBalance,
      paidAmount,
      discountValue = 0,
      fineValue = 0,
      interestValue = 0,
    } = params;

    const adjustedDemand = this.round(
      Math.max(0, currentBalance + fineValue + interestValue - discountValue)
    );
    const amountApplied = this.round(Math.min(paidAmount, adjustedDemand));
    const newBalance = this.round(Math.max(0, adjustedDemand - amountApplied));

    let newStatus: FinancialTitleStatus = 'OPEN';
    if (newBalance <= 0) {
      newStatus = 'PAID';
    } else if (amountApplied > 0) {
      newStatus = 'PARTIALLY_PAID';
    }

    return {
      newPaidIncrement: amountApplied,
      newBalance,
      newStatus,
    };
  }
}

export class CashFlowEngine {
  /**
   * Gera a projeção diária do Fluxo de Caixa para um horizonte de dias (ex: 30 dias),
   * combinando saldos bancários em tempo real, previsões de recebimentos/pagamentos
   * e movimentações já liquidadas.
   */
  static generateProjection(params: {
    initialTreasuryBalance: number;
    receivables: AccountReceivable[];
    payables: AccountPayable[];
    daysHorizon?: number;
    startDate?: string;
  }): CashFlowDay[] {
    const {
      initialTreasuryBalance,
      receivables,
      payables,
      daysHorizon = 30,
      startDate = new Date().toISOString().split('T')[0],
    } = params;

    const start = new Date(`${startDate}T00:00:00Z`);
    const timeline: CashFlowDay[] = [];
    let runningCumulativeBalance = initialTreasuryBalance;

    for (let i = 0; i < daysHorizon; i++) {
      const dayDate = new Date(start.getTime() + i * 86400000);
      const dateStr = dayDate.toISOString().split('T')[0];

      // Entradas previstas e realizadas
      let inflowsPredicted = 0;
      let inflowsRealized = 0;

      for (const rec of receivables) {
        if (rec.status === 'CANCELED') continue;

        if (rec.status === 'PAID' && rec.paidAt && rec.paidAt.startsWith(dateStr)) {
          inflowsRealized += rec.paidValue;
        } else if (['OPEN', 'PARTIALLY_PAID', 'OVERDUE'].includes(rec.status) && rec.dueDate === dateStr) {
          inflowsPredicted += rec.balanceValue;
        }
      }

      // Saídas previstas e realizadas
      let outflowsPredicted = 0;
      let outflowsRealized = 0;

      for (const pag of payables) {
        if (pag.status === 'CANCELED') continue;

        if (pag.status === 'PAID' && pag.paidAt && pag.paidAt.startsWith(dateStr)) {
          outflowsRealized += pag.paidValue;
        } else if (['OPEN', 'PARTIALLY_PAID', 'OVERDUE'].includes(pag.status) && pag.dueDate === dateStr) {
          outflowsPredicted += pag.balanceValue;
        }
      }

      inflowsPredicted = FinancialMath.round(inflowsPredicted);
      inflowsRealized = FinancialMath.round(inflowsRealized);
      outflowsPredicted = FinancialMath.round(outflowsPredicted);
      outflowsRealized = FinancialMath.round(outflowsRealized);

      const netDay = FinancialMath.round(
        (inflowsRealized || inflowsPredicted) - (outflowsRealized || outflowsPredicted)
      );
      runningCumulativeBalance = FinancialMath.round(runningCumulativeBalance + netDay);

      timeline.push({
        date: dateStr,
        inflowsPredicted,
        inflowsRealized,
        outflowsPredicted,
        outflowsRealized,
        netDay,
        cumulativeBalance: runningCumulativeBalance,
      });
    }

    return timeline;
  }
}

export class IncomeStatementEngine {
  /**
   * Consolida o DRE Gerencial (Demonstrativo do Resultado do Exercício)
   * estruturado por competência a partir dos lançamentos e contas contábeis da empresa.
   */
  static generateReport(params: {
    receivables: AccountReceivable[];
    payables: AccountPayable[];
  }): IncomeStatementItem[] {
    const { receivables, payables } = params;

    // 1. Receita Operacional Bruta
    const grossRevenue = FinancialMath.round(
      receivables
        .filter((r) => r.status !== 'CANCELED')
        .reduce((sum, r) => sum + r.originalValue, 0)
    );

    // 2. Deduções da Receita Bruta (Descontos concedidos, impostos diretos)
    const revenueDeductions = FinancialMath.round(
      receivables
        .filter((r) => r.status !== 'CANCELED')
        .reduce((sum, r) => sum + (r.discountValue || 0), 0) +
        FinancialMath.round(grossRevenue * 0.05) // Alíquota estimada simples/ISS 5%
    );

    // 3. (=) Receita Operacional Líquida
    const netRevenue = FinancialMath.round(Math.max(0, grossRevenue - revenueDeductions));

    // 4. Custos Operacionais / Serviços Prestados / CMV
    const operationalCosts = FinancialMath.round(
      payables
        .filter(
          (p) =>
            p.status !== 'CANCELED' &&
            (p.chartOfAccountCode?.startsWith('3.1') || p.description.toLowerCase().includes('serviço'))
        )
        .reduce((sum, p) => sum + p.originalValue, 0) || FinancialMath.round(netRevenue * 0.35)
    );

    // 5. (=) Lucro Bruto
    const grossProfit = FinancialMath.round(netRevenue - operationalCosts);

    // 6. Despesas Operacionais (Administrativas, Comerciais, Gerais)
    const operationalExpenses = FinancialMath.round(
      payables
        .filter(
          (p) =>
            p.status !== 'CANCELED' &&
            !p.chartOfAccountCode?.startsWith('3.1') &&
            !p.description.toLowerCase().includes('serviço')
        )
        .reduce((sum, p) => sum + p.originalValue, 0) || FinancialMath.round(netRevenue * 0.22)
    );

    // 7. (=) EBITDA / Resultado Operacional
    const ebitda = FinancialMath.round(grossProfit - operationalExpenses);

    // 8. (+/-) Resultado Financeiro Líquido (Juros/multas auferidos - Juros/multas pagos)
    const financialRevenue = FinancialMath.round(
      receivables.filter((r) => r.status !== 'CANCELED').reduce((sum, r) => sum + (r.interestValue + r.fineValue), 0)
    );
    const financialExpenses = FinancialMath.round(
      payables.filter((p) => p.status !== 'CANCELED').reduce((sum, p) => sum + (p.interestValue + p.fineValue), 0)
    );
    const netFinancialResult = FinancialMath.round(financialRevenue - financialExpenses);

    // 9. (=) Lucro / Prejuízo Líquido do Período
    const netProfit = FinancialMath.round(ebitda + netFinancialResult);

    const baseForPct = grossRevenue > 0 ? grossRevenue : 1;

    const dreItems: IncomeStatementItem[] = [
      {
        code: '1.0',
        name: 'RECEITA OPERACIONAL BRUTA',
        level: 1,
        type: 'REVENUE',
        value: grossRevenue,
        percentage: 100.0,
      },
      {
        code: '1.1',
        name: '(-) Deduções da Receita Bruta & Impostos Fiscais',
        level: 2,
        type: 'DEDUCTION',
        value: -revenueDeductions,
        percentage: FinancialMath.round((revenueDeductions / baseForPct) * 100),
      },
      {
        code: '2.0',
        name: '(=) RECEITA OPERACIONAL LÍQUIDA',
        level: 1,
        type: 'RESULT',
        value: netRevenue,
        percentage: FinancialMath.round((netRevenue / baseForPct) * 100),
      },
      {
        code: '2.1',
        name: '(-) Custos dos Serviços e Mercadorias (CSP / CMV)',
        level: 2,
        type: 'COST',
        value: -operationalCosts,
        percentage: FinancialMath.round((operationalCosts / baseForPct) * 100),
      },
      {
        code: '3.0',
        name: '(=) LUCRO BRUTO / MARGEM DE CONTRIBUIÇÃO',
        level: 1,
        type: 'RESULT',
        value: grossProfit,
        percentage: FinancialMath.round((grossProfit / baseForPct) * 100),
      },
      {
        code: '3.1',
        name: '(-) Despesas Operacionais (Administrativas & Pessoal)',
        level: 2,
        type: 'EXPENSE',
        value: -operationalExpenses,
        percentage: FinancialMath.round((operationalExpenses / baseForPct) * 100),
      },
      {
        code: '4.0',
        name: '(=) RESULTADO OPERACIONAL (EBITDA)',
        level: 1,
        type: 'RESULT',
        value: ebitda,
        percentage: FinancialMath.round((ebitda / baseForPct) * 100),
      },
      {
        code: '4.1',
        name: '(+/-) Resultado Financeiro Líquido (Juros & Encargos)',
        level: 2,
        type: 'RESULT',
        value: netFinancialResult,
        percentage: FinancialMath.round((netFinancialResult / baseForPct) * 100),
      },
      {
        code: '5.0',
        name: '(=) RESULTADO LÍQUIDO DO EXERCÍCIO (LUCRO LÍQUIDO)',
        level: 1,
        type: 'RESULT',
        value: netProfit,
        percentage: FinancialMath.round((netProfit / baseForPct) * 100),
      },
    ];

    return dreItems;
  }
}
