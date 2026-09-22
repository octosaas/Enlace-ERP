/**
 * Enlace ERP - Session & Refresh Token Repository
 * PRD 02: Sessões Ativas, Detecção de Reuso Anti-Theft e Revogação
 */

import { UserSession, RefreshToken } from '../../../shared/types.js';
import { PostgresService } from '../postgres.js';

export interface ISessionRepository {
  findById(id: string): Promise<UserSession | undefined>;
  create(session: UserSession): Promise<UserSession>;
  revoke(id: string, reason?: string): Promise<void>;
  revokeAllForUser(userId: string, reason?: string): Promise<void>;
  listForUser(userId: string): Promise<UserSession[]>;
  saveRefreshToken(token: RefreshToken): Promise<void>;
  getRefreshToken(tokenHash: string): Promise<RefreshToken | undefined>;
  consumeRefreshToken(tokenHash: string, replacedBy?: string): Promise<void>;
}

export class PostgresSessionRepository implements ISessionRepository {
  async findById(id: string): Promise<UserSession | undefined> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query('SELECT * FROM cp_sessions WHERE id = $1 LIMIT 1', [id]);
      if (res.rows.length === 0) return undefined;
      return this.mapSessionRow(res.rows[0]);
    });
  }

  async create(session: UserSession): Promise<UserSession> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query(
        `INSERT INTO cp_sessions (
          id, user_id, token_hash, ip_address, user_agent, active_company_id,
          expires_at, created_at, last_activity_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          session.id,
          session.userId,
          session.tokenHash,
          session.ipAddress || null,
          session.userAgent || null,
          session.activeCompanyId || null,
          session.expiresAt,
          session.createdAt || new Date().toISOString(),
          session.lastActivityAt || new Date().toISOString(),
        ]
      );
      return this.mapSessionRow(res.rows[0]);
    });
  }

  async revoke(id: string, reason?: string): Promise<void> {
    await PostgresService.withControlPlaneClient(async (client) => {
      await client.query(
        'UPDATE cp_sessions SET revoked_at = NOW(), revoked_reason = $1 WHERE id = $2',
        [reason || 'User logged out', id]
      );
    });
  }

  async revokeAllForUser(userId: string, reason?: string): Promise<void> {
    await PostgresService.withControlPlaneClient(async (client) => {
      await client.query(
        'UPDATE cp_sessions SET revoked_at = NOW(), revoked_reason = $1 WHERE user_id = $2 AND revoked_at IS NULL',
        [reason || 'Revoke all sessions', userId]
      );
    });
  }

  async listForUser(userId: string): Promise<UserSession[]> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query(
        'SELECT * FROM cp_sessions WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return res.rows.map((r) => this.mapSessionRow(r));
    });
  }

  async saveRefreshToken(token: RefreshToken): Promise<void> {
    await PostgresService.withControlPlaneClient(async (client) => {
      await client.query(
        `INSERT INTO cp_refresh_tokens (
          id, token_hash, user_id, session_id, is_consumed, replaced_by_token_hash,
          expires_at, created_at
        ) VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8)`,
        [
          token.id && token.id.includes('-') && token.id.length >= 32 ? token.id : null,
          token.tokenHash,
          token.userId,
          token.sessionId,
          token.isUsed || false,
          token.replacedByTokenHash || null,
          token.expiresAt,
          token.createdAt || new Date().toISOString(),
        ]
      );
    });
  }

  async getRefreshToken(tokenHash: string): Promise<RefreshToken | undefined> {
    return PostgresService.withControlPlaneClient(async (client) => {
      const res = await client.query(
        'SELECT * FROM cp_refresh_tokens WHERE token_hash = $1 LIMIT 1',
        [tokenHash]
      );
      if (res.rows.length === 0) return undefined;
      const r = res.rows[0];
      return {
        id: r.id,
        tokenHash: r.token_hash,
        userId: r.user_id,
        sessionId: r.session_id,
        isRevoked: false,
        isUsed: r.is_consumed,
        replacedByTokenHash: r.replaced_by_token_hash || undefined,
        expiresAt: r.expires_at.toISOString(),
        createdAt: r.created_at.toISOString(),
      };
    });
  }

  async consumeRefreshToken(tokenHash: string, replacedBy?: string): Promise<void> {
    await PostgresService.withControlPlaneClient(async (client) => {
      await client.query(
        'UPDATE cp_refresh_tokens SET is_consumed = true, replaced_by_token_hash = $1 WHERE token_hash = $2',
        [replacedBy || null, tokenHash]
      );
    });
  }

  private mapSessionRow(row: any): UserSession {
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      ipAddress: row.ip_address || '',
      userAgent: row.user_agent || '',
      deviceLabel: 'Browser',
      activeCompanyId: row.active_company_id || undefined,
      isRevoked: Boolean(row.revoked_at),
      expiresAt: row.expires_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      lastActivityAt: row.last_activity_at.toISOString(),
    };
  }
}

export class InMemorySessionRepository implements ISessionRepository {
  constructor(
    private sessions: Map<string, UserSession>,
    private refreshTokens: Map<string, RefreshToken>
  ) {}

  async findById(id: string): Promise<UserSession | undefined> {
    return this.sessions.get(id);
  }

  async create(session: UserSession): Promise<UserSession> {
    this.sessions.set(session.id, { ...session });
    return session;
  }

  async revoke(id: string, reason?: string): Promise<void> {
    const s = this.sessions.get(id);
    if (s) {
      s.isRevoked = true;
    }
  }

  async revokeAllForUser(userId: string, reason?: string): Promise<void> {
    for (const s of this.sessions.values()) {
      if (s.userId === userId) {
        s.isRevoked = true;
      }
    }
  }

  async listForUser(userId: string): Promise<UserSession[]> {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  async saveRefreshToken(token: RefreshToken): Promise<void> {
    this.refreshTokens.set(token.tokenHash, { ...token });
  }

  async getRefreshToken(tokenHash: string): Promise<RefreshToken | undefined> {
    return this.refreshTokens.get(tokenHash);
  }

  async consumeRefreshToken(tokenHash: string, replacedBy?: string): Promise<void> {
    const t = this.refreshTokens.get(tokenHash);
    if (t) {
      t.isUsed = true;
      if (replacedBy) t.replacedByTokenHash = replacedBy;
    }
  }
}
