/**
 * Enlace ERP - Tab de Arquivos CNAB 240 / 400 (Remessa e Retorno) (PRD 09)
 */

import React, { useState } from 'react';
import { CnabFile, BankAccount } from '../../../shared/types.js';
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Building2,
  RefreshCw,
  Eye,
  ShieldCheck,
  ChevronRight,
  Send,
} from 'lucide-react';

interface CnabFilesTabProps {
  files: CnabFile[];
  bankAccounts: BankAccount[];
  isLoading: boolean;
  onGenerateRemessa: (data: {
    bankAccountId: string;
    cnabType: 'CNAB240' | 'CNAB400';
    slipIds?: string[];
  }) => Promise<void>;
  onProcessRetorno: (data: {
    bankAccountId: string;
    fileName: string;
    fileContent: string;
  }) => Promise<{ processedSlips: number; totalAmountSettled: number }>;
  canGenerate: boolean;
  canProcess: boolean;
}

export const CnabFilesTab: React.FC<CnabFilesTabProps> = ({
  files,
  bankAccounts,
  isLoading,
  onGenerateRemessa,
  onProcessRetorno,
  canGenerate,
  canProcess,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'REMESSA' | 'RETORNO'>('ALL');
  const [isRemessaModalOpen, setIsRemessaModalOpen] = useState(false);
  const [isRetornoModalOpen, setIsRetornoModalOpen] = useState(false);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<CnabFile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Remessa Form
  const [remessaBankAccountId, setRemessaBankAccountId] = useState(bankAccounts[0]?.id || '');
  const [remessaCnabType, setRemessaCnabType] = useState<'CNAB240' | 'CNAB400'>('CNAB240');

  // Retorno Form
  const [retornoBankAccountId, setRetornoBankAccountId] = useState(bankAccounts[0]?.id || '');
  const [retornoFileName, setRetornoFileName] = useState('RETORNO_BB_20260921.RET');
  const [retornoContent, setRetornoContent] = useState('');
  const [retornoFeedback, setRetornoFeedback] = useState<string | null>(null);

  const handleGenerateRemessaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remessaBankAccountId) {
      alert('Selecione uma conta bancária conveniada.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onGenerateRemessa({
        bankAccountId: remessaBankAccountId,
        cnabType: remessaCnabType,
      });
      setIsRemessaModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadSampleRetorno = () => {
    const selectedBank = bankAccounts.find((b) => b.id === retornoBankAccountId) || bankAccounts[0];
    const sample = `01RETORNO01COBRANCA       ${selectedBank ? selectedBank.agency.padStart(4, '0') : '1234'}0000${selectedBank ? selectedBank.accountNumber.padStart(8, '0') : '00012345'}${selectedBank?.name.padEnd(15, ' ')}210926
102${selectedBank ? selectedBank.agency.padStart(4, '0') : '1234'}0000${selectedBank ? selectedBank.accountNumber.padStart(8, '0') : '00012345'}     1234567890106210926DOC-001             25092600000000150000${selectedBank?.bankCode || '001'}123401000000000000000000000000000000000000000000150000
102${selectedBank ? selectedBank.agency.padStart(4, '0') : '1234'}0000${selectedBank ? selectedBank.accountNumber.padStart(8, '0') : '00012345'}     9876543210106210926DOC-002             28092600000000320050${selectedBank?.bankCode || '001'}123401000000000000000000000000000000000000000000320050
9201${selectedBank?.bankCode || '001'}                                                                                                                                           00000200000000470050`;
    setRetornoContent(sample);
  };

  const handleProcessRetornoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retornoContent.trim()) {
      alert('Insira o conteúdo do arquivo de retorno bancário.');
      return;
    }

    setIsSubmitting(true);
    setRetornoFeedback(null);
    try {
      const res = await onProcessRetorno({
        bankAccountId: retornoBankAccountId,
        fileName: retornoFileName,
        fileContent: retornoContent,
      });
      setRetornoFeedback(
        `Retorno processado com sucesso! ${res.processedSlips} título(s) liquidado(s), totalizando ${res.totalAmountSettled.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} baixados no ERP.`
      );
      setTimeout(() => {
        setIsRetornoModalOpen(false);
        setRetornoFeedback(null);
        setRetornoContent('');
      }, 2500);
    } catch (err: unknown) {
      setRetornoFeedback(err instanceof Error ? err.message : 'Erro ao processar retorno.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadFile = (file: CnabFile) => {
    const blob = new Blob([file.contentRaw || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const filteredFiles = files.filter((f) => {
    const matchesSearch =
      f.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.sequenceNumber.toString().includes(searchTerm.toLowerCase());

    if (typeFilter === 'ALL') return matchesSearch;
    return matchesSearch && f.type === typeFilter;
  });

  return (
    <div className="space-y-4">
      {/* Topo / Filtros e Ações */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64 sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por nome de arquivo, lote ou banco..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'REMESSA' | 'RETORNO')}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">Remessas e Retornos</option>
            <option value="REMESSA">Somente Remessas</option>
            <option value="RETORNO">Somente Retornos</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {canGenerate && (
            <button
              onClick={() => setIsRemessaModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Gerar Remessa CNAB
            </button>
          )}
          {canProcess && (
            <button
              onClick={() => setIsRetornoModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <UploadCloud className="h-4 w-4 text-cyan-400" />
              Processar Retorno (.RET)
            </button>
          )}
        </div>
      </div>

      {/* Lista de Arquivos CNAB */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400">
                <th className="py-3 px-4 font-semibold">Nome do Arquivo / Lote</th>
                <th className="py-3 px-4 font-semibold">Tipo / Padrão</th>
                <th className="py-3 px-4 font-semibold">Banco Conveniado</th>
                <th className="py-3 px-4 font-semibold text-center">Registros</th>
                <th className="py-3 px-4 font-semibold text-right">Valor Total</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Carregando histórico de remessas e retornos bancários...
                  </td>
                </tr>
              ) : filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhum arquivo CNAB registrado no período.
                  </td>
                </tr>
              ) : (
                filteredFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-white">
                      <div className="flex items-center gap-2">
                        <FileText
                          className={`h-4 w-4 ${file.type === 'REMESSA' ? 'text-indigo-400' : 'text-cyan-400'}`}
                        />
                        <span>{file.filename}</span>
                      </div>
                      <span className="block text-[10px] text-slate-400 font-sans mt-0.5">
                        Lote / Seq: {file.sequenceNumber} • {new Date(file.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                          file.type === 'REMESSA'
                            ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800'
                            : 'bg-cyan-950/80 text-cyan-300 border border-cyan-800'
                        }`}
                      >
                        {file.type} • {file.standard}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <div className="font-medium text-white">{file.bankName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Cód: {file.bankCode}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-slate-200">
                      {file.totalRecords} títulos
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                      {formatBRL(file.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          file.status === 'PROCESSED' || file.status === 'TRANSMITTED'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                        }`}
                      >
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        {file.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedFileForPreview(file)}
                          title="Inspecionar Conteúdo Posicional"
                          className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5 text-blue-400" />
                          <span className="text-[11px]">Ver</span>
                        </button>
                        <button
                          onClick={() => handleDownloadFile(file)}
                          title="Baixar Arquivo TXT CNAB"
                          className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-700 hover:text-emerald-400 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span className="text-[11px]">Download</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Geração de Remessa CNAB */}
      {isRemessaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-950 border border-indigo-800 text-indigo-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Gerar Arquivo de Remessa CNAB</h3>
                  <p className="text-xs text-slate-400">Transmissão em lote para registro bancário</p>
                </div>
              </div>
              <button
                onClick={() => setIsRemessaModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateRemessaSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Conta Bancária Conveniada *
                </label>
                <select
                  value={remessaBankAccountId}
                  onChange={(e) => setRemessaBankAccountId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  required
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.bankCode}) • Ag: {b.agency} • C/C: {b.accountNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Padrão Febraban *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      remessaCnabType === 'CNAB240'
                        ? 'border-indigo-500 bg-indigo-950/40 text-white'
                        : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cnabType"
                      value="CNAB240"
                      checked={remessaCnabType === 'CNAB240'}
                      onChange={() => setRemessaCnabType('CNAB240')}
                      className="sr-only"
                    />
                    <div>
                      <span className="block font-bold text-xs">CNAB 240</span>
                      <span className="text-[10px] text-slate-400">Header Lote + Segmentos P/Q/R</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      remessaCnabType === 'CNAB400'
                        ? 'border-indigo-500 bg-indigo-950/40 text-white'
                        : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cnabType"
                      value="CNAB400"
                      checked={remessaCnabType === 'CNAB400'}
                      onChange={() => setRemessaCnabType('CNAB400')}
                      className="sr-only"
                    />
                    <div>
                      <span className="block font-bold text-xs">CNAB 400</span>
                      <span className="text-[10px] text-slate-400">Padrão Clássico 400 colunas</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Seleção Automática de Títulos</span>
                </div>
                <p>
                  O gerador incluirá automaticamente todos os boletos emitidos para este convênio que estejam com status REGISTRADO e sem remessa anterior vinculada.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsRemessaModalOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Gerando Lote...' : 'Compilar e Gerar Remessa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Processamento de Retorno CNAB */}
      {isRetornoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Processar Arquivo de Retorno (.RET)</h3>
                  <p className="text-xs text-slate-400">Conciliação bancária automática e baixa de títulos</p>
                </div>
              </div>
              <button
                onClick={() => setIsRetornoModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessRetornoSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Conta Bancária de Destino *
                  </label>
                  <select
                    value={retornoBankAccountId}
                    onChange={(e) => setRetornoBankAccountId(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                    required
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.bankCode}) • Ag: {b.agency}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome do Arquivo
                  </label>
                  <input
                    type="text"
                    required
                    value={retornoFileName}
                    onChange={(e) => setRetornoFileName(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Conteúdo TXT do Retorno (Posicional Febraban) *
                  </label>
                  <button
                    type="button"
                    onClick={handleLoadSampleRetorno}
                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Carregar Exemplo de Retorno Válido
                  </button>
                </div>
                <textarea
                  rows={8}
                  required
                  value={retornoContent}
                  onChange={(e) => setRetornoContent(e.target.value)}
                  placeholder="Cole aqui as linhas do arquivo .RET baixado do Internet Banking (Header, Detalhes e Trailer)..."
                  className="w-full font-mono text-[11px] rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-slate-200 focus:border-cyan-500 focus:outline-none leading-relaxed"
                />
              </div>

              {retornoFeedback && (
                <div className="rounded-lg border border-cyan-800/80 bg-cyan-950/40 p-3 text-xs text-cyan-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-400" />
                  <span>{retornoFeedback}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsRetornoModalOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !retornoContent.trim()}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-500 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Processando Baixas...' : 'Conciliar e Baixar Títulos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Pré-visualização de Arquivo Posicional */}
      {selectedFileForPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Visualização de Arquivo Febraban</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedFileForPreview.filename} • {selectedFileForPreview.standard} • {selectedFileForPreview.totalRecords} registros
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFileForPreview(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-slate-300 leading-relaxed max-h-96 overflow-y-auto">
                <pre>{selectedFileForPreview.contentRaw || 'Arquivo binário ou conteúdo não gravado.'}</pre>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Layout de colunas de largura fixa rigorosamente validado conforme Febraban.</span>
                <button
                  onClick={() => handleDownloadFile(selectedFileForPreview)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-slate-950 hover:bg-emerald-500"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download do Arquivo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
