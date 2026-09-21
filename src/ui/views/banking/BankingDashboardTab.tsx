/**
 * Enlace ERP - Tab de Indicadores e Métricas de Cobrança Bancária (PRD 09)
 */

import React from 'react';
import { BankingDashboardMetrics } from '../../../shared/types.js';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Barcode,
  QrCode,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Calendar,
} from 'lucide-react';

interface BankingDashboardTabProps {
  metrics: BankingDashboardMetrics | null;
  onNavigateTab: (tab: string) => void;
  onOpenNewBoleto: () => void;
  onOpenNewPix: () => void;
  onOpenRemessa: () => void;
  onOpenRetorno: () => void;
}

export const BankingDashboardTab: React.FC<BankingDashboardTabProps> = ({
  metrics,
  onNavigateTab,
  onOpenNewBoleto,
  onOpenNewPix,
  onOpenRemessa,
  onOpenRetorno,
}) => {
  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (!metrics) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 text-sm">
        Carregando indicadores financeiros e métricas de cobrança...
      </div>
    );
  }

  const totalChannels =
    metrics.channelPerformance.boletoVolume +
    metrics.channelPerformance.pixVolume +
    metrics.channelPerformance.transferVolume;

  const boletoPct = totalChannels > 0 ? (metrics.channelPerformance.boletoVolume / totalChannels) * 100 : 0;
  const pixPct = totalChannels > 0 ? (metrics.channelPerformance.pixVolume / totalChannels) * 100 : 0;
  const transferPct = totalChannels > 0 ? (metrics.channelPerformance.transferVolume / totalChannels) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Barra de Ações Rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <h2 className="text-sm font-bold text-white">Central de Operações Bancárias</h2>
          <p className="text-xs text-slate-400">
            Emita títulos, processe lotes de liquidação CNAB e receba pagamentos via Pix Dinâmico em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenNewBoleto}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors shadow-sm"
          >
            <Barcode className="h-4 w-4" />
            Emitir Boleto
          </button>
          <button
            onClick={onOpenNewPix}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
          >
            <QrCode className="h-4 w-4 text-emerald-400" />
            Nova Cobrança Pix
          </button>
          <button
            onClick={onOpenRemessa}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 text-indigo-400" />
            Gerar Remessa CNAB
          </button>
          <button
            onClick={onOpenRetorno}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <ArrowUpRight className="h-4 w-4 text-cyan-400" />
            Processar Retorno CNAB
          </button>
        </div>
      </div>

      {/* Grid de Métricas Principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Total a Receber */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Carteira a Receber</span>
            <DollarSign className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-2 text-xl font-bold text-white">{formatBRL(metrics.totalToCollect)}</p>
          <p className="mt-1 text-[11px] text-slate-400">Títulos em aberto no sistema</p>
        </div>

        {/* Total Liquidado Mês */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Liquidado no Mês</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-xl font-bold text-emerald-400">{formatBRL(metrics.totalCollectedMonth)}</p>
          <p className="mt-1 text-[11px] text-emerald-500/80 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Baixas automáticas
          </p>
        </div>

        {/* Inadimplência */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Inadimplência</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-xl font-bold text-amber-400">{metrics.defaultRate.toFixed(1)}%</p>
          <p className="mt-1 text-[11px] text-slate-400">Títulos com vencimento estourado</p>
        </div>

        {/* Boletos Ativos */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Boletos Ativos</span>
            <Barcode className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-xl font-bold text-white">{metrics.boletosActiveCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">Emitidos aguardando liquidação</p>
        </div>

        {/* Pix Dinâmico Ativos */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Pix Ativos</span>
            <QrCode className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-xl font-bold text-white">{metrics.pixActiveCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">QR Codes gerados em aberto</p>
        </div>

        {/* Pendentes de Remessa CNAB */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Pendente Remessa</span>
            <FileSpreadsheet className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-xl font-bold text-indigo-300">{metrics.pendingRemessaCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">Boletos para transmissão</p>
        </div>
      </div>

      {/* Grid de Análises: Aging de Vencimentos & Performance por Canal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Aging de Vencimentos (Inadimplência Estruturada) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white">Aging da Carteira de Cobrança</h3>
              <p className="text-xs text-slate-400">Distribuição temporal dos títulos a vencer e vencidos</p>
            </div>
            <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-300">
              PRD 09 • Seção 04
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">A Vencer (Em dia)</span>
                <span className="font-bold text-emerald-400">{formatBRL(metrics.agingBreakdown.onTime)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${metrics.totalToCollect > 0 ? (metrics.agingBreakdown.onTime / metrics.totalToCollect) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Vencidos até 30 dias</span>
                <span className="font-bold text-amber-400">{formatBRL(metrics.agingBreakdown.upTo30Days)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${metrics.totalToCollect > 0 ? (metrics.agingBreakdown.upTo30Days / metrics.totalToCollect) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Vencidos de 31 a 60 dias</span>
                <span className="font-bold text-orange-400">{formatBRL(metrics.agingBreakdown.from31To60Days)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full"
                  style={{
                    width: `${metrics.totalToCollect > 0 ? (metrics.agingBreakdown.from31To60Days / metrics.totalToCollect) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Vencidos acima de 90 dias (Crítico)</span>
                <span className="font-bold text-rose-400">{formatBRL(metrics.agingBreakdown.above90Days)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{
                    width: `${metrics.totalToCollect > 0 ? (metrics.agingBreakdown.above90Days / metrics.totalToCollect) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Desempenho por Canal de Recebimento */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white">Canais de Liquidação & Eficiência</h3>
              <p className="text-xs text-slate-400">Volume recebido discriminado por método bancário</p>
            </div>
            <span className="rounded bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              100% Conciliado
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <Barcode className="h-3.5 w-3.5 text-blue-400" />
                  Boletos Bancários (Compensação Noturna / CNAB)
                </span>
                <span className="font-bold text-slate-100">
                  {formatBRL(metrics.channelPerformance.boletoVolume)} ({boletoPct.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${boletoPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <QrCode className="h-3.5 w-3.5 text-emerald-400" />
                  Pix Dinâmico (Bacen SPI Instantâneo 24x7)
                </span>
                <span className="font-bold text-slate-100">
                  {formatBRL(metrics.channelPerformance.pixVolume)} ({pixPct.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pixPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <Building2 className="h-3.5 w-3.5 text-purple-400" />
                  Transferências Bancárias (TED / DOC / TEF)
                </span>
                <span className="font-bold text-slate-100">
                  {formatBRL(metrics.channelPerformance.transferVolume)} ({transferPct.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${transferPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico Recente de Liquidações */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Transações e Liquidações Recentes</h3>
            <p className="text-xs text-slate-400">
              Últimos pagamentos conciliados automaticamente com baixa de duplicatas e atualização de saldo
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2.5 font-semibold">Data</th>
                <th className="pb-2.5 font-semibold">Documento</th>
                <th className="pb-2.5 font-semibold">Cliente / Pagador</th>
                <th className="pb-2.5 font-semibold">Canal</th>
                <th className="pb-2.5 font-semibold text-right">Valor</th>
                <th className="pb-2.5 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {metrics.recentTransactions && metrics.recentTransactions.length > 0 ? (
                metrics.recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 text-slate-300 font-mono">{tx.date}</td>
                    <td className="py-2.5 font-medium text-white">{tx.titleNumber}</td>
                    <td className="py-2.5 text-slate-300">{tx.customerName}</td>
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-300">
                        {tx.method === 'PIX' && <QrCode className="h-3 w-3 text-emerald-400" />}
                        {tx.method === 'BOLETO' && <Barcode className="h-3 w-3 text-blue-400" />}
                        {tx.method === 'TRANSFER' && <Building2 className="h-3 w-3 text-purple-400" />}
                        {tx.method}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold text-emerald-400">{formatBRL(tx.amount)}</td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    Nenhuma liquidação recente registrada no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
