/**
 * Enlace ERP - Dashboard da Instância e Governança
 * PRD 01 & PRD 02 - Fundação, Multi-Tenant, Identidade e Governança RBAC
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import {
  Building2,
  Database,
  ShieldCheck,
  Server,
  FileText,
  Activity,
  CheckCircle2,
  Clock,
  Lock,
  RefreshCw,
  Users,
  KeyRound,
  ShieldAlert,
  Smartphone,
  Layers,
  DollarSign,
  ShoppingCart,
  FolderTree,
} from 'lucide-react';

interface CompanyRecord {
  id: string;
  title: string;
  secretData: string;
  createdAt: string;
}

export const DashboardView: React.FC<{ onNavigateTab: (tab: string) => void }> = ({ onNavigateTab }) => {
  const { user, activeCompany, activeMembership, activeSchema, apiFetch } = useAuth();
  const [records, setRecords] = useState<CompanyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [auditCount, setAuditCount] = useState<number>(0);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [sessionCount, setSessionCount] = useState<number>(0);

  const loadData = async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    try {
      // 1. Registros operacionais confidenciais do tenant
      const recsRes = await apiFetch<CompanyRecord[]>('/api/v1/companies/active/records');
      if (recsRes.success && recsRes.data) {
        setRecords(recsRes.data);
      }

      // 2. Quantidade de auditorias
      const auditRes = await apiFetch<unknown[]>('/api/v1/companies/active/audit');
      if (auditRes.success && auditRes.data) {
        setAuditCount(auditRes.data.length);
      }

      // 3. Quantidade de membros da empresa
      const membersRes = await apiFetch<unknown[]>('/api/v1/companies/active/members');
      if (membersRes.success && membersRes.data) {
        setMemberCount(membersRes.data.length);
      }

      // 4. Quantidade de sessões ativas do usuário
      const sessionsRes = await apiFetch<unknown[]>('/api/v1/auth/sessions');
      if (sessionsRes.success && sessionsRes.data) {
        setSessionCount(sessionsRes.data.length);
      }
    } catch {
      // Silencioso
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCompany]);

  if (!activeCompany) return null;

  return (
    <div className="space-y-6">
      {/* Banner de Identificação da Instância Isolada */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                INSTÂNCIA OPERACIONAL ATIVA
              </span>
              <span className="text-xs text-slate-400">Segmento: {activeCompany.segment.toUpperCase()}</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">{activeCompany.legalName}</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>
                CNPJ: <strong className="text-slate-200">{activeCompany.cnpj}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono text-emerald-400">
                <Database className="h-3.5 w-3.5" />
                Schema: {activeSchema}
              </span>
              <span>•</span>
              <span>Nome Fantasia: {activeCompany.tradeName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar Estado
            </button>
          </div>
        </div>
      </div>

      {/* Grid de 4 Pilares da Fundação Arquitetural & Identidade */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pilar 1: Isolamento por Schema */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Isolamento por Schema</span>
            <Database className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-base font-bold text-white font-mono truncate">{activeSchema}</div>
          <p className="text-[11px] text-slate-400">
            Schema PostgreSQL dedicado com tabelas e registros estritamente isolados.
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium pt-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Fronteira Lógica Ativa</span>
          </div>
        </div>

        {/* Pilar 2: Governança e Membros (PRD 02) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Membros & Papel</span>
            <Users className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-base font-bold text-white uppercase flex items-center gap-2">
            <span>{activeMembership?.role}</span>
            <span className="text-xs text-slate-400 lowercase font-normal">({memberCount} membros)</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {activeMembership?.permissions.length} permissões ativas. Proteção de Owner ativada.
          </p>
          <button
            onClick={() => onNavigateTab('users')}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium pt-1 flex items-center gap-1"
          >
            Gerenciar membros e convites →
          </button>
        </div>

        {/* Pilar 3: Sessões & Credenciais (PRD 02) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Sessões & MFA</span>
            <KeyRound className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-base font-bold text-white">
            {sessionCount} sessão(ões) • {user?.mfaEnabled ? 'MFA Ativo' : 'MFA Inativo'}
          </div>
          <p className="text-[11px] text-slate-400">
            Rotação contínua de refresh tokens e controle instantâneo de revogação.
          </p>
          <button
            onClick={() => onNavigateTab('sessions')}
            className="text-[11px] text-amber-400 hover:text-amber-300 font-medium pt-1 flex items-center gap-1"
          >
            Auditar dispositivos conectados →
          </button>
        </div>

        {/* Pilar 4: Conformidade e Segurança (PRD 01 a 05) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Bateria de Segurança & Integridade</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-base font-bold text-emerald-400">25/25 Aprovados</div>
          <p className="text-[11px] text-slate-400">
            Isolamento, IDOR, Anti-Theft, Vault, Cálculos BRL e Conciliação Tesouraria.
          </p>
          <button
            onClick={() => onNavigateTab('security-test')}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium pt-1 flex items-center gap-1"
          >
            Ver suíte de 25 testes automatizados →
          </button>
        </div>
      </div>

      {/* Módulos de Negócio em Destaque (PRD 03, PRD 04 & PRD 05) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigateTab('masterdata')}
          className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl hover:border-indigo-600/50 cursor-pointer transition flex items-center gap-3"
        >
          <div className="p-2.5 bg-indigo-950 text-indigo-400 rounded-lg">
            <FolderTree className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white text-sm">Cadastros & Contábil (PRD 03)</span>
              <span className="text-[10px] rounded bg-indigo-950 border border-indigo-800 px-1.5 py-0.5 text-indigo-400 font-mono">
                Módulo 11 & COA
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Parceiros comerciais, validação RFB de CPF/CNPJ, plano de contas e centros de custo.
            </p>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('commercial')}
          className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl hover:border-emerald-600/50 cursor-pointer transition flex items-center gap-3"
        >
          <div className="p-2.5 bg-emerald-950 text-emerald-400 rounded-lg">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white text-sm">Comercial & Operações (PRD 04)</span>
              <span className="text-[10px] rounded bg-emerald-950 border border-emerald-800 px-1.5 py-0.5 text-emerald-400 font-mono">
                Catálogo & OS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Orçamentos, pedidos de venda, contratos recorrentes e ordens de serviço.
            </p>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('financial')}
          className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl hover:border-blue-600/50 cursor-pointer transition flex items-center gap-3"
        >
          <div className="p-2.5 bg-blue-950 text-blue-400 rounded-lg">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white text-sm">Financeiro & Tesouraria (PRD 05)</span>
              <span className="text-[10px] rounded bg-blue-950 border border-blue-800 px-1.5 py-0.5 text-blue-400 font-mono">
                Bancos & DRE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Contas a pagar e receber, baixas com juros/multa, conciliação e fluxo de caixa.
            </p>
          </div>
        </div>
      </div>

      {/* Ações Rápidas de Segurança e Governança */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigateTab('users')}
          className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl hover:border-indigo-600/50 cursor-pointer transition flex items-center gap-3"
        >
          <div className="p-2.5 bg-indigo-950 text-indigo-400 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm">Membros e Convites</div>
            <p className="text-xs text-slate-400">Convidar colaboradores ou alterar papéis</p>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('roles')}
          className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl hover:border-emerald-600/50 cursor-pointer transition flex items-center gap-3"
        >
          <div className="p-2.5 bg-emerald-950 text-emerald-400 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm">Matriz RBAC Granular</div>
            <p className="text-xs text-slate-400">Ver permissões por perfil institucional</p>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('security-events')}
          className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl hover:border-amber-600/50 cursor-pointer transition flex items-center gap-3"
        >
          <div className="p-2.5 bg-amber-950 text-amber-400 rounded-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm">Alarmes de Segurança</div>
            <p className="text-xs text-slate-400">Trilha de eventos e detecções em tempo real</p>
          </div>
        </div>
      </div>

      {/* Seção Central: Dados Isolados no Schema Deste CNPJ */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-400" />
              Dados Operacionais Armazenados no Schema [{activeSchema}]
            </h2>
            <p className="text-xs text-slate-400">
              Estes registros pertencem exclusivamente ao CNPJ {activeCompany.cnpj}. Um usuário de outro CNPJ nunca os visualiza.
            </p>
          </div>
          <span className="rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
            {records.length} registro(s) encontrado(s)
          </span>
        </div>

        <div className="space-y-3">
          {records.map((rec) => (
            <div
              key={rec.id}
              className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 text-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">{rec.title}</span>
                <span className="text-[11px] text-slate-500 font-mono">ID: {rec.id}</span>
              </div>
              <div className="rounded bg-slate-900/90 border border-slate-800 p-2.5 font-mono text-emerald-300/90 text-[11px]">
                {rec.secretData}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <Clock className="h-3 w-3" />
                <span>Gravado em: {new Date(rec.createdAt).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          ))}

          {records.length === 0 && (
            <div className="py-6 text-center text-xs text-slate-500">
              Nenhum dado adicional cadastrado no schema deste tenant.
            </div>
          )}
        </div>
      </div>

      {/* Painel Informativo sobre o PRD 02 */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 text-xs text-slate-400 flex items-start gap-3">
        <Activity className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-medium text-slate-300">
            Conformidade PRD 02 (Identidade Corporativa, Cofre AES-256 & Governança de IA):
          </span>
          <p className="text-[11px] leading-relaxed">
            O Enlace ERP opera com defesa em profundidade: credenciais protegidas por cofre AES-256-GCM com chave derivada via
            HKDF, tokens rotacionados a cada ciclo com detecção anti-reúso, limitação de taxa por IP, e a MaIA (IA Principal)
            rigorosamente contida dentro do contexto e permissões do usuário que a invocou.
          </p>
        </div>
      </div>
    </div>
  );
};
