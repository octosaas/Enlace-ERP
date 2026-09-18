/**
 * Enlace ERP - Tela de Autenticação Segura, MFA e Recuperação
 * PRD 01 & PRD 02 - Seções 14 a 17 (Autenticação, MFA TOTP e Proteção Anti-Enumeração)
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { ShieldCheck, Lock, Mail, ArrowRight, CheckCircle2, Building, AlertCircle, Smartphone, KeyRound } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('contador@enlace.com.br');
  const [password, setPassword] = useState('Enlace#2026!Master');
  const [mfaCode, setMfaCode] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal Esqueci Minha Senha
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotToken, setForgotToken] = useState<string | null>(null);
  const [isSendingForgot, setIsSendingForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const result = await login(email, password, requiresMfa ? mfaCode : undefined);
      if (result.mfaRequired) {
        setRequiresMfa(true);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao autenticar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const setDemoUser = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Enlace#2026!Master');
    setMfaCode('');
    setRequiresMfa(false);
    setErrorMsg(null);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setIsSendingForgot(true);
    setForgotMsg(null);
    setForgotToken(null);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      setForgotMsg(data.data?.message || 'Solicitação enviada.');
      if (data.data?.simulationToken) {
        setForgotToken(data.data.simulationToken);
      }
    } catch {
      setForgotMsg('Se o e-mail estiver cadastrado, as instruções serão enviadas.');
    } finally {
      setIsSendingForgot(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-8 text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      <div className="w-full max-w-md space-y-6">
        {/* Cabeçalho */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-950/50">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">ENLACE ERP</h1>
          <p className="text-sm text-slate-400">
            Plataforma ERP SaaS Multi-Tenant com Isolamento por CNPJ
          </p>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/60 bg-emerald-950/40 px-3 py-0.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Fundação Arquitetural • PRD 01 & PRD 02</span>
          </div>
        </div>

        {/* Card do Formulário */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur">
          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-900/60 bg-rose-950/50 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                E-mail Corporativo
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  disabled={requiresMfa}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="usuario@empresa.com.br"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">Senha</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setShowForgotModal(true);
                  }}
                  className="text-xs text-emerald-400 hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  disabled={requiresMfa}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Segundo Fator: Código TOTP */}
            {requiresMfa && (
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/80 rounded-lg space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <Smartphone className="w-4 h-4" />
                  Segundo Fator (MFA TOTP Requerido)
                </div>
                <p className="text-[11px] text-slate-400">
                  Digite o código de 6 dígitos gerado no seu aplicativo autenticador:
                </p>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center tracking-widest font-mono text-lg py-1.5 bg-slate-950 border border-emerald-600 rounded-lg text-white focus:outline-hidden"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <span>Autenticando sessão...</span>
              ) : requiresMfa ? (
                <>
                  <span>Validar MFA e Entrar</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <span>Entrar no Enlace ERP</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Atalhos para Perfis de Demonstração e Teste do PRD 01 e PRD 02 */}
          <div className="mt-6 border-t border-slate-800 pt-4">
            <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-2.5">
              Contas de Teste Pré-Configuradas (PRD 01 & 02):
            </span>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setDemoUser('contador@enlace.com.br')}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-left text-xs hover:border-emerald-700 hover:bg-slate-950 transition-colors"
              >
                <div>
                  <span className="font-semibold text-slate-200 block">
                    Ana Silva (Contadora Multiempresa)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Acesso legítimo a 2 CNPJs (Alfa e Beta)
                  </span>
                </div>
                <Building className="h-4 w-4 text-emerald-400 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setDemoUser('carlos@alfa.com.br')}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-left text-xs hover:border-emerald-700 hover:bg-slate-950 transition-colors"
              >
                <div>
                  <span className="font-semibold text-slate-200 block">Carlos Santos (Diretor Alfa)</span>
                  <span className="text-[11px] text-slate-400">
                    Proprietário (Owner) • CNPJ 12.345.678/0001-95
                  </span>
                </div>
                <Building className="h-4 w-4 text-amber-400 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setDemoUser('mariana@beta.com.br')}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-left text-xs hover:border-emerald-700 hover:bg-slate-950 transition-colors"
              >
                <div>
                  <span className="font-semibold text-slate-200 block">Mariana Lima (Operadora Beta)</span>
                  <span className="text-[11px] text-slate-400">
                    Operador • CNPJ 98.765.432/0001-10
                  </span>
                </div>
                <Building className="h-4 w-4 text-blue-400 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setDemoUser('suspenso@alfa.com.br')}
                className="flex items-center justify-between rounded-lg border border-rose-950 bg-rose-950/30 p-2.5 text-left text-xs hover:border-rose-700 hover:bg-slate-950 transition-colors"
              >
                <div>
                  <span className="font-semibold text-rose-300 block">Roberto Suspenso (Teste Bloqueio)</span>
                  <span className="text-[11px] text-rose-400">
                    Status SUSPENDED • Teste de Bloqueio PRD 02
                  </span>
                </div>
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal: Recuperação de Senha */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-200 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-lg text-white">Recuperação Segura de Acesso</h3>
              </div>
              <p className="text-xs text-slate-400">
                Pela política anti-enumeração de usuários, a resposta da solicitação é neutra independente do e-mail existir ou não na base.
              </p>

              <form onSubmit={handleForgotPassword} className="space-y-3">
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Digite seu e-mail corporativo"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 px-3 text-sm text-white focus:outline-hidden focus:border-emerald-500"
                />

                {forgotMsg && (
                  <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-lg text-xs text-emerald-300">
                    {forgotMsg}
                  </div>
                )}

                {forgotToken && (
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-400">
                    Token Simulado: <span className="text-emerald-400">{forgotToken}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotMsg(null);
                      setForgotToken(null);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingForgot}
                    className="px-4 py-1.5 bg-emerald-600 text-slate-950 font-semibold text-xs rounded-lg hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {isSendingForgot ? 'Processando...' : 'Enviar Instruções'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Rodapé institucional */}
        <p className="text-center text-[11px] text-slate-500">
          Enlace ERP • Arquitetura Multi-Tenant com Schemas PostgreSQL Isolados
        </p>
      </div>
    </div>
  );
};
