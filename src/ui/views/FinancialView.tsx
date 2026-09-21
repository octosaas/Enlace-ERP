/**
 * Enlace ERP - Módulo Financeiro, Tesouraria, Fluxo de Caixa e DRE (PRD 05)
 * Gestão de Contas a Receber, Contas a Pagar, Contas Bancárias, Fluxo de Caixa e Demonstrativo de Resultado
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  FileText,
  PieChart,
  BarChart3,
  Landmark,
  Wallet,
  Clock,
  ChevronRight,
  ArrowRightLeft,
  Receipt,
  Scale,
} from 'lucide-react';
import {
  AccountReceivable,
  AccountPayable,
  BankAccount,
  BankTransaction,
  CashFlowDay,
  IncomeStatementItem,
  FinancialDashboardMetrics,
  BusinessPartner,
  ChartOfAccount,
  PaymentMethod,
} from '../../shared/types.js';

export const FinancialView: React.FC = () => {
  const { activeCompany, activeSchema, apiFetch } = useAuth();

  // Sub-aba ativa
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'receivables' | 'payables' | 'treasury' | 'cashFlow' | 'incomeStatement'
  >('dashboard');

  // Estados de dados
  const [metrics, setMetrics] = useState<FinancialDashboardMetrics | null>(null);
  const [receivables, setReceivables] = useState<AccountReceivable[]>([]);
  const [payables, setPayables] = useState<AccountPayable[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [cashFlowTimeline, setCashFlowTimeline] = useState<CashFlowDay[]>([]);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementItem[]>([]);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);

  // Estados de controle e UX
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('ALL');
  const [cashFlowDaysHorizon, setCashFlowDaysHorizon] = useState<number>(30);

  // Modais
  const [isReceivableModalOpen, setIsReceivableModalOpen] = useState(false);
  const [isPayableModalOpen, setIsPayableModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<{
    type: 'RECEIVABLE' | 'PAYABLE';
    item: AccountReceivable | AccountPayable;
  } | null>(null);
  const [isBankAccountModalOpen, setIsBankAccountModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  // Formulário: Novo Título a Receber
  const [newReceivable, setNewReceivable] = useState({
    customerId: '',
    customerName: '',
    customerDocument: '',
    description: '',
    originalValue: 0,
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    issueDate: new Date().toISOString().split('T')[0],
    fineRate: 2.0,
    interestRate: 1.0,
    chartOfAccountId: '',
    costCenterCode: 'CC-COM',
    notes: '',
  });

  // Formulário: Novo Título a Pagar
  const [newPayable, setNewPayable] = useState({
    supplierId: '',
    supplierName: '',
    supplierDocument: '',
    description: '',
    originalValue: 0,
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    issueDate: new Date().toISOString().split('T')[0],
    chartOfAccountId: '',
    costCenterCode: 'CC-ADM',
    notes: '',
  });

  // Formulário: Baixa / Liquidação
  const [settleForm, setSettleForm] = useState({
    paidAmount: 0,
    discountValue: 0,
    fineValue: 0,
    interestValue: 0,
    bankAccountId: '',
    paymentMethod: 'PIX' as PaymentMethod,
    paidAt: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Formulário: Nova Conta Bancária
  const [newBankAccount, setNewBankAccount] = useState({
    name: '',
    bankCode: '341',
    agency: '',
    accountNumber: '',
    accountType: 'CHECKING' as 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'CASH',
    initialBalance: 0,
    color: '#10b981',
  });

  // Formulário: Novo Lançamento Bancário
  const [newTransaction, setNewTransaction] = useState({
    bankAccountId: '',
    type: 'CREDIT' as 'CREDIT' | 'DEBIT',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: 'OUTROS',
  });

  // Mostra mensagem temporária de feedback
  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Carregamento de dados
  const loadFinancialData = async () => {
    setIsLoading(true);
    try {
      // 1. Dashboard
      const dashRes = await apiFetch<FinancialDashboardMetrics>('/api/v1/financial/dashboard');
      if (dashRes.success && dashRes.data) setMetrics(dashRes.data);

      // 2. Receivables
      const recRes = await apiFetch<AccountReceivable[]>('/api/v1/financial/receivables');
      if (recRes.success && recRes.data) setReceivables(recRes.data);

      // 3. Payables
      const payRes = await apiFetch<AccountPayable[]>('/api/v1/financial/payables');
      if (payRes.success && payRes.data) setPayables(payRes.data);

      // 4. Bank Accounts
      const bcoRes = await apiFetch<BankAccount[]>('/api/v1/financial/treasury/accounts');
      if (bcoRes.success && bcoRes.data) setBankAccounts(bcoRes.data);

      // 5. Bank Transactions
      const txnRes = await apiFetch<BankTransaction[]>('/api/v1/financial/treasury/transactions');
      if (txnRes.success && txnRes.data) setBankTransactions(txnRes.data);

      // 6. Cash Flow
      const flowRes = await apiFetch<CashFlowDay[]>(
        `/api/v1/financial/reports/cash-flow?days=${cashFlowDaysHorizon}`
      );
      if (flowRes.success && flowRes.data) setCashFlowTimeline(flowRes.data);

      // 7. Income Statement (DRE)
      const dreRes = await apiFetch<IncomeStatementItem[]>(
        '/api/v1/financial/reports/income-statement'
      );
      if (dreRes.success && dreRes.data) setIncomeStatement(dreRes.data);

      // 8. Parceiros (para autocompletar clientes e fornecedores)
      try {
        const partRes = await apiFetch<BusinessPartner[]>('/api/v1/companies/active/partners');
        if (partRes.success && partRes.data) setPartners(partRes.data);
      } catch (err) {
        console.warn('Não foi possível carregar parceiros:', err);
      }

      // 9. Plano de Contas
      try {
        const coaRes = await apiFetch<ChartOfAccount[]>(
          '/api/v1/companies/active/chart-of-accounts'
        );
        if (coaRes.success && coaRes.data) setChartOfAccounts(coaRes.data);
      } catch (err) {
        console.warn('Não foi possível carregar plano de contas:', err);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar dados financeiros';
      showFeedback('error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, [activeSchema, cashFlowDaysHorizon]);

  // Formatação de Moeda BRL
  const formatBRL = (val?: number) => {
    return (val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-950/80 border border-blue-800 px-2 py-0.5 text-[11px] font-medium text-blue-300">
            <Clock className="h-3 w-3" /> Em Aberto
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/80 border border-amber-800 px-2 py-0.5 text-[11px] font-medium text-amber-300">
            <Clock className="h-3 w-3" /> Parcial
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Liquidado
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-950/80 border border-rose-800 px-2 py-0.5 text-[11px] font-medium text-rose-300 animate-pulse">
            <AlertCircle className="h-3 w-3" /> Vencido
          </span>
        );
      case 'CANCELED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 border border-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-500 line-through">
            <XCircle className="h-3 w-3" /> Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
            {status}
          </span>
        );
    }
  };

  // Criação de Título a Receber
  const handleCreateReceivable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReceivable.customerName || newReceivable.originalValue <= 0) {
      showFeedback('error', 'Preencha cliente e um valor original maior que zero.');
      return;
    }

    try {
      const res = await apiFetch<AccountReceivable>('/api/v1/financial/receivables', {
        method: 'POST',
        body: JSON.stringify(newReceivable),
      });

      if (res.success) {
        showFeedback('success', `Título a receber ${res.data?.number} criado com sucesso!`);
        setIsReceivableModalOpen(false);
        setNewReceivable({
          customerId: '',
          customerName: '',
          customerDocument: '',
          description: '',
          originalValue: 0,
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          issueDate: new Date().toISOString().split('T')[0],
          fineRate: 2.0,
          interestRate: 1.0,
          chartOfAccountId: '',
          costCenterCode: 'CC-COM',
          notes: '',
        });
        loadFinancialData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar título';
      showFeedback('error', msg);
    }
  };

  // Criação de Título a Pagar
  const handleCreatePayable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayable.supplierName || newPayable.originalValue <= 0) {
      showFeedback('error', 'Preencha fornecedor e um valor original maior que zero.');
      return;
    }

    try {
      const res = await apiFetch<AccountPayable>('/api/v1/financial/payables', {
        method: 'POST',
        body: JSON.stringify(newPayable),
      });

      if (res.success) {
        showFeedback('success', `Título a pagar ${res.data?.number} criado com sucesso!`);
        setIsPayableModalOpen(false);
        setNewPayable({
          supplierId: '',
          supplierName: '',
          supplierDocument: '',
          description: '',
          originalValue: 0,
          dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
          issueDate: new Date().toISOString().split('T')[0],
          chartOfAccountId: '',
          costCenterCode: 'CC-ADM',
          notes: '',
        });
        loadFinancialData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar título a pagar';
      showFeedback('error', msg);
    }
  };

  // Abertura do Modal de Liquidação com Cálculo Automático de Encargos
  const openSettleModal = (
    type: 'RECEIVABLE' | 'PAYABLE',
    item: AccountReceivable | AccountPayable
  ) => {
    setSettleTarget({ type, item });

    // Cálculo prévio de dias de atraso para sugestão de multa e juros
    const dueDate = new Date(item.dueDate);
    const today = new Date();
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.max(
      0,
      Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    let suggestedFine = 0;
    let suggestedInterest = 0;

    if (diffDays > 0) {
      const fineRate = 'fineRate' in item ? item.fineRate : 2.0;
      const interestRate = 'interestRate' in item ? item.interestRate : 1.0;

      suggestedFine = Number(((item.balanceValue * fineRate) / 100).toFixed(2));
      suggestedInterest = Number(
        ((item.balanceValue * (interestRate / 100 / 30) * diffDays)).toFixed(2)
      );
    }

    const defaultBank = bankAccounts[0]?.id || '';

    setSettleForm({
      paidAmount: item.balanceValue,
      discountValue: 0,
      fineValue: suggestedFine,
      interestValue: suggestedInterest,
      bankAccountId: defaultBank,
      paymentMethod: 'PIX',
      paidAt: new Date().toISOString().split('T')[0],
      notes: diffDays > 0 ? `Liquidação com ${diffDays} dias de atraso.` : 'Liquidação pontual.',
    });

    setIsSettleModalOpen(true);
  };

  // Execução da Liquidação
  const handleConfirmSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;

    if (settleForm.paidAmount <= 0) {
      showFeedback('error', 'O valor liquidado deve ser positivo.');
      return;
    }

    const endpoint =
      settleTarget.type === 'RECEIVABLE'
        ? `/api/v1/financial/receivables/${settleTarget.item.id}/settle`
        : `/api/v1/financial/payables/${settleTarget.item.id}/settle`;

    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(settleForm),
      });

      if (res.success) {
        showFeedback(
          'success',
          `Título ${settleTarget.item.number} liquidado com sucesso! Saldo e tesouraria atualizados.`
        );
        setIsSettleModalOpen(false);
        setSettleTarget(null);
        loadFinancialData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar liquidação';
      showFeedback('error', msg);
    }
  };

  // Cancelamento de Título
  const handleCancelTitle = async (
    type: 'RECEIVABLE' | 'PAYABLE',
    item: AccountReceivable | AccountPayable
  ) => {
    const confirm = window.confirm(`Deseja realmente cancelar o título ${item.number}?`);
    if (!confirm) return;

    const endpoint =
      type === 'RECEIVABLE'
        ? `/api/v1/financial/receivables/${item.id}/cancel`
        : `/api/v1/financial/payables/${item.id}/cancel`;

    try {
      const res = await apiFetch(endpoint, { method: 'POST' });
      if (res.success) {
        showFeedback('success', `Título ${item.number} cancelado com sucesso.`);
        loadFinancialData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cancelar título';
      showFeedback('error', msg);
    }
  };

  // Criação de Conta Bancária
  const handleCreateBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankAccount.name || !newBankAccount.agency || !newBankAccount.accountNumber) {
      showFeedback('error', 'Preencha todos os campos obrigatórios da conta.');
      return;
    }

    try {
      const res = await apiFetch<BankAccount>('/api/v1/financial/treasury/accounts', {
        method: 'POST',
        body: JSON.stringify(newBankAccount),
      });

      if (res.success) {
        showFeedback('success', `Conta bancária ${res.data?.name} cadastrada com sucesso!`);
        setIsBankAccountModalOpen(false);
        setNewBankAccount({
          name: '',
          bankCode: '341',
          agency: '',
          accountNumber: '',
          accountType: 'CHECKING',
          initialBalance: 0,
          color: '#10b981',
        });
        loadFinancialData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar conta bancária';
      showFeedback('error', msg);
    }
  };

  // Criação de Lançamento de Tesouraria Manual
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTransaction.bankAccountId || newTransaction.amount <= 0 || !newTransaction.description) {
      showFeedback('error', 'Preencha conta, valor e descrição.');
      return;
    }

    try {
      const res = await apiFetch<BankTransaction>('/api/v1/financial/treasury/transactions', {
        method: 'POST',
        body: JSON.stringify(newTransaction),
      });

      if (res.success) {
        showFeedback('success', 'Lançamento bancário registrado com sucesso!');
        setIsTransactionModalOpen(false);
        setNewTransaction({
          bankAccountId: bankAccounts[0]?.id || '',
          type: 'CREDIT',
          amount: 0,
          date: new Date().toISOString().split('T')[0],
          description: '',
          category: 'OUTROS',
        });
        loadFinancialData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar movimentação';
      showFeedback('error', msg);
    }
  };

  // Conciliação Bancária
  const handleReconcileTransaction = async (transactionId: string) => {
    try {
      const res = await apiFetch(`/api/v1/financial/treasury/transactions/${transactionId}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (res.success) {
        showFeedback('success', 'Lançamento bancário marcado como conciliado!');
        loadFinancialData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao conciliar';
      showFeedback('error', msg);
    }
  };

  // Filtros de Títulos a Receber
  const filteredReceivables = useMemo(() => {
    return receivables.filter((r) => {
      const matchesSearch =
        r.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' ? true : r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [receivables, searchTerm, statusFilter]);

  // Filtros de Títulos a Pagar
  const filteredPayables = useMemo(() => {
    return payables.filter((p) => {
      const matchesSearch =
        p.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' ? true : p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [payables, searchTerm, statusFilter]);

  // Filtros de Extrato Bancário
  const filteredTransactions = useMemo(() => {
    return bankTransactions.filter((t) => {
      const matchesBank =
        selectedBankFilter === 'ALL' ? true : t.bankAccountId === selectedBankFilter;
      const matchesSearch =
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesBank && matchesSearch;
    });
  }, [bankTransactions, selectedBankFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div
          className={`flex items-center justify-between rounded-lg p-3 text-xs font-medium shadow-md transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950 border border-emerald-800 text-emerald-200'
              : 'bg-rose-950 border border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                PRD 05 • GESTÃO FINANCEIRA INTEGRADA
              </span>
              <span className="text-xs text-slate-400">Multi-Tenant • Schema: {activeSchema}</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-emerald-400" />
              Módulo Financeiro, Tesouraria & DRE
            </h1>
            <p className="text-xs text-slate-400">
              Controle de contas a pagar e receber, conciliação bancária, fluxo de caixa diário e DRE contábil por competência para {activeCompany?.legalName}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadFinancialData}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              onClick={() => setIsReceivableModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-sm transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo a Receber
            </button>
            <button
              onClick={() => setIsPayableModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 shadow-sm transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo a Pagar
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="mt-5 flex gap-2 border-t border-slate-800 pt-4 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Visão Geral & KPIs
          </button>
          <button
            onClick={() => setActiveTab('receivables')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'receivables'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <ArrowDownRight className="h-3.5 w-3.5 text-blue-400" />
            Contas a Receber ({receivables.length})
          </button>
          <button
            onClick={() => setActiveTab('payables')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'payables'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-rose-400" />
            Contas a Pagar ({payables.length})
          </button>
          <button
            onClick={() => setActiveTab('treasury')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'treasury'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Landmark className="h-3.5 w-3.5 text-amber-400" />
            Tesouraria & Bancos ({bankAccounts.length})
          </button>
          <button
            onClick={() => setActiveTab('cashFlow')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'cashFlow'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5 text-teal-400" />
            Fluxo de Caixa Diário
          </button>
          <button
            onClick={() => setActiveTab('incomeStatement')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'incomeStatement'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Receipt className="h-3.5 w-3.5 text-indigo-400" />
            DRE Gerencial
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ABA 1: DASHBOARD & KPIS FINANCEIROS                       */}
      {/* ========================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Grid de KPIs Principais */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Saldo de Tesouraria */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Disponibilidade (Tesouraria)</span>
                <Landmark className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {formatBRL(metrics?.treasuryTotalBalance)}
              </div>
              <div className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>Consolidado de {bankAccounts.length} contas bancárias</span>
              </div>
            </div>

            {/* Total a Receber em Aberto */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Contas a Receber (Aberto)</span>
                <ArrowDownRight className="h-4 w-4 text-blue-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-blue-400">
                {formatBRL(metrics?.totalReceivablesBalance)}
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>Vencendo hoje: {formatBRL(metrics?.receivablesDueTodayValue)}</span>
                <span className="text-rose-400">Vencidos: {metrics?.overdueReceivablesCount}</span>
              </div>
            </div>

            {/* Total a Pagar em Aberto */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Contas a Pagar (Aberto)</span>
                <ArrowUpRight className="h-4 w-4 text-rose-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-rose-400">
                {formatBRL(metrics?.totalPayablesBalance)}
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>Vencendo hoje: {formatBRL(metrics?.payablesDueTodayValue)}</span>
                <span className="text-rose-400">Vencidos: {metrics?.overduePayablesCount}</span>
              </div>
            </div>

            {/* Inadimplência e Projeção */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Taxa de Inadimplência</span>
                <AlertCircle className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-400">
                {metrics?.defaultRatePercent.toFixed(1)}%
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Valor Vencido: {formatBRL(metrics?.overdueReceivablesValue)}
              </div>
            </div>
          </div>

          {/* Seção de Contas Bancárias & Projeção 30 Dias */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Contas Bancárias */}
            <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Posição Financeira das Contas</h3>
                </div>
                <button
                  onClick={() => setIsBankAccountModalOpen(true)}
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  + Adicionar Conta
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bankAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: account.color || '#3b82f6' }}
                        />
                        <span className="text-xs font-semibold text-slate-200 truncate max-w-[150px]">
                          {account.name}
                        </span>
                      </div>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                        {account.bankCode}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">
                        Ag: {account.agency} | CC: {account.accountNumber}
                      </div>
                      <div className="text-lg font-bold text-white mt-1">
                        {formatBRL(account.currentBalance)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                      <span>Tipo: {account.accountType}</span>
                      <span className="text-emerald-400">Ativa</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Projeção do Mês */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-teal-400" />
                  <h3 className="text-sm font-semibold text-white">Projeção Líquida 30 Dias</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Resultado de entradas menos saídas considerando títulos emitidos e histórico.
                </p>

                <div className="mt-6 text-3xl font-extrabold text-teal-400">
                  {formatBRL(metrics?.cashFlow30DaysNet)}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {metrics?.cashFlow30DaysNet && metrics.cashFlow30DaysNet >= 0
                    ? 'Superávit financeiro projetado para o próximo ciclo.'
                    : 'Atenção: Déficit projetado, revise prazos de pagamentos.'}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Receitas Previstas (30d):</span>
                  <span className="text-blue-400 font-medium">
                    {formatBRL(
                      cashFlowTimeline.reduce((sum, d) => sum + d.inflowsPredicted, 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Despesas Previstas (30d):</span>
                  <span className="text-rose-400 font-medium">
                    {formatBRL(
                      cashFlowTimeline.reduce((sum, d) => sum + d.outflowsPredicted, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 2: CONTAS A RECEBER                                   */}
      {/* ========================================================= */}
      {activeTab === 'receivables' && (
        <div className="space-y-4">
          {/* Barra de Busca e Filtros */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por cliente, número (REC-...) ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-300 focus:outline-none"
              >
                <option value="ALL">Todos os Status</option>
                <option value="OPEN">Em Aberto</option>
                <option value="PARTIALLY_PAID">Parcial</option>
                <option value="PAID">Liquidados</option>
                <option value="OVERDUE">Vencidos</option>
                <option value="CANCELED">Cancelados</option>
              </select>
            </div>
          </div>

          {/* Tabela de Contas a Receber */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-medium">
                <tr>
                  <th className="py-3 px-4">Número / Emissão</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Descrição / Plano</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4 text-right">Valor Original</th>
                  <th className="py-3 px-4 text-right">Saldo em Aberto</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredReceivables.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Nenhum título a receber encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredReceivables.map((title) => (
                    <tr key={title.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-white">{title.number}</div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(title.issueDate).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200">{title.customerName}</div>
                        {title.customerDocument && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            {title.customerDocument}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-300 truncate max-w-[200px]" title={title.description}>
                          {title.description}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <span>{title.chartOfAccountCode || '1.1.2.01'}</span>
                          {title.description.includes('Faturamento') && (
                            <span className="rounded bg-indigo-950/70 border border-indigo-800/60 px-1 py-0.2 text-[9px] text-indigo-300 font-mono">
                              FATURAMENTO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200">
                          {new Date(title.dueDate).toLocaleDateString('pt-BR')}
                        </div>
                        {title.status === 'OVERDUE' && (
                          <div className="text-[10px] text-rose-400 font-medium">Atrasado</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-400">
                        {formatBRL(title.originalValue)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">
                        {formatBRL(title.balanceValue)}
                      </td>
                      <td className="py-3 px-4 text-center">{getStatusBadge(title.status)}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {['OPEN', 'PARTIALLY_PAID', 'OVERDUE'].includes(title.status) && (
                          <>
                            <button
                              onClick={() => openSettleModal('RECEIVABLE', title)}
                              className="rounded bg-emerald-600/90 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950 transition-colors"
                            >
                              Baixar
                            </button>
                            <button
                              onClick={() => handleCancelTitle('RECEIVABLE', title)}
                              className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:text-rose-300 transition-colors"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 3: CONTAS A PAGAR                                     */}
      {/* ========================================================= */}
      {activeTab === 'payables' && (
        <div className="space-y-4">
          {/* Barra de Busca e Filtros */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por fornecedor, número (PAG-...) ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-300 focus:outline-none"
              >
                <option value="ALL">Todos os Status</option>
                <option value="OPEN">Em Aberto</option>
                <option value="PARTIALLY_PAID">Parcial</option>
                <option value="PAID">Liquidados</option>
                <option value="OVERDUE">Vencidos</option>
                <option value="CANCELED">Cancelados</option>
              </select>
            </div>
          </div>

          {/* Tabela de Contas a Pagar */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-medium">
                <tr>
                  <th className="py-3 px-4">Número / Emissão</th>
                  <th className="py-3 px-4">Fornecedor</th>
                  <th className="py-3 px-4">Descrição / C. Custo</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4 text-right">Valor Original</th>
                  <th className="py-3 px-4 text-right">Saldo a Pagar</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredPayables.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Nenhum título a pagar encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredPayables.map((title) => (
                    <tr key={title.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-white">{title.number}</div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(title.issueDate).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200">{title.supplierName}</div>
                        {title.supplierDocument && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            {title.supplierDocument}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-300 truncate max-w-[200px]" title={title.description}>
                          {title.description}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {title.chartOfAccountCode || '2.1.2.01'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200">
                          {new Date(title.dueDate).toLocaleDateString('pt-BR')}
                        </div>
                        {title.status === 'OVERDUE' && (
                          <div className="text-[10px] text-rose-400 font-medium">Atrasado</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-400">
                        {formatBRL(title.originalValue)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">
                        {formatBRL(title.balanceValue)}
                      </td>
                      <td className="py-3 px-4 text-center">{getStatusBadge(title.status)}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {['OPEN', 'PARTIALLY_PAID', 'OVERDUE'].includes(title.status) && (
                          <>
                            <button
                              onClick={() => openSettleModal('PAYABLE', title)}
                              className="rounded bg-rose-600/90 hover:bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors"
                            >
                              Pagar
                            </button>
                            <button
                              onClick={() => handleCancelTitle('PAYABLE', title)}
                              className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:text-rose-300 transition-colors"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 4: TESOURARIA & CONTAS BANCÁRIAS                      */}
      {/* ========================================================= */}
      {activeTab === 'treasury' && (
        <div className="space-y-6">
          {/* Ações de Tesouraria */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Extrato & Conciliação Bancária</h3>
              <p className="text-xs text-slate-400">
                Visualize os lançamentos de débito e crédito gerados por liquidações e lançamentos avulsos.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBankAccountModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-400" />
                Nova Conta Bancária
              </button>
              <button
                onClick={() => setIsTransactionModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Lançamento Manual
              </button>
            </div>
          </div>

          {/* Filtro por Banco e Tabela de Extrato */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Filtrar por Conta:</span>
              <select
                value={selectedBankFilter}
                onChange={(e) => setSelectedBankFilter(e.target.value)}
                className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
              >
                <option value="ALL">Todas as Contas ({bankAccounts.length})</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.agency} / {b.accountNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-medium">
                  <tr>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Conta Bancária</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4 text-center">Tipo</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                    <th className="py-3 px-4 text-center">Conciliado</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhuma movimentação bancária registrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((txn) => {
                      const bank = bankAccounts.find((b) => b.id === txn.bankAccountId);
                      return (
                        <tr key={txn.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 text-slate-400">
                            {new Date(txn.date).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-200">{bank?.name || 'Banco'}</div>
                            <div className="text-[11px] text-slate-500">
                              Ag {bank?.agency} | CC {bank?.accountNumber}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-200">{txn.description}</td>
                          <td className="py-3 px-4 text-slate-400">{txn.category}</td>
                          <td className="py-3 px-4 text-center">
                            {txn.type === 'CREDIT' ? (
                              <span className="rounded bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                                + Crédito
                              </span>
                            ) : (
                              <span className="rounded bg-rose-950 border border-rose-800 px-2 py-0.5 text-[11px] font-semibold text-rose-400">
                                - Débito
                              </span>
                            )}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-bold ${
                              txn.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {txn.type === 'CREDIT' ? '+' : '-'} {formatBRL(txn.amount)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {txn.reconciled ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Sim
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                                <Clock className="h-3.5 w-3.5" /> Pendente
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {!txn.reconciled && (
                              <button
                                onClick={() => handleReconcileTransaction(txn.id)}
                                className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] text-slate-300 transition-colors"
                              >
                                Conciliar
                              </button>
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
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 5: FLUXO DE CAIXA DIÁRIO                              */}
      {/* ========================================================= */}
      {activeTab === 'cashFlow' && (
        <div className="space-y-6">
          {/* Controles de Horizonte */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Projeção do Fluxo de Caixa Diário</h3>
              <p className="text-xs text-slate-400">
                Acompanhamento cronológico de recebimentos previstos vs realizados e liquidez acumulada.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Horizonte:</span>
              {[7, 15, 30, 60].map((days) => (
                <button
                  key={days}
                  onClick={() => setCashFlowDaysHorizon(days)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    cashFlowDaysHorizon === days
                      ? 'bg-emerald-600 text-white'
                      : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {days} dias
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-medium">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4 text-right">Entradas Previstas</th>
                  <th className="py-3 px-4 text-right">Entradas Realizadas</th>
                  <th className="py-3 px-4 text-right">Saídas Previstas</th>
                  <th className="py-3 px-4 text-right">Saídas Realizadas</th>
                  <th className="py-3 px-4 text-right">Resultado do Dia</th>
                  <th className="py-3 px-4 text-right font-bold">Saldo Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {cashFlowTimeline.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Nenhuma projeção gerada para o período.
                    </td>
                  </tr>
                ) : (
                  cashFlowTimeline.map((day) => {
                    const isPositive = day.netDay >= 0;
                    return (
                      <tr key={day.date} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-200">
                          {new Date(day.date + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-right text-blue-400">
                          {day.inflowsPredicted > 0 ? formatBRL(day.inflowsPredicted) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400">
                          {day.inflowsRealized > 0 ? formatBRL(day.inflowsRealized) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-amber-400">
                          {day.outflowsPredicted > 0 ? formatBRL(day.outflowsPredicted) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-rose-400">
                          {day.outflowsRealized > 0 ? formatBRL(day.outflowsRealized) : '-'}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-semibold ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {formatBRL(day.netDay)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {formatBRL(day.cumulativeBalance)}
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

      {/* ========================================================= */}
      {/* ABA 6: DRE GERENCIAL ESTRUTURADO                          */}
      {/* ========================================================= */}
      {activeTab === 'incomeStatement' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h3 className="text-sm font-semibold text-white">
              Demonstrativo do Resultado do Exercício (DRE)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Consolidação analítica por competência em conformidade com as normas contábeis brasileiras (NBC TG).
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-medium">
                <tr>
                  <th className="py-3 px-4 w-24">Código</th>
                  <th className="py-3 px-4">Descrição Contábil</th>
                  <th className="py-3 px-4 text-center">Tipo</th>
                  <th className="py-3 px-4 text-right">Valor Consolidado (R$)</th>
                  <th className="py-3 px-4 text-right">Análise Vertical (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {incomeStatement.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Nenhum dado contábil disponível para o DRE.
                    </td>
                  </tr>
                ) : (
                  incomeStatement.map((item) => {
                    const isTotalizer = item.level === 1;
                    return (
                      <tr
                        key={item.code}
                        className={`transition-colors ${
                          isTotalizer
                            ? 'bg-slate-900/90 font-bold text-white'
                            : 'hover:bg-slate-800/40 text-slate-300'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-slate-400">{item.code}</td>
                        <td className={`py-3 px-4 ${item.level > 1 ? 'pl-8 text-slate-400' : ''}`}>
                          {item.name}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              item.type === 'REVENUE'
                                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                : item.type === 'COST' || item.type === 'EXPENSE' || item.type === 'DEDUCTION'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {formatBRL(item.value)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">
                          {item.percentage ? `${item.percentage.toFixed(1)}%` : '-'}
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

      {/* ========================================================= */}
      {/* MODAL: NOVO TÍTULO A RECEBER                              */}
      {/* ========================================================= */}
      {isReceivableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-blue-400" />
                Novo Título de Conta a Receber
              </h3>
              <button
                onClick={() => setIsReceivableModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReceivable} className="space-y-4 text-xs">
              {/* Cliente */}
              <div>
                <label className="block text-slate-400 mb-1">Cliente *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome ou Razão Social do Cliente"
                  value={newReceivable.customerName}
                  onChange={(e) =>
                    setNewReceivable({ ...newReceivable, customerName: e.target.value })
                  }
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">CNPJ / CPF do Cliente</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={newReceivable.customerDocument}
                    onChange={(e) =>
                      setNewReceivable({ ...newReceivable, customerDocument: e.target.value })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Valor Original (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={newReceivable.originalValue || ''}
                    onChange={(e) =>
                      setNewReceivable({
                        ...newReceivable,
                        originalValue: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Descrição do Faturamento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Faturamento Prestação de Serviços de Manutenção"
                  value={newReceivable.description}
                  onChange={(e) =>
                    setNewReceivable({ ...newReceivable, description: e.target.value })
                  }
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Data de Emissão *</label>
                  <input
                    type="date"
                    required
                    value={newReceivable.issueDate}
                    onChange={(e) =>
                      setNewReceivable({ ...newReceivable, issueDate: e.target.value })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Data de Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={newReceivable.dueDate}
                    onChange={(e) =>
                      setNewReceivable({ ...newReceivable, dueDate: e.target.value })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Multa Atraso (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newReceivable.fineRate}
                    onChange={(e) =>
                      setNewReceivable({
                        ...newReceivable,
                        fineRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Juros ao Mês (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newReceivable.interestRate}
                    onChange={(e) =>
                      setNewReceivable({
                        ...newReceivable,
                        interestRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReceivableModalOpen(false)}
                  className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-sm"
                >
                  Salvar Título
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: NOVO TÍTULO A PAGAR                                */}
      {/* ========================================================= */}
      {isPayableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-rose-400" />
                Novo Título de Conta a Pagar
              </h3>
              <button
                onClick={() => setIsPayableModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePayable} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Fornecedor *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do Fornecedor / Credor"
                  value={newPayable.supplierName}
                  onChange={(e) =>
                    setNewPayable({ ...newPayable, supplierName: e.target.value })
                  }
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">CNPJ / CPF do Fornecedor</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={newPayable.supplierDocument}
                    onChange={(e) =>
                      setNewPayable({ ...newPayable, supplierDocument: e.target.value })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Valor Original (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={newPayable.originalValue || ''}
                    onChange={(e) =>
                      setNewPayable({
                        ...newPayable,
                        originalValue: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Descrição da Despesa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aquisição de Materiais de Escritório / Licença de Software"
                  value={newPayable.description}
                  onChange={(e) =>
                    setNewPayable({ ...newPayable, description: e.target.value })
                  }
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Data de Emissão *</label>
                  <input
                    type="date"
                    required
                    value={newPayable.issueDate}
                    onChange={(e) =>
                      setNewPayable({ ...newPayable, issueDate: e.target.value })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Data de Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={newPayable.dueDate}
                    onChange={(e) =>
                      setNewPayable({ ...newPayable, dueDate: e.target.value })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPayableModalOpen(false)}
                  className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 shadow-sm"
                >
                  Salvar Título a Pagar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: LIQUIDAÇÃO / BAIXA COM CÁLCULO DE ENCARGOS          */}
      {/* ========================================================= */}
      {isSettleModalOpen && settleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Liquidação de Título ({settleTarget.item.number})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {settleTarget.type === 'RECEIVABLE' ? 'Recebimento de Cliente' : 'Pagamento a Fornecedor'}
                </p>
              </div>
              <button
                onClick={() => setIsSettleModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Resumo do Título */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Favorecido / Sacado:</span>
                <span className="text-white font-medium">
                  {'customerName' in settleTarget.item
                    ? settleTarget.item.customerName
                    : settleTarget.item.supplierName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Data de Vencimento:</span>
                <span className="text-slate-200">
                  {new Date(settleTarget.item.dueDate).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Saldo Residual em Aberto:</span>
                <span className="text-emerald-400 font-bold font-mono">
                  {formatBRL(settleTarget.item.balanceValue)}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmSettle} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Valor a Liquidar (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={settleForm.paidAmount || ''}
                    onChange={(e) =>
                      setSettleForm({
                        ...settleForm,
                        paidAmount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Data da Baixa *</label>
                  <input
                    type="date"
                    required
                    value={settleForm.paidAt}
                    onChange={(e) => setSettleForm({ ...settleForm, paidAt: e.target.value })}
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Multa, Juros e Desconto */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Multa (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settleForm.fineValue}
                    onChange={(e) =>
                      setSettleForm({
                        ...settleForm,
                        fineValue: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Juros (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settleForm.interestValue}
                    onChange={(e) =>
                      setSettleForm({
                        ...settleForm,
                        interestValue: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Desconto (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settleForm.discountValue}
                    onChange={(e) =>
                      setSettleForm({
                        ...settleForm,
                        discountValue: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Destino / Origem Bancária & Meio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Conta Bancária (Tesouraria) *</label>
                  <select
                    required
                    value={settleForm.bankAccountId}
                    onChange={(e) => setSettleForm({ ...settleForm, bankAccountId: e.target.value })}
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="">Selecione a conta...</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (Saldo: {formatBRL(b.currentBalance)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Forma de Liquidação *</label>
                  <select
                    value={settleForm.paymentMethod}
                    onChange={(e) =>
                      setSettleForm({ ...settleForm, paymentMethod: e.target.value as PaymentMethod })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="PIX">PIX</option>
                    <option value="BOLETO">Boleto Bancário</option>
                    <option value="BANK_TRANSFER">TED / DOC</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                    <option value="DEBIT_CARD">Cartão de Débito</option>
                    <option value="CASH">Dinheiro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Observações de Liquidação</label>
                <input
                  type="text"
                  placeholder="Ex: Comprovante de transação / Autenticação bancária"
                  value={settleForm.notes}
                  onChange={(e) => setSettleForm({ ...settleForm, notes: e.target.value })}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                />
              </div>

              {/* Total Efetivo */}
              <div className="rounded bg-slate-800/80 p-2.5 flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Impacto no Caixa:</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {formatBRL(
                    settleForm.paidAmount +
                      settleForm.fineValue +
                      settleForm.interestValue -
                      settleForm.discountValue
                  )}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500 shadow-sm"
                >
                  Confirmar Baixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: NOVA CONTA BANCÁRIA                                */}
      {/* ========================================================= */}
      {isBankAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Landmark className="h-4 w-4 text-emerald-400" />
                Nova Conta Bancária
              </h3>
              <button
                onClick={() => setIsBankAccountModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBankAccount} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nome da Instituição / Descrição *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Itaú Unibanco - Conta Movimento"
                  value={newBankAccount.name}
                  onChange={(e) => setNewBankAccount({ ...newBankAccount, name: e.target.value })}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Cód. Banco *</label>
                  <input
                    type="text"
                    required
                    placeholder="341"
                    value={newBankAccount.bankCode}
                    onChange={(e) =>
                      setNewBankAccount({ ...newBankAccount, bankCode: e.target.value })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Agência *</label>
                  <input
                    type="text"
                    required
                    placeholder="0123"
                    value={newBankAccount.agency}
                    onChange={(e) =>
                      setNewBankAccount({ ...newBankAccount, agency: e.target.value })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Conta Corrente *</label>
                  <input
                    type="text"
                    required
                    placeholder="99999-9"
                    value={newBankAccount.accountNumber}
                    onChange={(e) =>
                      setNewBankAccount({ ...newBankAccount, accountNumber: e.target.value })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Tipo de Conta</label>
                  <select
                    value={newBankAccount.accountType}
                    onChange={(e) =>
                      setNewBankAccount({
                        ...newBankAccount,
                        accountType: e.target.value as 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'CASH',
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="CHECKING">Conta Corrente</option>
                    <option value="SAVINGS">Poupança</option>
                    <option value="INVESTMENT">Aplicação</option>
                    <option value="CASH">Caixa Físico</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Saldo Inicial (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newBankAccount.initialBalance}
                    onChange={(e) =>
                      setNewBankAccount({
                        ...newBankAccount,
                        initialBalance: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBankAccountModalOpen(false)}
                  className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500 shadow-sm"
                >
                  Salvar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: NOVO LANÇAMENTO MANUAL DE TESOURARIA               */}
      {/* ========================================================= */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-emerald-400" />
                Novo Lançamento Bancário Manual
              </h3>
              <button
                onClick={() => setIsTransactionModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Conta Bancária *</label>
                <select
                  required
                  value={newTransaction.bankAccountId}
                  onChange={(e) =>
                    setNewTransaction({ ...newTransaction, bankAccountId: e.target.value })
                  }
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                >
                  <option value="">Selecione a conta...</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (Saldo: {formatBRL(b.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Tipo de Lançamento *</label>
                  <select
                    value={newTransaction.type}
                    onChange={(e) =>
                      setNewTransaction({
                        ...newTransaction,
                        type: e.target.value as 'CREDIT' | 'DEBIT',
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="CREDIT">+ Crédito (Entrada)</option>
                    <option value="DEBIT">- Débito (Saída)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={newTransaction.amount || ''}
                    onChange={(e) =>
                      setNewTransaction({
                        ...newTransaction,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Descrição *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Tarifa de Manutenção de Conta / Aporte de Capital"
                  value={newTransaction.description}
                  onChange={(e) =>
                    setNewTransaction({ ...newTransaction, description: e.target.value })
                  }
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Categoria</label>
                  <input
                    type="text"
                    placeholder="TARIFA, RENDIMENTO, APORTE"
                    value={newTransaction.category}
                    onChange={(e) =>
                      setNewTransaction({ ...newTransaction, category: e.target.value })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={newTransaction.date}
                    onChange={(e) =>
                      setNewTransaction({ ...newTransaction, date: e.target.value })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500 shadow-sm"
                >
                  Registrar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
