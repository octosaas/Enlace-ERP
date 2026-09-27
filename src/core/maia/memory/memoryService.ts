/**
 * Enlace ERP - MaIA v2 Memory Service
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 * 
 * Histórico conversacional estritamente isolado por Tenant, Usuário e Sessão
 */

import { AIMessage } from '../types.js';
import { MemoryPolicy } from './memoryPolicy.js';

interface SessionMemoryEntry {
  messages: AIMessage[];
  lastAccessed: number;
}

export class MemoryService {
  private static instance: MemoryService | null = null;
  private sessions: Map<string, SessionMemoryEntry> = new Map();

  private constructor() {
    setInterval(() => this.cleanupExpired(), 10 * 60 * 1000).unref();
  }

  static getInstance(): MemoryService {
    if (!this.instance) {
      this.instance = new MemoryService();
    }
    return this.instance;
  }

  private buildKey(cleanCnpj: string, userId: string, sessionId: string): string {
    return `${cleanCnpj}:${userId}:${sessionId}`;
  }

  getHistory(cleanCnpj: string, userId: string, sessionId: string): AIMessage[] {
    const key = this.buildKey(cleanCnpj, userId, sessionId);
    const entry = this.sessions.get(key);
    if (!entry) return [];

    entry.lastAccessed = Date.now();
    return [...entry.messages];
  }

  addMessage(cleanCnpj: string, userId: string, sessionId: string, message: AIMessage): void {
    const key = this.buildKey(cleanCnpj, userId, sessionId);
    let entry = this.sessions.get(key);

    if (!entry) {
      entry = { messages: [], lastAccessed: Date.now() };
      this.sessions.set(key, entry);
    }

    entry.lastAccessed = Date.now();
    entry.messages.push({
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
    });

    // Janela deslizante para manter limite seguro de tokens
    if (entry.messages.length > MemoryPolicy.MAX_MESSAGES_PER_SESSION) {
      entry.messages = entry.messages.slice(-MemoryPolicy.MAX_MESSAGES_PER_SESSION);
    }
  }

  clearSession(cleanCnpj: string, userId: string, sessionId: string): void {
    const key = this.buildKey(cleanCnpj, userId, sessionId);
    this.sessions.delete(key);
  }

  private cleanupExpired(): void {
    const cutoff = Date.now() - MemoryPolicy.SESSION_TTL_MINUTES * 60 * 1000;
    for (const [key, entry] of this.sessions.entries()) {
      if (entry.lastAccessed < cutoff) {
        this.sessions.delete(key);
      }
    }
  }
}
