/**
 * Enlace ERP - Credential Vault & Secrets Management
 * PRD 02 - Seção 32 (Criptografia) & Seção 33 (Proteção de Credenciais de Terceiros)
 */

import crypto from 'crypto';
import { logger } from '../logger/index.js';

// Chave mestre de criptografia para secrets (32 bytes / 256 bits)
const MASTER_VAULT_KEY = Buffer.from(
  (process.env.ENLACE_VAULT_KEY || 'enlace_master_vault_key_2026_aes256_encryption_seed').padEnd(32, '0').slice(0, 32),
  'utf-8'
);

export interface EncryptedSecretPayload {
  iv: string; // Hex
  tag: string; // Hex (GCM auth tag)
  ciphertext: string; // Hex
  algorithm: 'aes-256-gcm';
  encryptedAt: string;
}

export class CredentialVault {
  /**
   * Criptografa dados sensíveis de integração (ex: client_secret de banco, token do WhatsApp, chave da SEFAZ)
   */
  static encrypt(plaintext: string): EncryptedSecretPayload {
    const iv = crypto.randomBytes(12); // Padrão GCM recomendado: 12 bytes
    const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_VAULT_KEY, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      ciphertext,
      algorithm: 'aes-256-gcm',
      encryptedAt: new Date().toISOString(),
    };
  }

  /**
   * Decriptografa dados sensíveis com verificação da tag GCM de integridade
   */
  static decrypt(payload: EncryptedSecretPayload): string {
    const iv = Buffer.from(payload.iv, 'hex');
    const tag = Buffer.from(payload.tag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_VAULT_KEY, iv);

    decipher.setAuthTag(tag);

    let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Mascara dados confidenciais para exibição segura em telas ou logs
   */
  static mask(value: string): string {
    if (!value || value.length < 8) return '********';
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }
}
