/**
 * Enlace ERP - Gestão de Sessões Ativas e Dispositivos
 * PRD 02 - Seções 12, 13 e 14 (Sessões, Rotação, Logout e Revogação Remota)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { UserSession } from '../../shared/types.js';
import { Laptop, Smartphone, Globe, ShieldAlert, CheckCircle2, AlertCircle, RefreshCw, Power } from 'lucide-react';

export const SessionsView: React.FC = () => {
  const { currentSessionId, apiFetch, logoutAll } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch<UserSession[]>('/api/v1/auth/sessions');
      if (res.success && res.data) {
        setSessions(res.data);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Deseja realmente encerrar esta sessão remotamente?')) return;

    try {
      await apiFetch(`/api/v1/auth/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      setActionSuccess('Sessão remota revogada com sucesso.');
      loadSessions();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleLogoutAllOtherSessions = async () => {
    if (
      !confirm(
        'Atenção: Todas as outras sessões abertas neste ou em outros computadores/celulares serão desconectadas imediatamente. Continuar?'
      )
    ) {
      return;
    }

    try {
      await logoutAll();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const getDeviceIcon = (label: string) => {
    if (label.toLowerCase().includes('móvel') || label.toLowerCase().includes('mobile')) {
      return <Smartphone className="w-5 h-5 text-indigo-500" />;
    }
    if (label.toLowerCase().includes('web') || label.toLowerCase().includes('windows') || label.toLowerCase().includes('mac')) {
      return <Laptop className="w-5 h-5 text-blue-500" />;
    }
    return <Globe className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div id="sessions-management-container" className="space-y-6">
      {/* Topo com ações */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Laptop className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-900">Sessões e Dispositivos Conectados</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Controle de acessos simultâneos, rastreamento de IP e revogação instantânea de credenciais
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSessions}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition border border-slate-200"
            title="Atualizar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            id="btn-revoke-all-sessions"
            onClick={handleLogoutAllOtherSessions}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-sm font-medium rounded-lg transition"
          >
            <Power className="w-4 h-4" />
            Encerrar Todas as Outras Sessões
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          {error}
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {actionSuccess}
        </div>
      )}

      {/* Lista de Sessões */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Sessões Ativas ({sessions.length})
          </h2>
          <span className="text-xs text-slate-500">Tokens com rotação de segurança</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando sessões...</div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Nenhuma sessão ativa encontrada.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((session) => {
              const isCurrent = session.id === currentSessionId || session.isCurrent;
              return (
                <div
                  key={session.id}
                  className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                    isCurrent ? 'bg-indigo-50/40 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs shrink-0">
                      {getDeviceIcon(session.deviceLabel)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-base">{session.deviceLabel}</span>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Sessão Atual
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>IP: <strong className="text-slate-700">{session.ipAddress}</strong></span>
                        <span>•</span>
                        <span>
                          Iniciada em: {new Date(session.createdAt).toLocaleString('pt-BR')}
                        </span>
                        <span>•</span>
                        <span>
                          Última atividade: {new Date(session.lastActivityAt).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 font-mono mt-1.5 truncate max-w-md">
                        ID: {session.id}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isCurrent ? (
                      <span className="text-xs text-indigo-700 font-medium bg-indigo-100/70 px-3 py-1.5 rounded-md">
                        Este Navegador
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRevokeSession(session.id)}
                        className="px-3.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition inline-flex items-center gap-1.5"
                      >
                        <Power className="w-3.5 h-3.5" />
                        Desconectar Dispositivo
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Informação sobre Proteção contra Roubo de Sessão */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-800 font-semibold">Mecanismo Anti-Theft de Refresh Token (PRD 02 - Seção 13):</strong>
          <p className="mt-0.5 leading-relaxed text-slate-600">
            Cada renovação de token invalida o refresh token anterior. Se um invasor interceptar e tentar reutilizar um token já
            consumido, o Enlace ERP acionará o alarme <strong>SECURITY_TOKEN_REUSE_DETECTED</strong> e desconectará imediatamente todas
            as sessões ativas do usuário para proteger a integridade dos dados da empresa.
          </p>
        </div>
      </div>
    </div>
  );
};
