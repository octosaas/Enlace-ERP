/**
 * Enlace ERP - Módulo de Compras, Suprimentos & Entrada de Mercadorias (PRD 08)
 * Gestão de Requisições de Compra, Cotações / Mapa Comparativo, Pedidos de Compra e Recebimento de NF-e (XML).
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import {
  Truck,
  ShoppingCart,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  TrendingDown,
  Building2,
  AlertTriangle,
  UploadCloud,
  FileSpreadsheet,
  Award,
  Layers,
  ChevronRight,
  Eye,
  Send,
  Boxes,
  Ban,
  Percent,
} from 'lucide-react';
import {
  PurchaseRequisition,
  PurchaseQuotation,
  PurchaseOrder,
  InboundInvoice,
  PurchasesDashboardMetrics,
  BusinessPartner,
  Warehouse,
  Product,
} from '../../shared/types.js';

export const ProcurementView: React.FC = () => {
  const { activeCompany, activeSchema, apiFetch } = useAuth();

  // Abas do Módulo
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'requisitions' | 'quotations' | 'orders' | 'invoices'
  >('dashboard');

  // Estados de Dados
  const [metrics, setMetrics] = useState<PurchasesDashboardMetrics | null>(null);
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
  const [quotations, setQuotations] = useState<PurchaseQuotation[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<InboundInvoice[]>([]);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Estados de UX
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modais
  const [isNewRequisitionModalOpen, setIsNewRequisitionModalOpen] = useState(false);
  const [isNewQuotationModalOpen, setIsNewQuotationModalOpen] = useState(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isXmlImportModalOpen, setIsXmlImportModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<PurchaseQuotation | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InboundInvoice | null>(null);
  const [rejectionModal, setRejectionModal] = useState<{ type: 'requisition' | 'order'; id: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Formulário: Nova Requisição
  const [reqForm, setReqForm] = useState({
    department: 'TI & Infraestrutura',
    priority: 'MEDIA' as 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE',
    neededByDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    justification: '',
    items: [
      { productCode: '', productName: '', quantity: 1, unit: 'UN', estimatedUnitPrice: 0 },
    ],
  });

  // Formulário: Nova Cotação
  const [quotForm, setQuotForm] = useState({
    title: '',
    deadlineDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    requisitionIds: [] as string[],
    items: [
      { productName: '', productCode: '', quantity: 1, unit: 'UN', targetPrice: 0 },
    ],
  });

  // Formulário: Proposta de Fornecedor
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [proposalForm, setProposalForm] = useState({
    supplierId: '',
    supplierName: '',
    supplierDocument: '',
    supplierContact: '',
    deliveryDays: 5,
    freightType: 'CIF' as 'CIF' | 'FOB',
    paymentTerm: '28 DDL',
    notes: '',
    items: [] as {
      itemId: string;
      productName: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      discountPercentage: number;
      icmsPercentage: number;
      ipiPercentage: number;
      freightAmount: number;
      deliveryDays: number;
    }[],
  });

  // Formulário: Importação XML
  const [xmlInput, setXmlInput] = useState('');
  const [selectedWarehouseForXml, setSelectedWarehouseForXml] = useState('');

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Carregar dados principais
  const loadData = async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const [
        metricsRes,
        reqsRes,
        quotsRes,
        ordersRes,
        invoicesRes,
        partnersRes,
        warehousesRes,
        productsRes,
      ] = await Promise.all([
        apiFetch<PurchasesDashboardMetrics>('/api/v1/purchases/metrics'),
        apiFetch<PurchaseRequisition[]>('/api/v1/purchases/requisitions'),
        apiFetch<PurchaseQuotation[]>('/api/v1/purchases/quotations'),
        apiFetch<PurchaseOrder[]>('/api/v1/purchases/orders'),
        apiFetch<InboundInvoice[]>('/api/v1/purchases/inbound-invoices'),
        apiFetch<BusinessPartner[]>('/api/v1/commercial/partners'),
        apiFetch<Warehouse[]>('/api/v1/inventory/warehouses'),
        apiFetch<Product[]>('/api/v1/commercial/products'),
      ]);

      if (metricsRes.success && metricsRes.data) setMetrics(metricsRes.data);
      if (reqsRes.success && reqsRes.data) setRequisitions(reqsRes.data);
      if (quotsRes.success && quotsRes.data) setQuotations(quotsRes.data);
      if (ordersRes.success && ordersRes.data) setOrders(ordersRes.data);
      if (invoicesRes.success && invoicesRes.data) setInvoices(invoicesRes.data);
      if (partnersRes.success && partnersRes.data) setPartners(partnersRes.data);
      if (warehousesRes.success && warehousesRes.data) {
        setWarehouses(warehousesRes.data);
        if (warehousesRes.data.length > 0 && !selectedWarehouseForXml) {
          setSelectedWarehouseForXml(warehousesRes.data[0].id);
        }
      }
      if (productsRes.success && productsRes.data) setProducts(productsRes.data);
    } catch (err: unknown) {
      console.error(err);
      showFeedback('error', 'Falha ao carregar dados do módulo de compras.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCompany]);

  // Ações de Requisição
  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reqForm.items.length === 0 || !reqForm.justification) {
      showFeedback('error', 'Preencha a justificativa e adicione ao menos um item.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch<PurchaseRequisition>('/api/v1/purchases/requisitions', {
        method: 'POST',
        body: JSON.stringify(reqForm),
      });

      if (res.success && res.data) {
        showFeedback('success', `Requisição ${res.data.number} criada com sucesso.`);
        setIsNewRequisitionModalOpen(false);
        loadData();
      }
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : 'Erro ao criar requisição.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveRequisition = async (id: string) => {
    try {
      const res = await apiFetch(`/api/v1/purchases/requisitions/${id}/approve`, { method: 'POST' });
      if (res.success) {
        showFeedback('success', 'Requisição aprovada com sucesso.');
        loadData();
      }
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : 'Erro ao aprovar requisição.');
    }
  };

  const handleRejectRequisition = async () => {
    if (!rejectionModal || !rejectionReason.trim()) return;
    try {
      const res = await apiFetch(`/api/v1/purchases/requisitions/${rejectionModal.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectionReason }),
      });
      if (res.success) {
        showFeedback('success', 'Requisição reprovada.');
        setRejectionModal(null);
        setRejectionReason('');
        loadData();
      }
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : 'Erro ao reprovar requisição.');
    }
  };

  // Ações de Cotação
  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotForm.title || quotForm.items.length === 0) {
      showFeedback('error', 'Informe o título e os itens da cotação.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch<PurchaseQuotation>('/api/v1/purchases/quotations', {
        method: 'POST',
        body: JSON.stringify(quotForm),
      });
      if (res.success && res.data) {
        showFeedback('success', `Cotação ${res.data.number} criada.`);
        setIsNewQuotationModalOpen(false);
        loadData();
      }
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : 'Erro ao criar cotação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAddProposal = (cot: PurchaseQuotation) => {
    setSelectedQuotation(cot);
    setProposalForm({
      supplierId: '',
      supplierName: '',
      supplierDocument: '',
      supplierContact: '',
      deliveryDays: 5,
      freightType: 'CIF',
      paymentTerm: '30 DDL',
      notes: '',
      items: cot.items.map((i) => ({
        itemId: i.id,
        productName: i.productName,
        quantity: i.quantity,
        unit: i.unit,
        unitPrice: i.targetPrice || 100,
        discountPercentage: 0,
        icmsPercentage: 18,
        ipiPercentage: 5,
        freightAmount: 0,
        deliveryDays: 5,
      })),
    });
    setIsProposalModalOpen(true);
  };

  const handleSaveProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuotation || !proposalForm.supplierName) {
      showFeedback('error', 'Selecione ou preencha o fornecedor.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/v1/purchases/quotations/${selectedQuotation.id}/proposals`, {
        method: 'POST',
        body: JSON.stringify(proposalForm),
      });
      if (res.success) {
        showFeedback('success', 'Proposta inserida com sucesso na cotação.');
        setIsProposalModalOpen(false);
        loadData();
      }
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : 'Erro ao incluir proposta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHomologateQuotation = async (quotationId: string, supplierId: string) => {
    try {
      const res = await apiFetch(`/api/v1/purchases/quotations/${quotationId}/homologate`, {
        method: 'POST',
        body: JSON.stringify({ winningSupplierId: supplierId, createPurchaseOrder: true }),
      });
      if (res.success) {
        showFeedback('success', 'Cotação homologada com sucesso! Pedido de compra gerado automaticamente.');
        loadData();
      }
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : 'Erro ao homologar cotação.');
    }
  };

  // Ações de Pedido de Compra
  const handleApproveOrder = async (id: string) => {
    try {
      const res = await apiFetch(`/api/v1/purchases/orders/${id}/approve`, { method: 'POST' });
      if (res.success) {
        showFeedback('success', 'Pedido de Compra aprovado.');
        loadData();
      }
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : 'Erro ao aprovar pedido.');
    }
  };

  const handleIssueOrder = async (id: string) => {
    try {
      const res = await apiFetch(`/api/v1/purchases/orders/${id}/issue`, { method: 'POST' });
      if (res.success) {
        showFeedback('success', 'Pedido de Compra emitido ao fornecedor.');
        loadData();
      }
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : 'Erro ao emitir pedido.');
    }
  };

  const handleRejectOrder = async () => {
    if (!rejectionModal || !rejectionReason.trim()) return;
    try {
      const res = await apiFetch(`/api/v1/purchases/orders/${rejectionModal.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectionReason }),
      });
      if (res.success) {
        showFeedback('success', 'Pedido de compra reprovado.');
        setRejectionModal(null);
        setRejectionReason('');
        loadData();
      }
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : 'Erro ao reprovar pedido.');
    }
  };

  // Ações de Entrada de NF-e (XML)
  const handleImportXml = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!xmlInput.trim()) {
      showFeedback('error', 'Cole o conteúdo XML da NF-e.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch<InboundInvoice>('/api/v1/purchases/inbound-invoices/import-xml', {
        method: 'POST',
        body: JSON.stringify({
          xmlContent: xmlInput,
          warehouseId: selectedWarehouseForXml,
        }),
      });

      if (res.success && res.data) {
        showFeedback('success', `NF-e ${res.data.number} importada com sucesso via XML.`);
        setIsXmlImportModalOpen(false);
        setXmlInput('');
        loadData();
      }
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : 'Erro ao importar XML.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessInvoice = async (id: string) => {
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/v1/purchases/inbound-invoices/${id}/process`, { method: 'POST' });
      if (res.success) {
        showFeedback(
          'success',
          'Nota fiscal processada com sucesso! Estoque e Contas a Pagar devidamente atualizados.'
        );
        loadData();
      }
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : 'Erro ao processar nota fiscal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Módulo */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-cyan-950 border border-cyan-800 px-2 py-0.5 text-xs font-semibold text-cyan-400">
                PRD 08 • SUPRIMENTOS
              </span>
              <span className="text-xs text-slate-400">Compras, Cotações & Entrada de Mercadorias</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Gestão de Compras & Suprimentos
            </h1>
            <p className="text-xs text-slate-400">
              Fluxo integrado de Requisições, Mapa Comparativo de Cotações com Savings, Pedidos de Compra e Recebimento Fiscal via XML.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsXmlImportModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-purple-800 bg-purple-950/60 px-3 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-900/80 transition"
            >
              <UploadCloud className="h-4 w-4" />
              Importar NF-e (XML)
            </button>
            <button
              onClick={() => setIsNewRequisitionModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition"
            >
              <Plus className="h-4 w-4" />
              Nova Requisição
            </button>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              title="Atualizar dados"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mt-4 rounded-lg p-3 text-xs flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                : 'bg-rose-950/80 border border-rose-800 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* Navegação de Abas do Módulo */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-3 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'dashboard'
              ? 'bg-slate-900 border-t-2 border-emerald-500 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Dashboard & KPIs
        </button>
        <button
          onClick={() => setActiveTab('requisitions')}
          className={`flex items-center gap-2 px-3 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'requisitions'
              ? 'bg-slate-900 border-t-2 border-cyan-500 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Requisições de Compra ({requisitions.length})
        </button>
        <button
          onClick={() => setActiveTab('quotations')}
          className={`flex items-center gap-2 px-3 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'quotations'
              ? 'bg-slate-900 border-t-2 border-amber-500 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Cotações & Comparativo ({quotations.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-3 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'orders'
              ? 'bg-slate-900 border-t-2 border-blue-500 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Pedidos de Compra ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-3 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'invoices'
              ? 'bg-slate-900 border-t-2 border-purple-500 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Truck className="h-3.5 w-3.5" />
          Entrada de NF-e & XML ({invoices.length})
        </button>
      </div>

      {/* ABA 1: DASHBOARD & KPIS */}
      {activeTab === 'dashboard' && metrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Gasto em Compras</span>
                <span className="rounded bg-emerald-950 p-1.5 text-emerald-400">
                  <DollarSign className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-white">
                {metrics.totalSpentPeriod.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <span className="text-[11px] text-slate-400">Pedidos faturados e emitidos</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Pedidos Ativos</span>
                <span className="rounded bg-blue-950 p-1.5 text-blue-400">
                  <ShoppingCart className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-white">{metrics.activeOrdersCount}</p>
              <span className="text-[11px] text-slate-400">Em cotação ou aguardando entrega</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Requisições Pendentes</span>
                <span className="rounded bg-amber-950 p-1.5 text-amber-400">
                  <Clock className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-white">{metrics.pendingRequisitionsCount}</p>
              <span className="text-[11px] text-slate-400">Aguardando aprovação de alçada</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Economia Obtida (Savings)</span>
                <span className="rounded bg-purple-950 p-1.5 text-purple-400">
                  <TrendingDown className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-purple-300">
                {metrics.totalQuotationsSavings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <span className="text-[11px] text-purple-400/80">Via cotação comparativa</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Top Fornecedores */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Top Fornecedores por Volume Financeiro</h2>
              {metrics.topSuppliers.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum fornecedor registrado no período.</p>
              ) : (
                <div className="space-y-3">
                  {metrics.topSuppliers.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/40 p-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-300">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-200">{s.supplierName}</p>
                          <span className="text-slate-500">{s.count} pedidos realizados</span>
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-emerald-400">
                        {s.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pedidos Recentes */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Últimos Pedidos de Compra</h2>
              {metrics.recentOrders.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum pedido de compra cadastrado.</p>
              ) : (
                <div className="space-y-3">
                  {metrics.recentOrders.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/40 p-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-200">{o.number}</span>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                            {o.status}
                          </span>
                        </div>
                        <p className="text-slate-400 mt-0.5">{o.supplierName}</p>
                      </div>
                      <span className="font-mono font-semibold text-white">
                        {o.grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: REQUISIÇÕES DE COMPRA */}
      {activeTab === 'requisitions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar requisições por número ou departamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 pl-9 pr-4 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => setIsNewRequisitionModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-500 transition"
            >
              <Plus className="h-4 w-4" />
              Nova Requisição
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Número</th>
                    <th className="px-4 py-3">Solicitante</th>
                    <th className="px-4 py-3">Departamento</th>
                    <th className="px-4 py-3">Prioridade</th>
                    <th className="px-4 py-3">Data Limite</th>
                    <th className="px-4 py-3 text-right">Total Estimado</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {requisitions
                    .filter(
                      (r) =>
                        r.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.department.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 font-mono font-semibold text-white">{r.number}</td>
                        <td className="px-4 py-3">{r.requestedByName}</td>
                        <td className="px-4 py-3 text-slate-400">{r.department}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              r.priority === 'URGENTE'
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : r.priority === 'ALTA'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {r.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">{r.neededByDate}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400">
                          {r.totalEstimated.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                              r.status === 'APROVADA'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : r.status === 'REJEITADA'
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : r.status === 'EM_COTACAO'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {r.status === 'PENDENTE_APROVACAO' && (
                              <>
                                <button
                                  onClick={() => handleApproveRequisition(r.id)}
                                  className="rounded bg-emerald-950 border border-emerald-800 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-900 transition"
                                  title="Aprovar"
                                >
                                  Aprovar
                                </button>
                                <button
                                  onClick={() => setRejectionModal({ type: 'requisition', id: r.id })}
                                  className="rounded bg-rose-950 border border-rose-800 px-2 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-900 transition"
                                  title="Reprovar"
                                >
                                  Reprovar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: COTAÇÕES & COMPARATIVO (MAPA DE COTAÇÃO) */}
      {activeTab === 'quotations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-white">Mapa Comparativo de Cotações</h2>
            <button
              onClick={() => setIsNewQuotationModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-500 transition"
            >
              <Plus className="h-4 w-4" />
              Nova Cotação
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {quotations.map((cot) => (
              <div
                key={cot.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-sm">{cot.number}</span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        {cot.status}
                      </span>
                    </div>
                    <h3 className="text-xs font-semibold text-slate-300 mt-1">{cot.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {cot.status === 'ABERTA' && (
                      <button
                        onClick={() => handleOpenAddProposal(cot)}
                        className="rounded bg-cyan-950 border border-cyan-800 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900 transition"
                      >
                        + Inserir Proposta de Fornecedor
                      </button>
                    )}
                  </div>
                </div>

                {/* Itens Solicitados */}
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Itens da Cotação ({cot.items.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {cot.items.map((it) => (
                      <div
                        key={it.id}
                        className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2 text-xs"
                      >
                        <p className="font-semibold text-slate-200">{it.productName}</p>
                        <div className="flex justify-between text-slate-400 mt-1 text-[11px]">
                          <span>Qtd: {it.quantity} {it.unit}</span>
                          <span>Preço Alvo: {it.targetPrice ? it.targetPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Propostas Comparadas */}
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Propostas Recebidas ({cot.proposals.length})
                  </h4>
                  {cot.proposals.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Nenhuma proposta inserida ainda.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {cot.proposals.map((prop) => (
                        <div
                          key={prop.id}
                          className={`rounded-xl border p-4 space-y-2 relative ${
                            prop.isOverallWinner
                              ? 'border-emerald-500/80 bg-emerald-950/20'
                              : 'border-slate-800 bg-slate-950/60'
                          }`}
                        >
                          {prop.isOverallWinner && (
                            <div className="absolute top-3 right-3 flex items-center gap-1 rounded bg-emerald-950 border border-emerald-800 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                              <Award className="h-3 w-3" />
                              Vencedora
                            </div>
                          )}
                          <p className="font-bold text-white text-xs">{prop.supplierName}</p>
                          <p className="text-[11px] text-slate-400">CNPJ: {prop.supplierDocument}</p>

                          <div className="border-t border-slate-800/80 pt-2 text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Prazo de Entrega:</span>
                              <span className="text-slate-200">{prop.deliveryDays} dias</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Frete:</span>
                              <span className="text-slate-200">{prop.freightType}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Condição:</span>
                              <span className="text-slate-200">{prop.paymentTerm}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-800 pt-1 font-semibold">
                              <span className="text-slate-300">Valor Total:</span>
                              <span className="font-mono text-emerald-400">
                                {prop.grandTotal.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </span>
                            </div>
                          </div>

                          {cot.status === 'ABERTA' && (
                            <button
                              onClick={() => handleHomologateQuotation(cot.id, prop.supplierId)}
                              className="w-full mt-2 rounded bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition flex items-center justify-center gap-1"
                            >
                              <Award className="h-3.5 w-3.5" />
                              Homologar e Gerar Pedido (PC)
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 4: PEDIDOS DE COMPRA (PC) */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-white">Pedidos de Compra Emitidos</h2>
            <button
              onClick={() => setIsNewOrderModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition"
            >
              <Plus className="h-4 w-4" />
              Novo Pedido Direto
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Número</th>
                    <th className="px-4 py-3">Fornecedor</th>
                    <th className="px-4 py-3">Almoxarifado</th>
                    <th className="px-4 py-3">Previsão Entrega</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                    <th className="px-4 py-3 text-right">Impostos & Frete</th>
                    <th className="px-4 py-3 text-right">Total Geral</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-mono font-semibold text-white">{o.number}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-200">{o.supplierName}</div>
                        <span className="text-[11px] text-slate-500">{o.supplierDocument}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{o.warehouseName}</td>
                      <td className="px-4 py-3">{o.expectedDeliveryDate}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {o.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400">
                        {(o.taxesTotal + o.freightTotal).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                        {o.grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                            o.status === 'APROVADO' || o.status === 'RECEBIDO_TOTAL'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : o.status === 'EMITIDO_AO_FORNECEDOR'
                              ? 'bg-blue-950 text-blue-400 border border-blue-800'
                              : o.status === 'RECEBIDO_PARCIAL'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {o.status === 'PENDENTE_APROVACAO' && (
                            <>
                              <button
                                onClick={() => handleApproveOrder(o.id)}
                                className="rounded bg-emerald-950 border border-emerald-800 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-900 transition"
                              >
                                Aprovar
                              </button>
                              <button
                                onClick={() => setRejectionModal({ type: 'order', id: o.id })}
                                className="rounded bg-rose-950 border border-rose-800 px-2 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-900 transition"
                              >
                                Rejeitar
                              </button>
                            </>
                          )}
                          {o.status === 'APROVADO' && (
                            <button
                              onClick={() => handleIssueOrder(o.id)}
                              className="flex items-center gap-1 rounded bg-blue-950 border border-blue-800 px-2 py-1 text-[10px] font-semibold text-blue-300 hover:bg-blue-900 transition"
                            >
                              <Send className="h-3 w-3" />
                              Emitir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 5: ENTRADA DE NF-e & RECEBIMENTO FISCAL (XML) */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Notas Fiscais de Entrada (Inbound NF-e)</h2>
              <p className="text-xs text-slate-400">
                Processamento físico com entrada em estoque e geração de títulos de contas a pagar.
              </p>
            </div>
            <button
              onClick={() => setIsXmlImportModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition"
            >
              <UploadCloud className="h-4 w-4" />
              Importar XML NF-e
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Chave de Acesso / NF-e</th>
                    <th className="px-4 py-3">Fornecedor (Emitente)</th>
                    <th className="px-4 py-3">Emissão / Entrada</th>
                    <th className="px-4 py-3">Destino (Almoxarifado)</th>
                    <th className="px-4 py-3 text-right">Itens</th>
                    <th className="px-4 py-3 text-right">Valor Líquido</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-white">NF-e {inv.number} (Série {inv.series})</div>
                        <span className="font-mono text-[10px] text-slate-500 truncate block max-w-xs" title={inv.accessKey}>
                          {inv.accessKey}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-200">{inv.supplierName}</div>
                        <span className="text-[11px] text-slate-500">{inv.supplierDocument}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>{inv.issueDate}</div>
                        <span className="text-[10px] text-slate-500">Entrada: {inv.entryDate}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{inv.warehouseName}</td>
                      <td className="px-4 py-3 text-right">{inv.items.length} itens</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                        {inv.netTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                            inv.status === 'PROCESSADA'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inv.status === 'IMPORTADA' ? (
                          <button
                            onClick={() => handleProcessInvoice(inv.id)}
                            disabled={isSubmitting}
                            className="rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition"
                          >
                            Dar Entrada (Estoque + Financeiro)
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500">Concluído</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA REQUISIÇÃO */}
      {isNewRequisitionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Nova Requisição de Compra (RC)</h3>
              <button
                onClick={() => setIsNewRequisitionModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequisition} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Departamento</label>
                  <input
                    type="text"
                    required
                    value={reqForm.department}
                    onChange={(e) => setReqForm({ ...reqForm, department: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Prioridade</label>
                  <select
                    value={reqForm.priority}
                    onChange={(e) => setReqForm({ ...reqForm, priority: e.target.value as any })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="MEDIA">Média</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Data Necessária</label>
                <input
                  type="date"
                  required
                  value={reqForm.neededByDate}
                  onChange={(e) => setReqForm({ ...reqForm, neededByDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Justificativa da Aquisição</label>
                <textarea
                  required
                  rows={2}
                  value={reqForm.justification}
                  onChange={(e) => setReqForm({ ...reqForm, justification: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                  placeholder="Explique a necessidade operacional da compra..."
                />
              </div>

              {/* Itens */}
              <div className="border-t border-slate-800 pt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-300">Itens Solicitados</span>
                  <button
                    type="button"
                    onClick={() =>
                      setReqForm({
                        ...reqForm,
                        items: [
                          ...reqForm.items,
                          { productCode: '', productName: '', quantity: 1, unit: 'UN', estimatedUnitPrice: 0 },
                        ],
                      })
                    }
                    className="text-xs text-cyan-400 hover:underline"
                  >
                    + Adicionar Item
                  </button>
                </div>

                <div className="space-y-2">
                  {reqForm.items.map((it, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Nome do produto/material"
                        required
                        value={it.productName}
                        onChange={(e) => {
                          const updated = [...reqForm.items];
                          updated[idx].productName = e.target.value;
                          setReqForm({ ...reqForm, items: updated });
                        }}
                        className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="number"
                        placeholder="Qtd"
                        min="1"
                        required
                        value={it.quantity}
                        onChange={(e) => {
                          const updated = [...reqForm.items];
                          updated[idx].quantity = Number(e.target.value);
                          setReqForm({ ...reqForm, items: updated });
                        }}
                        className="w-20 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="number"
                        placeholder="Preço Est."
                        min="0"
                        step="0.01"
                        value={it.estimatedUnitPrice}
                        onChange={(e) => {
                          const updated = [...reqForm.items];
                          updated[idx].estimatedUnitPrice = Number(e.target.value);
                          setReqForm({ ...reqForm, items: updated });
                        }}
                        className="w-28 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewRequisitionModalOpen(false)}
                  className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-500"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Requisição'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORTAR XML DE NF-e */}
      {isXmlImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Importar XML de NF-e (Entrada Fiscal)</h3>
              </div>
              <button onClick={() => setIsXmlImportModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleImportXml} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Almoxarifado de Entrada
                </label>
                <select
                  value={selectedWarehouseForXml}
                  onChange={(e) => setSelectedWarehouseForXml(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Conteúdo do Arquivo XML da NF-e
                </label>
                <textarea
                  required
                  rows={8}
                  value={xmlInput}
                  onChange={(e) => setXmlInput(e.target.value)}
                  placeholder="Cole o código XML completo da NF-e (<nfeProc> ou <NFe>)..."
                  className="w-full font-mono rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-purple-300 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsXmlImportModalOpen(false)}
                  className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500"
                >
                  {isSubmitting ? 'Processando XML...' : 'Importar NF-e'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REPROVAÇÃO COM MOTIVO */}
      {rejectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Justificativa de Reprovação</h3>
            <textarea
              rows={3}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Descreva o motivo da recusa desta solicitação..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRejectionModal(null);
                  setRejectionReason('');
                }}
                className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={
                  rejectionModal.type === 'requisition'
                    ? handleRejectRequisition
                    : handleRejectOrder
                }
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
              >
                Confirmar Reprovação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
