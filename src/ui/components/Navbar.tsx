/**
 * Enlace ERP - Barra de Navegação Superior (Header / Navbar)
 * PRD 01 & PRD 02 - Fundação, Multi-Tenant, Identidade e Governança RBAC
 */

import React from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import {
  ShieldCheck,
  Building2,
  Database,
  UserCheck,
  LogOut,
  RefreshCw,
  LayoutDashboard,
  Users,
  Shield,
  Laptop,
  KeyRound,
  ShieldAlert,
  Layers,
  FileText,
  Sliders,
  CheckCircle2,
  ShoppingCart,
  DollarSign,
  FolderTree,
  Receipt,
  Boxes,
  Landmark,
  Truck,
  Banknote,
  HelpCircle,
  Rocket,
  Search,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onSwitchCompany: () => void;
  onOpenCommandPalette?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onSwitchCompany,
  onOpenCommandPalette,
}) => {
  const { user, activeCompany, activeMembership, activeSchema, logout, companies } = useAuth();
  const isMac =
    typeof window !== 'undefined' &&
    window.navigator &&
    /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'owner':
        return 'bg-amber-950/60 text-amber-300 border-amber-800/60';
      case 'admin':
        return 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60';
      case 'manager':
        return 'bg-blue-950/60 text-blue-300 border-blue-800/60';
      case 'operator':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'viewer':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'owner':
        return 'Proprietário (Owner)';
      case 'admin':
        return 'Admin Operacional';
      case 'manager':
        return 'Gestor (Manager)';
      case 'operator':
        return 'Operador';
      case 'viewer':
        return 'Auditor / Viewer';
      default:
        return role?.toUpperCase() || 'Membro';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      {/* Faixa Superior: Identidade da Plataforma e Contexto do Tenant */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Identidade Enlace ERP */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-slate-950 shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight text-white">ENLACE ERP</span>
              <span className="rounded bg-emerald-950 border border-emerald-800/70 px-1.5 py-0.2 text-[10px] font-bold text-emerald-400">
                PRD 01 a 09
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Multi-Tenant • Comercial, Estoque, Fiscal, Compras & Cobrança Bancária</p>
          </div>
        </div>

        {/* Botão de Busca Rápida / Command Palette (Spotlight) */}
        <button
          id="nav-spotlight-search-btn"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-400 hover:border-emerald-500/50 hover:text-slate-200 hover:bg-slate-800/80 transition-all shadow-sm group"
          title="Abrir Busca Spotlight e Paleta de Comandos (Cmd+K / Ctrl+K)"
        >
          <Search className="h-3.5 w-3.5 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
          <span className="hidden xl:inline text-slate-300">Buscar módulos, clientes, vendas, NF-e...</span>
          <span className="hidden sm:inline xl:hidden text-slate-300">Buscar no ERP...</span>
          <span className="inline sm:hidden text-slate-300">Buscar</span>
          <kbd className="hidden sm:inline-flex items-center rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 group-hover:border-slate-700 group-hover:text-slate-300">
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </button>

        {/* Empresa Ativa & Schema Isolado */}
        {activeCompany && (
          <div className="hidden md:flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs shadow-inner">
            <Building2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <div className="flex flex-col">
              <span className="font-medium text-slate-200 truncate max-w-[200px]">
                {activeCompany.legalName}
              </span>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>CNPJ: {activeCompany.cnpj}</span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 font-mono text-emerald-400/90">
                  <Database className="h-3 w-3" />
                  {activeSchema}
                </span>
              </div>
            </div>

            {companies.length > 1 && (
              <button
                onClick={onSwitchCompany}
                className="ml-2 flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                title="Alternar contexto de empresa ativa"
              >
                <RefreshCw className="h-3 w-3" />
                Trocar CNPJ
              </button>
            )}
          </div>
        )}

        {/* Usuário e Logout */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-200">{user?.name}</span>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <span
                className={`inline-block rounded border px-1.5 py-0.2 text-[10px] font-medium ${getRoleBadgeStyle(
                  activeMembership?.role
                )}`}
              >
                {getRoleLabel(activeMembership?.role)}
              </span>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-rose-400 transition-colors"
            title="Encerrar Sessão"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Faixa Inferior: Navegação de Abas do PRD 01 & PRD 02 */}
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 scrollbar-none">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'dashboard'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Visão Geral
        </button>

        <button
          onClick={() => onTabChange('masterdata')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'masterdata'
              ? 'border-indigo-500 text-white font-semibold'
              : 'border-transparent text-indigo-400/90 hover:text-indigo-300'
          }`}
        >
          <FolderTree className="h-3.5 w-3.5" />
          Cadastros & Contábil (PRD 03)
        </button>

        <button
          onClick={() => onTabChange('commercial')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'commercial'
              ? 'border-emerald-500 text-white font-semibold'
              : 'border-transparent text-emerald-400/90 hover:text-emerald-300'
          }`}
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Comercial & Operações (PRD 04)
        </button>

        <button
          onClick={() => onTabChange('financial')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'financial'
              ? 'border-emerald-500 text-white font-semibold'
              : 'border-transparent text-blue-400 hover:text-blue-300'
          }`}
        >
          <DollarSign className="h-3.5 w-3.5" />
          Financeiro & Tesouraria
        </button>

        <button
          onClick={() => onTabChange('billing')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'billing'
              ? 'border-emerald-500 text-white font-semibold'
              : 'border-transparent text-emerald-400/90 hover:text-emerald-300'
          }`}
        >
          <Receipt className="h-3.5 w-3.5" />
          Faturamento & Recorrência (PRD 05)
        </button>

        <button
          onClick={() => onTabChange('inventory')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'inventory'
              ? 'border-emerald-500 text-white font-semibold'
              : 'border-transparent text-amber-400/90 hover:text-amber-300'
          }`}
        >
          <Boxes className="h-3.5 w-3.5" />
          Estoque & WMS (PRD 06)
        </button>

        <button
          onClick={() => onTabChange('fiscal')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'fiscal'
              ? 'border-emerald-500 text-white font-semibold'
              : 'border-transparent text-purple-400/90 hover:text-purple-300'
          }`}
        >
          <Landmark className="h-3.5 w-3.5" />
          Fiscal & Tributário (PRD 07)
        </button>

        <button
          onClick={() => onTabChange('procurement')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'procurement'
              ? 'border-emerald-500 text-white font-semibold'
              : 'border-transparent text-cyan-400/90 hover:text-cyan-300'
          }`}
        >
          <Truck className="h-3.5 w-3.5" />
          Compras & Suprimentos (PRD 08)
        </button>

        <button
          onClick={() => onTabChange('banking')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'banking'
              ? 'border-emerald-500 text-white font-semibold'
              : 'border-transparent text-emerald-400/90 hover:text-emerald-300'
          }`}
        >
          <Banknote className="h-3.5 w-3.5" />
          Cobrança & Pix (PRD 09)
        </button>

        <button
          onClick={() => onTabChange('users')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'users'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Membros & Convites
        </button>

        <button
          onClick={() => onTabChange('roles')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'roles'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          Matriz RBAC
        </button>

        <button
          onClick={() => onTabChange('sessions')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'sessions'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Laptop className="h-3.5 w-3.5" />
          Sessões Ativas
        </button>

        <button
          onClick={() => onTabChange('security-profile')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'security-profile'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Segurança & MFA
        </button>

        <button
          onClick={() => onTabChange('security-events')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'security-events'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
          Alarmes de Segurança
        </button>

        <button
          onClick={() => onTabChange('security-test')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'security-test'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          Suíte de Testes (25/25)
        </button>

        <button
          onClick={() => onTabChange('modules')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'modules'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Módulos
        </button>

        <button
          onClick={() => onTabChange('audit')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'audit'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Auditoria
        </button>

        <button
          onClick={() => onTabChange('help')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'help'
              ? 'border-emerald-500 text-white font-semibold'
              : 'border-transparent text-emerald-400 hover:text-emerald-300'
          }`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Ajuda & Suporte
        </button>

        <button
          onClick={() => onTabChange('deploy')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'deploy'
              ? 'border-indigo-500 text-white font-semibold'
              : 'border-transparent text-indigo-400 hover:text-indigo-300'
          }`}
        >
          <Rocket className="h-3.5 w-3.5" />
          Deploy & SRE
        </button>

        <button
          onClick={() => onTabChange('settings')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            currentTab === 'settings'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Configurações
        </button>
      </div>
    </header>
  );
};
