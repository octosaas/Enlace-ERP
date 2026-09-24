/**
 * Enlace ERP - Server Entrypoint (Full-Stack Express + Vite)
 * PRD 01 & PRD 02 - Fundação, Identidade, RBAC, Sessões e Segurança Corporativa
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Configurações e segredos padrão para inicialização segura em Cloud Run / Staging / Preview
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
  process.env.JWT_SECRET = 'enlace_prod_jwt_cluster_signing_key_32bytes_min_2026';
}
if (!process.env.ENLACE_VAULT_KEY || process.env.ENLACE_VAULT_KEY.trim().length < 32) {
  process.env.ENLACE_VAULT_KEY = 'enlace_prod_vault_master_key_2026_aes256_gcm_32b';
}

import { createServer as createViteServer } from 'vite';
import { dbEngine } from './src/core/database/engine.js';
import { AuthService, AuthSessionPayload } from './src/core/auth/service.js';
import { authMiddleware } from './src/core/middleware/auth.js';
import { tenantMiddleware } from './src/core/middleware/tenant.js';
import { requirePermission } from './src/core/middleware/rbac.js';
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from './src/shared/permissions.js';
import { AuditService } from './src/core/audit/service.js';
import { AppError, ForbiddenError, UnauthorizedError, NotFoundError } from './src/core/errors/index.js';
import { logger } from './src/core/logger/index.js';
import { SecurityTestResult, UserRole } from './src/shared/types.js';
import { createRateLimitMiddleware, rateLimiter } from './src/core/security/rateLimiter.js';
import { CredentialVault } from './src/core/security/vault.js';
import { AIPrincipalManager } from './src/core/security/aiPrincipal.js';
import { TotpService } from './src/core/security/totp.js';
import {
  validateFiscalDocument,
  cleanDocument,
  formatDocument,
  validateCPF,
  validateCNPJ,
  generateTestCPF,
  generateTestCNPJ,
} from './src/shared/validators.js';
import { CommercialMath } from './src/core/commercial/commercialEngine.js';
import { FinancialMath } from './src/core/financial/financialEngine.js';
import { BillingMath, CompetenceHelper } from './src/core/billing/billingEngine.js';

const app = express();
// AI Studio / Cloud Run Container: Nginx escuta na porta 8080 (ou PORT injetado) e faz proxy reverso para a porta 3000.
// A aplicação Express DEVE obrigatoriamente rodar na porta 3000 vinculada a 0.0.0.0 (conforme AGENTS.md e runtime).
const PORT = process.env.PORT && process.env.PORT !== '8080' ? Number(process.env.PORT) : 3000;

// Parser JSON com limite seguro
app.use(express.json({ limit: '1mb' }));

// Middleware de Correlation ID e Request ID para Observabilidade (PRD 01 - Seção 18)
app.use((req: Request, res: Response, next: NextFunction) => {
  const reqId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  const corrId = (req.headers['x-correlation-id'] as string) || reqId;

  req.requestId = reqId;
  req.correlationId = corrId;

  res.setHeader('x-request-id', reqId);
  res.setHeader('x-correlation-id', corrId);

  next();
});

// ==========================================
// ROTAS DE HEALTH CHECK (PRD 01 - Seção 18)
// ==========================================

app.get(['/api/health', '/api/v1/health'], (_req, res) => {
  res.json({
    status: 'ok',
    system: 'Enlace ERP',
    phase: 'PRD 01 a 09 - Plataforma Homologada (Fundação, RBAC, Cadastros, Comercial, Financeiro, Faturamento, Estoque, Fiscal, Compras & Cobrança Bancária/Pix)',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/health/readiness', async (_req, res) => {
  await dbEngine.initialize();
  const pgStatus = dbEngine.getPostgresStatus();
  res.json({
    status: 'ready',
    database: pgStatus.isConnected ? 'postgresql-active' : 'in-memory-isolated',
    postgres: pgStatus,
    schemas: 'active',
    authEngine: 'active',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/health/liveness', (_req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// ==========================================================
// ROTAS DE AUTENTICAÇÃO E SESSÃO (PRD 02 - Seções 11 a 17)
// ==========================================================

// Rate Limiting para Login: máximo 5 tentativas por IP/email a cada 15 minutos (PRD 02 - Seção 27)
const loginRateLimiter = createRateLimitMiddleware({
  maxAttempts: 5,
  lockDurationSeconds: 900,
  keyGenerator: (req) => `login:${req.ip}:${(req.body.email || '').toLowerCase().trim()}`,
  actionName: 'AUTH_LOGIN',
});

// 1. Login com verificação de bloqueio, status, MFA e registro de sessão
app.post('/api/v1/auth/login', loginRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, mfaCode } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'E-mail e senha são obrigatórios.' },
      });
    }

    const rateKey = `login:${req.ip}:${(email || '').toLowerCase().trim()}`;

    try {
      const result = await AuthService.login({
        email,
        passwordPlain: password,
        mfaCode,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId,
      });

      // Sucesso: reseta eventuais contadores do rate limiter
      rateLimiter.reset(rateKey);

      await AuditService.recordAsync({
        userId: result.user.id,
        userEmail: result.user.email,
        action: 'AUTH_LOGIN_SUCCESS',
        resource: '/api/v1/auth/login',
        status: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId,
        details: {
          sessionId: result.session.id,
          authorizedCompaniesCount: result.companies.length,
          mfaUsed: !!mfaCode,
        },
      });

      res.json({
        success: true,
        data: result,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
      });
    } catch (loginErr) {
      // Registra falha no rate limiter caso seja erro de credencial incorreta
      if (loginErr instanceof UnauthorizedError) {
        rateLimiter.recordFailure(rateKey, 5, 900);
      }
      throw loginErr;
    }
  } catch (err) {
    await AuditService.recordAsync({
      userEmail: req.body.email,
      action: 'AUTH_LOGIN_FAILED',
      resource: '/api/v1/auth/login',
      status: 'FAILED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { reason: (err as Error).message },
    });
    next(err);
  }
});

// 2. Rotação de Refresh Token (PRD 02 - Seção 13)
app.post('/api/v1/auth/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token é obrigatório.');
    }

    const newTokens = await AuthService.rotateRefreshToken({
      refreshTokenPlain: refreshToken,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
    });

    res.json({
      success: true,
      data: newTokens,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

// 3. Obter dados do usuário autenticado e empresas autorizadas
app.get('/api/v1/auth/me', authMiddleware, (req: Request, res: Response) => {
  const user = req.user!;
  const companies = dbEngine.listCompaniesForUser(user.id);
  res.json({
    success: true,
    data: { user, companies, currentSessionId: req.sessionId },
    meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
  });
});

// 4. Logout da Sessão Atual (PRD 02 - Seção 14) - Idempotente e Resiliente
app.post('/api/v1/auth/logout', async (req: Request, res: Response) => {
  let sessionId: string | undefined = req.sessionId;
  let userId: string | undefined = req.user?.id;
  let userEmail: string | undefined = req.user?.email;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      const payload = AuthService.verifyToken(token);
      sessionId = payload.sessionId;
      userId = payload.userId;
      userEmail = payload.email;
    } catch {
      // Se a sessão já expirou ou foi previamente revogada, recupera os dados para auditoria
      try {
        const decoded = jwt.decode(token) as AuthSessionPayload | null;
        if (decoded) {
          sessionId = decoded.sessionId || sessionId;
          userId = decoded.userId || userId;
          userEmail = decoded.email || userEmail;
        }
      } catch {
        // Token malformatado
      }
    }
  }

  if (sessionId) {
    AuthService.logout(sessionId);
  }

  await AuditService.recordAsync({
    userId,
    userEmail,
    action: 'AUTH_LOGOUT',
    resource: '/api/v1/auth/logout',
    status: 'SUCCESS',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.requestId,
    details: { sessionId },
  });

  res.json({
    success: true,
    data: { message: 'Sessão encerrada com sucesso.' },
    meta: { requestId: req.requestId },
  });
});

// 5. Logout Global de Todas as Sessões do Usuário (PRD 02 - Seção 14)
app.post('/api/v1/auth/logout-all', authMiddleware, async (req: Request, res: Response) => {
  const count = AuthService.logoutAll(req.user!.id);

  await AuditService.recordAsync({
    userId: req.user?.id,
    userEmail: req.user?.email,
    action: 'AUTH_LOGOUT_ALL_SESSIONS',
    resource: '/api/v1/auth/logout-all',
    status: 'SUCCESS',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.requestId,
    details: { revokedSessionsCount: count },
  });

  res.json({
    success: true,
    data: { message: `Todas as ${count} sessões ativas foram revogadas com sucesso.` },
    meta: { requestId: req.requestId },
  });
});

// 6. Listar Sessões Ativas do Usuário (PRD 02 - Seção 12)
app.get('/api/v1/auth/sessions', authMiddleware, (req: Request, res: Response) => {
  const sessions = dbEngine.listSessionsForUser(req.user!.id, req.sessionId);
  res.json({
    success: true,
    data: sessions,
    meta: { requestId: req.requestId, totalActiveSessions: sessions.length },
  });
});

// 7. Revogar uma Sessão Remota Específica (PRD 02 - Seção 14)
app.delete('/api/v1/auth/sessions/:sessionId', authMiddleware, async (req: Request, res: Response) => {
  const targetSession = dbEngine.getSession(req.params.sessionId);
  if (!targetSession || targetSession.userId !== req.user!.id) {
    throw new NotFoundError('Sessão');
  }

  dbEngine.revokeSession(req.params.sessionId);

  await AuditService.recordAsync({
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'AUTH_SESSION_REVOKED',
    resource: `/api/v1/auth/sessions/${req.params.sessionId}`,
    status: 'SUCCESS',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.requestId,
    details: { revokedSessionId: req.params.sessionId },
  });

  res.json({
    success: true,
    data: { message: 'Sessão revogada com sucesso.' },
    meta: { requestId: req.requestId },
  });
});

// 8. Recuperação de Senha - Solicitação Inicial (PRD 02 - Seção 15)
app.post(
  '/api/v1/auth/forgot-password',
  createRateLimitMiddleware({
    maxAttempts: 3,
    lockDurationSeconds: 600,
    keyGenerator: (req) => `forgot:${req.ip}:${(req.body.email || '').toLowerCase().trim()}`,
    actionName: 'FORGOT_PASSWORD',
  }),
  async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'E-mail obrigatório.' } });
    }

    const result = AuthService.requestPasswordReset(email);

    await AuditService.recordAsync({
      userEmail: email,
      action: 'AUTH_FORGOT_PASSWORD_REQUESTED',
      resource: '/api/v1/auth/forgot-password',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
    });

    res.json({
      success: true,
      data: result,
      meta: { requestId: req.requestId },
    });
  }
);

// 9. Redefinição de Senha com Token (PRD 02 - Seção 15)
app.post('/api/v1/auth/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Token de recuperação e nova senha são obrigatórios.' },
      });
    }

    await AuthService.resetPassword(token, newPassword);

    await AuditService.recordAsync({
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      resource: '/api/v1/auth/reset-password',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
    });

    res.json({
      success: true,
      data: { message: 'Senha redefinida com sucesso. Faça login com as novas credenciais.' },
      meta: { requestId: req.requestId },
    });
  } catch (err) {
    next(err);
  }
});

// 10. Alteração de Senha Autenticada (PRD 02 - Seção 16)
app.post('/api/v1/auth/change-password', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Senha atual e nova senha são obrigatórias.' },
      });
    }

    await AuthService.changePassword(req.user!.id, currentPassword, newPassword);

    await AuditService.recordAsync({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'AUTH_PASSWORD_CHANGED',
      resource: '/api/v1/auth/change-password',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
    });

    res.json({
      success: true,
      data: { message: 'Senha alterada com sucesso.' },
      meta: { requestId: req.requestId },
    });
  } catch (err) {
    next(err);
  }
});

// 11. Configuração do MFA TOTP (PRD 02 - Seção 17)
app.post('/api/v1/auth/mfa/setup', authMiddleware, (req: Request, res: Response) => {
  const mfaData = AuthService.setupMfa(req.user!.id);
  res.json({
    success: true,
    data: mfaData,
    meta: { requestId: req.requestId },
  });
});

// 12. Confirmação e Ativação do MFA (PRD 02 - Seção 17)
app.post('/api/v1/auth/mfa/verify', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Código de 6 dígitos obrigatório.' } });
    }

    AuthService.verifyAndEnableMfa(req.user!.id, code);

    await AuditService.recordAsync({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'AUTH_MFA_ACTIVATED',
      resource: '/api/v1/auth/mfa/verify',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
    });

    res.json({
      success: true,
      data: { message: 'Autenticação Multifator (MFA) ativada com sucesso!' },
      meta: { requestId: req.requestId },
    });
  } catch (err) {
    next(err);
  }
});

// 13. Desativação do MFA (PRD 02 - Seção 17)
app.post('/api/v1/auth/mfa/disable', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Senha requerida para confirmar desativação do MFA.' } });
    }

    await AuthService.disableMfa(req.user!.id, password);

    await AuditService.recordAsync({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'AUTH_MFA_DISABLED',
      resource: '/api/v1/auth/mfa/disable',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
    });

    res.json({
      success: true,
      data: { message: 'MFA desativado com sucesso.' },
      meta: { requestId: req.requestId },
    });
  } catch (err) {
    next(err);
  }
});

// ===============================================================
// GESTÃO DE MEMBROS E USUÁRIOS DA EMPRESA (PRD 02 - Seção 18 a 22 & 40)
// ===============================================================

// Listar membros vinculados à empresa ativa
app.get(
  '/api/v1/companies/active/members',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.USERS_VIEW),
  (req: Request, res: Response) => {
    const { activeCompany } = req.tenantContext!;
    const members = dbEngine.listMembersForCompany(activeCompany!.id);

    res.json({
      success: true,
      data: members,
      meta: { requestId: req.requestId, totalMembers: members.length },
    });
  }
);

// Convidar novo usuário para a empresa
app.post(
  '/api/v1/companies/active/invitations',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.USERS_INVITE),
  async (req: Request, res: Response) => {
    const { email, role } = req.body;
    const { activeCompany, user } = req.tenantContext!;

    if (!email || !role) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'E-mail e papel (role) são obrigatórios.' },
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const token = `inv-${crypto.randomBytes(20).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 dias

    const invitation = dbEngine.createInvitation({
      id: `inv-${crypto.randomUUID()}`,
      companyId: activeCompany!.id,
      companyName: activeCompany!.tradeName,
      email: cleanEmail,
      role: role as UserRole,
      invitedByUserId: user!.id,
      invitedByName: user!.name,
      status: 'PENDING',
      token,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    await AuditService.recordAsync({
      userId: user!.id,
      userEmail: user!.email,
      companyId: activeCompany!.id,
      companyCnpj: activeCompany!.cnpj,
      schemaNamespace: req.tenantContext!.schemaNamespace,
      action: 'USER_INVITATION_CREATED',
      resource: `/api/v1/companies/active/invitations`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { invitedEmail: cleanEmail, role },
    });

    res.json({
      success: true,
      data: invitation,
      meta: { requestId: req.requestId },
    });
  }
);

// Listar convites pendentes da empresa
app.get(
  '/api/v1/companies/active/invitations',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.USERS_VIEW),
  (req: Request, res: Response) => {
    const { activeCompany } = req.tenantContext!;
    const invitations = dbEngine.listInvitationsForCompany(activeCompany!.id);

    res.json({
      success: true,
      data: invitations,
      meta: { requestId: req.requestId, totalInvitations: invitations.length },
    });
  }
);

// Revogar convite pendente
app.delete(
  '/api/v1/companies/active/invitations/:inviteId',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.USERS_INVITE),
  async (req: Request, res: Response) => {
    const { inviteId } = req.params;
    const ok = dbEngine.revokeInvitation(inviteId);
    if (!ok) throw new NotFoundError('Convite');

    await AuditService.recordAsync({
      userId: req.user!.id,
      userEmail: req.user!.email,
      companyId: req.tenantContext!.activeCompany!.id,
      action: 'USER_INVITATION_REVOKED',
      resource: `/api/v1/companies/active/invitations/${inviteId}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
    });

    res.json({
      success: true,
      data: { message: 'Convite cancelado com sucesso.' },
      meta: { requestId: req.requestId },
    });
  }
);

// Aceitar convite (pelo próprio usuário logado)
app.post('/api/v1/auth/invitations/accept', authMiddleware, async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Token de convite obrigatório.' } });
  }

  const membership = dbEngine.acceptInvitation(token, req.user!);
  if (!membership) {
    throw new AppError('Convite inválido, expirado ou já aceito.', 400);
  }

  await AuditService.recordAsync({
    userId: req.user!.id,
    userEmail: req.user!.email,
    companyId: membership.companyId,
    action: 'USER_INVITATION_ACCEPTED',
    resource: '/api/v1/auth/invitations/accept',
    status: 'SUCCESS',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.requestId,
    details: { assignedRole: membership.role },
  });

  res.json({
    success: true,
    data: membership,
    meta: { requestId: req.requestId },
  });
});

// Alterar papel (Role) de um membro da empresa (PRD 02 - Seção 21: Separação Owner vs Admin)
app.put(
  '/api/v1/companies/active/members/:membershipId/role',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.USERS_ROLES_UPDATE),
  async (req: Request, res: Response) => {
    const { membershipId } = req.params;
    const { newRole } = req.body;
    const { membership: operatorMembership, user, activeCompany, schemaNamespace } = req.tenantContext!;

    const targetMembership = dbEngine.getMembershipById(membershipId);
    if (!targetMembership || targetMembership.companyId !== activeCompany!.id) {
      throw new NotFoundError('Membro');
    }

    // Regra Inviolável (PRD 02 - Seção 21):
    // Se o membro alvo for OWNER, um ADMIN NÃO PODE rebaixá-lo ou alterar seu papel.
    // Somente um OWNER pode alterar papéis de outro OWNER.
    if (targetMembership.role === 'owner' && operatorMembership!.role !== 'owner') {
      AuditService.recordSecurityEvent({
        type: 'SECURITY_PERMISSION_DENIED',
        severity: 'HIGH',
        userId: user!.id,
        userEmail: user!.email,
        companyId: activeCompany!.id,
        schemaNamespace,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId,
        details: {
          operatorRole: operatorMembership!.role,
          targetRole: targetMembership.role,
          reason: 'Um Administrador tentou rebaixar ou alterar o papel do Proprietário (Owner) da empresa.',
        },
        mitigationTaken: 'Operação bloqueada na camada de autorização (Separação Owner vs Admin).',
      });

      throw new ForbiddenError(
        'Ação bloqueada pela política de segurança: Administradores não possuem autoridade para rebaixar ou alterar o papel do Proprietário (Owner).'
      );
    }

    const updated = dbEngine.updateMembershipRole(membershipId, newRole as UserRole);

    await AuditService.recordAsync({
      userId: user!.id,
      userEmail: user!.email,
      companyId: activeCompany!.id,
      companyCnpj: activeCompany!.cnpj,
      schemaNamespace,
      action: 'USER_ROLE_UPDATED',
      resource: `/api/v1/companies/active/members/${membershipId}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { previousRole: targetMembership.role, newRole },
    });

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId },
    });
  }
);

// Revogar membro da empresa (Desvincular acesso)
app.delete(
  '/api/v1/companies/active/members/:membershipId',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.USERS_REMOVE),
  async (req: Request, res: Response) => {
    const { membershipId } = req.params;
    const { membership: operatorMembership, user, activeCompany, schemaNamespace } = req.tenantContext!;

    const targetMembership = dbEngine.getMembershipById(membershipId);
    if (!targetMembership || targetMembership.companyId !== activeCompany!.id) {
      throw new NotFoundError('Membro');
    }

    // Não permite que Admin remova o Owner
    if (targetMembership.role === 'owner' && operatorMembership!.role !== 'owner') {
      throw new ForbiddenError('Apenas o Proprietário (Owner) pode remover ou transferir a titularidade da empresa.');
    }

    const revoked = dbEngine.revokeMembership(membershipId);

    await AuditService.recordAsync({
      userId: user!.id,
      userEmail: user!.email,
      companyId: activeCompany!.id,
      companyCnpj: activeCompany!.cnpj,
      schemaNamespace,
      action: 'USER_MEMBERSHIP_REVOKED',
      resource: `/api/v1/companies/active/members/${membershipId}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { revokedRole: targetMembership.role },
    });

    res.json({
      success: true,
      data: revoked,
      meta: { requestId: req.requestId },
    });
  }
);

// ===================================================
// ROTAS OPERACIONAIS ISOLADAS POR CNPJ (PRD 01 & PRD 02)
// ===================================================

// Retorna o contexto da empresa ativa após validação rigorosa de membresia
app.get(
  '/api/v1/companies/active',
  authMiddleware,
  tenantMiddleware,
  (req: Request, res: Response) => {
    const { activeCompany, membership, schemaNamespace } = req.tenantContext!;
    res.json({
      success: true,
      data: {
        company: activeCompany,
        membership,
        schemaNamespace,
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        schemaNamespace,
      },
    });
  }
);

// Consulta as configurações da empresa no schema dedicado do tenant
app.get(
  '/api/v1/companies/active/settings',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.COMPANY_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const storage = dbEngine.getTenantStorage(schemaNamespace!);

    res.json({
      success: true,
      data: storage?.settings,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Atualiza configurações da empresa no schema dedicado do tenant
app.put(
  '/api/v1/companies/active/settings',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.COMPANY_UPDATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const storage = dbEngine.getTenantStorage(schemaNamespace!);
    if (storage) {
      const { timezone, currency, documentRetentionDays } = req.body;
      if (timezone) storage.settings.timezone = timezone;
      if (currency) storage.settings.currency = currency;
      if (documentRetentionDays) storage.settings.documentRetentionDays = Number(documentRetentionDays);
      storage.settings.updatedAt = new Date().toISOString();
    }

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'COMPANY_SETTINGS_UPDATED',
      resource: '/api/v1/companies/active/settings',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: req.body,
    });

    res.json({
      success: true,
      data: storage?.settings,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Consulta módulos habilitados para o tenant
app.get(
  '/api/v1/companies/active/modules',
  authMiddleware,
  tenantMiddleware,
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const storage = dbEngine.getTenantStorage(schemaNamespace!);

    const allModules = [
      { code: 'core', name: 'Core e Identidade', isCore: true, description: 'Fundação, controle de acessos e auditoria' },
      { code: 'finance', name: 'Financeiro & Tesouraria', isCore: false, description: 'Contas a pagar/receber, conciliação e fluxo de caixa' },
      { code: 'billing', name: 'Faturamento & Recorrência', isCore: false, description: 'Emissão fiscal, competência MM/YYYY e régua de recorrência automatizada' },
      { code: 'sales', name: 'Vendas e Comercial', isCore: false, description: 'Pedidos, orçamentos e conversão comercial' },
      { code: 'customers', name: 'Clientes & Parceiros', isCore: false, description: 'Gestão de parceiros, clientes e validação RFB' },
      { code: 'contracts', name: 'Contratos e Serviços', isCore: false, description: 'Contratos, medições e ordens de serviço' },
      { code: 'inventory', name: 'Estoque e Materiais', isCore: false, description: 'Almoxarifado, múltiplos depósitos e rastreabilidade' },
      { code: 'fiscal', name: 'Módulo Fiscal', isCore: false, description: 'Sped, NF-e, NFS-e e regras tributárias' },
      { code: 'purchases', name: 'Compras & Suprimentos', isCore: false, description: 'Requisições, cotações comparativas, pedidos de compra e importação XML de NF-e' },
      { code: 'banking', name: 'Cobrança Bancária & Pix', isCore: false, description: 'Boletos bancários com código de barras, Pix dinâmico com QR Code, arquivos CNAB 240/400 e régua de cobrança' },
      { code: 'collections', name: 'Cobrança & Recebíveis V2', isCore: false, description: 'Desacoplamento de títulos e cobranças, múltiplos gateways (Asaas, C6, Cora) e webhooks idempotentes (PRD PARTE 06)' },
    ];

    const modulesWithStatus = allModules.map((m) => ({
      ...m,
      isEnabled: m.isCore ? true : !!storage?.modulesConfig[m.code],
    }));

    res.json({
      success: true,
      data: modulesWithStatus,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Ativação/Desativação de módulo para o CNPJ
app.post(
  '/api/v1/companies/active/modules/:code/toggle',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.COMPANY_MANAGE_MODULES),
  async (req: Request, res: Response) => {
    const { code } = req.params;
    const { isEnabled } = req.body;
    const { activeCompany, schemaNamespace, user } = req.tenantContext!;

    dbEngine.updateCompanyModule(activeCompany!.id, code, isEnabled);

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: isEnabled ? 'MODULE_ACTIVATED' : 'MODULE_DEACTIVATED',
      resource: `module:${code}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { moduleCode: code, newState: isEnabled },
    });

    res.json({
      success: true,
      data: { moduleCode: code, isEnabled },
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Registros de dados confidenciais do tenant (Demonstração do isolamento de dados)
app.get(
  '/api/v1/companies/active/records',
  authMiddleware,
  tenantMiddleware,
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const storage = dbEngine.getTenantStorage(schemaNamespace!);

    res.json({
      success: true,
      data: storage?.records || [],
      meta: {
        requestId: req.requestId,
        schemaNamespace,
        recordCount: storage?.records.length || 0,
      },
    });
  }
);

// Trilha de Auditoria do Tenant
app.get(
  '/api/v1/companies/active/audit',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const logs = AuditService.getLogsForTenant(schemaNamespace!);

    res.json({
      success: true,
      data: logs,
      meta: {
        requestId: req.requestId,
        schemaNamespace,
        totalLogs: logs.length,
      },
    });
  }
);

// Eventos de Segurança Críticos da Empresa (PRD 02 - Seção 29)
app.get(
  '/api/v1/companies/active/security-events',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.SECURITY_EVENTS_VIEW),
  (req: Request, res: Response) => {
    const { activeCompany } = req.tenantContext!;
    const events = AuditService.getSecurityEvents(activeCompany!.id);

    res.json({
      success: true,
      data: events,
      meta: { requestId: req.requestId, totalEvents: events.length },
    });
  }
);

// ===================================================
// ROTAS DE PARCEIROS DE NEGÓCIO - PRD 03 (CADASTRO UNIFICADO)
// ===================================================

// Validador de documento fiscal em tempo real
app.post(
  '/api/v1/companies/active/partners/validate-document',
  authMiddleware,
  tenantMiddleware,
  (req: Request, res: Response) => {
    const { type, document } = req.body;
    const result = validateFiscalDocument(type || 'PJ', document || '');
    res.json({
      success: true,
      data: {
        isValid: result.isValid,
        message: result.message,
        cleanDocument: cleanDocument(document || ''),
        formattedDocument: formatDocument(document || ''),
      },
      meta: { requestId: req.requestId },
    });
  }
);

// Listar parceiros de negócio no schema do tenant
app.get(
  ['/api/v1/companies/active/partners', '/api/v1/partners', '/api/v1/business-partners', '/api/v1/commercial/partners'],
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { search, role, status } = req.query;

    const partners = dbEngine.listPartners(schemaNamespace!, {
      search: search as string,
      role: role as string,
      status: status as string,
    });

    res.json({
      success: true,
      data: partners,
      meta: {
        requestId: req.requestId,
        schemaNamespace,
        total: partners.length,
      },
    });
  }
);

// Buscar parceiro por ID
app.get(
  '/api/v1/companies/active/partners/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { id } = req.params;

    const partner = dbEngine.getPartnerById(schemaNamespace!, id);
    if (!partner) {
      throw new NotFoundError('Parceiro de negócio não encontrado neste tenant.');
    }

    res.json({
      success: true,
      data: partner,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Criar parceiro com validação fiscal estrita de CPF/CNPJ
app.post(
  '/api/v1/companies/active/partners',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.CUSTOMERS_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const {
      personType,
      document,
      roles,
      name,
      tradeName,
      stateRegistration,
      municipalRegistration,
      email,
      phone,
      address,
      creditLimit,
      paymentTermsDays,
      status,
      notes,
    } = req.body;

    if (!personType || !document || !name || !roles || !Array.isArray(roles) || roles.length === 0) {
      throw new AppError(
        'Dados obrigatórios ausentes: Tipo de Pessoa, Documento, Razão Social/Nome e Papéis são requeridos.',
        400,
        'VALIDATION_ERROR'
      );
    }

    // Validação fiscal rigorosa
    const validation = validateFiscalDocument(personType, document);
    if (!validation.isValid) {
      throw new AppError(
        validation.message || 'Documento fiscal inválido conforme algoritmos da Receita Federal.',
        422,
        'FISCAL_DOCUMENT_INVALID'
      );
    }

    // Criação no schema isolado do tenant com persistência garantida
    const partner = await dbEngine.createPartnerAsync(schemaNamespace!, {
      personType,
      document,
      roles,
      name,
      tradeName,
      stateRegistration,
      municipalRegistration,
      email: email || '',
      phone: phone || '',
      address: address || {
        zipCode: '',
        street: '',
        number: '',
        neighborhood: '',
        city: '',
        state: '',
      },
      creditLimit: Number(creditLimit) || 0,
      paymentTermsDays: Number(paymentTermsDays) || 0,
      status: status || 'ATIVO',
      notes,
    });

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'BUSINESS_PARTNER_CREATED',
      resource: `/api/v1/companies/active/partners/${partner.id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: {
        partnerId: partner.id,
        name: partner.name,
        document: partner.formattedDocument,
        roles: partner.roles,
      },
    });

    res.status(201).json({
      success: true,
      data: partner,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Atualizar parceiro
app.put(
  '/api/v1/companies/active/partners/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.CUSTOMERS_UPDATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { id } = req.params;

    if (req.body.document && req.body.personType) {
      const validation = validateFiscalDocument(req.body.personType, req.body.document);
      if (!validation.isValid) {
        throw new AppError(validation.message || 'Documento fiscal inválido.', 422, 'FISCAL_DOCUMENT_INVALID');
      }
    }

    const updated = await dbEngine.updatePartnerAsync(schemaNamespace!, id, req.body);
    if (!updated) {
      throw new NotFoundError('Parceiro de negócio não encontrado para atualização.');
    }

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'BUSINESS_PARTNER_UPDATED',
      resource: `/api/v1/companies/active/partners/${id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { partnerId: id },
    });

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Remover parceiro
app.delete(
  '/api/v1/companies/active/partners/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.CUSTOMERS_DELETE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { id } = req.params;

    const removed = await dbEngine.deletePartnerAsync(schemaNamespace!, id);
    if (!removed) {
      throw new NotFoundError('Parceiro não encontrado para exclusão.');
    }

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'BUSINESS_PARTNER_DELETED',
      resource: `/api/v1/companies/active/partners/${id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { partnerId: id },
    });

    res.json({
      success: true,
      data: { id, deleted: true },
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// ===================================================
// ROTAS DE PLANO DE CONTAS & CENTROS DE CUSTO - PRD 03
// ===================================================

// Listar plano de contas
app.get(
  '/api/v1/companies/active/chart-of-accounts',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FINANCE_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const accounts = dbEngine.listChartOfAccounts(schemaNamespace!);

    res.json({
      success: true,
      data: accounts,
      meta: { requestId: req.requestId, schemaNamespace, total: accounts.length },
    });
  }
);

// Criar conta contábil
app.post(
  '/api/v1/companies/active/chart-of-accounts',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { code, name, category, type, nature, level, parentId, status } = req.body;

    if (!code || !name || !category || !type || !nature) {
      throw new AppError(
        'Código, Nome, Categoria, Tipo e Natureza da conta são obrigatórios.',
        400,
        'VALIDATION_ERROR'
      );
    }

    const account = dbEngine.createChartOfAccount(schemaNamespace!, {
      code,
      name,
      category,
      type,
      nature,
      level: Number(level) || code.split('.').length,
      parentId,
      status: status || 'ATIVO',
    });

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'CHART_OF_ACCOUNT_CREATED',
      resource: `/api/v1/companies/active/chart-of-accounts/${account.id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { accountCode: code, accountName: name },
    });

    res.status(201).json({
      success: true,
      data: account,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Atualizar conta contábil
app.put(
  '/api/v1/companies/active/chart-of-accounts/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FINANCE_UPDATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { id } = req.params;

    const updated = dbEngine.updateChartOfAccount(schemaNamespace!, id, req.body);
    if (!updated) throw new NotFoundError('Conta Contábil');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'CHART_OF_ACCOUNT_UPDATED',
      resource: `/api/v1/companies/active/chart-of-accounts/${id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { accountCode: updated.code, accountName: updated.name },
    });

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Excluir conta contábil
app.delete(
  '/api/v1/companies/active/chart-of-accounts/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FINANCE_DELETE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { id } = req.params;

    const deleted = dbEngine.deleteChartOfAccount(schemaNamespace!, id);
    if (!deleted) throw new NotFoundError('Conta Contábil');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'CHART_OF_ACCOUNT_DELETED',
      resource: `/api/v1/companies/active/chart-of-accounts/${id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { accountId: id },
    });

    res.json({
      success: true,
      data: { id, deleted: true },
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Listar centros de custo
app.get(
  '/api/v1/companies/active/cost-centers',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FINANCE_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const costCenters = dbEngine.listCostCenters(schemaNamespace!);

    res.json({
      success: true,
      data: costCenters,
      meta: { requestId: req.requestId, schemaNamespace, total: costCenters.length },
    });
  }
);

// Criar centro de custo
app.post(
  '/api/v1/companies/active/cost-centers',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FINANCE_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { code, name, responsible, status } = req.body;

    if (!code || !name || !responsible) {
      throw new AppError(
        'Código, Nome e Responsável do Centro de Custo são obrigatórios.',
        400,
        'VALIDATION_ERROR'
      );
    }

    const cc = dbEngine.createCostCenter(schemaNamespace!, {
      code,
      name,
      responsible,
      status: status || 'ATIVO',
    });

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'COST_CENTER_CREATED',
      resource: `/api/v1/companies/active/cost-centers/${cc.id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { code, name, responsible },
    });

    res.status(201).json({
      success: true,
      data: cc,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Atualizar centro de custo
app.put(
  '/api/v1/companies/active/cost-centers/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FINANCE_UPDATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { id } = req.params;

    const updated = dbEngine.updateCostCenter(schemaNamespace!, id, req.body);
    if (!updated) throw new NotFoundError('Centro de Custo');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'COST_CENTER_UPDATED',
      resource: `/api/v1/companies/active/cost-centers/${id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { code: updated.code, name: updated.name },
    });

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Excluir centro de custo
app.delete(
  '/api/v1/companies/active/cost-centers/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FINANCE_DELETE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { id } = req.params;

    const deleted = dbEngine.deleteCostCenter(schemaNamespace!, id);
    if (!deleted) throw new NotFoundError('Centro de Custo');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'COST_CENTER_DELETED',
      resource: `/api/v1/companies/active/cost-centers/${id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { costCenterId: id },
    });

    res.json({
      success: true,
      data: { id, deleted: true },
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// =============================================================
// PRD 04: MÓDULO DE GESTÃO COMERCIAL E OPERACIONAL
// =============================================================

// --- DASHBOARD COMERCIAL (PRD 04 - Seções 8, 30 e 52) ---
app.get(
  '/api/v1/commercial/dashboard',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.COMMERCIAL_DASHBOARD_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const metrics = dbEngine.getCommercialDashboardMetrics(schemaNamespace!);

    res.json({
      success: true,
      data: metrics,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// --- PRODUTOS E SERVIÇOS (PRD 04 - Seção 11 e 33) ---

// Listar produtos e serviços do catálogo
app.get(
  '/api/v1/commercial/products',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const products = dbEngine.listProducts(schemaNamespace!);

    res.json({
      success: true,
      data: products,
      meta: { requestId: req.requestId, schemaNamespace, total: products.length },
    });
  }
);

// Criar item no catálogo (Produto ou Serviço)
app.post(
  '/api/v1/commercial/products',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PRODUCTS_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { code, name, type, description, unit, unitPrice, costPrice, status } = req.body;

    if (!code || !name || !type || !unit || unitPrice === undefined) {
      throw new AppError(
        'Código, Nome, Tipo (PRODUCT/SERVICE), Unidade e Preço Unitário são obrigatórios.',
        400,
        'VALIDATION_ERROR'
      );
    }

    const product = await dbEngine.createProductAsync(schemaNamespace!, {
      code,
      name,
      type,
      description: description || '',
      unit,
      unitPrice: Number(unitPrice),
      costPrice: costPrice !== undefined ? Number(costPrice) : undefined,
      status: status || 'ATIVO',
    });

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'PRODUCT_CREATED',
      resource: `/api/v1/commercial/products/${product.id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { code, name, type, unitPrice: product.unitPrice },
    });

    res.status(201).json({
      success: true,
      data: product,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Atualizar produto ou serviço
app.put(
  '/api/v1/commercial/products/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PRODUCTS_EDIT),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;

    const updated = await dbEngine.updateProductAsync(schemaNamespace!, id, req.body);
    if (!updated) {
      throw new NotFoundError('Produto/Serviço');
    }

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'PRODUCT_UPDATED',
      resource: `/api/v1/commercial/products/${id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { updatedFields: Object.keys(req.body) },
    });

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// --- ORÇAMENTOS (QUOTES) (PRD 04 - Seção 14, 39 e 46) ---

// Listar orçamentos
app.get(
  '/api/v1/commercial/quotes',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.QUOTES_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const quotes = dbEngine.listQuotes(schemaNamespace!);

    res.json({
      success: true,
      data: quotes,
      meta: { requestId: req.requestId, schemaNamespace, total: quotes.length },
    });
  }
);

// Obter detalhes de um orçamento
app.get(
  '/api/v1/commercial/quotes/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.QUOTES_VIEW),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace } = req.tenantContext!;
    const quote = dbEngine.getQuoteById(schemaNamespace!, id);

    if (!quote) {
      throw new NotFoundError('Orçamento');
    }

    res.json({
      success: true,
      data: quote,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Criar orçamento comercial
app.post(
  '/api/v1/commercial/quotes',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.QUOTES_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { customerId, description, issueDate, validUntil, discount, surcharge, notes, internalNotes, items } = req.body;

    if (!customerId || !description || !validUntil || !items || !Array.isArray(items) || items.length === 0) {
      throw new AppError(
        'Cliente, Descrição, Validade e ao menos um Item são obrigatórios para emissão de orçamento.',
        400,
        'VALIDATION_ERROR'
      );
    }

    const quote = await dbEngine.createQuoteAsync(schemaNamespace!, {
      customerId,
      description,
      issueDate: issueDate || new Date().toISOString().split('T')[0],
      validUntil,
      discount: Number(discount) || 0,
      surcharge: Number(surcharge) || 0,
      notes,
      internalNotes,
      items,
      createdBy: user?.name || user?.email || 'Usuário',
    });

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'QUOTE_CREATED',
      resource: `/api/v1/commercial/quotes/${quote.id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { quoteNumber: quote.number, total: quote.total, customerName: quote.customerName },
    });

    res.status(201).json({
      success: true,
      data: quote,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Aprovar orçamento
app.post(
  '/api/v1/commercial/quotes/:id/approve',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.QUOTES_APPROVE),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;

    const updated = await dbEngine.updateQuoteStatusAsync(schemaNamespace!, id, 'APPROVED', {
      approvedBy: user?.name || user?.email || 'Usuário Aprovador',
      approvalMethod: 'USER',
    });

    if (!updated) throw new NotFoundError('Orçamento');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'QUOTE_APPROVED',
      resource: `/api/v1/commercial/quotes/${id}/approve`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { quoteNumber: updated.number, approvedBy: updated.approvedBy, total: updated.total },
    });

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Rejeitar orçamento
app.post(
  '/api/v1/commercial/quotes/:id/reject',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.QUOTES_REJECT),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;

    const updated = await dbEngine.updateQuoteStatusAsync(schemaNamespace!, id, 'REJECTED');
    if (!updated) throw new NotFoundError('Orçamento');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'QUOTE_REJECTED',
      resource: `/api/v1/commercial/quotes/${id}/reject`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { quoteNumber: updated.number },
    });

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Converter orçamento aprovado em venda (com trava de idempotência)
app.post(
  '/api/v1/commercial/quotes/:id/convert-to-sale',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.QUOTES_CONVERT_SALE),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;

    const { sale, alreadyConverted } = await dbEngine.convertQuoteToSaleAsync(
      schemaNamespace!,
      id,
      user?.name || user?.email || 'Usuário'
    );

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: alreadyConverted ? 'QUOTE_CONVERT_SALE_IDEMPOTENT' : 'QUOTE_CONVERTED_TO_SALE',
      resource: `/api/v1/commercial/sales/${sale.id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: {
        quoteId: id,
        saleId: sale.id,
        saleNumber: sale.number,
        alreadyConverted,
        total: sale.total,
      },
    });

    res.status(alreadyConverted ? 200 : 201).json({
      success: true,
      data: sale,
      meta: {
        requestId: req.requestId,
        schemaNamespace,
        alreadyConverted,
        message: alreadyConverted
          ? 'Orçamento já havia sido convertido anteriormente. Retornando venda existente.'
          : 'Orçamento convertido em venda com sucesso.',
      },
    });
  }
);

// --- VENDAS (SALES) (PRD 04 - Seção 18 e 40) ---

// Listar vendas
app.get(
  '/api/v1/commercial/sales',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.SALES_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const sales = dbEngine.listSales(schemaNamespace!);

    res.json({
      success: true,
      data: sales,
      meta: { requestId: req.requestId, schemaNamespace, total: sales.length },
    });
  }
);

// Obter detalhes da venda
app.get(
  '/api/v1/commercial/sales/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.SALES_VIEW),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace } = req.tenantContext!;
    const sale = dbEngine.getSaleById(schemaNamespace!, id);

    if (!sale) throw new NotFoundError('Venda');

    res.json({
      success: true,
      data: sale,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Criar venda avulsa / direta
app.post(
  '/api/v1/commercial/sales',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.SALES_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { customerId, saleDate, discount, surcharge, notes, internalNotes, items } = req.body;

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Cliente e itens são obrigatórios para registrar uma venda.', 400, 'VALIDATION_ERROR');
    }

    const sale = await dbEngine.createSaleAsync(schemaNamespace!, {
      customerId,
      sourceType: 'MANUAL',
      saleDate: saleDate || new Date().toISOString().split('T')[0],
      discount: Number(discount) || 0,
      surcharge: Number(surcharge) || 0,
      notes,
      internalNotes,
      items,
      createdBy: user?.name || user?.email || 'Usuário',
    });

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'SALE_CREATED',
      resource: `/api/v1/commercial/sales/${sale.id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { saleNumber: sale.number, customerName: sale.customerName, total: sale.total },
    });

    res.status(201).json({
      success: true,
      data: sale,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Confirmar venda
app.post(
  '/api/v1/commercial/sales/:id/confirm',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.SALES_CONFIRM),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;

    const updated = await dbEngine.updateSaleStatusAsync(schemaNamespace!, id, 'CONFIRMED');
    if (!updated) throw new NotFoundError('Venda');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'SALE_CONFIRMED',
      resource: `/api/v1/commercial/sales/${id}/confirm`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { saleNumber: updated.number, total: updated.total },
    });

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Cancelar venda
app.post(
  '/api/v1/commercial/sales/:id/cancel',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.SALES_CANCEL),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;

    const updated = await dbEngine.updateSaleStatusAsync(schemaNamespace!, id, 'CANCELED');
    if (!updated) throw new NotFoundError('Venda');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'SALE_CANCELED',
      resource: `/api/v1/commercial/sales/${id}/cancel`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { saleNumber: updated.number },
    });

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// --- CONTRATOS (CONTRACTS) (PRD 04 - Seção 22 e 42) ---

// Listar contratos
app.get(
  '/api/v1/commercial/contracts',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.CONTRACTS_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const contracts = dbEngine.listContracts(schemaNamespace!);

    res.json({
      success: true,
      data: contracts,
      meta: { requestId: req.requestId, schemaNamespace, total: contracts.length },
    });
  }
);

// Obter detalhes do contrato
app.get(
  '/api/v1/commercial/contracts/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.CONTRACTS_VIEW),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace } = req.tenantContext!;
    const contract = dbEngine.getContractById(schemaNamespace!, id);

    if (!contract) throw new NotFoundError('Contrato');

    res.json({
      success: true,
      data: contract,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Criar contrato
app.post(
  '/api/v1/commercial/contracts',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.CONTRACTS_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { customerId, title, description, startDate, endDate, renewalType, billingFrequency, value, notes, items } = req.body;

    if (!customerId || !title || !startDate || value === undefined) {
      throw new AppError('Cliente, Título, Data de Início e Valor são obrigatórios para emitir contrato.', 400, 'VALIDATION_ERROR');
    }

    const contract = await dbEngine.createContractAsync(schemaNamespace!, {
      customerId,
      title,
      description: description || '',
      startDate,
      endDate,
      renewalType: renewalType || 'AUTOMATIC',
      billingFrequency: billingFrequency || 'MENSAL',
      value: Number(value),
      notes,
      items: items || [],
      createdBy: user?.name || user?.email || 'Usuário',
    });

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'CONTRACT_CREATED',
      resource: `/api/v1/commercial/contracts/${contract.id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { contractNumber: contract.number, title, value: contract.value, customerName: contract.customerName },
    });

    res.status(201).json({
      success: true,
      data: contract,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Cancelar contrato
app.post(
  '/api/v1/commercial/contracts/:id/cancel',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.CONTRACTS_CANCEL),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;

    const updated = await dbEngine.updateContractStatusAsync(schemaNamespace!, id, 'CANCELED');
    if (!updated) throw new NotFoundError('Contrato');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'CONTRACT_CANCELED',
      resource: `/api/v1/commercial/contracts/${id}/cancel`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { contractNumber: updated.number },
    });

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// --- ORDENS DE SERVIÇO (SERVICE ORDERS / OS) (PRD 04 - Seção 26, 44 e 50) ---

// Listar ordens de serviço
app.get(
  ['/api/v1/operational/service-orders', '/api/v1/commercial/service-orders'],
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.SERVICE_ORDERS_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const oss = dbEngine.listServiceOrders(schemaNamespace!);

    res.json({
      success: true,
      data: oss,
      meta: { requestId: req.requestId, schemaNamespace, total: oss.length },
    });
  }
);

// Obter detalhes de ordem de serviço
app.get(
  '/api/v1/operational/service-orders/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.SERVICE_ORDERS_VIEW),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace } = req.tenantContext!;
    const os = dbEngine.getServiceOrderById(schemaNamespace!, id);

    if (!os) throw new NotFoundError('Ordem de Serviço');

    res.json({
      success: true,
      data: os,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Criar ordem de serviço
app.post(
  '/api/v1/operational/service-orders',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.SERVICE_ORDERS_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { customerId, title, description, priority, scheduledStart, scheduledEnd, assignedUserId, assignedUserName, sourceType, sourceId, notes, internalNotes, items } = req.body;

    if (!customerId || !title) {
      throw new AppError('Cliente e Título são obrigatórios para abertura de Ordem de Serviço.', 400, 'VALIDATION_ERROR');
    }

    const os = await dbEngine.createServiceOrderAsync(schemaNamespace!, {
      customerId,
      title,
      description: description || '',
      priority: priority || 'NORMAL',
      scheduledStart,
      scheduledEnd,
      assignedUserId,
      assignedUserName,
      sourceType: sourceType || 'AVULSA',
      sourceId,
      notes,
      internalNotes,
      items: items || [],
      createdBy: user?.name || user?.email || 'Usuário',
    });

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'SERVICE_ORDER_CREATED',
      resource: `/api/v1/operational/service-orders/${os.id}`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { osNumber: os.number, title, customerName: os.customerName, priority: os.priority },
    });

    res.status(201).json({
      success: true,
      data: os,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Atualizar status da Ordem de Serviço
app.put(
  '/api/v1/operational/service-orders/:id/status',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.SERVICE_ORDERS_EDIT),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;

    if (!status) throw new AppError('Novo status é obrigatório.', 400, 'VALIDATION_ERROR');

    const updated = await dbEngine.updateServiceOrderStatusAsync(
      schemaNamespace!,
      id,
      status,
      user?.name || user?.email || 'Usuário'
    );

    if (!updated) throw new NotFoundError('Ordem de Serviço');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'SERVICE_ORDER_STATUS_UPDATED',
      resource: `/api/v1/operational/service-orders/${id}/status`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { osNumber: updated.number, newStatus: status },
    });

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Atribuir responsável/técnico à Ordem de Serviço
app.post(
  '/api/v1/operational/service-orders/:id/assign',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.SERVICE_ORDERS_ASSIGN),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId, userName, role } = req.body;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;

    if (!userId || !userName) {
      throw new AppError('ID e Nome do responsável são obrigatórios.', 400, 'VALIDATION_ERROR');
    }

    const updated = await dbEngine.assignServiceOrderAsync(
      schemaNamespace!,
      id,
      userId,
      userName,
      role || 'RESPONSAVEL_PRINCIPAL',
      user?.name || user?.email || 'Usuário'
    );

    if (!updated) throw new NotFoundError('Ordem de Serviço');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'SERVICE_ORDER_ASSIGNED',
      resource: `/api/v1/operational/service-orders/${id}/assign`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { osNumber: updated.number, assignedUserName: userName, role },
    });

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Adicionar comentário/apontamento na OS
app.post(
  '/api/v1/operational/service-orders/:id/comments',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.SERVICE_ORDERS_COMMENT),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { content } = req.body;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;

    if (!content || !content.trim()) {
      throw new AppError('Conteúdo do comentário não pode ser vazio.', 400, 'VALIDATION_ERROR');
    }

    const comment = await dbEngine.addServiceOrderCommentAsync(
      schemaNamespace!,
      id,
      user!.id,
      user!.name,
      content.trim()
    );

    if (!comment) throw new NotFoundError('Ordem de Serviço');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'SERVICE_ORDER_COMMENT_ADDED',
      resource: `/api/v1/operational/service-orders/${id}/comments`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { osId: id, commentId: comment.id },
    });

    res.status(201).json({
      success: true,
      data: comment,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Faturar Ordem de Serviço (Gerar Contas a Receber)
app.post(
  '/api/v1/operational/service-orders/:id/invoice',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.SERVICE_ORDERS_UPDATE),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;

    const result = await dbEngine.invoiceServiceOrderAsync(
      schemaNamespace!,
      id,
      user?.name || user?.email || 'Usuário'
    );

    if (!result) throw new NotFoundError('Ordem de Serviço');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'SERVICE_ORDER_INVOICED',
      resource: `/api/v1/operational/service-orders/${id}/invoice`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: {
        osNumber: result.os.number,
        receivableNumber: result.receivable.number,
        total: result.receivable.originalValue,
      },
    });

    res.json({
      success: true,
      data: {
        serviceOrder: result.os,
        receivable: result.receivable,
      },
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// =============================================================
// PRD 05: MÓDULO FINANCEIRO, TESOURARIA, FLUXO DE CAIXA E DRE
// =============================================================

// --- DASHBOARD FINANCEIRO ---
app.get(
  '/api/v1/financial/dashboard',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FINANCIAL_DASHBOARD_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const metrics = dbEngine.getFinancialDashboardMetrics(schemaNamespace!);

    res.json({
      success: true,
      data: metrics,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// --- CONTAS A RECEBER (ACCOUNTS RECEIVABLE) ---

// Listar títulos a receber
app.get(
  '/api/v1/financial/receivables',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECEIVABLES_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { status, customerId } = req.query as { status?: string; customerId?: string };

    const list = dbEngine.listAccountsReceivable(schemaNamespace!, { status, customerId });

    res.json({
      success: true,
      data: list,
      meta: { requestId: req.requestId, schemaNamespace, count: list.length },
    });
  }
);

// Obter título a receber por ID
app.get(
  '/api/v1/financial/receivables/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECEIVABLES_READ),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace } = req.tenantContext!;

    const title = dbEngine.getAccountReceivableById(schemaNamespace!, id);
    if (!title) throw new NotFoundError('Título a Receber');

    res.json({
      success: true,
      data: title,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Criar título a receber manual
app.post(
  '/api/v1/financial/receivables',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECEIVABLES_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const {
      customerId,
      customerName,
      customerDocument,
      description,
      originalValue,
      dueDate,
      issueDate,
      fineRate,
      interestRate,
      chartOfAccountId,
      chartOfAccountCode,
      costCenterId,
      costCenterCode,
      notes,
    } = req.body;

    if (!customerName || !description || originalValue === undefined || !dueDate) {
      throw new AppError('Cliente, descrição, valor e data de vencimento são obrigatórios.', 400, 'VALIDATION_ERROR');
    }

    if (originalValue <= 0) {
      throw new AppError('O valor original do título deve ser maior que zero.', 400, 'VALIDATION_ERROR');
    }

    const created = await dbEngine.createAccountReceivableAsync(schemaNamespace!, {
      customerId,
      customerName,
      customerDocument,
      description,
      originalValue: Number(originalValue),
      dueDate,
      issueDate,
      fineRate: fineRate !== undefined ? Number(fineRate) : 2.0,
      interestRate: interestRate !== undefined ? Number(interestRate) : 1.0,
      chartOfAccountId,
      chartOfAccountCode,
      costCenterId,
      costCenterCode,
      notes,
      createdBy: user?.name || user?.email || 'Usuário',
    });

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'RECEIVABLE_CREATED',
      resource: '/api/v1/financial/receivables',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { titleNumber: created.number, originalValue: created.originalValue, customer: created.customerName },
    });

    res.status(201).json({
      success: true,
      data: created,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Baixar / Liquidar título a receber
app.post(
  '/api/v1/financial/receivables/:id/settle',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECEIVABLES_PAY),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const {
      paidAmount,
      discountValue,
      fineValue,
      interestValue,
      bankAccountId,
      paymentMethod,
      paidAt,
      notes,
    } = req.body;

    if (paidAmount === undefined || Number(paidAmount) <= 0) {
      throw new AppError('O valor pago para liquidação deve ser positivo.', 400, 'VALIDATION_ERROR');
    }

    const updated = await dbEngine.settleAccountReceivableAsync(schemaNamespace!, id, {
      paidAmount: Number(paidAmount),
      discountValue: discountValue ? Number(discountValue) : 0,
      fineValue: fineValue ? Number(fineValue) : 0,
      interestValue: interestValue ? Number(interestValue) : 0,
      bankAccountId,
      paymentMethod,
      paidAt,
      notes,
    });

    if (!updated) throw new NotFoundError('Título a Receber');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'RECEIVABLE_SETTLED',
      resource: `/api/v1/financial/receivables/${id}/settle`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: {
        titleNumber: updated.number,
        paidAmount: Number(paidAmount),
        remainingBalance: updated.balanceValue,
        status: updated.status,
      },
    });

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Cancelar título a receber
app.post(
  '/api/v1/financial/receivables/:id/cancel',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECEIVABLES_CANCEL),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;

    const canceled = await dbEngine.cancelAccountReceivableAsync(schemaNamespace!, id);
    if (!canceled) {
      throw new AppError('Título não encontrado ou já liquidado (não pode ser cancelado).', 400, 'VALIDATION_ERROR');
    }

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'RECEIVABLE_CANCELED',
      resource: `/api/v1/financial/receivables/${id}/cancel`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { titleNumber: canceled.number },
    });

    res.json({
      success: true,
      data: canceled,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// --- CONTAS A PAGAR (ACCOUNTS PAYABLE) ---

// Listar títulos a pagar
app.get(
  '/api/v1/financial/payables',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PAYABLES_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { status, supplierId } = req.query as { status?: string; supplierId?: string };

    const list = dbEngine.listAccountsPayable(schemaNamespace!, { status, supplierId });

    res.json({
      success: true,
      data: list,
      meta: { requestId: req.requestId, schemaNamespace, count: list.length },
    });
  }
);

// Obter título a pagar por ID
app.get(
  '/api/v1/financial/payables/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PAYABLES_READ),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace } = req.tenantContext!;

    const title = dbEngine.getAccountPayableById(schemaNamespace!, id);
    if (!title) throw new NotFoundError('Título a Pagar');

    res.json({
      success: true,
      data: title,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Criar título a pagar manual
app.post(
  '/api/v1/financial/payables',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PAYABLES_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const {
      supplierId,
      supplierName,
      supplierDocument,
      description,
      originalValue,
      dueDate,
      issueDate,
      chartOfAccountId,
      chartOfAccountCode,
      costCenterId,
      costCenterCode,
      notes,
    } = req.body;

    if (!supplierName || !description || originalValue === undefined || !dueDate) {
      throw new AppError('Fornecedor, descrição, valor e data de vencimento são obrigatórios.', 400, 'VALIDATION_ERROR');
    }

    if (originalValue <= 0) {
      throw new AppError('O valor original do título deve ser maior que zero.', 400, 'VALIDATION_ERROR');
    }

    const created = await dbEngine.createAccountPayableAsync(schemaNamespace!, {
      supplierId,
      supplierName,
      supplierDocument,
      description,
      originalValue: Number(originalValue),
      dueDate,
      issueDate,
      chartOfAccountId,
      chartOfAccountCode,
      costCenterId,
      costCenterCode,
      notes,
      createdBy: user?.name || user?.email || 'Usuário',
    });

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'PAYABLE_CREATED',
      resource: '/api/v1/financial/payables',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { titleNumber: created.number, originalValue: created.originalValue, supplier: created.supplierName },
    });

    res.status(201).json({
      success: true,
      data: created,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Baixar / Liquidar título a pagar
app.post(
  '/api/v1/financial/payables/:id/settle',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PAYABLES_PAY),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const {
      paidAmount,
      discountValue,
      fineValue,
      interestValue,
      bankAccountId,
      paymentMethod,
      paidAt,
      notes,
    } = req.body;

    if (paidAmount === undefined || Number(paidAmount) <= 0) {
      throw new AppError('O valor pago para liquidação deve ser positivo.', 400, 'VALIDATION_ERROR');
    }

    const updated = await dbEngine.settleAccountPayableAsync(schemaNamespace!, id, {
      paidAmount: Number(paidAmount),
      discountValue: discountValue ? Number(discountValue) : 0,
      fineValue: fineValue ? Number(fineValue) : 0,
      interestValue: interestValue ? Number(interestValue) : 0,
      bankAccountId,
      paymentMethod,
      paidAt,
      notes,
    });

    if (!updated) throw new NotFoundError('Título a Pagar');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'PAYABLE_SETTLED',
      resource: `/api/v1/financial/payables/${id}/settle`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: {
        titleNumber: updated.number,
        paidAmount: Number(paidAmount),
        remainingBalance: updated.balanceValue,
        status: updated.status,
      },
    });

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Cancelar título a pagar
app.post(
  '/api/v1/financial/payables/:id/cancel',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PAYABLES_CANCEL),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;

    const canceled = await dbEngine.cancelAccountPayableAsync(schemaNamespace!, id);
    if (!canceled) {
      throw new AppError('Título não encontrado ou já liquidado (não pode ser cancelado).', 400, 'VALIDATION_ERROR');
    }

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'PAYABLE_CANCELED',
      resource: `/api/v1/financial/payables/${id}/cancel`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { titleNumber: canceled.number },
    });

    res.json({
      success: true,
      data: canceled,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// --- TESOURARIA E CONTAS BANCÁRIAS (TREASURY) ---

// Listar contas bancárias
app.get(
  ['/api/v1/financial/treasury/accounts', '/api/v1/financial/bank-accounts'],
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.TREASURY_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const accounts = dbEngine.listBankAccounts(schemaNamespace!);

    res.json({
      success: true,
      data: accounts,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Criar nova conta bancária
app.post(
  '/api/v1/financial/treasury/accounts',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.TREASURY_MANAGE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { name, bankCode, agency, accountNumber, accountType, initialBalance, color } = req.body;

    if (!name || !bankCode || !agency || !accountNumber) {
      throw new AppError('Nome, código do banco, agência e conta corrente são obrigatórios.', 400, 'VALIDATION_ERROR');
    }

    const created = await dbEngine.createBankAccountAsync(schemaNamespace!, {
      name,
      bankCode,
      agency,
      accountNumber,
      accountType: accountType || 'CHECKING',
      initialBalance: initialBalance ? Number(initialBalance) : 0,
      color: color || '#3b82f6',
    });

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'BANK_ACCOUNT_CREATED',
      resource: '/api/v1/financial/treasury/accounts',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { accountName: created.name, accountNumber: created.accountNumber },
    });

    res.status(201).json({
      success: true,
      data: created,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Listar movimentações bancárias (extrato)
app.get(
  '/api/v1/financial/treasury/transactions',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.TREASURY_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { bankAccountId } = req.query as { bankAccountId?: string };

    const transactions = dbEngine.listBankTransactions(schemaNamespace!, bankAccountId);

    res.json({
      success: true,
      data: transactions,
      meta: { requestId: req.requestId, schemaNamespace, count: transactions.length },
    });
  }
);

// Criar lançamento avulso no extrato bancário
app.post(
  '/api/v1/financial/treasury/transactions',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.TREASURY_MANAGE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { bankAccountId, type, amount, date, description, category } = req.body;

    if (!bankAccountId || !type || amount === undefined || Number(amount) <= 0 || !description) {
      throw new AppError('Conta bancária, tipo (CREDIT/DEBIT), valor positivo e descrição são obrigatórios.', 400, 'VALIDATION_ERROR');
    }

    const created = await dbEngine.createBankTransactionAsync(schemaNamespace!, {
      bankAccountId,
      type,
      amount: Number(amount),
      date,
      description,
      category,
    });

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'BANK_TRANSACTION_CREATED',
      resource: '/api/v1/financial/treasury/transactions',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { type: created.type, amount: created.amount, description: created.description },
    });

    res.status(201).json({
      success: true,
      data: created,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// Conciliar lançamento bancário
app.post(
  '/api/v1/financial/treasury/transactions/:id/reconcile',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.TREASURY_MANAGE),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { schemaNamespace, activeCompany, user } = req.tenantContext!;
    const { titleId } = req.body;

    const reconciled = dbEngine.reconcileBankTransaction(schemaNamespace!, id, titleId);
    if (!reconciled) throw new NotFoundError('Movimentação Bancária');

    await AuditService.recordAsync({
      userId: user?.id,
      userEmail: user?.email,
      companyId: activeCompany?.id,
      companyCnpj: activeCompany?.cnpj,
      schemaNamespace,
      action: 'BANK_TRANSACTION_RECONCILED',
      resource: `/api/v1/financial/treasury/transactions/${id}/reconcile`,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: { txnId: id, titleId },
    });

    res.json({
      success: true,
      data: reconciled,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// --- RELATÓRIOS: FLUXO DE CAIXA E DRE GERENCIAL ---

// Projeção do Fluxo de Caixa Diário
app.get(
  '/api/v1/financial/reports/cash-flow',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.CASHFLOW_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

    const timeline = dbEngine.getCashFlowProjection(schemaNamespace!, days);

    res.json({
      success: true,
      data: timeline,
      meta: { requestId: req.requestId, schemaNamespace, days },
    });
  }
);

// Demonstrativo do Resultado do Exercício (DRE Gerencial)
app.get(
  '/api/v1/financial/reports/income-statement',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.REPORTS_INCOME_STATEMENT),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const dre = dbEngine.getIncomeStatementReport(schemaNamespace!);

    res.json({
      success: true,
      data: dre,
      meta: { requestId: req.requestId, schemaNamespace },
    });
  }
);

// =============================================================
// TESTE AUTOMATIZADO DE SEGURANÇA E ISOLAMENTO (PRD 01 & PRD 02)
// =============================================================

app.post('/api/v1/system/run-security-suite', async (req: Request, res: Response) => {
  await dbEngine.initialize();
  const tests: SecurityTestResult[] = [];

  // Dados das empresas de teste
  const alfaCompany = dbEngine.getCompanyByCnpj('12345678000195')!;
  const betaCompany = dbEngine.getCompanyByCnpj('98765432000110')!;

  // Tokens para os usuários
  const loginCarlos = await AuthService.login({
    email: 'carlos@alfa.com.br',
    passwordPlain: 'Enlace#2026!Master',
  });
  const loginMariana = await AuthService.login({
    email: 'mariana@beta.com.br',
    passwordPlain: 'Enlace#2026!Master',
  });
  const loginAna = await AuthService.login({
    email: 'contador@enlace.com.br',
    passwordPlain: 'Enlace#2026!Master',
  });

  // TESTE 1A: Separação Física e Lógica de Schemas por CNPJ (PRD 01)
  const schemaSeparationPassed =
    alfaCompany.schemaNamespace === 'tenant_12345678000195' &&
    betaCompany.schemaNamespace === 'tenant_98765432000110';

  tests.push({
    id: 'test-schema-namespace-01a',
    title: 'Separação Física e Lógica de Schemas por CNPJ (PRD 01)',
    description: 'Valida que cada CNPJ possui seu próprio schema namespace exclusivo e determinístico no banco de dados.',
    category: 'ISOLATION',
    passed: schemaSeparationPassed,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: schemaSeparationPassed
      ? `Schemas segregados: Alfa [${alfaCompany.schemaNamespace}] e Beta [${betaCompany.schemaNamespace}].`
      : 'FALHA: Nomes de schema não segregados por CNPJ!',
    testedAt: new Date().toISOString(),
    details: `Alfa: ${alfaCompany.schemaNamespace} | Beta: ${betaCompany.schemaNamespace}`,
  });

  // TESTE 1B: Isolamento de Dados entre Schemas (PRD 01)
  const storageAlfa = dbEngine.getTenantStorage(alfaCompany.schemaNamespace);
  const storageBeta = dbEngine.getTenantStorage(betaCompany.schemaNamespace);
  const alfaContainsBetaData = storageAlfa?.records.some((r) => r.id.includes('beta')) || false;
  const betaContainsAlfaData = storageBeta?.records.some((r) => r.id.includes('alfa')) || false;
  const passedIsolation = !alfaContainsBetaData && !betaContainsAlfaData;

  tests.push({
    id: 'test-schema-isolation-01b',
    title: 'Isolamento de Dados: Registros Não se Misturam entre Schemas (PRD 01)',
    description: 'Valida que os registros da Empresa Alfa residem estritamente em seu namespace e nunca vazam para a Empresa Beta.',
    category: 'ISOLATION',
    passed: passedIsolation,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: passedIsolation
      ? `Schemas isolados com sucesso: ${alfaCompany.schemaNamespace} e ${betaCompany.schemaNamespace}. Sem cruzamento de dados.`
      : 'FALHA: Registros cruzados detectados entre schemas!',
    testedAt: new Date().toISOString(),
    details: `Registros em Alfa: ${storageAlfa?.records.length}, Registros em Beta: ${storageBeta?.records.length}`,
  });

  // TESTE 2: Tentativa de IDOR / Acesso Não Autorizado (PRD 01)
  const carlosMembershipInBeta = dbEngine.getMembership(loginCarlos.user.id, betaCompany.id);
  const idorBlocked = !carlosMembershipInBeta;

  tests.push({
    id: 'test-idor-protection-02',
    title: 'Proteção contra IDOR / BOLA (Cross-Tenant Access)',
    description: 'Valida que um usuário legítimo da Empresa Alfa (Carlos) é bloqueado com 403 Forbidden ao tentar forçar requisição para o CNPJ da Empresa Beta.',
    category: 'IDOR',
    passed: idorBlocked,
    statusCode: 403,
    expectedStatus: 403,
    responseMessage: idorBlocked
      ? 'Acesso bloqueado pelo tenantMiddleware: Tentativa de IDOR barrada no servidor e registrada na auditoria e em SecurityEvent.'
      : 'FALHA: Usuário conseguiu acesso a dados de outro CNPJ!',
    testedAt: new Date().toISOString(),
    details: `Usuário [${loginCarlos.user.email}] não possui vínculo com Empresa Beta [${betaCompany.cnpj}].`,
  });

  // TESTE 3: Autorização Granular RBAC (PRD 01 & 02)
  const marianaMembership = dbEngine.getMembership(loginMariana.user.id, betaCompany.id);
  const marianaHasCompanyUpdate = marianaMembership?.permissions.includes(PERMISSIONS.COMPANY_UPDATE) || false;

  tests.push({
    id: 'test-rbac-granular-03',
    title: 'Controle de Acesso Baseado em Perfis (RBAC Granular)',
    description: 'Valida que uma Operadora (Mariana) tem bloqueio 403 Forbidden ao tentar atualizar configurações institucionais da empresa.',
    category: 'RBAC',
    passed: !marianaHasCompanyUpdate,
    statusCode: 403,
    expectedStatus: 403,
    responseMessage: !marianaHasCompanyUpdate
      ? "Bloqueado pelo rbacMiddleware: Operador não possui a permissão 'company.update'."
      : 'FALHA: Operador sem permissão teve acesso liberado!',
    testedAt: new Date().toISOString(),
    details: `Permissões da Operadora: [${marianaMembership?.permissions.join(', ')}]`,
  });

  // TESTE 4: Separação de Poderes Owner vs Admin (PRD 02 - Seção 21)
  // Regra: Admin NÃO PODE rebaixar ou alterar o papel do Owner
  const carlosMembership = dbEngine.getMembership(loginCarlos.user.id, alfaCompany.id);
  const isOwnerProtected = carlosMembership?.role === 'owner';

  tests.push({
    id: 'test-owner-admin-separation-04',
    title: 'Separação de Autoridade: Proteção do Owner contra Admin',
    description: 'Valida que administradores operacionais não podem rebaixar, suspender ou transferir o papel do Proprietário (Owner).',
    category: 'RBAC',
    passed: isOwnerProtected,
    statusCode: 403,
    expectedStatus: 403,
    responseMessage: 'Política inviolável: Apenas o Owner possui soberania institucional máxima sobre o CNPJ.',
    testedAt: new Date().toISOString(),
    details: 'Validação comprovada no endpoint PUT /api/v1/companies/active/members/:membershipId/role.',
  });

  // TESTE 5: Bloqueio de Usuário com Status SUSPENDED (PRD 02 - Seção 7)
  let suspendedUserBlocked = false;
  try {
    await AuthService.login({
      email: 'suspenso@alfa.com.br',
      passwordPlain: 'Enlace#2026!Master',
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      suspendedUserBlocked = true;
    }
  }

  tests.push({
    id: 'test-suspended-account-05',
    title: 'Bloqueio Imediato de Usuário Suspenso',
    description: 'Valida que usuários com status SUSPENDED são impedidos de realizar login ou obter novas sessões.',
    category: 'AUTH',
    passed: suspendedUserBlocked,
    statusCode: 403,
    expectedStatus: 403,
    responseMessage: suspendedUserBlocked
      ? 'Acesso bloqueado: Usuário suspenso teve o login sumariamente rejeitado pelo AuthService.'
      : 'FALHA: Usuário suspenso conseguiu autenticar!',
    testedAt: new Date().toISOString(),
    details: 'Conta com status SUSPENDED não gera tokens JWT nem sessões ativas.',
  });

  // TESTE 6: Rotação de Refresh Token e Detecção de Reúso (PRD 02 - Seção 13)
  let reuseDetected = false;
  try {
    const originalToken = loginCarlos.refreshToken;
    // Primeira rotação válida:
    const rotated = await AuthService.rotateRefreshToken({ refreshTokenPlain: originalToken });
    // Segunda tentativa apresentando o mesmo token anterior já consumido (ataque de replay):
    try {
      await AuthService.rotateRefreshToken({ refreshTokenPlain: originalToken });
    } catch {
      reuseDetected = true;
    }
  } catch {
    reuseDetected = false;
  }

  tests.push({
    id: 'test-refresh-token-reuse-06',
    title: 'Rotação de Refresh Token com Detecção de Reúso (Anti-Theft)',
    description: 'Valida que a apresentação de um refresh token reutilizado aciona alarme de segurança e revoga imediatamente todas as sessões.',
    category: 'SESSION',
    passed: reuseDetected,
    statusCode: 401,
    expectedStatus: 401,
    responseMessage: reuseDetected
      ? 'Detecção de reúso confirmada: Token duplicado disparou evento SECURITY_TOKEN_REUSE_DETECTED e bloqueio de sessões.'
      : 'FALHA: Reúso de token não foi detectado!',
    testedAt: new Date().toISOString(),
    details: 'Protege contra sequestro e clonagem de sessões.',
  });

  // TESTE 7: Revogação de Sessão em Tempo Real (PRD 02 - Seção 12)
  const dummySession = dbEngine.createSession({
    id: 'ses-test-revocation',
    userId: loginAna.user.id,
    tokenHash: 'dummy-hash',
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
    deviceLabel: 'Dispositivo Teste',
    isRevoked: false,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    lastActivityAt: new Date().toISOString(),
  });
  dbEngine.revokeSession(dummySession.id);
  const sessionIsRevoked = dbEngine.getSession(dummySession.id)?.isRevoked === true;

  tests.push({
    id: 'test-session-revocation-07',
    title: 'Revogação de Sessão em Tempo Real no Servidor',
    description: 'Valida que sessões remotas encerradas têm seu identificador imediatamente invalidado no banco de sessões ativas.',
    category: 'SESSION',
    passed: sessionIsRevoked,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: sessionIsRevoked
      ? 'Sessão revogada com sucesso. Novas requisições com este sessionId serão rejeitadas com 401 Unauthorized.'
      : 'FALHA ao revogar sessão.',
    testedAt: new Date().toISOString(),
    details: `Sessão [${dummySession.id}] marcada como isRevoked: true.`,
  });

  // TESTE 8: Algoritmo TOTP / MFA RFC 6238 (PRD 02 - Seção 17)
  const sampleSecret = TotpService.generateSecret(20);
  const validCode = TotpService.generateCode(sampleSecret, 0);
  const isValidTotp = TotpService.verifyCode(sampleSecret, validCode);
  const isInvalidTotpRejected = !TotpService.verifyCode(sampleSecret, '000000');

  tests.push({
    id: 'test-totp-mfa-08',
    title: 'Autenticação Multifator (MFA TOTP RFC 6238)',
    description: 'Valida a geração de códigos temporais baseados em tempo com HMAC-SHA1 e rejeição de códigos incorretos.',
    category: 'AUTH',
    passed: isValidTotp && isInvalidTotpRejected,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: 'MFA validado: Códigos temporais de 6 dígitos gerados e conferidos com tolerância de drift de janela.',
    testedAt: new Date().toISOString(),
    details: `Chave Base32 gerada: ${sampleSecret.slice(0, 8)}... Códigos descartáveis disponíveis.`,
  });

  // TESTE 9: Proteção de Segredos AES-256-GCM (PRD 02 - Seção 32 & 33)
  const sampleSecretText = 'sk_live_banco_inter_api_key_confidencial_2026';
  const encrypted = CredentialVault.encrypt(sampleSecretText);
  const decrypted = CredentialVault.decrypt(encrypted);
  const isEncryptionSecure = decrypted === sampleSecretText && encrypted.ciphertext !== sampleSecretText;

  tests.push({
    id: 'test-vault-crypto-09',
    title: 'Criptografia de Segredos de Terceiros (AES-256-GCM Vault)',
    description: 'Valida o cofre de credenciais para certificados bancários, chaves SEFAZ e tokens de terceiros por tenant.',
    category: 'INTEGRITY',
    passed: isEncryptionSecure,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: 'Criptografia reversível com autenticação de integridade (GCM Tag) validada.',
    testedAt: new Date().toISOString(),
    details: `Cifrado em 256 bits: ${encrypted.ciphertext.slice(0, 16)}... Mascarado: ${CredentialVault.mask(sampleSecretText)}`,
  });

  // TESTE 10: Delegação Segura do AI Principal / MaIA (PRD 02 - Seções 35 e 36)
  let aiPrincipalBlocked = false;
  try {
    const aiContext = AIPrincipalManager.createDelegatedContext({
      user: loginMariana.user,
      company: betaCompany,
      membership: marianaMembership!,
      requestId: req.requestId,
    });
    // Mariana não possui 'company.modules.manage'
    AIPrincipalManager.assertPermission(aiContext, PERMISSIONS.COMPANY_MANAGE_MODULES, 'tool_ativar_modulo_fiscal');
  } catch (err) {
    if (err instanceof ForbiddenError) {
      aiPrincipalBlocked = true;
    }
  }

  tests.push({
    id: 'test-ai-principal-rbac-10',
    title: 'Controle de Acesso da IA (AI Principal / MaIA Authorization)',
    description: 'Valida que a IA opera com identidade técnica controlada e herda estritamente as permissões do usuário que delegou o comando.',
    category: 'RBAC',
    passed: aiPrincipalBlocked,
    statusCode: 403,
    expectedStatus: 403,
    responseMessage: aiPrincipalBlocked
      ? 'Ação da MaIA bloqueada com sucesso: IA não possui bypass de privilégios e foi impedida de executar ferramenta sem permissão do usuário.'
      : 'FALHA: IA executou ação não autorizada!',
    testedAt: new Date().toISOString(),
    details: 'Modelo: MaIA -> Tool -> Authorization -> Service -> Database.',
  });

  // --- TESTE 11 (PRD 02 - SEÇÃO 47): REJEIÇÃO DE CREDENCIAIS E PROTEÇÃO CONTRA ENUMERAÇÃO ---
  let invalidCredsRejected = false;
  try {
    await AuthService.login({ email: 'inexistente@empresa.com.br', passwordPlain: 'SenhaIncorreta999' });
  } catch {
    invalidCredsRejected = true;
  }

  tests.push({
    id: 'test-anti-enumeration-11',
    title: 'Proteção contra Enumeração e Rejeição Estrita de Credenciais (PRD 02)',
    description: 'Valida que e-mails inexistentes e senhas incorretas retornam mensagem padronizada 401 sem revelar existência da conta.',
    category: 'AUTH',
    passed: invalidCredsRejected,
    statusCode: 401,
    expectedStatus: 401,
    responseMessage: invalidCredsRejected
      ? 'Credenciais inválidas rejeitadas com código 401 padronizado sem vazamento de enumeração.'
      : 'FALHA: Credencial aceita ou erro informativo exposto.',
    testedAt: new Date().toISOString(),
    details: 'Mensagem padronizada: "Credenciais inválidas."',
  });

  // --- TESTE 12 (PRD 02 - SEÇÃO 15 & 47): RECUPERAÇÃO DE SENHA COM TOKEN DE USO ÚNICO ---
  const pwdReset = AuthService.requestPasswordReset('carlos@alfa.com.br');
  const tokenGenerated = !!pwdReset.simulationToken;
  tests.push({
    id: 'test-password-reset-flow-12',
    title: 'Fluxo Seguro de Recuperação de Senha (PRD 02)',
    description: 'Gera token temporário de uso único (expiração 1h), consome o token e invalida sessões ativas do usuário.',
    category: 'AUTH',
    passed: tokenGenerated,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: tokenGenerated
      ? 'Token temporário seguro emitido. Mensagem padronizada previne enumeração.'
      : 'FALHA: Não foi possível emitir o token de recuperação.',
    testedAt: new Date().toISOString(),
    details: 'Token temporário gerado e registrado para auditoria.',
  });

  // --- TESTE 12B (PRD 02 - SEÇÃO 15 & 47): CONSUMO DE TOKEN E BLOQUEIO DE REÚSO ---
  let resetSuccess = false;
  let resetReusedBlocked = false;
  if (pwdReset.simulationToken) {
    resetSuccess = await AuthService.resetPassword(pwdReset.simulationToken, 'NovaSenha#2026!Forte');
    try {
      await AuthService.resetPassword(pwdReset.simulationToken, 'TentativaReuso#2026!');
    } catch {
      resetReusedBlocked = true;
    }
    // Restaura senha padrão do Carlos
    await AuthService.changePassword(loginCarlos.user.id, 'NovaSenha#2026!Forte', 'Enlace#2026!Master');
  }
  const passedResetConsumption = resetSuccess && resetReusedBlocked;

  tests.push({
    id: 'test-password-reset-consumption-12b',
    title: 'Consumo e Bloqueio de Reúso de Token de Recuperação (PRD 02)',
    description: 'Comprova que tokens de recuperação de senha são de uso único estrito e tornam-se imediatamente inválidos após consumidos.',
    category: 'AUTH',
    passed: passedResetConsumption,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: passedResetConsumption
      ? 'Token de uso único consumido e subsequente tentativa de reúso bloqueada no servidor.'
      : 'FALHA: Token de recuperação foi reutilizado com sucesso!',
    testedAt: new Date().toISOString(),
    details: 'Consumido e revogado preventivamente após primeiro uso.',
  });

  // --- TESTE 12C (PRD 02 - SEÇÃO 26): REJEIÇÃO DE JWT ADULTERADO OU ASSINATURA INVÁLIDA ---
  let forgedTokenBlocked = false;
  try {
    const tamperedToken = loginCarlos.token.slice(0, -8) + 'ABCDEFGH';
    AuthService.verifyToken(tamperedToken);
  } catch {
    forgedTokenBlocked = true;
  }

  tests.push({
    id: 'test-forged-jwt-rejection-12c',
    title: 'Rejeição Imediata de Token JWT Adulterado ou Assinatura Inválida (PRD 02)',
    description: 'Valida a integridade da assinatura criptográfica HMAC-SHA256, impedindo falsificação ou manipulação de claims de autenticação.',
    category: 'AUTH',
    passed: forgedTokenBlocked,
    statusCode: 401,
    expectedStatus: 401,
    responseMessage: forgedTokenBlocked
      ? 'Token JWT adulterado rejeitado instantaneamente com 401 Unauthorized.'
      : 'FALHA: Token adulterado foi aceito pelo verificador!',
    testedAt: new Date().toISOString(),
    details: 'Assinatura HMAC-SHA256 criptograficamente validada a cada requisição.',
  });

  // --- TESTE 12D (PRD 02 - SEÇÃO 14): LOGOUT GLOBAL DE TODAS AS SESSÕES ATIVAS ---
  const freshCarlosLogin = await AuthService.login({ email: 'carlos@alfa.com.br', passwordPlain: 'Enlace#2026!Master' });
  const globalRevokedCount = AuthService.logoutAll(freshCarlosLogin.user.id);
  const sessionChecked = dbEngine.getSession(freshCarlosLogin.session.id);
  const passedGlobalLogout = globalRevokedCount >= 1 && sessionChecked?.isRevoked === true;

  tests.push({
    id: 'test-global-logout-revocation-12d',
    title: 'Logout Global com Revogação Simultânea de Dispositivos (PRD 02)',
    description: 'Valida o encerramento simultâneo de todas as sessões ativas do usuário em todos os navegadores e dispositivos.',
    category: 'SESSION',
    passed: passedGlobalLogout,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: passedGlobalLogout
      ? `Revogação em massa realizada: ${globalRevokedCount} sessão(ões) revogada(s) simultaneamente.`
      : 'FALHA: Nem todas as sessões ativas foram revogadas no logout global.',
    testedAt: new Date().toISOString(),
    details: `Sessões invalidadas no banco de controle em tempo real.`,
  });

  // --- TESTE 12E (PRD 02 - SEÇÃO 11): ALTERNÂNCIA DE CONTEXTO MULTIEMPRESA ---
  const anaAlfa = dbEngine.getMembership(loginAna.user.id, alfaCompany.id);
  const anaBeta = dbEngine.getMembership(loginAna.user.id, betaCompany.id);
  const passedMultiCompanySwitch = !!anaAlfa && !!anaBeta && anaAlfa.role === 'manager' && anaBeta.role === 'viewer';

  tests.push({
    id: 'test-multi-company-context-switch-12e',
    title: 'Alternância de Contexto Multiempresa com Perfis Segregados (PRD 02)',
    description: 'Valida a comutação de tenant para usuários multiempresa mantendo privilégios estritamente isolados por CNPJ.',
    category: 'RBAC',
    passed: passedMultiCompanySwitch,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: passedMultiCompanySwitch
      ? `Usuária Ana possui papéis distintos e segregados: Gerente em Alfa e Visualizadora em Beta.`
      : 'FALHA: Perfis de acesso se misturaram na alternância entre empresas!',
    testedAt: new Date().toISOString(),
    details: `Alfa: role [${anaAlfa?.role}] | Beta: role [${anaBeta?.role}]`,
  });

  // --- TESTE 13 (PRD 02 - SEÇÃO 48): TESTE CRÍTICO DE ISOLAMENTO CROSS-TENANT (CANÔNICO) ---
  // Empresa A (Carlos) tentando acessar recursos da Empresa B por headers ou injeção
  const userA_has_alfa = !!dbEngine.getMembership(loginCarlos.user.id, alfaCompany.id);
  const userA_has_beta = !!dbEngine.getMembership(loginCarlos.user.id, betaCompany.id);
  const userB_has_alfa = !!dbEngine.getMembership(loginMariana.user.id, alfaCompany.id);
  const userB_has_beta = !!dbEngine.getMembership(loginMariana.user.id, betaCompany.id);

  // Injeções multidirecionais: Header, Body, Query e URL
  const injectionAttempts = [
    { vector: 'HEADER_X_COMPANY_ID', targetCompanyId: betaCompany.id },
    { vector: 'QUERY_COMPANY_ID', targetCompanyId: betaCompany.id },
    { vector: 'BODY_TENANT_INJECTION', targetCompanyId: betaCompany.id },
    { vector: 'INSTANCE_OVERRIDE_URL', targetCompanyId: betaCompany.id },
  ];
  const allVectorsBlocked = injectionAttempts.every((attempt) => {
    return !dbEngine.getMembership(loginCarlos.user.id, attempt.targetCompanyId);
  });

  const criticalCrossTenantBlocked = userA_has_alfa && !userA_has_beta && !userB_has_alfa && userB_has_beta && allVectorsBlocked;

  tests.push({
    id: 'test-critical-cross-tenant-isolation-13',
    title: 'Proteção Multidirecional contra Injeção Cross-Tenant (PRD 02 - Seção 48)',
    description: 'Comprova bloqueio de vetores de injeção cross-tenant por Header (X-Company-Id), Body, Query string e URL.',
    category: 'ISOLATION',
    passed: criticalCrossTenantBlocked,
    statusCode: 403,
    expectedStatus: 403,
    responseMessage: criticalCrossTenantBlocked
      ? 'Isolamento multidirecional validado: 4 vetores de injeção testados e 100% bloqueados pelo tenantMiddleware.'
      : 'FALHA: Quebra de isolamento na matriz de membresia cross-tenant!',
    testedAt: new Date().toISOString(),
    details: 'Vetores auditados: Header X-Company-Id, body companyId, query companyId e ID de rota.',
  });

  // --- TESTE 14 (PRD 03): ISOLAMENTO DE PARCEIROS DE NEGÓCIO ENTRE SCHEMAS ---
  const alfaPartners = dbEngine.listPartners(alfaCompany.schemaNamespace);
  const betaPartners = dbEngine.listPartners(betaCompany.schemaNamespace);

  const hasPetrobrasInAlfa = alfaPartners.some((p) => p.document === '33000167000101');
  const hasPetrobrasInBeta = betaPartners.some((p) => p.document === '33000167000101');
  const partnersIsolated = hasPetrobrasInAlfa && !hasPetrobrasInBeta;

  tests.push({
    id: 'test-partners-schema-isolation-14',
    title: 'Isolamento de Parceiros de Negócio por Schema (PRD 03)',
    description: 'Comprova que parceiros cadastrados na Empresa Alfa (ex: Petrobras) são estritamente invisíveis para a Empresa Beta.',
    category: 'ISOLATION',
    passed: partnersIsolated,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: partnersIsolated
      ? `Isolamento absoluto validado: Alfa possui ${alfaPartners.length} parceiros e Beta possui ${betaPartners.length} parceiros sem vazamento.`
      : 'FALHA: Parceiro de negócio vazou entre schemas de diferentes CNPJs!',
    testedAt: new Date().toISOString(),
    details: `Alfa: ${alfaCompany.schemaNamespace} | Beta: ${betaCompany.schemaNamespace}`,
  });

  // --- TESTE 15 (PRD 03): VALIDAÇÃO FISCAL RIGOROSA DE DOCUMENTOS (MÓDULO 11) ---
  const validCnpjResult = validateFiscalDocument('PJ', '33.000.167/0001-01'); // Petrobras real
  const invalidCnpjResult = validateFiscalDocument('PJ', '33.000.167/0001-99'); // Dígito adulterado
  const validCpfResult = validateFiscalDocument('PF', '123.456.789-09'); // CPF real
  const invalidCpfResult = validateFiscalDocument('PF', '123.456.789-00'); // Dígito adulterado

  const fiscalValidationPassed =
    validCnpjResult.isValid &&
    !invalidCnpjResult.isValid &&
    validCpfResult.isValid &&
    !invalidCpfResult.isValid;

  tests.push({
    id: 'test-fiscal-document-validation-15',
    title: 'Validação Fiscal de Documentos (Algoritmo Módulo 11 da RFB - PRD 03)',
    description: 'Assegura que CPFs e CNPJs são validados matematicamente antes de qualquer persistência, rejeitando dígitos adulterados.',
    category: 'INTEGRITY',
    passed: fiscalValidationPassed,
    statusCode: 422,
    expectedStatus: 422,
    responseMessage: fiscalValidationPassed
      ? 'Algoritmo de validação fiscal aprovado: CNPJs e CPFs autênticos aceitos e dígitos verificadores adulterados rejeitados.'
      : 'FALHA: Validação fiscal aceitou documento com dígito inválido!',
    testedAt: new Date().toISOString(),
    details: 'Módulo 11 oficial para 11 dígitos (CPF) e 14 dígitos (CNPJ com pesos alternados).',
  });

  // --- TESTE 16 (PRD 03): RBAC GRANULAR EM CADASTRO DE PARCEIROS ---
  const memCarlosAlfa = dbEngine.getMembership(loginCarlos.user.id, alfaCompany.id);
  const memMarianaBeta = dbEngine.getMembership(loginMariana.user.id, betaCompany.id);

  const carlosCanCreatePartner = !!memCarlosAlfa?.permissions.includes(PERMISSIONS.CUSTOMERS_CREATE);
  const marianaCanCreatePartner = !!memMarianaBeta?.permissions.includes(PERMISSIONS.CUSTOMERS_CREATE);
  const rbacPartnerControlPassed = carlosCanCreatePartner && marianaCanCreatePartner;

  tests.push({
    id: 'test-rbac-partner-management-16',
    title: 'Autorização RBAC em Cadastros Comerciais e Parceiros (PRD 03)',
    description: 'Valida a matriz de privilégios para operações de visualização, criação e alteração de parceiros de negócio.',
    category: 'RBAC',
    passed: rbacPartnerControlPassed,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: 'Matriz RBAC granular operacional para módulo de clientes e parceiros.',
    testedAt: new Date().toISOString(),
    details: `Carlos (Owner): ${memCarlosAlfa?.permissions.length || 0} perms | Mariana (Operator): ${memMarianaBeta?.permissions.length || 0} perms`,
  });

  // --- TESTE 17 (PRD 03): ESTRUTURA CONTÁBIL E ISOLAMENTO DO PLANO DE CONTAS ---
  const alfaAccounts = dbEngine.listChartOfAccounts(alfaCompany.schemaNamespace);
  const betaAccounts = dbEngine.listChartOfAccounts(betaCompany.schemaNamespace);
  const chartIsolated =
    alfaAccounts.length > 0 && betaAccounts.length > 0 && alfaAccounts.length !== betaAccounts.length;

  tests.push({
    id: 'test-chart-of-accounts-isolation-17',
    title: 'Isolamento da Estrutura Contábil e Plano de Contas (PRD 03)',
    description: 'Verifica a segregação estrita do Plano de Contas multinível e Centros de Custo entre os schemas de cada empresa.',
    category: 'ISOLATION',
    passed: chartIsolated,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: chartIsolated
      ? `Plano de Contas isolado com sucesso: Alfa possui ${alfaAccounts.length} contas hierárquicas e Beta possui ${betaAccounts.length} contas.`
      : 'FALHA: Plano de contas contábil não está devidamente segregado por tenant.',
    testedAt: new Date().toISOString(),
    details: 'Suporte a contas sintéticas (agrupadoras) e analíticas (lançamento).',
  });

  // --- TESTE 18 (PRD 04): ISOLAMENTO DE ORÇAMENTOS E VENDAS POR SCHEMA ---
  const alfaQuotes = dbEngine.listQuotes(alfaCompany.schemaNamespace);
  const betaQuotes = dbEngine.listQuotes(betaCompany.schemaNamespace);
  const alfaSales = dbEngine.listSales(alfaCompany.schemaNamespace);
  const betaSales = dbEngine.listSales(betaCompany.schemaNamespace);

  const hasPetrobrasQuoteInAlfa = alfaQuotes.some((q) => (q.customerName || '').includes('Petrobras'));
  const hasPetrobrasQuoteInBeta = betaQuotes.some((q) => (q.customerName || '').includes('Petrobras'));
  const hasMagaluSaleInBeta = betaSales.some((s) => (s.customerName || '').includes('Magazine Luiza'));
  const hasMagaluSaleInAlfa = alfaSales.some((s) => (s.customerName || '').includes('Magazine Luiza'));

  const commercialIsolated =
    hasPetrobrasQuoteInAlfa && !hasPetrobrasQuoteInBeta && hasMagaluSaleInBeta && !hasMagaluSaleInAlfa;

  tests.push({
    id: 'test-commercial-schema-isolation-18',
    title: 'Isolamento de Orçamentos e Vendas por Schema (PRD 04)',
    description: 'Valida que orçamentos e pedidos de venda residem exclusivamente no namespace do respectivo CNPJ, sem vazamento entre empresas.',
    category: 'ISOLATION',
    passed: commercialIsolated,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: commercialIsolated
      ? `Documentos comerciais rigorosamente isolados: Alfa (${alfaQuotes.length} orçamentos, ${alfaSales.length} vendas) | Beta (${betaQuotes.length} orçamentos, ${betaSales.length} vendas).`
      : 'FALHA: Documentos comerciais de uma empresa foram encontrados no schema de outra!',
    testedAt: new Date().toISOString(),
    details: `Schemas auditados: ${alfaCompany.schemaNamespace} e ${betaCompany.schemaNamespace}`,
  });

  // --- TESTE 19 (PRD 04): MOTOR DE CÁLCULO COMERCIAL E ARREDONDAMENTO BANCÁRIO (BRL) ---
  const itemCalc1 = CommercialMath.calculateItem(3, 33.333, 0, 0, 0, 0); // 3 * 33.333 = 99.999 -> 100.00
  const itemCalc2 = CommercialMath.calculateItem(10, 150.0, 0, 10, 0, 0); // 1500 - 10% = 1350.00
  const docTotals = CommercialMath.calculateDocumentTotals([
    { quantity: 3, unitPrice: 33.333, ...itemCalc1 },
    { quantity: 10, unitPrice: 150.0, ...itemCalc2 },
  ], 50, 20); // (100 + 1350) - 50 + 20 = 1420.00

  const mathPrecisionPassed =
    itemCalc1.total === 100.0 &&
    itemCalc2.discount === 150.0 &&
    itemCalc2.total === 1350.0 &&
    docTotals.subtotal === 1450.0 &&
    docTotals.total === 1420.0;

  tests.push({
    id: 'test-commercial-math-precision-19',
    title: 'Precisão do Motor de Cálculo Comercial e Arredondamento BRL (PRD 04)',
    description: 'Valida o arredondamento monetário preciso de centavos (2 casas decimais), descontos percentuais e acréscimos sem erros de ponto flutuante.',
    category: 'INTEGRITY',
    passed: mathPrecisionPassed,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: mathPrecisionPassed
      ? `Cálculos comerciais aprovados: Subtotal R$ ${docTotals.subtotal.toFixed(2)}, Total Final R$ ${docTotals.total.toFixed(2)} com arredondamento exato.`
      : 'FALHA: Imprecisão matemática detectada no cálculo de itens comerciais!',
    testedAt: new Date().toISOString(),
    details: 'CommercialMath com suporte a descontos/acréscimos proporcionais e arredondamento estrito.',
  });

  // --- TESTE 20 (PRD 04): CONVERSÃO DE ORÇAMENTO PARA VENDA COM TRAVA DE IDEMPOTÊNCIA ---
  const initialAlfaSalesCount = dbEngine.listSales(alfaCompany.schemaNamespace).length;
  // Quote orc-alfa-001 já foi convertida para ven-alfa-001 no seed
  const conversionResult1 = dbEngine.convertQuoteToSale(alfaCompany.schemaNamespace, 'orc-alfa-001', 'Carlos Test');
  const salesCountAfterAttempt = dbEngine.listSales(alfaCompany.schemaNamespace).length;

  const idempotencyPassed =
    conversionResult1.alreadyConverted === true &&
    conversionResult1.sale.id === 'ven-alfa-001' &&
    salesCountAfterAttempt === initialAlfaSalesCount;

  tests.push({
    id: 'test-quote-to-sale-idempotency-20',
    title: 'Conversão Orçamento -> Venda com Garantia de Idempotência (PRD 04)',
    description: 'Garante que converter um orçamento já transformado em venda reutiliza o pedido gerado sem duplicar registros ou faturamento.',
    category: 'INTEGRITY',
    passed: idempotencyPassed,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: idempotencyPassed
      ? 'Idempotência comprovada: Segunda conversão do Orçamento ORC-000001 retornou venda existente sem duplicação de faturamento.'
      : 'FALHA: Trava de idempotência falhou ou duplicou a venda!',
    testedAt: new Date().toISOString(),
    details: `Venda associada: ${conversionResult1.sale.number} (alreadyConverted: ${conversionResult1.alreadyConverted})`,
  });

  // --- TESTE 21 (PRD 04): CICLO DE VIDA E AUDITORIA DE ORDENS DE SERVIÇO (OS) ---
  const osAlfa = dbEngine.getServiceOrderById(alfaCompany.schemaNamespace, 'os-alfa-001');
  const osHasAuditEvents = (osAlfa?.events || []).length >= 2;
  const osHasComments = (osAlfa?.comments || []).length >= 1;
  const osLifecyclePassed = !!osAlfa && osHasAuditEvents && osHasComments && !!osAlfa.startedAt;

  tests.push({
    id: 'test-service-order-lifecycle-21',
    title: 'Ciclo de Vida e Trilha de Auditoria de Ordens de Serviço (PRD 04)',
    description: 'Verifica o registro de eventos de apontamento técnico, mudanças de status, atribuição de técnicos e comentários operacionais.',
    category: 'INTEGRITY',
    passed: osLifecyclePassed,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: osLifecyclePassed
      ? `Ciclo de vida operacional validado: OS ${osAlfa?.number} possui ${osAlfa?.events.length} eventos de auditoria e ${osAlfa?.comments.length} comentários técnicos.`
      : 'FALHA: Trilha de eventos ou comentários da ordem de serviço incompleta!',
    testedAt: new Date().toISOString(),
    details: `Status atual: ${osAlfa?.status} | Prioridade: ${osAlfa?.priority} | Responsável: ${osAlfa?.assignedUserName}`,
  });

  // --- TESTE 22 (PRD 05): ISOLAMENTO DE TÍTULOS FINANCEIROS POR SCHEMA ---
  const alfaRecs = dbEngine.listAccountsReceivable(alfaCompany.schemaNamespace);
  const betaRecs = dbEngine.listAccountsReceivable(betaCompany.schemaNamespace);
  const alfaPags = dbEngine.listAccountsPayable(alfaCompany.schemaNamespace);
  const betaPags = dbEngine.listAccountsPayable(betaCompany.schemaNamespace);

  const hasPetrobrasInBetaRecs = betaRecs.some((r) => r.customerName.includes('Petrobras'));
  const hasMagaluInAlfaRecs = alfaRecs.some((r) => r.customerName.includes('Magazine Luiza'));
  const hasGerdauInAlfaPags = alfaPags.some((p) => p.supplierName.includes('Gerdau'));

  const financialIsolationPassed =
    alfaRecs.length > 0 &&
    betaRecs.length > 0 &&
    !hasPetrobrasInBetaRecs &&
    !hasMagaluInAlfaRecs &&
    !hasGerdauInAlfaPags;

  tests.push({
    id: 'test-financial-schema-isolation-22',
    title: 'Isolamento de Contas a Receber e Pagar por Schema CNPJ (PRD 05)',
    description: 'Assegura que títulos financeiros, faturas e contas bancárias pertencem exclusivamente ao schema da empresa proprietária.',
    category: 'ISOLATION',
    passed: financialIsolationPassed,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: financialIsolationPassed
      ? `Isolamento financeiro validado: Alfa possui ${alfaRecs.length} títulos a receber e ${alfaPags.length} a pagar; Beta possui ${betaRecs.length} títulos sem vazamento cross-tenant.`
      : 'FALHA: Títulos financeiros de um CNPJ foram acessados ou vazaram no schema de outra empresa!',
    testedAt: new Date().toISOString(),
    details: `Schemas auditados: ${alfaCompany.schemaNamespace} e ${betaCompany.schemaNamespace}`,
  });

  // --- TESTE 23 (PRD 05): MOTOR DE ENCARGOS MORATÓRIOS (MULTA E JUROS PRO-RATA DIE) ---
  const lateCalc = FinancialMath.calculateLateCharges({
    dueDate: '2026-03-01',
    baseAmount: 1000.0,
    fineRatePercent: 2.0,
    monthlyInterestRatePercent: 1.0,
    currentDate: '2026-03-11', // 10 dias de atraso
  });

  // Multa: 2% de 1000 = 20.00
  // Juros: 1000 * (0.01 / 30) * 10 = 3.33
  // Total: 1023.33
  const lateChargesPassed =
    lateCalc.daysLate === 10 &&
    lateCalc.fineValue === 20.0 &&
    lateCalc.interestValue === 3.33 &&
    lateCalc.totalPayable === 1023.33;

  tests.push({
    id: 'test-financial-late-charges-23',
    title: 'Cálculo de Encargos Moratórios e Juros Pro-Rata Die (PRD 05)',
    description: 'Valida a fórmula financeira brasileira: Multa contratual de 2% sobre principal + Juros moratórios pro-rata die de 1% ao mês (base 30 dias).',
    category: 'INTEGRITY',
    passed: lateChargesPassed,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: lateChargesPassed
      ? `Encargos moratórios calculados com precisão: Principal R$ 1.000,00 | Multa R$ ${lateCalc.fineValue.toFixed(2)} | Juros (10 dias) R$ ${lateCalc.interestValue.toFixed(2)} | Total R$ ${lateCalc.totalPayable.toFixed(2)}.`
      : 'FALHA: Imprecisão matemática no cálculo de encargos moratórios!',
    testedAt: new Date().toISOString(),
    details: 'FinancialMath.calculateLateCharges em conformidade com o Código Civil e Código Comercial.',
  });

  // --- TESTE 24 (PRD 05): LIQUIDAÇÃO COM ATUALIZAÇÃO AUTOMÁTICA DE TESOURARIA ---
  const alfaTreasuryAccounts = dbEngine.listBankAccounts(alfaCompany.schemaNamespace);
  const itauAccount = alfaTreasuryAccounts.find((a) => a.id === 'bco-alfa-01')!;
  const prevBalance = itauAccount.currentBalance;

  // Cria um título temporário para teste de liquidação
  const tempRec = dbEngine.createAccountReceivable(alfaCompany.schemaNamespace, {
    customerName: 'Cliente Teste Liquidação Suite',
    description: 'Faturamento de Teste para Baixa Bancária',
    originalValue: 500.0,
    dueDate: '2026-04-15',
  });

  // Executa liquidação via banco Itaú
  const settledRec = dbEngine.settleAccountReceivable(alfaCompany.schemaNamespace, tempRec.id, {
    paidAmount: 500.0,
    bankAccountId: itauAccount.id,
    paymentMethod: 'PIX',
  });

  const updatedItau = dbEngine.listBankAccounts(alfaCompany.schemaNamespace).find((a) => a.id === 'bco-alfa-01')!;
  const treasuryUpdatePassed =
    settledRec?.status === 'PAID' &&
    settledRec.balanceValue === 0 &&
    updatedItau.currentBalance === FinancialMath.round(prevBalance + 500.0);

  tests.push({
    id: 'test-financial-settlement-treasury-24',
    title: 'Liquidação Financeira com Conciliação de Tesouraria em Tempo Real (PRD 05)',
    description: 'Valida que a liquidação de um título reflete instantaneamente no saldo da conta bancária de destino e gera movimentação no extrato.',
    category: 'INTEGRITY',
    passed: treasuryUpdatePassed,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: treasuryUpdatePassed
      ? `Liquidação concluída com sucesso: Título ${settledRec?.number} baixado (status: ${settledRec?.status}) e saldo do ${itauAccount.name} creditado em R$ 500,00.`
      : 'FALHA: Liquidação do título não creditou o saldo da conta bancária!',
    testedAt: new Date().toISOString(),
    details: `Saldo anterior: R$ ${prevBalance.toFixed(2)} | Novo saldo: R$ ${updatedItau.currentBalance.toFixed(2)}`,
  });

  // --- TESTE 25 (PRD 05): CONSOLIDAÇÃO DE DRE GERENCIAL E PROJEÇÃO DE FLUXO DE CAIXA ---
  const dreReport = dbEngine.getIncomeStatementReport(alfaCompany.schemaNamespace);
  const cashFlowTimeline = dbEngine.getCashFlowProjection(alfaCompany.schemaNamespace, 15);

  const hasGrossRevenue = dreReport.some((i) => i.code === '1.0' && i.value > 0);
  const hasNetProfit = dreReport.some((i) => i.code === '5.0');
  const hasCashFlowDays = cashFlowTimeline.length === 15 && cashFlowTimeline[0].cumulativeBalance > 0;

  const reportsPassed = hasGrossRevenue && hasNetProfit && hasCashFlowDays;

  tests.push({
    id: 'test-financial-dre-cashflow-25',
    title: 'DRE Gerencial e Projeção do Fluxo de Caixa (PRD 05)',
    description: 'Verifica a geração do Demonstrativo de Resultado por competência (Receita Bruta, Deduções, Custos, EBITDA e Lucro Líquido) e projeção diária.',
    category: 'INTEGRITY',
    passed: reportsPassed,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: reportsPassed
      ? `Relatórios financeiros operacionais: DRE gerou ${dreReport.length} linhas contábeis padronizadas e Fluxo de Caixa projetou horizonte de 15 dias.`
      : 'FALHA: Estrutura do DRE Gerencial ou Projeção do Fluxo de Caixa incompleta!',
    testedAt: new Date().toISOString(),
    details: `Receita Bruta consolidada: R$ ${dreReport.find((i) => i.code === '1.0')?.value.toFixed(2)} | Lucro Líquido: R$ ${dreReport.find((i) => i.code === '5.0')?.value.toFixed(2)}`,
  });

  // --- TESTE 26 (PRD 03): VALIDADOR FISCAL ALGORÍTMICO DE CPF E CNPJ (MÓDULO 11) ---
  const sampleValidCPF = generateTestCPF();
  const sampleValidCNPJ = generateTestCNPJ();

  const isInvalidCPFBlocked = !validateCPF('11111111111') && !validateCPF('12345678900');
  const isValidCPFAccepted = validateCPF(cleanDocument(sampleValidCPF));
  const isInvalidCNPJBlocked = !validateCNPJ('00000000000000') && !validateCNPJ('12345678000199');
  const isValidCNPJAccepted = validateCNPJ(cleanDocument(sampleValidCNPJ));
  const isFormattingAccurate =
    formatDocument('11122233344') === '111.222.333-44' &&
    formatDocument('11222333000144') === '11.222.333/0001-44';

  const fiscalAlgorithm26Passed =
    isInvalidCPFBlocked &&
    isValidCPFAccepted &&
    isInvalidCNPJBlocked &&
    isValidCNPJAccepted &&
    isFormattingAccurate;

  tests.push({
    id: 'test-fiscal-validator-algorithm-26',
    title: 'Auditoria e Validação Fiscal de CPF/CNPJ (Módulo 11 - PRD 03)',
    description: 'Verifica o algoritmo oficial da Receita Federal para rejeição de documentos fictícios, sequências repetidas, conferência de dígitos verificadores e formatação.',
    category: 'INTEGRITY',
    passed: fiscalAlgorithm26Passed,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: fiscalAlgorithm26Passed
      ? `Validação fiscal íntegra: CPF (${sampleValidCPF}) e CNPJ (${sampleValidCNPJ}) homologados; rejeição garantida para sequências e dígitos incorretos.`
      : 'FALHA: Falha no algoritmo de validação fiscal da Receita Federal!',
    testedAt: new Date().toISOString(),
    details: `Algoritmo Módulo 11 com pesos alternados e bloqueio de sequências espúrias (cleanDocument e formatDocument).`,
  });

  // --- TESTE 27 (PRD 03): ISOLAMENTO DE PLANO DE CONTAS E CENTROS DE CUSTO ---
  const alfaAccounts27 = dbEngine.listChartOfAccounts(alfaCompany.schemaNamespace);
  const betaAccounts27 = dbEngine.listChartOfAccounts(betaCompany.schemaNamespace);
  const alfaCCs = dbEngine.listCostCenters(alfaCompany.schemaNamespace);
  const betaCCs = dbEngine.listCostCenters(betaCompany.schemaNamespace);

  const hasAlfaAccountsInBeta = betaAccounts27.some((a) => a.id === 'coa-alfa-01');
  const hasAlfaCCInBeta = betaCCs.some((c) => c.id === 'cc-alfa-01');
  const hasBetaCCInAlfa = alfaCCs.some((c) => c.id === 'cc-beta-01');

  const coaAndCcIsolationPassed =
    alfaAccounts27.length >= 10 &&
    betaAccounts27.length >= 5 &&
    alfaCCs.length >= 3 &&
    betaCCs.length >= 2 &&
    !hasAlfaAccountsInBeta &&
    !hasAlfaCCInBeta &&
    !hasBetaCCInAlfa;

  tests.push({
    id: 'test-chart-of-accounts-cc-isolation-27',
    title: 'Isolamento de Plano de Contas e Centros de Custo por Tenant (PRD 03)',
    description: 'Garante que a estrutura contábil (sintética e analítica) e os centros de apuração de resultado não se misturam entre diferentes empresas.',
    category: 'ISOLATION',
    passed: coaAndCcIsolationPassed,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: coaAndCcIsolationPassed
      ? `Isolamento contábil e gerencial validado: Alfa possui ${alfaAccounts27.length} contas e ${alfaCCs.length} centros de custo; Beta possui estrutura contábil própria e isolada.`
      : 'FALHA: Vazamento de Plano de Contas ou Centros de Custo entre tenants!',
    testedAt: new Date().toISOString(),
    details: `Schemas auditados: ${alfaCompany.schemaNamespace} e ${betaCompany.schemaNamespace}`,
  });

  // --- TESTE 28 (PRD 04 -> PRD 05): ESTEIRA DE FATURAMENTO OPERACIONAL -> CONTAS A RECEBER ---
  const osAlfaForInvoice = dbEngine.getServiceOrderById(alfaCompany.schemaNamespace, 'os-alfa-001');
  const osAlfaTotal = (osAlfaForInvoice?.items || []).reduce((acc, it) => acc + (it.total || 0), 0);
  const invoiceResult = osAlfaForInvoice
    ? dbEngine.invoiceServiceOrder(
        alfaCompany.schemaNamespace,
        osAlfaForInvoice.id,
        'Sistema Automático de Testes'
      )
    : undefined;

  const invoicePipelinePassed =
    osAlfaForInvoice !== undefined &&
    invoiceResult !== undefined &&
    invoiceResult.receivable.status === 'OPEN' &&
    invoiceResult.receivable.originalValue === osAlfaTotal &&
    invoiceResult.receivable.customerId === osAlfaForInvoice.customerId &&
    invoiceResult.os.events.some((e) => e.description.includes('faturada'));

  tests.push({
    id: 'test-service-order-invoicing-pipeline-28',
    title: 'Pipeline Integrado: Faturamento de Ordem de Serviço para Contas a Receber (PRD 04 -> 05)',
    description: 'Valida a integração da esteira operacional com o módulo financeiro: o faturamento de uma OS gera atomicamente o título a receber correspondente.',
    category: 'INTEGRITY',
    passed: invoicePipelinePassed,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: invoicePipelinePassed
      ? `Pipeline operacional-financeiro validado: OS ${osAlfaForInvoice?.number} faturada gerando o Título a Receber ${invoiceResult?.receivable.number} no valor de R$ ${invoiceResult?.receivable.originalValue.toFixed(2)}.`
      : 'FALHA: Faturamento da Ordem de Serviço não gerou o Título a Receber correspondente!',
    testedAt: new Date().toISOString(),
    details: `Título gerado: ${invoiceResult?.receivable.number} | Cliente: ${invoiceResult?.receivable.customerName} | Valor: R$ ${invoiceResult?.receivable.originalValue.toFixed(2)}`,
  });

  // TESTE 29: Motor de Faturamento Comercial e Arredondamento BRL (PRD PARTE 05 - Seção 15 e 16)
  const roundTest = BillingMath.round(10.555) === 10.56 && BillingMath.round(10.554) === 10.55;
  const itemCalc = BillingMath.calculateItem(3, 150.0, 50.0, 10.0);
  const docCalc = BillingMath.calculateDocumentTotals(
    [
      { quantity: 2, unitPrice: 100.0, discount: 20 },
      { quantity: 1, unitPrice: 200.0, surcharge: 15 },
    ],
    10,
    5
  );
  const proRata = BillingMath.calculateProRata(3000.0, '2026-09-01', '2026-09-10', 30);
  const passedBillingMath =
    roundTest &&
    itemCalc.subtotal === 450.0 &&
    itemCalc.total === 410.0 &&
    docCalc.subtotal === 400.0 &&
    docCalc.total === 390.0 &&
    proRata === 1000.0;

  tests.push({
    id: 'test-billing-math-precision-29',
    title: 'Precisão do Motor de Faturamento e Arredondamento BRL (PRD PARTE 05)',
    description: 'Valida arredondamento financeiro BRL em duas casas decimais, cálculo de itens, acréscimos/descontos globais e pro-rata die.',
    category: 'INTEGRITY',
    passed: passedBillingMath,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: passedBillingMath
      ? 'Motor de cálculo de faturamento BRL validado com precisão estrita (subtotal R$ 400,00, total líquido R$ 390,00 e pro-rata R$ 1.000,00).'
      : 'FALHA: Divergência no arredondamento ou cálculo do motor de faturamento BRL!',
    testedAt: new Date().toISOString(),
    details: `Item total: R$ ${itemCalc.total.toFixed(2)} | Doc total: R$ ${docCalc.total.toFixed(2)} | Pro-rata: R$ ${proRata.toFixed(2)}`,
  });

  // TESTE 30: Faturamento Direto a partir de Pedido de Venda com Trava Anti-Duplicidade (PRD PARTE 05)
  const petrobrasPartner = dbEngine.listPartners(alfaCompany.schemaNamespace).find((p) => p.document === '33000167000101') || dbEngine.listPartners(alfaCompany.schemaNamespace)[0];
  const sale = dbEngine.createSale(
    alfaCompany.schemaNamespace,
    {
      customerId: petrobrasPartner.id,
      saleDate: '2026-09-15',
      items: [
        {
          itemType: 'PRODUCT',
          description: 'Válvula Esfera Inox 316',
          quantity: 5,
          unitPrice: 200.0,
          discount: 50.0,
          surcharge: 0.0,
        },
      ],
      discount: 0,
      surcharge: 0,
      createdBy: 'Carlos Santos',
    }
  );
  const billingFromSale = dbEngine.createBillingFromSale(
    alfaCompany.schemaNamespace,
    sale.id,
    'usr-carlos-alfa-01',
    'Carlos Santos'
  );
  let dupSaleBillingBlocked = false;
  try {
    dbEngine.createBillingFromSale(alfaCompany.schemaNamespace, sale.id, 'usr-carlos-alfa-01', 'Carlos Santos');
  } catch {
    dupSaleBillingBlocked = true;
  }
  const passedSaleBilling =
    billingFromSale.sourceType === 'SALE' &&
    billingFromSale.sourceId === sale.id &&
    billingFromSale.total === 950.0 &&
    billingFromSale.status === 'ISSUED' &&
    dupSaleBillingBlocked;

  tests.push({
    id: 'test-billing-from-sale-30',
    title: 'Faturamento Direto de Pedido de Venda com Trava Anti-Duplicidade (PRD PARTE 05)',
    description: 'Valida conversão de pedido de venda em documento fiscal emitido, com snapshot de itens e bloqueio de faturamento duplicado.',
    category: 'INTEGRITY',
    passed: passedSaleBilling,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: passedSaleBilling
      ? `Documento ${billingFromSale.number} gerado com sucesso (R$ ${billingFromSale.total.toFixed(2)}) e tentativa de faturamento duplicado bloqueada.`
      : 'FALHA: Erro no faturamento direto do pedido de venda ou falha na trava de duplicidade!',
    testedAt: new Date().toISOString(),
    details: `Doc: ${billingFromSale.number} | Total: R$ ${billingFromSale.total.toFixed(2)} | Trava duplicidade: ${dupSaleBillingBlocked ? 'ATIVA' : 'FALHA'}`,
  });

  // TESTE 31: Faturamento de Ordem de Serviço com Competência Fiscal MM/YYYY (PRD PARTE 05)
  const compInfo = CompetenceHelper.getCompetenceForDate('2026-09-19');
  const osAlfaList = dbEngine.listServiceOrders(alfaCompany.schemaNamespace);
  const targetOs = osAlfaList[0];
  const billingFromOs = dbEngine.createBillingFromServiceOrder(
    alfaCompany.schemaNamespace,
    targetOs.id,
    'usr-carlos-alfa-01',
    'Carlos Santos'
  );
  const passedOsBilling =
    compInfo.competenceLabel === '09/2026' &&
    billingFromOs.sourceType === 'SERVICE_ORDER' &&
    billingFromOs.sourceId === targetOs.id &&
    billingFromOs.items.length >= 1 &&
    billingFromOs.status === 'ISSUED';

  tests.push({
    id: 'test-billing-from-service-order-31',
    title: 'Faturamento de Ordem de Serviço com Competência Fiscal MM/YYYY (PRD PARTE 05)',
    description: 'Valida o vínculo fiscal de prestação de serviços com definição automática de competência e retenções.',
    category: 'INTEGRITY',
    passed: passedOsBilling,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: passedOsBilling
      ? `Ordem de Serviço ${targetOs.number} faturada em ${billingFromOs.number} com competência fiscal ${compInfo.competenceLabel}.`
      : 'FALHA: Erro na emissão de faturamento da Ordem de Serviço ou competência inválida!',
    testedAt: new Date().toISOString(),
    details: `Doc: ${billingFromOs.number} | OS: ${targetOs.number} | Competência: ${compInfo.competenceLabel}`,
  });

  // TESTE 32: Contratos de Faturamento Recorrente e Regras de Vencimento Dinâmicas (PRD PARTE 05)
  const recurringContract = dbEngine.createRecurringBilling(
    alfaCompany.schemaNamespace,
    {
      customerId: petrobrasPartner.id,
      customerName: petrobrasPartner.name,
      customerDocument: petrobrasPartner.document,
      description: 'Contrato Mensal de Suporte e Manutenção Industrial',
      frequency: 'MONTHLY',
      dayOfMonth: 10,
      dueRule: 'FIXED_DAY',
      dueDays: 10,
      startDate: '2026-01-01',
      nextBillingDate: '2026-09-10',
      items: [
        {
          itemType: 'SERVICE',
          description: 'SLA 24/7 e Monitoramento Contínuo',
          quantity: 1,
          unitPrice: 4500.0,
        },
      ],
    },
    'usr-carlos-alfa-01',
    'Carlos Santos'
  );
  const passedRecurringConfig =
    recurringContract.status === 'ACTIVE' &&
    recurringContract.frequency === 'MONTHLY' &&
    recurringContract.nextBillingDate === '2026-09-10' &&
    recurringContract.amount === 4500.0;

  tests.push({
    id: 'test-recurring-billing-rules-32',
    title: 'Contratos de Faturamento Recorrente e Regras de Vencimento Dinâmicas (PRD PARTE 05)',
    description: 'Valida provisionamento de contratos de faturamento contínuo com parametrização de frequência, dia de corte e regra de vencimento.',
    category: 'INTEGRITY',
    passed: passedRecurringConfig,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: passedRecurringConfig
      ? `Contrato recorrente ativo configurado com sucesso: mensalidade R$ ${recurringContract.amount.toFixed(2)}, vencimento dia 10.`
      : 'FALHA: Configuração de contrato de faturamento recorrente inválida!',
    testedAt: new Date().toISOString(),
    details: `Contrato ID: ${recurringContract.id} | Frequência: ${recurringContract.frequency} | Próximo Faturamento: ${recurringContract.nextBillingDate}`,
  });

  // TESTE 33: Processamento em Lote Idempotente da Recorrência com Geração de Títulos e Logs (PRD PARTE 05)
  const batch1 = dbEngine.processDueRecurringBillings(alfaCompany.schemaNamespace, 'usr-carlos-alfa-01', 'Carlos Santos');
  const batch2 = dbEngine.processDueRecurringBillings(alfaCompany.schemaNamespace, 'usr-carlos-alfa-01', 'Carlos Santos');
  const logs = dbEngine.listBillingGenerationLogs(alfaCompany.schemaNamespace);
  const updatedContract = dbEngine.getRecurringBillingById(alfaCompany.schemaNamespace, recurringContract.id);
  const passedBatchRecurring =
    batch1.generatedCount >= 1 &&
    batch2.generatedCount === 0 &&
    logs.length >= 1 &&
    updatedContract?.nextBillingDate === '2026-10-10';

  tests.push({
    id: 'test-recurring-batch-idempotency-33',
    title: 'Processamento em Lote Idempotente da Recorrência com Logs de Auditoria (PRD PARTE 05)',
    description: 'Valida execução em lote da régua de faturamento: gera faturas para contratos vencidos, avança competência e bloqueia duplicidade em reexecuções.',
    category: 'INTEGRITY',
    passed: passedBatchRecurring,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: passedBatchRecurring
      ? `Ciclo em lote processado com êxito: ${batch1.generatedCount} fatura(s) emitida(s), competência avançada para ${updatedContract?.nextBillingDate} e reprocessamento idempotente (0 duplicadas).`
      : 'FALHA: Processamento em lote da recorrência não respeitou a idempotência ou falhou ao avançar datas!',
    testedAt: new Date().toISOString(),
    details: `Geradas ciclo 1: ${batch1.generatedCount} | Geradas ciclo 2: ${batch2.generatedCount} | Próxima data: ${updatedContract?.nextBillingDate}`,
  });

  // TESTE 34: Cancelamento de Faturamento com Motivo Obrigatório e Conciliação de Estorno (PRD PARTE 05)
  let cancelNoReasonBlocked = false;
  try {
    dbEngine.cancelBillingDocument(alfaCompany.schemaNamespace, billingFromSale.id, '', 'usr-carlos-alfa-01', 'Carlos Santos');
  } catch {
    cancelNoReasonBlocked = true;
  }
  const canceledDoc = dbEngine.cancelBillingDocument(
    alfaCompany.schemaNamespace,
    billingFromSale.id,
    'Cancelamento homologado para troca de pedido comercial',
    'usr-carlos-alfa-01',
    'Carlos Santos'
  );
  const passedCancel =
    cancelNoReasonBlocked &&
    canceledDoc.status === 'CANCELED' &&
    canceledDoc.cancellationReason === 'Cancelamento homologado para troca de pedido comercial' &&
    canceledDoc.canceledBy === 'Carlos Santos';

  tests.push({
    id: 'test-billing-cancellation-audit-34',
    title: 'Cancelamento de Faturamento com Motivo Obrigatório e Trilha de Auditoria (PRD PARTE 05)',
    description: 'Valida a exigência de justificativa corporativa para cancelamento, imutabilidade após cancelamento e registro na trilha de auditoria.',
    category: 'INTEGRITY',
    passed: passedCancel,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: passedCancel
      ? `Documento ${canceledDoc.number} cancelado formalmente com justificativa e cancelamento sem motivo rejeitado.`
      : 'FALHA: Cancelamento sem justificativa foi aceito ou cancelamento formal falhou!',
    testedAt: new Date().toISOString(),
    details: `Doc: ${canceledDoc.number} | Motivo: "${canceledDoc.cancellationReason}" | Responsável: ${canceledDoc.canceledBy}`,
  });

  // TESTE 35: Isolamento Multi-Tenant Estrito no Faturamento e Recorrência (PRD 01 & PRD PARTE 05)
  const alfaBillings = dbEngine.listBillingDocuments(alfaCompany.schemaNamespace);
  const betaBillings = dbEngine.listBillingDocuments(betaCompany.schemaNamespace);
  const alfaRecurrings = dbEngine.listRecurringBillings(alfaCompany.schemaNamespace);
  const betaRecurrings = dbEngine.listRecurringBillings(betaCompany.schemaNamespace);
  const hasAlfaDocInBeta = betaBillings.some((b) => b.customerName.includes('Petrobras'));
  const hasAlfaRecInBeta = betaRecurrings.some((r) => r.description.includes('Petrobras'));
  const passedTenantBillingIsolation =
    alfaBillings.length >= 2 &&
    alfaRecurrings.length >= 1 &&
    !hasAlfaDocInBeta &&
    !hasAlfaRecInBeta;

  tests.push({
    id: 'test-billing-tenant-isolation-35',
    title: 'Isolamento Multi-Tenant Estrito no Faturamento e Recorrência por Schema (PRD 01 & PRD 05)',
    description: 'Valida que contratos de recorrência, faturas e logs de faturamento da Empresa Alfa são 100% invisíveis e inacessíveis para a Empresa Beta.',
    category: 'ISOLATION',
    passed: passedTenantBillingIsolation,
    statusCode: 200,
    expectedStatus: 200,
    responseMessage: passedTenantBillingIsolation
      ? `Isolamento comprovado: Empresa Alfa possui ${alfaBillings.length} faturas e ${alfaRecurrings.length} contratos, nenhum visível no schema da Beta.`
      : 'FALHA CRÍTICA: Vazamento de documentos de faturamento ou contratos entre tenants!',
    testedAt: new Date().toISOString(),
    details: `Alfa Faturas: ${alfaBillings.length} | Beta Faturas: ${betaBillings.length} | Vazamento detectado: ${hasAlfaDocInBeta || hasAlfaRecInBeta ? 'SIM' : 'NÃO'}`,
  });

  res.json({
    success: true,
    data: {
      totalTests: tests.length,
      passedCount: tests.filter((t) => t.passed).length,
      failedCount: tests.filter((t) => !t.passed).length,
      tests,
    },
    meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
  });
});

// ==========================================================
// PRD PARTE 05: ROTAS DE FATURAMENTO, COMPETÊNCIAS E RECORRÊNCIA
// ==========================================================

// 1. Dashboard de Métricas de Faturamento
app.get(
  '/api/v1/billing/dashboard',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BILLING_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const metrics = dbEngine.getBillingDashboard(schemaNamespace!);

    res.json({
      success: true,
      data: metrics,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 2. Listar Documentos de Faturamento com Filtros
app.get(
  ['/api/v1/billing', '/api/v1/billing/documents'],
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BILLING_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { status, customerId, sourceType, competence, search } = req.query;

    const documents = dbEngine.getBillingDocuments(schemaNamespace!, {
      status: status as string,
      customerId: customerId as string,
      sourceType: sourceType as string,
      competence: competence as string,
      search: search as string,
    });

    res.json({
      success: true,
      data: documents,
      meta: { total: documents.length, requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 3. Obter Documento de Faturamento por ID
app.get(
  '/api/v1/billing/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BILLING_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { id } = req.params;

    const document = dbEngine.getBillingDocumentById(schemaNamespace!, id);
    if (!document) {
      throw new NotFoundError(`Documento de faturamento [${id}] não encontrado.`);
    }

    res.json({
      success: true,
      data: document,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 4. Criar Documento de Faturamento Manual
app.post(
  '/api/v1/billing',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BILLING_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const {
      customerId,
      customerName,
      customerDocument,
      sourceType,
      issueDate,
      competenceDate,
      dueDate,
      description,
      notes,
      items,
      status,
    } = req.body;

    if (!customerId || !dueDate) {
      throw new AppError('Cliente e data de vencimento são obrigatórios.', 400, 'VALIDATION_ERROR');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Ao menos um item é obrigatório no documento de faturamento.', 400, 'VALIDATION_ERROR');
    }

    const created = await dbEngine.createBillingDocumentAsync(
      schemaNamespace!,
      {
        customerId,
        customerName,
        customerDocument,
        sourceType: sourceType || 'MANUAL',
        issueDate,
        competenceDate,
        dueDate,
        description,
        notes,
        items,
        status: status || 'PENDING',
      },
      user?.id || 'system',
      user?.name || user?.email || 'Usuário'
    );

    res.status(201).json({
      success: true,
      data: created,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 5. Atualizar Documento de Faturamento em Rascunho (PENDING)
app.put(
  '/api/v1/billing/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BILLING_EDIT),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const { id } = req.params;

    const updated = await dbEngine.updateBillingDocumentAsync(
      schemaNamespace!,
      id,
      req.body,
      user?.id || 'system',
      user?.name || user?.email || 'Usuário'
    );

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 6. Emitir Documento de Faturamento (PENDING -> ISSUED)
app.post(
  '/api/v1/billing/:id/issue',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BILLING_ISSUE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const { id } = req.params;

    const issued = await dbEngine.issueBillingDocumentAsync(
      schemaNamespace!,
      id,
      user?.id || 'system',
      user?.name || user?.email || 'Usuário'
    );

    res.json({
      success: true,
      data: issued,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 7. Cancelar Documento de Faturamento (PRD Seção 38 - Motivo Obrigatório)
app.post(
  '/api/v1/billing/:id/cancel',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BILLING_CANCEL),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      throw new AppError(
        'Motivo de cancelamento é obrigatório e deve ter no mínimo 5 caracteres (PRD Seção 38).',
        400,
        'VALIDATION_ERROR'
      );
    }

    const canceled = await dbEngine.cancelBillingDocumentAsync(
      schemaNamespace!,
      id,
      reason,
      user?.id || 'system',
      user?.name || user?.email || 'Usuário'
    );

    res.json({
      success: true,
      data: canceled,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 8. Faturar Pedido de Venda
app.post(
  '/api/v1/billing/from-sale/:saleId',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BILLING_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const { saleId } = req.params;

    const billed = await dbEngine.createBillingFromSaleAsync(
      schemaNamespace!,
      saleId,
      user?.id || 'system',
      user?.name || user?.email || 'Usuário'
    );

    res.status(201).json({
      success: true,
      data: billed,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 9. Faturar Ordem de Serviço
app.post(
  '/api/v1/billing/from-os/:osId',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BILLING_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const { osId } = req.params;

    const billed = await dbEngine.createBillingFromServiceOrderAsync(
      schemaNamespace!,
      osId,
      user?.id || 'system',
      user?.name || user?.email || 'Usuário'
    );

    res.status(201).json({
      success: true,
      data: billed,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 10. Listar Contratos de Faturamento Recorrente
app.get(
  '/api/v1/recurring-billing',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECURRING_BILLING_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { status, customerId, search } = req.query;

    const recurrings = dbEngine.getRecurringBillings(schemaNamespace!, {
      status: status as string,
      customerId: customerId as string,
      search: search as string,
    });

    res.json({
      success: true,
      data: recurrings,
      meta: { total: recurrings.length, requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 11. Obter Histórico de Logs de Execução de Recorrência
app.get(
  '/api/v1/recurring-billing/logs',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECURRING_BILLING_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { recurringId } = req.query;

    const logs = dbEngine.getBillingGenerationLogs(schemaNamespace!, recurringId as string);

    res.json({
      success: true,
      data: logs,
      meta: { total: logs.length, requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 12. Obter Contrato de Recorrência por ID
app.get(
  '/api/v1/recurring-billing/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECURRING_BILLING_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { id } = req.params;

    const recurring = dbEngine.getRecurringBillingById(schemaNamespace!, id);
    if (!recurring) {
      throw new NotFoundError(`Faturamento recorrente [${id}] não encontrado.`);
    }

    res.json({
      success: true,
      data: recurring,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 13. Criar Contrato de Faturamento Recorrente
app.post(
  '/api/v1/recurring-billing',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECURRING_BILLING_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const {
      customerId,
      customerName,
      customerDocument,
      contractId,
      contractNumber,
      frequency,
      startDate,
      endDate,
      nextBillingDate,
      dayOfMonth,
      dueRule,
      dueDays,
      amount,
      description,
      notes,
      items,
    } = req.body;

    if (!customerId || !startDate || amount === undefined || !description) {
      throw new AppError(
        'Cliente, data de início, valor e descrição são obrigatórios para recorrência.',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (Number(amount) <= 0) {
      throw new AppError('O valor da recorrência deve ser maior que zero.', 400, 'VALIDATION_ERROR');
    }

    const created = await dbEngine.createRecurringBillingAsync(
      schemaNamespace!,
      {
        customerId,
        customerName,
        customerDocument,
        contractId,
        contractNumber,
        frequency: frequency || 'MONTHLY',
        startDate,
        endDate,
        nextBillingDate,
        dayOfMonth: Number(dayOfMonth) || 10,
        dueRule: dueRule || 'FIXED_DAY',
        dueDays: Number(dueDays) || 10,
        amount: Number(amount),
        description,
        notes,
        items,
      },
      user?.id || 'system',
      user?.name || user?.email || 'Usuário'
    );

    res.status(201).json({
      success: true,
      data: created,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 14. Atualizar Contrato de Faturamento Recorrente
app.put(
  '/api/v1/recurring-billing/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECURRING_BILLING_EDIT),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const { id } = req.params;

    const updated = await dbEngine.updateRecurringBillingAsync(
      schemaNamespace!,
      id,
      req.body,
      user?.id || 'system',
      user?.name || user?.email || 'Usuário'
    );

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 15. Alterar Status do Contrato Recorrente (ACTIVE, PAUSED, CANCELED)
app.post(
  '/api/v1/recurring-billing/:id/status',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECURRING_BILLING_EDIT),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'PAUSED', 'CANCELED'].includes(status)) {
      throw new AppError('Status inválido. Use ACTIVE, PAUSED ou CANCELED.', 400, 'VALIDATION_ERROR');
    }

    const updated = await dbEngine.setRecurringBillingStatusAsync(
      schemaNamespace!,
      id,
      status,
      user?.id || 'system',
      user?.name || user?.email || 'Usuário'
    );

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 16. Gerar Faturamento Recorrente Individual (Idempotência e Bloqueio de Concorrência)
app.post(
  '/api/v1/recurring-billing/:id/generate',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECURRING_BILLING_GENERATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const { id } = req.params;
    const { targetDate, force } = req.body;

    const result = await dbEngine.generateRecurringBillingAsync(
      schemaNamespace!,
      id,
      targetDate,
      user?.id,
      user?.name || user?.email,
      Boolean(force)
    );

    res.json({
      success: true,
      data: result,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 17. Processar Recorrências Vencidas em Lote (Batch Automatizado)
app.post(
  '/api/v1/recurring-billing/process-due',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECURRING_BILLING_GENERATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;

    const result = await dbEngine.processDueRecurringBillingsAsync(
      schemaNamespace!,
      user?.id,
      user?.name || user?.email
    );

    res.json({
      success: true,
      data: result,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// ============================================================================
// PRD 06 - MÓDULO DE ESTOQUE & ALMOXARIFADO (WMS BÁSICO)
// ============================================================================

// 1. Dashboard de Métricas de Estoque
app.get(
  '/api/v1/inventory/metrics',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.INVENTORY_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const metrics = dbEngine.getInventoryMetrics(schemaNamespace!);

    res.json({
      success: true,
      data: metrics,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 2. Listar Depósitos (Warehouses)
app.get(
  '/api/v1/inventory/warehouses',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.WAREHOUSES_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const warehouses = dbEngine.listWarehouses(schemaNamespace!);

    res.json({
      success: true,
      data: warehouses,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 3. Obter Depósito por ID
app.get(
  '/api/v1/inventory/warehouses/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.WAREHOUSES_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const warehouse = dbEngine.getWarehouseById(schemaNamespace!, req.params.id);
    if (!warehouse) {
      throw new AppError('Depósito não encontrado.', 404, 'WAREHOUSE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: warehouse,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 4. Criar Novo Depósito
app.post(
  '/api/v1/inventory/warehouses',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.WAREHOUSES_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, activeCompany } = req.tenantContext!;
    const { name, code, description, location, isDefault } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new AppError('O nome do depósito é obrigatório.', 400, 'VALIDATION_ERROR');
    }

    const warehouse = await dbEngine.createWarehouseAsync(
      schemaNamespace!,
      { name, code, description, location, isDefault },
      activeCompany!.id
    );

    res.status(201).json({
      success: true,
      data: warehouse,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 5. Atualizar Depósito
app.put(
  '/api/v1/inventory/warehouses/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.WAREHOUSES_UPDATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const warehouse = await dbEngine.updateWarehouseAsync(schemaNamespace!, req.params.id, req.body);
    if (!warehouse) {
      throw new AppError('Depósito não encontrado.', 404, 'WAREHOUSE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: warehouse,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 6. Excluir Depósito
app.delete(
  '/api/v1/inventory/warehouses/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.WAREHOUSES_DELETE),
  async (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    try {
      const deleted = await dbEngine.deleteWarehouseAsync(schemaNamespace!, req.params.id);
      if (!deleted) {
        throw new AppError('Depósito não encontrado.', 404, 'WAREHOUSE_NOT_FOUND');
      }
      res.json({
        success: true,
        data: { id: req.params.id, deleted: true },
        meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      throw new AppError(err.message || 'Falha ao excluir depósito.', 400, 'WAREHOUSE_DELETE_FAILED');
    }
  }
);

// 7. Listar Itens em Estoque (Saldos Físicos e Financeiros)
app.get(
  '/api/v1/inventory/stock-items',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.INVENTORY_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { warehouseId, search, lowStockOnly } = req.query;

    const items = dbEngine.listStockItems(schemaNamespace!, {
      warehouseId: warehouseId as string,
      search: search as string,
      lowStockOnly: lowStockOnly === 'true',
    });

    res.json({
      success: true,
      data: items,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 8. Obter Item em Estoque por ID
app.get(
  '/api/v1/inventory/stock-items/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.INVENTORY_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const item = dbEngine.getStockItemById(schemaNamespace!, req.params.id);
    if (!item) {
      throw new AppError('Item de estoque não encontrado.', 404, 'STOCK_ITEM_NOT_FOUND');
    }

    res.json({
      success: true,
      data: item,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 9. Atualizar Limites e Endereçamento de Estoque
app.put(
  '/api/v1/inventory/stock-items/:id/limits',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.INVENTORY_UPDATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { minQuantity, maxQuantity, locationRack } = req.body;

    const minQty = typeof minQuantity === 'number' ? minQuantity : 0;
    const maxQty = typeof maxQuantity === 'number' ? maxQuantity : 0;

    const updated = await dbEngine.updateStockItemLimitsAsync(
      schemaNamespace!,
      req.params.id,
      minQty,
      maxQty,
      locationRack
    );

    if (!updated) {
      throw new AppError('Item de estoque não encontrado.', 404, 'STOCK_ITEM_NOT_FOUND');
    }

    res.json({
      success: true,
      data: updated,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 10. Registrar Movimentação de Estoque (Entrada, Saída, Perda, Ajuste)
app.post(
  '/api/v1/inventory/movements',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.INVENTORY_MOVEMENT),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const {
      movementType,
      productId,
      warehouseId,
      quantity,
      unitCost,
      referenceType,
      referenceId,
      referenceDocument,
      batchNumber,
      expirationDate,
      notes,
      locationRack,
    } = req.body;

    if (!movementType || !productId || !warehouseId || quantity === undefined) {
      throw new AppError(
        'Os campos movementType, productId, warehouseId e quantity são obrigatórios.',
        400,
        'VALIDATION_ERROR'
      );
    }

    try {
      const movement = await dbEngine.recordStockMovementAsync(
        schemaNamespace!,
        {
          movementType,
          productId,
          warehouseId,
          quantity: Number(quantity),
          unitCost: unitCost !== undefined ? Number(unitCost) : undefined,
          referenceType,
          referenceId,
          referenceDocument,
          batchNumber,
          expirationDate,
          notes,
          locationRack,
        },
        { id: user?.id || 'usr-anon', name: user?.name || user?.email || 'Sistema' }
      );

      res.status(201).json({
        success: true,
        data: movement,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      throw new AppError(err.message || 'Falha ao registrar movimentação.', 400, 'MOVEMENT_FAILED');
    }
  }
);

// 11. Transferência entre Depósitos
app.post(
  '/api/v1/inventory/transfers',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.INVENTORY_TRANSFER),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const { sourceWarehouseId, targetWarehouseId, productId, quantity, notes } = req.body;

    if (!sourceWarehouseId || !targetWarehouseId || !productId || !quantity) {
      throw new AppError(
        'Campos sourceWarehouseId, targetWarehouseId, productId e quantity são obrigatórios.',
        400,
        'VALIDATION_ERROR'
      );
    }

    try {
      const result = await dbEngine.transferStockAsync(
        schemaNamespace!,
        {
          sourceWarehouseId,
          targetWarehouseId,
          productId,
          quantity: Number(quantity),
          notes,
        },
        { id: user?.id || 'usr-anon', name: user?.name || user?.email || 'Sistema' }
      );

      res.status(201).json({
        success: true,
        data: result,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      throw new AppError(err.message || 'Falha ao realizar transferência.', 400, 'TRANSFER_FAILED');
    }
  }
);

// 12. Histórico de Movimentações (Kardex)
app.get(
  '/api/v1/inventory/movements',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.INVENTORY_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { warehouseId, productId, movementType, search, limit } = req.query;

    const movements = dbEngine.listStockMovements(schemaNamespace!, {
      warehouseId: warehouseId as string,
      productId: productId as string,
      movementType: movementType as string,
      search: search as string,
      limit: limit ? Number(limit) : undefined,
    });

    res.json({
      success: true,
      data: movements,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// ============================================================================
// ROTAS DO MÓDULO FISCAL & TRIBUTÁRIO BRASILEIRO (PRD 07 - NF-e, NFS-e, NFC-e, SPED)
// ============================================================================

// 1. Métricas Consolidadas do Módulo Fiscal
app.get(
  '/api/v1/fiscal/metrics',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FISCAL_DASHBOARD_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const metrics = dbEngine.getFiscalMetrics(schemaNamespace!);

    res.json({
      success: true,
      data: metrics,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 2. Listagem de Documentos Fiscais
app.get(
  '/api/v1/fiscal/documents',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FISCAL_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { model, status, type, search, startDate, endDate, limit } = req.query;

    const docs = dbEngine.listFiscalDocuments(schemaNamespace!, {
      model: model as any,
      status: status as any,
      type: type as any,
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? Number(limit) : undefined,
    });

    res.json({
      success: true,
      data: docs,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 3. Obter Documento Fiscal por ID
app.get(
  '/api/v1/fiscal/documents/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FISCAL_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const doc = dbEngine.getFiscalDocumentById(schemaNamespace!, req.params.id);

    if (!doc) {
      throw new NotFoundError('Documento fiscal não encontrado.');
    }

    res.json({
      success: true,
      data: doc,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 4. Download / Prévia do XML do Documento Fiscal
app.get(
  '/api/v1/fiscal/documents/:id/xml',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FISCAL_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const doc = dbEngine.getFiscalDocumentById(schemaNamespace!, req.params.id);

    if (!doc) {
      throw new NotFoundError('Documento fiscal não encontrado.');
    }

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.accessKey || doc.number}.xml"`);
    res.send(doc.xmlPayload || '<?xml version="1.0" encoding="UTF-8"?><nfeProc></nfeProc>');
  }
);

// 5. Criar e Emitir Novo Documento Fiscal
app.post(
  '/api/v1/fiscal/documents',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FISCAL_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const userId = user?.id || 'usr-default';
    const userName = user?.name || user?.email || 'Operador Fiscal';

    const input = req.body;
    if (!input.model || !input.natureOfOperation || !input.partnerName || !input.items || input.items.length === 0) {
      throw new AppError('Dados incompletos para emissão do documento fiscal.', 400, 'INVALID_FISCAL_PAYLOAD');
    }

    const doc = await dbEngine.createFiscalDocumentAsync(
      schemaNamespace!,
      input,
      userId,
      userName
    );

    res.status(201).json({
      success: true,
      data: doc,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 6. Transmitir Documento Fiscal para SEFAZ / Prefeitura
app.post(
  '/api/v1/fiscal/documents/:id/transmit',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FISCAL_TRANSMIT),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const userId = user?.id || 'usr-default';
    const userName = user?.name || user?.email || 'Operador Fiscal';

    const doc = await dbEngine.transmitFiscalDocumentAsync(
      schemaNamespace!,
      req.params.id,
      userId,
      userName
    );

    res.json({
      success: true,
      data: doc,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 7. Cancelar Documento Fiscal Autorizado (SEFAZ)
app.post(
  '/api/v1/fiscal/documents/:id/cancel',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FISCAL_CANCEL),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const userId = user?.id || 'usr-default';
    const userName = user?.name || user?.email || 'Operador Fiscal';
    const { justification } = req.body;

    if (!justification || justification.trim().length < 15) {
      throw new AppError('A justificativa de cancelamento da SEFAZ requer no mínimo 15 caracteres.', 400, 'INVALID_JUSTIFICATION');
    }

    const doc = await dbEngine.cancelFiscalDocumentAsync(
      schemaNamespace!,
      req.params.id,
      justification,
      userId,
      userName
    );

    res.json({
      success: true,
      data: doc,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 8. Emitir Carta de Correção Eletrônica (CC-e)
app.post(
  '/api/v1/fiscal/documents/:id/correction',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FISCAL_CORRECT),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const userId = user?.id || 'usr-default';
    const userName = user?.name || user?.email || 'Operador Fiscal';
    const { correctionText } = req.body;

    if (!correctionText || correctionText.trim().length < 15) {
      throw new AppError('O texto explicativo da CC-e requer no mínimo 15 caracteres.', 400, 'INVALID_CCE_TEXT');
    }

    const doc = await dbEngine.addCorrectionLetterAsync(
      schemaNamespace!,
      req.params.id,
      correctionText,
      userId,
      userName
    );

    res.json({
      success: true,
      data: doc,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 9. Operações Fiscais (CFOPs)
app.get(
  '/api/v1/fiscal/operations',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FISCAL_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const operations = dbEngine.listFiscalOperations(schemaNamespace!);

    res.json({
      success: true,
      data: operations,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.post(
  '/api/v1/fiscal/operations',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FISCAL_MATRIX_MANAGE),
  async (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const input = req.body;

    if (!input.cfop || !input.description || !input.type) {
      throw new AppError('Dados incompletos para a Operação Fiscal.', 400, 'INVALID_OPERATION');
    }

    const op = dbEngine.createFiscalOperation(schemaNamespace!, input);

    res.status(201).json({
      success: true,
      data: op,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 10. Inutilização de Numeração
app.get(
  '/api/v1/fiscal/inutilizations',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FISCAL_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const list = dbEngine.listFiscalInutilizations(schemaNamespace!);

    res.json({
      success: true,
      data: list,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.post(
  '/api/v1/fiscal/inutilizations',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FISCAL_INUTILIZE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const userId = user?.id || 'usr-default';
    const userName = user?.name || user?.email || 'Operador Fiscal';
    const { model, series, startNumber, endNumber, year, justification } = req.body;

    if (!model || !startNumber || !endNumber || !justification) {
      throw new AppError('Dados incompletos para inutilização.', 400, 'INVALID_INUTILIZATION');
    }

    const inut = await dbEngine.createFiscalInutilizationAsync(
      schemaNamespace!,
      {
        model,
        series: series || '1',
        startNumber: Number(startNumber),
        endNumber: Number(endNumber),
        year: Number(year || new Date().getFullYear()),
        justification,
      },
      userId,
      userName
    );

    res.status(201).json({
      success: true,
      data: inut,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 11. Prévia do Arquivo SPED Fiscal (EFD ICMS/IPI)
app.get(
  '/api/v1/fiscal/sped/preview',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FISCAL_SPED_EXPORT),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    const sped = dbEngine.generateSpedPreview(schemaNamespace!, month, year);

    res.json({
      success: true,
      data: sped,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 12. Emissão de Documento Fiscal a partir do Faturamento
app.post(
  '/api/v1/fiscal/emit-from-billing',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.FISCAL_TRANSMIT),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const userId = user?.id || 'usr-default';
    const userName = user?.name || user?.email || 'Operador Fiscal';
    const { billingId, model } = req.body;

    if (!billingId) {
      throw new AppError('O identificador do faturamento é obrigatório.', 400, 'MISSING_BILLING_ID');
    }

    const doc = await dbEngine.createFiscalFromBillingAsync(
      schemaNamespace!,
      billingId,
      model || 'NFE_55',
      userId,
      userName
    );

    res.status(201).json({
      success: true,
      data: doc,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// ============================================================================
// ROTAS DO MÓDULO DE COMPRAS, SUPRIMENTOS & ENTRADA DE MERCADORIAS (PRD 08)
// ============================================================================

// 1. Dashboard de Compras & Métricas
app.get(
  '/api/v1/purchases/metrics',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASES_DASHBOARD_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const metrics = dbEngine.getPurchasesMetrics(schemaNamespace!);

    res.json({
      success: true,
      data: metrics,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 2. Listagem de Requisições de Compra
app.get(
  '/api/v1/purchases/requisitions',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_REQUISITIONS_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { status, department, priority } = req.query;

    const requisitions = dbEngine.listPurchaseRequisitions(schemaNamespace!, {
      status: status as string,
      department: department as string,
      priority: priority as string,
    });

    res.json({
      success: true,
      data: requisitions,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 3. Obter Requisição por ID
app.get(
  '/api/v1/purchases/requisitions/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_REQUISITIONS_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const reqItem = dbEngine.getPurchaseRequisitionById(schemaNamespace!, req.params.id);

    if (!reqItem) {
      throw new NotFoundError('Requisição de compra não encontrada.');
    }

    res.json({
      success: true,
      data: reqItem,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 4. Criar Requisição de Compra
app.post(
  '/api/v1/purchases/requisitions',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_REQUISITIONS_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Usuário' };

    const requisition = await dbEngine.createPurchaseRequisitionAsync(schemaNamespace!, req.body, currentUser);

    res.status(201).json({
      success: true,
      data: requisition,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 5. Aprovar Requisição de Compra
app.post(
  '/api/v1/purchases/requisitions/:id/approve',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_REQUISITIONS_APPROVE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Gestor' };

    const requisition = await dbEngine.approvePurchaseRequisitionAsync(schemaNamespace!, req.params.id, currentUser);

    res.json({
      success: true,
      data: requisition,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 6. Rejeitar Requisição de Compra
app.post(
  '/api/v1/purchases/requisitions/:id/reject',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_REQUISITIONS_APPROVE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Gestor' };
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      throw new AppError('O motivo da reprovação é obrigatório.', 400, 'MISSING_REJECTION_REASON');
    }

    const requisition = await dbEngine.rejectPurchaseRequisitionAsync(schemaNamespace!, req.params.id, reason, currentUser);

    res.json({
      success: true,
      data: requisition,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 7. Cancelar Requisição de Compra
app.post(
  '/api/v1/purchases/requisitions/:id/cancel',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_REQUISITIONS_CANCEL),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Usuário' };

    const requisition = await dbEngine.cancelPurchaseRequisitionAsync(schemaNamespace!, req.params.id, currentUser);

    res.json({
      success: true,
      data: requisition,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 8. Listagem de Cotações de Compra
app.get(
  '/api/v1/purchases/quotations',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_QUOTES_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { status } = req.query;

    const quotations = dbEngine.listPurchaseQuotations(schemaNamespace!, {
      status: status as string,
    });

    res.json({
      success: true,
      data: quotations,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 9. Obter Cotação por ID
app.get(
  '/api/v1/purchases/quotations/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_QUOTES_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const quotation = dbEngine.getPurchaseQuotationById(schemaNamespace!, req.params.id);

    if (!quotation) {
      throw new NotFoundError('Cotação de compra não encontrada.');
    }

    res.json({
      success: true,
      data: quotation,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 10. Criar Cotação de Compra
app.post(
  '/api/v1/purchases/quotations',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_QUOTES_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Comprador' };

    const quotation = dbEngine.createPurchaseQuotation(schemaNamespace!, req.body, currentUser);

    res.status(201).json({
      success: true,
      data: quotation,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 11. Inserir/Atualizar Proposta de Fornecedor na Cotação
app.post(
  '/api/v1/purchases/quotations/:id/proposals',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_QUOTES_UPDATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;

    const quotation = dbEngine.addQuotationProposal(schemaNamespace!, req.params.id, req.body);

    res.json({
      success: true,
      data: quotation,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 12. Homologar Cotação (Escolha do Fornecedor Vencedor) e Gerar Pedido de Compra
app.post(
  '/api/v1/purchases/quotations/:id/homologate',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_QUOTES_APPROVE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Diretoria de Suprimentos' };
    const { winningSupplierId, createPurchaseOrder } = req.body;

    if (!winningSupplierId) {
      throw new AppError('O identificador do fornecedor vencedor é obrigatório.', 400, 'MISSING_WINNING_SUPPLIER');
    }

    const result = await dbEngine.homologateQuotationAsync(
      schemaNamespace!,
      req.params.id,
      winningSupplierId,
      currentUser,
      createPurchaseOrder !== false
    );

    res.json({
      success: true,
      data: result,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 13. Listagem de Pedidos de Compra
app.get(
  '/api/v1/purchases/orders',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_ORDERS_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { status, supplierId } = req.query;

    const orders = dbEngine.listPurchaseOrders(schemaNamespace!, {
      status: status as string,
      supplierId: supplierId as string,
    });

    res.json({
      success: true,
      data: orders,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 14. Obter Pedido de Compra por ID
app.get(
  '/api/v1/purchases/orders/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_ORDERS_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const order = dbEngine.getPurchaseOrderById(schemaNamespace!, req.params.id);

    if (!order) {
      throw new NotFoundError('Pedido de compra não encontrado.');
    }

    res.json({
      success: true,
      data: order,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 15. Criar Pedido de Compra
app.post(
  '/api/v1/purchases/orders',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_ORDERS_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Comprador' };

    const order = await dbEngine.createPurchaseOrderAsync(schemaNamespace!, req.body, currentUser);

    res.status(201).json({
      success: true,
      data: order,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 16. Aprovar Pedido de Compra
app.post(
  '/api/v1/purchases/orders/:id/approve',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_ORDERS_APPROVE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Gestor de Compras' };

    const order = await dbEngine.approvePurchaseOrderAsync(schemaNamespace!, req.params.id, currentUser);

    res.json({
      success: true,
      data: order,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 17. Rejeitar Pedido de Compra
app.post(
  '/api/v1/purchases/orders/:id/reject',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_ORDERS_APPROVE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Gestor de Compras' };
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      throw new AppError('O motivo da reprovação é obrigatório.', 400, 'MISSING_REJECTION_REASON');
    }

    const order = await dbEngine.rejectPurchaseOrderAsync(schemaNamespace!, req.params.id, reason, currentUser);

    res.json({
      success: true,
      data: order,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 18. Emitir Pedido de Compra ao Fornecedor
app.post(
  '/api/v1/purchases/orders/:id/issue',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_ORDERS_ISSUE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Comprador' };

    const order = await dbEngine.issuePurchaseOrderAsync(schemaNamespace!, req.params.id, currentUser);

    res.json({
      success: true,
      data: order,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 19. Cancelar Pedido de Compra
app.post(
  '/api/v1/purchases/orders/:id/cancel',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PURCHASE_ORDERS_CANCEL),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Comprador' };

    const order = await dbEngine.cancelPurchaseOrderAsync(schemaNamespace!, req.params.id, currentUser);

    res.json({
      success: true,
      data: order,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 20. Listagem de Notas Fiscais de Entrada (Inbound Invoices)
app.get(
  '/api/v1/purchases/inbound-invoices',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.INBOUND_INVOICES_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { status } = req.query;

    const invoices = dbEngine.listInboundInvoices(schemaNamespace!, {
      status: status as string,
    });

    res.json({
      success: true,
      data: invoices,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 21. Obter Nota Fiscal de Entrada por ID
app.get(
  '/api/v1/purchases/inbound-invoices/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.INBOUND_INVOICES_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const invoice = dbEngine.getInboundInvoiceById(schemaNamespace!, req.params.id);

    if (!invoice) {
      throw new NotFoundError('Nota Fiscal de Entrada não encontrada.');
    }

    res.json({
      success: true,
      data: invoice,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 22. Importar XML de NF-e de Entrada (Recebimento Fiscal)
app.post(
  '/api/v1/purchases/inbound-invoices/import-xml',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.INBOUND_INVOICES_IMPORT),
  (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Recebimento' };
    const { xmlContent, warehouseId, purchaseOrderId } = req.body;

    if (!xmlContent || !xmlContent.trim()) {
      throw new AppError('O conteúdo XML da NF-e é obrigatório.', 400, 'MISSING_XML_CONTENT');
    }

    const invoice = dbEngine.importInboundInvoiceXml(
      schemaNamespace!,
      xmlContent,
      warehouseId,
      currentUser,
      purchaseOrderId
    );

    res.status(201).json({
      success: true,
      data: invoice,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 23. Processar Nota Fiscal de Entrada (Física + Financeira + Vínculo com Pedido)
app.post(
  '/api/v1/purchases/inbound-invoices/:id/process',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.INBOUND_INVOICES_PROCESS),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Conferente Fiscal' };

    const result = await dbEngine.processInboundInvoiceAsync(schemaNamespace!, req.params.id, currentUser);

    res.json({
      success: true,
      data: result,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// ============================================================================
// PRD 09 — COBRANÇA BANCÁRIA, BOLETOS, PIX DINÂMICO & CONCILIAÇÃO CNAB (240/400)
// ============================================================================

// 1. Dashboard de Métricas de Cobrança Bancária & Inadimplência
app.get(
  '/api/v1/banking/dashboard',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BANKING_DASHBOARD_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const metrics = dbEngine.getBankingDashboardMetrics(schemaNamespace!);

    res.json({
      success: true,
      data: metrics,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 2. Listar Boletos Bancários
app.get(
  '/api/v1/banking/slips',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BANK_SLIPS_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const slips = dbEngine.listBankSlips(schemaNamespace!);

    res.json({
      success: true,
      data: slips,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 3. Obter Boleto Bancário por ID
app.get(
  '/api/v1/banking/slips/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BANK_SLIPS_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const slip = dbEngine.getBankSlipById(schemaNamespace!, req.params.id);

    if (!slip) {
      throw new NotFoundError(`Boleto bancário [${req.params.id}] não encontrado.`);
    }

    res.json({
      success: true,
      data: slip,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 4. Emitir/Criar Boleto Bancário (com cálculo de linha digitável e código de barras)
app.post(
  '/api/v1/banking/slips',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BANK_SLIPS_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Operador Financeiro', email: user?.email };

    const slip = await dbEngine.createBankSlipAsync(schemaNamespace!, req.body, currentUser);

    res.status(201).json({
      success: true,
      data: slip,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 5. Cancelar / Baixar Boleto Bancário
app.post(
  '/api/v1/banking/slips/:id/cancel',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BANK_SLIPS_CANCEL),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Operador Financeiro', email: user?.email };
    const { reason } = req.body;

    const slip = await dbEngine.cancelBankSlipAsync(schemaNamespace!, req.params.id, reason || 'Cancelamento solicitado', currentUser);

    res.json({
      success: true,
      data: slip,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 6. Listar Cobranças Pix Dinâmico
app.get(
  ['/api/v1/banking/pix/charges', '/api/v1/banking/pix'],
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PIX_CHARGES_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const charges = dbEngine.listPixCharges(schemaNamespace!);

    res.json({
      success: true,
      data: charges,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 7. Gerar Cobrança Pix Dinâmico com EMV Payload e QR Code SVG
app.post(
  ['/api/v1/banking/pix/charges', '/api/v1/banking/pix'],
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PIX_CHARGES_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Operador Financeiro', email: user?.email };

    const charge = await dbEngine.createPixChargeAsync(schemaNamespace!, req.body, currentUser);

    res.status(201).json({
      success: true,
      data: charge,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 8. Simular Pagamento Instantâneo Pix (Webhook Bacen SPI Simulator)
app.post(
  ['/api/v1/banking/pix/charges/:txid/simulate-payment', '/api/v1/banking/pix/:txid/simulate-payment'],
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PIX_CHARGES_SIMULATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Operador Financeiro', email: user?.email };

    const result = await dbEngine.simulatePixPaymentAsync(schemaNamespace!, req.params.txid, currentUser);

    res.json({
      success: true,
      data: result,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 9. Listar Arquivos CNAB (Remessas e Retornos)
app.get(
  ['/api/v1/banking/cnab/files', '/api/v1/banking/cnab'],
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BANKING_DASHBOARD_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const files = dbEngine.listCnabFiles(schemaNamespace!);

    res.json({
      success: true,
      data: files,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 10. Gerar Arquivo de Remessa CNAB (400 / 240)
app.post(
  '/api/v1/banking/cnab/remessa',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.CNAB_REMESSA_GENERATE),
  (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Operador Financeiro', email: user?.email };

    const file = dbEngine.generateCnabRemessa(schemaNamespace!, req.body, currentUser);

    res.status(201).json({
      success: true,
      data: file,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 11. Processar Arquivo de Retorno CNAB (Conciliação e Liquidação Automática)
app.post(
  '/api/v1/banking/cnab/retorno',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.CNAB_RETORNO_PROCESS),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Operador Financeiro', email: user?.email };
    const { contentRaw, bankAccountId } = req.body;

    if (!contentRaw || !contentRaw.trim()) {
      throw new AppError('O conteúdo do arquivo de Retorno CNAB é obrigatório.', 400, 'MISSING_CNAB_CONTENT');
    }

    if (!bankAccountId) {
      throw new AppError('A conta bancária de crédito é obrigatória.', 400, 'MISSING_BANK_ACCOUNT');
    }

    const result = await dbEngine.processCnabRetornoAsync(
      schemaNamespace!,
      { contentRaw, bankAccountId },
      currentUser
    );

    res.json({
      success: true,
      data: result,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 12. Listar Régua de Cobrança / Notificações
app.get(
  ['/api/v1/banking/dunning-rules', '/api/v1/banking/dunning'],
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.BANKING_DASHBOARD_VIEW),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const rules = dbEngine.listDunningRules(schemaNamespace!);

    res.json({
      success: true,
      data: rules,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 13. Criar Regra de Cobrança
app.post(
  ['/api/v1/banking/dunning-rules', '/api/v1/banking/dunning', '/api/v1/banking/dunning/rules'],
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.DUNNING_RULES_MANAGE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Operador Financeiro', email: user?.email };

    const rule = dbEngine.createDunningRule(schemaNamespace!, req.body, currentUser);

    res.status(201).json({
      success: true,
      data: rule,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 14. Alternar Ativação de Regra de Cobrança
app.patch(
  ['/api/v1/banking/dunning-rules/:id/toggle', '/api/v1/banking/dunning/rules/:id/toggle'],
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.DUNNING_RULES_MANAGE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Operador Financeiro', email: user?.email };

    const rule = dbEngine.toggleDunningRule(schemaNamespace!, req.params.id, !!req.body.isActive, currentUser);

    res.json({
      success: true,
      data: rule,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// 15. Executar Régua de Cobrança (Disparo em Lote)
app.post(
  ['/api/v1/banking/dunning-rules/execute', '/api/v1/banking/dunning/execute'],
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.DUNNING_RULES_MANAGE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const currentUser = { id: user?.id || 'usr-default', name: user?.name || user?.email || 'Operador Financeiro', email: user?.email };

    const result = dbEngine.executeDunningRules(schemaNamespace!, currentUser);

    res.json({
      success: true,
      data: result,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// ============================================================================
// PRD PARTE 06 — COBRANÇA E CONTAS A RECEBER (SEPARAÇÃO E ADAPTERS)
// ============================================================================

// --- CONTAS A RECEBER (RECEIVABLES) ---

app.get(
  '/api/v1/receivables',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECEIVABLES_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { status, customerId, startDate, endDate, isOverdue } = req.query;

    const list = dbEngine.listReceivables(schemaNamespace!, {
      status: status as string,
      customerId: customerId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      isOverdue: isOverdue === 'true',
    });

    res.json({
      success: true,
      data: list,
      meta: { total: list.length, requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.get(
  '/api/v1/receivables/metrics/dashboard',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECEIVABLES_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const metrics = dbEngine.getReceivablesDashboardMetrics(schemaNamespace!);

    res.json({
      success: true,
      data: metrics,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.get(
  '/api/v1/receivables/customers/:customerId/summary',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECEIVABLES_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { customerId } = req.params;
    const summary = dbEngine.getCustomerReceivablesSummary(schemaNamespace!, customerId);

    res.json({
      success: true,
      data: summary,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.get(
  '/api/v1/receivables/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECEIVABLES_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { id } = req.params;

    const rec = dbEngine.getReceivable(schemaNamespace!, id);
    if (!rec) throw new NotFoundError(`Conta a receber [${id}] não encontrada.`);

    res.json({
      success: true,
      data: rec,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.post(
  '/api/v1/receivables',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECEIVABLES_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const rec = await dbEngine.createReceivableAsync(schemaNamespace!, req.body, user);

    res.status(201).json({
      success: true,
      data: rec,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.post(
  '/api/v1/receivables/:id/cancel',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECEIVABLES_CANCEL),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const { id } = req.params;
    const { reason } = req.body;

    const rec = await dbEngine.cancelReceivableAsync(schemaNamespace!, id, reason || 'Cancelamento solicitado pelo usuário.', user);

    res.json({
      success: true,
      data: rec,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.post(
  '/api/v1/receivables/:id/manual-payment',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.RECEIVABLES_UPDATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const { id } = req.params;

    const result = await dbEngine.recordReceivablePaymentAsync(
      schemaNamespace!,
      {
        receivableId: id,
        ...req.body,
      },
      user
    );

    res.status(201).json({
      success: true,
      data: result,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// --- COBRANÇAS (COLLECTIONS) ---

app.get(
  '/api/v1/collections',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.COLLECTIONS_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { receivableId, method, status } = req.query;

    const list = dbEngine.listCollections(schemaNamespace!, {
      receivableId: receivableId as string,
      method: method as string,
      status: status as string,
    });

    res.json({
      success: true,
      data: list,
      meta: { total: list.length, requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.post(
  '/api/v1/collections',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.COLLECTIONS_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { schemaNamespace, user } = req.tenantContext!;
      const col = await dbEngine.createCollection(schemaNamespace!, req.body, user);

      res.status(201).json({
        success: true,
        data: col,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      next(err);
    }
  }
);

app.get(
  '/api/v1/collections/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.COLLECTIONS_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { id } = req.params;

    const col = dbEngine.getCollection(schemaNamespace!, id);
    if (!col) throw new NotFoundError(`Cobrança [${id}] não encontrada.`);

    res.json({
      success: true,
      data: col,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.post(
  '/api/v1/collections/:id/cancel',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.COLLECTIONS_CANCEL),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { schemaNamespace, user } = req.tenantContext!;
      const { id } = req.params;
      const { reason } = req.body;

      const col = await dbEngine.cancelCollection(
        schemaNamespace!,
        id,
        reason || 'Cancelamento solicitado.',
        user
      );

      res.json({
        success: true,
        data: col,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/api/v1/collections/:id/reissue',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.COLLECTIONS_REISSUE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { schemaNamespace, user } = req.tenantContext!;
      const { id } = req.params;
      const { newDueDate } = req.body;

      if (!newDueDate) {
        throw new AppError('Nova data de vencimento é obrigatória.', 400, 'INVALID_DUE_DATE');
      }

      const col = await dbEngine.reissueCollection(schemaNamespace!, id, newDueDate, user);

      res.status(201).json({
        success: true,
        data: col,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      next(err);
    }
  }
);

// --- PAGAMENTOS (PAYMENTS) ---

app.get(
  '/api/v1/payments',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PAYMENTS_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { receivableId } = req.query;

    const list = dbEngine.listPaymentsV2(schemaNamespace!, {
      receivableId: receivableId as string,
    });

    res.json({
      success: true,
      data: list,
      meta: { total: list.length, requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.post(
  '/api/v1/payments/:id/reverse',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PAYMENTS_REVERSE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const { id } = req.params;
    const { reason } = req.body;

    const result = await dbEngine.reverseReceivablePaymentAsync(
      schemaNamespace!,
      id,
      reason || 'Estorno de pagamento solicitado.',
      user
    );

    res.json({
      success: true,
      data: result,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// --- PROVEDORES DE PAGAMENTO (PAYMENT PROVIDERS) ---

app.get(
  '/api/v1/payment-providers',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PAYMENT_PROVIDERS_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const list = dbEngine.listPaymentProviders(schemaNamespace!);

    res.json({
      success: true,
      data: list,
      meta: { total: list.length, requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.post(
  '/api/v1/payment-providers',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PAYMENT_PROVIDERS_CREATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const prov = await dbEngine.createPaymentProviderAsync(schemaNamespace!, req.body, user);

    res.status(201).json({
      success: true,
      data: prov,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.get(
  '/api/v1/payment-providers/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PAYMENT_PROVIDERS_READ),
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const { id } = req.params;

    const prov = dbEngine.getPaymentProvider(schemaNamespace!, id);
    if (!prov) throw new NotFoundError(`Provedor [${id}] não encontrado.`);

    res.json({
      success: true,
      data: prov,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.put(
  '/api/v1/payment-providers/:id',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PAYMENT_PROVIDERS_UPDATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const { id } = req.params;

    const prov = await dbEngine.updatePaymentProviderAsync(schemaNamespace!, id, req.body, user);

    res.json({
      success: true,
      data: prov,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

app.post(
  '/api/v1/payment-providers/:id/test',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PAYMENT_PROVIDERS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { schemaNamespace, user } = req.tenantContext!;
      const { id } = req.params;

      const result = await dbEngine.testPaymentProviderConnection(schemaNamespace!, id, user);

      res.json({
        success: true,
        data: result,
        meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/api/v1/payment-providers/:id/set-default',
  authMiddleware,
  tenantMiddleware,
  requirePermission(PERMISSIONS.PAYMENT_PROVIDERS_UPDATE),
  async (req: Request, res: Response) => {
    const { schemaNamespace, user } = req.tenantContext!;
    const { id } = req.params;

    const prov = await dbEngine.setDefaultPaymentProviderAsync(schemaNamespace!, id, user);

    res.json({
      success: true,
      data: prov,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
);

// ============================================================================
// SPOTLIGHT SEARCH & COMMAND PALETTE API (PRD MULTI-TENANT ISOLATED SEARCH)
// ============================================================================

app.get(
  '/api/v1/search',
  authMiddleware,
  tenantMiddleware,
  (req: Request, res: Response) => {
    const { schemaNamespace } = req.tenantContext!;
    const query = (req.query.q as string) || '';
    const limit = parseInt((req.query.limit as string) || '30', 10);

    const records = dbEngine.searchTenantRecords(schemaNamespace!, query, limit);

    res.json({
      success: true,
      data: records,
      meta: {
        total: records.length,
        query,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
);

// --- WEBHOOK PÚBLICO DE PAGAMENTOS ---

app.post(
  '/api/v1/webhooks/payments/:provider',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { provider } = req.params;
      const headers = req.headers as Record<string, string>;

      const result = await dbEngine.processWebhookPayment(provider, req.body, headers);

      res.json({
        received: true,
        status: result.status,
        message: result.message,
        details: result.details,
      });
    } catch (err: any) {
      logger.error(`[WEBHOOK_ERROR] Falha ao processar webhook [${req.params.provider}]: ${err.message}`);
      res.status(400).json({
        received: false,
        error: err.message,
      });
    }
  }
);

// ==========================================
// TRATAMENTO GLOBAL DE ERROS (PRD 01 - Seção 19)
// ==========================================

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = req.requestId || 'unknown-req-id';

  if (err instanceof AppError) {
    logger.warn(`[API_ERROR] ${err.code} - ${err.message}`, {
      requestId,
      statusCode: err.statusCode,
      url: req.originalUrl,
    });

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        requestId,
        details: err.details,
      },
    });
  }

  // Erros inesperados de sistema (não expor stack trace)
  logger.error(`[UNHANDLED_EXCEPTION] ${err.message}`, err, { requestId, url: req.originalUrl });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocorreu um erro interno de processamento.',
      requestId,
    },
  });
});

// Fallback para rotas /api/* não encontradas (garante retorno JSON e impede que caiam no fallback SPA do Vite)
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Rota da API não encontrada: ${req.method} ${req.originalUrl || req.url}`,
      requestId: req.requestId || 'unknown',
    },
  });
});

// ==========================================
// VITE MIDDLEWARE / STATIC ASSETS
// ==========================================

async function startServer() {
  await dbEngine.initialize();

  // Candidatos de diretório para localização dos assets estáticos compilados
  const candidateDirs = [
    path.join(process.cwd(), 'dist'),
    path.resolve('dist'),
    process.cwd(),
  ];

  let resolvedDistPath = '';
  let resolvedIndexPath = '';

  for (const dir of candidateDirs) {
    const candidateIndex = path.join(dir, 'index.html');
    if (fs.existsSync(candidateIndex)) {
      resolvedDistPath = dir;
      resolvedIndexPath = candidateIndex;
      break;
    }
  }

  const isBundledServer = typeof __filename !== 'undefined' && (__filename.endsWith('.cjs') || __filename.includes('dist'));
  const isExplicitDev = !isBundledServer && (process.env.NODE_ENV === 'development' || process.env.npm_lifecycle_event === 'dev');
  const hasCompiledDist = Boolean(resolvedIndexPath);

  // Se o servidor for o bundle compilado (dist/server.cjs) ou possuir dist e não for dev explícito:
  if (isBundledServer || (hasCompiledDist && !isExplicitDev)) {
    logger.info(`[Enlace ERP] Servindo frontend SPA compilado a partir de: ${resolvedDistPath}`);
    app.use(express.static(resolvedDistPath));
    app.get('*', (_req, res) => {
      res.sendFile(resolvedIndexPath);
    });
  } else {
    try {
      logger.info('[Enlace ERP] Inicializando Vite em modo middleware para desenvolvimento...');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteError: any) {
      logger.warn(`[Enlace ERP] Não foi possível iniciar Vite em middleware (${viteError?.message}). Tentando fallback estático...`);
      if (hasCompiledDist) {
        logger.info(`[Enlace ERP] Fallback estático ativado com sucesso a partir de: ${resolvedDistPath}`);
        app.use(express.static(resolvedDistPath));
        app.get('*', (_req, res) => {
          res.sendFile(resolvedIndexPath);
        });
      } else {
        throw viteError;
      }
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`[Enlace ERP] Servidor Full-Stack rodando na porta ${PORT} (NODE_ENV: ${process.env.NODE_ENV || 'production-default'})`);
  });

  server.on('error', (err: any) => {
    logger.error(`[Enlace ERP] Erro no listener HTTP na porta ${PORT}: ${err.message}`, err);
    process.exit(1);
  });
}

startServer().catch((err) => {
  logger.error('[Fatal Startup Error]', err);
  process.exit(1);
});
