/**
 * Enlace ERP - Serviço de Conexão e Persistência Real PostgreSQL + Drizzle ORM
 * PRD 01 - Seção 5: Isolamento Fisiológico Estrito por Schema ("tenant_<CNPJ>")
 * Stack: Node.js + TypeScript + Drizzle ORM + PostgreSQL 16
 */

import pg from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import { logger } from '../logger/index.js';

const { Pool } = pg;

export class PostgresService {
  private static pool: pg.Pool | null = null;
  private static db: NodePgDatabase<typeof schema> | null = null;
  private static isConnected = false;
  private static connectionAttempted = false;

  /**
   * Obtém a instância do pool ou null se não conectado
   */
  static getPool(): pg.Pool | null {
    return this.pool;
  }

  /**
   * Obtém o cliente Drizzle ORM configurado
   */
  static getDb(): NodePgDatabase<typeof schema> | null {
    return this.db;
  }

  /**
   * Verifica se o banco de dados PostgreSQL está ativo e conectado
   */
  static getStatus(): { isConnected: boolean; databaseUrlConfigured: boolean } {
    return {
      isConnected: this.isConnected,
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    };
  }

  /**
   * Inicializa o pool de conexões com PostgreSQL e valida a conexão
   */
  static async initialize(): Promise<boolean> {
    if (this.connectionAttempted) {
      return this.isConnected;
    }
    this.connectionAttempted = true;

    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      logger.info(
        '[PostgresService] DATABASE_URL não configurada no ambiente. Persistência em memória operando com isolamento estrito por schema.'
      );
      return false;
    }

