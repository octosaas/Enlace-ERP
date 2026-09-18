/**
 * Enlace ERP - Gestão de Membros, Usuários e Convites da Empresa
 * PRD 02 - Seções 18 a 22 & Seção 40 (Convites e Memberships)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { User, Membership, Invitation, UserRole } from '../../shared/types.js';
import { Users, UserPlus, Mail, Shield, AlertTriangle, CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react';

interface MemberItem {
  membership: Membership;
  user: User;
}

export const UsersManagementView: React.FC = () => {
  const { activeCompany, activeMembership, apiFetch } = useAuth();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal de Convite
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('operator');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  // Alteração de Role
  const [editingMember, setEditingMember] = useState<MemberItem | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('operator');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        apiFetch<MemberItem[]>('/api/v1/companies/active/members'),
        apiFetch<Invitation[]>('/api/v1/companies/active/invitations'),
      ]);

      if (membersRes.success && membersRes.data) {
        setMembers(membersRes.data);
      }
      if (invitesRes.success && invitesRes.data) {
        setInvitations(invitesRes.data);
      }
    } catch (err) {
      setError((err as Error).message || 'Erro ao carregar usuários da empresa.');
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setIsSubmittingInvite(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch<Invitation>('/api/v1/companies/active/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (res.success) {
        setSuccessMsg(`Convite gerado com sucesso para ${inviteEmail}!`);
        setShowInviteModal(false);
        setInviteEmail('');
        loadData();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm('Deseja realmente revogar este convite pendente?')) return;

    try {
      await apiFetch(`/api/v1/companies/active/invitations/${inviteId}`, {
        method: 'DELETE',
      });
      setSuccessMsg('Convite cancelado com sucesso.');
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    setIsUpdatingRole(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await apiFetch(`/api/v1/companies/active/members/${editingMember.membership.id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ newRole }),
      });

      setSuccessMsg(`Papel de ${editingMember.user.name} atualizado para ${newRole.toUpperCase()}!`);
      setEditingMember(null);
      loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleRevokeMember = async (item: MemberItem) => {
    if (
      !confirm(
        `Tem certeza que deseja desvincular o usuário "${item.user.name}" da empresa "${activeCompany?.tradeName}"?`
      )
    ) {
      return;
    }

    try {
      await apiFetch(`/api/v1/companies/active/members/${item.membership.id}`, {
        method: 'DELETE',
      });
      setSuccessMsg(`Acesso de ${item.user.name} revogado com sucesso.`);
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const isOperatorOwner = activeMembership?.role === 'owner';

  return (
    <div id="users-management-container" className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-900">Membros e Acessos da Empresa</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Empresa ativa: <span className="font-semibold text-slate-700">{activeCompany?.legalName}</span> (CNPJ:{' '}
            {activeCompany?.cnpj})
          </p>
        </div>

        <button
          id="btn-open-invite-modal"
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Convidar Novo Membro
        </button>
      </div>

      {/* Alertas */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{successMsg}</div>
        </div>
      )}

      {/* Tabela de Membros Ativos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            Usuários Vinculados ({members.length})
          </h2>
          <span className="text-xs text-slate-500">Isolamento rigoroso por CNPJ</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando membros da empresa...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Nenhum membro encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Membro</th>
                  <th className="px-6 py-3">Papel (Role)</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Data de Entrada</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {members.map((item) => {
                  const isOwner = item.membership.role === 'owner';
                  return (
                    <tr key={item.membership.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{item.user.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {item.user.email}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isOwner
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : item.membership.role === 'admin'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : item.membership.role === 'manager'
                              ? 'bg-blue-100 text-blue-800'
                              : item.membership.role === 'operator'
                              ? 'bg-slate-100 text-slate-800'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          {item.membership.role.toUpperCase()}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${
                            item.membership.status === 'ACTIVE'
                              ? 'text-emerald-700'
                              : item.membership.status === 'SUSPENDED'
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }`}
                        >
                          {item.membership.status === 'ACTIVE' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          {item.membership.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(item.membership.joinedAt).toLocaleDateString('pt-BR')}
                      </td>

                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          id={`btn-edit-role-${item.membership.id}`}
                          onClick={() => {
                            setEditingMember(item);
                            setNewRole(item.membership.role);
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition"
                        >
                          Alterar Papel
                        </button>

                        {!isOwner && (
                          <button
                            id={`btn-revoke-member-${item.membership.id}`}
                            onClick={() => handleRevokeMember(item)}
                            className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Revogar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Convites Pendentes */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-800">
              Convites Pendentes ({invitations.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">Expiração em 7 dias</span>
        </div>

        {invitations.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">
            Nenhum convite pendente no momento para esta empresa.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {invitations.map((inv) => (
              <div key={inv.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{inv.email}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Papel proposto: <span className="font-semibold text-slate-700">{inv.role.toUpperCase()}</span> •
                    Convidado por: {inv.invitedByName} em {new Date(inv.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="text-xs text-indigo-600 font-mono mt-1 bg-indigo-50 inline-block px-2 py-0.5 rounded border border-indigo-100">
                    Token de Simulação: {inv.token}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition"
                  >
                    Cancelar Convite
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Convidar Membro */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Convidar Novo Membro</h3>
            <p className="text-xs text-slate-500 mb-4">
              O convite criará uma membresia vinculada estritamente a este CNPJ ({activeCompany?.cnpj}).
            </p>

            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Profissional</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colaborador@empresa.com.br"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Papel Inicial (Role)</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                >
                  <option value="viewer">VIEWER (Somente Leitura)</option>
                  <option value="operator">OPERATOR (Operador do Dia a Dia)</option>
                  <option value="manager">MANAGER (Gestor de Departamento)</option>
                  <option value="admin">ADMIN (Administrador Operacional)</option>
                  {isOperatorOwner && <option value="owner">OWNER (Co-Proprietário com Autoridade Máxima)</option>}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Permissões granulares de acordo com a matriz RBAC do Enlace ERP.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvite}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50"
                >
                  {isSubmittingInvite ? 'Enviando...' : 'Gerar Convite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Papel */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Alterar Papel de Membro</h3>
            <p className="text-xs text-slate-500 mb-4">
              Membro: <span className="font-semibold text-slate-700">{editingMember.user.name}</span> ({editingMember.user.email})
            </p>

            {/* Aviso sobre proteção do Owner (PRD 02 - Seção 21) */}
            {editingMember.membership.role === 'owner' && !isOperatorOwner && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs mb-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Aviso de Segurança:</strong> Este usuário é OWNER da empresa. Pela regra de Separação de Poderes,
                  administradores operacionais não podem rebaixar ou alterar o papel do Proprietário.
                </span>
              </div>
            )}

            <form onSubmit={handleUpdateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Novo Papel</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                >
                  <option value="viewer">VIEWER (Somente Leitura)</option>
                  <option value="operator">OPERATOR (Operador do Dia a Dia)</option>
                  <option value="manager">MANAGER (Gestor de Departamento)</option>
                  <option value="admin">ADMIN (Administrador Operacional)</option>
                  {isOperatorOwner && <option value="owner">OWNER (Proprietário)</option>}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingRole}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50"
                >
                  {isUpdatingRole ? 'Atualizando...' : 'Confirmar Alteração'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
