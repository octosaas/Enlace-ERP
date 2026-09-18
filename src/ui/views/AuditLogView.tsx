/**
 * Enlace ERP - Visualizador da Trilha de Auditoria (PRD 01 - Seção 17)
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { AuditLogEntry } from '../../shared/types.js';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const { activeCompany, apiFetch } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<AuditLogEntry[]>('/api/v1/companies/active/audit');
      if (res.success && res.data) {
        setLogs(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [activeCompany]);

  const filteredLogs = logs.filter((log) => {
    const matchesStatus = filterStatus === 'ALL' || log.status === filterStatus;
    const matchesSearch =
      !searchTerm ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.userEmail && log.userEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.requestId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Sucesso
          </span>
        );
      case 'DENIED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-950/80 border border-amber-800/80 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            <AlertTriangle className="h-3 w-3" /> Negado (IDOR/RBAC)
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-950/80 border border-rose-800/80 px-2 py-0.5 text-[10px] font-medium text-rose-300">
            <XCircle className="h-3 w-3" /> Falha
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-purple-950 border border-purple-800 px-2 py-0.5 text-xs font-semibold text-purple-400">
                PRD 01 • SEÇÃO 17
              </span>
              <span className="text-xs text-slate-400">Trilha de Auditoria e Conformidade</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Registro Imutável de Eventos
            </h1>
            <p className="text-xs text-slate-400">
              Eventos de autenticação, acessos a dados, tentativas de violação e alterações do CNPJ {activeCompany?.cnpj}.
            </p>
          </div>

          <button
            onClick={loadAuditLogs}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar Trilha
          </button>
        </div>

        {/* Filtros */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3 border-t border-slate-800 pt-4 text-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por ação, recurso, e-mail ou Request ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
            >
              <option value="ALL">Todos os Resultados</option>
              <option value="SUCCESS">Apenas Sucessos</option>
              <option value="DENIED">Apenas Negados (IDOR / RBAC)</option>
              <option value="FAILED">Apenas Falhas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Registros */}
      <div className="space-y-3">
        {filteredLogs.map((log) => (
          <div
            key={log.id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {getStatusBadge(log.status)}
                <span className="font-semibold text-white font-mono">{log.action}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{log.resource}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Clock className="h-3 w-3" />
                <span>{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-2 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <div>
                <span>Usuário: </span>
                <strong className="text-slate-300 font-normal">
                  {log.userEmail || 'Sistema / Não autenticado'}
                </strong>
              </div>
              <div className="truncate">
                <span>Request ID: </span>
                <span className="font-mono text-purple-300/80">{log.requestId}</span>
              </div>
            </div>

            {log.details && Object.keys(log.details).length > 0 && (
              <div className="rounded bg-slate-950 p-2 text-[11px] font-mono text-slate-400 border border-slate-850 overflow-x-auto">
                {JSON.stringify(log.details)}
              </div>
            )}
          </div>
        ))}

        {filteredLogs.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-8 text-center text-xs text-slate-500">
            Nenhum registro de auditoria corresponde aos filtros selecionados.
          </div>
        )}
      </div>
    </div>
  );
};
