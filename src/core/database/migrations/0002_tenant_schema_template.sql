-- ============================================================================
-- ENLACE ERP - MIGRATION 0002: TENANT SCHEMA TABLES TEMPLATE
-- PRD 01 ao PRD 09 & PRD PARTE 05 e 06
--
-- NOTA ARQUITETURAL:
-- Este script define o conjunto completo de tabelas físicas isoladas criadas
-- dinamicamente no schema "tenant_<CNPJ>" de cada empresa contratante.
-- Cada novo CNPJ cadastrado executa esta DDL em seu próprio schema físico.
-- ============================================================================

-- Função utilitária para provisionar um novo schema de CNPJ no PostgreSQL
CREATE OR REPLACE FUNCTION provision_enlace_tenant(clean_cnpj TEXT)
RETURNS VOID AS $$
DECLARE
    schema_name TEXT := 'tenant_' || clean_cnpj;
BEGIN
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS "' || schema_name || '"';

    -- 1. Configurações da Empresa no Tenant
    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".company_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timezone TEXT NOT NULL DEFAULT ''America/Sao_Paulo'',
        currency TEXT NOT NULL DEFAULT ''BRL'',
        document_retention_days INT NOT NULL DEFAULT 1825,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    -- 2. Trilha de Auditoria Isolada
    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_id UUID,
        user_email TEXT,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        resource_id TEXT,
        status TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        request_id TEXT NOT NULL,
        details JSONB
    )';

    -- 3. Parceiros de Negócio (PRD 03)
    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".partners (
        id TEXT PRIMARY KEY,
        person_type TEXT NOT NULL,
        document TEXT NOT NULL,
        formatted_document TEXT NOT NULL,
        roles JSONB NOT NULL,
        name TEXT NOT NULL,
        trade_name TEXT,
        state_registration TEXT,
        municipal_registration TEXT,
        email TEXT,
        phone TEXT,
        address JSONB NOT NULL,
        credit_limit NUMERIC(15,2) DEFAULT 0,
        payment_terms_days INT DEFAULT 0,
        status TEXT NOT NULL DEFAULT ''ATIVO'',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    -- 4. Plano de Contas & Centros de Custo (PRD 03)
    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".chart_of_accounts (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        nature TEXT NOT NULL,
        level INT NOT NULL,
        parent_id TEXT,
        status TEXT NOT NULL DEFAULT ''ATIVO'',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".cost_centers (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT ''ATIVO'',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    -- 5. Catálogo de Produtos e Serviços (PRD 03)
    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".products (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        item_type TEXT NOT NULL,
        unit_of_measure TEXT NOT NULL,
        sale_price NUMERIC(15,2) NOT NULL DEFAULT 0,
        cost_price NUMERIC(15,2) NOT NULL DEFAULT 0,
        ncm TEXT,
        cest TEXT,
        cfop_default TEXT,
        status TEXT NOT NULL DEFAULT ''ATIVO'',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    -- 6. Orçamentos & Vendas (PRD 04)
    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".quotes (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        customer_name TEXT,
        customer_document TEXT,
        quote_number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT ''DRAFT'',
        valid_until DATE,
        subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
        discount NUMERIC(15,2) NOT NULL DEFAULT 0,
        total NUMERIC(15,2) NOT NULL DEFAULT 0,
        notes TEXT,
        items JSONB NOT NULL DEFAULT ''[]''::jsonb,
        converted_sale_id TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".sales (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        customer_name TEXT,
        customer_document TEXT,
        sale_number TEXT NOT NULL UNIQUE,
        quote_id TEXT,
        status TEXT NOT NULL DEFAULT ''CONFIRMED'',
        issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
        subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
        discount NUMERIC(15,2) NOT NULL DEFAULT 0,
        total NUMERIC(15,2) NOT NULL DEFAULT 0,
        payment_conditions TEXT,
        notes TEXT,
        items JSONB NOT NULL DEFAULT ''[]''::jsonb,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    -- 7. Ordens de Serviço (PRD 04)
    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".service_orders (
        id TEXT PRIMARY KEY,
        so_number TEXT NOT NULL UNIQUE,
        customer_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT ''DRAFT'',
        description TEXT NOT NULL,
        total NUMERIC(15,2) NOT NULL DEFAULT 0,
        items JSONB NOT NULL DEFAULT ''[]''::jsonb,
        history JSONB NOT NULL DEFAULT ''[]''::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    -- 8. Contratos de Recorrência (PRD 04)
    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".contracts (
        id TEXT PRIMARY KEY,
        contract_number TEXT NOT NULL UNIQUE,
        customer_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT ''ACTIVE'',
        frequency TEXT NOT NULL,
        monthly_value NUMERIC(15,2) NOT NULL DEFAULT 0,
        start_date DATE NOT NULL,
        end_date DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    -- 9. Faturamento & Lotes Recorrentes (PRD PARTE 05)
    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".billing (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_document TEXT,
        number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT ''DRAFT'',
        source_type TEXT NOT NULL DEFAULT ''MANUAL'',
        source_id TEXT,
        source_number TEXT,
        recurring_billing_id TEXT,
        issue_date DATE NOT NULL,
        competence_start DATE NOT NULL,
        competence_end DATE NOT NULL,
        competence_label TEXT NOT NULL,
        due_date DATE NOT NULL,
        subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
        discount NUMERIC(15,2) NOT NULL DEFAULT 0,
        surcharge NUMERIC(15,2) NOT NULL DEFAULT 0,
        total NUMERIC(15,2) NOT NULL DEFAULT 0,
        description TEXT,
        notes TEXT,
        internal_notes TEXT,
        cancellation_reason TEXT,
        canceled_at TIMESTAMPTZ,
        canceled_by TEXT,
        issued_at TIMESTAMPTZ,
        issued_by TEXT,
        collection_id TEXT,
        fiscal_document_id TEXT,
        created_by TEXT NOT NULL,
        updated_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".recurring_billing (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_document TEXT,
        contract_id TEXT,
        contract_number TEXT,
        status TEXT NOT NULL DEFAULT ''ACTIVE'',
        frequency TEXT NOT NULL DEFAULT ''MONTHLY'',
        custom_interval_months TEXT,
        start_date DATE NOT NULL,
        end_date DATE,
        next_billing_date DATE NOT NULL,
        day_of_month INT NOT NULL DEFAULT 10,
        due_rule TEXT NOT NULL DEFAULT ''FIXED_DAY'',
        due_days INT NOT NULL DEFAULT 10,
        amount NUMERIC(15,2) NOT NULL DEFAULT 0,
        description TEXT NOT NULL,
        items JSONB NOT NULL DEFAULT ''[]''::jsonb,
        last_generated_competence TEXT,
        last_generated_at TIMESTAMPTZ,
        last_generated_billing_id TEXT,
        last_generated_billing_number TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".billing_generation_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id TEXT NOT NULL,
        recurring_billing_id TEXT NOT NULL,
        competence_start DATE NOT NULL,
        competence_end DATE NOT NULL,
        competence_label TEXT NOT NULL,
        billing_id TEXT,
        billing_number TEXT,
        status TEXT NOT NULL,
        attempt_count INT NOT NULL DEFAULT 1,
        error_code TEXT,
        error_message TEXT,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        worker_id TEXT
    )';

    -- 10. Almoxarifados e WMS (PRD 06)
    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".warehouses (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        status TEXT NOT NULL DEFAULT ''ATIVO'',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".stock_movements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        warehouse_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        type TEXT NOT NULL,
        quantity NUMERIC(15,4) NOT NULL,
        unit_cost NUMERIC(15,2) NOT NULL,
        total_cost NUMERIC(15,2) NOT NULL,
        reference_type TEXT,
        reference_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".cmp (
        product_id TEXT PRIMARY KEY,
        current_stock NUMERIC(15,4) NOT NULL DEFAULT 0,
        current_cmp NUMERIC(15,2) NOT NULL DEFAULT 0,
        total_inventory_value NUMERIC(15,2) NOT NULL DEFAULT 0,
        last_movement_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    -- 11. Documentos Fiscais & NF-e (PRD 07)
    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".fiscal_documents (
        id TEXT PRIMARY KEY,
        model TEXT NOT NULL,
        series TEXT NOT NULL,
        number INT NOT NULL,
        status TEXT NOT NULL,
        issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        nfe_key TEXT UNIQUE,
        protocol TEXT,
        xml_content TEXT,
        total_invoice NUMERIC(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    -- 12. Compras & Suprimentos (PRD 08)
    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".purchase_orders (
        id TEXT PRIMARY KEY,
        po_number TEXT NOT NULL UNIQUE,
        supplier_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT ''DRAFT'',
        total NUMERIC(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    -- 13. Títulos a Receber & Cobrança Desacoplada (PRD PARTE 06)
    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".receivables_v2 (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        contract_id TEXT,
        billing_id TEXT,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_document TEXT NOT NULL,
        original_amount NUMERIC(15,2) NOT NULL,
        balance_amount NUMERIC(15,2) NOT NULL,
        discount_amount NUMERIC(15,2) DEFAULT 0,
        due_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT ''OPEN'',
        interest_rate_monthly NUMERIC(5,2) DEFAULT 1.0,
        penalty_rate_percent NUMERIC(5,2) DEFAULT 2.0,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".collections_v2 (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        receivable_id TEXT NOT NULL,
        method TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_transaction_id TEXT,
        status TEXT NOT NULL DEFAULT ''PENDING'',
        amount NUMERIC(15,2) NOT NULL,
        due_date DATE NOT NULL,
        barcode TEXT,
        digitable_line TEXT,
        pix_copy_paste TEXT,
        qr_code_url TEXT,
        paid_at TIMESTAMPTZ,
        canceled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".payments_v2 (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id TEXT NOT NULL,
        collection_id TEXT,
        receivable_id TEXT NOT NULL,
        amount_paid NUMERIC(15,2) NOT NULL,
        payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        channel TEXT NOT NULL,
        idempotency_hash TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".payment_providers_v2 (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT ''ACTIVE'',
        environment TEXT NOT NULL DEFAULT ''SANDBOX'',
        encrypted_credentials TEXT NOT NULL,
        supported_methods JSONB NOT NULL DEFAULT ''["PIX","BOLETO"]''::jsonb,
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS "' || schema_name || '".webhook_events_v2 (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        event_hash TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        payload JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT ''RECEIVED'',
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ
    )';

    -- Índices de Performance e Segurança no Schema
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_' || clean_cnpj || '_audit_ts ON "' || schema_name || '".audit_logs(timestamp)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_' || clean_cnpj || '_partners_doc ON "' || schema_name || '".partners(document)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_' || clean_cnpj || '_rec_v2_status ON "' || schema_name || '".receivables_v2(status, due_date)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_' || clean_cnpj || '_col_v2_rec ON "' || schema_name || '".collections_v2(receivable_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_' || clean_cnpj || '_pay_v2_hash ON "' || schema_name || '".payments_v2(idempotency_hash)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_' || clean_cnpj || '_wh_v2_hash ON "' || schema_name || '".webhook_events_v2(event_hash)';
END;
$$ LANGUAGE plpgsql;
