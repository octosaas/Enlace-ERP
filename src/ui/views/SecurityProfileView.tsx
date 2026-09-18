/**
 * Enlace ERP - Perfil de Segurança, Troca de Senha e MFA TOTP
 * PRD 02 - Seções 15 a 17 (Credenciais, Recuperação de Senha e MFA)
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { MFASetupResponse } from '../../shared/types.js';
import { Shield, KeyRound, Smartphone, CheckCircle2, AlertTriangle, Copy, Check, Eye, EyeOff, Lock } from 'lucide-react';

export const SecurityProfileView: React.FC = () => {
  const { user, refreshUser, apiFetch } = useAuth();

  // Troca de Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // MFA TOTP
  const [mfaData, setMfaData] = useState<MFASetupResponse | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Desativação MFA
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [isDisablingMfa, setIsDisablingMfa] = useState(false);

  // Simulador de Recuperação de Senha
  const [resetEmail, setResetEmail] = useState('');
  const [resetResult, setResetResult] = useState<{ message: string; simulationToken?: string } | null>(null);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  // Handler: Troca de Senha
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação da nova senha não confere.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.success) {
        setPasswordSuccess('Senha alterada com sucesso! As demais sessões foram atualizadas.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handler: Iniciar Setup MFA
  const handleStartMfaSetup = async () => {
    setMfaError(null);
    setMfaSuccess(null);
    try {
      const res = await apiFetch<MFASetupResponse>('/api/v1/auth/mfa/setup', {
        method: 'POST',
      });
      if (res.success && res.data) {
        setMfaData(res.data);
      }
    } catch (err) {
      setMfaError((err as Error).message);
    }
  };

  // Handler: Confirmar Código de 6 Dígitos
  const handleConfirmMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) return;

    setIsVerifyingMfa(true);
    setMfaError(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/v1/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ code: verificationCode }),
      });

      if (res.success) {
        setMfaSuccess('Autenticação Multifator (MFA) ativada com sucesso para sua conta!');
        setMfaData(null);
        setVerificationCode('');
        await refreshUser();
      }
    } catch (err) {
      setMfaError((err as Error).message);
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  // Handler: Desativar MFA
  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDisablingMfa(true);
    setMfaError(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/v1/auth/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ password: disablePassword }),
      });

      if (res.success) {
        setMfaSuccess('MFA desativado com sucesso.');
        setShowDisableModal(false);
        setDisablePassword('');
        await refreshUser();
      }
    } catch (err) {
      setMfaError((err as Error).message);
    } finally {
      setIsDisablingMfa(false);
    }
  };

  // Handler: Simulação de "Esqueci minha senha" (Anti-Enumeração)
  const handleSimulateForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;

    setIsSubmittingReset(true);
    setResetResult(null);
    try {
      const res = await apiFetch<{ message: string; simulationToken?: string }>('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail }),
      });
      if (res.success && res.data) {
        setResetResult(res.data);
      }
    } catch (err) {
      setResetResult({ message: (err as Error).message });
    } finally {
      setIsSubmittingReset(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <div id="security-profile-container" className="space-y-6">
      {/* Topo */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Segurança da Conta & Identidade</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gerenciamento de credenciais, segundo fator de autenticação (MFA TOTP) e recuperação de acesso
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card: Autenticação Multifator (MFA TOTP RFC 6238) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-600" />
                <h2 className="font-semibold text-slate-900 text-base">Autenticação Multifator (MFA)</h2>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  user?.mfaEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {user?.mfaEnabled ? 'MFA Ativado' : 'MFA Inativo'}
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              O MFA adiciona uma camada adicional de segurança com aplicativo autenticador (Google Authenticator,
              Microsoft Authenticator ou 1Password) baseado no padrão RFC 6238.
            </p>

            {mfaSuccess && (
              <div className="p-3 mt-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {mfaSuccess}
              </div>
            )}

            {mfaError && (
              <div className="p-3 mt-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                {mfaError}
              </div>
            )}

            {/* Fluxo de Ativação */}
            {mfaData ? (
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Passo 1: Chave Secreta do Autenticador (Base32)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={mfaData.secret}
                      className="w-full font-mono text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(mfaData.secret)}
                      className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition"
                      title="Copiar chave"
                    >
                      {copiedSecret ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Passo 2: Códigos de Recuperação Descartáveis (Guarde com segurança)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
                    {mfaData.recoveryCodes.map((code) => (
                      <span key={code} className="py-0.5 px-1 bg-slate-50 rounded">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleConfirmMfa} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Passo 3: Digite o código de 6 dígitos gerado no app
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      placeholder="Ex: 123456"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-widest font-mono text-lg py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMfaData(null)}
                      className="flex-1 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifyingMfa || verificationCode.length !== 6}
                      className="flex-1 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50"
                    >
                      {isVerifyingMfa ? 'Validando...' : 'Ativar MFA'}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            {user?.mfaEnabled ? (
              <button
                type="button"
                onClick={() => setShowDisableModal(true)}
                className="px-4 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition"
              >
                Desativar Segundo Fator (MFA)
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartMfaSetup}
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
              >
                Configurar Autenticação em 2 Etapas
              </button>
            )}
          </div>
        </div>

        {/* Card: Alteração de Senha Autenticada */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <KeyRound className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-slate-900 text-base">Alterar Senha de Acesso</h2>
            </div>

            <p className="text-xs text-slate-500 mt-3">
              Mínimo de 8 caracteres. Ao trocar a senha, o Enlace ERP atualizará sua credencial com hash bcrypt de 10 rounds.
            </p>

            {passwordSuccess && (
              <div className="p-3 mt-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {passwordSuccess}
              </div>
            )}

            {passwordError && (
              <div className="p-3 mt-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Senha Atual</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nova Senha</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirmar Nova Senha</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50"
                >
                  {isChangingPassword ? 'Atualizando senha...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Seção: Recuperação de Acesso e Proteção Anti-Enumeração */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Lock className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-slate-900 text-base">
            Simulador de Recuperação de Acesso ("Esqueci Minha Senha")
          </h2>
        </div>

        <p className="text-xs text-slate-500 mt-2">
          Demonstração do endpoint seguro <span className="font-mono text-slate-700">POST /api/v1/auth/forgot-password</span> com proteção
          contra enumeração de usuários (PRD 02 - Seção 6 e 15).
        </p>

        <form onSubmit={handleSimulateForgotPassword} className="mt-4 flex flex-col sm:flex-row gap-3 max-w-xl">
          <input
            type="email"
            required
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="Digite qualquer e-mail para testar"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
          />
          <button
            type="submit"
            disabled={isSubmittingReset}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition shrink-0"
          >
            {isSubmittingReset ? 'Processando...' : 'Testar Resposta Segura'}
          </button>
        </form>

        {resetResult && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
            <div className="font-semibold text-slate-800">Resposta Padronizada da API:</div>
            <div className="text-slate-600 italic">"{resetResult.message}"</div>
            {resetResult.simulationToken && (
              <div className="mt-2 pt-2 border-t border-slate-200">
                <span className="font-semibold text-indigo-900">Token Descartável Gerado (Ambiente de Testes):</span>
                <span className="font-mono ml-2 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {resetResult.simulationToken}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Desativação de MFA */}
      {showDisableModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Confirmar Desativação de MFA</h3>
            <p className="text-xs text-slate-500 mb-4">
              Para desativar o segundo fator de autenticação, confirme sua senha atual de acesso:
            </p>

            <form onSubmit={handleDisableMfa} className="space-y-4">
              <div>
                <input
                  type="password"
                  required
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Sua senha atual"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisableModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isDisablingMfa}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50"
                >
                  {isDisablingMfa ? 'Desativando...' : 'Confirmar Desativação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
