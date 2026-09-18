/**
 * Enlace ERP - Cadastros Centrais & Estrutura Financeira (PRD 03)
 * Gestão de Parceiros Comerciais, Plano de Contas Hierárquico, Centros de Custo e Validação Fiscal
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import {
  BusinessPartner,
  ChartOfAccount,
  CostCenter,
  PersonType,
  BusinessPartnerRole,
  PartnerStatus,
  AccountCategory,
  AccountType,
  AccountNature,
} from '../../shared/types.js';
import {
  validateFiscalDocument,
  cleanDocument,
  formatDocument,
  formatCEP,
  formatPhone,
  generateTestCPF,
  generateTestCNPJ,
  validateCPF,
  validateCNPJ,
} from '../../shared/validators.js';
import {
  Building2,
  Users,
  Briefcase,
  Layers,
  FileCheck2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FolderTree,
  Folder,
  FileText,
  Trash2,
  Edit2,
  Eye,
  RefreshCw,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  CreditCard,
  Calendar,
  DollarSign,
  ChevronRight,
  TrendingUp,
  Tag,
  HelpCircle,
  X,
} from 'lucide-react';

export const MasterDataView: React.FC = () => {
  const { activeCompany, activeSchema, apiFetch } = useAuth();

  // Navegação entre sub-abas do PRD 03
  const [currentSubTab, setCurrentSubTab] = useState<
    'partners' | 'chart' | 'costCenters' | 'validator'
  >('partners');

  // Estados de dados
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  // Filtros de Parceiros
  const [partnerSearch, setPartnerSearch] = useState<string>('');
  const [partnerRoleFilter, setPartnerRoleFilter] = useState<string>('TODOS');
  const [partnerStatusFilter, setPartnerStatusFilter] = useState<string>('TODOS');

  // Filtros de Plano de Contas
  const [accountSearch, setAccountSearch] = useState<string>('');
  const [accountCategoryFilter, setAccountCategoryFilter] = useState<string>('TODAS');
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('TODOS');

  // Filtros de Centros de Custo
  const [costCenterSearch, setCostCenterSearch] = useState<string>('');

  // Modal de Parceiro (Criação e Edição)
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState<boolean>(false);
  const [editingPartner, setEditingPartner] = useState<BusinessPartner | null>(null);
  const [partnerForm, setPartnerForm] = useState<{
    personType: PersonType;
    document: string;
    roles: BusinessPartnerRole[];
    name: string;
    tradeName: string;
    stateRegistration: string;
    municipalRegistration: string;
    email: string;
    phone: string;
    creditLimit: number;
    paymentTermsDays: number;
    status: PartnerStatus;
    notes: string;
    address: {
      zipCode: string;
      street: string;
      number: string;
      complement: string;
      neighborhood: string;
      city: string;
      state: string;
      ibgeCode: string;
    };
  }>({
    personType: 'PJ',
    document: '',
    roles: ['CLIENTE'],
    name: '',
    tradeName: '',
    stateRegistration: '',
    municipalRegistration: '',
    email: '',
    phone: '',
    creditLimit: 25000,
    paymentTermsDays: 30,
    status: 'ATIVO',
    notes: '',
    address: {
      zipCode: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: 'São Paulo',
      state: 'SP',
      ibgeCode: '',
    },
  });

  // Modal de Detalhes de Parceiro
  const [viewingPartner, setViewingPartner] = useState<BusinessPartner | null>(null);

  // Modal de Conta Contábil
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);
  const [accountForm, setAccountForm] = useState<{
    code: string;
    name: string;
    category: AccountCategory;
    type: AccountType;
    nature: AccountNature;
    level: number;
    parentId?: string;
    status: 'ATIVO' | 'INATIVO';
  }>({
    code: '',
    name: '',
    category: 'ATIVO',
    type: 'ANALITICA',
    nature: 'DEVEDORA',
    level: 4,
    parentId: '',
    status: 'ATIVO',
  });

  // Modal de Centro de Custo
  const [isCostCenterModalOpen, setIsCostCenterModalOpen] = useState<boolean>(false);
  const [editingCostCenter, setEditingCostCenter] = useState<CostCenter | null>(null);
  const [costCenterForm, setCostCenterForm] = useState<{
    code: string;
    name: string;
    responsible: string;
    status: 'ATIVO' | 'INATIVO';
  }>({
    code: '',
    name: '',
    responsible: '',
    status: 'ATIVO',
  });

  // Validador Fiscal Interativo (Sub-aba 4)
  const [testDocType, setTestDocType] = useState<'PF' | 'PJ'>('PJ');
  const [testDocInput, setTestDocInput] = useState<string>('33.000.167/0001-01');
  const [backendVerificationResult, setBackendVerificationResult] = useState<{
    tested: boolean;
    valid?: boolean;
    formatted?: string;
    message?: string;
  }>({ tested: false });

  // Notificação temporária
  const showSuccess = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };
  const showError = (msg: string) => {
    setActionErrorMessage(msg);
    setTimeout(() => setActionErrorMessage(null), 5000);
  };

  // Carga inicial
  const loadMasterData = async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      const [partnersRes, accountsRes, ccRes] = await Promise.all([
        apiFetch<BusinessPartner[]>('/api/v1/companies/active/partners'),
        apiFetch<ChartOfAccount[]>('/api/v1/companies/active/chart-of-accounts'),
        apiFetch<CostCenter[]>('/api/v1/companies/active/cost-centers'),
      ]);

      if (partnersRes.success && partnersRes.data) {
        setPartners(partnersRes.data);
      }
      if (accountsRes.success && accountsRes.data) {
        setAccounts(accountsRes.data);
      }
      if (ccRes.success && ccRes.data) {
        setCostCenters(ccRes.data);
      }
    } catch (err: unknown) {
      console.error('Erro ao carregar cadastros centrais:', err);
      showError('Falha na comunicação com o servidor para carga dos cadastros.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, [activeCompany?.id]);

  // Validação em tempo real do documento no formulário de parceiro
  const docValidation = useMemo(() => {
    return validateFiscalDocument(partnerForm.personType, partnerForm.document);
  }, [partnerForm.personType, partnerForm.document]);

  // Cálculos para o Validador Fiscal Interativo
  const validatorAnalysis = useMemo(() => {
    const raw = cleanDocument(testDocInput);
    if (testDocType === 'PF') {
      const lengthOk = raw.length === 11;
      const isRepeated = /^(\d)\1{10}$/.test(raw);

      let sum1 = 0;
      for (let i = 0; i < 9 && i < raw.length; i++) {
        sum1 += parseInt(raw.charAt(i), 10) * (10 - i);
      }
      const rest1 = 11 - (sum1 % 11);
      const expectedDigit1 = rest1 >= 10 ? 0 : rest1;

      let sum2 = 0;
      for (let i = 0; i < 10 && i < raw.length; i++) {
        sum2 += parseInt(raw.charAt(i), 10) * (11 - i);
      }
      const rest2 = 11 - (sum2 % 11);
      const expectedDigit2 = rest2 >= 10 ? 0 : rest2;

      const isValid = validateCPF(raw);

      return {
        raw,
        lengthOk,
        isRepeated,
        expectedLength: 11,
        sum1,
        expectedDigit1,
        actualDigit1: raw.charAt(9) ? parseInt(raw.charAt(9), 10) : null,
        sum2,
        expectedDigit2,
        actualDigit2: raw.charAt(10) ? parseInt(raw.charAt(10), 10) : null,
        isValid,
        formatted: formatDocument(raw),
      };
    } else {
      const lengthOk = raw.length === 14;
      const isRepeated = /^(\d)\1{13}$/.test(raw);

      const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      let sum1 = 0;
      for (let i = 0; i < 12 && i < raw.length; i++) {
        sum1 += parseInt(raw.charAt(i), 10) * weights1[i];
      }
      const rest1 = sum1 % 11;
      const expectedDigit1 = rest1 < 2 ? 0 : 11 - rest1;

      const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      let sum2 = 0;
      for (let i = 0; i < 13 && i < raw.length; i++) {
        sum2 += parseInt(raw.charAt(i), 10) * weights2[i];
      }
      const rest2 = sum2 % 11;
      const expectedDigit2 = rest2 < 2 ? 0 : 11 - rest2;

      const isValid = validateCNPJ(raw);

      return {
        raw,
        lengthOk,
        isRepeated,
        expectedLength: 14,
        sum1,
        expectedDigit1,
        actualDigit1: raw.charAt(12) ? parseInt(raw.charAt(12), 10) : null,
        sum2,
        expectedDigit2,
        actualDigit2: raw.charAt(13) ? parseInt(raw.charAt(13), 10) : null,
        isValid,
        formatted: formatDocument(raw),
      };
    }
  }, [testDocType, testDocInput]);

  // Ação de validação via API do backend
  const handleVerifyBackendDocument = async () => {
    try {
      const res = await apiFetch<{
        isValid: boolean;
        formattedDocument: string;
        document: string;
        personType: string;
        message?: string;
      }>('/api/v1/companies/active/partners/validate-document', {
        method: 'POST',
        body: JSON.stringify({
          type: testDocType,
          document: testDocInput,
        }),
      });

      if (res.success && res.data) {
        setBackendVerificationResult({
          tested: true,
          valid: res.data.isValid,
          formatted: res.data.formattedDocument,
          message: res.data.isValid
            ? 'Homologado com sucesso pelo serviço fiscal da API!'
            : res.data.message || 'Rejeitado pela API conforme regras da RFB.',
        });
      } else {
        setBackendVerificationResult({
          tested: true,
          valid: false,
          message: res.error?.message || 'Falha na validação',
        });
      }
    } catch {
      setBackendVerificationResult({
        tested: true,
        valid: false,
        message: 'Erro na chamada de validação do servidor.',
      });
    }
  };

  // --- FILTROS DE PARCEIROS ---
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      const matchesSearch =
        partnerSearch.trim() === '' ||
        p.name.toLowerCase().includes(partnerSearch.toLowerCase()) ||
        (p.tradeName && p.tradeName.toLowerCase().includes(partnerSearch.toLowerCase())) ||
        p.document.includes(cleanDocument(partnerSearch)) ||
        p.email.toLowerCase().includes(partnerSearch.toLowerCase());

      const matchesRole =
        partnerRoleFilter === 'TODOS' ||
        p.roles.includes(partnerRoleFilter as BusinessPartnerRole);

      const matchesStatus =
        partnerStatusFilter === 'TODOS' || p.status === partnerStatusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [partners, partnerSearch, partnerRoleFilter, partnerStatusFilter]);

  // Estatísticas de Parceiros
  const partnerStats = useMemo(() => {
    const total = partners.length;
    const clientes = partners.filter((p) => p.roles.includes('CLIENTE')).length;
    const fornecedores = partners.filter((p) => p.roles.includes('FORNECEDOR')).length;
    const totalCredito = partners.reduce((acc, p) => acc + (p.creditLimit || 0), 0);
    return { total, clientes, fornecedores, totalCredito };
  }, [partners]);

  // --- FILTROS DE PLANO DE CONTAS ---
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const matchesSearch =
        accountSearch.trim() === '' ||
        a.code.toLowerCase().includes(accountSearch.toLowerCase()) ||
        a.name.toLowerCase().includes(accountSearch.toLowerCase());

      const matchesCategory =
        accountCategoryFilter === 'TODAS' || a.category === accountCategoryFilter;

      const matchesType =
        accountTypeFilter === 'TODOS' || a.type === accountTypeFilter;

      return matchesSearch && matchesCategory && matchesType;
    });
  }, [accounts, accountSearch, accountCategoryFilter, accountTypeFilter]);

  // Estatísticas do Plano de Contas
  const accountStats = useMemo(() => {
    const total = accounts.length;
    const sinteticas = accounts.filter((a) => a.type === 'SINTETICA').length;
    const analiticas = accounts.filter((a) => a.type === 'ANALITICA').length;
    const ativas = accounts.filter((a) => a.status === 'ATIVO').length;
    return { total, sinteticas, analiticas, ativas };
  }, [accounts]);

  // --- FILTROS DE CENTROS DE CUSTO ---
  const filteredCostCenters = useMemo(() => {
    return costCenters.filter((c) => {
      return (
        costCenterSearch.trim() === '' ||
        c.code.toLowerCase().includes(costCenterSearch.toLowerCase()) ||
        c.name.toLowerCase().includes(costCenterSearch.toLowerCase()) ||
        c.responsible.toLowerCase().includes(costCenterSearch.toLowerCase())
      );
    });
  }, [costCenters, costCenterSearch]);

  // --- OPERAÇÕES CRUD DE PARCEIROS ---

  const handleOpenNewPartner = () => {
    setEditingPartner(null);
    setPartnerForm({
      personType: 'PJ',
      document: '',
      roles: ['CLIENTE'],
      name: '',
      tradeName: '',
      stateRegistration: '',
      municipalRegistration: '',
      email: '',
      phone: '',
      creditLimit: 50000,
      paymentTermsDays: 30,
      status: 'ATIVO',
      notes: '',
      address: {
        zipCode: '01310-100',
        street: 'Avenida Paulista',
        number: '1000',
        complement: 'Andar 15',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        ibgeCode: '3550308',
      },
    });
    setIsPartnerModalOpen(true);
  };

  const handleOpenEditPartner = (p: BusinessPartner) => {
    setEditingPartner(p);
    setPartnerForm({
      personType: p.personType,
      document: p.formattedDocument || p.document,
      roles: [...p.roles],
      name: p.name,
      tradeName: p.tradeName || '',
      stateRegistration: p.stateRegistration || '',
      municipalRegistration: p.municipalRegistration || '',
      email: p.email,
      phone: p.phone,
      creditLimit: p.creditLimit || 0,
      paymentTermsDays: p.paymentTermsDays || 30,
      status: p.status,
      notes: p.notes || '',
      address: {
        zipCode: p.address?.zipCode || '',
        street: p.address?.street || '',
        number: p.address?.number || '',
        complement: p.address?.complement || '',
        neighborhood: p.address?.neighborhood || '',
        city: p.address?.city || '',
        state: p.address?.state || '',
        ibgeCode: p.address?.ibgeCode || '',
      },
    });
    setIsPartnerModalOpen(true);
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docValidation.isValid) {
      showError(docValidation.message || 'Documento fiscal inválido.');
      return;
    }
    if (!partnerForm.name.trim()) {
      showError('A Razão Social / Nome Completo é obrigatória.');
      return;
    }

    try {
      if (editingPartner) {
        const res = await apiFetch<BusinessPartner>(
          `/api/v1/companies/active/partners/${editingPartner.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(partnerForm),
          }
        );
        if (res.success && res.data) {
          setPartners((prev) =>
            prev.map((item) => (item.id === editingPartner.id ? res.data! : item))
          );
          showSuccess(`Parceiro ${res.data.name} atualizado com sucesso!`);
          setIsPartnerModalOpen(false);
        } else {
          showError(res.error?.message || 'Falha ao atualizar parceiro.');
        }
      } else {
        const res = await apiFetch<BusinessPartner>('/api/v1/companies/active/partners', {
          method: 'POST',
          body: JSON.stringify(partnerForm),
        });
        if (res.success && res.data) {
          setPartners((prev) => [res.data!, ...prev]);
          showSuccess(`Parceiro ${res.data.name} cadastrado com sucesso!`);
          setIsPartnerModalOpen(false);
        } else {
          showError(res.error?.message || 'Falha ao cadastrar parceiro.');
        }
      }
    } catch {
      showError('Erro ao comunicar com o servidor.');
    }
  };

  const handleDeletePartner = async (partnerId: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o parceiro "${name}"?`)) return;

    try {
      const res = await apiFetch<{ id: string; deleted: boolean }>(
        `/api/v1/companies/active/partners/${partnerId}`,
        { method: 'DELETE' }
      );
      if (res.success) {
        setPartners((prev) => prev.filter((p) => p.id !== partnerId));
        showSuccess(`Parceiro ${name} removido com sucesso.`);
      } else {
        showError(res.error?.message || 'Erro ao excluir parceiro.');
      }
    } catch {
      showError('Erro ao comunicar com o servidor.');
    }
  };

  // --- OPERAÇÕES CRUD DE PLANO DE CONTAS ---

  const handleOpenNewAccount = () => {
    setEditingAccount(null);
    setAccountForm({
      code: '',
      name: '',
      category: 'RECEITA',
      type: 'ANALITICA',
      nature: 'CREDORA',
      level: 4,
      parentId: accounts.find((a) => a.type === 'SINTETICA')?.id || '',
      status: 'ATIVO',
    });
    setIsAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc: ChartOfAccount) => {
    setEditingAccount(acc);
    setAccountForm({
      code: acc.code,
      name: acc.name,
      category: acc.category,
      type: acc.type,
      nature: acc.nature,
      level: acc.level,
      parentId: acc.parentId || '',
      status: acc.status,
    });
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.code.trim() || !accountForm.name.trim()) {
      showError('Código e Descrição da Conta são obrigatórios.');
      return;
    }

    try {
      if (editingAccount) {
        const res = await apiFetch<ChartOfAccount>(
          `/api/v1/companies/active/chart-of-accounts/${editingAccount.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(accountForm),
          }
        );
        if (res.success && res.data) {
          setAccounts((prev) =>
            prev.map((item) => (item.id === editingAccount.id ? res.data! : item))
          );
          showSuccess(`Conta ${res.data.code} - ${res.data.name} atualizada!`);
          setIsAccountModalOpen(false);
        } else {
          showError(res.error?.message || 'Falha ao atualizar conta.');
        }
      } else {
        const res = await apiFetch<ChartOfAccount>(
          '/api/v1/companies/active/chart-of-accounts',
          {
            method: 'POST',
            body: JSON.stringify(accountForm),
          }
        );
        if (res.success && res.data) {
          setAccounts((prev) =>
            [...prev, res.data!].sort((a, b) =>
              a.code.localeCompare(b.code, undefined, { numeric: true })
            )
          );
          showSuccess(`Conta ${res.data.code} cadastrada com sucesso!`);
          setIsAccountModalOpen(false);
        } else {
          showError(res.error?.message || 'Falha ao cadastrar conta contábil.');
        }
      }
    } catch {
      showError('Erro ao comunicar com o servidor.');
    }
  };

  const handleDeleteAccount = async (accountId: string, code: string, name: string) => {
    if (!window.confirm(`Deseja remover a conta contábil "${code} - ${name}"?`)) return;

    try {
      const res = await apiFetch<{ id: string; deleted: boolean }>(
        `/api/v1/companies/active/chart-of-accounts/${accountId}`,
        { method: 'DELETE' }
      );
      if (res.success) {
        setAccounts((prev) => prev.filter((a) => a.id !== accountId));
        showSuccess(`Conta contábil ${code} removida.`);
      } else {
        showError(res.error?.message || 'Erro ao excluir conta.');
      }
    } catch {
      showError('Erro ao comunicar com o servidor.');
    }
  };

  // --- OPERAÇÕES CRUD DE CENTROS DE CUSTO ---

  const handleOpenNewCostCenter = () => {
    setEditingCostCenter(null);
    setCostCenterForm({
      code: '',
      name: '',
      responsible: '',
      status: 'ATIVO',
    });
    setIsCostCenterModalOpen(true);
  };

  const handleOpenEditCostCenter = (cc: CostCenter) => {
    setEditingCostCenter(cc);
    setCostCenterForm({
      code: cc.code,
      name: cc.name,
      responsible: cc.responsible,
      status: cc.status,
    });
    setIsCostCenterModalOpen(true);
  };

  const handleSaveCostCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !costCenterForm.code.trim() ||
      !costCenterForm.name.trim() ||
      !costCenterForm.responsible.trim()
    ) {
      showError('Código, Nome e Responsável são obrigatórios.');
      return;
    }

    try {
      if (editingCostCenter) {
        const res = await apiFetch<CostCenter>(
          `/api/v1/companies/active/cost-centers/${editingCostCenter.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(costCenterForm),
          }
        );
        if (res.success && res.data) {
          setCostCenters((prev) =>
            prev.map((item) => (item.id === editingCostCenter.id ? res.data! : item))
          );
          showSuccess(`Centro de Custo ${res.data.name} atualizado com sucesso!`);
          setIsCostCenterModalOpen(false);
        } else {
          showError(res.error?.message || 'Falha ao atualizar centro de custo.');
        }
      } else {
        const res = await apiFetch<CostCenter>('/api/v1/companies/active/cost-centers', {
          method: 'POST',
          body: JSON.stringify(costCenterForm),
        });
        if (res.success && res.data) {
          setCostCenters((prev) =>
            [...prev, res.data!].sort((a, b) =>
              a.code.localeCompare(b.code, undefined, { numeric: true })
            )
          );
          showSuccess(`Centro de Custo ${res.data.name} criado com sucesso!`);
          setIsCostCenterModalOpen(false);
        } else {
          showError(res.error?.message || 'Falha ao criar centro de custo.');
        }
      }
    } catch {
      showError('Erro ao comunicar com o servidor.');
    }
  };

  const handleDeleteCostCenter = async (ccId: string, name: string) => {
    if (!window.confirm(`Deseja remover o centro de custo "${name}"?`)) return;

    try {
      const res = await apiFetch<{ id: string; deleted: boolean }>(
        `/api/v1/companies/active/cost-centers/${ccId}`,
        { method: 'DELETE' }
      );
      if (res.success) {
        setCostCenters((prev) => prev.filter((c) => c.id !== ccId));
        showSuccess(`Centro de custo ${name} excluído.`);
      } else {
        showError(res.error?.message || 'Erro ao excluir centro de custo.');
      }
    } catch {
      showError('Erro ao comunicar com o servidor.');
    }
  };

  // Cores de badges para papéis
  const getRoleBadge = (role: BusinessPartnerRole) => {
    switch (role) {
      case 'CLIENTE':
        return 'bg-blue-950/80 text-blue-400 border-blue-800/80';
      case 'FORNECEDOR':
        return 'bg-purple-950/80 text-purple-400 border-purple-800/80';
      case 'TRANSPORTADORA':
        return 'bg-amber-950/80 text-amber-400 border-amber-800/80';
      case 'COLABORADOR':
        return 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80';
      case 'PARCEIRO':
        return 'bg-cyan-950/80 text-cyan-400 border-cyan-800/80';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  // Cores de categorias contábeis
  const getCategoryColor = (cat: AccountCategory) => {
    switch (cat) {
      case 'ATIVO':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-800/70';
      case 'PASSIVO':
        return 'bg-amber-950/70 text-amber-300 border-amber-800/70';
      case 'PATRIMONIO_LIQUIDO':
        return 'bg-purple-950/70 text-purple-300 border-purple-800/70';
      case 'RECEITA':
        return 'bg-cyan-950/70 text-cyan-300 border-cyan-800/70';
      case 'DESPESA':
        return 'bg-rose-950/70 text-rose-300 border-rose-800/70';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Alertas Flutuantes de Notificação */}
      {actionSuccessMessage && (
        <div className="flex items-center gap-2 p-3 bg-emerald-950 border border-emerald-800 text-emerald-200 rounded-xl text-xs shadow-lg animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}
      {actionErrorMessage && (
        <div className="flex items-center gap-2 p-3 bg-rose-950 border border-rose-800 text-rose-200 rounded-xl text-xs shadow-lg animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionErrorMessage}</span>
        </div>
      )}

      {/* Header do Módulo PRD 03 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-950/90 border border-indigo-700/60 text-indigo-400 shadow-sm">
              <FolderTree className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Cadastros Centrais & Estrutura Financeira
                <span className="rounded bg-indigo-950 border border-indigo-800/70 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                  PRD 03
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Parceiros de Negócio (Clientes e Fornecedores), Plano de Contas Hierárquico e Centros de Custo
              </p>
            </div>
          </div>
        </div>

        {/* Badge Contextual do Tenant Ativo */}
        {activeCompany && (
          <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 text-xs">
            <Building2 className="h-4 w-4 text-indigo-400 shrink-0" />
            <div>
              <div className="font-semibold text-slate-200">{activeCompany.tradeName}</div>
              <div className="text-[11px] text-slate-400 font-mono">
                CNPJ: {activeCompany.cnpj} • <span className="text-indigo-400">{activeSchema}</span>
              </div>
            </div>
            <button
              onClick={loadMasterData}
              disabled={isLoading}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Atualizar Dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Barra de Navegação das 4 Sub-Abas do PRD 03 */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setCurrentSubTab('partners')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
            currentSubTab === 'partners'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Parceiros Comerciais
          <span className="ml-1 rounded-full bg-slate-900/60 px-1.5 py-0.2 text-[10px]">
            {partners.length}
          </span>
        </button>

        <button
          onClick={() => setCurrentSubTab('chart')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
            currentSubTab === 'chart'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          Plano de Contas Contábil
          <span className="ml-1 rounded-full bg-slate-900/60 px-1.5 py-0.2 text-[10px]">
            {accounts.length}
          </span>
        </button>

        <button
          onClick={() => setCurrentSubTab('costCenters')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
            currentSubTab === 'costCenters'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Centros de Custo
          <span className="ml-1 rounded-full bg-slate-900/60 px-1.5 py-0.2 text-[10px]">
            {costCenters.length}
          </span>
        </button>

        <button
          onClick={() => setCurrentSubTab('validator')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
            currentSubTab === 'validator'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-emerald-400" />
          Auditor Fiscal da Receita Federal
          <span className="ml-1 rounded bg-emerald-950 border border-emerald-800 text-[9px] px-1 text-emerald-300 font-mono">
            Módulo 11
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-ABA 1: PARCEIROS DE NEGÓCIO (CLIENTES & FORNECEDORES)                 */}
      {/* ========================================================================= */}
      {currentSubTab === 'partners' && (
        <div className="space-y-5">
          {/* Métricas e KPIs de Parceiros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Total de Parceiros</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white">{partnerStats.total}</div>
              <p className="text-[11px] text-slate-500 mt-1">Isolados no schema {activeSchema}</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Clientes Homologados</span>
                <Building2 className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400">{partnerStats.clientes}</div>
              <p className="text-[11px] text-slate-500 mt-1">Elegíveis para faturamento e vendas</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Fornecedores Ativos</span>
                <Briefcase className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-purple-400">{partnerStats.fornecedores}</div>
              <p className="text-[11px] text-slate-500 mt-1">Cadastrados para Contas a Pagar</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Limite Total de Crédito</span>
                <CreditCard className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-emerald-400">
                R$ {partnerStats.totalCredito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Exposição de risco comercial</p>
            </div>
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por Razão Social, Nome Fantasia, CNPJ/CPF ou email..."
                  value={partnerSearch}
                  onChange={(e) => setPartnerSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={partnerRoleFilter}
                onChange={(e) => setPartnerRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="TODOS">Todos os Papéis</option>
                <option value="CLIENTE">Clientes</option>
                <option value="FORNECEDOR">Fornecedores</option>
                <option value="TRANSPORTADORA">Transportadoras</option>
                <option value="COLABORADOR">Colaboradores</option>
              </select>

              <select
                value={partnerStatusFilter}
                onChange={(e) => setPartnerStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="BLOQUEADO">Bloqueado</option>
              </select>
            </div>

            <button
              onClick={handleOpenNewPartner}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition shadow-sm w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              Novo Parceiro
            </button>
          </div>

          {/* Tabela de Parceiros */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Parceiro / Razão Social</th>
                    <th className="py-3 px-4">Documento Fiscal</th>
                    <th className="py-3 px-4">Papéis</th>
                    <th className="py-3 px-4">Contato & Localização</th>
                    <th className="py-3 px-4">Limite de Crédito</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredPartners.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Nenhum parceiro encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filteredPartners.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{p.name}</div>
                          {p.tradeName && (
                            <div className="text-[11px] text-slate-400">{p.tradeName}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="font-semibold text-slate-200">
                              {p.formattedDocument || p.document}
                            </span>
                            <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[9px] font-bold text-slate-400">
                              {p.personType}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {p.roles.map((role) => (
                              <span
                                key={role}
                                className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${getRoleBadge(
                                  role
                                )}`}
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 text-slate-300">
                            <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate max-w-[150px]">{p.email}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>
                              {p.address?.city || 'São Paulo'} - {p.address?.state || 'SP'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono text-emerald-400 font-semibold">
                            R${' '}
                            {(p.creditLimit || 0).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Prazo: {p.paymentTermsDays || 30} dias
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              p.status === 'ATIVO'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : p.status === 'BLOQUEADO'
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                p.status === 'ATIVO'
                                  ? 'bg-emerald-400'
                                  : p.status === 'BLOQUEADO'
                                  ? 'bg-rose-400'
                                  : 'bg-slate-400'
                              }`}
                            />
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewingPartner(p)}
                              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                              title="Visualizar Ficha Completa"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEditPartner(p)}
                              className="p-1.5 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-800 transition"
                              title="Editar Parceiro"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePartner(p.id, p.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition"
                              title="Remover Parceiro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* ========================================================================= */}
      {/* SUB-ABA 2: PLANO DE CONTAS HIERÁRQUICO (MULTINÍVEL SINTÉTICO / ANALÍTICO) */}
      {/* ========================================================================= */}
      {currentSubTab === 'chart' && (
        <div className="space-y-5">
          {/* Métricas do Plano de Contas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Total de Contas</span>
                <Layers className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white">{accountStats.total}</div>
              <p className="text-[11px] text-slate-500 mt-1">Estrutura contábil oficial</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Contas Sintéticas</span>
                <Folder className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400">{accountStats.sinteticas}</div>
              <p className="text-[11px] text-slate-500 mt-1">Grupos totalizadores</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Contas Analíticas</span>
                <FileText className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-cyan-400">{accountStats.analiticas}</div>
              <p className="text-[11px] text-slate-500 mt-1">Recebem lançamentos do ERP</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Contas Ativas</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">{accountStats.ativas}</div>
              <p className="text-[11px] text-slate-500 mt-1">Disponíveis para DRE e Tesouraria</p>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por código estruturado (ex: 1.1.1) ou nome da conta..."
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={accountCategoryFilter}
                onChange={(e) => setAccountCategoryFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="TODAS">Todas as Categorias</option>
                <option value="ATIVO">1 - Ativo</option>
                <option value="PASSIVO">2 - Passivo</option>
                <option value="PATRIMONIO_LIQUIDO">3 - Patrimônio Líquido</option>
                <option value="RECEITA">4 - Receitas</option>
                <option value="DESPESA">5 - Despesas / Custos</option>
              </select>

              <select
                value={accountTypeFilter}
                onChange={(e) => setAccountTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="TODOS">Todos os Tipos</option>
                <option value="SINTETICA">Sintéticas (Grupos)</option>
                <option value="ANALITICA">Analíticas (Lançamento)</option>
              </select>
            </div>

            <button
              onClick={handleOpenNewAccount}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition shadow-sm w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              Nova Conta Contábil
            </button>
          </div>

          {/* Tabela do Plano de Contas */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Código & Descrição da Conta</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Natureza</th>
                    <th className="py-3 px-4">Nível</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Nenhuma conta contábil encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc) => {
                      const paddingLevel = (acc.level - 1) * 20;
                      return (
                        <tr
                          key={acc.id}
                          className={`hover:bg-slate-800/40 transition ${
                            acc.type === 'SINTETICA' ? 'bg-slate-900/40 font-semibold' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div
                              className="flex items-center gap-2"
                              style={{ paddingLeft: `${paddingLevel}px` }}
                            >
                              {acc.type === 'SINTETICA' ? (
                                <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                              )}
                              <span className="font-mono text-indigo-300 mr-1">{acc.code}</span>
                              <span
                                className={
                                  acc.type === 'SINTETICA'
                                    ? 'text-white uppercase font-bold'
                                    : 'text-slate-200'
                                }
                              >
                                {acc.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${getCategoryColor(
                                acc.category
                              )}`}
                            >
                              {acc.category}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-300">
                              {acc.type === 'SINTETICA' ? 'Sintética (Grupo)' : 'Analítica'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-mono text-[11px] font-semibold ${
                                acc.nature === 'DEVEDORA' ? 'text-amber-400' : 'text-cyan-400'
                              }`}
                            >
                              {acc.nature}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 font-mono">
                              Nível {acc.level}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                acc.status === 'ATIVO'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {acc.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditAccount(acc)}
                                className="p-1.5 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-800 transition"
                                title="Editar Conta"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteAccount(acc.id, acc.code, acc.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition"
                                title="Remover Conta"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 3: CENTROS DE CUSTO (UNIDADES OPERACIONAIS E GERENCIAIS)          */}
      {/* ========================================================================= */}
      {currentSubTab === 'costCenters' && (
        <div className="space-y-5">
          {/* Header e Busca de Centros de Custo */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por código, nome da área ou responsável..."
                value={costCenterSearch}
                onChange={(e) => setCostCenterSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleOpenNewCostCenter}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition shadow-sm w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              Novo Centro de Custo
            </button>
          </div>

          {/* Grid de Centros de Custo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCostCenters.map((cc) => (
              <div
                key={cc.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-4.5 space-y-3 hover:border-indigo-600/50 transition group shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800/80">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-mono text-xs font-bold text-indigo-400">
                        {cc.code}
                      </span>
                      <h3 className="font-semibold text-white text-sm leading-tight">
                        {cc.name}
                      </h3>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      cc.status === 'ATIVO'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {cc.status}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Gestor Responsável:</span>
                    <span className="text-slate-200 font-medium">{cc.responsible}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditCostCenter(cc)}
                      className="p-1.5 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-800 transition"
                      title="Editar Centro de Custo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCostCenter(cc.id, cc.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition"
                      title="Excluir Centro de Custo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 4: VALIDADOR FISCAL INTERATIVO (MÓDULO 11 DA RECEITA FEDERAL)     */}
      {/* ========================================================================= */}
      {currentSubTab === 'validator' && (
        <div className="space-y-6">
          {/* Card Explicativo da Tecnologia e Legislação */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">
                Auditoria e Validação de Documentos Fiscais Brasileiros (Módulo 11)
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              O <strong>Enlace ERP</strong> implementa o algoritmo oficial de cálculo e
              conferência de dígitos verificadores da <strong>Receita Federal do Brasil (RFB)</strong>.
              Este motor garante integridade cadastral rigorosa, impedindo persistência de CPFs/CNPJs
              fictícios, sequências numéricas repetidas (ex: 111.111.111-11) e fraudes cadastrais
              em transações comerciais e emissão de notas.
            </p>
          </div>

          {/* Painel Interativo de Teste de Documento */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lado Esquerdo: Inputs e Controles */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Simulador Interativo em Tempo Real
              </h3>

              {/* Seletor de Tipo de Documento */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTestDocType('PJ');
                    setTestDocInput(generateTestCNPJ());
                    setBackendVerificationResult({ tested: false });
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition border ${
                    testDocType === 'PJ'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Pessoa Jurídica (CNPJ - 14 dígitos)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTestDocType('PF');
                    setTestDocInput(generateTestCPF());
                    setBackendVerificationResult({ tested: false });
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition border ${
                    testDocType === 'PF'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Pessoa Física (CPF - 11 dígitos)
                </button>
              </div>

              {/* Input do Documento */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Documento para Análise Fiscal:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={testDocInput}
                    onChange={(e) => {
                      setTestDocInput(e.target.value);
                      setBackendVerificationResult({ tested: false });
                    }}
                    placeholder={testDocType === 'PF' ? '000.000.000-00' : '00.000.000/0001-00'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="absolute right-3 top-2.5">
                    {validatorAnalysis.isValid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Botões Rápidos de Homologação */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-[11px] text-slate-400 font-medium block">
                  Geradores de Teste para Auditoria e Demonstração:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTestDocType('PJ');
                      setTestDocInput(generateTestCNPJ());
                      setBackendVerificationResult({ tested: false });
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs px-2.5 py-1.5 rounded-lg transition"
                  >
                    + Gerar CNPJ Válido
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTestDocType('PF');
                      setTestDocInput(generateTestCPF());
                      setBackendVerificationResult({ tested: false });
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs px-2.5 py-1.5 rounded-lg transition"
                  >
                    + Gerar CPF Válido
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTestDocType('PF');
                      setTestDocInput('111.111.111-11');
                      setBackendVerificationResult({ tested: false });
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs px-2.5 py-1.5 rounded-lg transition"
                  >
                    Inserir CPF Inválido (Repetido)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTestDocType('PJ');
                      setTestDocInput('33.000.167/0001-99');
                      setBackendVerificationResult({ tested: false });
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs px-2.5 py-1.5 rounded-lg transition"
                  >
                    Inserir CNPJ Inválido (Dígito Adulterado)
                  </button>
                </div>
              </div>

              {/* Validação Cruzada com o Backend */}
              <div className="pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleVerifyBackendDocument}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-800/60 font-semibold text-xs py-2 rounded-lg transition"
                >
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  Submeter à Validação da API do Servidor (Express)
                </button>

                {backendVerificationResult.tested && (
                  <div
                    className={`mt-2.5 p-2.5 rounded-lg text-xs border ${
                      backendVerificationResult.valid
                        ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/70 border-rose-800 text-rose-300'
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      {backendVerificationResult.valid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                      Resultado da API: {backendVerificationResult.valid ? 'APROVADO' : 'REJEITADO'}
                    </div>
                    <div className="mt-1 text-[11px] opacity-90">
                      {backendVerificationResult.message}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lado Direito: Diagnóstico Passo a Passo do Módulo 11 */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-indigo-400" />
                Diagnóstico Algorítmico do Módulo 11
              </h3>

              <div className="space-y-3 text-xs">
                {/* Status Geral */}
                <div
                  className={`p-3 rounded-lg border flex items-center justify-between ${
                    validatorAnalysis.isValid
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-800 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {validatorAnalysis.isValid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-400" />
                    )}
                    <div>
                      <span className="font-bold block">
                        {validatorAnalysis.isValid
                          ? 'DOCUMENTO AUTÊNTICO E VÁLIDO'
                          : 'DOCUMENTO FISCAL INVÁLIDO'}
                      </span>
                      <span className="text-[11px] opacity-80">
                        {validatorAnalysis.isValid
                          ? 'Dígitos verificadores e formato aprovados pela RFB.'
                          : validatorAnalysis.isRepeated
                          ? 'Rejeitado: Sequência numérica repetida espúria.'
                          : !validatorAnalysis.lengthOk
                          ? `Comprimento incorreto: possui ${validatorAnalysis.raw.length} dígitos (esperado: ${validatorAnalysis.expectedLength}).`
                          : 'Rejeitado: Dígitos verificadores informados não conferem com o cálculo do Módulo 11.'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Passo 1: Normalização de Dígitos */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-1">
                  <span className="text-slate-400 font-medium">
                    1. Normalização e Verificação de Sequências:
                  </span>
                  <div className="font-mono text-slate-200">
                    Dígitos brutos: <span className="text-indigo-400">{validatorAnalysis.raw || '(vazio)'}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Máscara oficial gerada: <span className="font-mono text-white">{validatorAnalysis.formatted}</span>
                  </div>
                </div>

                {/* Passo 2: Primeiro Dígito Verificador */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-1 font-mono">
                  <span className="text-slate-400 font-sans font-medium block">
                    2. Cálculo do 1º Dígito Verificador:
                  </span>
                  <div className="text-slate-300">
                    Somatório ponderado: <span className="text-indigo-300">{validatorAnalysis.sum1}</span>
                  </div>
                  <div className="text-slate-300">
                    Dígito esperado: <span className="text-emerald-400 font-bold">{validatorAnalysis.expectedDigit1}</span> |
                    Dígito no documento: <span className={validatorAnalysis.actualDigit1 === validatorAnalysis.expectedDigit1 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {validatorAnalysis.actualDigit1 !== null ? validatorAnalysis.actualDigit1 : '-'}
                    </span>
                  </div>
                </div>

                {/* Passo 3: Segundo Dígito Verificador */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-1 font-mono">
                  <span className="text-slate-400 font-sans font-medium block">
                    3. Cálculo do 2º Dígito Verificador:
                  </span>
                  <div className="text-slate-300">
                    Somatório ponderado: <span className="text-indigo-300">{validatorAnalysis.sum2}</span>
                  </div>
                  <div className="text-slate-300">
                    Dígito esperado: <span className="text-emerald-400 font-bold">{validatorAnalysis.expectedDigit2}</span> |
                    Dígito no documento: <span className={validatorAnalysis.actualDigit2 === validatorAnalysis.expectedDigit2 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {validatorAnalysis.actualDigit2 !== null ? validatorAnalysis.actualDigit2 : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRIAR / EDITAR PARCEIRO DE NEGÓCIO                                 */}
      {/* ========================================================================= */}
      {isPartnerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">
                  {editingPartner ? 'Editar Parceiro Comercial' : 'Novo Parceiro Comercial'}
                </h2>
              </div>
              <button
                onClick={() => setIsPartnerModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePartner} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Tipo de Pessoa e Documento Fiscal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tipo de Pessoa
                  </label>
                  <select
                    value={partnerForm.personType}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        personType: e.target.value as PersonType,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PJ">Pessoa Jurídica (PJ - CNPJ)</option>
                    <option value="PF">Pessoa Física (PF - CPF)</option>
                    <option value="ESTRANGEIRO">Estrangeiro (Tax ID)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      {partnerForm.personType === 'PF' ? 'CPF' : 'CNPJ'} *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const generated =
                          partnerForm.personType === 'PF'
                            ? generateTestCPF()
                            : generateTestCNPJ();
                        setPartnerForm({ ...partnerForm, document: generated });
                      }}
                      className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Gerar Válido
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={partnerForm.document}
                    onChange={(e) =>
                      setPartnerForm({ ...partnerForm, document: e.target.value })
                    }
                    placeholder={
                      partnerForm.personType === 'PF'
                        ? '000.000.000-00'
                        : '00.000.000/0001-00'
                    }
                    className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none ${
                      docValidation.isValid
                        ? 'border-emerald-700 focus:border-emerald-500'
                        : 'border-rose-800 focus:border-rose-500'
                    }`}
                  />
                  {!docValidation.isValid && partnerForm.document && (
                    <span className="text-[11px] text-rose-400 mt-1 block">
                      {docValidation.message}
                    </span>
                  )}
                  {docValidation.isValid && partnerForm.document && (
                    <span className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Documento homologado pela RFB
                    </span>
                  )}
                </div>
              </div>

              {/* Razão Social e Nome Fantasia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Razão Social / Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={partnerForm.name}
                    onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                    placeholder="Ex: Petrobras Distribuidora S/A"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome Fantasia / Apelido
                  </label>
                  <input
                    type="text"
                    value={partnerForm.tradeName}
                    onChange={(e) =>
                      setPartnerForm({ ...partnerForm, tradeName: e.target.value })
                    }
                    placeholder="Ex: Petrobras Matriz"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Papéis do Parceiro */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Papéis Atribuídos ao Parceiro (Marque todos que se aplicam):
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['CLIENTE', 'FORNECEDOR', 'TRANSPORTADORA', 'COLABORADOR', 'PARCEIRO'] as BusinessPartnerRole[]).map(
                    (role) => {
                      const isSelected = partnerForm.roles.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (partnerForm.roles.length > 1) {
                                setPartnerForm({
                                  ...partnerForm,
                                  roles: partnerForm.roles.filter((r) => r !== role),
                                });
                              }
                            } else {
                              setPartnerForm({
                                ...partnerForm,
                                roles: [...partnerForm.roles, role],
                              });
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {role}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Contato (Email e Telefone) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Corporativo
                  </label>
                  <input
                    type="email"
                    value={partnerForm.email}
                    onChange={(e) =>
                      setPartnerForm({ ...partnerForm, email: e.target.value })
                    }
                    placeholder="contato@empresa.com.br"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Telefone de Contato
                  </label>
                  <input
                    type="text"
                    value={partnerForm.phone}
                    onChange={(e) =>
                      setPartnerForm({ ...partnerForm, phone: e.target.value })
                    }
                    placeholder="(11) 3000-0000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Inscrições Tributárias */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Inscrição Estadual (IE)
                  </label>
                  <input
                    type="text"
                    value={partnerForm.stateRegistration}
                    onChange={(e) =>
                      setPartnerForm({ ...partnerForm, stateRegistration: e.target.value })
                    }
                    placeholder="Isento ou numeração SEFAZ"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Inscrição Municipal (IM)
                  </label>
                  <input
                    type="text"
                    value={partnerForm.municipalRegistration}
                    onChange={(e) =>
                      setPartnerForm({ ...partnerForm, municipalRegistration: e.target.value })
                    }
                    placeholder="Numeração Prefeitura"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" /> Endereço Fiscal
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">CEP</label>
                    <input
                      type="text"
                      value={partnerForm.address.zipCode}
                      onChange={(e) =>
                        setPartnerForm({
                          ...partnerForm,
                          address: { ...partnerForm.address, zipCode: e.target.value },
                        })
                      }
                      placeholder="00000-000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Logradouro</label>
                    <input
                      type="text"
                      value={partnerForm.address.street}
                      onChange={(e) =>
                        setPartnerForm({
                          ...partnerForm,
                          address: { ...partnerForm.address, street: e.target.value },
                        })
                      }
                      placeholder="Avenida / Rua"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Número</label>
                    <input
                      type="text"
                      value={partnerForm.address.number}
                      onChange={(e) =>
                        setPartnerForm({
                          ...partnerForm,
                          address: { ...partnerForm.address, number: e.target.value },
                        })
                      }
                      placeholder="1000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Bairro</label>
                    <input
                      type="text"
                      value={partnerForm.address.neighborhood}
                      onChange={(e) =>
                        setPartnerForm({
                          ...partnerForm,
                          address: { ...partnerForm.address, neighborhood: e.target.value },
                        })
                      }
                      placeholder="Centro"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={partnerForm.address.city}
                      onChange={(e) =>
                        setPartnerForm({
                          ...partnerForm,
                          address: { ...partnerForm.address, city: e.target.value },
                        })
                      }
                      placeholder="São Paulo"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">UF</label>
                    <input
                      type="text"
                      value={partnerForm.address.state}
                      maxLength={2}
                      onChange={(e) =>
                        setPartnerForm({
                          ...partnerForm,
                          address: {
                            ...partnerForm.address,
                            state: e.target.value.toUpperCase(),
                          },
                        })
                      }
                      placeholder="SP"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Condições Financeiras e Status */}
              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Limite de Crédito (R$)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={partnerForm.creditLimit}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        creditLimit: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-emerald-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Prazo Padrão (Dias)
                  </label>
                  <input
                    type="number"
                    value={partnerForm.paymentTermsDays}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        paymentTermsDays: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Status Cadastral
                  </label>
                  <select
                    value={partnerForm.status}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        status: e.target.value as PartnerStatus,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                    <option value="BLOQUEADO">Bloqueado</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPartnerModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!docValidation.isValid}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-semibold transition shadow"
                >
                  {editingPartner ? 'Salvar Alterações' : 'Cadastrar Parceiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FICHA COMPLETA DO PARCEIRO                                         */}
      {/* ========================================================================= */}
      {viewingPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Ficha Cadastral do Parceiro</h2>
              </div>
              <button
                onClick={() => setViewingPartner(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] uppercase font-bold text-indigo-400 block tracking-wider">
                  {viewingPartner.personType} • {viewingPartner.formattedDocument || viewingPartner.document}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">{viewingPartner.name}</h3>
                {viewingPartner.tradeName && (
                  <p className="text-slate-400 text-xs">{viewingPartner.tradeName}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Papéis no Sistema:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {viewingPartner.roles.map((r) => (
                      <span
                        key={r}
                        className={`rounded border px-1.5 py-0.2 text-[9px] font-bold ${getRoleBadge(
                          r
                        )}`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Limite Concedido:</span>
                  <div className="text-emerald-400 font-mono font-bold text-sm mt-0.5">
                    R$ {(viewingPartner.creditLimit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-slate-400 text-[10px]">
                    Prazo: {viewingPartner.paymentTermsDays || 30} dias
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                <span className="text-slate-400 font-semibold block">Contato & Tributário:</span>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>Email: <span className="text-white">{viewingPartner.email}</span></div>
                  <div>Telefone: <span className="text-white">{viewingPartner.phone}</span></div>
                  <div>IE: <span className="text-white">{viewingPartner.stateRegistration || 'Isento'}</span></div>
                  <div>IM: <span className="text-white">{viewingPartner.municipalRegistration || 'Não informada'}</span></div>
                </div>
              </div>

              {viewingPartner.address && (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-400 font-semibold block">Endereço Cadastrado:</span>
                  <p className="text-slate-200">
                    {viewingPartner.address.street}, {viewingPartner.address.number}{' '}
                    {viewingPartner.address.complement && `(${viewingPartner.address.complement})`} -{' '}
                    {viewingPartner.address.neighborhood}
                  </p>
                  <p className="text-slate-400">
                    {viewingPartner.address.city}/{viewingPartner.address.state} • CEP:{' '}
                    {viewingPartner.address.zipCode}
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setViewingPartner(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-semibold"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRIAR / EDITAR CONTA CONTÁBIL                                      */}
      {/* ========================================================================= */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">
                  {editingAccount ? 'Editar Conta Contábil' : 'Nova Conta Contábil'}
                </h2>
              </div>
              <button
                onClick={() => setIsAccountModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Código Estruturado *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountForm.code}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, code: e.target.value })
                    }
                    placeholder="Ex: 1.1.1.04"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nível Estrutural (1 a 5)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={accountForm.level}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        level: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome / Descrição da Conta *
                </label>
                <input
                  type="text"
                  required
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  placeholder="Ex: Banco Itaú - Aplicação Automática"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={accountForm.category}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        category: e.target.value as AccountCategory,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="PASSIVO">Passivo</option>
                    <option value="PATRIMONIO_LIQUIDO">Patrimônio Líquido</option>
                    <option value="RECEITA">Receita</option>
                    <option value="DESPESA">Despesa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Tipo</label>
                  <select
                    value={accountForm.type}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        type: e.target.value as AccountType,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <option value="ANALITICA">Analítica (Lançamento)</option>
                    <option value="SINTETICA">Sintética (Grupo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Natureza
                  </label>
                  <select
                    value={accountForm.nature}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        nature: e.target.value as AccountNature,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <option value="DEVEDORA">Devedora</option>
                    <option value="CREDORA">Credora</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-xs font-semibold transition shadow"
                >
                  {editingAccount ? 'Salvar Conta' : 'Criar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRIAR / EDITAR CENTRO DE CUSTO                                    */}
      {/* ========================================================================= */}
      {isCostCenterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">
                  {editingCostCenter ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
                </h2>
              </div>
              <button
                onClick={() => setIsCostCenterModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCostCenter} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Código da Unidade *
                </label>
                <input
                  type="text"
                  required
                  value={costCenterForm.code}
                  onChange={(e) =>
                    setCostCenterForm({ ...costCenterForm, code: e.target.value })
                  }
                  placeholder="Ex: 50.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome da Área / Centro de Custo *
                </label>
                <input
                  type="text"
                  required
                  value={costCenterForm.name}
                  onChange={(e) =>
                    setCostCenterForm({ ...costCenterForm, name: e.target.value })
                  }
                  placeholder="Ex: Pesquisa e Inovação (R&D)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Gestor Responsável *
                </label>
                <input
                  type="text"
                  required
                  value={costCenterForm.responsible}
                  onChange={(e) =>
                    setCostCenterForm({ ...costCenterForm, responsible: e.target.value })
                  }
                  placeholder="Ex: Dra. Mariana Costa"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                <select
                  value={costCenterForm.status}
                  onChange={(e) =>
                    setCostCenterForm({
                      ...costCenterForm,
                      status: e.target.value as 'ATIVO' | 'INATIVO',
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCostCenterModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-xs font-semibold transition shadow"
                >
                  {editingCostCenter ? 'Salvar Alterações' : 'Criar Centro de Custo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
