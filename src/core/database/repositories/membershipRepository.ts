/**
 * Enlace ERP - Membership & RBAC Repository
 * PRD 02: Matriz de Permissões e Vínculos Multi-Tenant
 */

import { Membership, UserRole } from '../../../shared/types.js';
import { ROLE_DEFAULT_PERMISSIONS } from '../../../shared/permissions.js';
import { PostgresService } from '../postgres.js';

export interface IMembershipRepository {
  findByUserAndCompany(userId: string, companyId: string): Promise<Membership | undefined>;
  findById(id: string): Promise<Membership | undefined>;
  listByUser(userId: string): Promise<Membership[]>;
  listByCompany(companyId: string): Promise<Membership[]>;
  create(membership: Membership): Promise<Membership>;
  updateRole(id: string, role: UserRole): Promise<Membership | undefined>;
  delete(id: string): Promise<boolean>;
}

export class PostgresMembershipRepository implements IMembershipRepository {
  async findByUserAndCompany(userId: string, companyId: string): Promise<Membership | undefined> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query(
        'SELECT * FROM cp_memberships WHERE user_id = $1 AND company_id = $2 AND is_active = true LIMIT 1',
        [userId, companyId]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async findById(id: string): Promise<Membership | undefined> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query('SELECT * FROM cp_memberships WHERE id = $1 LIMIT 1', [id]);
      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async listByUser(userId: string): Promise<Membership[]> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query(
        'SELECT * FROM cp_memberships WHERE user_id = $1 AND is_active = true ORDER BY joined_at DESC',
        [userId]
      );
      return res.rows.map((r) => this.mapRow(r));
    });
  }

  async listByCompany(companyId: string): Promise<Membership[]> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query(
        'SELECT * FROM cp_memberships WHERE company_id = $1 ORDER BY joined_at ASC',
        [companyId]
      );
      return res.rows.map((r) => this.mapRow(r));
    });
  }

  async create(membership: Membership): Promise<Membership> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query(
        `INSERT INTO cp_memberships (
          id, user_id, company_id, role, permissions, is_active, joined_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7
        ) RETURNING *`,
        [
          membership.id && membership.id.includes('-') && membership.id.length >= 32 ? membership.id : null,
          membership.userId,
          membership.companyId,
          membership.role,
          JSON.stringify(membership.permissions || ROLE_DEFAULT_PERMISSIONS[membership.role] || []),
          membership.isActive !== false,
          membership.joinedAt || new Date().toISOString(),
        ]
      );
      return this.mapRow(res.rows[0]);
    });
  }

  async updateRole(id: string, role: UserRole): Promise<Membership | undefined> {
    const permissions = ROLE_DEFAULT_PERMISSIONS[role] || [];
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query(
        `UPDATE cp_memberships
         SET role = $1, permissions = $2
         WHERE id = $3
         RETURNING *`,
        [role, JSON.stringify(permissions), id]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async delete(id: string): Promise<boolean> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query('DELETE FROM cp_memberships WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    });
  }

  private mapRow(row: any): Membership {
    return {
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      role: row.role as UserRole,
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
      status: 'ACTIVE',
      isActive: row.is_active,
      joinedAt: row.joined_at ? row.joined_at.toISOString() : new Date().toISOString(),
      createdAt: row.joined_at ? row.joined_at.toISOString() : new Date().toISOString(),
      updatedAt: row.joined_at ? row.joined_at.toISOString() : new Date().toISOString(),
    };
  }
}

export class InMemoryMembershipRepository implements IMembershipRepository {
  constructor(private storage: Map<string, Membership>) {}

  async findByUserAndCompany(userId: string, companyId: string): Promise<Membership | undefined> {
    return Array.from(this.storage.values()).find(
      (m) => m.userId === userId && m.companyId === companyId && m.isActive
    );
  }

  async findById(id: string): Promise<Membership | undefined> {
    return this.storage.get(id);
  }

  async listByUser(userId: string): Promise<Membership[]> {
    return Array.from(this.storage.values()).filter((m) => m.userId === userId && m.isActive);
  }

  async listByCompany(companyId: string): Promise<Membership[]> {
    return Array.from(this.storage.values()).filter((m) => m.companyId === companyId);
  }

  async create(membership: Membership): Promise<Membership> {
    this.storage.set(membership.id, { ...membership });
    return membership;
  }

  async updateRole(id: string, role: UserRole): Promise<Membership | undefined> {
    const existing = this.storage.get(id);
    if (!existing) return undefined;
    const permissions = ROLE_DEFAULT_PERMISSIONS[role] || [];
    const updated = { ...existing, role, permissions, updatedAt: new Date().toISOString() };
    this.storage.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.storage.delete(id);
  }
}
