/**
 * Enlace ERP - User & Identity Repository
 * PRD 02: Gestão de Identidade, Autenticação e Credenciais
 */

import { User } from '../../../shared/types.js';
import { StoredUser } from '../engine.js';
import { PostgresService } from '../postgres.js';

export interface IUserRepository {
  findByEmail(email: string): Promise<StoredUser | undefined>;
  findById(id: string): Promise<StoredUser | undefined>;
  create(user: StoredUser): Promise<StoredUser>;
  update(id: string, updates: Partial<StoredUser>): Promise<StoredUser | undefined>;
  recordLoginFailure(id: string): Promise<{ failedCount: number; isLocked: boolean }>;
  resetLoginFailures(id: string): Promise<void>;
  listAll(): Promise<User[]>;
}

export class PostgresUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<StoredUser | undefined> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query(
        'SELECT * FROM cp_users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [email.trim()]
      );
      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async findById(id: string): Promise<StoredUser | undefined> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query('SELECT * FROM cp_users WHERE id = $1 LIMIT 1', [id]);
      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async create(user: StoredUser): Promise<StoredUser> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query(
        `INSERT INTO cp_users (
          id, email, password_hash, name, is_platform_admin, mfa_enabled, mfa_secret,
          status, failed_login_attempts, locked_until, created_at, updated_at
        ) VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING *`,
        [
          user.id && user.id.includes('-') && user.id.length >= 32 ? user.id : null,
          user.email.toLowerCase().trim(),
          user.passwordHash,
          user.name,
          user.isPlatformAdmin || false,
          user.mfaEnabled || false,
          user.mfaSecret || null,
          user.status || 'ACTIVE',
          user.failedLoginAttempts || 0,
          user.lockoutUntil || null,
          user.createdAt || new Date().toISOString(),
          user.updatedAt || new Date().toISOString(),
        ]
      );
      return this.mapRow(res.rows[0]);
    });
  }

  async update(id: string, updates: Partial<StoredUser>): Promise<StoredUser | undefined> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(updates.name);
      }
      if (updates.passwordHash !== undefined) {
        fields.push(`password_hash = $${idx++}`);
        values.push(updates.passwordHash);
      }
      if (updates.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(updates.status);
      }
      if (updates.mfaEnabled !== undefined) {
        fields.push(`mfa_enabled = $${idx++}`);
        values.push(updates.mfaEnabled);
      }
      if (updates.mfaSecret !== undefined) {
        fields.push(`mfa_secret = $${idx++}`);
        values.push(updates.mfaSecret);
      }
      if (updates.failedLoginAttempts !== undefined) {
        fields.push(`failed_login_attempts = $${idx++}`);
        values.push(updates.failedLoginAttempts);
      }
      if (updates.lockoutUntil !== undefined) {
        fields.push(`locked_until = $${idx++}`);
        values.push(updates.lockoutUntil);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE cp_users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) return undefined;
      return this.mapRow(res.rows[0]);
    });
  }

  async recordLoginFailure(id: string): Promise<{ failedCount: number; isLocked: boolean }> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query(
        `UPDATE cp_users
         SET failed_login_attempts = failed_login_attempts + 1,
             locked_until = CASE WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE locked_until END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING failed_login_attempts, locked_until`,
        [id]
      );
      if (res.rows.length === 0) return { failedCount: 0, isLocked: false };
      const row = res.rows[0];
      const isLocked = row.locked_until ? new Date(row.locked_until) > new Date() : false;
      return { failedCount: row.failed_login_attempts, isLocked };
    });
  }

  async resetLoginFailures(id: string): Promise<void> {
    await PostgresService.withControlPlaneClient(async (client) => {
      await client.query(
        'UPDATE cp_users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1',
        [id]
      );
    });
  }

  async listAll(): Promise<User[]> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query(
        'SELECT id, email, name, is_platform_admin, mfa_enabled, status, failed_login_attempts, created_at, updated_at FROM cp_users ORDER BY name'
      );
      return res.rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        isPlatformAdmin: r.is_platform_admin,
        mfaEnabled: r.mfa_enabled,
        status: r.status,
        failedLoginAttempts: r.failed_login_attempts,
        createdAt: r.created_at?.toISOString() || new Date().toISOString(),
        updatedAt: r.updated_at?.toISOString() || new Date().toISOString(),
      }));
    });
  }

  private mapRow(row: any): StoredUser {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      isPlatformAdmin: row.is_platform_admin,
      mfaEnabled: row.mfa_enabled,
      mfaSecret: row.mfa_secret || undefined,
      status: row.status,
      failedLoginAttempts: row.failed_login_attempts || 0,
      lockoutUntil: row.locked_until ? row.locked_until.toISOString() : undefined,
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
    };
  }
}

export class InMemoryUserRepository implements IUserRepository {
  constructor(private storage: Map<string, StoredUser>) {}

  async findByEmail(email: string): Promise<StoredUser | undefined> {
    const cleanEmail = email.trim().toLowerCase();
    return Array.from(this.storage.values()).find((u) => u.email.toLowerCase() === cleanEmail);
  }

  async findById(id: string): Promise<StoredUser | undefined> {
    return this.storage.get(id);
  }

  async create(user: StoredUser): Promise<StoredUser> {
    this.storage.set(user.id, { ...user });
    return user;
  }

  async update(id: string, updates: Partial<StoredUser>): Promise<StoredUser | undefined> {
    const existing = this.storage.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.storage.set(id, updated);
    return updated;
  }

  async recordLoginFailure(id: string): Promise<{ failedCount: number; isLocked: boolean }> {
    const user = this.storage.get(id);
    if (!user) return { failedCount: 0, isLocked: false };
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    let isLocked = false;
    if (user.failedLoginAttempts >= 5) {
      user.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      isLocked = true;
    }
    return { failedCount: user.failedLoginAttempts, isLocked };
  }

  async resetLoginFailures(id: string): Promise<void> {
    const user = this.storage.get(id);
    if (user) {
      user.failedLoginAttempts = 0;
      user.lockoutUntil = undefined;
    }
  }

  async listAll(): Promise<User[]> {
    return Array.from(this.storage.values()).map(({ passwordHash, mfaSecret, ...user }) => user);
  }
}
