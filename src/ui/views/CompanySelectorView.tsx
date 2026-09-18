/**
 * Enlace ERP - Seleção de Contexto de Empresa / CNPJ Ativo
 * PRD 01 - Seção 7 (Usuários Multiempresa) & Seção 22 (Frontend)
 */

import React from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { Building2, ArrowRight, ShieldCheck, Database, Check } from 'lucide-react';

interface CompanySelectorViewProps {
  onCompanySelected?: () => void;
}

export const CompanySelectorView: React.FC<CompanySelectorViewProps> = ({ onCompanySelected }) => {
  const { companies, selectCompany, user, activeCompany } = useAuth();

  const handleSelect = async (companyId: string) => {
    await selectCompany(companyId);
    if (onCompanySelected) {
      onCompanySelected();
    }
  };

  const getRoleTitle = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Proprietário (Controle Total)';
      case 'manager':
        return 'Gestor / Gerente Operacional';
      case 'auditor':
        return 'Auditor / Compliance & Leitura';
      case 'operator':
        return 'Operador de Processos';
      default:
        return role;
    }
  };

  const getSegmentName = (segment: string) => {
    const map: Record<string, string> = {
      servicos: 'Prestação de Serviços',
      comercio: 'Comércio / Distribuição',
      restaurante: 'Restaurante / Alimentação',
      construcao: 'Construção Civil',
      tecnologia: 'Tecnologia / Software',
    };
    return map[segment] || segment;
  };

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-8 text-slate-100">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-1.5">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-emerald-400">
            <Building2 className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Selecione a Empresa / CNPJ Ativo
          </h2>
          <p className="text-xs text-slate-400">
            Sua conta (<span className="text-slate-200 font-medium">{user?.email}</span>) possui autorização em {companies.length} empresa(s).
          </p>
        </div>

        <div className="space-y-3">
          {companies.map(({ company, membership }) => {
            const isCurrent = activeCompany?.id === company.id;
            return (
              <div
                key={company.id}
                onClick={() => handleSelect(company.id)}
                className={`group cursor-pointer rounded-xl border p-4 transition-all ${
                  isCurrent
                    ? 'border-emerald-500/80 bg-emerald-950/20 shadow-md shadow-emerald-950/20'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white group-hover:text-emerald-300 transition-colors">
                        {company.legalName}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-950 border border-emerald-800 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                          <Check className="h-2.5 w-2.5" /> Ativa
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>CNPJ: <strong className="text-slate-300">{company.cnpj}</strong></span>
                      <span>•</span>
                      <span>{getSegmentName(company.segment)}</span>
                    </div>

                    <div className="flex items-center gap-3 pt-2 text-[11px]">
                      <span className="flex items-center gap-1 font-mono text-emerald-400/90 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        <Database className="h-3 w-3" />
                        {company.schemaNamespace}
                      </span>
                      <span className="flex items-center gap-1 text-slate-300">
                        <ShieldCheck className="h-3 w-3 text-emerald-400" />
                        {getRoleTitle(membership.role)}
                      </span>
                    </div>
                  </div>

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 group-hover:bg-emerald-600 group-hover:text-slate-950 transition-colors">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-3 text-xs text-slate-400 space-y-1">
          <p className="font-medium text-slate-300">Regra de Segurança do PRD 01:</p>
          <p className="text-[11px]">
            Ao selecionar a empresa, o servidor Enlace ERP vincula o contexto da requisição estritamente ao schema isolado deste CNPJ. Nenhuma transação pode atravessar fronteiras entre empresas.
          </p>
        </div>
      </div>
    </div>
  );
};
