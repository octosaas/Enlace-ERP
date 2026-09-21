/**
 * Enlace ERP - Módulo de Gestão de Estoque & Almoxarifado (WMS Básico) - PRD 06
 * Controle físico-financeiro, Custo Médio Ponderado (CMP), Kardex rastreável e Multi-Almoxarifado.
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import {
  Boxes,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Plus,
  Building2,
  MapPin,
  TrendingDown,
  TrendingUp,
  History,
  FileText,
  Sliders,
  DollarSign,
  Barcode,
  Layers,
  Sparkles,
  Download,
  Trash2,
  Edit2,
  X,
  Calendar,
  Warehouse as WarehouseIcon,
  ShieldAlert,
  Info,
} from 'lucide-react';
import {
  Warehouse,
  StockItem,
  StockMovement,
  StockMovementType,
  InventoryMetrics,
  Product,
} from '../../shared/types.js';

export const InventoryView: React.FC = () => {
  const { activeCompany, activeSchema, apiFetch } = useAuth();

  // Abas de navegação interna do módulo
  const [activeTab, setActiveTab] = useState<
    'balances' | 'kardex' | 'movement' | 'transfers' | 'warehouses' | 'abc'
  >('balances');

  // Estados de Dados
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Estados de Controle e UX
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filtros
  const [warehouseFilter, setWarehouseFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [lowStockFilter, setLowStockFilter] = useState<boolean>(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('');

  // Modais
  const [isNewWarehouseModalOpen, setIsNewWarehouseModalOpen] = useState<boolean>(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [editingLimitsItem, setEditingLimitsItem] = useState<StockItem | null>(null);
  const [selectedKardexMovement, setSelectedKardexMovement] = useState<StockMovement | null>(null);

  // Formulário: Novo / Editar Almoxarifado
  const [warehouseForm, setWarehouseForm] = useState({
    name: '',
    code: '',
    description: '',
    location: '',
    isDefault: false,
  });

  // Formulário: Atualizar Limites de Estoque
  const [limitsForm, setLimitsForm] = useState({
    minQuantity: 0,
    maxQuantity: 0,
    locationRack: '',
  });

  // Formulário: Registro de Movimentação Instantânea
  const [movementForm, setMovementForm] = useState({
    movementType: 'INBOUND_PURCHASE' as StockMovementType,
    warehouseId: '',
    productId: '',
    quantity: 1,
    unitCost: 0,
    referenceType: 'MANUAL',
    referenceDocument: '',
    batchNumber: '',
    expirationDate: '',
    notes: '',
    locationRack: '',
  });

  // Formulário: Transferência entre Almoxarifados
  const [transferForm, setTransferForm] = useState({
    sourceWarehouseId: '',
    targetWarehouseId: '',
    productId: '',
    quantity: 1,
    notes: '',
  });

  // Carregar todos os dados do módulo
  const loadData = async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const [metricsRes, whRes, stockRes, movRes, prodRes] = await Promise.all([
        apiFetch<InventoryMetrics>('/api/v1/inventory/metrics'),
        apiFetch<Warehouse[]>('/api/v1/inventory/warehouses'),
        apiFetch<StockItem[]>('/api/v1/inventory/stock-items'),
        apiFetch<StockMovement[]>('/api/v1/inventory/movements?limit=100'),
        apiFetch<Product[]>('/api/v1/commercial/products'),
      ]);

      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
      }
      if (whRes.success && whRes.data) {
        const whList = whRes.data;
        setWarehouses(whList);
        if (!movementForm.warehouseId && whList.length > 0) {
          const defaultWh = whList.find((w) => w.isDefault) || whList[0];
          setMovementForm((prev) => ({ ...prev, warehouseId: defaultWh.id }));
          setTransferForm((prev) => ({
            ...prev,
            sourceWarehouseId: defaultWh.id,
            targetWarehouseId: whList.length > 1 ? whList[1].id : '',
          }));
        }
      }
      if (stockRes.success && stockRes.data) {
        setStockItems(stockRes.data);
      }
      if (movRes.success && movRes.data) {
        setMovements(movRes.data);
      }
      if (prodRes.success && prodRes.data) {
        // Apenas produtos físicos podem compor o estoque
        const physicalProducts = prodRes.data.filter((p) => p.type === 'PRODUCT');
        setProducts(physicalProducts);
        if (!movementForm.productId && physicalProducts.length > 0) {
          setMovementForm((prev) => ({
            ...prev,
            productId: physicalProducts[0].id,
            unitCost: physicalProducts[0].costPrice || 0,
          }));
          setTransferForm((prev) => ({ ...prev, productId: physicalProducts[0].id }));
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao carregar dados do estoque.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCompany]);

  // Limpar feedback após 6 segundos
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Formatação de Moeda BRL
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  // Formatação de Números Decimais / Unidades
  const formatNumber = (val: number, decimals: number = 0) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(val || 0);
  };

  // Formatação de Data / Hora
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return isoString;
    }
  };

  // 1. Ações de Almoxarifado
  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseForm.name.trim()) {
      setFeedback({ type: 'error', message: 'O nome do almoxarifado é obrigatório.' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingWarehouse) {
        const res = await apiFetch<Warehouse>(`/api/v1/inventory/warehouses/${editingWarehouse.id}`, {
          method: 'PUT',
          body: JSON.stringify(warehouseForm),
        });
        if (res.success) {
          setFeedback({ type: 'success', message: 'Almoxarifado atualizado com sucesso!' });
          setIsNewWarehouseModalOpen(false);
          setEditingWarehouse(null);
          await loadData();
        } else {
          setFeedback({ type: 'error', message: res.error?.message || 'Falha ao atualizar almoxarifado.' });
        }
      } else {
        const res = await apiFetch<Warehouse>('/api/v1/inventory/warehouses', {
          method: 'POST',
          body: JSON.stringify(warehouseForm),
        });
        if (res.success) {
          setFeedback({ type: 'success', message: 'Novo almoxarifado cadastrado com sucesso!' });
          setIsNewWarehouseModalOpen(false);
          setWarehouseForm({ name: '', code: '', description: '', location: '', isDefault: false });
          await loadData();
        } else {
          setFeedback({ type: 'error', message: res.error?.message || 'Falha ao cadastrar almoxarifado.' });
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro de comunicação.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWarehouse = async (warehouse: Warehouse) => {
    if (warehouse.isDefault) {
      setFeedback({ type: 'error', message: 'Não é permitido excluir o almoxarifado padrão da empresa.' });
      return;
    }
    if (!window.confirm(`Confirma a exclusão do almoxarifado "${warehouse.name}" (${warehouse.code})?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/v1/inventory/warehouses/${warehouse.id}`, {
        method: 'DELETE',
      });
      if (res.success) {
        setFeedback({ type: 'success', message: 'Almoxarifado removido com sucesso.' });
        await loadData();
      } else {
        setFeedback({
          type: 'error',
          message: res.error?.message || 'Não foi possível excluir o almoxarifado. Verifique se há estoque saldo ativo.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao excluir almoxarifado.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Ação de Atualização de Limites (Mín / Máx / Gôndola)
  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLimitsItem) return;

    setIsSubmitting(true);
    try {
      const res = await apiFetch<StockItem>(`/api/v1/inventory/stock-items/${editingLimitsItem.id}/limits`, {
        method: 'PUT',
        body: JSON.stringify({
          minQuantity: Number(limitsForm.minQuantity),
          maxQuantity: Number(limitsForm.maxQuantity),
          locationRack: limitsForm.locationRack.trim() || undefined,
        }),
      });

      if (res.success) {
        setFeedback({ type: 'success', message: 'Parâmetros de estoque atualizados com sucesso.' });
        setEditingLimitsItem(null);
        await loadData();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Falha ao salvar limites.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao atualizar limites.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Ação de Registro de Movimentação
  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementForm.warehouseId || !movementForm.productId) {
      setFeedback({ type: 'error', message: 'Selecione o almoxarifado e o produto para a movimentação.' });
      return;
    }
    if (movementForm.quantity <= 0) {
      setFeedback({ type: 'error', message: 'A quantidade deve ser superior a zero.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch<StockMovement>('/api/v1/inventory/movements', {
        method: 'POST',
        body: JSON.stringify({
          ...movementForm,
          quantity: Number(movementForm.quantity),
          unitCost: movementForm.unitCost ? Number(movementForm.unitCost) : undefined,
        }),
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Movimentação ${res.data?.movementNumber} registrada com recálculo automático de CMP!`,
        });
        // Reset form mantendo almoxarifado
        setMovementForm((prev) => ({
          ...prev,
          quantity: 1,
          referenceDocument: '',
          batchNumber: '',
          notes: '',
        }));
        await loadData();
        setActiveTab('kardex');
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Falha ao registrar movimentação.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao processar movimentação.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Ação de Transferência entre Almoxarifados
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferForm.sourceWarehouseId === transferForm.targetWarehouseId) {
      setFeedback({ type: 'error', message: 'O almoxarifado de origem não pode ser igual ao de destino.' });
      return;
    }
    if (!transferForm.productId || transferForm.quantity <= 0) {
      setFeedback({ type: 'error', message: 'Informe o produto e uma quantidade positiva.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch<any>('/api/v1/inventory/transfers', {
        method: 'POST',
        body: JSON.stringify({
          ...transferForm,
          quantity: Number(transferForm.quantity),
        }),
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Transferência realizada com sucesso! Saída: ${res.data?.outboundMovement?.movementNumber} | Entrada: ${res.data?.inboundMovement?.movementNumber}`,
        });
        setTransferForm((prev) => ({ ...prev, quantity: 1, notes: '' }));
        await loadData();
        setActiveTab('balances');
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Falha ao realizar transferência.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro de transferência.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auxiliar de Labels e Cores dos Tipos de Movimento
  const getMovementTypeBadge = (type: StockMovementType) => {
    switch (type) {
      case 'INBOUND_PURCHASE':
        return { label: 'Entrada por Compra', bg: 'bg-emerald-950/70 border-emerald-800 text-emerald-300', icon: ArrowDownLeft };
      case 'INBOUND_ADJUSTMENT':
        return { label: 'Ajuste de Inventário (+)', bg: 'bg-teal-950/70 border-teal-800 text-teal-300', icon: ArrowDownLeft };
      case 'RETURN':
        return { label: 'Devolução de Mercadoria', bg: 'bg-cyan-950/70 border-cyan-800 text-cyan-300', icon: ArrowDownLeft };
      case 'TRANSFER_IN':
        return { label: 'Transferência Recebida', bg: 'bg-blue-950/70 border-blue-800 text-blue-300', icon: ArrowLeftRight };
      case 'OUTBOUND_SALE':
        return { label: 'Saída por Venda', bg: 'bg-amber-950/70 border-amber-800 text-amber-300', icon: ArrowUpRight };
      case 'OUTBOUND_SERVICE_ORDER':
        return { label: 'Aplicação em OS', bg: 'bg-indigo-950/70 border-indigo-800 text-indigo-300', icon: ArrowUpRight };
      case 'OUTBOUND_ADJUSTMENT':
        return { label: 'Ajuste de Inventário / Perda (-)', bg: 'bg-rose-950/70 border-rose-800 text-rose-300', icon: AlertTriangle };
      case 'TRANSFER_OUT':
        return { label: 'Transferência Enviada', bg: 'bg-blue-950/70 border-blue-800 text-blue-300', icon: ArrowLeftRight };
      default:
        return { label: type, bg: 'bg-slate-800 border-slate-700 text-slate-300', icon: FileText };
    }
  };

  // Filtragem de Itens em Estoque
  const filteredStockItems = stockItems.filter((item) => {
    if (warehouseFilter && item.warehouseId !== warehouseFilter) return false;
    if (lowStockFilter && item.quantity > item.minQuantity) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const matchName = item.productName.toLowerCase().includes(q);
      const matchCode = item.productCode.toLowerCase().includes(q);
      const matchRack = item.locationRack?.toLowerCase().includes(q) || false;
      const matchWh = item.warehouseName.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchRack && !matchWh) return false;
    }
    return true;
  });

  // Filtragem de Movimentações Kardex
  const filteredMovements = movements.filter((mov) => {
    if (warehouseFilter && mov.warehouseId !== warehouseFilter) return false;
    if (movementTypeFilter && mov.movementType !== movementTypeFilter) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const matchNum = mov.movementNumber.toLowerCase().includes(q);
      const matchProd = mov.productName.toLowerCase().includes(q);
      const matchCode = mov.productCode.toLowerCase().includes(q);
      const matchDoc = mov.referenceDocument?.toLowerCase().includes(q) || false;
      const matchBatch = mov.batchNumber?.toLowerCase().includes(q) || false;
      if (!matchNum && !matchProd && !matchCode && !matchDoc && !matchBatch) return false;
    }
    return true;
  });

  // Exportar Kardex em CSV
  const exportKardexCSV = () => {
    if (filteredMovements.length === 0) {
      setFeedback({ type: 'error', message: 'Nenhuma movimentação para exportar.' });
      return;
    }

    const headers = [
      'Data/Hora',
      'Número Movimento',
      'Tipo',
      'SKU',
      'Produto',
      'Almoxarifado',
      'Qtd Movimentada',
      'Custo Unitário (BRL)',
      'Valor Total (BRL)',
      'Saldo Anterior',
      'Saldo Atual',
      'CMP Anterior (BRL)',
      'CMP Atual (BRL)',
      'Documento Ref',
      'Lote',
      'Validade',
    ];

    const rows = filteredMovements.map((m) => [
      m.createdAt,
      m.movementNumber,
      m.movementType,
      m.productCode,
      `"${m.productName.replace(/"/g, '""')}"`,
      `"${m.warehouseName.replace(/"/g, '""')}"`,
      m.quantity,
      m.unitCost.toFixed(2),
      m.totalCost.toFixed(2),
      m.previousStock,
      m.currentStock,
      m.previousAverageCost.toFixed(2),
      m.newAverageCost.toFixed(2),
      m.referenceDocument || '',
      m.batchNumber || '',
      m.expirationDate || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kardex_estoque_${activeCompany?.cleanCnpj}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Auxiliar de Curva ABC de Estoque
  const calculateABC = () => {
    const sorted = [...stockItems].sort((a, b) => b.totalValue - a.totalValue);
    const totalVal = sorted.reduce((acc, curr) => acc + curr.totalValue, 0) || 1;

    let accumulatedVal = 0;
    return sorted.map((item) => {
      accumulatedVal += item.totalValue;
      const accumulatedPercent = (accumulatedVal / totalVal) * 100;
      let category: 'A' | 'B' | 'C' = 'C';
      if (accumulatedPercent <= 80) category = 'A';
      else if (accumulatedPercent <= 95) category = 'B';

      return {
        ...item,
        percentOfTotal: (item.totalValue / totalVal) * 100,
        accumulatedPercent,
        category,
      };
    });
  };

  const abcItems = calculateABC();

  // Encontrar item atual selecionado no formulário para simulação
  const selectedMovementStockItem = stockItems.find(
    (s) => s.warehouseId === movementForm.warehouseId && s.productId === movementForm.productId
  );

  const selectedTransferStockItem = stockItems.find(
    (s) => s.warehouseId === transferForm.sourceWarehouseId && s.productId === transferForm.productId
  );

  return (
    <div className="space-y-6">
      {/* Banner Superior com Identificação e Ações Principais */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-950 border border-amber-800 px-2 py-0.5 text-xs font-semibold text-amber-400">
                PRD 06 • GESTÃO DE ESTOQUE & WMS
              </span>
              <span className="text-xs text-slate-400">Multi-Almoxarifado & Custo Médio (CMP)</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Boxes className="h-5 w-5 text-amber-400" />
              Controle Físico-Financeiro de Almoxarifado
            </h1>
            <p className="text-xs text-slate-400">
              Rastreabilidade de compras, saídas comerciais e OS, transferências entre depósitos e Kardex auditável.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('movement')}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-500 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Nova Movimentação
            </button>
            <button
              onClick={() => setActiveTab('transfers')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <ArrowLeftRight className="h-4 w-4 text-blue-400" />
              Transferência
            </button>
            <button
              onClick={() => {
                setEditingWarehouse(null);
                setWarehouseForm({ name: '', code: '', description: '', location: '', isDefault: false });
                setIsNewWarehouseModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <WarehouseIcon className="h-4 w-4 text-emerald-400" />
              Novo Almoxarifado
            </button>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              title="Recarregar dados de estoque"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-lg p-3.5 text-xs border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/80 border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards de Métricas Consolidadas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Card 1: Valor Patrimonial Total */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">Patrimônio em Estoque</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400 font-mono">
            {formatCurrency(metrics?.totalInventoryValue || 0)}
          </div>
          <p className="text-[10px] text-slate-500">Valoração pelo CMP</p>
        </div>

        {/* Card 2: Unidades Físicas em Estoque */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">Unidades em Estoque</span>
            <Package className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-white font-mono">
            {formatNumber(metrics?.totalStockUnits || 0)} un.
          </div>
          <p className="text-[10px] text-slate-500">Saldo Físico Global</p>
        </div>

        {/* Card 3: Total de SKUs Cadastrados */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">SKUs em Linha</span>
            <Barcode className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-lg font-bold text-white font-mono">
            {formatNumber(metrics?.totalItems || 0)} itens
          </div>
          <p className="text-[10px] text-slate-500">Produtos estocáveis</p>
        </div>

        {/* Card 4: Itens em Ponto de Reposição / Crítico */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">Ponto de Reposição</span>
            <AlertTriangle
              className={`h-4 w-4 ${
                (metrics?.lowStockCount || 0) > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-500'
              }`}
            />
          </div>
          <div
            className={`text-lg font-bold font-mono ${
              (metrics?.lowStockCount || 0) > 0 ? 'text-amber-400' : 'text-slate-300'
            }`}
          >
            {formatNumber(metrics?.lowStockCount || 0)}
          </div>
          <p className="text-[10px] text-slate-500">Abaixo do mín. estipulado</p>
        </div>

        {/* Card 5: Itens Esgotados (Zero Estoque) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">Esgotados (Zero)</span>
            <TrendingDown
              className={`h-4 w-4 ${
                (metrics?.outOfStockCount || 0) > 0 ? 'text-rose-400' : 'text-slate-500'
              }`}
            />
          </div>
          <div
            className={`text-lg font-bold font-mono ${
              (metrics?.outOfStockCount || 0) > 0 ? 'text-rose-400' : 'text-slate-300'
            }`}
          >
            {formatNumber(metrics?.outOfStockCount || 0)}
          </div>
          <p className="text-[10px] text-slate-500">Ruptura de estoque</p>
        </div>

        {/* Card 6: Almoxarifados Operacionais */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">Almoxarifados</span>
            <WarehouseIcon className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-white font-mono">
            {formatNumber(metrics?.activeWarehousesCount || warehouses.length)}
          </div>
          <p className="text-[10px] text-slate-500">Depósitos ativos</p>
        </div>
      </div>

      {/* Navegação de Abas do Módulo */}
      <div className="border-b border-slate-800">
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setActiveTab('balances')}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 font-medium transition-colors ${
              activeTab === 'balances'
                ? 'border-amber-500 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Boxes className="h-4 w-4" />
            Saldos em Estoque & CMP ({filteredStockItems.length})
          </button>

          <button
            onClick={() => setActiveTab('kardex')}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 font-medium transition-colors ${
              activeTab === 'kardex'
                ? 'border-amber-500 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="h-4 w-4" />
            Histórico Kardex & Auditoria ({movements.length})
          </button>

          <button
            onClick={() => setActiveTab('movement')}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 font-medium transition-colors ${
              activeTab === 'movement'
                ? 'border-amber-500 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="h-4 w-4" />
            Registrar Movimentação
          </button>

          <button
            onClick={() => setActiveTab('transfers')}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 font-medium transition-colors ${
              activeTab === 'transfers'
                ? 'border-amber-500 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Transferência entre Almoxarifados
          </button>

          <button
            onClick={() => setActiveTab('warehouses')}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 font-medium transition-colors ${
              activeTab === 'warehouses'
                ? 'border-amber-500 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <WarehouseIcon className="h-4 w-4" />
            Depósitos & Almoxarifados ({warehouses.length})
          </button>

          <button
            onClick={() => setActiveTab('abc')}
            className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 font-medium transition-colors ${
              activeTab === 'abc'
                ? 'border-amber-500 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="h-4 w-4" />
            Análise Curva ABC
          </button>
        </div>
      </div>

      {/* CONTEÚDO DA ABA 1: SALDOS EM ESTOQUE & CMP */}
      {activeTab === 'balances' && (
        <div className="space-y-4">
          {/* Barra de Filtros Rápidos */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por SKU, produto ou gôndola..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/90 pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="">Todos os Almoxarifados</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>

              <button
                onClick={() => setLowStockFilter(!lowStockFilter)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  lowStockFilter
                    ? 'border-amber-700 bg-amber-950/80 text-amber-300'
                    : 'border-slate-700 bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Apenas Ponto de Reposição
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Exibindo <strong className="text-slate-200">{filteredStockItems.length}</strong> de{' '}
              {stockItems.length} saldos de itens
            </div>
          </div>

          {/* Tabela de Saldos em Estoque */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold">
                <tr>
                  <th className="px-4 py-3">Código / SKU</th>
                  <th className="px-4 py-3">Produto / Descrição</th>
                  <th className="px-4 py-3">Almoxarifado</th>
                  <th className="px-4 py-3">Endereçamento</th>
                  <th className="px-4 py-3 text-right">Saldo Físico</th>
                  <th className="px-4 py-3 text-right">Disponível</th>
                  <th className="px-4 py-3 text-right">Estoque Mín.</th>
                  <th className="px-4 py-3 text-right">CMP (Custo Médio)</th>
                  <th className="px-4 py-3 text-right">Valor Total</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-500">
                      Nenhum item em estoque encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredStockItems.map((item) => {
                    const isOutOfStock = item.quantity <= 0;
                    const isLowStock = !isOutOfStock && item.quantity <= item.minQuantity;
                    const isExcess = item.maxQuantity > 0 && item.quantity > item.maxQuantity;

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-slate-200">
                          {item.productCode}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{item.productName}</div>
                          <div className="text-[11px] text-slate-500">Unidade: {item.productUnit || 'UN'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 font-medium text-slate-300">
                            <WarehouseIcon className="h-3.5 w-3.5 text-amber-400" />
                            {item.warehouseName}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {item.locationRack ? (
                            <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-mono text-slate-300">
                              {item.locationRack}
                            </span>
                          ) : (
                            <span className="text-slate-600 italic">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-white">
                          {formatNumber(item.quantity)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                          {formatNumber(item.availableQuantity)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-400">
                          {formatNumber(item.minQuantity)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-200">
                          {formatCurrency(item.averageCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400">
                          {formatCurrency(item.totalValue)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-950/80 border border-rose-800/70 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                              Esgotado
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-950/80 border border-amber-800/70 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                              Reposição
                            </span>
                          ) : isExcess ? (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-950/80 border border-blue-800/70 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                              Excesso
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-800/70 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setEditingLimitsItem(item);
                              setLimitsForm({
                                minQuantity: item.minQuantity || 0,
                                maxQuantity: item.maxQuantity || 0,
                                locationRack: item.locationRack || '',
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                            title="Ajustar limites de estoque e endereço"
                          >
                            <Sliders className="h-3 w-3" />
                            Limites
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: HISTÓRICO KARDEX & AUDITORIA */}
      {activeTab === 'kardex' && (
        <div className="space-y-4">
          {/* Barra de Filtros e Exportação do Kardex */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por movimento, produto, documento, lote..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/90 pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="">Todos os Almoxarifados</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="">Todos os Tipos de Movimento</option>
                <option value="INBOUND_PURCHASE">Entrada por Compra</option>
                <option value="INBOUND_ADJUSTMENT">Ajuste de Inventário (+)</option>
                <option value="INBOUND_RETURN_SALE">Devolução de Venda</option>
                <option value="OUTBOUND_SALE">Saída por Venda</option>
                <option value="OUTBOUND_SERVICE_ORDER">Aplicação em Ordem de Serviço</option>
                <option value="OUTBOUND_LOSS">Perda / Avaria / Descarte</option>
                <option value="OUTBOUND_ADJUSTMENT">Ajuste de Inventário (-)</option>
                <option value="OUTBOUND_TRANSFER">Transferência Enviada</option>
                <option value="INBOUND_TRANSFER">Transferência Recebida</option>
              </select>
            </div>

            <button
              onClick={exportKardexCSV}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-amber-400" />
              Exportar Kardex CSV
            </button>
          </div>

          {/* Tabela do Livro Kardex Auditável */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold">
                <tr>
                  <th className="px-3.5 py-3">Data / Hora</th>
                  <th className="px-3.5 py-3">Movimento</th>
                  <th className="px-3.5 py-3">Tipo Operacional</th>
                  <th className="px-3.5 py-3">Produto / SKU</th>
                  <th className="px-3.5 py-3">Almoxarifado</th>
                  <th className="px-3.5 py-3 text-right">Qtd</th>
                  <th className="px-3.5 py-3 text-right">Custo Unit.</th>
                  <th className="px-3.5 py-3 text-right">Total</th>
                  <th className="px-3.5 py-3 text-right">Saldo Físico</th>
                  <th className="px-3.5 py-3 text-right">CMP Recalculado</th>
                  <th className="px-3.5 py-3">Ref / Documento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-500">
                      Nenhuma movimentação de estoque registrada até o momento.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((mov) => {
                    const badge = getMovementTypeBadge(mov.movementType);
                    const isPositive = mov.movementType.startsWith('INBOUND');

                    return (
                      <tr
                        key={mov.id}
                        onClick={() => setSelectedKardexMovement(mov)}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-3.5 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {formatDateTime(mov.createdAt)}
                        </td>
                        <td className="px-3.5 py-3 font-mono font-semibold text-amber-400">
                          {mov.movementNumber}
                        </td>
                        <td className="px-3.5 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium ${badge.bg}`}
                          >
                            <badge.icon className="h-3 w-3" />
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="font-medium text-slate-200">{mov.productName}</div>
                          <div className="font-mono text-[10px] text-slate-500">{mov.productCode}</div>
                        </td>
                        <td className="px-3.5 py-3 text-slate-300">
                          {mov.warehouseName}
                          {mov.targetWarehouseName && (
                            <div className="text-[10px] text-blue-400">➔ {mov.targetWarehouseName}</div>
                          )}
                        </td>
                        <td
                          className={`px-3.5 py-3 text-right font-mono font-bold ${
                            isPositive ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {isPositive ? `+${mov.quantity}` : `-${mov.quantity}`}
                        </td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-300">
                          {formatCurrency(mov.unitCost)}
                        </td>
                        <td className="px-3.5 py-3 text-right font-mono font-medium text-slate-200">
                          {formatCurrency(mov.totalCost)}
                        </td>
                        <td className="px-3.5 py-3 text-right font-mono text-[11px]">
                          <span className="text-slate-500">{mov.previousStock}</span>
                          <span className="text-slate-400"> ➔ </span>
                          <strong className="text-white">{mov.currentStock}</strong>
                        </td>
                        <td className="px-3.5 py-3 text-right font-mono text-[11px]">
                          <span className="text-slate-500">{formatCurrency(mov.previousAverageCost)}</span>
                          <span className="text-slate-400"> ➔ </span>
                          <strong className="text-emerald-400">{formatCurrency(mov.newAverageCost)}</strong>
                        </td>
                        <td className="px-3.5 py-3 text-slate-400">
                          {mov.referenceDocument ? (
                            <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                              {mov.referenceDocument}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: FORMULÁRIO DE REGISTRO DE MOVIMENTAÇÃO */}
      {activeTab === 'movement' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1 e 2: Formulário Operacional */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-amber-400" />
                Registrar Movimentação de Estoque
              </h2>
              <p className="text-xs text-slate-400">
                Efetiva lançamentos manuais com recálculo automático do Custo Médio Ponderado (CMP) e saldo físico.
              </p>
            </div>

            <form onSubmit={handleRecordMovement} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tipo de Movimento */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tipo de Movimentação *
                  </label>
                  <select
                    value={movementForm.movementType}
                    onChange={(e) =>
                      setMovementForm({
                        ...movementForm,
                        movementType: e.target.value as StockMovementType,
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="INBOUND_PURCHASE">Entrada por Compra / Fornecedor</option>
                    <option value="INBOUND_ADJUSTMENT">Entrada por Ajuste de Inventário (+)</option>
                    <option value="INBOUND_RETURN_SALE">Devolução de Venda / Retorno de Cliente</option>
                    <option value="OUTBOUND_SALE">Saída por Faturamento / Expedição</option>
                    <option value="OUTBOUND_SERVICE_ORDER">Saída por Aplicação em Ordem de Serviço</option>
                    <option value="OUTBOUND_LOSS">Saída por Perda / Avaria / Descarte</option>
                    <option value="OUTBOUND_ADJUSTMENT">Saída por Ajuste de Inventário (-)</option>
                  </select>
                </div>

                {/* Almoxarifado */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Almoxarifado de Destino/Origem *
                  </label>
                  <select
                    value={movementForm.warehouseId}
                    onChange={(e) => setMovementForm({ ...movementForm, warehouseId: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code}) {w.isDefault ? '• Padrão' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Produto */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Produto Físico *
                </label>
                <select
                  value={movementForm.productId}
                  onChange={(e) => {
                    const prodId = e.target.value;
                    const prod = products.find((p) => p.id === prodId);
                    setMovementForm({
                      ...movementForm,
                      productId: prodId,
                      unitCost: prod?.costPrice || 0,
                    });
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name} (Custo Base: {formatCurrency(p.costPrice || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Quantidade */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Quantidade a Movimentar *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={movementForm.quantity}
                    onChange={(e) =>
                      setMovementForm({ ...movementForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Custo Unitário (BRL) */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Custo Unitário de Aquisição (BRL)
                    {movementForm.movementType.startsWith('INBOUND') ? ' *' : ' (Automático pelo CMP)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!movementForm.movementType.startsWith('INBOUND')}
                    value={movementForm.unitCost}
                    onChange={(e) =>
                      setMovementForm({ ...movementForm, unitCost: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-slate-200 disabled:opacity-50 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Documento de Referência */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Doc. Referência / NF-e
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: NF-10492 / PED-003"
                    value={movementForm.referenceDocument}
                    onChange={(e) =>
                      setMovementForm({ ...movementForm, referenceDocument: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {/* Número do Lote */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Lote (Rastreabilidade)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: LOT-2026-A"
                    value={movementForm.batchNumber}
                    onChange={(e) => setMovementForm({ ...movementForm, batchNumber: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {/* Data de Validade */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Data de Validade
                  </label>
                  <input
                    type="date"
                    value={movementForm.expirationDate}
                    onChange={(e) =>
                      setMovementForm({ ...movementForm, expirationDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Justificativa / Observações */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Justificativa / Motivo da Operação
                </label>
                <textarea
                  rows={2}
                  placeholder="Descreva a razão do lançamento de estoque..."
                  value={movementForm.notes}
                  onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-amber-500 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Gravando Movimentação...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmar Movimentação de Estoque
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Coluna 3: Simulador de Impacto no Estoque e CMP */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Simulação de Impacto Físico-Financeiro
            </h3>

            {selectedMovementStockItem ? (
              <div className="space-y-3 text-xs">
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Estado Atual</span>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Saldo Físico Atual:</span>
                    <strong className="font-mono text-white">
                      {formatNumber(selectedMovementStockItem.quantity)} un.
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>CMP Vigente:</span>
                    <strong className="font-mono text-amber-400">
                      {formatCurrency(selectedMovementStockItem.averageCost)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Valor Patrimonial:</span>
                    <strong className="font-mono text-emerald-400">
                      {formatCurrency(selectedMovementStockItem.totalValue)}
                    </strong>
                  </div>
                </div>

                {/* Projeção */}
                <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 space-y-2">
                  <span className="text-[11px] font-semibold text-amber-400 uppercase">Projeção Pós-Operação</span>
                  {(() => {
                    const isPositive = movementForm.movementType.startsWith('INBOUND');
                    const qty = Number(movementForm.quantity) || 0;
                    const unitCost = Number(movementForm.unitCost) || selectedMovementStockItem.averageCost;
                    const newQty = isPositive
                      ? selectedMovementStockItem.quantity + qty
                      : selectedMovementStockItem.quantity - qty;

                    let projectedCMP = selectedMovementStockItem.averageCost;
                    if (isPositive && newQty > 0) {
                      const prevVal = selectedMovementStockItem.quantity * selectedMovementStockItem.averageCost;
                      const addedVal = qty * unitCost;
                      projectedCMP = (prevVal + addedVal) / newQty;
                    }

                    const projectedTotalValue = Math.max(0, newQty) * projectedCMP;

                    return (
                      <>
                        <div className="flex justify-between items-center text-slate-300">
                          <span>Novo Saldo:</span>
                          <strong
                            className={`font-mono ${newQty < 0 ? 'text-rose-400' : 'text-white'}`}
                          >
                            {formatNumber(newQty)} un.
                          </strong>
                        </div>
                        <div className="flex justify-between items-center text-slate-300">
                          <span>Novo CMP Ponderado:</span>
                          <strong className="font-mono text-amber-300">
                            {formatCurrency(projectedCMP)}
                          </strong>
                        </div>
                        <div className="flex justify-between items-center text-slate-300">
                          <span>Novo Valor Patrimonial:</span>
                          <strong className="font-mono text-emerald-300">
                            {formatCurrency(projectedTotalValue)}
                          </strong>
                        </div>
                        {newQty < 0 && (
                          <div className="mt-2 text-[11px] text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Operação resultará em estoque negativo (bloqueado).
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
                O produto selecionado ainda não possui registro de saldo neste almoxarifado. Esta operação criará o registro inicial de estoque.
              </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1 font-semibold text-slate-300">
                <Info className="h-3.5 w-3.5 text-blue-400" />
                Regra Legal do Custo Médio (CMP)
              </div>
              <p>
                Nas entradas por compra, o Custo Médio é recalculado pela média ponderada das quantidades e valores. Nas saídas, o CMP é mantido inalterado, deduzindo proporcionalmente o valor patrimonial.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 4: TRANSFERÊNCIA ENTRE ALMOXARIFADOS */}
      {activeTab === 'transfers' && (
        <div className="max-w-2xl mx-auto rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-blue-400" />
              Transferência Interna entre Almoxarifados
            </h2>
            <p className="text-xs text-slate-400">
              Movimenta mercadorias entre depósitos mantendo o Custo Médio Ponderado (CMP) com rastreabilidade dupla no Kardex.
            </p>
          </div>

          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Origem */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Almoxarifado de Origem (Saída) *
                </label>
                <select
                  value={transferForm.sourceWarehouseId}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, sourceWarehouseId: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                  required
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Destino */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Almoxarifado de Destino (Entrada) *
                </label>
                <select
                  value={transferForm.targetWarehouseId}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, targetWarehouseId: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                  required
                >
                  {warehouses
                    .filter((w) => w.id !== transferForm.sourceWarehouseId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Produto */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Produto a Transferir *
              </label>
              <select
                value={transferForm.productId}
                onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                required
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Saldo Disponível na Origem */}
            {selectedTransferStockItem && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs flex items-center justify-between">
                <span className="text-slate-400">Saldo Disponível na Origem:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatNumber(selectedTransferStockItem.availableQuantity)} unidades
                  <span className="text-slate-500 font-normal ml-2">
                    (CMP: {formatCurrency(selectedTransferStockItem.averageCost)})
                  </span>
                </span>
              </div>
            )}

            {/* Quantidade */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Quantidade a Transferir *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                max={selectedTransferStockItem?.availableQuantity || 999999}
                value={transferForm.quantity}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            {/* Justificativa */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Observações / Justificativa da Transferência
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Reposição de filial para atendimento a cliente..."
                value={transferForm.notes}
                onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Processando Transferência...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="h-4 w-4" />
                    Executar Transferência de Estoque
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONTEÚDO DA ABA 5: GESTÃO DE ALMOXARIFADOS */}
      {activeTab === 'warehouses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Almoxarifados e Centros de Distribuição</h2>
            <button
              onClick={() => {
                setEditingWarehouse(null);
                setWarehouseForm({ name: '', code: '', description: '', location: '', isDefault: false });
                setIsNewWarehouseModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-500 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Cadastrar Depósito
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.map((wh) => {
              const whItems = stockItems.filter((s) => s.warehouseId === wh.id);
              const totalUnits = whItems.reduce((acc, curr) => acc + curr.quantity, 0);
              const totalValue = whItems.reduce((acc, curr) => acc + curr.totalValue, 0);

              return (
                <div
                  key={wh.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-400 bg-amber-950/70 border border-amber-800/80 px-2 py-0.5 rounded">
                          {wh.code}
                        </span>
                        {wh.isDefault && (
                          <span className="rounded bg-emerald-950 border border-emerald-800 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-400">
                            Padrão
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-white mt-1.5">{wh.name}</h3>
                      {wh.location && (
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                          <MapPin className="h-3 w-3 text-slate-500" />
                          {wh.location}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingWarehouse(wh);
                          setWarehouseForm({
                            name: wh.name,
                            code: wh.code,
                            description: wh.description || '',
                            location: wh.location || '',
                            isDefault: wh.isDefault,
                          });
                          setIsNewWarehouseModalOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                        title="Editar Almoxarifado"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {!wh.isDefault && (
                        <button
                          onClick={() => handleDeleteWarehouse(wh)}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition"
                          title="Excluir Almoxarifado"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {wh.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">{wh.description}</p>
                  )}

                  {/* Resumo de Estoque no Almoxarifado */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500">Total de Unidades</span>
                      <div className="font-mono font-bold text-white">{formatNumber(totalUnits)} un.</div>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">Valor em Estoque</span>
                      <div className="font-mono font-bold text-emerald-400">{formatCurrency(totalValue)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 6: ANÁLISE CURVA ABC */}
      {activeTab === 'abc' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Classificação da Curva ABC de Estoque</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Classifica os itens armazenados pelo impacto financeiro patrimonial:
              <strong className="text-emerald-400 ml-1">Classe A:</strong> 80% do valor (alto impacto, controle diário);
              <strong className="text-blue-400 ml-1">Classe B:</strong> 15% do valor (médio impacto);
              <strong className="text-slate-400 ml-1">Classe C:</strong> 5% do valor (baixo impacto, itens de giro rápido/pequeno porte).
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-center">Classe ABC</th>
                  <th className="px-4 py-3">Código / SKU</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Almoxarifado</th>
                  <th className="px-4 py-3 text-right">Saldo Físico</th>
                  <th className="px-4 py-3 text-right">CMP (BRL)</th>
                  <th className="px-4 py-3 text-right">Valor Patrimonial</th>
                  <th className="px-4 py-3 text-right">% do Total</th>
                  <th className="px-4 py-3 text-right">% Acumulada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {abcItems.map((item) => {
                  const badgeClass =
                    item.category === 'A'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      : item.category === 'B'
                      ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700';

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block w-6 py-0.5 rounded border text-center font-bold ${badgeClass}`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-200">
                        {item.productCode}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{item.productName}</td>
                      <td className="px-4 py-3 text-slate-400">{item.warehouseName}</td>
                      <td className="px-4 py-3 text-right font-mono text-white">
                        {formatNumber(item.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        {formatCurrency(item.averageCost)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(item.totalValue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        {item.percentOfTotal.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400">
                        {item.accumulatedPercent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: CADASTRAR / EDITAR ALMOXARIFADO */}
      {isNewWarehouseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <WarehouseIcon className="h-4 w-4 text-amber-400" />
                {editingWarehouse ? 'Editar Almoxarifado' : 'Novo Almoxarifado'}
              </h3>
              <button
                onClick={() => setIsNewWarehouseModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome do Almoxarifado *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Almoxarifado Central Matriz"
                  value={warehouseForm.name}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Código do Almoxarifado (Sigla)
                </label>
                <input
                  type="text"
                  placeholder="Ex: ALM-01 / DEP-FILIAL"
                  value={warehouseForm.code}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Localização / Endereçamento Físico
                </label>
                <input
                  type="text"
                  placeholder="Ex: Galpão Principal - Ala Norte"
                  value={warehouseForm.location}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, location: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  placeholder="Finalidade operacional do depósito..."
                  value={warehouseForm.description}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={warehouseForm.isDefault}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, isDefault: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0"
                />
                <label htmlFor="isDefault" className="text-xs text-slate-300">
                  Definir como almoxarifado principal (padrão)
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewWarehouseModalOpen(false)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Almoxarifado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AJUSTAR LIMITES E ENDEREÇAMENTO */}
      {editingLimitsItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-amber-400" />
                  Parâmetros de Estoque
                </h3>
                <p className="text-xs text-slate-400">{editingLimitsItem.productName}</p>
              </div>
              <button onClick={() => setEditingLimitsItem(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLimits} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Estoque Mínimo (Ponto de Reposição)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={limitsForm.minQuantity}
                    onChange={(e) =>
                      setLimitsForm({ ...limitsForm, minQuantity: parseInt(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Estoque Máximo Operacional
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={limitsForm.maxQuantity}
                    onChange={(e) =>
                      setLimitsForm({ ...limitsForm, maxQuantity: parseInt(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Localização Física / Endereçamento (Rua, Prateleira, Gôndola)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Corredor B / Prateleira 04 / Nível 2"
                  value={limitsForm.locationRack}
                  onChange={(e) => setLimitsForm({ ...limitsForm, locationRack: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingLimitsItem(null)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Atualizando...' : 'Atualizar Parâmetros'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DETALHES DE MOVIMENTAÇÃO KARDEX */}
      {selectedKardexMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-400">
                    {selectedKardexMovement.movementNumber}
                  </span>
                  <span
                    className={`rounded border px-1.5 py-0.2 text-[10px] ${
                      getMovementTypeBadge(selectedKardexMovement.movementType).bg
                    }`}
                  >
                    {getMovementTypeBadge(selectedKardexMovement.movementType).label}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">
                  {selectedKardexMovement.productName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedKardexMovement(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-1">
                <span className="text-[10px] text-slate-500">Almoxarifado</span>
                <div className="font-semibold text-white">{selectedKardexMovement.warehouseName}</div>
                {selectedKardexMovement.targetWarehouseName && (
                  <div className="text-blue-400 text-[11px]">
                    ➔ Destino: {selectedKardexMovement.targetWarehouseName}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-1">
                <span className="text-[10px] text-slate-500">Data e Registro</span>
                <div className="font-semibold text-white">{formatDateTime(selectedKardexMovement.createdAt)}</div>
                <div className="text-slate-400 text-[11px]">
                  Doc: {selectedKardexMovement.referenceDocument || 'Sem ref.'}
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-1">
                <span className="text-[10px] text-slate-500">Saldo Físico</span>
                <div className="font-mono text-slate-300">
                  Anterior: {selectedKardexMovement.previousStock} un.
                </div>
                <div className="font-mono font-bold text-white">
                  Novo: {selectedKardexMovement.currentStock} un.
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-1">
                <span className="text-[10px] text-slate-500">Custo Médio Ponderado (CMP)</span>
                <div className="font-mono text-slate-400">
                  Antes: {formatCurrency(selectedKardexMovement.previousAverageCost)}
                </div>
                <div className="font-mono font-bold text-emerald-400">
                  Depois: {formatCurrency(selectedKardexMovement.newAverageCost)}
                </div>
              </div>
            </div>

            {selectedKardexMovement.batchNumber && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs flex justify-between">
                <span className="text-slate-400">Lote de Rastreabilidade:</span>
                <span className="font-mono text-amber-300">{selectedKardexMovement.batchNumber}</span>
                {selectedKardexMovement.expirationDate && (
                  <span className="text-slate-400">Validade: {selectedKardexMovement.expirationDate}</span>
                )}
              </div>
            )}

            {selectedKardexMovement.notes && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs space-y-1">
                <span className="text-[10px] text-slate-500">Observações</span>
                <p className="text-slate-300">{selectedKardexMovement.notes}</p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedKardexMovement(null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
