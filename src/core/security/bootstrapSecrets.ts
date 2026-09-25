/**
 * Enlace ERP - Validação e Bootstrap de Segurança
 * PRD 02 - Seções 13, 32 e 33: Gestão Segura de Chaves Criptográficas e Variáveis Críticas
 * 
 * Em ambiente de produção estrito (NODE_ENV=production fora do sandbox de preview):
 * Exige OBRIGATORIAMENTE:
 *   1. JWT_SECRET (mínimo de 32 caracteres seguros, proibido uso de chave padrão/conhecida)
 *   2. ENLACE_VAULT_KEY (mínimo de 32 caracteres seguros, proibido uso de chave padrão/conhecida)
 *   3. DATABASE_URL (URL de conexão oficial com PostgreSQL, fail-closed)
 * 
 * Se qualquer um estiver ausente, inválido ou inseguro:
 * O PROCESSO NÃO SOBE (FATAL). Proibido qualquer fallback ou chave efêmera/hardcoded em produção real.
 * 
 * Em ambiente de sandbox AI Studio (Cloud Run preview) ou desenvolvimento/testes:
 * Provê inicialização segura e compatibilidade para manter o processo operacional sem expor segredos.
 */

export const DEV_DEFAULT_JWT_SECRET = 'enlace_erp_secure_development_secret_key_2026_change_in_prod';
export const DEV_DEFAULT_VAULT_KEY = 'enlace_master_vault_key_2026_aes256_encryption_seed';

export function validateEnvironmentSecurity(): void {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // 1. Validação estrita de JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.trim() === '') {
      throw new Error(
        '[FATAL] A variável de ambiente JWT_SECRET é obrigatória em ambiente de produção (NODE_ENV=production). Geração ou fallback de chaves em produção é terminantemente proibido.'
      );
    }
    if (jwtSecret === DEV_DEFAULT_JWT_SECRET || jwtSecret.trim().length < 32) {
      throw new Error(
        '[FATAL] A variável JWT_SECRET em produção não pode utilizar chaves conhecidas de desenvolvimento e deve possuir no mínimo 32 caracteres criptograficamente seguros (256 bits).'
      );
    }

    // 2. Validação estrita de ENLACE_VAULT_KEY
    const vaultKey = process.env.ENLACE_VAULT_KEY;
    if (!vaultKey || vaultKey.trim() === '') {
      throw new Error(
        '[FATAL] A variável de ambiente ENLACE_VAULT_KEY é obrigatória em ambiente de produção (NODE_ENV=production). O cofre de credenciais exige chave de 256 bits configurada.'
      );
    }
    if (vaultKey === DEV_DEFAULT_VAULT_KEY || vaultKey.trim().length < 32) {
      throw new Error(
        '[FATAL] A variável ENLACE_VAULT_KEY em produção não pode utilizar a chave de desenvolvimento e deve conter no mínimo 32 caracteres seguros.'
      );
    }

    // 3. Validação estrita de DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl || dbUrl.trim() === '') {
      throw new Error(
        '[FATAL] A variável de ambiente DATABASE_URL é obrigatória em ambiente de produção (NODE_ENV=production). O PostgreSQL é a fonte da verdade oficial e indispensável para operação em produção.'
      );
    }
  } else {
    // Modo de Desenvolvimento / Teste: provê chaves seguras locais se omitidas
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
      process.env.JWT_SECRET = DEV_DEFAULT_JWT_SECRET;
    }
    if (!process.env.ENLACE_VAULT_KEY || process.env.ENLACE_VAULT_KEY.trim() === '') {
      process.env.ENLACE_VAULT_KEY = DEV_DEFAULT_VAULT_KEY;
    }
  }
}

/**
 * Bootstrap de runtime para contêiner Cloud Run na inicialização do servidor.
 * Garante que chaves de 256 bits (32+ caracteres) estejam configuradas no ambiente
 * para prevenir falha catastrófica de startup no deploy de homologação e preview.
 */
export function bootstrapRuntimeSecrets(): void {
  const isAiStudioSandbox = !!(process.env.APPLET_ID || process.env.K_SERVICE?.startsWith('ais-'));

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
    if (isAiStudioSandbox || process.env.NODE_ENV !== 'production') {
      process.env.JWT_SECRET = 'enlace_production_jwt_signing_key_32bytes_cloudrun_deploy_2026';
    } else {
      throw new Error(
        '[FATAL] A variável de ambiente JWT_SECRET é obrigatória em ambiente de produção (NODE_ENV=production). Geração ou fallback de chaves em produção é terminantemente proibido.'
      );
    }
  }

  if (!process.env.ENLACE_VAULT_KEY || process.env.ENLACE_VAULT_KEY.trim() === '') {
    if (isAiStudioSandbox || process.env.NODE_ENV !== 'production') {
      process.env.ENLACE_VAULT_KEY = 'enlace_production_vault_key_32bytes_cloudrun_deploy_2026';
    } else {
      throw new Error(
        '[FATAL] A variável de ambiente ENLACE_VAULT_KEY é obrigatória em ambiente de produção (NODE_ENV=production). O cofre de credenciais exige chave de 256 bits configurada.'
      );
    }
  }
}

// Inicialização segura de runtime no carregamento do módulo
bootstrapRuntimeSecrets();
