/**
 * Enlace ERP - Tratamento Padronizado de Erros (RFC 7807 / API Error Model)
 * PRD 01 - Seção 19 (Padrão consistente de API e Erros)
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Credenciais inválidas ou sessão expirada', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado para esta operação ou recurso', details?: unknown) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class TenantIsolationError extends AppError {
  constructor(message = 'Violação de isolamento multi-tenant detectada', details?: unknown) {
    super(message, 403, 'TENANT_ISOLATION_VIOLATION', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso', details?: unknown) {
    super(`${resource} não encontrado no contexto da empresa ativa`, 404, 'RESOURCE_NOT_FOUND', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos na requisição', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito de estado ou registro duplicado', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}
