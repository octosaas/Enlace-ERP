/**
 * Enlace ERP - Motor de Cálculo e Numeração Comercial / Operacional
 * PRD 04 - Orçamentos, Vendas, Contratos e Ordens de Serviço (Seções 8, 9, 32 e 52)
 */

import { QuoteItem, SaleItem } from '../../shared/types.js';

export class CommercialMath {
  /**
   * Arredonda com precisão monetária de 2 casas decimais (evita problemas de float).
   */
  static round(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calcula item com quantidade, preço unitário, desconto e acréscimo.
   */
  static calculateItem(
    quantity: number,
    unitPrice: number,
    discountVal = 0,
    discountPercent = 0,
    surchargeVal = 0,
    surchargePercent = 0
  ): { subtotal: number; discount: number; surcharge: number; total: number } {
    const qty = Math.max(0, quantity);
    const price = Math.max(0, unitPrice);
    const subtotal = this.round(qty * price);

    let discount = 0;
    if (discountPercent > 0) {
      discount = this.round(subtotal * (Math.min(100, discountPercent) / 100));
    } else if (discountVal > 0) {
      discount = this.round(Math.min(subtotal, discountVal));
    }

    const afterDiscount = Math.max(0, subtotal - discount);

    let surcharge = 0;
    if (surchargePercent > 0) {
      surcharge = this.round(afterDiscount * (surchargePercent / 100));
    } else if (surchargeVal > 0) {
      surcharge = this.round(surchargeVal);
    }

    const total = this.round(afterDiscount + surcharge);

    return {
      subtotal,
      discount,
      surcharge,
      total,
    };
  }

  /**
   * Recalcula os totais do documento comercial a partir dos seus itens e descontos/acréscimos globais.
   */
  static calculateDocumentTotals(
    items: Array<Pick<QuoteItem | SaleItem, 'quantity' | 'unitPrice' | 'discount' | 'surcharge' | 'total'>>,
    docDiscount = 0,
    docSurcharge = 0
  ): { subtotal: number; discount: number; surcharge: number; total: number } {
    const subtotal = this.round(items.reduce((acc, item) => acc + (item.total || 0), 0));
    const discount = this.round(Math.min(subtotal, Math.max(0, docDiscount)));
    const surcharge = this.round(Math.max(0, docSurcharge));
    const total = this.round(Math.max(0, subtotal - discount + surcharge));

    return {
      subtotal,
      discount,
      surcharge,
      total,
    };
  }
}
