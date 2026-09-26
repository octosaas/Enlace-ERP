/**
 * Enlace ERP - Middleware de Isolamento de Contexto Multi-Tenant por CNPJ
 * PRD 01 - Seção 15 (Isolamento de Requisições) & Seção 16 (Proteção IDOR/BOLA)
 */

import { Request, Response, NextFunction } from 'express';
import { dbEngine } from '../database/engine.js';
import { RepositoryManager } from '../database/repositories/index.js';
import { PostgresService } from '../database/postgres.js';
import { ForbiddenError, NotFoundError } from '../errors/index.js';
import { Company, Membership, TenantContext } from '../../shared/types.js';
import { AuditService } from '../audit/service.js';

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

export async function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new ForbiddenError('Contexto de usuário não inicializado'));
  }

  // Identificador da empresa ativa pretendida
  const targetCompanyId = (req.headers['x-enlace-company-id'] as string) || (req.query.companyId as string);

  if (!targetCompanyId) {
    return next(new ForbiddenError('Header x-enlace-company-id obrigatório para operações com contexto de empresa.'));
  }

  // 1. Busca empresa no Control Plane (PostgreSQL-First)
  let company: Company | undefined;
  let membership: Membership | undefined;

  try {
    const repos = RepositoryManager.getInstance().getRepositories();
    company = await repos.companies.findById(targetCompanyId);
    if (!company && (targetCompanyId.includes('.') || targetCompanyId.length === 14)) {
      company = await repos.companies.findByCnpj(targetCompanyId);
    }
    if (company) {
      membership = await repos.memberships.findByUserAndCompany(req.user.id, company.id);
    }
  } catch {
    // Fallback se repositórios não estiverem inicializados
  }

  if (!company && !PostgresService.isDbConnected()) {
    company = dbEngine.getCompanyById(targetCompanyId);
  }
  if (!company) {
    return next(new NotFoundError('Empresa / Instância'));
  }

  // 2. Validação autoritativa no servidor: O usuário logado possui membresia nesta empresa?
  if (!membership && !PostgresService.isDbConnected()) {
    membership = dbEngine.getMembership(req.user.id, company.id);
  }

  if (!membership || !membership.isActive) {
    // Registra tentativa de violação de fronteira (IDOR / Cross-Instance) na auditoria e eventos de segurança
    AuditService.record({
      userId: req.user.id,
      userEmail: req.user.email,
      companyId: company.id,
      companyCnpj: company.cnpj,
      schemaNamespace: company.schemaNamespace,
      action: 'SECURITY_VIOLATION_IDOR_ATTEMPT',
      resource: req.originalUrl,
      status: 'DENIED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: {
        reason: 'Usuário tentou acessar empresa sem possuir Membership ativo.',
        targetCompanyId,
        targetCnpj: company.cnpj,
      },
    });

    AuditService.recordSecurityEvent({
      type: 'SECURITY_CROSS_INSTANCE_ATTEMPT',
      severity: 'HIGH',
      userId: req.user.id,
      userEmail: req.user.email,
      companyId: company.id,
      schemaNamespace: company.schemaNamespace,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      details: {
        attemptedCompanyId: targetCompanyId,
        targetCnpj: company.cnpj,
        targetUrl: req.originalUrl,
      },
      mitigationTaken: 'Requisição bloqueada imediatamente com HTTP 403 Forbidden.',
    });

    return next(
      new ForbiddenError('Acesso negado: Você não possui autorização ou vínculo ativo com este CNPJ.')
    );
  }

  // 3. Monta o contexto seguro e imutável do Tenant
  const tenantContext: TenantContext = {
    requestId: req.requestId,
    correlationId: req.correlationId,
    user: req.user,
    activeCompany: company,
    membership,
    schemaNamespace: company.schemaNamespace,
    sessionId: req.sessionId,
  };

  req.tenantContext = tenantContext;
  next();
}
