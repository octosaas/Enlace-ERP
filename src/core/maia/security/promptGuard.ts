/**
 * Enlace ERP - MaIA v2 Prompt Guard
 * PRD 02 - Seção 35 (MaIA) & Seção 36 (Controle de Acesso da MaIA)
 * 
 * Defesa em Camadas contra Prompt Injection, Jailbreaks e Vazamentos
 */

import { ValidationError } from '../../errors/index.js';
import { AuditService } from '../../audit/service.js';
import { AIPrincipalContext } from '../types.js';

export class PromptGuard {
  /**
   * Padrões conhecidos de Prompt Injection, Jailbreak e Exfiltração
   */
  private static readonly INJECTION_PATTERNS: RegExp[] = [
    /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    /desconsidere\s+(todas\s+as\s+)?instru[çc][õo]es\s+anteriores/i,
    /system\s+prompt\s+(reveal|leak|show|display|print)/i,
    /revelar\s+(prompt\s+do\s+sistema|instru[çc][õo]es\s+secretas)/i,
    /drop\s+table/i,
    /delete\s+from\s+cp_/i,
    /delete\s+from\s+tenant_/i,
    /truncate\s+table/i,
    /union\s+select/i,
    /tenant_\d{14}/i, // Proíbe injeção de schemas de terceiros diretamente no prompt
    /bypass\s+rbac/i,
    /sudo\s+mode/i,
    /dan\s+mode/i,
    /jailbreak/i,
    /alter\s+table/i,
    /exec\s+xp_/i,
    /information_schema/i,
    /pg_catalog/i,
  ];

  /**
   * Normaliza o texto de entrada removendo caracteres de controle invisíveis,
   * zero-width spaces e tentativas de ofuscação
   */
  static normalizeInput(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // Substitui caracteres de controle
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Valida guardrail contra injeção de prompt
   */
  static validatePromptSafety(prompt: string, context?: AIPrincipalContext): void {
    if (!prompt || typeof prompt !== 'string') return;

    const normalized = this.normalizeInput(prompt);

    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(normalized)) {
        if (context) {
          AuditService.recordSecurityEvent({
            type: 'SECURITY_INJECTION_ATTEMPT',
            severity: 'HIGH',
            userId: context.delegatedUser.id,
            userEmail: context.delegatedUser.email,
            companyId: context.activeCompany.id,
            schemaNamespace: context.activeCompany.schemaNamespace,
            requestId: context.requestId,
            details: {
              principal: context.principalId,
              flaggedPattern: pattern.toString(),
              promptSnippet: normalized.slice(0, 100),
            },
            mitigationTaken: 'Execução de prompt bloqueada por Guardrails de Segurança da MaIA.',
          });
        }

        throw new ValidationError(
          'Comando rejeitado pelos Guardrails de Segurança da MaIA: Padrão não permitido ou tentativa de injeção detectada.'
        );
      }
    }
  }

  /**
   * Envolve dados recuperados do ERP com tags de delimitação seguras
   * para instruir a MaIA a tratá-los estritamente como dados e nunca como comandos.
   */
  static wrapUntrustedData(data: any, label: string = 'erp_data'): string {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    // Escapa qualquer fechamento inadvertido de tag
    const safeData = serialized.replace(new RegExp(`</${label}>`, 'g'), `[ESCAPED_${label}]`);
    return `<untrusted_${label}>\n${safeData}\n</untrusted_${label}>`;
  }
}
