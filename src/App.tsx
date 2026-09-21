/**
 * Enlace ERP - Aplicação Principal
 * PRD 01 & PRD 02 - Fundação, Multi-Tenant, Identidade e Governança RBAC
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './ui/contexts/AuthContext.js';
import { Navbar } from './ui/components/Navbar.js';
import { LoginView } from './ui/views/LoginView.js';
import { CompanySelectorView } from './ui/views/CompanySelectorView.js';
import { DashboardView } from './ui/views/DashboardView.js';
import { SecurityTestView } from './ui/views/SecurityTestView.js';
import { ModulesView } from './ui/views/ModulesView.js';
import { AuditLogView } from './ui/views/AuditLogView.js';
import { SettingsView } from './ui/views/SettingsView.js';
import { UsersManagementView } from './ui/views/UsersManagementView.js';
import { RolesAndPermissionsView } from './ui/views/RolesAndPermissionsView.js';
import { SessionsView } from './ui/views/SessionsView.js';
import { SecurityProfileView } from './ui/views/SecurityProfileView.js';
import { SecurityEventsView } from './ui/views/SecurityEventsView.js';
import { CommercialView } from './ui/views/CommercialView.js';
import { FinancialView } from './ui/views/FinancialView.js';
import { BillingView } from './ui/views/BillingView.js';
import { MasterDataView } from './ui/views/MasterDataView.js';
import { InventoryView } from './ui/views/InventoryView.js';
import { FiscalView } from './ui/views/FiscalView.js';
import { ProcurementView } from './ui/views/ProcurementView.js';
import { BankingView } from './ui/views/BankingView.js';
import { HelpView } from './ui/views/HelpView.js';
import { DeployView } from './ui/views/DeployView.js';
import { ShieldCheck } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, activeCompany, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isSwitchingCompany, setIsSwitchingCompany] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-emerald-400">
            <ShieldCheck className="h-6 w-6 animate-pulse" />
          </div>
          <span className="text-xs font-medium tracking-wide">Carregando Enlace ERP...</span>
        </div>
      </div>
    );
  }

  // 1. Não autenticado -> Exibe Login com suporte a MFA e recuperação
  if (!user) {
    return <LoginView />;
  }

  // 2. Autenticado mas sem contexto de empresa selecionado (ou em alternância) -> Seletor de CNPJ
  if (!activeCompany || isSwitchingCompany) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="mx-auto max-w-7xl p-4 flex justify-end">
          {activeCompany && isSwitchingCompany && (
            <button
              onClick={() => setIsSwitchingCompany(false)}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Voltar para {activeCompany.tradeName}
            </button>
          )}
        </div>
        <CompanySelectorView onCompanySelected={() => setIsSwitchingCompany(false)} />
      </div>
    );
  }

  // 3. Autenticado com Empresa Ativa e Schema Isolado
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onSwitchCompany={() => setIsSwitchingCompany(true)}
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        {currentTab === 'dashboard' && <DashboardView onNavigateTab={setCurrentTab} />}
        {currentTab === 'masterdata' && <MasterDataView />}
        {currentTab === 'commercial' && <CommercialView />}
        {currentTab === 'financial' && <FinancialView />}
        {currentTab === 'billing' && <BillingView />}
        {currentTab === 'inventory' && <InventoryView />}
        {currentTab === 'fiscal' && <FiscalView />}
        {currentTab === 'procurement' && <ProcurementView />}
        {currentTab === 'banking' && <BankingView />}
        {currentTab === 'users' && <UsersManagementView />}
        {currentTab === 'roles' && <RolesAndPermissionsView />}
        {currentTab === 'sessions' && <SessionsView />}
        {currentTab === 'security-profile' && <SecurityProfileView />}
        {currentTab === 'security-events' && <SecurityEventsView />}
        {currentTab === 'security-test' && <SecurityTestView />}
        {currentTab === 'modules' && <ModulesView />}
        {currentTab === 'audit' && <AuditLogView />}
        {currentTab === 'help' && <HelpView />}
        {currentTab === 'deploy' && <DeployView />}
        {currentTab === 'settings' && <SettingsView />}
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span>Enlace ERP • Arquitetura Multi-Tenant com Isolamento por CNPJ</span>
            <span className="text-slate-700">•</span>
            <button
              onClick={() => setCurrentTab('help')}
              className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
            >
              Central de Ajuda
            </button>
            <span className="text-slate-700">•</span>
            <button
              onClick={() => setCurrentTab('deploy')}
              className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
            >
              Deploy & SRE
            </button>
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            Fase Atual: PRD 01 a 09 (Multi-Tenant, Governança RBAC, Cadastros, Comercial, Financeiro, Faturamento, Estoque/WMS, Fiscal, Compras & Cobrança Bancária/Pix)
          </span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
