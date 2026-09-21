/**
 * Enlace ERP - Tab de Régua de Cobrança Automatizada (Dunning Rules) (PRD 09)
 */

import React, { useState } from 'react';
import { CollectionDunningRule, DunningChannel, BankSlip } from '../../../shared/types.js';
import {
  BellRing,
  Mail,
  MessageSquare,
  Smartphone,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Check,
  Send,
  Sliders,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface DunningRulesTabProps {
  rules: CollectionDunningRule[];
  slips: BankSlip[];
  isLoading: boolean;
  onCreateRule: (data: {
    name: string;
    triggerDays: number;
    channel: DunningChannel;
    templateSubject: string;
    templateBody: string;
    includePix: boolean;
    includeBoleto: boolean;
    isActive: boolean;
  }) => Promise<void>;
  onToggleRule: (id: string, isActive: boolean) => Promise<void>;
  onExecuteDunning: () => Promise<{ dispatchedCount: number; logs: string[] }>;
  canManage: boolean;
}

export const DunningRulesTab: React.FC<DunningRulesTabProps> = ({
  rules,
  slips,
  isLoading,
  onCreateRule,
  onToggleRule,
  onExecuteDunning,
  canManage,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    dispatchedCount: number;
    logs: string[];
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    triggerDays: -3,
    channel: 'EMAIL' as DunningChannel,
    templateSubject: 'Lembrete de Vencimento de Fatura - Enlace ERP',
    templateBody:
      'Prezado(a) {sacado_nome},\n\nInformamos que seu boleto no valor de {valor} vence em {vencimento}.\nVocê pode efetuar o pagamento utilizando a linha digitável:\n{linha_digitavel}\nOu pague via Pix instantâneo acessando: {link_pix}.\n\nAtenciosamente,\nDepartamento Financeiro',
    includePix: true,
    includeBoleto: true,
    isActive: true,
  });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.templateBody) {
      alert('Por favor, preencha o nome da régua e a mensagem.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateRule({
        name: formData.name,
        triggerDays: formData.triggerDays,
        channel: formData.channel,
        templateSubject: formData.templateSubject || 'Aviso de Cobrança',
        templateBody: formData.templateBody,
        includePix: formData.includePix,
        includeBoleto: formData.includeBoleto,
        isActive: formData.isActive,
      });

      setIsModalOpen(false);
      setFormData({
        name: '',
        triggerDays: -3,
        channel: 'EMAIL',
        templateSubject: 'Lembrete de Vencimento de Fatura - Enlace ERP',
        templateBody:
          'Prezado(a) {sacado_nome},\n\nInformamos que seu boleto no valor de {valor} vence em {vencimento}.\nVocê pode efetuar o pagamento utilizando a linha digitável:\n{linha_digitavel}\nOu pague via Pix instantâneo acessando: {link_pix}.\n\nAtenciosamente,\nDepartamento Financeiro',
        includePix: true,
        includeBoleto: true,
        isActive: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunExecution = async () => {
    setIsExecuting(true);
    try {
      const result = await onExecuteDunning();
      setExecutionResult(result);
    } finally {
      setIsExecuting(false);
    }
  };

  const getChannelIcon = (channel: DunningChannel) => {
    switch (channel) {
      case 'EMAIL':
        return <Mail className="h-4 w-4 text-blue-400" />;
      case 'WHATSAPP':
        return <MessageSquare className="h-4 w-4 text-emerald-400" />;
      case 'SMS':
        return <Smartphone className="h-4 w-4 text-amber-400" />;
      default:
        return <Send className="h-4 w-4 text-slate-400" />;
    }
  };

  const getOffsetBadge = (offset: number) => {
    if (offset < 0) {
      return (
        <span className="rounded bg-blue-950/80 border border-blue-800 px-2 py-0.5 text-xs font-mono font-bold text-blue-300">
          D{offset} (Pré-vencimento)
        </span>
      );
    }
    if (offset === 0) {
      return (
        <span className="rounded bg-amber-950/80 border border-amber-800 px-2 py-0.5 text-xs font-mono font-bold text-amber-300">
          D-0 (Dia do Vencimento)
        </span>
      );
    }
    return (
      <span className="rounded bg-rose-950/80 border border-rose-800 px-2 py-0.5 text-xs font-mono font-bold text-rose-300">
        D+{offset} (Pós-vencimento / Atraso)
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Topo / Apresentação e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Régua de Cobrança Automatizada</h2>
            <span className="rounded bg-indigo-950 border border-indigo-800 px-2 py-0.5 text-[10px] font-bold text-indigo-400">
              PRD 09 • Seção 05
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400 max-w-2xl">
            Configure gatilhos temporais pré e pós-vencimento (D-3, D-0, D+3, D+10) integrando múltiplos canais (E-mail com boleto anexo, WhatsApp com Pix Copia e Cola e SMS) com disparo assistido ou programado.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canManage && (
            <>
              <button
                onClick={handleRunExecution}
                disabled={isExecuting}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                {isExecuting ? 'Disparando Régua...' : 'Disparar Régua Agora'}
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Nova Regra
              </button>
            </>
          )}
        </div>
      </div>

      {/* Resultado da Execução / Disparo */}
      {executionResult && (
        <div className="rounded-xl border border-indigo-800/80 bg-indigo-950/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>Execução da Régua de Cobrança Concluída com Sucesso</span>
            </div>
            <span className="rounded bg-indigo-900/80 px-2 py-0.5 text-xs font-mono text-indigo-200">
              {executionResult.dispatchedCount} notificações despachadas
            </span>
          </div>

          <div className="rounded-lg border border-indigo-900/60 bg-slate-950/80 p-3 max-h-40 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
            {executionResult.logs && executionResult.logs.length > 0 ? (
              executionResult.logs.map((log, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                  <span>{log}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-500">Nenhum título necessitou de notificação no ciclo atual.</p>
            )}
          </div>
        </div>
      )}

      {/* Lista de Regras Configuradas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-2 py-12 text-center text-slate-500 text-xs">
            Carregando réguas de cobrança do tenant...
          </div>
        ) : rules.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-slate-500 text-xs">
            Nenhuma regra cadastrada. Clique em "Nova Regra" para configurar gatilhos automáticos de cobrança.
          </div>
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 hover:border-slate-700 transition-colors"
            >
              {/* Cabeçalho do Card */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{rule.name}</span>
                    {getOffsetBadge(rule.triggerDays)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      {getChannelIcon(rule.channel)}
                      Canal: <strong className="text-slate-200">{rule.channel}</strong>
                    </span>
                    <span>•</span>
                    <span>{rule.includePix ? 'Pix Ativo' : ''} {rule.includeBoleto ? '• Boleto Anexo' : ''}</span>
                  </div>
                </div>

                {canManage && (
                  <button
                    onClick={() => onToggleRule(rule.id, !rule.isActive)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                    title={rule.isActive ? 'Desativar Regra' : 'Ativar Regra'}
                  >
                    {rule.isActive ? (
                      <ToggleRight className="h-6 w-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-slate-600" />
                    )}
                  </button>
                )}
              </div>

              {/* Mensagem Template */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-1 text-xs">
                {rule.templateSubject && (
                  <div className="font-semibold text-slate-300 border-b border-slate-800 pb-1 mb-1">
                    Assunto: <span className="text-slate-200">{rule.templateSubject}</span>
                  </div>
                )}
                <p className="text-slate-400 whitespace-pre-line text-[11px] leading-relaxed">
                  {rule.templateBody}
                </p>
              </div>

              {/* Rodapé do Card */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/60 pt-2">
                <span>Variáveis suportadas: {`{sacado_nome}, {valor}, {vencimento}, {linha_digitavel}, {link_pix}`}</span>
                <span
                  className={`font-semibold ${rule.isActive ? 'text-emerald-400' : 'text-slate-500'}`}
                >
                  {rule.isActive ? '● Ativa' : '○ Inativa'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Criação de Regra de Régua */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Criar Regra de Cobrança</h3>
                  <p className="text-xs text-slate-400">Gatilho de comunicação multicanal</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome da Regra / Identificador *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Aviso 3 Dias Antes do Vencimento"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Gatilho Temporal (Dias Offset) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.triggerDays}
                    onChange={(e) => setFormData({ ...formData, triggerDays: parseInt(e.target.value) || 0 })}
                    placeholder="-3 para antes, 0 para no dia, 5 para depois"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">
                    Negativo = antes do vencimento; Positivo = após vencimento
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Canal de Disparo *
                  </label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value as DunningChannel })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="EMAIL">E-mail (com boleto anexo)</option>
                    <option value="WHATSAPP">WhatsApp (Pix Copia e Cola)</option>
                    <option value="SMS">SMS Corporativo</option>
                  </select>
                </div>
              </div>

              {formData.channel === 'EMAIL' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assunto do E-mail
                  </label>
                  <input
                    type="text"
                    value={formData.templateSubject}
                    onChange={(e) => setFormData({ ...formData, templateSubject: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Corpo da Mensagem (Template com Tags Dinâmicas) *
                </label>
                <textarea
                  rows={5}
                  required
                  value={formData.templateBody}
                  onChange={(e) => setFormData({ ...formData, templateBody: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none leading-relaxed"
                />
                <span className="text-[10px] text-slate-400">
                  Tags automáticas: {`{sacado_nome}, {valor}, {vencimento}, {linha_digitavel}, {link_pix}`}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Regra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
