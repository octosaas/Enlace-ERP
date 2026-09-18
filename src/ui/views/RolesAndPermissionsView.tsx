/**
 * Enlace ERP - Visualizador Comparativo da Matriz RBAC e Papéis
 * PRD 02 - Seções 18 a 22 (Perfis, Permissões e Separação de Poderes)
 */

import React from 'react';
import { ROLE_DEFAULT_PERMISSIONS, PERMISSIONS } from '../../shared/permissions.js';
import { Shield, Check, X, Info } from 'lucide-react';

export const RolesAndPermissionsView: React.FC = () => {
  const roles = [
    {
      key: 'owner',
      title: 'OWNER',
      subtitle: 'Proprietário Titular',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      description: 'Autoridade máxima institucional incondicional sobre a empresa e módulos.',
    },
    {
      key: 'admin',
      title: 'ADMIN',
      subtitle: 'Administrador Operacional',
      badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      description: 'Gestão da empresa e equipe. Bloqueado de alterar ou rebaixar o Owner.',
    },
    {
      key: 'manager',
      title: 'MANAGER',
      subtitle: 'Gestor de Departamento',
      badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
      description: 'Gestão de processos e equipes autorizadas. Sem poderes institucionais.',
    },
    {
      key: 'operator',
      title: 'OPERATOR',
      subtitle: 'Operador do Dia a Dia',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
      description: 'Execução de rotinas e cadastros permitidos.',
    },
    {
      key: 'viewer',
      title: 'VIEWER',
      subtitle: 'Somente Leitura',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      description: 'Acesso estrito de auditoria ou consulta de relatórios sem edição.',
    },
  ];

  const permissionGroups = [
    {
      category: 'Institucional & Empresa',
      items: [
        { key: PERMISSIONS.COMPANY_VIEW, label: 'Visualizar dados institucionais (company.view)' },
        { key: PERMISSIONS.COMPANY_UPDATE, label: 'Alterar configurações da empresa (company.update)' },
        { key: PERMISSIONS.COMPANY_MANAGE_MODULES, label: 'Gerenciar ativação de módulos (company.modules.manage)' },
      ],
    },
    {
      category: 'Membros, Usuários & Convites',
      items: [
        { key: PERMISSIONS.USERS_VIEW, label: 'Visualizar lista de membros e convites (users.view)' },
        { key: PERMISSIONS.USERS_INVITE, label: 'Convidar novos usuários (users.invite)' },
        { key: PERMISSIONS.USERS_ROLES_UPDATE, label: 'Alterar papéis de membros (users.roles.update)' },
        { key: PERMISSIONS.USERS_SUSPEND, label: 'Suspender membros da empresa (users.suspend)' },
        { key: PERMISSIONS.USERS_REMOVE, label: 'Desvincular membros da empresa (users.remove)' },
      ],
    },
    {
      category: 'Sessões & Auditoria de Segurança',
      items: [
        { key: PERMISSIONS.SESSIONS_VIEW, label: 'Auditar sessões ativas (sessions.view)' },
        { key: PERMISSIONS.SESSIONS_REVOKE, label: 'Revogar sessões remotas (sessions.revoke)' },
        { key: PERMISSIONS.SESSIONS_REVOKE_ALL, label: 'Revogação emergencial de todas as sessões (sessions.revoke_all)' },
        { key: PERMISSIONS.AUDIT_VIEW, label: 'Consultar trilha de auditoria (audit.view)' },
        { key: PERMISSIONS.AUDIT_EXPORT, label: 'Exportar logs de conformidade (audit.export)' },
        { key: PERMISSIONS.SECURITY_EVENTS_VIEW, label: 'Inspecionar eventos de segurança (security.events.view)' },
      ],
    },
    {
      category: 'Segredos, Cofre e IA',
      items: [
        { key: PERMISSIONS.CREDENTIALS_VIEW, label: 'Visualizar certificados e integrações (credentials.view)' },
        { key: PERMISSIONS.CREDENTIALS_MANAGE, label: 'Gerenciar cofre de segredos AES-256 (credentials.manage)' },
        { key: PERMISSIONS.AI_CONTEXT_DELEGATE, label: 'Delegar ações assistidas para MaIA (ai.context.delegate)' },
      ],
    },
    {
      category: 'Módulos de Negócio (Clientes & Financeiro)',
      items: [
        { key: PERMISSIONS.CUSTOMERS_READ, label: 'Consultar clientes e contatos (customers.read)' },
        { key: PERMISSIONS.CUSTOMERS_CREATE, label: 'Cadastrar novos clientes (customers.create)' },
        { key: PERMISSIONS.CUSTOMERS_UPDATE, label: 'Editar cadastros de clientes (customers.update)' },
        { key: PERMISSIONS.FINANCE_READ, label: 'Consultar lançamentos financeiros (finance.read)' },
        { key: PERMISSIONS.FINANCE_CREATE, label: 'Registrar contas e despesas (finance.create)' },
        { key: PERMISSIONS.FINANCE_APPROVE, label: 'Aprovação financeira de pagamentos (finance.approve)' },
      ],
    },
  ];

  return (
    <div id="roles-permissions-container" className="space-y-6">
      {/* Topo */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Matriz de Perfis e Permissões (RBAC)</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Governança de acesso granular baseada no padrão corporativo <span className="font-mono text-slate-700">module.resource.action</span>
            </p>
          </div>
        </div>
      </div>

      {/* Regra de Separação de Poderes */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <strong className="font-semibold">Regra de Segurança Inviolável (PRD 02 - Seção 21):</strong>
          <p className="mt-0.5 text-xs text-amber-800">
            O papel <strong>OWNER</strong> possui autoridade institucional máxima. Administradores (<strong>ADMIN</strong>), mesmo com
            privilégios avançados de gestão, são impedidos pelo servidor de rebaixar, alterar ou revogar o papel do OWNER. Apenas o próprio
            proprietário pode transferir a titularidade.
          </p>
        </div>
      </div>

      {/* Cards de Resumo dos Perfis */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {roles.map((r) => (
          <div key={r.key} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${r.badgeClass}`}>
                {r.title}
              </span>
              <div className="font-semibold text-slate-800 text-sm mt-2">{r.subtitle}</div>
              <p className="text-xs text-slate-500 mt-1">{r.description}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-slate-600">
              {ROLE_DEFAULT_PERMISSIONS[r.key]?.length || 0} permissões ativas
            </div>
          </div>
        ))}
      </div>

      {/* Tabela Comparativa */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Detalhamento Comparativo da Matriz de Permissões</h2>
          <span className="text-xs text-slate-500">Validação no Middleware RBAC</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                <th className="px-6 py-3 min-w-[300px]">Capacidade / Permissão Granular</th>
                <th className="px-4 py-3 text-center">Owner</th>
                <th className="px-4 py-3 text-center">Admin</th>
                <th className="px-4 py-3 text-center">Manager</th>
                <th className="px-4 py-3 text-center">Operator</th>
                <th className="px-4 py-3 text-center">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permissionGroups.map((group) => (
                <React.Fragment key={group.category}>
                  <tr className="bg-slate-100/70">
                    <td colSpan={6} className="px-6 py-2 text-xs font-bold text-slate-700 tracking-wide uppercase">
                      {group.category}
                    </td>
                  </tr>
                  {group.items.map((perm) => (
                    <tr key={perm.key} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-3 font-medium text-slate-800">
                        <div>{perm.label}</div>
                        <span className="text-xs font-mono text-slate-400">{perm.key}</span>
                      </td>

                      {['owner', 'admin', 'manager', 'operator', 'viewer'].map((roleKey) => {
                        const hasPerm = ROLE_DEFAULT_PERMISSIONS[roleKey]?.includes(perm.key);
                        return (
                          <td key={roleKey} className="px-4 py-3 text-center">
                            {hasPerm ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full">
                                <Check className="w-3.5 h-3.5 stroke-3" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 text-slate-300 rounded-full">
                                <X className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
