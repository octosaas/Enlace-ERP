/**
 * Enlace ERP - Controle de Módulos por Empresa (PRD 01 - Seção 23)
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { PERMISSIONS } from '../../shared/permissions.js';
import {
  Layers,
  CheckCircle2,
  Lock,
  DollarSign,
  Users,
  FileCheck,
  Package,
  ShoppingCart,
  Receipt,
  AlertCircle,
  RefreshCw,
  Landmark,
  Truck,
  Banknote,
  CreditCard,
} from 'lucide-react';

interface ModuleItem {
  code: string;
  name: string;
  isCore: boolean;
  description: string;
  isEnabled: boolean;
}

export const ModulesView: React.FC = () => {
  const { activeCompany, activeMembership, apiFetch } = useAuth();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const canManageModules = activeMembership?.permissions.includes(
    PERMISSIONS.COMPANY_MANAGE_MODULES
  );

  const loadModules = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<ModuleItem[]>('/api/v1/companies/active/modules');
      if (res.success && res.data) {
        setModules(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, [activeCompany]);

  const toggleModule = async (code: string, currentState: boolean) => {
    if (!canManageModules) return;

    try {
      const res = await apiFetch(`/api/v1/companies/active/modules/${code}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ isEnabled: !currentState }),
      });

      if (res.success) {
        setModules((prev) =>
          prev.map((m) => (m.code === code ? { ...m, isEnabled: !currentState } : m))
        );
        setActionMessage(`Módulo [${code.toUpperCase()}] ${!currentState ? 'ativado' : 'desativado'} com sucesso.`);
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : 'Falha ao alterar módulo');
    }
  };

  const getModuleIcon = (code: string) => {
    switch (code) {
      case 'core':
        return <Lock className="h-5 w-5 text-emerald-400" />;
      case 'finance':
        return <DollarSign className="h-5 w-5 text-emerald-400" />;
      case 'customers':
        return <Users className="h-5 w-5 text-blue-400" />;
      case 'contracts':
        return <FileCheck className="h-5 w-5 text-purple-400" />;
      case 'inventory':
        return <Package className="h-5 w-5 text-amber-400" />;
      case 'sales':
        return <ShoppingCart className="h-5 w-5 text-cyan-400" />;
      case 'billing':
        return <Receipt className="h-5 w-5 text-emerald-400" />;
      case 'fiscal':
        return <Landmark className="h-5 w-5 text-purple-400" />;
      case 'purchases':
        return <Truck className="h-5 w-5 text-indigo-400" />;
      case 'banking':
        return <Banknote className="h-5 w-5 text-emerald-400" />;
      case 'collections':
        return <CreditCard className="h-5 w-5 text-emerald-400" />;
      default:
        return <Layers className="h-5 w-5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-300">
                PRD 01 • SEÇÃO 23
              </span>
              <span className="text-xs text-slate-400">Ativação Modular por CNPJ</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Catálogo de Módulos do ERP</h1>
            <p className="text-xs text-slate-400">
              Cada empresa ativa somente os módulos contratados, mantendo o sistema enxuto e sem ruído operacional.
            </p>
          </div>

          <button
            onClick={loadModules}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Recarregar
          </button>
        </div>

        {/* Notificação de sucesso / RBAC */}
        {actionMessage && (
          <div className="mt-3 rounded-lg border border-emerald-800/80 bg-emerald-950/40 p-2.5 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {!canManageModules && (
          <div className="mt-3 rounded-lg border border-amber-800/80 bg-amber-950/30 p-2.5 text-xs text-amber-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Seu perfil ({activeMembership?.role}) possui permissão de apenas leitura sobre a ativação de módulos. Apenas Proprietários (Owner) podem alterar o provisionamento.
            </span>
          </div>
        )}
      </div>

      {/* Grid de Módulos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <div
            key={m.code}
            className={`rounded-xl border p-4 text-xs space-y-3 transition-colors ${
              m.isEnabled
                ? 'border-slate-800 bg-slate-900/80'
                : 'border-slate-900 bg-slate-950/60 opacity-70'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-slate-800/80 p-2">{getModuleIcon(m.code)}</div>
                <div>
                  <span className="font-semibold text-sm text-white block">{m.name}</span>
                  <span className="text-[11px] text-slate-500 font-mono">código: {m.code}</span>
                </div>
              </div>

              {m.isCore ? (
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                  Obrigatório (Core)
                </span>
              ) : (
                <button
                  onClick={() => toggleModule(m.code, m.isEnabled)}
                  disabled={!canManageModules}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    m.isEnabled
                      ? 'bg-emerald-600 text-slate-950 hover:bg-emerald-500'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  } disabled:opacity-50`}
                >
                  {m.isEnabled ? 'Ativo' : 'Inativo'}
                </button>
              )}
            </div>

            <p className="text-slate-400 text-xs leading-relaxed">{m.description}</p>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80 text-[10px] text-slate-500">
              <span>Fronteira isolada no schema:</span>
              <span className="font-mono text-emerald-400/80">{activeCompany?.schemaNamespace}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