    try {
      this.pool = new Pool({
        connectionString: databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Valida conectividade com query simples
      const client = await this.pool.connect();
      try {
        const res = await client.query('SELECT version();');
        logger.info(`[PostgresService] Conectado com sucesso ao PostgreSQL: ${res.rows[0].version}`);
      } finally {
        client.release();
      }

      this.db = drizzle(this.pool, { schema });
      this.isConnected = true;

      // Executa DDL inicial do Control Plane
      await this.initializeControlPlane();

      return true;
    } catch (err: any) {
      logger.warn(
        `[PostgresService] Falha ao conectar ao PostgreSQL (${err.message}). Operando em modo de transição/reserva com integridade em memória.`
      );
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Provisiona o Schema dedicado e tabelas físicas para um CNPJ (PRD 01 - Seção 5)
   * Ex: "tenant_12345678000195"
   */
  static async provisionTenantSchema(cleanCnpj: string): Promise<void> {
    if (!this.pool || !this.isConnected) return;

    const schemaName = `tenant_${cleanCnpj.replace(/\D/g, '')}`;

    const client = await this.pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);

      // Cria as tabelas do Tenant dentro do schema isolado
      await client.query(`
        -- 1. Configurações da Empresa
        CREATE TABLE IF NOT EXISTS "${schemaName}".company_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL,
          timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
          currency TEXT NOT NULL DEFAULT 'BRL',
          document_retention_days TEXT NOT NULL DEFAULT '1825',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 2. Trilha de Auditoria
        CREATE TABLE IF NOT EXISTS "${schemaName}".audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          user_id TEXT,
          user_email TEXT,
          action TEXT NOT NULL,
          resource TEXT NOT NULL,
          resource_id TEXT,
          status TEXT NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          request_id TEXT NOT NULL,
          details JSONB
        );

        -- 3. Clientes e Fornecedores
        CREATE TABLE IF NOT EXISTS "${schemaName}".partners (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type TEXT NOT NULL,
          legal_name TEXT NOT NULL,
          trade_name TEXT,
          document_type TEXT NOT NULL,
          document TEXT NOT NULL UNIQUE,
          state_registration TEXT,
          email TEXT,
          phone TEXT,
          address JSONB,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 4. Produtos e Estoque (CMP)
        CREATE TABLE IF NOT EXISTS "${schemaName}".products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'PRODUCT',
          ncm TEXT NOT NULL,
          cfop TEXT NOT NULL,
          unit TEXT NOT NULL DEFAULT 'UN',
          sale_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          cost_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          cmp NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
          stock_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
          min_stock NUMERIC(15, 4) DEFAULT 0.0000,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 5. Vendas
        CREATE TABLE IF NOT EXISTS "${schemaName}".sales (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          number TEXT NOT NULL,
          partner_id UUID NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          quote_id TEXT,
          issue_date TEXT NOT NULL,
          delivery_date TEXT,
          subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          discount NUMERIC(15, 2) DEFAULT 0.00,
          freight NUMERIC(15, 2) DEFAULT 0.00,
          total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          items JSONB NOT NULL,
          payment_terms JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 6. Orçamentos
        CREATE TABLE IF NOT EXISTS "${schemaName}".quotes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          number TEXT NOT NULL,
          partner_id UUID NOT NULL,
          status TEXT NOT NULL DEFAULT 'OPEN',
          issue_date TEXT NOT NULL,
          expiration_date TEXT NOT NULL,
          subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          discount NUMERIC(15, 2) DEFAULT 0.00,
          freight NUMERIC(15, 2) DEFAULT 0.00,
          total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          items JSONB NOT NULL,
          converted_to_sale_id TEXT,
          converted_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 7. Ordens de Serviço
        CREATE TABLE IF NOT EXISTS "${schemaName}".service_orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          number TEXT NOT NULL,
          partner_id UUID NOT NULL,
          status TEXT NOT NULL DEFAULT 'OPEN',
          title TEXT NOT NULL,
          description TEXT,
          labor_cost NUMERIC(15, 2) DEFAULT 0.00,
          parts_cost NUMERIC(15, 2) DEFAULT 0.00,
          total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          services JSONB,
          parts JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 8. Contas a Receber (V2 Desacoplada - PRD PARTE 06)
        CREATE TABLE IF NOT EXISTS "${schemaName}".receivables_v2 (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          instance_id TEXT NOT NULL,
          code TEXT NOT NULL,
          contract_id TEXT,
          billing_id TEXT,
          customer_id TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_document TEXT NOT NULL,
          original_amount NUMERIC(15, 2) NOT NULL,
          balance_amount NUMERIC(15, 2) NOT NULL,
          due_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'OPEN',
          interest_rate_monthly NUMERIC(5, 2) DEFAULT 1.00,
          penalty_rate_percent NUMERIC(5, 2) DEFAULT 2.00,
          penalty_fixed_amount NUMERIC(15, 2) DEFAULT 0.00,
          discount_due_date TEXT,
          discount_amount NUMERIC(15, 2) DEFAULT 0.00,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 9. Cobranças Efêmeras (Collections V2 - PRD PARTE 06)
        CREATE TABLE IF NOT EXISTS "${schemaName}".collections_v2 (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          instance_id TEXT NOT NULL,
          receivable_id UUID NOT NULL REFERENCES "${schemaName}".receivables_v2(id),
          method TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_transaction_id TEXT,
          status TEXT NOT NULL DEFAULT 'PENDING',
          amount NUMERIC(15, 2) NOT NULL,
          due_date TEXT NOT NULL,
          barcode TEXT,
          digitable_line TEXT,
          pix_copy_paste TEXT,
          qr_code_url TEXT,
          paid_at TIMESTAMPTZ,
          canceled_at TIMESTAMPTZ,
          metadata JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 10. Pagamentos e Baixas Financeiras (Payments V2 - PRD PARTE 06)
        CREATE TABLE IF NOT EXISTS "${schemaName}".payments_v2 (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          instance_id TEXT NOT NULL,
          collection_id UUID NOT NULL REFERENCES "${schemaName}".collections_v2(id),
          receivable_id UUID NOT NULL REFERENCES "${schemaName}".receivables_v2(id),
          amount_paid NUMERIC(15, 2) NOT NULL,
          interest_paid NUMERIC(15, 2) DEFAULT 0.00,
          penalty_paid NUMERIC(15, 2) DEFAULT 0.00,
          discount_applied NUMERIC(15, 2) DEFAULT 0.00,
          payment_date TEXT NOT NULL,
          channel TEXT NOT NULL,
          treasury_account_id TEXT,
          idempotency_hash TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 11. Provedores de Pagamento Criptografados por Tenant (PRD PARTE 06)
        CREATE TABLE IF NOT EXISTS "${schemaName}".payment_providers_v2 (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          instance_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          environment TEXT NOT NULL DEFAULT 'SANDBOX',
          encrypted_credentials JSONB NOT NULL,
          webhook_secret TEXT,
          supported_methods JSONB NOT NULL,
          is_default BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 12. Eventos de Webhook Idempotentes (PRD PARTE 06)
        CREATE TABLE IF NOT EXISTS "${schemaName}".webhook_events_v2 (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          instance_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          event_hash TEXT NOT NULL UNIQUE,
          event_type TEXT NOT NULL,
          payload JSONB NOT NULL,
          status TEXT NOT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          processed_at TIMESTAMPTZ,
          error_message TEXT
        );

        -- 13. Contas a Pagar (Obrigações Financeiras de Compras)
        CREATE TABLE IF NOT EXISTS "${schemaName}".accounts_payable (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code TEXT NOT NULL,
          supplier_id TEXT NOT NULL,
          supplier_name TEXT NOT NULL,
          supplier_document TEXT NOT NULL,
          source_type TEXT NOT NULL DEFAULT 'INBOUND_INVOICE',
          source_id TEXT,
          amount NUMERIC(15, 2) NOT NULL,
          balance_amount NUMERIC(15, 2) NOT NULL,
          due_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'OPEN',
          description TEXT,
          paid_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      logger.info(`[PostgresService] Schema dedicado "${schemaName}" provisionado com sucesso.`);
    } finally {
      client.release();
    }
  }

  /**
   * Provisiona o Control Plane no schema public (PRD 01 - Seção 4)
   */
  private static async initializeControlPlane(): Promise<void> {
    if (!this.pool) return;

    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";

        CREATE TABLE IF NOT EXISTS cp_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          is_platform_admin BOOLEAN NOT NULL DEFAULT false,
          mfa_enabled BOOLEAN NOT NULL DEFAULT false,
          mfa_secret TEXT,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          failed_login_attempts INT NOT NULL DEFAULT 0,
          locked_until TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cp_companies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          cnpj TEXT NOT NULL UNIQUE,
          clean_cnpj TEXT NOT NULL UNIQUE,
          legal_name TEXT NOT NULL,
          trade_name TEXT NOT NULL,
          segment TEXT NOT NULL,
          schema_namespace TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'active',
          state_registration TEXT,
          municipal_registration TEXT,
          state TEXT DEFAULT 'MA',
          city TEXT DEFAULT 'São Luís',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cp_memberships (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES cp_users(id),
          company_id UUID NOT NULL REFERENCES cp_companies(id),
          role TEXT NOT NULL,
          permissions JSONB NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cp_company_modules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL REFERENCES cp_companies(id),
          module_code TEXT NOT NULL,
          is_enabled BOOLEAN NOT NULL DEFAULT false,
          activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cp_sessions (
          id TEXT PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES cp_users(id),
          token_hash TEXT NOT NULL UNIQUE,
          ip_address TEXT,
          user_agent TEXT,
          active_company_id UUID,
          expires_at TIMESTAMPTZ NOT NULL,
          revoked_at TIMESTAMPTZ,
          revoked_reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cp_refresh_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          token_hash TEXT NOT NULL UNIQUE,
          user_id UUID NOT NULL REFERENCES cp_users(id),
          session_id TEXT NOT NULL,
          is_consumed BOOLEAN NOT NULL DEFAULT false,
          replaced_by_token_hash TEXT,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cp_security_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type TEXT NOT NULL,
          severity TEXT NOT NULL,
          user_id TEXT,
          user_email TEXT,
          company_id TEXT,
          schema_namespace TEXT,
          request_id TEXT,
          details JSONB,
          mitigation_taken TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      logger.info('[PostgresService] Tabelas globais do Control Plane inicializadas com sucesso.');
    } finally {
      client.release();
    }
  }

  /**
   * Encerra o pool de conexões (usado em testes ou shutdown)
   */
  static async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.db = null;
      this.isConnected = false;
      this.connectionAttempted = false;
    }
  }
}
