/**
 * Enlace ERP - MaIA v2 (Inteligência Artificial Corporativa Delegada)
 * PRD 02 - Seções 35 e 36: Interface Operacional, Catálogo de Ferramentas, Confirmação e Auditoria
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import {
  Bot,
  Send,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  KeyRound,
  RefreshCw,
  Search,
  Database,
  ArrowRight,
  Terminal,
  Activity,
  History,
  Lock,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    name: string;
    arguments: any;
    result?: any;
    riskLevel?: string;
  }>;
  pendingConfirmation?: {
    token: string;
    actionName: string;
    parameters: any;
    expiresAt: string;
    riskLevel: string;
  };
  metrics?: {
    model: string;
    profile: string;
    provider: string;
    latencyMs: number;
    tokens?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
}

interface AuthorizedTool {
  name: string;
  description: string;
  category: string;
  riskLevel: string;
  requiresConfirmation: boolean;
  parameters: any;
}

interface AIAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  userId: string;
  cleanCnpj: string;
  provider: string;
  model: string;
  profile: string;
  toolCalls: string[];
  latencyMs: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  status: 'SUCCESS' | 'DENIED' | 'FAILED';
  securityViolation?: string;
}

export const MaiaView: React.FC = () => {
  const { user, activeCompany, activeMembership, activeSchema, apiFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'tools' | 'audit' | 'diagnostics'>('chat');

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: `Olá, ${user?.name || 'Gestor'}! Sou a **MaIA v2**, a inteligência operacional corporativa nativa do **Enlace ERP**.

Estou atuando sob sua delegação no ambiente isolado da empresa **${activeCompany?.tradeName || 'Ativa'}** (Schema: \`${activeSchema}\`).

Como posso auxiliar na sua rotina de negócios hoje? Você pode me solicitar consultas de fluxo de caixa, clientes, faturamentos, inventário ou emitir cobranças com aprovação controlada.`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<'economic' | 'balanced' | 'high_capacity'>('balanced');
  const [isSending, setIsSending] = useState(false);
  const [sessionId] = useState(() => `ses-maia-ui-${Date.now()}`);

  // Tools & Health State
  const [tools, setTools] = useState<AuthorizedTool[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [healthInfo, setHealthInfo] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AIAuditEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [confirmationStatus, setConfirmationStatus] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    loadTools();
    loadHealth();
  }, [activeCompany?.id]);

  const loadTools = async () => {
    setIsLoadingTools(true);
    try {
      const resp = await apiFetch<AuthorizedTool[]>('/api/v1/maia/tools');
      if (resp.success && resp.data) {
        setTools(resp.data);
      }
    } catch (err) {
      console.error('Erro ao carregar ferramentas da MaIA:', err);
    } finally {
      setIsLoadingTools(false);
    }
  };

  const loadHealth = async () => {
    try {
      const resp = await apiFetch<any>('/api/v1/maia/health');
      if (resp.success && resp.data) {
        setHealthInfo(resp.data);
      }
    } catch (err) {
      console.error('Erro ao verificar saúde da IA:', err);
    }
  };

  const loadAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const resp = await apiFetch<AIAuditEntry[]>('/api/v1/maia/audit?limit=50');
      if (resp.success && resp.data) {
        setAuditLogs(resp.data);
      }
    } catch (err) {
      console.error('Erro ao buscar auditoria da MaIA:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, promptOverride?: string) => {
    if (e) e.preventDefault();
    const promptToSend = promptOverride || inputPrompt;
    if (!promptToSend.trim() || isSending) return;

    const userMessage: ChatMessage = {
      id: `msg-usr-${Date.now()}`,
      role: 'user',
      content: promptToSend,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!promptOverride) setInputPrompt('');
    setIsSending(true);

    try {
      const resp = await apiFetch<any>('/api/v1/maia/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: promptToSend,
          sessionId,
          modelProfile: selectedProfile,
        }),
      });

      if (resp.success && resp.data) {
        const assistantMessage: ChatMessage = {
          id: `msg-ast-${Date.now()}`,
          role: 'assistant',
          content: resp.data.message,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          toolCalls: resp.data.toolCalls,
          pendingConfirmation: resp.data.pendingConfirmation,
          metrics: {
            model: resp.data.model,
            profile: resp.data.profile,
            provider: resp.data.provider,
            latencyMs: resp.data.latencyMs,
            tokens: resp.data.tokens,
          },
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errorMessage: ChatMessage = {
          id: `msg-err-${Date.now()}`,
          role: 'system',
          content: `⚠️ Não foi possível processar o comando: ${resp.error?.message || 'Erro desconhecido.'}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'system',
        content: `⚠️ Falha de comunicação: ${err.message || 'Erro na requisição.'}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmAction = async (token: string, confirmed: boolean) => {
    setConfirmationStatus('Processando confirmação com segurança...');
    try {
      const resp = await apiFetch<any>('/api/v1/maia/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, confirmed }),
      });

      if (resp.success && resp.data) {
        const systemMessage: ChatMessage = {
          id: `msg-cnf-${Date.now()}`,
          role: 'system',
          content: confirmed
            ? `✅ **Ação Confirmada e Executada com Sucesso!**\n\nFerramenta: \`${resp.data.actionName}\`\nResultado: ${JSON.stringify(resp.data.result, null, 2)}`
            : `❌ **Ação Cancelada pelo Usuário.** Nenhuma modificação foi efetuada.`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, systemMessage]);
      } else {
        alert(resp.error?.message || 'Erro ao processar confirmação.');
      }
    } catch (err: any) {
      alert(`Falha ao submeter confirmação: ${err.message}`);
    } finally {
      setConfirmationStatus(null);
    }
  };

  const samplePrompts = [
    {
      label: 'Consultar Clientes',
      prompt: 'Quais são os clientes cadastrados na empresa e seus status atuais?',
    },
    {
      label: 'Contas a Receber',
      prompt: 'Qual o valor total de títulos a receber pendentes e vencidos?',
    },
    {
      label: 'Fluxo de Caixa',
      prompt: 'Apresente uma previsão do fluxo de caixa e saldo projetado.',
    },
    {
      label: 'Estoque & CMP',
      prompt: 'Verifique o saldo em estoque dos produtos e seus custos médios ponderados (CMP).',
    },
    {
      label: 'Criar Cobrança (Ação Controlada)',
      prompt: 'Crie uma cobrança no valor de R$ 350,00 para o cliente com vencimento em 10 dias.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header com Status do Contexto e Provedores */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-slate-950 shadow-md">
            <Bot className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">MaIA v2</h1>
              <span className="rounded-full bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                AI Principal Delegada
              </span>
              <span className="rounded-full bg-indigo-950/80 border border-indigo-700/60 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
                PRD 02 • Seções 35 & 36
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Isolamento Estrito por CNPJ: <span className="font-mono text-emerald-400">{activeSchema}</span> • Governança RBAC: <span className="text-slate-300">{activeMembership?.role?.toUpperCase()}</span>
            </p>
          </div>
        </div>

        {/* Badges de Status do Provedor e Roteamento */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 font-medium text-slate-300">
            <Cpu className="h-4 w-4 text-emerald-400" />
            <span>Provedor:</span>
            <span className="text-emerald-400 font-semibold">
              {healthInfo?.activeProvider?.name || 'Google Gemini Native'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 font-medium text-slate-300">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            <span>SQL Livre:</span>
            <span className="text-rose-400 font-semibold">BLOQUEADO (Zero SQL)</span>
          </div>
        </div>
      </div>

      {/* Navegação Secundária da MaIA */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'chat'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bot className="h-4 w-4 text-emerald-400" />
          Terminal Conversacional
        </button>

        <button
          onClick={() => {
            setActiveTab('tools');
            loadTools();
          }}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'tools'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="h-4 w-4 text-indigo-400" />
          Ferramentas Autorizadas ({tools.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('audit');
            loadAuditLogs();
          }}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'audit'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="h-4 w-4 text-amber-400" />
          Trilha de Auditoria IA
        </button>

        <button
          onClick={() => {
            setActiveTab('diagnostics');
            loadHealth();
          }}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'diagnostics'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="h-4 w-4 text-teal-400" />
          Diagnóstico & Roteamento
        </button>
      </div>

      {/* TAB 1: TERMINAL CONVERSACIONAL */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Coluna Principal: Chat Box */}
          <div className="lg:col-span-3 flex flex-col h-[650px] rounded-2xl border border-slate-800 bg-slate-900/40 shadow-xl overflow-hidden backdrop-blur">
            {/* Top Bar do Chat: Seleção de Perfil */}
            <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                <span>Perfil de Execução:</span>
                <select
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value as any)}
                  className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 font-medium text-emerald-300 focus:outline-none focus:border-emerald-500"
                >
                  <option value="economic">Econômico (Gemini Flash-Lite / 8b)</option>
                  <option value="balanced">Balanceado (Gemini 2.5 Flash - Padrão)</option>
                  <option value="high_capacity">Alta Capacidade (Gemini 2.5 Pro)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                <span>Session: {sessionId.slice(0, 18)}...</span>
              </div>
            </div>

            {/* Lista de Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-slate-950 font-medium rounded-tr-none'
                        : msg.role === 'assistant'
                        ? 'bg-slate-800/90 text-slate-100 border border-slate-700/60 rounded-tl-none'
                        : 'bg-rose-950/40 text-rose-200 border border-rose-800/60 rounded-tl-none'
                    }`}
                  >
                    {/* Header da Mensagem */}
                    <div className="flex items-center justify-between gap-4 mb-1 text-[11px] opacity-75">
                      <span className="font-semibold">
                        {msg.role === 'user' ? 'Você' : msg.role === 'assistant' ? 'MaIA' : 'Segurança / Guardrail'}
                      </span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {/* Conteúdo em Texto */}
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {/* Exibição de Chamadas de Ferramentas */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-700/50 space-y-2">
                        <div className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                          <Terminal className="h-3 w-3" />
                          <span>Ferramenta Invocada: {msg.toolCalls[0].name}</span>
                        </div>
                        {msg.toolCalls[0].result && (
                          <div className="rounded bg-slate-950/70 p-2 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-36">
                            <pre>{JSON.stringify(msg.toolCalls[0].result, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Banner de Confirmação em Duas Fases */}
                    {msg.pendingConfirmation && (
                      <div className="mt-4 rounded-xl border border-amber-500/60 bg-amber-950/40 p-3 text-amber-200 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-xs text-amber-300">
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                          <span>Ação de Alto Risco Requer Confirmação Explícita</span>
                        </div>
                        <p className="text-xs text-amber-200/90">
                          A MaIA solicitou a execução de <code className="bg-amber-900/50 px-1 py-0.5 rounded text-amber-300">{msg.pendingConfirmation.actionName}</code> com os parâmetros fornecidos.
                        </p>
                        <div className="rounded bg-slate-950/80 p-2 font-mono text-[11px] text-amber-100 overflow-x-auto">
                          <pre>{JSON.stringify(msg.pendingConfirmation.parameters, null, 2)}</pre>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleConfirmAction(msg.pendingConfirmation!.token, true)}
                            disabled={!!confirmationStatus}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Confirmar & Executar
                          </button>
                          <button
                            onClick={() => handleConfirmAction(msg.pendingConfirmation!.token, false)}
                            disabled={!!confirmationStatus}
                            className="flex items-center gap-1.5 rounded-lg bg-rose-950 border border-rose-800 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Rejeitar Ação
                          </button>
                          {confirmationStatus && (
                            <span className="text-[11px] text-amber-400 animate-pulse">{confirmationStatus}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Métricas de Observabilidade */}
                    {msg.metrics && (
                      <div className="mt-2 pt-1 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-700/30">
                        <span>
                          {msg.metrics.provider} • {msg.metrics.model}
                        </span>
                        <span>{msg.metrics.latencyMs}ms • {msg.metrics.tokens?.totalTokens || 0} tokens</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium animate-pulse">
                  <Bot className="h-4 w-4" />
                  <span>MaIA está consultando serviços corporativos e gerando resposta...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Box de Envio */}
            <form onSubmit={handleSendMessage} className="border-t border-slate-800 bg-slate-950/80 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder="Pergunte à MaIA sobre clientes, fluxo de caixa, estoque, vendas ou cobranças..."
                  disabled={isSending}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || isSending}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-slate-950 font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Coluna Lateral: Atalhos e Guardrails */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                Sugestões Rápidas
              </h3>
              <div className="space-y-2">
                {samplePrompts.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(undefined, item.prompt)}
                    className="w-full text-left rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 text-xs text-slate-300 hover:border-emerald-500/50 hover:bg-slate-800/60 hover:text-white transition-all group"
                  >
                    <div className="font-semibold text-emerald-400 group-hover:text-emerald-300">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                      {item.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
                Guardrails Ativos (PRD 02)
              </h3>
              <ul className="text-xs text-slate-400 space-y-2">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Sem SQL Direto:</strong> Todas as leituras e escritas passam por Application Services e Repositories.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Isolamento Fisiológico:</strong> O contexto é rigorosamente limitado a <code className="text-emerald-300">{activeSchema}</code>.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Defesa Anti-Injection:</strong> Sanitização e bloqueio imediato com auditoria em caso de jailbreak.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Anti-Bypass RBAC:</strong> A MaIA só tem acesso às ferramentas compatíveis com seu papel corporativo.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CATÁLOGO DE FERRAMENTAS AUTORIZADAS */}
      {activeTab === 'tools' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Catálogo Dinâmico de Ferramentas (Tool Registry)</h2>
              <p className="text-xs text-slate-400">
                Abaixo estão listadas as ferramentas corporativas expostas para a MaIA segundo as permissões do seu Membership ativo ({activeMembership?.role}).
              </p>
            </div>
            <button
              onClick={loadTools}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingTools ? 'animate-spin' : ''}`} />
              Recarregar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-emerald-400">{tool.name}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        tool.riskLevel === 'HIGH'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : tool.riskLevel === 'MEDIUM'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {tool.riskLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    {tool.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="capitalize text-slate-400">Categoria: {tool.category}</span>
                  {tool.requiresConfirmation ? (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Requer Confirmação
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-medium">Execução Direta</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TRILHA DE AUDITORIA ESPECÍFICA DA MAIA */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Trilha de Auditoria IA (PRD 02 - Seção 36)</h2>
              <p className="text-xs text-slate-400">
                Registro imutável de todas as interações, chamadas de ferramentas, latência e checagens de segurança restritas ao schema ativo.
              </p>
            </div>
            <button
              onClick={loadAuditLogs}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
              Atualizar Logs
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Ação</th>
                    <th className="px-4 py-3">Provedor / Modelo</th>
                    <th className="px-4 py-3">Tools Invocadas</th>
                    <th className="px-4 py-3">Latência</th>
                    <th className="px-4 py-3">Tokens</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        Nenhum registro de auditoria encontrado para este CNPJ.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-white">{log.action}</td>
                        <td className="px-4 py-2.5 text-slate-300">
                          {log.provider} • <span className="font-mono text-[11px]">{log.model}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-emerald-400">
                          {log.toolCalls?.length ? log.toolCalls.join(', ') : 'Nenhuma'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">{log.latencyMs} ms</td>
                        <td className="px-4 py-2.5 text-slate-400">
                          {log.tokens?.total || 0}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              log.status === 'SUCCESS'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DIAGNÓSTICO & ROTEAMENTO */}
      {activeTab === 'diagnostics' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-400" />
              Provedores & Adapters Registrados
            </h3>
            <div className="space-y-3">
              {healthInfo?.providers?.map((p: any) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-xs text-white">{p.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">ID: {p.id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-2.5 w-2.5 rounded-full ${
                        p.status === 'HEALTHY'
                          ? 'bg-emerald-500'
                          : p.status === 'DEGRADED'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                    />
                    <span className="text-xs font-semibold text-slate-300">{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-400" />
              Isolamento e Segurança de Banco de Dados
            </h3>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Schema Namespace Ativo:</span>
                <span className="font-mono text-emerald-400 font-bold">{activeSchema}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Direito a Execução SQL Livre:</span>
                <span className="font-mono text-rose-400 font-bold">NEGADO (Sem db.query)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Redação de Dados Confidenciais:</span>
                <span className="font-mono text-emerald-400 font-bold">ATIVA (DataPolicy)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">BOLA / IDOR Protection:</span>
                <span className="font-mono text-emerald-400 font-bold">ATIVA (Tenant Context First)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Acesso Trans-Empresas:</span>
                <span className="font-mono text-rose-400 font-bold">BLOQUEADO (Fail-Closed)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
