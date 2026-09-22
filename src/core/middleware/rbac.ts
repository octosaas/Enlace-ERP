/**
 * Enlace ERP - Middleware de Autorização Granular (RBAC)
 * PRD 01 - Seção 14 (Autorização Granular RBAC)
 */

import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../errors/index.js';
import { AuditService } from '../audit/service.js';
import { ROLE_DEFAULT_PERMISSIONS } from '../../shared/permissions.js';

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const tenantCtx = req.tenantContext;
    if (!tenantCtx || !tenantCtx.membership) {
      return next(new ForbiddenError('Contexto de empresa ou membresia não carregado.'));
    }

    const { membership, activeCompany, user } = tenantCtx;
    // PRD 02 - Seção 21: OWNER possui autoridade máxima incondicional
    // Suporte a permissões expressas na membership ou herdadas do perfil de papel padrão
    const rolePermissions = ROLE_DEFAULT_PERMISSIONS[membership.role] || [];
    const hasPermission =
      membership.role === 'owner' ||
      membership.permissions?.includes(permission) ||
      rolePermissions.includes(permission);

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
