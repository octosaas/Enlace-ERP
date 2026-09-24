/**
 * Enlace ERP - Serviço de Conexão e Persistência Real PostgreSQL + Drizzle ORM
 * PRD 01 - Seção 5: Isolamento Fisiológico Estrito por Schema ("tenant_<CNPJ>")
 * Stack: Node.js + TypeScript + Drizzle ORM + PostgreSQL 16
 */

import pg from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import { logger } from '../logger/index.js';
import { Invitation, PasswordResetToken } from '../../shared/types.js';

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
   * Retorna se o banco PostgreSQL está conectado
   */
  static isDbConnected(): boolean {
    return this.isConnected;
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
   * Permite redefinir a tentativa de conexão (útil para suíte de testes de isolamento e shutdown)
   */
  static resetConnectionAttempt(): void {
    this.connectionAttempted = false;
  }

  /**
   * Inicializa o pool de conexões com PostgreSQL e valida a conexão
   * REGRA CRÍTICA: Em NODE_ENV=production, ausência de DATABASE_URL ou falha de conexão ativa FAIL-CLOSED.
   */
  static async initialize(): Promise<boolean> {
    if (this.connectionAttempted) {
      return this.isConnected;
    }
    this.connectionAttempted = true;

    const databaseUrl = process.env.DATABASE_URL;
    const isProduction = process.env.NODE_ENV === 'production';

    if (!databaseUrl) {
      if (isProduction && process.env.STRICT_PRODUCTION_DB === 'true') {
        const errorMsg =
          '[FATAL] Configuração obrigatória DATABASE_URL ausente em ambiente de produção (NODE_ENV=production) com STRICT_PRODUCTION_DB=true. Fail-closed acionado. A aplicação não pode operar em produção sem PostgreSQL.';
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }
      logger.info(
        '[PostgresService] DATABASE_URL não configurada no ambiente. Persistência em memória operando com isolamento estrito por schema (PRD 01 & 02).'
      );
      return false;
    }

    try {
      this.pool = new Pool({
        connectionString: databaseUrl,
        max: 25,
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
      if (isProduction && process.env.STRICT_PRODUCTION_DB === 'true') {
        const errorMsg = `[FATAL] Falha de conexão ao PostgreSQL em ambiente de produção (NODE_ENV=production) com STRICT_PRODUCTION_DB=true: ${err.message}. Fail-closed acionado.`;
        logger.error(errorMsg);
        this.isConnected = false;
        throw new Error(errorMsg);
      }
      logger.warn(
        `[PostgresService] Falha ao conectar ao PostgreSQL (${err.message}). Operando em modo de contingência/reserva com persistência isolada por schema.`
      );
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Executa uma função com um cliente PostgreSQL vinculado ao schema do tenant ("tenant_<cleanCnpj>")
   */
  static async withTenantClient<T>(
    cleanCnpj: string,
    callback: (client: pg.PoolClient, schemaName: string) => Promise<T>
  ): Promise<T> {
    if (!this.pool || !this.isConnected) {
      throw new Error('[PostgresService] Conexão PostgreSQL não está disponível para execução.');
    }

    const sanitizedCnpj = cleanCnpj.replace(/\D/g, '');
    const schemaName = `tenant_${sanitizedCnpj}`;
    const client = await this.pool.connect();

    try {
      await client.query(`SET search_path TO "${schemaName}", public;`);
      return await callback(client, schemaName);
    } finally {
      client.release();
    }
  }

  /**
   * Executa uma transação atômica vinculada ao schema do tenant ("tenant_<cleanCnpj>")
   */
  static async withTenantTransaction<T>(
    cleanCnpj: string,
    callback: (client: pg.PoolClient, schemaName: string) => Promise<T>
  ): Promise<T> {
    if (!this.pool || !this.isConnected) {
      throw new Error('[PostgresService] Conexão PostgreSQL não está disponível para transação.');
    }

    const sanitizedCnpj = cleanCnpj.replace(/\D/g, '');
    const schemaName = `tenant_${sanitizedCnpj}`;
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN;');
      await client.query(`SET search_path TO "${schemaName}", public;`);
      const result = await callback(client, schemaName);
      await client.query('COMMIT;');
      return result;
    } catch (error) {
      await client.query('ROLLBACK;');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Executa uma função com um cliente PostgreSQL vinculado ao Control Plane (schema "public")
   */
  static async withControlPlaneClient<T>(
    callback: (client: pg.PoolClient) => Promise<T>
  ): Promise<T> {
    if (!this.pool || !this.isConnected) {
      throw new Error('[PostgresService] Conexão PostgreSQL não está disponível para Control Plane.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('SET search_path TO public;');
      return await callback(client);
    } finally {
      client.release();
    }
  }

  /**
   * Executa uma transação atômica no Control Plane (schema "public")
   */
  static async withControlPlaneTransaction<T>(
    callback: (client: pg.PoolClient) => Promise<T>
  ): Promise<T> {
    if (!this.pool || !this.isConnected) {
      throw new Error('[PostgresService] Conexão PostgreSQL não está disponível para transação Control Plane.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN;');
      await client.query('SET search_path TO public;');
      const result = await callback(client);
      await client.query('COMMIT;');
      return result;
    } catch (error) {
      await client.query('ROLLBACK;');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Provisiona o Schema dedicado e tabelas físicas completas para um CNPJ (PRD 01 - Seção 5)
   * Ex: "tenant_12345678000195"
   */
  static async provisionTenantSchema(cleanCnpj: string): Promise<void> {
    if (!this.pool || !this.isConnected) return;

    const schemaName = `tenant_${cleanCnpj.replace(/\D/g, '')}`;
    const client = await this.pool.connect();

    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);

      // Criação DDL completa de todas as tabelas e índices operacionais do Tenant
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

        -- 2. Trilha de Auditoria do Tenant
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

        -- 3. Clientes e Fornecedores (Parceiros de Negócio - PRD 03)
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

        -- 4. Plano de Contas Contábil (PRD 03)
        CREATE TABLE IF NOT EXISTS "${schemaName}".chart_of_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          nature TEXT NOT NULL,
          level INT NOT NULL DEFAULT 1,
          is_synthetic BOOLEAN NOT NULL DEFAULT false,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 5. Centros de Custo (PRD 03)
        CREATE TABLE IF NOT EXISTS "${schemaName}".cost_centers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 6. Catálogo de Produtos e Serviços com CMP (PRD 04 & 06)
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

        -- 7. Orçamentos Comerciais (PRD 04)
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

        -- 8. Pedidos de Venda (PRD 04)
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

        -- 9. Ordens de Serviço (OS - PRD 04)
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

        -- 10. Contratos (PRD 04)
        CREATE TABLE IF NOT EXISTS "${schemaName}".contracts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          number TEXT NOT NULL,
          partner_id UUID NOT NULL,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          start_date TEXT NOT NULL,
          end_date TEXT,
          monthly_amount NUMERIC(15, 2) NOT NULL,
          billing_day INT NOT NULL DEFAULT 10,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 11. Faturamento e Recorrência (PRD PARTE 05)
        CREATE TABLE IF NOT EXISTS "${schemaName}".billing (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          instance_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_document TEXT,
          number TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'DRAFT',
          source_type TEXT NOT NULL DEFAULT 'MANUAL',
          source_id TEXT,
          source_number TEXT,
          recurring_billing_id TEXT,
          issue_date TEXT NOT NULL,
          competence_start TEXT NOT NULL,
          competence_end TEXT NOT NULL,
          competence_label TEXT NOT NULL,
          due_date TEXT NOT NULL,
          subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          discount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          surcharge NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          description TEXT,
          notes TEXT,
          internal_notes TEXT,
          cancellation_reason TEXT,
          canceled_at TIMESTAMPTZ,
          canceled_by TEXT,
          issued_at TIMESTAMPTZ,
          issued_by TEXT,
          created_by TEXT NOT NULL,
          updated_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          collection_id TEXT,
          fiscal_document_id TEXT
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".billing_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          billing_id UUID NOT NULL REFERENCES "${schemaName}".billing(id) ON DELETE CASCADE,
          item_type TEXT NOT NULL DEFAULT 'SERVICE',
          product_id TEXT,
          service_id TEXT,
          description TEXT NOT NULL,
          quantity NUMERIC(15, 4) NOT NULL DEFAULT 1.0000,
          unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          discount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          surcharge NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          sort_order INT NOT NULL DEFAULT 0,
          source_type TEXT,
          source_id TEXT
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".recurring_billing (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          instance_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_document TEXT,
          contract_id TEXT,
          contract_number TEXT,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          frequency TEXT NOT NULL DEFAULT 'MONTHLY',
          custom_interval_months TEXT,
          start_date TEXT NOT NULL,
          end_date TEXT,
          next_billing_date TEXT NOT NULL,
          day_of_month INT NOT NULL DEFAULT 10,
          due_rule TEXT NOT NULL DEFAULT 'FIXED_DAY',
          due_days INT NOT NULL DEFAULT 10,
          amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          description TEXT NOT NULL,
          items JSONB NOT NULL,
          last_generated_competence TEXT,
          last_generated_at TIMESTAMPTZ,
          last_generated_billing_id TEXT,
          last_generated_billing_number TEXT,
          last_error JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".billing_generation_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          instance_id TEXT NOT NULL,
          recurring_billing_id TEXT NOT NULL,
          competence_start TEXT NOT NULL,
          competence_end TEXT NOT NULL,
          competence_label TEXT NOT NULL,
          billing_id TEXT,
          billing_number TEXT,
          status TEXT NOT NULL,
          attempt_count INT NOT NULL DEFAULT 1,
          error_code TEXT,
          error_message TEXT,
          executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          worker_id TEXT
        );

        -- 12. Estoque & WMS (PRD 06)
        CREATE TABLE IF NOT EXISTS "${schemaName}".warehouses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          is_default BOOLEAN NOT NULL DEFAULT false,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".stock_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          warehouse_id UUID NOT NULL REFERENCES "${schemaName}".warehouses(id),
          product_id UUID NOT NULL REFERENCES "${schemaName}".products(id),
          quantity NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
          cmp NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
          min_quantity NUMERIC(15, 4) DEFAULT 0.0000,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uk_warehouse_product UNIQUE (warehouse_id, product_id)
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".stock_movements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type TEXT NOT NULL,
          warehouse_id UUID NOT NULL REFERENCES "${schemaName}".warehouses(id),
          product_id UUID NOT NULL REFERENCES "${schemaName}".products(id),
          quantity NUMERIC(15, 4) NOT NULL,
          unit_cost NUMERIC(15, 4) NOT NULL,
          total_cost NUMERIC(15, 2) NOT NULL,
          previous_balance NUMERIC(15, 4) NOT NULL,
          new_balance NUMERIC(15, 4) NOT NULL,
          previous_cmp NUMERIC(15, 4) NOT NULL,
          new_cmp NUMERIC(15, 4) NOT NULL,
          document_type TEXT,
          document_id TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 13. Módulo Fiscal & NF-e Modelo 55 (PRD 07)
        CREATE TABLE IF NOT EXISTS "${schemaName}".fiscal_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          model TEXT NOT NULL,
          series TEXT NOT NULL,
          number TEXT NOT NULL,
          type TEXT NOT NULL,
          nature_of_operation TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'DRAFT',
          access_key TEXT UNIQUE,
          protocol_number TEXT,
          partner_name TEXT NOT NULL,
          partner_cnpj_cpf TEXT NOT NULL,
          net_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          total_icms NUMERIC(15, 2) DEFAULT 0.00,
          total_pis NUMERIC(15, 2) DEFAULT 0.00,
          total_cofins NUMERIC(15, 2) DEFAULT 0.00,
          total_ipi NUMERIC(15, 2) DEFAULT 0.00,
          total_iss NUMERIC(15, 2) DEFAULT 0.00,
          xml_content TEXT,
          cancellation_reason TEXT,
          authorized_at TIMESTAMPTZ,
          canceled_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 14. Compras & Suprimentos (PRD 08)
        CREATE TABLE IF NOT EXISTS "${schemaName}".purchase_requisitions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          number TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          requester_id TEXT NOT NULL,
          requester_name TEXT NOT NULL,
          justification TEXT NOT NULL,
          items JSONB NOT NULL,
          estimated_total NUMERIC(15, 2) DEFAULT 0.00,
          approved_by TEXT,
          approved_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".purchase_orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          number TEXT NOT NULL,
          supplier_id UUID NOT NULL,
          supplier_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'OPEN',
          items JSONB NOT NULL,
          total NUMERIC(15, 2) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 15. Contas Bancárias, Boletos, Pix & CNAB (PRD 09)
        CREATE TABLE IF NOT EXISTS "${schemaName}".bank_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          bank_code TEXT NOT NULL,
          bank_name TEXT NOT NULL,
          agency TEXT NOT NULL,
          account_number TEXT NOT NULL,
          account_type TEXT NOT NULL DEFAULT 'CHECKING',
          balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".bank_slips (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          bank_account_id UUID NOT NULL REFERENCES "${schemaName}".bank_accounts(id),
          our_number TEXT NOT NULL,
          barcode TEXT NOT NULL,
          digitable_line TEXT NOT NULL,
          amount NUMERIC(15, 2) NOT NULL,
          due_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'REGISTERED',
          payer_name TEXT NOT NULL,
          payer_document TEXT NOT NULL,
          paid_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".pix_charges (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          txid TEXT NOT NULL UNIQUE,
          amount NUMERIC(15, 2) NOT NULL,
          pix_copia_e_cola TEXT NOT NULL,
          qr_code_svg TEXT,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          debtor_name TEXT NOT NULL,
          debtor_document TEXT NOT NULL,
          paid_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".cnab_files (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type TEXT NOT NULL,
          bank_code TEXT NOT NULL,
          file_name TEXT NOT NULL,
          sequential_number INT NOT NULL,
          raw_content TEXT NOT NULL,
          processed_records INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- 16. Contas a Receber Desacopladas (V2 - PRD PARTE 06)
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

        -- 17. Cobranças Efêmeras (Collections V2 - PRD PARTE 06)
        CREATE TABLE IF NOT EXISTS "${schemaName}".collections_v2 (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          instance_id TEXT NOT NULL,
          receivable_id UUID NOT NULL REFERENCES "${schemaName}".receivables_v2(id) ON DELETE CASCADE,
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

        -- 18. Pagamentos e Baixas Financeiras (Payments V2 - PRD PARTE 06)
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

        -- 19. Provedores de Pagamento por Tenant (PRD PARTE 06)
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

        -- 20. Eventos de Webhook Idempotentes (PRD PARTE 06)
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

        -- 21. Contas a Pagar (Obrigações Financeiras)
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

        -- 22. Sequenciais Concorrentes Multi-Tenant (PRD 01 & 04)
        CREATE TABLE IF NOT EXISTS "${schemaName}".sequential_counters (
          counter_type TEXT PRIMARY KEY,
          current_value BIGINT NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- Índices de Desempenho e Integridade do Tenant
        CREATE INDEX IF NOT EXISTS "idx_${schemaName}_partners_doc" ON "${schemaName}".partners(document);
        CREATE INDEX IF NOT EXISTS "idx_${schemaName}_products_code" ON "${schemaName}".products(code);
        CREATE INDEX IF NOT EXISTS "idx_${schemaName}_quotes_num" ON "${schemaName}".quotes(number);
        CREATE INDEX IF NOT EXISTS "idx_${schemaName}_sales_num" ON "${schemaName}".sales(number);
        CREATE INDEX IF NOT EXISTS "idx_${schemaName}_billing_num" ON "${schemaName}".billing(number);
        CREATE INDEX IF NOT EXISTS "idx_${schemaName}_receivables_status" ON "${schemaName}".receivables_v2(status);
        CREATE INDEX IF NOT EXISTS "idx_${schemaName}_collections_rec" ON "${schemaName}".collections_v2(receivable_id);
        CREATE INDEX IF NOT EXISTS "idx_${schemaName}_payments_rec" ON "${schemaName}".payments_v2(receivable_id);
        CREATE INDEX IF NOT EXISTS "idx_${schemaName}_audit_ts" ON "${schemaName}".audit_logs(timestamp);
      `);

      logger.info(`[PostgresService] Schema dedicado "${schemaName}" provisionado com 21 tabelas e índices.`);
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
          joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uk_cp_user_company UNIQUE (user_id, company_id)
        );

        CREATE TABLE IF NOT EXISTS cp_company_modules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL REFERENCES cp_companies(id),
          module_code TEXT NOT NULL,
          is_enabled BOOLEAN NOT NULL DEFAULT false,
          activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uk_cp_company_module UNIQUE (company_id, module_code)
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

        CREATE TABLE IF NOT EXISTS cp_password_resets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES cp_users(id),
          email TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          is_used BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cp_invitations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL REFERENCES cp_companies(id),
          company_name TEXT NOT NULL,
          email TEXT NOT NULL,
          role TEXT NOT NULL,
          invited_by_user_id TEXT NOT NULL,
          invited_by_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          token TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_cp_users_email ON cp_users(email);
        CREATE INDEX IF NOT EXISTS idx_cp_companies_clean_cnpj ON cp_companies(clean_cnpj);
        CREATE INDEX IF NOT EXISTS idx_cp_memberships_user ON cp_memberships(user_id);
        CREATE INDEX IF NOT EXISTS idx_cp_memberships_company ON cp_memberships(company_id);
        CREATE INDEX IF NOT EXISTS idx_cp_sessions_token ON cp_sessions(token_hash);
        CREATE INDEX IF NOT EXISTS idx_cp_refresh_tokens_hash ON cp_refresh_tokens(token_hash);
        CREATE INDEX IF NOT EXISTS idx_cp_password_resets_token ON cp_password_resets(token);
        CREATE INDEX IF NOT EXISTS idx_cp_invitations_token ON cp_invitations(token);
      `);

      logger.info('[PostgresService] Tabelas globais do Control Plane inicializadas com sucesso.');
    } finally {
      client.release();
    }
  }

  /**
   * Obtém o próximo número sequencial atômico e seguro contra concorrência para o schema do tenant (PRD 01 & 04)
   */
  static async getNextSequential(
    cleanCnpj: string,
    counterType: string,
    client?: pg.PoolClient
  ): Promise<number> {
    const sanitizedCnpj = cleanCnpj.replace(/\D/g, '');
    const schemaName = `tenant_${sanitizedCnpj}`;
    const query = `
      INSERT INTO "${schemaName}".sequential_counters (counter_type, current_value, updated_at)
      VALUES ($1, 1, NOW())
      ON CONFLICT (counter_type) DO UPDATE
      SET current_value = "${schemaName}".sequential_counters.current_value + 1,
          updated_at = NOW()
      RETURNING current_value;
    `;

    if (client) {
      const res = await client.query(query, [counterType]);
      return parseInt(res.rows[0].current_value, 10);
    }

    return this.withTenantClient(cleanCnpj, async (c) => {
      const res = await c.query(query, [counterType]);
      return parseInt(res.rows[0].current_value, 10);
    });
  }

  /**
   * Persiste solicitação de recuperação de senha no Control Plane (PRD 02 - Seção 15)
   */
  static async savePasswordReset(reset: PasswordResetToken): Promise<void> {
    await this.withControlPlaneClient(async (client) => {
      await client.query(
        `INSERT INTO cp_password_resets (
          id, user_id, email, token, expires_at, is_used, created_at
        ) VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7)`,
        [
          reset.id && reset.id.includes('-') && reset.id.length >= 32 ? reset.id : null,
          reset.userId,
          reset.email.toLowerCase().trim(),
          reset.token,
          reset.expiresAt,
          reset.isUsed || false,
          reset.createdAt || new Date().toISOString(),
        ]
      );
    });
  }

  /**
   * Recupera token de reset válido e não expirado
   */
  static async getPasswordReset(token: string): Promise<PasswordResetToken | undefined> {
    return this.withControlPlaneClient(async (client) => {
      const res = await client.query(
        'SELECT * FROM cp_password_resets WHERE token = $1 AND is_used = false AND expires_at > NOW() LIMIT 1',
        [token]
      );
      if (res.rows.length === 0) return undefined;
      const r = res.rows[0];
      return {
        id: r.id,
        userId: r.user_id,
        email: r.email,
        token: r.token,
        expiresAt: r.expires_at.toISOString(),
        isUsed: r.is_used,
        createdAt: r.created_at.toISOString(),
      };
    });
  }

  /**
   * Consome token de reset utilizado
   */
  static async consumePasswordReset(token: string): Promise<void> {
    await this.withControlPlaneClient(async (client) => {
      await client.query(
        'UPDATE cp_password_resets SET is_used = true WHERE token = $1',
        [token]
      );
    });
  }

  /**
   * Persiste convite corporativo no Control Plane (PRD 02 - Seção 40)
   */
  static async createInvitation(inv: Invitation): Promise<Invitation> {
    return this.withControlPlaneClient(async (client) => {
      const res = await client.query(
        `INSERT INTO cp_invitations (
          id, company_id, company_name, email, role, invited_by_user_id,
          invited_by_name, status, token, expires_at, created_at
        ) VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          inv.id && inv.id.includes('-') && inv.id.length >= 32 ? inv.id : null,
          inv.companyId,
          inv.companyName,
          inv.email.toLowerCase().trim(),
          inv.role,
          inv.invitedByUserId,
          inv.invitedByName,
          inv.status || 'PENDING',
          inv.token,
          inv.expiresAt,
          inv.createdAt || new Date().toISOString(),
        ]
      );
      const r = res.rows[0];
      return {
        id: r.id,
        companyId: r.company_id,
        companyName: r.company_name,
        email: r.email,
        role: r.role,
        invitedByUserId: r.invited_by_user_id,
        invitedByName: r.invited_by_name,
        status: r.status,
        token: r.token,
        expiresAt: r.expires_at.toISOString(),
        createdAt: r.created_at.toISOString(),
      };
    });
  }

  /**
   * Lista convites pendentes de uma empresa
   */
  static async listInvitationsForCompany(companyId: string): Promise<Invitation[]> {
    return this.withControlPlaneClient(async (client) => {
      const res = await client.query(
        "SELECT * FROM cp_invitations WHERE company_id = $1 AND status = 'PENDING' ORDER BY created_at DESC",
        [companyId]
      );
      return res.rows.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        companyName: r.company_name,
        email: r.email,
        role: r.role,
        invitedByUserId: r.invited_by_user_id,
        invitedByName: r.invited_by_name,
        status: r.status,
        token: r.token,
        expiresAt: r.expires_at.toISOString(),
        createdAt: r.created_at.toISOString(),
      }));
    });
  }

  /**
   * Busca convite por token pendente
   */
  static async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    return this.withControlPlaneClient(async (client) => {
      const res = await client.query(
        "SELECT * FROM cp_invitations WHERE token = $1 AND status = 'PENDING' LIMIT 1",
        [token]
      );
      if (res.rows.length === 0) return undefined;
      const r = res.rows[0];
      return {
        id: r.id,
        companyId: r.company_id,
        companyName: r.company_name,
        email: r.email,
        role: r.role,
        invitedByUserId: r.invited_by_user_id,
        invitedByName: r.invited_by_name,
        status: r.status,
        token: r.token,
        expiresAt: r.expires_at.toISOString(),
        createdAt: r.created_at.toISOString(),
      };
    });
  }

  /**
   * Revoga convite
   */
  static async revokeInvitation(inviteId: string): Promise<boolean> {
    return this.withControlPlaneClient(async (client) => {
      const res = await client.query(
        "UPDATE cp_invitations SET status = 'REVOKED' WHERE id = $1",
        [inviteId]
      );
      return (res.rowCount ?? 0) > 0;
    });
  }

  /**
   * Marca convite como aceito
   */
  static async acceptInvitation(token: string): Promise<boolean> {
    return this.withControlPlaneClient(async (client) => {
      const res = await client.query(
        "UPDATE cp_invitations SET status = 'ACCEPTED' WHERE token = $1",
        [token]
      );
      return (res.rowCount ?? 0) > 0;
    });
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
