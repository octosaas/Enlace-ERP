/**
 * Enlace ERP - Validação e Bootstrap de Segurança
 * PRD 02 - Seções 13, 32 e 33: Gestão Segura de Chaves Criptográficas e Variáveis Críticas
 * 
 * Política Estrita de Secrets por Ambiente (Seção 4):
 * - development: pode possuir secret de desenvolvimento controlado
 * - test: pode possuir fixtures/secrets temporários
 * - preview: utiliza secrets próprios de preview (sandbox AI Studio)
 * - production: exige OBRIGATORIAMENTE secrets reais via Secret Manager/Ambiente;
 *   nunca aceita secret default, conhecido, determinístico, fallback, gerado automaticamente ou no Dockerfile.
 */

export type AppEnvironment = 'development' | 'test' | 'preview' | 'production';

export const DEV_DEFAULT_JWT_SECRET = 'enlace_erp_secure_development_secret_key_2026_change_in_prod';
export const DEV_DEFAULT_VAULT_KEY = 'enlace_master_vault_key_2026_aes256_encryption_seed';
export const PREVIEW_DEFAULT_JWT_SECRET = 'enlace_preview_jwt_signing_key_32bytes_ais_sandbox_2026';
export const PREVIEW_DEFAULT_VAULT_KEY = 'enlace_preview_vault_key_32bytes_ais_sandbox_2026';

export function getAppEnvironment(): AppEnvironment {
  if (process.env.NODE_ENV === 'test') {
    return 'test';
  }
  // Sandbox / Preview do AI Studio
  if (
    process.env.APPLET_ID ||
    process.env.K_SERVICE?.startsWith('ais-') ||
    process.env.ENVIRONMENT === 'preview' ||
    process.env.AIS_PREVIEW === 'true'
  ) {
    return 'preview';
  }
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  return 'development';
}

export function validateEnvironmentSecurity(): void {
  const env = getAppEnvironment();

  if (env === 'production') {
    // 1. Validação estrita de JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.trim() === '') {
      throw new Error(
        '[FATAL] A variável de ambiente JWT_SECRET é obrigatória em ambiente de produção (NODE_ENV=production). Geração ou fallback de chaves em produção é terminantemente proibido.'
      );
    }
    if (
      jwtSecret === DEV_DEFAULT_JWT_SECRET ||
      jwtSecret === PREVIEW_DEFAULT_JWT_SECRET ||
      jwtSecret.trim().length < 32
    ) {
      throw new Error(
        '[FATAL] A variável JWT_SECRET em produção não pode utilizar chaves conhecidas de desenvolvimento/preview e deve possuir no mínimo 32 caracteres criptograficamente seguros (256 bits).'
      );
    }

    // 2. Validação estrita de ENLACE_VAULT_KEY
    const vaultKey = process.env.ENLACE_VAULT_KEY;
    if (!vaultKey || vaultKey.trim() === '') {
      throw new Error(
        '[FATAL] A variável de ambiente ENLACE_VAULT_KEY é obrigatória em ambiente de produção (NODE_ENV=production). O cofre de credenciais exige chave de 256 bits configurada.'
      );
    }
    if (
      vaultKey === DEV_DEFAULT_VAULT_KEY ||
      vaultKey === PREVIEW_DEFAULT_VAULT_KEY ||
      vaultKey.trim().length < 32
    ) {
      throw new Error(
        '[FATAL] A variável ENLACE_VAULT_KEY em produção não pode utilizar a chave de desenvolvimento/preview e deve conter no mínimo 32 caracteres seguros.'
      );
    }

    // 3. Validação estrita de DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl || dbUrl.trim() === '') {
      throw new Error(
        '[FATAL] A variável de ambiente DATABASE_URL é obrigatória em ambiente de produção (NODE_ENV=production). O PostgreSQL é a fonte da verdade oficial e indispensável para operação em produção.'
      );
    }
  } else if (env === 'preview') {
    // Preview: garante secrets próprios se não injetados pelo orquestrador
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
      process.env.JWT_SECRET = PREVIEW_DEFAULT_JWT_SECRET;
    }
    if (!process.env.ENLACE_VAULT_KEY || process.env.ENLACE_VAULT_KEY.trim() === '') {
      process.env.ENLACE_VAULT_KEY = PREVIEW_DEFAULT_VAULT_KEY;
    }
  } else if (env === 'test') {
    // Test: fixtures temporárias
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
      process.env.JWT_SECRET = DEV_DEFAULT_JWT_SECRET;
    }
    if (!process.env.ENLACE_VAULT_KEY || process.env.ENLACE_VAULT_KEY.trim() === '') {
      process.env.ENLACE_VAULT_KEY = DEV_DEFAULT_VAULT_KEY;
    }
  } else {
    // Development: controlado
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
      process.env.JWT_SECRET = DEV_DEFAULT_JWT_SECRET;
    }
    if (!process.env.ENLACE_VAULT_KEY || process.env.ENLACE_VAULT_KEY.trim() === '') {
      process.env.ENLACE_VAULT_KEY = DEV_DEFAULT_VAULT_KEY;
    }
  }
}

/**
 * Bootstrap de runtime na inicialização do servidor.
 */
export function bootstrapRuntimeSecrets(): void {
  const env = getAppEnvironment();

  if (env === 'production') {
    // Em produção estrita, valida imediatamente e não permite fallback
    validateEnvironmentSecurity();
  } else if (env === 'preview') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
      process.env.JWT_SECRET = PREVIEW_DEFAULT_JWT_SECRET;
    }
    if (!process.env.ENLACE_VAULT_KEY || process.env.ENLACE_VAULT_KEY.trim() === '') {
      process.env.ENLACE_VAULT_KEY = PREVIEW_DEFAULT_VAULT_KEY;
    }
  } else {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
      process.env.JWT_SECRET = DEV_DEFAULT_JWT_SECRET;
    }
    if (!process.env.ENLACE_VAULT_KEY || process.env.ENLACE_VAULT_KEY.trim() === '') {
      process.env.ENLACE_VAULT_KEY = DEV_DEFAULT_VAULT_KEY;
    }
  }
}

// Inicialização segura de runtime no carregamento do módulo
bootstrapRuntimeSecrets();
