/**
 * Enlace ERP - Middleware de Autenticação (Auth Middleware)
 * PRD 01 - Seção 14 e Seção 15
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../auth/service.js';
import { UnauthorizedError } from '../errors/index.js';
import { dbEngine } from '../database/engine.js';
import { User } from '../../shared/types.js';

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

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Cabeçalho de autorização ausente ou malformatado.'));
  }

  const token = authHeader.substring(7).trim();
  try {
    const payload = AuthService.verifyToken(token);
    const user = dbEngine.getUserPublic(payload.userId);
    if (!user) {
      return next(new UnauthorizedError('Usuário associado ao token não existe ou foi revogado.'));
    }

    req.user = user;
    req.sessionId = payload.sessionId;
    next();
  } catch (err) {
    next(err);
  }
}
