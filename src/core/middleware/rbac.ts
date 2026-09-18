/**
 * Enlace ERP - Middleware de Autorização Granular (RBAC)
 * PRD 01 - Seção 14 (Autorização Granular RBAC)
 */

import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../errors/index.js';
import { AuditService } from '../audit/service.js';

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const tenantCtx = req.tenantContext;
    if (!tenantCtx || !tenantCtx.membership) {
      return next(new ForbiddenError('Contexto de empresa ou membresia não carregado.'));
    }

    const { membership, activeCompany, user } = tenantCtx;
    const hasPermission = membership.permissions.includes(permission);

    if (!hasPermission) {
      AuditService.record({
        userId: user?.id,
        userEmail: user?.email,
        companyId: activeCompany?.id,
        companyCnpj: activeCompany?.cnpj,
        schemaNamespace: tenantCtx.schemaNamespace,
        action: 'RBAC_PERMISSION_DENIED',
        resource: req.originalUrl,
        status: 'DENIED',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId,
        details: {
          requiredPermission: permission,
          userRole: membership.role,
        },
      });

      AuditService.recordSecurityEvent({
        type: 'SECURITY_PERMISSION_DENIED',
        severity: 'MEDIUM',
        userId: user?.id,
        userEmail: user?.email,
        companyId: activeCompany?.id,
        schemaNamespace: tenantCtx.schemaNamespace,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId,
        details: {
          requiredPermission: permission,
          userRole: membership.role,
          url: req.originalUrl,
        },
        mitigationTaken: 'Operação bloqueada com HTTP 403 Forbidden.',
      });

      return next(
        new ForbiddenError(`Permissão insuficiente. Operação requer a concessão: '${permission}'.`)
      );
    }

    next();
  };
}
