/**
 * Enlace ERP - Modal de Visualização e Impressão de Boleto Bancário (PRD 09)
 */

import React, { useState } from 'react';
import { BankSlip } from '../../../shared/types.js';
import { X, Copy, Check, Printer, ShieldCheck, Landmark } from 'lucide-react';

interface BoletoPrintModalProps {
  slip: BankSlip;
  onClose: () => void;
}

export const BoletoPrintModal: React.FC<BoletoPrintModalProps> = ({ slip, onClose }) => {
  const [copiedLine, setCopiedLine] = useState(false);
  const [copiedBarcode, setCopiedBarcode] = useState(false);

  const handleCopyLine = () => {
    navigator.clipboard.writeText(slip.digitableLine);
    setCopiedLine(true);
    setTimeout(() => setCopiedLine(false), 2500);
  };

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(slip.barcode);
    setCopiedBarcode(true);
    setTimeout(() => setCopiedBarcode(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl my-8">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Visualização de Boleto Bancário</h2>
              <p className="text-xs text-slate-400 font-mono">
                {slip.bankName} • Nosso Nº: {slip.ourNumber} • Doc: {slip.documentNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo do Boleto (Estilizado para impressão e leitura nítida) */}
        <div className="p-6 space-y-6">
          {/* Caixa de Cópia da Linha Digitável */}
          <div className="rounded-lg border border-emerald-800/80 bg-emerald-950/40 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                  Linha Digitável (Código de Barras para Internet Banking)
                </span>
                <p className="mt-1 font-mono text-sm sm:text-base font-bold text-white tracking-wide break-all">
                  {slip.digitableLine}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopyLine}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors"
                >
                  {copiedLine ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedLine ? 'Copiado!' : 'Copiar'}
                </button>
                <button
                  onClick={handleCopyBarcode}
                  title="Copiar Código de Barras Numérico (44 dígitos)"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs text-slate-300 hover:bg-slate-700"
                >
                  {copiedBarcode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  44 dígitos
                </button>
              </div>
            </div>
          </div>

          {/* Ficha de Compensação (Visual Padrão FEBRABAN) */}
          <div className="rounded-lg border border-slate-600 bg-white text-slate-900 p-5 shadow-sm text-xs select-text">
            {/* Topo do Boleto */}
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-wider uppercase">{slip.bankName}</span>
                <span className="border-x-2 border-black px-3 font-mono font-bold text-base">
                  {slip.bankCode}-7
                </span>
              </div>
              <div className="font-mono font-bold text-xs sm:text-sm tracking-wider">
                {slip.digitableLine}
              </div>
            </div>

            {/* Grid de Informações */}
            <div className="grid grid-cols-12 border border-slate-400">
              {/* Linha 1 */}
              <div className="col-span-9 border-b border-r border-slate-400 p-1.5">
                <span className="block text-[9px] uppercase font-bold text-slate-600">Local de Pagamento</span>
                <span className="font-semibold text-[11px]">PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO</span>
              </div>
              <div className="col-span-3 border-b border-slate-400 p-1.5 bg-slate-50">
                <span className="block text-[9px] uppercase font-bold text-slate-600">Vencimento</span>
                <span className="font-bold text-sm text-slate-900">{slip.dueDate}</span>
              </div>

              {/* Linha 2 */}
              <div className="col-span-9 border-b border-r border-slate-400 p-1.5">
                <span className="block text-[9px] uppercase font-bold text-slate-600">Beneficiário</span>
                <span className="font-semibold text-[11px]">
                  {slip.beneficiaryName} • CNPJ: {slip.beneficiaryDocument}
                </span>
              </div>
              <div className="col-span-3 border-b border-slate-400 p-1.5 bg-slate-50">
                <span className="block text-[9px] uppercase font-bold text-slate-600">Agência / Código Beneficiário</span>
                <span className="font-mono font-semibold text-[11px]">
                  {slip.agency} / {slip.account}
                </span>
              </div>

              {/* Linha 3 */}
              <div className="col-span-3 border-b border-r border-slate-400 p-1.5">
                <span className="block text-[9px] uppercase font-bold text-slate-600">Data do Documento</span>
                <span>{slip.issueDate}</span>
              </div>
              <div className="col-span-3 border-b border-r border-slate-400 p-1.5">
                <span className="block text-[9px] uppercase font-bold text-slate-600">Número do Documento</span>
                <span className="font-mono font-semibold">{slip.documentNumber}</span>
              </div>
              <div className="col-span-1 border-b border-r border-slate-400 p-1.5">
                <span className="block text-[9px] uppercase font-bold text-slate-600">Espécie</span>
                <span>DM</span>
              </div>
              <div className="col-span-1 border-b border-r border-slate-400 p-1.5">
                <span className="block text-[9px] uppercase font-bold text-slate-600">Aceite</span>
                <span>N</span>
              </div>
              <div className="col-span-1 border-b border-r border-slate-400 p-1.5">
                <span className="block text-[9px] uppercase font-bold text-slate-600">Carteira</span>
                <span className="font-mono">{slip.wallet}</span>
              </div>
              <div className="col-span-3 border-b border-slate-400 p-1.5 bg-slate-50">
                <span className="block text-[9px] uppercase font-bold text-slate-600">Nosso Número</span>
                <span className="font-mono font-bold text-slate-900">{slip.ourNumber}</span>
              </div>

              {/* Linha 4 (Instruções e Valor) */}
              <div className="col-span-9 border-r border-slate-400 p-2 space-y-1 min-h-[100px]">
                <span className="block text-[9px] uppercase font-bold text-slate-600">
                  Instruções (Todas informações deste bloqueto são de exclusiva responsabilidade do beneficiário)
                </span>
                <div className="text-[10px] space-y-0.5 text-slate-800">
                  {slip.instructions && slip.instructions.length > 0 ? (
                    slip.instructions.map((inst, idx) => <p key={idx}>• {inst}</p>)
                  ) : (
                    <>
                      <p>• NÃO RECEBER APÓS 30 DIAS DO VENCIMENTO.</p>
                      <p>• APÓS O VENCIMENTO COBRAR MULTA DE {slip.finePercent.toFixed(1)}% E JUROS DE {slip.interestMonthlyPercent.toFixed(1)}% AO MÊS.</p>
                    </>
                  )}
                </div>
              </div>
              <div className="col-span-3 divide-y divide-slate-400 bg-slate-50">
                <div className="p-1.5">
                  <span className="block text-[9px] uppercase font-bold text-slate-600">(=) Valor do Documento</span>
                  <span className="font-bold text-sm text-slate-900">{formatBRL(slip.amount)}</span>
                </div>
                <div className="p-1.5">
                  <span className="block text-[9px] uppercase font-bold text-slate-600">(-) Desconto / Abatimento</span>
                  <span className="text-slate-500 font-mono">0,00</span>
                </div>
                <div className="p-1.5">
                  <span className="block text-[9px] uppercase font-bold text-slate-600">(+) Mora / Multa</span>
                  <span className="text-slate-500 font-mono">0,00</span>
                </div>
                <div className="p-1.5">
                  <span className="block text-[9px] uppercase font-bold text-slate-600">(=) Valor Cobrado</span>
                  <span className="font-bold text-sm text-slate-900">{formatBRL(slip.amount)}</span>
                </div>
              </div>

              {/* Linha 5 (Pagador / Sacado) */}
              <div className="col-span-12 border-t border-slate-400 p-2 bg-slate-50/70">
                <span className="block text-[9px] uppercase font-bold text-slate-600">Pagador (Sacado)</span>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] font-semibold text-slate-900 mt-0.5">
                  <span>{slip.payerName}</span>
                  <span className="font-mono text-slate-700">CPF/CNPJ: {slip.payerDocument}</span>
                </div>
                <p className="text-[10px] text-slate-600 mt-0.5">{slip.payerAddress}</p>
              </div>
            </div>

            {/* Código de Barras Visual Intercalado 2 de 5 */}
            <div className="mt-4 pt-3 border-t border-dashed border-slate-300 flex flex-col items-center">
              <div className="h-12 w-full max-w-lg bg-repeat-x flex items-center justify-between px-2 bg-slate-100 rounded border border-slate-300">
                {/* Barras visuais */}
                {Array.from({ length: 55 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 bg-black"
                    style={{
                      width: (i * 7) % 5 === 0 ? '3px' : (i * 3) % 4 === 0 ? '2px' : '1px',
                      opacity: (i * 11) % 7 === 0 ? 0 : 1,
                    }}
                  />
                ))}
              </div>
              <span className="mt-1 font-mono text-[10px] text-slate-500 tracking-wider">
                {slip.barcode}
              </span>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-950/40 rounded-b-xl">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Registro online com conciliação automática homologada.</span>
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
