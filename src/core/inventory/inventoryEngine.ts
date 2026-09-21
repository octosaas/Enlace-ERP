/**
 * Enlace ERP - Motor de Estoque & Almoxarifado (WMS)
 * PRD 06 - Gestão de Múltiplos Depósitos, Kardex, Custo Médio Ponderado (CMP) e Rastreabilidade
 */

import {
  Warehouse,
  StockItem,
  StockMovement,
  StockMovementType,
  StockMovementReferenceType,
  StockTransferInput,
  InventoryMetrics,
} from '../../shared/types.js';
import { logger } from '../logger/index.js';

export class InventoryMath {
  /**
   * Arredondamento com precisão configurável (padrão 2 para moeda, 4 para custos unitários/CMP)
   */
  static round(val: number, decimals: number = 2): number {
    if (isNaN(val) || !isFinite(val)) return 0.0;
    const factor = Math.pow(10, decimals);
    return Math.round((val + Number.EPSILON) * factor) / factor;
  }

  /**
   * Cálculo de Custo Médio Ponderado (CMP) para entradas de mercadorias
   * CMP = (Saldo Financeiro Anterior + Custo Total da Nova Entrada) / Novo Saldo Físico
   */
  static calculateCMP(
    currentQuantity: number,
    currentAverageCost: number,
    inboundQuantity: number,
    inboundUnitCost: number
  ): { newQuantity: number; newAverageCost: number; totalValue: number } {
    const prevQty = Math.max(0, currentQuantity);
    const prevCost = Math.max(0, currentAverageCost);
    const inQty = Math.max(0, inboundQuantity);
    const inCost = Math.max(0, inboundUnitCost);

    const prevValue = prevQty * prevCost;
    const inValue = inQty * inCost;
    const newQuantity = this.round(prevQty + inQty, 4);
    const totalValue = this.round(prevValue + inValue, 2);

    const newAverageCost =
      newQuantity > 0 ? this.round(totalValue / newQuantity, 4) : inCost;

    return {
      newQuantity,
      newAverageCost,
      totalValue,
    };
  }

  /**
   * Validação de disponibilidade de saldo para expedição/saída
   */
  static checkAvailability(
    availableQuantity: number,
    requestedQuantity: number
  ): { isAvailable: boolean; available: number; requested: number; deficit: number } {
    const available = Math.max(0, availableQuantity);
    const requested = Math.max(0, requestedQuantity);
    const isAvailable = available >= requested;
    const deficit = isAvailable ? 0 : this.round(requested - available, 4);

    return {
      isAvailable,
      available,
      requested,
      deficit,
    };
  }
}

export class InventoryEngine {
  /**
   * Formatação padronizada de código sequencial de movimentação
   * Exemplo: 'MOV-000001'
   */
  static formatMovementNumber(sequence: number): string {
    return `MOV-${String(sequence).padStart(6, '0')}`;
  }

  /**
   * Formatação padronizada de código sequencial de depósito
   * Exemplo: 'DEP-01'
   */
  static formatWarehouseCode(sequence: number): string {
    return `DEP-${String(sequence).padStart(2, '0')}`;
  }
}
