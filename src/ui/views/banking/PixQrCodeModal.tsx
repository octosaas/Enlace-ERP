/**
 * Enlace ERP - Modal de QR Code Pix e Simulador de Pagamento Bacen (PRD 09)
 */

import React, { useState } from 'react';
import { PixCharge } from '../../../shared/types.js';
import { X, Copy, Check, QrCode, Play, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';

interface PixQrCodeModalProps {
  charge: PixCharge;
  onClose: () => void;
  onSimulatePayment: (txid: string) => Promise<void>;
}

export const PixQrCodeModal: React.FC<PixQrCodeModalProps> = ({ charge, onClose, onSimulatePayment }) => {
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedResult, setSimulatedResult] = useState<string | null>(null);

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(charge.emvPayload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2500);
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      await onSimulatePayment(charge.txid);
      setSimulatedResult('Pagamento liquidado com sucesso! Saldo creditado e conta a receber baixada.');
    } catch (err: unknown) {
      setSimulatedResult(err instanceof Error ? err.message : 'Falha ao simular pagamento.');
    } finally {
      setIsSimulating(false);
    }
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl my-8">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Cobrança Pix Dinâmico</h2>
              <p className="text-xs text-slate-400 font-mono">TXID: {charge.txid}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-6">
          {/* Status e Valor */}
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <div>
              <span className="text-xs text-slate-400">Valor da Cobrança</span>
              <p className="text-2xl font-black text-emerald-400">{formatBRL(charge.amount)}</p>
              <p className="text-xs text-slate-300 mt-0.5">{charge.customerName}</p>
            </div>

            <div className="text-right">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  charge.status === 'CONCLUDED'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                    : charge.status === 'ACTIVE'
                    ? 'bg-blue-950/80 text-blue-300 border border-blue-800'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {charge.status === 'CONCLUDED' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-blue-400" />
                )}
                {charge.status === 'CONCLUDED' ? 'PAGO / LIQUIDADO' : 'AGUARDANDO PAGAMENTO'}
              </span>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">Chave ({charge.keyType}): {charge.key}</p>
            </div>
          </div>

          {/* QR Code SVG */}
          <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-slate-200">
            <div
              className="w-56 h-56 flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: charge.qrCodeSvg }}
            />
            <span className="mt-2 text-[11px] font-semibold text-slate-700">
              Aponte o app do seu banco para pagar instantaneamente
            </span>
          </div>

          {/* Copia e Cola Payload */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Pix Copia e Cola (EMV Payload)</label>
              <button
                onClick={handleCopyPayload}
                className="flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {copiedPayload ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedPayload ? 'Copiado!' : 'Copiar Código'}
              </button>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 font-mono text-[11px] text-slate-300 break-all select-all max-h-20 overflow-y-auto">
              {charge.emvPayload}
            </div>
          </div>

          {/* Alerta de Liquidação ou Botão Simulador */}
          {charge.status === 'CONCLUDED' ? (
            <div className="rounded-lg border border-emerald-800/80 bg-emerald-950/40 p-3.5 text-xs text-emerald-300 space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                <span>Cobrança Liquidada em Tempo Real via Bacen SPI</span>
              </div>
              <p className="font-mono text-[11px] text-emerald-400/90">
                EndToEndId: {charge.endToEndId || 'E' + charge.txid}
              </p>
              {charge.paidAt && (
                <p className="text-[11px] text-slate-400">
                  Data/Hora do Pagamento: {new Date(charge.paidAt).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-indigo-800/60 bg-indigo-950/30 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Play className="h-3.5 w-3.5 text-indigo-400" />
                    Simulador de Webhook SPI / Bacen
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Dispara o evento de liquidação instantânea como se o cliente houvesse pago no internet banking.
                  </p>
                </div>

                <button
                  onClick={handleSimulate}
                  disabled={isSimulating}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shrink-0"
                >
                  {isSimulating ? 'Processando...' : 'Simular Pagamento'}
                </button>
              </div>

              {simulatedResult && (
                <p className="text-xs font-medium text-emerald-400 border-t border-indigo-900/50 pt-2">
                  {simulatedResult}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-950/40 rounded-b-xl">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Chave Pix registrada no DICT e validada pelo BACEN.</span>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
