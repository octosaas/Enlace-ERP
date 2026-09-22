/**
 * Enlace ERP - PostgreSQL Database Seed
 * PRD 01 & PRD 02: Povoamento Inicial Idempotente de Schemas e Control Plane
 */

import bcrypt from 'bcryptjs';
import { PostgresService } from './postgres.js';
import { logger } from '../logger/index.js';
import { ROLE_DEFAULT_PERMISSIONS } from '../../shared/permissions.js';

export class DatabaseSeeder {
  /**
   * Executa o seed idempotente no PostgreSQL caso as tabelas estejam vazias
   */
  static async seed(): Promise<void> {
    if (!PostgresService.isDbConnected()) {
      logger.info('[DatabaseSeeder] Conexão PostgreSQL inativa, pulando seed no banco físico.');
      return;
    }

    try {
      logger.info('[DatabaseSeeder] Verificando e executando seed inicial no PostgreSQL...');
      const passwordHash = await bcrypt.hash('Enlace#2026!Master', 10);

      // 1. Seed do Control Plane (public)
      await PostgresService.withControlPlaneClient(async (client) => {
        // Usuários
        const usersCountRes = await client.query('SELECT COUNT(*) FROM cp_users');
        if (parseInt(usersCountRes.rows[0].count, 10) === 0) {
          logger.info('[DatabaseSeeder] Povoando cp_users...');
          const users = [
            {
              id: 'usr-11111111-1111-4111-8111-111111111111',
              email: 'contador@enlace.com.br',
              name: 'Ana Silva (Contadora Multiempresa)',
              status: 'ACTIVE',
            },
            {
              id: 'usr-22222222-2222-4222-8222-222222222222',
              email: 'carlos@alfa.com.br',
              name: 'Carlos Santos (Diretor Alfa)',
              status: 'ACTIVE',
            },
            {
              id: 'usr-33333333-3333-4333-8333-333333333333',
              email: 'mariana@beta.com.br',
              name: 'Mariana Lima (Operadora Beta)',
              status: 'ACTIVE',
            },
            {
              id: 'usr-44444444-4444-4444-8444-444444444444',
              email: 'suspenso@alfa.com.br',
              name: 'Roberto Bloqueado (Ex-Funcionário)',
              status: 'SUSPENDED',
            },
          ];

          for (const u of users) {
            await client.query(
              `INSERT INTO cp_users (id, email, password_hash, name, status, failed_login_attempts, mfa_enabled, is_platform_admin, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, 0, false, false, NOW(), NOW())
               ON CONFLICT (id) DO NOTHING`,
              [u.id, u.email, passwordHash, u.name, u.status]
            );
          }
        }

        // Empresas
        const companiesCountRes = await client.query('SELECT COUNT(*) FROM cp_companies');
        if (parseInt(companiesCountRes.rows[0].count, 10) === 0) {
          logger.info('[DatabaseSeeder] Povoando cp_companies...');
          const companies = [
            {
              id: 'cmp-aaaa-1111-alfa-000000000001',
              cnpj: '12.345.678/0001-95',
              cleanCnpj: '12345678000195',
              legalName: 'Alfa Serviços Empresariais Ltda',
              tradeName: 'Alfa Soluções',
              segment: 'servicos',
              schemaNamespace: 'tenant_12345678000195',
            },
            {
              id: 'cmp-bbbb-2222-beta-000000000002',
              cnpj: '98.765.432/0001-10',
              cleanCnpj: '98765432000110',
              legalName: 'Beta Soluções e Comércio S/A',
              tradeName: 'Beta Distribuidora',
              segment: 'comercio',
              schemaNamespace: 'tenant_98765432000110',
            },
          ];

          for (const c of companies) {
            await client.query(
              `INSERT INTO cp_companies (id, cnpj, clean_cnpj, legal_name, trade_name, segment, schema_namespace, status, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW())
               ON CONFLICT (id) DO NOTHING`,
              [c.id, c.cnpj, c.cleanCnpj, c.legalName, c.tradeName, c.segment, c.schemaNamespace]
            );
          }
        }

        // Memberships
        const memCountRes = await client.query('SELECT COUNT(*) FROM cp_memberships');
        if (parseInt(memCountRes.rows[0].count, 10) === 0) {
          logger.info('[DatabaseSeeder] Povoando cp_memberships...');
          const memberships = [
            {
              id: 'mem-ana-alfa-01',
              userId: 'usr-11111111-1111-4111-8111-111111111111',
              companyId: 'cmp-aaaa-1111-alfa-000000000001',
              role: 'manager',
            },
            {
              id: 'mem-ana-beta-02',
              userId: 'usr-11111111-1111-4111-8111-111111111111',
              companyId: 'cmp-bbbb-2222-beta-000000000002',
              role: 'viewer',
            },
            {
              id: 'mem-carlos-alfa-03',
              userId: 'usr-22222222-2222-4222-8222-222222222222',
              companyId: 'cmp-aaaa-1111-alfa-000000000001',
              role: 'owner',
            },
            {
              id: 'mem-mariana-beta-04',
              userId: 'usr-33333333-3333-4333-8333-333333333333',
              companyId: 'cmp-bbbb-2222-beta-000000000002',
              role: 'operator',
            },
          ];

          for (const m of memberships) {
            const perms = JSON.stringify(ROLE_DEFAULT_PERMISSIONS[m.role as keyof typeof ROLE_DEFAULT_PERMISSIONS] || []);
            await client.query(
              `INSERT INTO cp_memberships (id, user_id, company_id, role, permissions, is_active, joined_at)
               VALUES ($1, $2, $3, $4, $5, true, NOW())
               ON CONFLICT (id) DO NOTHING`,
              [m.id, m.userId, m.companyId, m.role, perms]
            );
          }
        }
      });

      // 2. Provisionamento e Seed dos Schemas dos Tenants
      const tenantCnpjs = ['12345678000195', '98765432000110'];
      for (const cleanCnpj of tenantCnpjs) {
        await PostgresService.provisionTenantSchema(cleanCnpj);

        await PostgresService.withTenantClient(cleanCnpj, async (client, schemaName) => {
          // Company Settings
          const settingsCount = await client.query(`SELECT COUNT(*) FROM "${schemaName}".company_settings`);
          if (parseInt(settingsCount.rows[0].count, 10) === 0) {
            await client.query(
              `INSERT INTO "${schemaName}".company_settings (id, timezone, currency, document_retention_days, updated_at)
               VALUES (gen_random_uuid(), 'America/Sao_Paulo', 'BRL', 1825, NOW())`
            );
          }

          // Parceiros de Negócio (exemplo para Alfa)
          if (cleanCnpj === '12345678000195') {
            const ptnCount = await client.query(`SELECT COUNT(*) FROM "${schemaName}".partners`);
            if (parseInt(ptnCount.rows[0].count, 10) === 0) {
              logger.info(`[DatabaseSeeder] Povoando parceiros no schema ${schemaName}...`);
              await client.query(
                `INSERT INTO "${schemaName}".partners (
                  id, person_type, document, formatted_document, roles, name, trade_name,
                  email, phone, address, credit_limit, status, notes, created_at, updated_at
                ) VALUES (
                  'ptn-alfa-001', 'PJ', '33000167000101', '33.000.167/0001-01',
                  '["CLIENTE"]', 'Petróleo Brasileiro S.A. - Petrobras', 'Petrobras Corporate',
                  'suprimentos@petrobras.com.br', '(21) 3876-4000',
                  '{"zipCode":"20031-912","street":"Avenida República do Chile","number":"65","neighborhood":"Centro","city":"Rio de Janeiro","state":"RJ"}',
                  500000, 'ATIVO', 'Cliente estratégico corporativo de óleo e gás.', NOW(), NOW()
                ) ON CONFLICT (id) DO NOTHING`
              );
            }

            // Produtos e CMP
            const prodCount = await client.query(`SELECT COUNT(*) FROM "${schemaName}".products`);
            if (parseInt(prodCount.rows[0].count, 10) === 0) {
              logger.info(`[DatabaseSeeder] Povoando catálogo de produtos no schema ${schemaName}...`);
              await client.query(
                `INSERT INTO "${schemaName}".products (
                  id, code, name, item_type, unit_of_measure, sale_price, cost_price, status, created_at, updated_at
                ) VALUES (
                  'prd-alfa-001', 'PRD-0001', 'Servidor Rack 2U Dell PowerEdge', 'PRODUTO', 'UN', 18500, 12000, 'ATIVO', NOW(), NOW()
                ) ON CONFLICT (id) DO NOTHING`
              );
              await client.query(
                `INSERT INTO "${schemaName}".cmp (
                  product_id, current_stock, current_cmp, total_inventory_value, last_movement_at, updated_at
                ) VALUES (
                  'prd-alfa-001', 10, 12000, 120000, NOW(), NOW()
                ) ON CONFLICT (product_id) DO NOTHING`
              );
            }
          }
        });
      }

      logger.info('[DatabaseSeeder] Seed do PostgreSQL executado com sucesso.');
    } catch (err: any) {
      logger.error(`[DatabaseSeeder] Erro ao executar seed no PostgreSQL: ${err.message}`);
    }
  }
}
