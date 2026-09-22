/**
 * Enlace ERP - Módulo Fiscal & Tributário Brasileiro (PRD 07)
 * Emissão e Gestão de Documentos Fiscais Eletrônicos (NF-e, NFS-e, NFC-e),
 * Matriz Tributária, Cancelamentos, CC-e, Inutilizações e Geração de SPED Fiscal EFD
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import {
  FileText,
  Landmark,
  ShieldCheck,
  Send,
  Ban,
  FileEdit,
  Download,
  Plus,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  Receipt,
  FileSpreadsheet,
  Cpu,
  Eye,
  Trash2,
  FileCode,
  Hash,
  Sparkles,
  Clock,
} from 'lucide-react';
import {
  FiscalDocument,
  FiscalMetrics,
  FiscalOperation,
  FiscalInutilization,
  FiscalDocumentModel,
  FiscalDocumentStatus,
  FiscalDocumentType,
  BusinessPartner,
  BillingDocument,
} from '../../shared/types.js';

export const FiscalView: React.FC = () => {
  const { activeCompany, activeSchema, apiFetch } = useAuth();

  // Estados de navegação interna
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'operations' | 'inutilization' | 'sped'>(
    'overview'
  );

  // Estados de dados
  const [metrics, setMetrics] = useState<FiscalMetrics | null>(null);
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [operations, setOperations] = useState<FiscalOperation[]>([]);
  const [inutilizations, setInutilizations] = useState<FiscalInutilization[]>([]);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [billingDocuments, setBillingDocuments] = useState<BillingDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filtros de Documentos Fiscais
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modais
  const [showNewDocModal, setShowNewDocModal] = useState<boolean>(false);
  const [showTransmitModal, setShowTransmitModal] = useState<FiscalDocument | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<FiscalDocument | null>(null);
  const [showCceModal, setShowCceModal] = useState<FiscalDocument | null>(null);
  const [showXmlModal, setShowXmlModal] = useState<FiscalDocument | null>(null);
  const [showDanfeModal, setShowDanfeModal] = useState<FiscalDocument | null>(null);
  const [showNewOpModal, setShowNewOpModal] = useState<boolean>(false);
  const [showNewInutModal, setShowNewInutModal] = useState<boolean>(false);

  // Estados dos formulários
  const [cancelJustification, setCancelJustification] = useState<string>('');
  const [cceText, setCceText] = useState<string>('');

  // Formulário de Novo Documento Fiscal
  const [docEmissionType, setDocEmissionType] = useState<'MANUAL' | 'FROM_BILLING'>('MANUAL');
  const [selectedBillingId, setSelectedBillingId] = useState<string>('');
  const [newDocModel, setNewDocModel] = useState<FiscalDocumentModel>('NFE_55');
  const [newDocType, setNewDocType] = useState<FiscalDocumentType>('OUTBOUND');
  const [newDocNature, setNewDocNature] = useState<string>('Venda de Mercadorias');
  const [newDocPartnerId, setNewDocPartnerId] = useState<string>('');
  const [newDocPartnerName, setNewDocPartnerName] = useState<string>('');
  const [newDocPartnerCnpjCpf, setNewDocPartnerCnpjCpf] = useState<string>('');
  const [newDocPartnerStateReg, setNewDocPartnerStateReg] = useState<string>('');
  const [newDocPartnerStreet, setNewDocPartnerStreet] = useState<string>('Av. Paulista');
  const [newDocPartnerNumber, setNewDocPartnerNumber] = useState<string>('1000');
  const [newDocPartnerNeighborhood, setNewDocPartnerNeighborhood] = useState<string>('Bela Vista');
  const [newDocPartnerCity, setNewDocPartnerCity] = useState<string>('São Paulo');
  const [newDocPartnerState, setNewDocPartnerState] = useState<string>('SP');
  const [newDocPartnerZip, setNewDocPartnerZip] = useState<string>('01310-100');

  // Itens do Documento Fiscal
  const [newDocItems, setNewDocItems] = useState<
    Array<{
      productCode: string;
      productName: string;
      ncm: string;
      cfop: string;
      unit: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      isService: boolean;
      serviceCode?: string;
    }>
  >([
    {
      productCode: 'PROD-001',
      productName: 'Servidor Dell PowerEdge R750',
      ncm: '8471.30.12',
      cfop: '5.102',
      unit: 'UN',
      quantity: 1,
      unitPrice: 24500.0,
      discount: 0,
      isService: false,
    },
  ]);

  // Formulário de Nova Operação Fiscal
  const [newOpCfop, setNewOpCfop] = useState<string>('');
  const [newOpDesc, setNewOpDesc] = useState<string>('');
  const [newOpType, setNewOpType] = useState<FiscalDocumentType>('OUTBOUND');
  const [newOpRegime, setNewOpRegime] = useState<'ALL' | 'SIMPLES_NACIONAL' | 'REGIME_NORMAL'>('ALL');
  const [newOpIcmsCst, setNewOpIcmsCst] = useState<string>('102');
  const [newOpIcmsRate, setNewOpIcmsRate] = useState<number>(0);
  const [newOpPisCst, setNewOpPisCst] = useState<string>('01');
  const [newOpPisRate, setNewOpPisRate] = useState<number>(1.65);
  const [newOpCofinsCst, setNewOpCofinsCst] = useState<string>('01');
  const [newOpCofinsRate, setNewOpCofinsRate] = useState<number>(7.6);
  const [newOpIssRate, setNewOpIssRate] = useState<number>(0);

  // Formulário de Inutilização
  const [inutModel, setInutModel] = useState<FiscalDocumentModel>('NFE_55');
  const [inutSeries, setInutSeries] = useState<string>('1');
  const [inutStart, setInutStart] = useState<number>(1010);
  const [inutEnd, setInutEnd] = useState<number>(1015);
  const [inutYear, setInutYear] = useState<number>(new Date().getFullYear());
  const [inutJustification, setInutJustification] = useState<string>('Salto involuntário de numeração no emissor contingencial');

  // SPED Fiscal
  const [spedMonth, setSpedMonth] = useState<number>(new Date().getMonth() + 1);
  const [spedYear, setSpedYear] = useState<number>(new Date().getFullYear());
  const [spedPreview, setSpedPreview] = useState<{
    digitalFile: string;
    totalLines: number;
    blocksSummary: Array<{ block: string; name: string; recordCount: number; description: string }>;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  const loadData = async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      // Métricas
      const mRes = await apiFetch<FiscalMetrics>('/api/v1/fiscal/metrics');
      if (mRes.success && mRes.data) {
        setMetrics(mRes.data);
      }

      // Documentos
      const dRes = await apiFetch<FiscalDocument[]>('/api/v1/fiscal/documents');
      if (dRes.success && dRes.data) {
        setDocuments(dRes.data);
      }

      // Operações Fiscais
      const oRes = await apiFetch<FiscalOperation[]>('/api/v1/fiscal/operations');
      if (oRes.success && oRes.data) {
        setOperations(oRes.data);
      }

      // Inutilizações
      const iRes = await apiFetch<FiscalInutilization[]>('/api/v1/fiscal/inutilizations');
      if (iRes.success && iRes.data) {
        setInutilizations(iRes.data);
      }

      // Parceiros cadastrados
      const pRes = await apiFetch<BusinessPartner[]>('/api/v1/partners');
      if (pRes.success && pRes.data) {
        setPartners(pRes.data);
      }

      // Documentos de Faturamento
      const bRes = await apiFetch<BillingDocument[]>('/api/v1/billing');
      if (bRes.success && bRes.data) {
        setBillingDocuments(bRes.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar dados fiscais.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCompany]);

  // Transmissão para SEFAZ
  const handleTransmit = async (doc: FiscalDocument) => {
    setActionLoading(true);
    try {
      const res = await apiFetch<FiscalDocument>(`/api/v1/fiscal/documents/${doc.id}/transmit`, {
        method: 'POST',
      });
      if (res.success && res.data) {
        showToast(`Documento ${res.data.number} autorizado com sucesso pela SEFAZ!`);
        setShowTransmitModal(null);
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Falha ao autorizar documento na SEFAZ.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancelamento
  const handleCancel = async () => {
    if (!showCancelModal) return;
    if (cancelJustification.trim().length < 15) {
      showToast('A justificativa de cancelamento requer no mínimo 15 caracteres exigidos pela SEFAZ.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiFetch<FiscalDocument>(`/api/v1/fiscal/documents/${showCancelModal.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ justification: cancelJustification }),
      });
      if (res.success && res.data) {
        showToast(`Documento ${res.data.number} cancelado com sucesso homologado pela SEFAZ!`);
        setShowCancelModal(null);
        setCancelJustification('');
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Falha ao cancelar documento.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Carta de Correção (CC-e)
  const handleAddCce = async () => {
    if (!showCceModal) return;
    if (cceText.trim().length < 15) {
      showToast('O texto da Carta de Correção requer no mínimo 15 caracteres.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiFetch<FiscalDocument>(`/api/v1/fiscal/documents/${showCceModal.id}/correction`, {
        method: 'POST',
        body: JSON.stringify({ correctionText: cceText }),
      });
      if (res.success && res.data) {
        showToast(`CC-e registrada e transmitida com sucesso para o documento ${res.data.number}!`);
        setShowCceModal(null);
        setCceText('');
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Falha ao registrar Carta de Correção.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Criar Documento Fiscal (Manual ou via Faturamento)
  const handleCreateDocument = async () => {
    setActionLoading(true);
    try {
      if (docEmissionType === 'FROM_BILLING') {
        if (!selectedBillingId) {
          showToast('Selecione um documento de faturamento para emitir a nota fiscal.', 'error');
          setActionLoading(false);
          return;
        }

        const res = await apiFetch<FiscalDocument>('/api/v1/fiscal/emit-from-billing', {
          method: 'POST',
          body: JSON.stringify({
            billingId: selectedBillingId,
            model: newDocModel,
          }),
        });

        if (res.success && res.data) {
          showToast(`Documento fiscal gerado a partir do faturamento com sucesso! Nº ${res.data.number}`);
          setShowNewDocModal(false);
          await loadData();
        }
      } else {
        // Emissão manual
        if (!newDocPartnerName || !newDocPartnerCnpjCpf || newDocItems.length === 0) {
          showToast('Preencha os dados do destinatário e adicione pelo menos um item.', 'error');
          setActionLoading(false);
          return;
        }

        const res = await apiFetch<FiscalDocument>('/api/v1/fiscal/documents', {
          method: 'POST',
          body: JSON.stringify({
            model: newDocModel,
            type: newDocType,
            natureOfOperation: newDocNature,
            partnerId: newDocPartnerId || undefined,
            partnerName: newDocPartnerName,
            partnerCnpjCpf: newDocPartnerCnpjCpf,
            partnerStateRegistration: newDocPartnerStateReg || undefined,
            partnerAddress: {
              street: newDocPartnerStreet,
              number: newDocPartnerNumber,
              neighborhood: newDocPartnerNeighborhood,
              city: newDocPartnerCity,
              state: newDocPartnerState,
              zipCode: newDocPartnerZip,
            },
            items: newDocItems,
          }),
        });

        if (res.success && res.data) {
          showToast(`Documento fiscal criado com sucesso! Nº ${res.data.number}`);
          setShowNewDocModal(false);
          await loadData();
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Falha ao gerar documento fiscal.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Criar Operação Fiscal
  const handleCreateOperation = async () => {
    if (!newOpCfop || !newOpDesc) {
      showToast('Preencha o CFOP e a descrição da operação.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiFetch<FiscalOperation>('/api/v1/fiscal/operations', {
        method: 'POST',
        body: JSON.stringify({
          cfop: newOpCfop,
          description: newOpDesc,
          type: newOpType,
          applicableRegime: newOpRegime,
          icmsCst: newOpIcmsCst,
          icmsRate: Number(newOpIcmsRate),
          pisCst: newOpPisCst,
          pisRate: Number(newOpPisRate),
          cofinsCst: newOpCofinsCst,
          cofinsRate: Number(newOpCofinsRate),
          issRate: Number(newOpIssRate),
        }),
      });
      if (res.success && res.data) {
        showToast(`Operação Fiscal CFOP ${res.data.cfop} cadastrada com sucesso!`);
        setShowNewOpModal(false);
        setNewOpCfop('');
        setNewOpDesc('');
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao cadastrar operação fiscal.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Inutilização de Numeração
  const handleCreateInutilization = async () => {
    if (!inutJustification || inutJustification.trim().length < 15) {
      showToast('A justificativa de inutilização requer no mínimo 15 caracteres.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiFetch<FiscalInutilization>('/api/v1/fiscal/inutilizations', {
        method: 'POST',
        body: JSON.stringify({
          model: inutModel,
          series: inutSeries,
          startNumber: inutStart,
          endNumber: inutEnd,
          year: inutYear,
          justification: inutJustification,
        }),
      });
      if (res.success && res.data) {
        showToast(`Faixa de numeração ${inutStart} a ${inutEnd} homologada e inutilizada com sucesso!`);
        setShowNewInutModal(false);
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao inutilizar numeração.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Gerar Prévia SPED
  const handleGenerateSped = async () => {
    setActionLoading(true);
    try {
      const res = await apiFetch<{
        digitalFile: string;
        totalLines: number;
        blocksSummary: Array<{ block: string; name: string; recordCount: number; description: string }>;
      }>(`/api/v1/fiscal/sped/preview?month=${spedMonth}&year=${spedYear}`);
      if (res.success && res.data) {
        setSpedPreview(res.data);
        showToast(`Arquivo SPED Fiscal EFD gerado com sucesso (${res.data.totalLines} linhas de registros escriturados)!`);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao processar SPED Fiscal.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Download do arquivo SPED (.txt)
  const handleDownloadSped = () => {
    if (!spedPreview) return;
    const blob = new Blob([spedPreview.digitalFile], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SPED_EFD_${activeCompany?.cleanCnpj}_${spedYear}${String(spedMonth).padStart(2, '0')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download do XML
  const handleDownloadXml = (doc: FiscalDocument) => {
    const xml = doc.xmlPayload || '<?xml version="1.0" encoding="UTF-8"?><nfeProc></nfeProc>';
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc.accessKey || doc.number}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtro de documentos fiscais
  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => {
      const matchSearch =
        d.number.toString().includes(searchQuery) ||
        d.accessKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.partnerCnpjCpf.includes(searchQuery);

      const matchModel = selectedModel === 'ALL' || d.model === selectedModel;
      const matchStatus = selectedStatus === 'ALL' || d.status === selectedStatus;

      return matchSearch && matchModel && matchStatus;
    });
  }, [documents, searchQuery, selectedModel, selectedStatus]);

  const getStatusBadge = (status: FiscalDocumentStatus) => {
    switch (status) {
      case 'AUTHORIZED':
        return (
          <span className="inline-flex items-center gap-1 rounded border border-emerald-800/80 bg-emerald-950/60 px-2 py-0.5 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Autorizada (SEFAZ)
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 rounded border border-amber-800/80 bg-amber-950/60 px-2 py-0.5 text-xs font-medium text-amber-300">
            <Clock className="h-3 w-3" />
            Rascunho (Não transmitida)
          </span>
        );
      case 'CANCELED':
        return (
          <span className="inline-flex items-center gap-1 rounded border border-rose-800/80 bg-rose-950/60 px-2 py-0.5 text-xs font-medium text-rose-400">
            <XCircle className="h-3 w-3" />
            Cancelada
          </span>
        );
      case 'REJECTED':
      case 'DENIED':
        return (
          <span className="inline-flex items-center gap-1 rounded border border-red-800/80 bg-red-950/60 px-2 py-0.5 text-xs font-medium text-red-400">
            <AlertTriangle className="h-3 w-3" />
            Rejeitada / Denegada
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{status}</span>;
    }
  };

  const getModelBadge = (model: FiscalDocumentModel) => {
    switch (model) {
      case 'NFE_55':
        return (
          <span className="rounded bg-sky-950 border border-sky-800/80 px-2 py-0.5 text-xs font-bold text-sky-400">
            NF-e (Mod 55)
          </span>
        );
      case 'NFSE':
        return (
          <span className="rounded bg-indigo-950 border border-indigo-800/80 px-2 py-0.5 text-xs font-bold text-indigo-400">
            NFS-e (Serviços)
          </span>
        );
      case 'NFCE_65':
        return (
          <span className="rounded bg-purple-950 border border-purple-800/80 px-2 py-0.5 text-xs font-bold text-purple-400">
            NFC-e (Mod 65)
          </span>
        );
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border p-4 shadow-2xl transition-all ${
            notification.type === 'success'
              ? 'border-emerald-800 bg-slate-900 text-emerald-400'
              : 'border-rose-800 bg-slate-900 text-rose-400'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0" />
          )}
          <span className="text-xs font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header com Identificação do Módulo */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-purple-950 border border-purple-800/80 px-2 py-0.5 text-xs font-bold text-purple-300">
              PRD 07 • FISCAL & TRIBUTÁRIO
            </span>
            <span className="text-xs text-slate-400">Ambiente SEFAZ: Homologação Integrada</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Módulo Fiscal & Tributação Brasileira</h1>
          <p className="text-xs text-slate-400">
            Emissão de DF-e (NF-e, NFS-e, NFC-e), autorização SEFAZ, CC-e, cancelamento, matriz tributária e SPED Fiscal EFD
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          <button
            onClick={() => setShowNewDocModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500 shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Emitir Documento Fiscal
          </button>
        </div>
      </div>

      {/* Navegação de Abas do Módulo */}
      <div className="flex gap-2 border-b border-slate-800 pb-1 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'overview'
              ? 'border-emerald-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Landmark className="h-3.5 w-3.5" />
          Painel & Indicadores Fiscais
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'documents'
              ? 'border-emerald-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Documentos Emitidos ({documents.length})
        </button>

        <button
          onClick={() => setActiveTab('operations')}
          className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'operations'
              ? 'border-emerald-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Matriz Tributária (CFOPs)
        </button>

        <button
          onClick={() => setActiveTab('inutilization')}
          className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'inutilization'
              ? 'border-emerald-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Ban className="h-3.5 w-3.5" />
          Inutilização de Numeração
        </button>

        <button
          onClick={() => setActiveTab('sped')}
          className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'sped'
              ? 'border-emerald-500 text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          SPED Fiscal & EFD ICMS/IPI
        </button>
      </div>

      {/* ABA 1: PAINEL & INDICADORES FISCAIS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Cards de Métricas Principais */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Total Faturado Autorizado</span>
                <Landmark className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-white">
                {formatCurrency(metrics?.totalAuthorizedValue || 0)}
              </div>
              <span className="mt-1 block text-[11px] text-slate-400">
                {metrics?.totalAuthorizedCount || 0} documentos homologados na SEFAZ
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">ICMS Apurado (Período)</span>
                <Receipt className="h-4 w-4 text-sky-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-sky-400">
                {formatCurrency(metrics?.totalICMSPeriod || 0)}
              </div>
              <span className="mt-1 block text-[11px] text-slate-400">
                Operações de Mercadorias e Bens
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">ISSQN Municipal Apurado</span>
                <Building2 className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-indigo-400">
                {formatCurrency(metrics?.totalISSPeriod || 0)}
              </div>
              <span className="mt-1 block text-[11px] text-slate-400">
                Serviços de Tecnologia & Suporte
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">PIS / COFINS Consolidados</span>
                <Cpu className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-amber-400">
                {formatCurrency(metrics?.totalPISCOFINSPeriod || 0)}
              </div>
              <span className="mt-1 block text-[11px] text-slate-400">
                Tributos Federais Diretos
              </span>
            </div>
          </div>

          {/* Cards Secundários de Status e Modelos */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Status do WebService SEFAZ */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-semibold text-white">Status da Conectividade SEFAZ</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950 border border-emerald-800/80 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  OPERACIONAL
                </span>
              </div>
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Ambiente</span>
                  <span className="font-mono text-emerald-400">2 - HOMOLOGAÇÃO</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Autorizador</span>
                  <span className="font-mono">SVRS (Sefaz Virtual RS)</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Versão dos Schemas</span>
                  <span className="font-mono">PL_009_V4.00</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Certificado Digital (A1)</span>
                  <span className="font-mono text-emerald-400">Válido até 12/2027</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Tempo Médio de Resposta</span>
                  <span className="font-mono text-slate-300">140 ms</span>
                </div>
              </div>
            </div>

            {/* Distribuição por Modelo */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-semibold text-white">Documentos por Modelo (DF-e)</h3>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="h-2 w-2 rounded-full bg-sky-400"></span>
                    NF-e Mercadorias (Mod 55)
                  </span>
                  <span className="font-bold text-white">{metrics?.countNFe || 0} notas</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="h-2 w-2 rounded-full bg-indigo-400"></span>
                    NFS-e Serviços Municipais
                  </span>
                  <span className="font-bold text-white">{metrics?.countNFSe || 0} notas</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="h-2 w-2 rounded-full bg-purple-400"></span>
                    NFC-e Consumidor (Mod 65)
                  </span>
                  <span className="font-bold text-white">{metrics?.countNFCe || 0} notas</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Canceladas no período</span>
                  <span className="text-rose-400 font-medium">{metrics?.canceledCount || 0}</span>
                </div>
              </div>
            </div>

            {/* Ações Rápidas & SPED */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-semibold text-white">Rotinas Fiscais Periódicas</h3>
              </div>
              <div className="mt-4 space-y-2.5">
                <button
                  onClick={() => setActiveTab('sped')}
                  className="w-full flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/60 p-2.5 text-xs text-slate-200 hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                    <div>
                      <div className="font-medium text-white">Escriturar SPED Fiscal</div>
                      <div className="text-[11px] text-slate-400">Gerar EFD ICMS/IPI do mês</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </button>

                <button
                  onClick={() => setActiveTab('inutilization')}
                  className="w-full flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/60 p-2.5 text-xs text-slate-200 hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-amber-400" />
                    <div>
                      <div className="font-medium text-white">Inutilizar Faixa de Numeração</div>
                      <div className="text-[11px] text-slate-400">Homologar quebras de série na SEFAZ</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: DOCUMENTOS EMITIDOS */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Filtros e Busca */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por número, destinatário, CNPJ ou chave de 44 dígitos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="ALL">Todos os Modelos</option>
                <option value="NFE_55">NF-e Mercadorias (55)</option>
                <option value="NFSE">NFS-e Serviços</option>
                <option value="NFCE_65">NFC-e Consumidor (65)</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="ALL">Todos os Status</option>
                <option value="AUTHORIZED">Autorizada</option>
                <option value="DRAFT">Rascunho</option>
                <option value="CANCELED">Cancelada</option>
                <option value="REJECTED">Rejeitada</option>
              </select>
            </div>
          </div>

          {/* Tabela de Documentos Fiscais */}
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/80 font-semibold text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Doc / Número</th>
                    <th className="py-3 px-4">Modelo</th>
                    <th className="py-3 px-4">Destinatário / Tomador</th>
                    <th className="py-3 px-4">Emissão</th>
                    <th className="py-3 px-4 text-right">Valor Líquido</th>
                    <th className="py-3 px-4 text-right">Impostos</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhum documento fiscal encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">Nº {doc.number}</div>
                          <div className="font-mono text-[10px] text-slate-400">Série {doc.series}</div>
                        </td>
                        <td className="py-3 px-4">{getModelBadge(doc.model)}</td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-200">{doc.partnerName}</div>
                          <div className="font-mono text-[11px] text-slate-400">{doc.partnerCnpjCpf}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-200">{doc.issueDate}</div>
                          <div className="text-[10px] text-slate-500">{doc.issueTime}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">
                          {formatCurrency(doc.netTotal)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="text-slate-300">
                            ICMS: {formatCurrency(doc.totalICMS)}
                          </div>
                          {doc.totalISS > 0 && (
                            <div className="text-[11px] text-indigo-400">ISS: {formatCurrency(doc.totalISS)}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">{getStatusBadge(doc.status)}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {doc.status === 'DRAFT' && (
                              <button
                                onClick={() => handleTransmit(doc)}
                                disabled={actionLoading}
                                title="Transmitir para a SEFAZ"
                                className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-500"
                              >
                                <Send className="h-3 w-3" />
                                Transmitir
                              </button>
                            )}

                            {doc.status === 'AUTHORIZED' && (
                              <>
                                <button
                                  onClick={() => setShowDanfeModal(doc)}
                                  title="Visualizar DANFE"
                                  className="rounded border border-slate-800 bg-slate-800/80 p-1.5 text-slate-300 hover:text-white"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  onClick={() => setShowXmlModal(doc)}
                                  title="Ver XML assinado"
                                  className="rounded border border-slate-800 bg-slate-800/80 p-1.5 text-slate-300 hover:text-sky-400"
                                >
                                  <FileCode className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  onClick={() => setShowCceModal(doc)}
                                  title="Carta de Correção (CC-e)"
                                  className="rounded border border-slate-800 bg-slate-800/80 p-1.5 text-slate-300 hover:text-amber-400"
                                >
                                  <FileEdit className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    setShowCancelModal(doc);
                                    setCancelJustification('');
                                  }}
                                  title="Cancelar Nota Fiscal"
                                  className="rounded border border-slate-800 bg-slate-800/80 p-1.5 text-slate-300 hover:text-rose-400"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => handleDownloadXml(doc)}
                              title="Download XML"
                              className="rounded border border-slate-800 bg-slate-800/80 p-1.5 text-slate-300 hover:text-emerald-400"
                            >
                              <Download className="h-3.5 w-3.5" />
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
        </div>
      )}

      {/* ABA 3: MATRIZ TRIBUTÁRIA & OPERAÇÕES FISCAIS */}
      {activeTab === 'operations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold text-white">Regras Tributárias & Códigos Fiscais de Operações (CFOPs)</h2>
              <p className="text-xs text-slate-400">
                Parametrização de CST/CSOSN, alíquotas padrão de ICMS, PIS, COFINS e ISSQN aplicáveis
              </p>
            </div>
            <button
              onClick={() => setShowNewOpModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nova Operação Fiscal
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/80 font-semibold text-slate-400">
                  <tr>
                    <th className="py-3 px-4">CFOP</th>
                    <th className="py-3 px-4">Descrição da Operação</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Regime Aplicável</th>
                    <th className="py-3 px-4">CST ICMS</th>
                    <th className="py-3 px-4">Alíq. ICMS</th>
                    <th className="py-3 px-4">PIS / COFINS</th>
                    <th className="py-3 px-4 text-center">Padrão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {operations.map((op) => (
                    <tr key={op.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">{op.cfop}</td>
                      <td className="py-3 px-4 text-slate-200 font-medium">{op.description}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            op.type === 'OUTBOUND'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {op.type === 'OUTBOUND' ? 'Saída' : 'Entrada'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{op.applicableRegime}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{op.icmsCst}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{op.icmsRate}%</td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {op.pisRate}% / {op.cofinsRate}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        {op.isDefault ? (
                          <span className="rounded bg-emerald-950 border border-emerald-800/80 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                            SIM
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
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

      {/* ABA 4: INUTILIZAÇÃO DE NUMERAÇÃO */}
      {activeTab === 'inutilization' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold text-white">Inutilização de Numeração Homologada na SEFAZ</h2>
              <p className="text-xs text-slate-400">
                Registro oficial de faixas de numeração saltadas ou danificadas antes de emissão
              </p>
            </div>
            <button
              onClick={() => setShowNewInutModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Inutilizar Faixa
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/80 font-semibold text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Modelo</th>
                    <th className="py-3 px-4">Série</th>
                    <th className="py-3 px-4">Faixa Inutilizada</th>
                    <th className="py-3 px-4">Ano</th>
                    <th className="py-3 px-4">Protocolo SEFAZ</th>
                    <th className="py-3 px-4">Justificativa Legal</th>
                    <th className="py-3 px-4">Registrado Por</th>
                    <th className="py-3 px-4">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {inutilizations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhuma inutilização de numeração registrada.
                      </td>
                    </tr>
                  ) : (
                    inutilizations.map((inut) => (
                      <tr key={inut.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">{getModelBadge(inut.model)}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{inut.series}</td>
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          {inut.startNumber} até {inut.endNumber}
                        </td>
                        <td className="py-3 px-4 text-slate-300">{inut.year}</td>
                        <td className="py-3 px-4 font-mono text-emerald-400">{inut.protocolNumber}</td>
                        <td className="py-3 px-4 text-slate-300 max-w-xs truncate">{inut.justification}</td>
                        <td className="py-3 px-4 text-slate-400">{inut.registeredByName}</td>
                        <td className="py-3 px-4 text-slate-400">{inut.registeredAt.substring(0, 10)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 5: SPED FISCAL & EFD ICMS/IPI */}
      {activeTab === 'sped' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white">Geração do Arquivo Digital SPED Fiscal (EFD ICMS/IPI)</h2>
                <p className="text-xs text-slate-400">
                  Escrituração Fiscal Digital em conformidade com o Ato COTEPE e Guia Prático da EFD
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Mês:</span>
                  <select
                    value={spedMonth}
                    onChange={(e) => setSpedMonth(Number(e.target.value))}
                    className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Ano:</span>
                  <input
                    type="number"
                    value={spedYear}
                    onChange={(e) => setSpedYear(Number(e.target.value))}
                    className="w-20 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>

                <button
                  onClick={handleGenerateSped}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors"
                >
                  <Cpu className="h-4 w-4" />
                  Gerar Escrituração
                </button>
              </div>
            </div>

            {/* Sumário dos Blocos Gerados */}
            {spedPreview ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-white">
                      Arquivo validado com sucesso ({spedPreview.totalLines} linhas geradas)
                    </span>
                  </div>

                  <button
                    onClick={handleDownloadSped}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-slate-700 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar Arquivo .TXT do SPED
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {spedPreview.blocksSummary.map((b) => (
                    <div key={b.block} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-emerald-400">Bloco {b.block}</span>
                        <span className="text-xs text-slate-400">{b.recordCount} registros</span>
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-200">{b.name}</div>
                      <p className="mt-0.5 text-[11px] text-slate-500">{b.description}</p>
                    </div>
                  ))}
                </div>

                {/* Prévia do texto do SPED */}
                <div className="mt-4">
                  <span className="text-xs font-semibold text-slate-300">Prévia das primeiras linhas do arquivo digital:</span>
                  <pre className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300 leading-relaxed scrollbar-none">
                    {spedPreview.digitalFile.split('\n').slice(0, 30).join('\n')}
                    {spedPreview.digitalFile.split('\n').length > 30 ? '\n... [Registros adicionais omitidos na prévia]' : ''}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">
                Selecione o mês/ano de apuração e clique em "Gerar Escrituração" para processar o SPED Fiscal.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: NOVO DOCUMENTO FISCAL */}
      {showNewDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Emissão de Documento Fiscal Eletrônico (DF-e)</h3>
              <button
                onClick={() => setShowNewDocModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Opção de Origem: Manual ou Faturamento */}
              <div className="flex gap-4 border-b border-slate-800 pb-3">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="radio"
                    name="emissionType"
                    checked={docEmissionType === 'MANUAL'}
                    onChange={() => setDocEmissionType('MANUAL')}
                  />
                  <span>Emissão Manual Direta</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="radio"
                    name="emissionType"
                    checked={docEmissionType === 'FROM_BILLING'}
                    onChange={() => setDocEmissionType('FROM_BILLING')}
                  />
                  <span>Emitir a partir de Faturamento Gerado</span>
                </label>
              </div>

              {docEmissionType === 'FROM_BILLING' ? (
                <div className="space-y-3">
                  <label className="block text-slate-400">Selecione o Faturamento Pendente:</label>
                  <select
                    value={selectedBillingId}
                    onChange={(e) => setSelectedBillingId(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white"
                  >
                    <option value="">Selecione um faturamento...</option>
                    {billingDocuments.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.number} • {b.customerName} • {formatCurrency(b.total)}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400">Modelo Fiscal a Emitir:</label>
                      <select
                        value={newDocModel}
                        onChange={(e) => setNewDocModel(e.target.value as FiscalDocumentModel)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white"
                      >
                        <option value="NFE_55">NF-e Mod. 55 (Mercadorias/Produtos)</option>
                        <option value="NFSE">NFS-e (Serviços em Tecnologia)</option>
                        <option value="NFCE_65">NFC-e Mod. 65 (Venda a Consumidor)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                /* Formulário Manual */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400">Modelo DF-e</label>
                      <select
                        value={newDocModel}
                        onChange={(e) => {
                          const m = e.target.value as FiscalDocumentModel;
                          setNewDocModel(m);
                          if (m === 'NFSE') {
                            setNewDocNature('Prestação de Serviços em Tecnologia');
                          } else {
                            setNewDocNature('Venda de Mercadorias');
                          }
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white"
                      >
                        <option value="NFE_55">NF-e Mod. 55 (Produtos)</option>
                        <option value="NFSE">NFS-e (Serviços Municipais)</option>
                        <option value="NFCE_65">NFC-e Mod. 65 (Consumidor)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400">Tipo de Movimento</label>
                      <select
                        value={newDocType}
                        onChange={(e) => setNewDocType(e.target.value as FiscalDocumentType)}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white"
                      >
                        <option value="OUTBOUND">1 - Saída (Venda/Prestação)</option>
                        <option value="INBOUND">0 - Entrada (Devolução/Compra)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400">Natureza da Operação</label>
                      <input
                        type="text"
                        value={newDocNature}
                        onChange={(e) => setNewDocNature(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* Destinatário */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300">Dados do Destinatário / Tomador</span>
                      {partners.length > 0 && (
                        <select
                          onChange={(e) => {
                            const p = partners.find((x) => x.id === e.target.value);
                            if (p) {
                              setNewDocPartnerId(p.id);
                              setNewDocPartnerName(p.name || p.tradeName || '');
                              setNewDocPartnerCnpjCpf(p.document);
                              setNewDocPartnerStateReg(p.stateRegistration || 'ISENTO');
                              if (p.address) {
                                setNewDocPartnerStreet(p.address.street || '');
                                setNewDocPartnerNumber(p.address.number || '');
                                setNewDocPartnerNeighborhood(p.address.neighborhood || '');
                                setNewDocPartnerCity(p.address.city || '');
                                setNewDocPartnerState(p.address.state || '');
                                setNewDocPartnerZip(p.address.zipCode || '');
                              }
                            }
                          }}
                          className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                        >
                          <option value="">Carregar de parceiro cadastrado...</option>
                          {partners.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.tradeName} ({p.document})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-400">Razão Social / Nome</label>
                        <input
                          type="text"
                          value={newDocPartnerName}
                          onChange={(e) => setNewDocPartnerName(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs text-white"
                          placeholder="Ex: Petrobras S.A."
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400">CNPJ / CPF</label>
                        <input
                          type="text"
                          value={newDocPartnerCnpjCpf}
                          onChange={(e) => setNewDocPartnerCnpjCpf(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs text-white font-mono"
                          placeholder="00.000.000/0000-00"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400">Inscrição Estadual</label>
                        <input
                          type="text"
                          value={newDocPartnerStateReg}
                          onChange={(e) => setNewDocPartnerStateReg(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs text-white font-mono"
                          placeholder="ISENTO ou número"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-400">Logradouro</label>
                        <input
                          type="text"
                          value={newDocPartnerStreet}
                          onChange={(e) => setNewDocPartnerStreet(e.target.value)}
                          className="mt-1 w-full rounded border border-slate-800 bg-slate-900 p-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400">Número</label>
                        <input
                          type="text"
                          value={newDocPartnerNumber}
                          onChange={(e) => setNewDocPartnerNumber(e.target.value)}
                          className="mt-1 w-full rounded border border-slate-800 bg-slate-900 p-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400">Cidade</label>
                        <input
                          type="text"
                          value={newDocPartnerCity}
                          onChange={(e) => setNewDocPartnerCity(e.target.value)}
                          className="mt-1 w-full rounded border border-slate-800 bg-slate-900 p-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400">UF</label>
                        <input
                          type="text"
                          value={newDocPartnerState}
                          onChange={(e) => setNewDocPartnerState(e.target.value)}
                          className="mt-1 w-full rounded border border-slate-800 bg-slate-900 p-1.5 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Itens */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300">Itens e Tributação da Nota</span>
                      <button
                        type="button"
                        onClick={() =>
                          setNewDocItems([
                            ...newDocItems,
                            {
                              productCode: `ITEM-00${newDocItems.length + 1}`,
                              productName: 'Novo Item Comercial',
                              ncm: newDocModel === 'NFSE' ? '0000.00.00' : '8471.30.12',
                              cfop: newDocModel === 'NFSE' ? '5.933' : '5.102',
                              unit: newDocModel === 'NFSE' ? 'SV' : 'UN',
                              quantity: 1,
                              unitPrice: 1000.0,
                              discount: 0,
                              isService: newDocModel === 'NFSE',
                            },
                          ])
                        }
                        className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-emerald-400 hover:bg-slate-700"
                      >
                        + Adicionar Item
                      </button>
                    </div>

                    <div className="space-y-2">
                      {newDocItems.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 border border-slate-800 p-2 rounded bg-slate-900">
                          <div className="col-span-4">
                            <label className="block text-[10px] text-slate-400">Descrição</label>
                            <input
                              type="text"
                              value={item.productName}
                              onChange={(e) => {
                                const next = [...newDocItems];
                                next[idx].productName = e.target.value;
                                setNewDocItems(next);
                              }}
                              className="w-full rounded border border-slate-800 bg-slate-950 p-1 text-xs text-white"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] text-slate-400">NCM (8 Díg.)</label>
                            <input
                              type="text"
                              value={item.ncm}
                              onChange={(e) => {
                                const next = [...newDocItems];
                                next[idx].ncm = e.target.value;
                                setNewDocItems(next);
                              }}
                              className="w-full rounded border border-slate-800 bg-slate-950 p-1 text-xs text-white font-mono"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] text-slate-400">CFOP</label>
                            <input
                              type="text"
                              value={item.cfop}
                              onChange={(e) => {
                                const next = [...newDocItems];
                                next[idx].cfop = e.target.value;
                                setNewDocItems(next);
                              }}
                              className="w-full rounded border border-slate-800 bg-slate-950 p-1 text-xs text-white font-mono"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-[10px] text-slate-400">Qtd</label>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const next = [...newDocItems];
                                next[idx].quantity = Number(e.target.value);
                                setNewDocItems(next);
                              }}
                              className="w-full rounded border border-slate-800 bg-slate-950 p-1 text-xs text-white"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] text-slate-400">Preço Unit. (R$)</label>
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => {
                                const next = [...newDocItems];
                                next[idx].unitPrice = Number(e.target.value);
                                setNewDocItems(next);
                              }}
                              className="w-full rounded border border-slate-800 bg-slate-950 p-1 text-xs text-white"
                            />
                          </div>
                          <div className="col-span-1 flex items-end justify-center">
                            {newDocItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setNewDocItems(newDocItems.filter((_, i) => i !== idx))}
                                className="text-rose-400 hover:text-rose-300 p-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                onClick={() => setShowNewDocModal(false)}
                className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateDocument}
                disabled={actionLoading}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500"
              >
                {actionLoading ? 'Processando...' : 'Gerar Documento Fiscal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANCELAMENTO */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-rose-900/60 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Ban className="h-5 w-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Cancelar Nota Fiscal Nº {showCancelModal.number}</h3>
              </div>
              <button onClick={() => setShowCancelModal(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-lg border border-amber-800/80 bg-amber-950/40 p-3 text-amber-300">
                Atenção: O cancelamento da NF-e na SEFAZ é irrevogável e deve cumprir o prazo regulamentar estadual.
                A justificativa deve conter no mínimo 15 caracteres.
              </div>

              <div>
                <label className="block text-slate-400">Justificativa do Cancelamento (Mínimo 15 caracteres):</label>
                <textarea
                  rows={3}
                  value={cancelJustification}
                  onChange={(e) => setCancelJustification(e.target.value)}
                  placeholder="Ex: Cancelamento motivado por desacordo comercial e desistência da compra pelo cliente."
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-rose-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500">
                  {cancelJustification.length}/15 caracteres necessários
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                onClick={() => setShowCancelModal(null)}
                className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800"
              >
                Voltar
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading || cancelJustification.trim().length < 15}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {actionLoading ? 'Cancelando na SEFAZ...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CARTA DE CORREÇÃO (CC-e) */}
      {showCceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileEdit className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Carta de Correção Eletrônica (CC-e)</h3>
              </div>
              <button onClick={() => setShowCceModal(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-300">
                Documento: <strong>NF-e Nº {showCceModal.number}</strong> • Chave:{' '}
                <span className="font-mono text-emerald-400">{showCceModal.accessKey}</span>
              </div>

              {/* Histórico de CC-e anteriores */}
              {showCceModal.correctionLetters && showCceModal.correctionLetters.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-300">Cartas de Correção Emitidas Anteriormente:</span>
                  <div className="mt-2 space-y-2 max-h-36 overflow-y-auto">
                    {showCceModal.correctionLetters.map((c) => (
                      <div key={c.id} className="rounded border border-slate-800 bg-slate-950 p-2 text-[11px]">
                        <div className="flex justify-between font-bold text-slate-400">
                          <span>Sequência #{c.sequenceNumber}</span>
                          <span>{c.issuedAt.substring(0, 10)}</span>
                        </div>
                        <p className="mt-1 text-slate-300">{c.correctionText}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-400">Texto Explicativo da Correção (Mínimo 15 caracteres):</label>
                <textarea
                  rows={4}
                  value={cceText}
                  onChange={(e) => setCceText(e.target.value)}
                  placeholder="Ex: Correção do código de produto e dados complementares de transporte, sem alteração de valores tributáveis."
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500">{cceText.length}/15 caracteres necessários</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                onClick={() => setShowCceModal(null)}
                className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800"
              >
                Voltar
              </button>
              <button
                onClick={handleAddCce}
                disabled={actionLoading || cceText.trim().length < 15}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-500 disabled:opacity-50"
              >
                {actionLoading ? 'Registrando CC-e...' : 'Transmitir CC-e'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VISUALIZAÇÃO DE XML */}
      {showXmlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-sky-400" />
                <h3 className="text-base font-bold text-white">XML Assinado - NF-e Nº {showXmlModal.number}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadXml(showXmlModal)}
                  className="flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-slate-700"
                >
                  <Download className="h-3 w-3" />
                  Baixar XML
                </button>
                <button onClick={() => setShowXmlModal(null)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              <pre className="rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-emerald-400 whitespace-pre-wrap leading-relaxed">
                {showXmlModal.xmlPayload || 'XML não disponível'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VISUALIZAÇÃO DE DANFE */}
      {showDanfeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-800 bg-white text-slate-950 p-8 shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
              <div>
                <div className="text-xl font-extrabold uppercase">{activeCompany?.legalName}</div>
                <div className="text-xs">CNPJ: {activeCompany?.cnpj} • I.E: 112.334.556.789</div>
                <div className="text-xs">Curitiba - PR • CEP: 80010-000</div>
              </div>
              <div className="border-2 border-slate-900 p-2 text-center">
                <div className="text-lg font-black tracking-widest">DANFE</div>
                <div className="text-[10px] font-bold">Documento Auxiliar da NF-e</div>
                <div className="mt-1 text-xs font-mono">Nº {showDanfeModal.number}</div>
                <div className="text-[10px]">SÉRIE {showDanfeModal.series}</div>
              </div>
            </div>

            <div className="mt-4 border border-slate-800 p-2 text-xs font-mono">
              <span className="font-bold">CHAVE DE ACESSO:</span> {showDanfeModal.accessKey}
            </div>

            <div className="mt-4 border border-slate-800 p-3 text-xs space-y-1">
              <div className="font-bold border-b pb-1 text-slate-700">DESTINATÁRIO / REMETENTE</div>
              <div className="flex justify-between">
                <span>Nome: <strong>{showDanfeModal.partnerName}</strong></span>
                <span>CNPJ/CPF: <strong>{showDanfeModal.partnerCnpjCpf}</strong></span>
              </div>
              <div>Endereço: {showDanfeModal.partnerAddress?.street}, {showDanfeModal.partnerAddress?.number} - {showDanfeModal.partnerAddress?.city}/{showDanfeModal.partnerAddress?.state}</div>
            </div>

            {/* Tabela de Itens do DANFE */}
            <div className="mt-4 border border-slate-800">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-200 border-b border-slate-800 font-bold">
                  <tr>
                    <th className="p-1.5">Código</th>
                    <th className="p-1.5">Descrição dos Produtos</th>
                    <th className="p-1.5">NCM</th>
                    <th className="p-1.5">CFOP</th>
                    <th className="p-1.5">Qtd</th>
                    <th className="p-1.5 text-right">V. Unit</th>
                    <th className="p-1.5 text-right">V. Total</th>
                    <th className="p-1.5 text-right">ICMS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {showDanfeModal.items.map((it) => (
                    <tr key={it.id}>
                      <td className="p-1.5 font-mono">{it.productCode}</td>
                      <td className="p-1.5">{it.productName}</td>
                      <td className="p-1.5 font-mono">{it.ncm}</td>
                      <td className="p-1.5 font-mono">{it.cfop}</td>
                      <td className="p-1.5">{it.quantity}</td>
                      <td className="p-1.5 text-right">{formatCurrency(it.unitPrice)}</td>
                      <td className="p-1.5 text-right font-bold">{formatCurrency(it.totalPrice)}</td>
                      <td className="p-1.5 text-right">{formatCurrency(it.icmsValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totais do DANFE */}
            <div className="mt-4 border border-slate-800 p-3 text-xs grid grid-cols-4 gap-2 bg-slate-100">
              <div>
                <span className="text-[10px] text-slate-600 block">Base de Cálculo ICMS:</span>
                <span className="font-bold">{formatCurrency(showDanfeModal.totalTaxableAmount)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-600 block">Valor do ICMS:</span>
                <span className="font-bold">{formatCurrency(showDanfeModal.totalICMS)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-600 block">Valor dos Produtos:</span>
                <span className="font-bold">{formatCurrency(showDanfeModal.totalProducts)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-600 block">VALOR TOTAL DA NOTA:</span>
                <span className="font-extrabold text-sm">{formatCurrency(showDanfeModal.netTotal)}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-300 pt-4">
              <button
                onClick={() => setShowDanfeModal(null)}
                className="rounded border border-slate-400 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA OPERAÇÃO FISCAL (CFOP) */}
      {showNewOpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Cadastrar Nova Operação Fiscal (CFOP)</h3>
              <button onClick={() => setShowNewOpModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400">Código CFOP</label>
                  <input
                    type="text"
                    value={newOpCfop}
                    onChange={(e) => setNewOpCfop(e.target.value)}
                    placeholder="Ex: 5.102"
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400">Tipo de Documento</label>
                  <select
                    value={newOpType}
                    onChange={(e) => setNewOpType(e.target.value as FiscalDocumentType)}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white"
                  >
                    <option value="OUTBOUND">Saída (5.xxx / 6.xxx)</option>
                    <option value="INBOUND">Entrada (1.xxx / 2.xxx)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400">Descrição Completa da Operação</label>
                <input
                  type="text"
                  value={newOpDesc}
                  onChange={(e) => setNewOpDesc(e.target.value)}
                  placeholder="Ex: Venda de mercadoria adquirida ou recebida de terceiros"
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400">CST / CSOSN ICMS</label>
                  <input
                    type="text"
                    value={newOpIcmsCst}
                    onChange={(e) => setNewOpIcmsCst(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400">Alíquota ICMS (%)</label>
                  <input
                    type="number"
                    value={newOpIcmsRate}
                    onChange={(e) => setNewOpIcmsRate(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400">Alíquota ISS (%)</label>
                  <input
                    type="number"
                    value={newOpIssRate}
                    onChange={(e) => setNewOpIssRate(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400">Alíquota PIS (%)</label>
                  <input
                    type="number"
                    value={newOpPisRate}
                    onChange={(e) => setNewOpPisRate(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400">Alíquota COFINS (%)</label>
                  <input
                    type="number"
                    value={newOpCofinsRate}
                    onChange={(e) => setNewOpCofinsRate(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                onClick={() => setShowNewOpModal(false)}
                className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateOperation}
                disabled={actionLoading}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500"
              >
                Salvar Operação Fiscal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INUTILIZAÇÃO DE NUMERAÇÃO */}
      {showNewInutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Ban className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Inutilizar Numeração na SEFAZ</h3>
              </div>
              <button onClick={() => setShowNewInutModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400">Modelo DF-e</label>
                  <select
                    value={inutModel}
                    onChange={(e) => setInutModel(e.target.value as FiscalDocumentModel)}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white"
                  >
                    <option value="NFE_55">NF-e (Mod 55)</option>
                    <option value="NFCE_65">NFC-e (Mod 65)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400">Série</label>
                  <input
                    type="text"
                    value={inutSeries}
                    onChange={(e) => setInutSeries(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400">Número Inicial</label>
                  <input
                    type="number"
                    value={inutStart}
                    onChange={(e) => setInutStart(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400">Número Final</label>
                  <input
                    type="number"
                    value={inutEnd}
                    onChange={(e) => setInutEnd(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400">Ano</label>
                  <input
                    type="number"
                    value={inutYear}
                    onChange={(e) => setInutYear(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400">Justificativa da Inutilização (Mínimo 15 caracteres):</label>
                <textarea
                  rows={3}
                  value={inutJustification}
                  onChange={(e) => setInutJustification(e.target.value)}
                  placeholder="Ex: Salto involuntário de numeração devido a falha técnica em emissor contingencial."
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500">{inutJustification.length}/15 caracteres</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                onClick={() => setShowNewInutModal(false)}
                className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateInutilization}
                disabled={actionLoading || inutJustification.trim().length < 15}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500 disabled:opacity-50"
              >
                Homologar Inutilização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
