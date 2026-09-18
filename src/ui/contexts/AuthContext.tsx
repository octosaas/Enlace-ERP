/**
 * Enlace ERP - Contexto de Autenticação e Contexto de Empresa Ativa
 * PRD 01 & PRD 02 - Gestão de Sessões, MFA, Troca de Contexto e Refresh Tokens
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Company, Membership, ApiResponse } from '../../shared/types.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  currentSessionId: string | null;
  companies: Array<{ company: Company; membership: Membership }>;
  activeCompany: Company | null;
  activeMembership: Membership | null;
  activeSchema: string | null;
  isLoading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<{ mfaRequired?: boolean }>;
  selectCompany: (companyId: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
  apiFetch: <T = unknown>(path: string, options?: RequestInit) => Promise<ApiResponse<T>>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY_TOKEN = 'enlace_token';
const STORAGE_KEY_REFRESH = 'enlace_refresh_token';
const STORAGE_KEY_COMPANY = 'enlace_active_company_id';
const STORAGE_KEY_SESSION = 'enlace_session_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_TOKEN));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_REFRESH));
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_SESSION));
  const [companies, setCompanies] = useState<Array<{ company: Company; membership: Membership }>>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);
  const [activeSchema, setActiveSchema] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Wrapper para chamadas de API com injeção automática de Token e Contexto de Empresa
  const apiFetch = useCallback(
    async <T = unknown>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> => {
      const headers = new Headers(options.headers || {});
      headers.set('Content-Type', 'application/json');

      const currentToken = token || localStorage.getItem(STORAGE_KEY_TOKEN);
      if (currentToken) {
        headers.set('Authorization', `Bearer ${currentToken}`);
      }

      const currentCompanyId = activeCompany?.id || localStorage.getItem(STORAGE_KEY_COMPANY);
      if (currentCompanyId) {
        headers.set('x-enlace-company-id', currentCompanyId);
      }

      const res = await fetch(path, {
        ...options,
        headers,
      });

      const data = (await res.json()) as ApiResponse<T>;
      if (!res.ok) {
        throw new Error(data.error?.message || `HTTP ${res.status}`);
      }
      return data;
    },
    [token, activeCompany]
  );

  const selectCompany = useCallback(
    async (companyId: string) => {
      const found = companies.find((c) => c.company.id === companyId);
      if (found) {
        setActiveCompany(found.company);
        setActiveMembership(found.membership);
        setActiveSchema(found.company.schemaNamespace);
        localStorage.setItem(STORAGE_KEY_COMPANY, companyId);
      }
    },
    [companies]
  );

  const login = useCallback(
    async (email: string, password: string, mfaCode?: string) => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, mfaCode }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'Falha na autenticação');
        }

        if (json.data.mfaRequired) {
          return { mfaRequired: true };
        }

        const {
          token: newToken,
          refreshToken: newRefresh,
          user: newUser,
          session: newSession,
          companies: userCompanies,
        } = json.data;

        setToken(newToken);
        setRefreshToken(newRefresh);
        setCurrentSessionId(newSession.id);
        setUser(newUser);
        setCompanies(userCompanies);

        localStorage.setItem(STORAGE_KEY_TOKEN, newToken);
        localStorage.setItem(STORAGE_KEY_REFRESH, newRefresh);
        localStorage.setItem(STORAGE_KEY_SESSION, newSession.id);

        if (userCompanies.length === 1) {
          const single = userCompanies[0];
          setActiveCompany(single.company);
          setActiveMembership(single.membership);
          setActiveSchema(single.company.schemaNamespace);
          localStorage.setItem(STORAGE_KEY_COMPANY, single.company.id);
        } else {
          setActiveCompany(null);
          setActiveMembership(null);
          setActiveSchema(null);
          localStorage.removeItem(STORAGE_KEY_COMPANY);
        }

        return { mfaRequired: false };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      const savedToken = token || localStorage.getItem(STORAGE_KEY_TOKEN);
      if (savedToken) {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${savedToken}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch {
      // Ignora erro de rede ao deslogar
    } finally {
      setToken(null);
      setRefreshToken(null);
      setCurrentSessionId(null);
      setUser(null);
      setCompanies([]);
      setActiveCompany(null);
      setActiveMembership(null);
      setActiveSchema(null);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_REFRESH);
      localStorage.removeItem(STORAGE_KEY_SESSION);
      localStorage.removeItem(STORAGE_KEY_COMPANY);
    }
  }, [token]);

  const logoutAll = useCallback(async () => {
    try {
      const savedToken = token || localStorage.getItem(STORAGE_KEY_TOKEN);
      if (savedToken) {
        await fetch('/api/v1/auth/logout-all', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${savedToken}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } finally {
      logout();
    }
  }, [token, logout]);

  const refreshUser = useCallback(async () => {
    const savedToken = token || localStorage.getItem(STORAGE_KEY_TOKEN);
    if (!savedToken) return;

    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setUser(json.data.user);
          setCompanies(json.data.companies);
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar usuário', err);
    }
  }, [token]);

  // Restaura sessão existente ao carregar
  useEffect(() => {
    async function restoreSession() {
      const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setUser(json.data.user);
            setCompanies(json.data.companies);
            setCurrentSessionId(json.data.currentSessionId || localStorage.getItem(STORAGE_KEY_SESSION));

            const savedCompanyId = localStorage.getItem(STORAGE_KEY_COMPANY);
            if (savedCompanyId) {
              const found = json.data.companies.find(
                (c: { company: Company }) => c.company.id === savedCompanyId
              );
              if (found) {
                setActiveCompany(found.company);
                setActiveMembership(found.membership);
                setActiveSchema(found.company.schemaNamespace);
              }
            }
          }
        } else {
          logout();
        }
      } catch {
        logout();
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        currentSessionId,
        companies,
        activeCompany,
        activeMembership,
        activeSchema,
        isLoading,
        login,
        selectCompany,
        logout,
        logoutAll,
        refreshUser,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
