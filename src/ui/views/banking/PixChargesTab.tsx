/**
 * Enlace ERP - Tab de Cobranças Pix Dinâmico e Simulador Bacen SPI (PRD 09)
 */

import React, { useState } from 'react';
import { PixCharge, PixChargeStatus, BusinessPartner, PixKeyType } from '../../../shared/types.js';
import {
  QrCode,
  Search,
  Plus,
  Play,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface PixChargesTabProps {
  charges: PixCharge[];
  partners: BusinessPartner[];
  isLoading: boolean;
  onOpenQrCodeModal: (charge: PixCharge) => void;
  onCreatePix: (data: {
    customerName: string;
    customerDocument: string;
    amount: number;
    description?: string;
    keyType?: PixKeyType;
    key?: string;
  }) => Promise<void>;
  onSimulatePayment: (txid: string) => Promise<void>;
  canCreate: boolean;
  canSimulate: boolean;
}

export const PixChargesTab: React.FC<PixChargesTabProps> = ({
  charges,
  partners,
  isLoading,
  onOpenQrCodeModal,
  onCreatePix,
  onSimulatePayment,
  canCreate,
  canSimulate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedTxid, setCopiedTxid] = useState<string | null>(null);
  const [simulatingTxid, setSimulatingTxid] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    selectedPartnerId: '',
    customerName: '',
    customerDocument: '',
    amount: '',
    description: 'Fatura de Serviços / Fornecimento',
    keyType: 'CNPJ' as PixKeyType,
    key: '',
  });

  const handlePartnerSelect = (partnerId: string) => {
    const partner = partners.find((p) => p.id === partnerId);
    if (partner) {
      setFormData((prev) => ({
        ...prev,
        selectedPartnerId: partnerId,
        customerName: partner.name,
        customerDocument: partner.formattedDocument || partner.document,
      }));
    } else {
      setFormData((prev) => ({ ...prev, selectedPartnerId: partnerId }));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.customerDocument || !formData.amount) {
      alert('Por favor, preencha os campos obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreatePix({
        customerName: formData.customerName,
        customerDocument: formData.customerDocument,
        amount: parseFloat(formData.amount),
        description: formData.description || undefined,
        keyType: formData.keyType,
        key: formData.key || undefined,
      });

      setIsModalOpen(false);
      setFormData({
        selectedPartnerId: '',
        customerName: '',
        customerDocument: '',
        amount: '',
        description: 'Fatura de Serviços / Fornecimento',
        keyType: 'CNPJ',
        key: '',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSimulate = async (txid: string) => {
    setSimulatingTxid(txid);
    try {
      await onSimulatePayment(txid);
    } finally {
      setSimulatingTxid(null);
    }
  };

  const handleCopyTxid = (txid: string) => {
    navigator.clipboard.writeText(txid);
    setCopiedTxid(txid);
    setTimeout(() => setCopiedTxid(null), 2500);
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const filteredCharges = charges.filter((c) => {
    const matchesSearch =
      c.txid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.customerDocument.includes(searchTerm) ||
      (c.endToEndId && c.endToEndId.toLowerCase().includes(searchTerm.toLowerCase()));

    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && c.status === statusFilter;
  });

  return (
    <div className="space-y-4">
      {/* Topo / Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64 sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por Cliente, TXID ou CPF/CNPJ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ACTIVE">Aguardando Pagamento</option>
            <option value="CONCLUDED">Liquidados / Concluídos</option>
          </select>
        </div>

        {canCreate && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Gerar Cobrança Pix Dinâmico
          </button>
        )}
      </div>

      {/* Tabela de Cobranças Pix */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400">
                <th className="py-3 px-4 font-semibold">Identificador (TXID)</th>
                <th className="py-3 px-4 font-semibold">Cliente / Pagador</th>
                <th className="py-3 px-4 font-semibold">Descrição</th>
                <th className="py-3 px-4 font-semibold">Criação / Liquidação</th>
                <th className="py-3 px-4 font-semibold text-right">Valor</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Carregando cobranças Pix do tenant...
                  </td>
                </tr>
              ) : filteredCharges.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhuma cobrança Pix encontrada.
                  </td>
                </tr>
              ) : (
                filteredCharges.map((charge) => (
                  <tr key={charge.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-white">
                      <div className="flex items-center gap-1.5">
                        <QrCode className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{charge.txid}</span>
                        <button
                          onClick={() => handleCopyTxid(charge.txid)}
                          className="text-slate-500 hover:text-white"
                          title="Copiar TXID"
                        >
                          {copiedTxid === charge.txid ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      {charge.endToEndId && (
                        <span className="block text-[10px] text-emerald-400/80 font-mono mt-0.5">
                          E2E: {charge.endToEndId}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-200">{charge.customerName}</div>
                      <div className="font-mono text-[10px] text-slate-400">Doc: {charge.customerDocument}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate">
                      {charge.description || 'Cobrança Comercial'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <div>{new Date(charge.createdAt).toLocaleDateString('pt-BR')}</div>
                      {charge.paidAt ? (
                        <div className="text-[10px] text-emerald-400 font-mono">
                          Pago: {new Date(charge.paidAt).toLocaleTimeString('pt-BR')}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500">Aguardando liquidação</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-emerald-400 font-mono text-sm">
                        {formatBRL(charge.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          charge.status === 'CONCLUDED'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                            : 'bg-blue-950/80 text-blue-300 border border-blue-800'
                        }`}
                      >
                        {charge.status === 'CONCLUDED' ? (
                          <CheckCircle2 className="h-2.5 w-2.5" />
                        ) : (
                          <Clock className="h-2.5 w-2.5" />
                        )}
                        {charge.status === 'CONCLUDED' ? 'LIQUIDADO' : 'ATIVO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenQrCodeModal(charge)}
                          className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          <QrCode className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-[11px]">QR Code</span>
                        </button>

                        {canSimulate && charge.status !== 'CONCLUDED' && (
                          <button
                            onClick={() => handleQuickSimulate(charge.txid)}
                            disabled={simulatingTxid === charge.txid}
                            title="Simular Webhook de Liquidação Instantânea Bacen SPI"
                            className="flex items-center gap-1 rounded bg-indigo-950/60 border border-indigo-800/80 px-2 py-1 text-indigo-300 hover:bg-indigo-900/60 hover:text-white transition-colors"
                          >
                            <Zap className="h-3.5 w-3.5 text-amber-400" />
                            <span className="text-[11px]">
                              {simulatingTxid === charge.txid ? 'Liquidando...' : 'Pagar'}
                            </span>
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

      {/* Modal de Criação de Cobrança Pix */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Gerar Cobrança Pix Dinâmico</h3>
                  <p className="text-xs text-slate-400">Emissão em conformidade com o Manual de Padrões Bacen</p>
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
              {/* Seleção de Parceiro */}
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
                    Nome do Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="Ex: Petrobras Corporate"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    CPF ou CNPJ do Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customerDocument}
                    onChange={(e) => setFormData({ ...formData, customerDocument: e.target.value })}
                    placeholder="33.000.167/0001-01"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Valor e Descrição */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Valor a Cobrar (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.1"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="12500.00"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Descrição da Cobrança
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Mensalidade ou Fatura"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
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
                  {isSubmitting ? 'Gerando Pix...' : 'Gerar QR Code Pix'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
