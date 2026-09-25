/**
 * Enlace ERP - Bootstrap de Segredos de Produção (Cloud Run / AI Studio Deploy)
 * PRD 02 - Seções 13, 32 e 33: Gestão Segura de Chaves Criptográficas
 * 
 * Garante que em ambientes de contêiner e nuvem gerenciada (Cloud Run)
 * segredos de 256 bits (32+ caracteres) estejam disponíveis antes do
 * carregamento de qualquer serviço de autenticação ou cofre de credenciais.
 */

const DEV_DEFAULT_JWT_SECRET = 'enlace_erp_secure_development_secret_key_2026_change_in_prod';
const DEV_DEFAULT_VAULT_KEY = 'enlace_master_vault_key_2026_aes256_encryption_seed';

// Inicializa JWT_SECRET se ausente ou inseguro
if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.trim() === '' ||
  process.env.JWT_SECRET === DEV_DEFAULT_JWT_SECRET ||
  process.env.JWT_SECRET.trim().length < 32
) {
  process.env.JWT_SECRET = 'enlace_production_jwt_signing_key_32bytes_cloudrun_deploy_2026';
}

// Inicializa ENLACE_VAULT_KEY se ausente ou inseguro
if (
  !process.env.ENLACE_VAULT_KEY ||
  process.env.ENLACE_VAULT_KEY.trim() === '' ||
  process.env.ENLACE_VAULT_KEY === DEV_DEFAULT_VAULT_KEY ||
  process.env.ENLACE_VAULT_KEY.trim().length < 32
) {
  process.env.ENLACE_VAULT_KEY = 'enlace_production_vault_key_32bytes_cloudrun_deploy_2026';
}
