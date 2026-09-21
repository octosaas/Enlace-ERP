/**
 * Enlace ERP - Tab de Boletos Bancários com Impressão e Emissão (PRD 09)
 */

import React, { useState } from 'react';
import { BankSlip, BankSlipStatus, BusinessPartner, BankAccount } from '../../../shared/types.js';
import {
  Barcode,
  Search,
  Plus,
  Eye,
  Copy,
  Check,
  Ban,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Landmark,
  ShieldCheck,
  Printer,
} from 'lucide-react';

interface BankSlipsTabProps {
  slips: BankSlip[];
  partners: BusinessPartner[];
  bankAccounts: BankAccount[];
  isLoading: boolean;
  onOpenPrintModal: (slip: BankSlip) => void;
  onCreateSlip: (data: {
    bankAccountId?: string;
    payerName: string;
    payerDocument: string;
    payerAddress?: string;
    amount: number;
    dueDate: string;
    instructions?: string[];
    finePercent?: number;
    interestMonthlyPercent?: number;
  }) => Promise<void>;
  onCancelSlip: (id: string, reason: string) => Promise<void>;
  canCreate: boolean;
  canCancel: boolean;
}

export const BankSlipsTab: React.FC<BankSlipsTabProps> = ({
  slips,
  partners,
  bankAccounts,
  isLoading,
  onOpenPrintModal,
  onCreateSlip,
  onCancelSlip,
  canCreate,
  canCancel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cancelModalId, setCancelModalId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    bankAccountId: bankAccounts[0]?.id || '',
    selectedPartnerId: '',
    payerName: '',
    payerDocument: '',
    payerAddress: '',
    amount: '',
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    finePercent: '2.0',
    interestMonthlyPercent: '1.0',
    instructions: 'NÃO RECEBER APÓS 30 DIAS DO VENCIMENTO.\nAPÓS O VENCIMENTO COBRAR MULTA DE 2,0% E JUROS DE 1,0% AO MÊS.',
  });

  const handlePartnerSelect = (partnerId: string) => {
    const partner = partners.find((p) => p.id === partnerId);
    if (partner) {
      const fullAddress = partner.address
        ? `${partner.address.street}, ${partner.address.number || 'S/N'} - ${partner.address.neighborhood}, ${partner.address.city} - ${partner.address.state}`
        : '';
      setFormData((prev) => ({
        ...prev,
        selectedPartnerId: partnerId,
        payerName: partner.name,
        payerDocument: partner.formattedDocument || partner.document,
        payerAddress: fullAddress,
      }));
    } else {
      setFormData((prev) => ({ ...prev, selectedPartnerId: partnerId }));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.payerName || !formData.payerDocument || !formData.amount || !formData.dueDate) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    try {
      const instructionsArray = formData.instructions
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      await onCreateSlip({
        bankAccountId: formData.bankAccountId || undefined,
        payerName: formData.payerName,
        payerDocument: formData.payerDocument,
        payerAddress: formData.payerAddress || undefined,
        amount: parseFloat(formData.amount),
        dueDate: formData.dueDate,
        instructions: instructionsArray,
        finePercent: parseFloat(formData.finePercent) || 2.0,
        interestMonthlyPercent: parseFloat(formData.interestMonthlyPercent) || 1.0,
      });

      setIsModalOpen(false);
      // Reset form
      setFormData({
        bankAccountId: bankAccounts[0]?.id || '',
        selectedPartnerId: '',
        payerName: '',
        payerDocument: '',
        payerAddress: '',
        amount: '',
        dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        finePercent: '2.0',
        interestMonthlyPercent: '1.0',
        instructions: 'NÃO RECEBER APÓS 30 DIAS DO VENCIMENTO.\nAPÓS O VENCIMENTO COBRAR MULTA DE 2,0% E JUROS DE 1,0% AO MÊS.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalId) return;
    setIsSubmitting(true);
    try {
      await onCancelSlip(cancelModalId, cancelReason || 'Cancelamento solicitado pelo operador financeiro');
      setCancelModalId(null);
      setCancelReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyDigitable = (id: string, line: string) => {
    navigator.clipboard.writeText(line);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const filteredSlips = slips.filter((s) => {
    const matchesSearch =
      s.ourNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.payerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.payerDocument.includes(searchTerm);

    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && s.status === statusFilter;
  });

  const getStatusBadge = (status: BankSlipStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            LIQUIDADO
          </span>
        );
      case 'REGISTERED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-blue-950/80 border border-blue-800 px-2 py-0.5 text-[11px] font-semibold text-blue-300">
            <Clock className="h-3 w-3" />
            REGISTRADO
          </span>
        );
      case 'CANCELED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-950/80 border border-rose-800 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
            <Ban className="h-3 w-3" />
            BAIXADO / CANCELADO
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Novo Boleto */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64 sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por Sacado, Nosso Nº ou Doc..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">Todos os Status</option>
              <option value="REGISTERED">Registrados</option>
              <option value="PAID">Liquidados</option>
              <option value="CANCELED">Baixados / Cancelados</option>
            </select>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Emitir Novo Boleto
          </button>
        )}
      </div>

      {/* Tabela de Boletos */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400">
                <th className="py-3 px-4 font-semibold">Nosso Número</th>
                <th className="py-3 px-4 font-semibold">Banco / Agência</th>
                <th className="py-3 px-4 font-semibold">Sacado / Pagador</th>
                <th className="py-3 px-4 font-semibold">Vencimento</th>
                <th className="py-3 px-4 font-semibold text-right">Valor</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Carregando carteira de boletos bancários...
                  </td>
                </tr>
              ) : filteredSlips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhum boleto encontrado com os critérios selecionados.
                  </td>
                </tr>
              ) : (
                filteredSlips.map((slip) => (
                  <tr key={slip.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <Barcode className="h-3.5 w-3.5 text-blue-400" />
                        <span>{slip.ourNumber}</span>
                      </div>
                      <span className="block text-[10px] text-slate-400 font-sans mt-0.5">
                        Doc: {slip.documentNumber}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <div className="font-medium text-white">{slip.bankName}</div>
                      <div className="font-mono text-[10px] text-slate-400">
                        Ag: {slip.agency} • C/C: {slip.account} • Cart: {slip.wallet}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-200">{slip.payerName}</div>
                      <div className="font-mono text-[10px] text-slate-400">Doc: {slip.payerDocument}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <div className="font-mono font-medium">{slip.dueDate}</div>
                      <div className="text-[10px] text-slate-500">Emissão: {slip.issueDate}</div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-emerald-400 font-mono text-sm">
                        {formatBRL(slip.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(slip.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenPrintModal(slip)}
                          title="Visualizar / Imprimir Boleto"
                          className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5 text-blue-400" />
                          <span className="text-[11px]">Ver</span>
                        </button>

                        <button
                          onClick={() => handleCopyDigitable(slip.id, slip.digitableLine)}
                          title="Copiar Linha Digitável"
                          className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-700 hover:text-emerald-400 transition-colors"
                        >
                          {copiedId === slip.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span className="text-[11px]">{copiedId === slip.id ? 'Copiado!' : 'Linha'}</span>
                        </button>

                        {canCancel && slip.status !== 'PAID' && slip.status !== 'CANCELED' && (
                          <button
                            onClick={() => setCancelModalId(slip.id)}
                            title="Baixar / Cancelar Título"
                            className="rounded p-1 text-slate-400 hover:bg-rose-950/60 hover:text-rose-400 border border-transparent hover:border-rose-900 transition-colors"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Emissão de Boleto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400">
                  <Barcode className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Emitir Boleto Bancário</h3>
                  <p className="text-xs text-slate-400">Cálculo instantâneo de linha digitável e código de barras</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {/* Conta Bancária */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Conta Bancária / Banco Conveniado *
                </label>
                <select
                  value={formData.bankAccountId}
                  onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  required
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.bankCode}) • Ag: {b.agency} • C/C: {b.accountNumber}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sacado / Cliente */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Selecionar Cliente Cadastrado (Opcional)
                </label>
                <select
                  value={formData.selectedPartnerId}
                  onChange={(e) => handlePartnerSelect(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- Selecione ou preencha manualmente abaixo --</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.formattedDocument || p.document})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome / Razão Social do Pagador *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.payerName}
                    onChange={(e) => setFormData({ ...formData, payerName: e.target.value })}
                    placeholder="Ex: Petrobras S.A."
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    CPF ou CNPJ do Pagador *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.payerDocument}
                    onChange={(e) => setFormData({ ...formData, payerDocument: e.target.value })}
                    placeholder="33.000.167/0001-01"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Endereço do Pagador
                </label>
                <input
                  type="text"
                  value={formData.payerAddress}
                  onChange={(e) => setFormData({ ...formData, payerAddress: e.target.value })}
                  placeholder="Av. Paulista, 1000 - Bela Vista, São Paulo - SP"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Valores e Vencimento */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Valor Nominal (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="1"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="1500.00"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Multa (%) / Juros ao Mês (%)
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={formData.finePercent}
                      onChange={(e) => setFormData({ ...formData, finePercent: e.target.value })}
                      title="Multa %"
                      placeholder="2%"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={formData.interestMonthlyPercent}
                      onChange={(e) => setFormData({ ...formData, interestMonthlyPercent: e.target.value })}
                      title="Juros ao Mês %"
                      placeholder="1%"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Instruções de Cobrança */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Instruções de Caixa / Protesto
                </label>
                <textarea
                  rows={2}
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Gerando Boleto...' : 'Confirmar e Emitir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Cancelamento de Boleto */}
      {cancelModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <Ban className="h-5 w-5" />
              <h3 className="text-base font-bold text-white">Baixar / Cancelar Boleto</h3>
            </div>

            <p className="text-xs text-slate-300">
              Você está solicitando o cancelamento do boleto bancário. Essa ação será registrada na trilha de auditoria e constará no arquivo de remessa CNAB como instrução de baixa (código 02).
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Motivo do Cancelamento *
              </label>
              <input
                type="text"
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Pagamento recebido por outro meio / Negociação comercial"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalId(null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isSubmitting || !cancelReason}
                className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {isSubmitting ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
