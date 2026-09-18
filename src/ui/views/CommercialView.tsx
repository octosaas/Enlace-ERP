/**
 * Enlace ERP - Módulo Comercial e Operacional (PRD 04)
 * Gestão de Catálogo, Orçamentos, Vendas, Contratos e Ordens de Serviço
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import {
  TrendingUp,
  ShoppingCart,
  FileText,
  Package,
  Briefcase,
  Wrench,
  Plus,
  CheckCircle,
  XCircle,
  ArrowRight,
  DollarSign,
  Clock,
  RefreshCw,
  AlertCircle,
  Search,
  Calendar,
  User,
  FileCheck,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Building2,
  Filter,
} from 'lucide-react';
import {
  Product,
  Quote,
  Sale,
  Contract,
  ServiceOrder,
  ServiceOrderPriority,
  CommercialDashboardMetrics,
  BusinessPartner,
} from '../../shared/types.js';

export const CommercialView: React.FC = () => {
  const { activeCompany, activeSchema, apiFetch } = useAuth();

  // Sub-aba ativa
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'products' | 'quotes' | 'sales' | 'contracts' | 'serviceOrders'
  >('dashboard');

  // Dados das coleções
  const [metrics, setMetrics] = useState<CommercialDashboardMetrics | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);

  // Estados de controle e UX
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Modais
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isOsModalOpen, setIsOsModalOpen] = useState(false);
  const [selectedOsForDetails, setSelectedOsForDetails] = useState<ServiceOrder | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Formulário: Novo Produto
  const [newProduct, setNewProduct] = useState({
    code: '',
    name: '',
    type: 'PRODUCT' as 'PRODUCT' | 'SERVICE',
    description: '',
    unit: 'UN',
    unitPrice: 0,
    costPrice: 0,
  });

  // Formulário: Novo Orçamento
  const [newQuote, setNewQuote] = useState({
    customerId: '',
    description: '',
    validUntil: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    discount: 0,
    surcharge: 0,
    notes: '',
    items: [
      {
        productId: '',
        code: '',
        name: '',
        type: 'PRODUCT' as 'PRODUCT' | 'SERVICE',
        unit: 'UN',
        quantity: 1,
        unitPrice: 0,
        discountPercent: 0,
        discount: 0,
        surcharge: 0,
        total: 0,
      },
    ],
  });

  // Formulário: Nova Venda Direta
  const [newSale, setNewSale] = useState({
    customerId: '',
    saleDate: new Date().toISOString().split('T')[0],
    discount: 0,
    surcharge: 0,
    notes: '',
    items: [
      {
        productId: '',
        code: '',
        name: '',
        type: 'PRODUCT' as 'PRODUCT' | 'SERVICE',
        unit: 'UN',
        quantity: 1,
        unitPrice: 0,
        discountPercent: 0,
        discount: 0,
        surcharge: 0,
        total: 0,
      },
    ],
  });

  // Formulário: Novo Contrato
  const [newContract, setNewContract] = useState({
    customerId: '',
    title: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    renewalType: 'AUTOMATIC' as 'AUTOMATIC' | 'MANUAL',
    billingFrequency: 'MENSAL' as 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL',
    value: 0,
    notes: '',
  });

  // Formulário: Nova OS
  const [newOs, setNewOs] = useState<{
    customerId: string;
    title: string;
    description: string;
    priority: ServiceOrderPriority;
    scheduledStart: string;
    scheduledEnd: string;
    assignedUserName: string;
    notes: string;
  }>({
    customerId: '',
    title: '',
    description: '',
    priority: 'NORMAL',
    scheduledStart: new Date().toISOString().split('T')[0],
    scheduledEnd: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    assignedUserName: 'Equipe Técnica',
    notes: '',
  });

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Carregar todos os dados do módulo comercial para a empresa ativa
  const loadCommercialData = async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      // 1. Dashboard Metrics
      const mRes = await apiFetch<CommercialDashboardMetrics>('/api/v1/commercial/dashboard');
      if (mRes.success && mRes.data) setMetrics(mRes.data);

      // 2. Products
      const pRes = await apiFetch<Product[]>('/api/v1/commercial/products');
      if (pRes.success && pRes.data) setProducts(pRes.data);

      // 3. Quotes
      const qRes = await apiFetch<Quote[]>('/api/v1/commercial/quotes');
      if (qRes.success && qRes.data) setQuotes(qRes.data);

      // 4. Sales
      const sRes = await apiFetch<Sale[]>('/api/v1/commercial/sales');
      if (sRes.success && sRes.data) setSales(sRes.data);

      // 5. Contracts
      const cRes = await apiFetch<Contract[]>('/api/v1/commercial/contracts');
      if (cRes.success && cRes.data) setContracts(cRes.data);

      // 6. Service Orders
      const osRes = await apiFetch<ServiceOrder[]>('/api/v1/operational/service-orders');
      if (osRes.success && osRes.data) setServiceOrders(osRes.data);

      // 7. Partners (para relacionar clientes)
      const partRes = await apiFetch<BusinessPartner[]>('/api/v1/companies/active/partners');
      if (partRes.success && partRes.data) setPartners(partRes.data);
    } catch (err: unknown) {
      console.error(err);
      showFeedback(err instanceof Error ? err.message : 'Erro ao carregar dados comerciais', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCommercialData();
  }, [activeCompany]);

  // Ações de Orçamento
  const handleApproveQuote = async (quoteId: string) => {
    try {
      const res = await apiFetch<Quote>(`/api/v1/commercial/quotes/${quoteId}/approve`, {
        method: 'POST',
      });
      if (res.success) {
        showFeedback(`Orçamento ${res.data?.number} aprovado com sucesso!`);
        loadCommercialData();
      }
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Falha ao aprovar orçamento', 'error');
    }
  };

  const handleRejectQuote = async (quoteId: string) => {
    try {
      const res = await apiFetch<Quote>(`/api/v1/commercial/quotes/${quoteId}/reject`, {
        method: 'POST',
      });
      if (res.success) {
        showFeedback(`Orçamento ${res.data?.number} rejeitado.`);
        loadCommercialData();
      }
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Falha ao rejeitar orçamento', 'error');
    }
  };

  const handleConvertToSale = async (quoteId: string) => {
    try {
      const res = await apiFetch<Sale>(`/api/v1/commercial/quotes/${quoteId}/convert-to-sale`, {
        method: 'POST',
      });
      if (res.success) {
        const isIdempotent = (res.meta as { alreadyConverted?: boolean })?.alreadyConverted;
        showFeedback(
          isIdempotent
            ? `Idempotência: Este orçamento já possui o pedido ${res.data?.number} gerado.`
            : `Orçamento convertido em Venda ${res.data?.number} com sucesso!`
        );
        loadCommercialData();
      }
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Falha na conversão para venda', 'error');
    }
  };

  // Ações de Venda
  const handleConfirmSale = async (saleId: string) => {
    try {
      const res = await apiFetch<Sale>(`/api/v1/commercial/sales/${saleId}/confirm`, {
        method: 'POST',
      });
      if (res.success) {
        showFeedback(`Venda ${res.data?.number} confirmada com sucesso!`);
        loadCommercialData();
      }
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Falha ao confirmar venda', 'error');
    }
  };

  const handleCancelSale = async (saleId: string) => {
    try {
      const res = await apiFetch<Sale>(`/api/v1/commercial/sales/${saleId}/cancel`, {
        method: 'POST',
      });
      if (res.success) {
        showFeedback(`Venda ${res.data?.number} cancelada.`);
        loadCommercialData();
      }
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Falha ao cancelar venda', 'error');
    }
  };

  // Ações de OS
  const handleUpdateOsStatus = async (osId: string, newStatus: string) => {
    try {
      const res = await apiFetch<ServiceOrder>(`/api/v1/operational/service-orders/${osId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.success) {
        showFeedback(`Status da OS atualizado para ${newStatus}.`);
        loadCommercialData();
        if (selectedOsForDetails && selectedOsForDetails.id === osId) {
          setSelectedOsForDetails(res.data || null);
        }
      }
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Falha ao atualizar status da OS', 'error');
    }
  };

  const handleAddComment = async (osId: string) => {
    if (!newCommentText.trim()) return;
    try {
      const res = await apiFetch(`/api/v1/operational/service-orders/${osId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: newCommentText }),
      });
      if (res.success) {
        setNewCommentText('');
        showFeedback('Comentário técnico registrado na OS.');
        // Recarrega a OS selecionada
        const osRes = await apiFetch<ServiceOrder>(`/api/v1/operational/service-orders/${osId}`);
        if (osRes.success && osRes.data) {
          setSelectedOsForDetails(osRes.data);
        }
        loadCommercialData();
      }
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Falha ao adicionar comentário', 'error');
    }
  };

  // Submissão: Novo Produto
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<Product>('/api/v1/commercial/products', {
        method: 'POST',
        body: JSON.stringify(newProduct),
      });
      if (res.success) {
        showFeedback(`Item ${res.data?.name} cadastrado no catálogo com sucesso!`);
        setIsProductModalOpen(false);
        setNewProduct({
          code: '',
          name: '',
          type: 'PRODUCT',
          description: '',
          unit: 'UN',
          unitPrice: 0,
          costPrice: 0,
        });
        loadCommercialData();
      }
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Falha ao criar item', 'error');
    }
  };

  // Submissão: Novo Orçamento
  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuote.customerId) {
      showFeedback('Selecione um cliente para o orçamento.', 'error');
      return;
    }
    try {
      const res = await apiFetch<Quote>('/api/v1/commercial/quotes', {
        method: 'POST',
        body: JSON.stringify(newQuote),
      });
      if (res.success) {
        showFeedback(`Orçamento ${res.data?.number} emitido com sucesso!`);
        setIsQuoteModalOpen(false);
        loadCommercialData();
      }
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Falha ao emitir orçamento', 'error');
    }
  };

  // Submissão: Nova Venda
  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSale.customerId) {
      showFeedback('Selecione um cliente para a venda.', 'error');
      return;
    }
    try {
      const res = await apiFetch<Sale>('/api/v1/commercial/sales', {
        method: 'POST',
        body: JSON.stringify(newSale),
      });
      if (res.success) {
        showFeedback(`Venda ${res.data?.number} registrada com sucesso!`);
        setIsSaleModalOpen(false);
        loadCommercialData();
      }
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Falha ao registrar venda', 'error');
    }
  };

  // Submissão: Novo Contrato
  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContract.customerId || !newContract.title || !newContract.value) {
      showFeedback('Preencha os campos obrigatórios do contrato.', 'error');
      return;
    }
    try {
      const res = await apiFetch<Contract>('/api/v1/commercial/contracts', {
        method: 'POST',
        body: JSON.stringify(newContract),
      });
      if (res.success) {
        showFeedback(`Contrato ${res.data?.number} cadastrado com sucesso!`);
        setIsContractModalOpen(false);
        loadCommercialData();
      }
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Falha ao criar contrato', 'error');
    }
  };

  // Submissão: Nova OS
  const handleCreateOs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOs.customerId || !newOs.title) {
      showFeedback('Cliente e Título são obrigatórios para abertura de OS.', 'error');
      return;
    }
    try {
      const res = await apiFetch<ServiceOrder>('/api/v1/operational/service-orders', {
        method: 'POST',
        body: JSON.stringify(newOs),
      });
      if (res.success) {
        showFeedback(`Ordem de Serviço ${res.data?.number} aberta com sucesso!`);
        setIsOsModalOpen(false);
        loadCommercialData();
      }
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Falha ao criar ordem de serviço', 'error');
    }
  };

  // Formatação monetária BRL
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho Principal do Módulo */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                PRD 04 • GESTÃO COMERCIAL E OPERACIONAL
              </span>
              <span className="text-xs text-slate-400">Namespace: {activeSchema}</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Operações Comerciais, Contratos e Ordens de Serviço
            </h1>
            <p className="text-xs text-slate-400">
              Fluxo integrado: Catálogo → Orçamentos → Pedidos de Venda → Contratos Recorrentes → Ordens de Serviço (OS).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadCommercialData}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Notificações / Feedback */}
        {feedbackMessage && (
          <div
            className={`mt-4 rounded-lg p-3 text-xs flex items-center gap-2 border ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}
      </div>

      {/* Navegação de Sub-Abas do Módulo Comercial */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'dashboard'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Dashboard Comercial
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'products'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="h-4 w-4" />
          Produtos & Serviços ({products.length})
        </button>

        <button
          onClick={() => setActiveTab('quotes')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'quotes'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          Orçamentos ({quotes.length})
        </button>

        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'sales'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          Pedidos de Venda ({sales.length})
        </button>

        <button
          onClick={() => setActiveTab('contracts')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'contracts'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          Contratos ({contracts.length})
        </button>

        <button
          onClick={() => setActiveTab('serviceOrders')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'serviceOrders'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wrench className="h-4 w-4" />
          Ordens de Serviço ({serviceOrders.length})
        </button>
      </div>

      {/* ============================================================== */}
      {/* ABA 1: DASHBOARD COMERCIAL (PRD 04 - Seção 8, 30 e 52)         */}
      {/* ============================================================== */}
      {activeTab === 'dashboard' && metrics && (
        <div className="space-y-6">
          {/* Métricas Executivas Principais */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Vendas Confirmadas</span>
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {formatBRL(metrics.confirmedSalesValue)}
              </div>
              <p className="text-[11px] text-slate-400">
                Total efetivado: {metrics.confirmedSalesCount} pedidos confirmados
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Orçamentos em Aberto</span>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {formatBRL(metrics.openQuotesValue)}
              </div>
              <p className="text-[11px] text-slate-400">
                {metrics.openQuotesCount} propostas em negociação / aguardando
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Taxa de Conversão</span>
                <TrendingUp className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-cyan-300">
                {metrics.openQuotesCount + metrics.approvedQuotesCount > 0
                  ? ((metrics.approvedQuotesCount / (metrics.openQuotesCount + metrics.approvedQuotesCount)) * 100).toFixed(1)
                  : '0.0'}%
              </div>
              <p className="text-[11px] text-slate-400">
                {metrics.approvedQuotesCount} aprovados de {metrics.openQuotesCount + metrics.approvedQuotesCount} propostas
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Ticket Médio</span>
                <ShoppingCart className="h-4 w-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {formatBRL(metrics.confirmedSalesCount > 0 ? metrics.confirmedSalesValue / metrics.confirmedSalesCount : 0)}
              </div>
              <p className="text-[11px] text-slate-400">Média por pedido de venda confirmado</p>
            </div>
          </div>

          {/* Segunda linha de cards operacionais */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Contratos Recorrentes */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200">Receita Recorrente (MRR)</span>
                </div>
                <span className="rounded bg-emerald-950 border border-emerald-800 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                  {metrics.activeContractsCount} ATIVOS
                </span>
              </div>
              <div className="text-xl font-bold text-emerald-300">
                {formatBRL(metrics.activeContractsValue)}
              </div>
              <p className="text-xs text-slate-400">
                Faturamento mensal recorrente contratado com renovação garantida.
              </p>
            </div>

            {/* Painel Operacional de Ordens de Serviço */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3 sm:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-semibold text-slate-200">Status Operacional das Ordens de Serviço</span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Total: {(metrics.serviceOrdersByStatus?.open || 0) + (metrics.serviceOrdersByStatus?.inProgress || 0) + (metrics.serviceOrdersByStatus?.completed || 0)} OS
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                  <div className="text-xs text-slate-400">Abertas / Agendadas</div>
                  <div className="text-lg font-bold text-amber-400">
                    {metrics.serviceOrdersByStatus?.open || 0}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                  <div className="text-xs text-slate-400">Em Andamento</div>
                  <div className="text-lg font-bold text-cyan-400">
                    {metrics.serviceOrdersByStatus?.inProgress || 0}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                  <div className="text-xs text-slate-400">Concluídas</div>
                  <div className="text-lg font-bold text-emerald-400">
                    {metrics.serviceOrdersByStatus?.completed || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 2: PRODUTOS E SERVIÇOS (PRD 04 - Seção 11 e 33)           */}
      {/* ============================================================== */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar código ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              onClick={() => setIsProductModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors w-full sm:w-auto justify-center"
            >
              <Plus className="h-4 w-4" />
              Cadastrar Produto / Serviço
            </button>
          </div>

          {/* Tabela de Produtos */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Código</th>
                  <th className="px-4 py-3 font-semibold">Nome / Descrição</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Unidade</th>
                  <th className="px-4 py-3 font-semibold text-right">Preço de Custo</th>
                  <th className="px-4 py-3 font-semibold text-right">Preço Unitário</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {products
                  .filter(
                    (p) =>
                      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.code.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-emerald-400 font-medium">{p.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-200">{p.name}</div>
                        <div className="text-[11px] text-slate-500">{p.description}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            p.type === 'SERVICE'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : 'bg-blue-950 text-blue-300 border border-blue-800'
                          }`}
                        >
                          {p.type === 'SERVICE' ? 'SERVIÇO' : 'PRODUTO'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{p.unit}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400">
                        {p.costPrice ? formatBRL(p.costPrice) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-100">
                        {formatBRL(p.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="rounded bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Nenhum item cadastrado no catálogo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 3: ORÇAMENTOS (QUOTES) (PRD 04 - Seção 14 e 39)           */}
      {/* ============================================================== */}
      {activeTab === 'quotes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              Total de orçamentos emitidos no schema: <strong>{quotes.length}</strong>
            </div>

            <button
              onClick={() => setIsQuoteModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors w-full sm:w-auto justify-center"
            >
              <Plus className="h-4 w-4" />
              Novo Orçamento Comercial
            </button>
          </div>

          {/* Listagem de Orçamentos */}
          <div className="space-y-3">
            {quotes.map((q) => (
              <div
                key={q.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-all hover:border-slate-700"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-400">{q.number}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-xs font-semibold text-slate-200">{q.customerName}</span>
                      <span className="text-slate-600">•</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          q.status === 'APPROVED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : q.status === 'REJECTED'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : q.status === 'SENT'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {q.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400">{q.description}</p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span>Emissão: {q.issueDate}</span>
                      <span>•</span>
                      <span>Validade: {q.validUntil}</span>
                      <span>•</span>
                      <span>Itens: {q.items.length}</span>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end gap-2">
                    <div className="text-base font-bold text-white font-mono">{formatBRL(q.total)}</div>

                    {/* Botões de Ação do Ciclo Comercial */}
                    <div className="flex flex-wrap items-center gap-2">
                      {q.status !== 'APPROVED' && q.status !== 'REJECTED' && (
                        <>
                          <button
                            onClick={() => handleApproveQuote(q.id)}
                            className="flex items-center gap-1 rounded bg-emerald-950 border border-emerald-800 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-900 transition-colors"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Aprovar
                          </button>
                          <button
                            onClick={() => handleRejectQuote(q.id)}
                            className="flex items-center gap-1 rounded bg-rose-950 border border-rose-800 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-900 transition-colors"
                          >
                            <XCircle className="h-3 w-3" />
                            Rejeitar
                          </button>
                        </>
                      )}

                      {q.status === 'APPROVED' && (
                        <button
                          onClick={() => handleConvertToSale(q.id)}
                          className="flex items-center gap-1 rounded bg-cyan-600 px-2.5 py-1 text-[11px] font-semibold text-slate-950 hover:bg-cyan-500 transition-colors"
                          title="Transforma este orçamento em pedido de venda efetivo com numeração sequencial"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                          Converter em Venda
                        </button>
                      )}

                      <button
                        onClick={() => setExpandedRow(expandedRow === q.id ? null : q.id)}
                        className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                      >
                        {expandedRow === q.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Itens
                      </button>
                    </div>
                  </div>
                </div>

                {/* Linha expandida com itens */}
                {expandedRow === q.id && (
                  <div className="mt-3 border-t border-slate-800 pt-3 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-400">Itens da Proposta:</div>
                    <div className="divide-y divide-slate-800/40 text-xs">
                      {q.items.map((it, idx) => (
                        <div key={idx} className="py-1 flex items-center justify-between text-slate-300">
                          <div>
                            <span>{it.description}</span>
                            <span className="text-slate-500 ml-2">
                              ({it.quantity} UN x {formatBRL(it.unitPrice)})
                            </span>
                          </div>
                          <div className="font-mono font-medium">{formatBRL(it.total)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {quotes.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-500 text-xs">
                Nenhum orçamento emitido até o momento.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 4: VENDAS (SALES) (PRD 04 - Seção 18 e 40)                 */}
      {/* ============================================================== */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              Pedidos de Venda registrados: <strong>{sales.length}</strong>
            </div>

            <button
              onClick={() => setIsSaleModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors w-full sm:w-auto justify-center"
            >
              <Plus className="h-4 w-4" />
              Nova Venda Avulsa
            </button>
          </div>

          {/* Listagem de Pedidos de Venda */}
          <div className="space-y-3">
            {sales.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-all hover:border-slate-700"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-400">{s.number}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-xs font-semibold text-slate-200">{s.customerName}</span>
                      <span className="text-slate-600">•</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          s.status === 'CONFIRMED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : s.status === 'CANCELED'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {s.status}
                      </span>
                      <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.2 text-[10px] text-slate-400">
                        {s.sourceType === 'QUOTE' ? 'ORIGEM: ORÇAMENTO' : 'DIRETA / MANUAL'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span>Data da Venda: {s.saleDate}</span>
                      <span>•</span>
                      <span>Itens Faturados: {s.items.length}</span>
                      {s.notes && (
                        <>
                          <span>•</span>
                          <span>Obs: {s.notes}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end gap-2">
                    <div className="text-base font-bold text-white font-mono">{formatBRL(s.total)}</div>

                    <div className="flex items-center gap-2">
                      {s.status === 'DRAFT' && (
                        <>
                          <button
                            onClick={() => handleConfirmSale(s.id)}
                            className="flex items-center gap-1 rounded bg-emerald-950 border border-emerald-800 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-900 transition-colors"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Confirmar Faturamento
                          </button>
                          <button
                            onClick={() => handleCancelSale(s.id)}
                            className="flex items-center gap-1 rounded bg-rose-950 border border-rose-800 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-900 transition-colors"
                          >
                            <XCircle className="h-3 w-3" />
                            Cancelar
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setExpandedRow(expandedRow === s.id ? null : s.id)}
                        className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                      >
                        {expandedRow === s.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Detalhes
                      </button>
                    </div>
                  </div>
                </div>

                {/* Itens do Pedido */}
                {expandedRow === s.id && (
                  <div className="mt-3 border-t border-slate-800 pt-3 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-400">Itens Faturados no Pedido:</div>
                    <div className="divide-y divide-slate-800/40 text-xs">
                      {s.items.map((it, idx) => (
                        <div key={idx} className="py-1 flex items-center justify-between text-slate-300">
                          <div>
                            <span>{it.description}</span>
                            <span className="text-slate-500 ml-2">
                              ({it.quantity} UN x {formatBRL(it.unitPrice)})
                            </span>
                          </div>
                          <div className="font-mono font-medium">{formatBRL(it.total)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {sales.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-500 text-xs">
                Nenhum pedido de venda registrado no momento.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 5: CONTRATOS (CONTRACTS) (PRD 04 - Seção 22 e 42)          */}
      {/* ============================================================== */}
      {activeTab === 'contracts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              Contratos recorrentes sob gestão: <strong>{contracts.length}</strong>
            </div>

            <button
              onClick={() => setIsContractModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors w-full sm:w-auto justify-center"
            >
              <Plus className="h-4 w-4" />
              Novo Contrato Recorrente
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {contracts.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3 transition-all hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-purple-400">{c.number}</span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm text-slate-200 mt-1">{c.title}</h3>
                    <p className="text-xs text-slate-400">{c.customerName}</p>
                  </div>

                  <div className="text-right font-mono text-sm font-bold text-emerald-400">
                    {formatBRL(c.value)} / {c.billingFrequency.toLowerCase()}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/60 p-2.5 text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Vigência:</span>
                    <span className="text-slate-200 font-mono">
                      {c.startDate} até {c.endDate || 'Indeterminado'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Renovação:</span>
                    <span className="text-slate-200">
                      {c.renewalType === 'AUTOMATIC' ? 'Automática' : 'Manual'}
                    </span>
                  </div>
                </div>

                {c.description && <p className="text-xs text-slate-500">{c.description}</p>}
              </div>
            ))}

            {contracts.length === 0 && (
              <div className="sm:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-500 text-xs">
                Nenhum contrato recorrente cadastrado.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 6: ORDENS DE SERVIÇO (OS) (PRD 04 - Seção 26, 44 e 50)    */}
      {/* ============================================================== */}
      {activeTab === 'serviceOrders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              Ordens de serviço operacionais: <strong>{serviceOrders.length}</strong>
            </div>

            <button
              onClick={() => setIsOsModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors w-full sm:w-auto justify-center"
            >
              <Plus className="h-4 w-4" />
              Abrir Ordem de Serviço (OS)
            </button>
          </div>

          <div className="space-y-3">
            {serviceOrders.map((os) => (
              <div
                key={os.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-all hover:border-slate-700"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-400">{os.number}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-xs font-semibold text-slate-200">{os.title}</span>
                      <span className="text-slate-600">•</span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                          os.priority === 'URGENT'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : os.priority === 'HIGH'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {os.priority}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400">{os.customerName}</p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span>Responsável: {os.assignedUserName || 'Não atribuído'}</span>
                      <span>•</span>
                      <span>
                        Agendamento: {os.scheduledStart} a {os.scheduledEnd}
                      </span>
                      <span>•</span>
                      <span>Eventos de Auditoria: {os.events?.length || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Seletor de Status da OS */}
                    <select
                      value={os.status}
                      onChange={(e) => handleUpdateOsStatus(os.id, e.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="OPEN">ABERTA</option>
                      <option value="SCHEDULED">AGENDADA</option>
                      <option value="IN_PROGRESS">EM ANDAMENTO</option>
                      <option value="WAITING_PARTS">AGUARDANDO PEÇAS</option>
                      <option value="COMPLETED">CONCLUÍDA</option>
                      <option value="CANCELED">CANCELADA</option>
                    </select>

                    <button
                      onClick={() => setSelectedOsForDetails(os)}
                      className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Trilha & Apontamentos ({os.comments?.length || 0})
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {serviceOrders.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-500 text-xs">
                Nenhuma ordem de serviço aberta no momento.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: CADASTRAR PRODUTO / SERVIÇO                           */}
      {/* ============================================================== */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">Cadastrar Item no Catálogo</h2>
            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Código do Item</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: SERV-CONS-01 ou PROD-VALV-02"
                  value={newProduct.code}
                  onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome do Item</label>
                <input
                  type="text"
                  required
                  placeholder="Nome comercial do produto ou serviço"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tipo</label>
                  <select
                    value={newProduct.type}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, type: e.target.value as 'PRODUCT' | 'SERVICE' })
                    }
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="PRODUCT">PRODUTO</option>
                    <option value="SERVICE">SERVIÇO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Unidade</label>
                  <input
                    type="text"
                    required
                    placeholder="UN, HORA, MÊS"
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value.toUpperCase() })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Preço de Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.costPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, costPrice: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Preço de Venda (R$)*</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProduct.unitPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, unitPrice: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Descrição Detalhada</label>
                <textarea
                  rows={2}
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500"
                >
                  Salvar no Catálogo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: EMITIR NOVO ORÇAMENTO                                 */}
      {/* ============================================================== */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-white">Novo Orçamento Comercial</h2>
            <form onSubmit={handleCreateQuote} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cliente / Parceiro de Negócio *</label>
                <select
                  required
                  value={newQuote.customerId}
                  onChange={(e) => setNewQuote({ ...newQuote, customerId: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                >
                  <option value="">Selecione o cliente cadastrado...</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.formattedDocument || p.document})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Descrição da Proposta *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Fornecimento de Licenças e Suporte Técnico"
                  value={newQuote.description}
                  onChange={(e) => setNewQuote({ ...newQuote, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Validade da Proposta</label>
                  <input
                    type="date"
                    required
                    value={newQuote.validUntil}
                    onChange={(e) => setNewQuote({ ...newQuote, validUntil: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Desconto Global (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newQuote.discount}
                    onChange={(e) => setNewQuote({ ...newQuote, discount: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  />
                </div>
              </div>

              {/* Seção de Itens */}
              <div className="border-t border-slate-800 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Itens do Orçamento</span>
                  <button
                    type="button"
                    onClick={() =>
                      setNewQuote({
                        ...newQuote,
                        items: [
                          ...newQuote.items,
                          {
                            productId: '',
                            code: '',
                            name: '',
                            type: 'PRODUCT',
                            unit: 'UN',
                            quantity: 1,
                            unitPrice: 0,
                            discountPercent: 0,
                            discount: 0,
                            surcharge: 0,
                            total: 0,
                          },
                        ],
                      })
                    }
                    className="text-[11px] text-emerald-400 hover:text-emerald-300"
                  >
                    + Adicionar Item
                  </button>
                </div>

                {newQuote.items.map((it, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 space-y-2">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-6">
                        <label className="block text-[10px] text-slate-500 mb-0.5">Item do Catálogo</label>
                        <select
                          value={it.productId}
                          onChange={(e) => {
                            const p = products.find((prod) => prod.id === e.target.value);
                            const updated = [...newQuote.items];
                            if (p) {
                              updated[idx] = {
                                ...updated[idx],
                                productId: p.id,
                                code: p.code,
                                name: p.name,
                                type: p.type,
                                unit: p.unit,
                                unitPrice: p.unitPrice,
                                total: p.unitPrice * updated[idx].quantity,
                              };
                            }
                            setNewQuote({ ...newQuote, items: updated });
                          }}
                          className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                        >
                          <option value="">Selecione...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} - {p.name} ({formatBRL(p.unitPrice)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="block text-[10px] text-slate-500 mb-0.5">Qtd</label>
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => {
                            const updated = [...newQuote.items];
                            const q = Number(e.target.value);
                            updated[idx].quantity = q;
                            updated[idx].total = q * updated[idx].unitPrice;
                            setNewQuote({ ...newQuote, items: updated });
                          }}
                          className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200 font-mono"
                        />
                      </div>

                      <div className="col-span-3">
                        <label className="block text-[10px] text-slate-500 mb-0.5">Unitário (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={it.unitPrice}
                          onChange={(e) => {
                            const updated = [...newQuote.items];
                            const u = Number(e.target.value);
                            updated[idx].unitPrice = u;
                            updated[idx].total = u * updated[idx].quantity;
                            setNewQuote({ ...newQuote, items: updated });
                          }}
                          className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500"
                >
                  Salvar e Emitir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: NOVA VENDA DIRETA                                     */}
      {/* ============================================================== */}
      {isSaleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-white">Novo Pedido de Venda Avulsa</h2>
            <form onSubmit={handleCreateSale} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cliente *</label>
                <select
                  required
                  value={newSale.customerId}
                  onChange={(e) => setNewSale({ ...newSale, customerId: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                >
                  <option value="">Selecione o cliente...</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Data da Venda</label>
                  <input
                    type="date"
                    required
                    value={newSale.saleDate}
                    onChange={(e) => setNewSale({ ...newSale, saleDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Desconto Global (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSale.discount}
                    onChange={(e) => setNewSale({ ...newSale, discount: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  />
                </div>
              </div>

              {/* Itens */}
              <div className="border-t border-slate-800 pt-3 space-y-2">
                <span className="text-xs font-semibold text-slate-300">Itens do Pedido</span>
                {newSale.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <div className="col-span-6">
                      <select
                        value={it.productId}
                        onChange={(e) => {
                          const p = products.find((prod) => prod.id === e.target.value);
                          const updated = [...newSale.items];
                          if (p) {
                            updated[idx] = {
                              ...updated[idx],
                              productId: p.id,
                              code: p.code,
                              name: p.name,
                              type: p.type,
                              unit: p.unit,
                              unitPrice: p.unitPrice,
                              total: p.unitPrice * updated[idx].quantity,
                            };
                          }
                          setNewSale({ ...newSale, items: updated });
                        }}
                        className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                      >
                        <option value="">Selecione item...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => {
                          const updated = [...newSale.items];
                          const q = Number(e.target.value);
                          updated[idx].quantity = q;
                          updated[idx].total = q * updated[idx].unitPrice;
                          setNewSale({ ...newSale, items: updated });
                        }}
                        className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200 font-mono"
                      />
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        value={it.unitPrice}
                        onChange={(e) => {
                          const updated = [...newSale.items];
                          const u = Number(e.target.value);
                          updated[idx].unitPrice = u;
                          updated[idx].total = u * updated[idx].quantity;
                          setNewSale({ ...newSale, items: updated });
                        }}
                        className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSaleModalOpen(false)}
                  className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500"
                >
                  Confirmar Venda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: NOVO CONTRATO                                         */}
      {/* ============================================================== */}
      {isContractModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">Cadastrar Contrato Recorrente</h2>
            <form onSubmit={handleCreateContract} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cliente *</label>
                <select
                  required
                  value={newContract.customerId}
                  onChange={(e) => setNewContract({ ...newContract, customerId: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                >
                  <option value="">Selecione o cliente...</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Título do Contrato *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: SLA 24/7 Suporte de Engenharia"
                  value={newContract.title}
                  onChange={(e) => setNewContract({ ...newContract, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Valor do Ciclo (R$)*</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newContract.value}
                    onChange={(e) => setNewContract({ ...newContract, value: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Frequência</label>
                  <select
                    value={newContract.billingFrequency}
                    onChange={(e) =>
                      setNewContract({
                        ...newContract,
                        billingFrequency: e.target.value as 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL',
                      })
                    }
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="MENSAL">MENSAL</option>
                    <option value="TRIMESTRAL">TRIMESTRAL</option>
                    <option value="SEMESTRAL">SEMESTRAL</option>
                    <option value="ANUAL">ANUAL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Data Início</label>
                  <input
                    type="date"
                    required
                    value={newContract.startDate}
                    onChange={(e) => setNewContract({ ...newContract, startDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Data Fim</label>
                  <input
                    type="date"
                    value={newContract.endDate}
                    onChange={(e) => setNewContract({ ...newContract, endDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsContractModalOpen(false)}
                  className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500"
                >
                  Salvar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: ABRIR ORDEM DE SERVIÇO (OS)                          */}
      {/* ============================================================== */}
      {isOsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">Abrir Ordem de Serviço</h2>
            <form onSubmit={handleCreateOs} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cliente *</label>
                <select
                  required
                  value={newOs.customerId}
                  onChange={(e) => setNewOs({ ...newOs, customerId: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                >
                  <option value="">Selecione o cliente...</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Título do Serviço *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Calibração de Sensores de Pressão"
                  value={newOs.title}
                  onChange={(e) => setNewOs({ ...newOs, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Prioridade</label>
                  <select
                    value={newOs.priority}
                    onChange={(e) =>
                      setNewOs({ ...newOs, priority: e.target.value as ServiceOrderPriority })
                    }
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="LOW">BAIXA</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">ALTA</option>
                    <option value="URGENT">URGENTE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Técnico Responsável</label>
                  <input
                    type="text"
                    value={newOs.assignedUserName}
                    onChange={(e) => setNewOs({ ...newOs, assignedUserName: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Início Agendado</label>
                  <input
                    type="date"
                    value={newOs.scheduledStart}
                    onChange={(e) => setNewOs({ ...newOs, scheduledStart: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Término Previsto</label>
                  <input
                    type="date"
                    value={newOs.scheduledEnd}
                    onChange={(e) => setNewOs({ ...newOs, scheduledEnd: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOsModalOpen(false)}
                  className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500"
                >
                  Abrir Ordem de Serviço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 6: TRILHA DE AUDITORIA & APONTAMENTOS DA OS              */}
      {/* ============================================================== */}
      {selectedOsForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-amber-400">
                  {selectedOsForDetails.number}
                </span>
                <h2 className="text-base font-bold text-white">{selectedOsForDetails.title}</h2>
              </div>
              <button
                onClick={() => setSelectedOsForDetails(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Trilha de Eventos (Event Sourcing / Auditoria) */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">
                Histórico de Ciclo de Vida da OS:
              </span>
              <div className="space-y-2 rounded-lg bg-slate-950 p-3 max-h-40 overflow-y-auto">
                {selectedOsForDetails.events?.map((ev) => (
                  <div key={ev.id} className="text-[11px] border-b border-slate-900 pb-1.5 last:border-0">
                    <div className="flex justify-between text-slate-500">
                      <span className="font-semibold text-slate-300">{ev.eventType}</span>
                      <span>{new Date(ev.createdAt).toLocaleTimeString('pt-BR')}</span>
                    </div>
                    <div className="text-slate-400">{ev.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comentários / Apontamentos de Campo */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">
                Apontamentos Técnicos & Comentários:
              </span>
              <div className="space-y-2 rounded-lg bg-slate-950 p-3 max-h-40 overflow-y-auto">
                {selectedOsForDetails.comments?.map((c) => (
                  <div key={c.id} className="text-[11px] border-b border-slate-900 pb-1.5 last:border-0">
                    <div className="flex justify-between text-slate-400">
                      <strong className="text-emerald-400">{c.userName}</strong>
                      <span className="text-[10px] text-slate-500">
                        {new Date(c.createdAt).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-slate-200 mt-0.5">{c.content}</div>
                  </div>
                ))}
                {(!selectedOsForDetails.comments || selectedOsForDetails.comments.length === 0) && (
                  <div className="text-slate-500 text-[11px]">Nenhum comentário registrado.</div>
                )}
              </div>

              {/* Inserção de novo comentário */}
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Escrever apontamento técnico..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200"
                />
                <button
                  onClick={() => handleAddComment(selectedOsForDetails.id)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500"
                >
                  Postar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
