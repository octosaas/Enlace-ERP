/**
 * Enlace ERP - Configurações da Instância & Backup (PRD 01 - Seção 13, 25 e 26)
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { PERMISSIONS } from '../../shared/permissions.js';
import {
  Sliders,
  Database,
  Download,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

interface SettingsData {
  timezone: string;
  currency: string;
  documentRetentionDays: number;
  updatedAt: string;
}

export const SettingsView: React.FC = () => {
  const { activeCompany, activeMembership, activeSchema, apiFetch } = useAuth();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [currency, setCurrency] = useState('BRL');
  const [retentionDays, setRetentionDays] = useState(1825);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const canEdit = activeMembership?.permissions.includes(PERMISSIONS.COMPANY_UPDATE);

  const loadSettings = async () => {
    try {
      const res = await apiFetch<SettingsData>('/api/v1/companies/active/settings');
      if (res.success && res.data) {
        setSettings(res.data);
        setTimezone(res.data.timezone);
        setCurrency(res.data.currency);
        setRetentionDays(res.data.documentRetentionDays);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [activeCompany]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setIsSaving(true);
    setStatusMsg(null);
    try {
      const res = await apiFetch<SettingsData>('/api/v1/companies/active/settings', {
        method: 'PUT',
        body: JSON.stringify({
          timezone,
          currency,
          documentRetentionDays: retentionDays,
        }),
      });

      if (res.success && res.data) {
        setSettings(res.data);
        setStatusMsg({ type: 'success', text: 'Configurações da instância salvas com sucesso no schema isolado.' });
      }
    } catch (err: unknown) {
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao salvar configurações',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-300">
              PRD 01 • SEÇÃO 13 & 25
            </span>
            <span className="text-xs text-slate-400">Configuração da Instância & LGPD</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Parâmetros do CNPJ {activeCompany?.cnpj}
          </h1>
          <p className="text-xs text-slate-400">
            Armazenamento exclusivo dentro do schema <code className="text-emerald-400 font-mono">{activeSchema}</code>.
          </p>
        </div>

        {statusMsg && (
          <div
            className={`mt-4 rounded-lg border p-3 text-xs flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-300'
                : 'border-rose-800/80 bg-rose-950/40 text-rose-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulário de Configurações */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sliders className="h-4 w-4 text-emerald-400" />
            Parâmetros Operacionais da Empresa
          </h2>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Fuso Horário Oficial</label>
              <select
                value={timezone}
                disabled={!canEdit}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
              >
                <option value="America/Sao_Paulo">Brasília (GMT-3) - America/Sao_Paulo</option>
                <option value="America/Manaus">Manaus (GMT-4) - America/Manaus</option>
                <option value="America/Belem">Belém (GMT-3) - America/Belem</option>
                <option value="America/Cuiaba">Cuiabá (GMT-4) - America/Cuiaba</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Moeda Padrão</label>
              <select
                value={currency}
                disabled={!canEdit}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
              >
                <option value="BRL">Real Brasileiro (R$ - BRL)</option>
                <option value="USD">Dólar Americano ($ - USD)</option>
                <option value="EUR">Euro (€ - EUR)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Retenção de Registros e Documentos Fiscais (LGPD / Compliance)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={retentionDays}
                  disabled={!canEdit}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  className="w-32 rounded-lg border border-slate-700 bg-slate-950 p-2 text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                />
                <span className="text-slate-400">dias (Padrão legal brasileiro: 1.825 dias / 5 anos)</span>
              </div>
            </div>

            {settings?.updatedAt && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <Clock className="h-3 w-3" />
                <span>Última alteração: {new Date(settings.updatedAt).toLocaleString('pt-BR')}</span>
              </div>
            )}

            {canEdit ? (
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            ) : (
              <p className="text-[11px] text-amber-400">
                Seu perfil não possui a permissão 'company.update' para alterar estes parâmetros.
              </p>
            )}
          </form>
        </div>

        {/* Informações de Backup e Recuperação (PRD 01 - Seção 26) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-400" />
            Backup e Restauração Granular por CNPJ (Seção 26)
          </h2>

          <div className="space-y-3 text-xs text-slate-400 leading-relaxed">
            <p>
              Conforme estipulado no PRD 01, o backup e a restauração de um cliente são <strong>independentes</strong> do universo dos demais clientes (<code className="text-slate-200">Backup Empresa A ≠ Backup Empresa B</code>).
            </p>

            <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 space-y-2">
              <span className="font-semibold text-slate-200 block">
                Comandos de Backup/Restauração Granular:
              </span>
              <div className="font-mono text-[11px] text-emerald-400 bg-slate-900 p-2 rounded">
                # Exportar exclusivamente o CNPJ ativo:<br />
                pg_dump -n {activeSchema} -Fc enlace_db &gt; {activeSchema}_backup.dump
              </div>
              <div className="font-mono text-[11px] text-emerald-400 bg-slate-900 p-2 rounded">
                # Restaurar a empresa individualmente sem afetar outros tenants:<br />
                pg_restore -n {activeSchema} -d enlace_db {activeSchema}_backup.dump
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-emerald-400 pt-1">
              <FileCheck className="h-4 w-4" />
              <span>Compatível com migração para PostgreSQL Dedicado sem reescrita de código.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
