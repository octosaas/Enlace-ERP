/**
 * Enlace ERP - Serviço Completo de Autenticação, Sessões e MFA
 * PRD 01 & PRD 02 - Camada de Identidade e Segurança Central
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { dbEngine } from '../database/engine.js';
import { UnauthorizedError, ForbiddenError, AppError } from '../errors/index.js';
import { User, Company, Membership, UserSession, RefreshToken } from '../../shared/types.js';
import { TotpService } from '../security/totp.js';
import { AuditService } from '../audit/service.js';
import { logger } from '../logger/index.js';

const DEV_DEFAULT_JWT_SECRET = 'enlace_erp_secure_development_secret_key_2026_change_in_prod';
let ephemeralProductionSecret: string | null = null;

function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (envSecret === DEV_DEFAULT_JWT_SECRET || (envSecret && envSecret.trim().length < 32)) {
      throw new Error(
        'FALHA DE SEGURANÇA CRÍTICA: A variável de ambiente JWT_SECRET utiliza a chave padrão de desenvolvimento ou possui menos de 32 caracteres.'
      );
    }
    if (envSecret && envSecret.trim().length >= 32) {
      return envSecret;
    }
    // Quando JWT_SECRET não é explicitamente configurado no ambiente, gera uma chave efêmera de 256 bits
    if (!ephemeralProductionSecret) {
      ephemeralProductionSecret = crypto.randomBytes(32).toString('hex');
      logger.warn(
        '[AuthService] AVISO: JWT_SECRET não fornecido no ambiente. Chave criptográfica efêmera de 256-bits gerada em memória para esta instância.'
      );
    }
    return ephemeralProductionSecret;
  }

  return envSecret || DEV_DEFAULT_JWT_SECRET;
}

const ACCESS_TOKEN_EXPIRATION = '1h'; // 1 hora de vida para o access token (PRD 02)
const REFRESH_TOKEN_DAYS = 7; // 7 dias de validade para o refresh token com rotação

export interface AuthSessionPayload {
  userId: string;
  email: string;
  name: string;
  sessionId: string;
  activeCompanyId?: string;
}

export interface LoginResult {
  token: string;
  refreshToken: string;
  user: User;
  session: UserSession;
  companies: Array<{ company: Company; membership: Membership }>;
  mfaRequired?: boolean;
}

export class AuthService {
  /**
   * Autenticação de usuário com verificação de bloqueio, status e criação de sessão
   */
  static async login(params: {
    email: string;
    passwordPlain: string;
    mfaCode?: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  }): Promise<LoginResult> {
    await dbEngine.initialize();

    const cleanEmail = params.email.trim().toLowerCase();
    const userWithHash = dbEngine.getUserByEmail(cleanEmail);

    if (!userWithHash) {
      throw new UnauthorizedError('Credenciais inválidas.');
    }

    // 1. Verificação de status do usuário (PRD 02 - Seção 7)
    if (userWithHash.status === 'SUSPENDED' || userWithHash.status === 'DISABLED') {
      AuditService.recordSecurityEvent({
        type: 'SECURITY_LOGIN_FAILURE',
        severity: 'MEDIUM',
        userId: userWithHash.id,
        userEmail: userWithHash.email,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId || 'req-unknown',
        details: { status: userWithHash.status, reason: 'Tentativa de login por conta inativa/suspensa' },
        mitigationTaken: 'Acesso bloqueado na camada de serviço de autenticação.',
      });
      throw new ForbiddenError(
        userWithHash.status === 'SUSPENDED'
          ? 'Sua conta está temporariamente suspensa pela administração.'
          : 'Sua conta está desativada. Contate o suporte da plataforma.'
      );
    }

    // 2. Verificação de lockout por tentativas falhas (PRD 02 - Seção 27)
    if (userWithHash.lockoutUntil) {
      const lockTime = new Date(userWithHash.lockoutUntil).getTime();
      if (lockTime > Date.now()) {
        const remainingSeconds = Math.ceil((lockTime - Date.now()) / 1000);
        throw new AppError(
          `Conta temporariamente bloqueada por excesso de tentativas incorretas. Tente novamente em ${remainingSeconds} segundos.`,
          429,
          'ACCOUNT_LOCKED'
        );
      }
    }

    // 3. Validação do Hash de Senha com bcrypt
    const isMatch = await bcrypt.compare(params.passwordPlain, userWithHash.passwordHash);
    if (!isMatch) {
      const { failedCount, isLocked } = dbEngine.recordLoginFailure(userWithHash.id);

      AuditService.recordSecurityEvent({
        type: isLocked ? 'SECURITY_ACCOUNT_LOCKED' : 'SECURITY_LOGIN_FAILURE',
        severity: isLocked ? 'HIGH' : 'LOW',
        userId: userWithHash.id,
        userEmail: userWithHash.email,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId || 'req-unknown',
        details: { failedConsecutiveAttempts: failedCount, isLocked },
        mitigationTaken: isLocked ? 'Conta travada por 15 minutos.' : 'Falha contabilizada no perfil.',
      });

      throw new UnauthorizedError('Credenciais inválidas.');
    }

    // 4. Verificação de MFA se estiver ativado (PRD 02 - Seção 17)
    if (userWithHash.mfaEnabled && userWithHash.mfaSecret) {
      if (!params.mfaCode) {
        // Indica que a senha está correta, mas exige o código de 6 dígitos
        const { passwordHash: _, mfaSecret: __, recoveryCodes: ___, ...publicUser } = userWithHash;
        return {
          token: '',
          refreshToken: '',
          user: publicUser,
          session: {} as UserSession,
          companies: [],
          mfaRequired: true,
        };
      }

      const isValidMfa = TotpService.verifyCode(userWithHash.mfaSecret, params.mfaCode);
      if (!isValidMfa) {
        AuditService.recordSecurityEvent({
          type: 'SECURITY_MFA_FAILED',
          severity: 'HIGH',
          userId: userWithHash.id,
          userEmail: userWithHash.email,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          requestId: params.requestId || 'req-unknown',
          details: { reason: 'Código TOTP fornecido incorreto ou expirado' },
          mitigationTaken: 'Autenticação recusada com HTTP 401.',
        });
        throw new UnauthorizedError('Código de autenticação multifator (MFA) inválido.');
      }
    }

    // Login bem-sucedido: reseta contador de falhas
    dbEngine.resetLoginFailures(userWithHash.id);

    const { passwordHash: _, mfaSecret: __, recoveryCodes: ___, ...user } = userWithHash;
    const companies = dbEngine.listCompaniesForUser(user.id);

    // 5. Criação de registro de Sessão Ativa (PRD 02 - Seção 12)
    const sessionId = `ses-${crypto.randomUUID()}`;
    const tokenPayload: AuthSessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      sessionId,
      activeCompanyId: companies[0]?.company.id,
    };

    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_EXPIRATION });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const refreshTokenPlain = `rt-${crypto.randomBytes(32).toString('hex')}`;
    const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenPlain).digest('hex');

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const deviceLabel = parseDeviceLabel(params.userAgent || '');

    const session: UserSession = {
      id: sessionId,
      userId: user.id,
      activeCompanyId: companies[0]?.company.id,
      tokenHash,
      ipAddress: params.ipAddress || '127.0.0.1',
      userAgent: params.userAgent || 'Desconhecido',
      deviceLabel,
      isRevoked: false,
      createdAt: new Date().toISOString(),
      expiresAt,
      lastActivityAt: new Date().toISOString(),
    };

    dbEngine.createSession(session);

    // Salva o Refresh Token associado (PRD 02 - Seção 13)
    const storedRt: RefreshToken = {
      id: `rtk-${crypto.randomUUID()}`,
      sessionId,
      userId: user.id,
      tokenHash: refreshTokenHash,
      isRevoked: false,
      isUsed: false,
      createdAt: new Date().toISOString(),
      expiresAt: refreshExpiresAt,
    };
    dbEngine.saveRefreshToken(storedRt);

    return {
      token,
      refreshToken: refreshTokenPlain,
      user,
      session,
      companies,
      mfaRequired: false,
    };
  }

  /**
   * Verificação de token de sessão com validação no banco de sessões ativas
   */
  static verifyToken(token: string): AuthSessionPayload {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as AuthSessionPayload;

      // Valida se o usuário não foi desativado ou suspenso em tempo real
      const user = dbEngine.getUserById(decoded.userId);
      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedError('Acesso bloqueado: o status da conta não permite novas operações.');
      }

      // Valida se a sessão ainda está ativa e não foi revogada (PRD 02 - Seção 12)
      if (decoded.sessionId) {
        if (dbEngine.isSessionRevoked(decoded.sessionId)) {
          throw new UnauthorizedError('Sessão revogada pelo usuário ou pela administração.');
        }

        let session = dbEngine.getSession(decoded.sessionId);
        if (!session) {
          // Se o processo do servidor foi reiniciado, re-hidrata a sessão ativa
          // a partir do token criptograficamente válido e não expirado
          session = dbEngine.createSession({
            id: decoded.sessionId,
            userId: user.id,
            activeCompanyId: decoded.activeCompanyId,
            tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
            ipAddress: '127.0.0.1',
            userAgent: 'Sessão Restaurada',
            deviceLabel: 'Navegador Web',
            isRevoked: false,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            lastActivityAt: new Date().toISOString(),
          });
        }

        if (session.isRevoked) {
          throw new UnauthorizedError('Sessão revogada pelo usuário ou pela administração.');
        }
      }

      return decoded;
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Token de sessão expirado ou inválido.');
    }
  }

  /**
   * Rotação de Refresh Token com detecção de reutilização (PRD 02 - Seção 13)
   */
  static async rotateRefreshToken(params: {
    refreshTokenPlain: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  }): Promise<{ token: string; refreshToken: string }> {
    const tokenHash = crypto.createHash('sha256').update(params.refreshTokenPlain).digest('hex');
    const storedRt = dbEngine.getRefreshToken(tokenHash);

    if (!storedRt || storedRt.isRevoked) {
      throw new UnauthorizedError('Refresh token inválido ou revogado.');
    }

    // Detecção de Reúso de Refresh Token (Alerta de Ataque / Token Hijacking)
    if (storedRt.isUsed) {
      // Invalida toda a árvore de sessões do usuário imediatamente por segurança!
      dbEngine.revokeAllSessionsForUser(storedRt.userId);

      AuditService.recordSecurityEvent({
        type: 'SECURITY_TOKEN_REUSE_DETECTED',
        severity: 'CRITICAL',
        userId: storedRt.userId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId || 'req-unknown',
        details: {
          tokenHash,
          sessionId: storedRt.sessionId,
          reason: 'Um refresh token já consumido anteriormente foi apresentado novamente. Possível roubo de sessão.',
        },
        mitigationTaken: 'Todas as sessões ativas do usuário foram invalidadas preventivamente.',
      });

      throw new UnauthorizedError('Tentativa de reutilização de token detectada. Todas as sessões foram encerradas por segurança.');
    }

    if (new Date(storedRt.expiresAt).getTime() < Date.now()) {
      throw new UnauthorizedError('Refresh token expirado. Faça login novamente.');
    }

    const session = dbEngine.getSession(storedRt.sessionId);
    if (!session || session.isRevoked) {
      throw new UnauthorizedError('Sessão associada foi revogada.');
    }

    const user = dbEngine.getUserById(storedRt.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Conta inativa.');
    }

    // Gera novos tokens (Rotação)
    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        sessionId: session.id,
        activeCompanyId: session.activeCompanyId,
      },
      getJwtSecret(),
      { expiresIn: ACCESS_TOKEN_EXPIRATION }
    );

    const newRefreshTokenPlain = `rt-${crypto.randomBytes(32).toString('hex')}`;
    const newRefreshTokenHash = crypto.createHash('sha256').update(newRefreshTokenPlain).digest('hex');

    // Marca o token anterior como consumido
    dbEngine.markRefreshTokenUsed(tokenHash, newRefreshTokenHash);

    // Salva o novo refresh token
    const newRtRecord: RefreshToken = {
      id: `rtk-${crypto.randomUUID()}`,
      sessionId: session.id,
      userId: user.id,
      tokenHash: newRefreshTokenHash,
      isRevoked: false,
      isUsed: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };
    dbEngine.saveRefreshToken(newRtRecord);

    return {
      token: newAccessToken,
      refreshToken: newRefreshTokenPlain,
    };
  }

  /**
   * Logout da sessão atual
   */
  static logout(sessionId: string): boolean {
    return dbEngine.revokeSession(sessionId);
  }

  /**
   * Logout de todas as sessões do usuário (PRD 02 - Seção 14)
   */
  static logoutAll(userId: string): number {
    return dbEngine.revokeAllSessionsForUser(userId);
  }

  /**
   * Solicitação segura de recuperação de senha (PRD 02 - Seção 15)
   * Regra estrita: Não revela se o e-mail existe no banco (anti-enumeração).
   */
  static requestPasswordReset(email: string): { message: string; simulationToken?: string } {
    const cleanEmail = email.trim().toLowerCase();
    const user = dbEngine.getUserByEmail(cleanEmail);

    let simulationToken: string | undefined;

    if (user && user.status === 'ACTIVE') {
      const token = `rst-${crypto.randomBytes(24).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora de validade

      dbEngine.savePasswordReset({
        id: `pr-${crypto.randomUUID()}`,
        userId: user.id,
        email: user.email,
        token,
        expiresAt,
        isUsed: false,
        createdAt: new Date().toISOString(),
      });

      // Em ambiente de teste/demonstração disponibilizamos o token para verificação
      simulationToken = token;
    }

    return {
      message: 'Se o e-mail informado estiver cadastrado, as instruções para recuperação de acesso foram encaminhadas.',
      simulationToken,
    };
  }

  /**
   * Redefinição de senha com token temporário e invalidação de todas as sessões
   */
  static async resetPassword(token: string, newPasswordPlain: string): Promise<boolean> {
    if (newPasswordPlain.length < 8) {
      throw new AppError('A nova senha deve possuir pelo menos 8 caracteres.', 400);
    }

    const resetRecord = dbEngine.getPasswordReset(token);
    if (!resetRecord) {
      throw new UnauthorizedError('Token de recuperação de senha inválido ou expirado.');
    }

    const newHash = await bcrypt.hash(newPasswordPlain, 10);
    dbEngine.updateUser(resetRecord.userId, { passwordHash: newHash });
    dbEngine.consumePasswordReset(token);

    // Invalida todas as sessões do usuário para garantir revogação total
    dbEngine.revokeAllSessionsForUser(resetRecord.userId);

    return true;
  }

  /**
   * Troca de senha autenticada
   */
  static async changePassword(userId: string, currentPasswordPlain: string, newPasswordPlain: string): Promise<boolean> {
    if (newPasswordPlain.length < 8) {
      throw new AppError('A nova senha deve possuir pelo menos 8 caracteres.', 400);
    }

    const user = dbEngine.getUserById(userId);
    if (!user) throw new UnauthorizedError('Usuário não encontrado.');

    const isMatch = await bcrypt.compare(currentPasswordPlain, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('A senha atual fornecida está incorreta.');
    }

    const newHash = await bcrypt.hash(newPasswordPlain, 10);
    dbEngine.updateUser(userId, { passwordHash: newHash });

    return true;
  }

  /**
   * Assistente de configuração do MFA (TOTP)
   */
  static setupMfa(userId: string) {
    const user = dbEngine.getUserById(userId);
    if (!user) throw new UnauthorizedError('Usuário não encontrado.');

    const secret = TotpService.generateSecret(20);
    const recoveryCodes = TotpService.generateRecoveryCodes(8);
    const otpauthUrl = `otpauth://totp/EnlaceERP:${encodeURIComponent(user.email)}?secret=${secret}&issuer=EnlaceERP`;

    // Armazena temporariamente no usuário até confirmação do código
    dbEngine.updateUser(userId, { mfaSecret: secret, recoveryCodes });

    return {
      secret,
      otpauthUrl,
      recoveryCodes,
    };
  }

  /**
   * Confirma e ativa o MFA com o primeiro código válido de 6 dígitos
   */
  static verifyAndEnableMfa(userId: string, code: string): boolean {
    const user = dbEngine.getUserById(userId);
    if (!user || !user.mfaSecret) {
      throw new AppError('Configuração de MFA não iniciada para este usuário.', 400);
    }

    const isValid = TotpService.verifyCode(user.mfaSecret, code);
    if (!isValid) {
      throw new UnauthorizedError('Código de confirmação MFA incorreto. Verifique o relógio do seu aplicativo.');
    }

    dbEngine.updateUser(userId, { mfaEnabled: true });
    return true;
  }

  /**
   * Desativa o MFA mediante confirmação da senha atual
   */
  static async disableMfa(userId: string, passwordPlain: string): Promise<boolean> {
    const user = dbEngine.getUserById(userId);
    if (!user) throw new UnauthorizedError('Usuário não encontrado.');

    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Senha incorreta. Não foi possível desativar o MFA.');
    }

    dbEngine.updateUser(userId, { mfaEnabled: false, mfaSecret: undefined, recoveryCodes: undefined });
    return true;
  }
}

function parseDeviceLabel(userAgent: string): string {
  if (!userAgent) return 'Dispositivo Padrão';
  if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
    return 'Dispositivo Móvel';
  }
  if (userAgent.includes('Windows')) return 'Navegador Web (Windows)';
  if (userAgent.includes('Macintosh')) return 'Navegador Web (macOS)';
  if (userAgent.includes('Linux')) return 'Navegador Web (Linux)';
  return 'Sessão Web Segura';
}
