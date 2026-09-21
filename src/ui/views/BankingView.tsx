/**
 * Enlace ERP - Módulo de Cobrança Bancária, Boletos, Pix Dinâmico e Conciliação CNAB (PRD 09)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import {
  BankSlip,
  PixCharge,
  CnabFile,
  CollectionDunningRule,
  BankingDashboardMetrics,
  BusinessPartner,
  BankAccount,
  PixKeyType,
  DunningChannel,
} from '../../shared/types.js';
import { BankingDashboardTab } from './banking/BankingDashboardTab.js';
import { BankSlipsTab } from './banking/BankSlipsTab.js';
import { PixChargesTab } from './banking/PixChargesTab.js';
import { CnabFilesTab } from './banking/CnabFilesTab.js';
import { DunningRulesTab } from './banking/DunningRulesTab.js';
import { BoletoPrintModal } from './banking/BoletoPrintModal.js';
import { PixQrCodeModal } from './banking/PixQrCodeModal.js';
import {
  Landmark,
  LayoutDashboard,
  Barcode,
  QrCode,
  FileSpreadsheet,
  BellRing,
  RefreshCw,
  ShieldCheck,
  Building2,
  Database,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const BankingView: React.FC = () => {
  const { activeCompany, activeSchema, activeMembership, apiFetch } = useAuth();

  // Abas
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'slips' | 'pix' | 'cnab' | 'dunning'>('dashboard');

  // Dados
  const [metrics, setMetrics] = useState<BankingDashboardMetrics | null>(null);
  const [slips, setSlips] = useState<BankSlip[]>([]);
  const [pixCharges, setPixCharges] = useState<PixCharge[]>([]);
  const [cnabFiles, setCnabFiles] = useState<CnabFile[]>([]);
  const [dunningRules, setDunningRules] = useState<CollectionDunningRule[]>([]);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // Estados de Carregamento e Mensagens
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modais de Visualização Ativa
  const [activePrintSlip, setActivePrintSlip] = useState<BankSlip | null>(null);
  const [activeQrCodePix, setActiveQrCodePix] = useState<PixCharge | null>(null);

  // Permissões
  const userRole = activeMembership?.role || 'viewer';
  const canManage = userRole === 'owner' || userRole === 'admin' || userRole === 'manager';
  const canOperate = canManage || userRole === 'operator';

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [metricsRes, slipsRes, pixRes, cnabRes, dunningRes, partnersRes, accountsRes] = await Promise.all([
        apiFetch<BankingDashboardMetrics>('/api/v1/banking/dashboard'),
        apiFetch<BankSlip[]>('/api/v1/banking/slips'),
        apiFetch<PixCharge[]>('/api/v1/banking/pix/charges'),
        apiFetch<CnabFile[]>('/api/v1/banking/cnab/files'),
        apiFetch<CollectionDunningRule[]>('/api/v1/banking/dunning-rules'),
        apiFetch<BusinessPartner[]>('/api/v1/companies/active/partners'),
        apiFetch<BankAccount[]>('/api/v1/financial/treasury/accounts'),
      ]);

      if (metricsRes.success && metricsRes.data) setMetrics(metricsRes.data);
      if (slipsRes.success && Array.isArray(slipsRes.data)) setSlips(slipsRes.data);
      if (pixRes.success && Array.isArray(pixRes.data)) setPixCharges(pixRes.data);
      if (cnabRes.success && Array.isArray(cnabRes.data)) setCnabFiles(cnabRes.data);
      if (dunningRes.success && Array.isArray(dunningRes.data)) setDunningRules(dunningRes.data);
      if (partnersRes.success && Array.isArray(partnersRes.data)) setPartners(partnersRes.data);
      if (accountsRes.success && Array.isArray(accountsRes.data)) setBankAccounts(accountsRes.data);
    } catch (err) {
      console.error('Falha ao carregar dados bancários:', err);
      showNotification('error', 'Erro ao sincronizar informações bancárias.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Operações de Boleto
  const handleCreateSlip = async (data: {
    bankAccountId?: string;
    payerName: string;
    payerDocument: string;
    payerAddress?: string;
    amount: number;
    dueDate: string;
    instructions?: string[];
    finePercent?: number;
    interestMonthlyPercent?: number;
  }) => {
    try {
      const res = await apiFetch<BankSlip>('/api/v1/banking/slips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Falha ao emitir boleto');
      }

      const newSlip = res.data;
      showNotification('success', `Boleto ${newSlip.ourNumber} emitido com sucesso!`);
      await loadData();
      // Opcional: abre visualização logo após emitir
      setActivePrintSlip(newSlip);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao emitir boleto.';
      showNotification('error', msg);
      throw err;
    }
  };

  const handleCancelSlip = async (id: string, reason: string) => {
    try {
      const res = await apiFetch<BankSlip>(`/api/v1/banking/slips/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Erro ao cancelar boleto');
      }

      showNotification('success', 'Boleto cancelado com sucesso e marcado para baixa CNAB.');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cancelar boleto.';
      showNotification('error', msg);
      throw err;
    }
  };

  // Operações de Pix
  const handleCreatePix = async (data: {
    customerName: string;
    customerDocument: string;
    amount: number;
    description?: string;
    keyType?: PixKeyType;
    key?: string;
  }) => {
    try {
      const res = await apiFetch<PixCharge>('/api/v1/banking/pix/charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Erro ao gerar Pix');
      }

      const newCharge = res.data;
      showNotification('success', `Cobrança Pix TXID ${newCharge.txid} gerada com sucesso!`);
      await loadData();
      setActiveQrCodePix(newCharge);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar cobrança Pix.';
      showNotification('error', msg);
      throw err;
    }
  };

  const handleSimulatePixPayment = async (txid: string) => {
    try {
      const res = await apiFetch<{ settled: boolean; txid: string }>(`/api/v1/banking/pix/charges/${txid}/simulate-payment`, {
        method: 'POST',
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Falha na liquidação Pix');
      }

      showNotification('success', 'Pagamento Pix liquidado instantaneamente no Bacen SPI!');
      await loadData();
      // Atualiza modal ativo se for o mesmo
      if (activeQrCodePix && activeQrCodePix.txid === txid) {
        const updatedRes = await apiFetch<PixCharge[]>(`/api/v1/banking/pix/charges`);
        const found = updatedRes.data?.find((c: PixCharge) => c.txid === txid);
        if (found) setActiveQrCodePix(found);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na liquidação simulada.';
      showNotification('error', msg);
      throw err;
    }
  };

  // Operações CNAB
  const handleGenerateRemessa = async (data: {
    bankAccountId: string;
    cnabType: 'CNAB240' | 'CNAB400';
    slipIds?: string[];
  }) => {
    try {
      const res = await apiFetch<CnabFile>('/api/v1/banking/cnab/remessa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Erro ao gerar remessa CNAB');
      }

      const file = res.data;
      showNotification('success', `Arquivo de remessa ${file.filename} gerado com ${file.totalRecords} registros!`);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar remessa.';
      showNotification('error', msg);
      throw err;
    }
  };

  const handleProcessRetorno = async (data: {
    bankAccountId: string;
    fileName: string;
    fileContent: string;
  }) => {
    try {
      const res = await apiFetch<{ processedSlips: number; totalAmountSettled: number }>('/api/v1/banking/cnab/retorno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId: data.bankAccountId,
          fileName: data.fileName,
          contentRaw: data.fileContent,
        }),
      });

      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Erro ao processar arquivo de retorno');
      }

      const result = res.data;
      showNotification(
        'success',
        `Retorno processado! ${result.processedSlips} título(s) baixados no valor de ${result.totalAmountSettled.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
      );
      await loadData();
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar retorno.';
      showNotification('error', msg);
      throw err;
    }
  };

  // Operações de Régua de Cobrança
  const handleCreateRule = async (data: {
    name: string;
    triggerDays: number;
    channel: DunningChannel;
    templateSubject?: string;
    templateBody: string;
    includePix: boolean;
    includeBoleto: boolean;
    isActive: boolean;
  }) => {
    try {
      const res = await apiFetch<CollectionDunningRule>('/api/v1/banking/dunning-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Erro ao criar regra de cobrança');
      }

      showNotification('success', 'Regra de cobrança cadastrada com sucesso!');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar regra.';
      showNotification('error', msg);
      throw err;
    }
  };

  const handleToggleRule = async (id: string, isActive: boolean) => {
    try {
      const res = await apiFetch<CollectionDunningRule>(`/api/v1/banking/dunning-rules/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Erro ao alterar status da regra');
      }

      showNotification('success', `Regra ${isActive ? 'ativada' : 'desativada'} com sucesso.`);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao alterar status.';
      showNotification('error', msg);
      throw err;
    }
  };

  const handleExecuteDunning = async () => {
    try {
      const res = await apiFetch<{ dispatchedCount: number; logs: string[] }>('/api/v1/banking/dunning-rules/execute', {
        method: 'POST',
      });

      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Erro ao disparar régua');
      }

      const result = res.data;
      showNotification('success', `Régua executada! ${result.dispatchedCount} mensagens despachadas.`);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao executar régua.';
      showNotification('error', msg);
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Superior do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 shadow-inner">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Cobrança Bancária & Pix</h1>
              <span className="rounded bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                PRD 09
              </span>
              <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                Febraban CNAB 240 / 400 • Bacen SPI
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Emissão de Boletos Híbridos com QR Code Pix, Remessa e Retorno Automatizados e Régua de Cobrança Multicanal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeCompany && (
            <div className="hidden lg:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">
              <Building2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-medium">{activeCompany.tradeName}</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-[11px] text-emerald-400 flex items-center gap-1">
                <Database className="h-3 w-3" />
                {activeSchema}
              </span>
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            title="Sincronizar carteira de cobrança"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Alerta de Notificação / Toast */}
      {notification && (
        <div
          className={`flex items-center justify-between rounded-xl border p-4 text-xs shadow-lg transition-all ${
            notification.type === 'success'
              ? 'border-emerald-800 bg-emerald-950/80 text-emerald-200'
              : 'border-rose-800 bg-rose-950/80 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white text-sm ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Abas de Navegação Interna */}
      <div className="flex gap-2 border-b border-slate-800/80 pb-px overflow-x-auto scrollbar-none">
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
            currentTab === 'dashboard'
              ? 'border-emerald-500 text-white bg-slate-900/40 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Indicadores & Métricas</span>
        </button>

        <button
          onClick={() => setCurrentTab('slips')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
            currentTab === 'slips'
              ? 'border-emerald-500 text-white bg-slate-900/40 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <Barcode className="h-4 w-4 text-blue-400" />
          <span>Boletos Bancários</span>
          <span className="ml-1 rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300">
            {slips.length}
          </span>
        </button>

        <button
          onClick={() => setCurrentTab('pix')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
            currentTab === 'pix'
              ? 'border-emerald-500 text-white bg-slate-900/40 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <QrCode className="h-4 w-4 text-emerald-400" />
          <span>Pix Dinâmico</span>
          <span className="ml-1 rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300">
            {pixCharges.length}
          </span>
        </button>

        <button
          onClick={() => setCurrentTab('cnab')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
            currentTab === 'cnab'
              ? 'border-emerald-500 text-white bg-slate-900/40 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4 text-indigo-400" />
          <span>Remessa & Retorno CNAB</span>
          <span className="ml-1 rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300">
            {cnabFiles.length}
          </span>
        </button>

        <button
          onClick={() => setCurrentTab('dunning')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
            currentTab === 'dunning'
              ? 'border-emerald-500 text-white bg-slate-900/40 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <BellRing className="h-4 w-4 text-amber-400" />
          <span>Régua de Cobrança</span>
          <span className="ml-1 rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300">
            {dunningRules.length}
          </span>
        </button>
      </div>

      {/* Conteúdo da Aba Selecionada */}
      <div className="pt-1">
        {currentTab === 'dashboard' && (
          <BankingDashboardTab
            metrics={metrics}
            onNavigateTab={(tab) => setCurrentTab(tab as any)}
            onOpenNewBoleto={() => setCurrentTab('slips')}
            onOpenNewPix={() => setCurrentTab('pix')}
            onOpenRemessa={() => setCurrentTab('cnab')}
            onOpenRetorno={() => setCurrentTab('cnab')}
          />
        )}

        {currentTab === 'slips' && (
          <BankSlipsTab
            slips={slips}
            partners={partners}
            bankAccounts={bankAccounts}
            isLoading={isLoading}
            onOpenPrintModal={(slip) => setActivePrintSlip(slip)}
            onCreateSlip={handleCreateSlip}
            onCancelSlip={handleCancelSlip}
            canCreate={canOperate}
            canCancel={canOperate}
          />
        )}

        {currentTab === 'pix' && (
          <PixChargesTab
            charges={pixCharges}
            partners={partners}
            isLoading={isLoading}
            onOpenQrCodeModal={(charge) => setActiveQrCodePix(charge)}
            onCreatePix={handleCreatePix}
            onSimulatePayment={handleSimulatePixPayment}
            canCreate={canOperate}
            canSimulate={canOperate}
          />
        )}

        {currentTab === 'cnab' && (
          <CnabFilesTab
            files={cnabFiles}
            bankAccounts={bankAccounts}
            isLoading={isLoading}
            onGenerateRemessa={handleGenerateRemessa}
            onProcessRetorno={handleProcessRetorno}
            canGenerate={canOperate}
            canProcess={canOperate}
          />
        )}

        {currentTab === 'dunning' && (
          <DunningRulesTab
            rules={dunningRules}
            slips={slips}
            isLoading={isLoading}
            onCreateRule={handleCreateRule}
            onToggleRule={handleToggleRule}
            onExecuteDunning={handleExecuteDunning}
            canManage={canManage}
          />
        )}
      </div>

      {/* Modais Globais de Cobrança */}
      {activePrintSlip && (
        <BoletoPrintModal slip={activePrintSlip} onClose={() => setActivePrintSlip(null)} />
      )}

      {activeQrCodePix && (
        <PixQrCodeModal
          charge={activeQrCodePix}
          onClose={() => setActiveQrCodePix(null)}
          onSimulatePayment={handleSimulatePixPayment}
        />
      )}
    </div>
  );
};
