/**
 * Enlace ERP - Trilha Centralizada de Eventos de Segurança Corporativos
 * PRD 02 - Seções 28, 29, 30 e 31 (Eventos de Segurança, Severidade e Mitigação)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { SecurityEvent } from '../../shared/types.js';
import { ShieldAlert, AlertTriangle, RefreshCw, Filter, CheckCircle2, ShieldCheck, Terminal } from 'lucide-react';

export const SecurityEventsView: React.FC = () => {
  const { apiFetch } = useAuth();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const loadSecurityEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch<SecurityEvent[]>('/api/v1/system/security-events');
      if (res.success && res.data) {
        setEvents(res.data);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadSecurityEvents();
  }, [loadSecurityEvents]);

  const filteredEvents = events.filter((e) => {
    if (severityFilter === 'ALL') return true;
    return e.severity === severityFilter;
  });

  const getSeverityBadge = (sev: SecurityEvent['severity']) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-900 border-red-300 font-bold animate-pulse';
      case 'HIGH':
        return 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'LOW':
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div id="security-events-container" className="space-y-6">
      {/* Topo */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-600" />
            <h1 className="text-xl font-bold text-slate-900">Eventos e Alarmes de Segurança</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Auditoria em tempo real de tentativas de invasão, IDOR, brute-force e violações de RBAC
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-transparent font-medium text-slate-700 outline-hidden"
            >
              <option value="ALL">Todas as Severidades</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <button
            onClick={loadSecurityEvents}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition border border-slate-200"
            title="Atualizar eventos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          {error}
        </div>
      )}

      {/* Lista de Eventos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Log de Detecções de Segurança ({filteredEvents.length})
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Vigilância Ativa dos Middlewares
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando eventos de segurança...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <span>Nenhum alarme de segurança registrado no período. Todos os nós operando em conformidade.</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEvents.map((evt) => (
              <div key={evt.id} className="p-5 hover:bg-slate-50 transition space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs border ${getSeverityBadge(
                        evt.severity
                      )}`}
                    >
                      {evt.severity}
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-900">{evt.type}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(evt.timestamp).toLocaleString('pt-BR')}
                  </span>
                </div>

                <p className="text-sm text-slate-700">
                  {typeof evt.details?.reason === 'string'
                    ? evt.details.reason
                    : typeof evt.details?.action === 'string'
                    ? `Ação auditada: ${evt.details.action}`
                    : `Detecção do evento ${evt.type} mitigado pelo sistema.`}
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span>ReqID: <span className="text-slate-800">{evt.requestId}</span></span>
                  {evt.userEmail && <span>Usuário: <span className="text-slate-800">{evt.userEmail}</span></span>}
                  {evt.ipAddress && <span>IP: <span className="text-slate-800">{evt.ipAddress}</span></span>}
                  {Boolean(evt.details?.targetCompanyId) && (
                    <span>Empresa Alvo: <span className="text-slate-800">{String(evt.details.targetCompanyId)}</span></span>
                  )}
                  {Boolean(evt.details?.requiredPermission) && (
                    <span>Permissão Requerida: <span className="text-indigo-700 font-semibold">{String(evt.details.requiredPermission)}</span></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nota técnica sobre mitigação automática */}
      <div className="bg-slate-900 text-slate-300 p-5 rounded-xl text-xs space-y-2">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Terminal className="w-4 h-4 text-indigo-400" />
          Resposta Automática a Incidentes (Defense-in-Depth):
        </div>
        <p className="text-slate-400 leading-relaxed">
          Os eventos acima são gerados diretamente pela camada de middlewares (`authMiddleware`, `tenantMiddleware`,
          `rbacMiddleware`) e pelo motor criptográfico. Tentativas de força bruta acionam banimento temporário por IP
          (RateLimiter), e tentativas de reutilização de token revogado desvalidam imediatamente todas as credenciais do usuário.
        </p>
      </div>
    </div>
  );
};
