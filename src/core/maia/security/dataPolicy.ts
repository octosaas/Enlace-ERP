/**
 * Enlace ERP - MaIA v2 Data Policy & Redaction
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 */

export class DataPolicy {
  private static readonly SENSITIVE_KEYS = new Set([
    'password',
    'passwordhash',
    'passwordplain',
    'token',
    'refreshtoken',
    'jwt',
    'secret',
    'jwtsecret',
    'vaultkey',
    'totpsecret',
    'privatekey',
    'creditcard',
    'cvv',
    'apikey',
    'clientsecret',
    'accesstoken',
  ]);

  /**
   * Remove recursivamente campos sensíveis e credenciais de qualquer objeto
   * antes que ele seja serializado no contexto da IA
   */
  static sanitizeForAI(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeForAI(item));
    }

    if (typeof obj === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        const isSensitive =
          this.SENSITIVE_KEYS.has(normalizedKey) ||
          normalizedKey.includes('password') ||
          normalizedKey.includes('secret') ||
          normalizedKey.includes('vaultkey') ||
          normalizedKey.includes('apikey');

        if (isSensitive) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          sanitized[key] = this.sanitizeForAI(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Garante isolamento por schema: descarta qualquer registro cujo schema
   * divirja do schema da empresa ativa
   */
  static filterByTenantSchema<T extends Record<string, any>>(
    items: T[],
    activeSchemaNamespace: string
  ): T[] {
    return items.filter((item) => {
      if (item.schemaNamespace && item.schemaNamespace !== activeSchemaNamespace) {
        return false;
      }
      return true;
    });
  }
}
