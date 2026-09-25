/**
 * Enlace ERP - Middleware de Autenticação (Auth Middleware)
 * PRD 01 - Seção 14 e Seção 15
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../auth/service.js';
import { UnauthorizedError } from '../errors/index.js';
import { dbEngine } from '../database/engine.js';
import { User } from '../../shared/types.js';

import { RepositoryManager } from '../database/repositories/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
      requestId: string;
      correlationId: string;
    }
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Cabeçalho de autorização ausente ou malformatado.'));
  }

  const token = authHeader.substring(7).trim();
  try {
    const payload = await AuthService.verifyTokenAsync(token);
    const repos = RepositoryManager.getInstance().getRepositories();
    const storedUser = (await repos.users.findById(payload.userId)) || dbEngine.getUserById(payload.userId);
    if (!storedUser || storedUser.status !== 'ACTIVE') {
      return next(new UnauthorizedError('Usuário associado ao token não existe ou foi revogado.'));
    }

    const { passwordHash: _, mfaSecret: __, recoveryCodes: ___, ...publicUser } = storedUser;
    req.user = publicUser as User;
    req.sessionId = payload.sessionId;
    next();
  } catch (err) {
    next(err);
  }
}
