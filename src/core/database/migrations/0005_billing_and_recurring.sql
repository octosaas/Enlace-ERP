-- ============================================================================
-- ENLACE ERP - MIGRATION 0005: FATURAMENTO, COMPETÊNCIAS E RECORRÊNCIA
-- PRD PARTE 05 - Seção 62 (Banco de Dados), 63 (Índices) e 24 (Idempotência)
-- ============================================================================

-- NOTA DE ISOLAMENTO:
-- As tabelas abaixo residem em cada schema dedicado de tenant: tenant_<cleanCnpj>
-- O instance_id referencia o namespace do tenant para integridade auditável.

-- 1. TABELA DE FATURAMENTO (Billing / BillingDocument)
CREATE TABLE IF NOT EXISTS billing (
    id VARCHAR(36) PRIMARY KEY,
    instance_id VARCHAR(64) NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_document VARCHAR(32),
    number VARCHAR(32) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING', 'ISSUED', 'CANCELED')),
    source_type VARCHAR(20) NOT NULL DEFAULT 'MANUAL' CHECK (source_type IN ('SALE', 'CONTRACT', 'SERVICE_ORDER', 'MANUAL')),
    source_id VARCHAR(36),
    source_number VARCHAR(32),
    recurring_billing_id VARCHAR(36),
    issue_date DATE NOT NULL,
    competence_start DATE NOT NULL,
    competence_end DATE NOT NULL,
    competence_label VARCHAR(16) NOT NULL,
    due_date DATE NOT NULL,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    surcharge NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    notes TEXT,
    internal_notes TEXT,
    cancellation_reason TEXT,
    canceled_at TIMESTAMPTZ,
    canceled_by VARCHAR(255),
    issued_at TIMESTAMPTZ,
    issued_by VARCHAR(255),
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Campos desacoplados para integração futura com cobrança e fiscal (Seção 43 & 44)
    collection_id VARCHAR(36),
    fiscal_document_id VARCHAR(36),
    CONSTRAINT uk_billing_number_instance UNIQUE (instance_id, number)
);

-- Índices de consulta otimizada para o Billing (Seção 63)
CREATE INDEX IF NOT EXISTS idx_billing_customer ON billing (customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_status ON billing (status);
CREATE INDEX IF NOT EXISTS idx_billing_source ON billing (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_billing_competence ON billing (competence_start, competence_end);
CREATE INDEX IF NOT EXISTS idx_billing_issue_date ON billing (issue_date);
CREATE INDEX IF NOT EXISTS idx_billing_due_date ON billing (due_date);
CREATE INDEX IF NOT EXISTS idx_billing_created_at ON billing (created_at DESC);

-- 2. TABELA DE ITENS FATURÁVEIS COM SNAPSHOT COMERCIAL (BillingItem)
CREATE TABLE IF NOT EXISTS billing_items (
    id VARCHAR(36) PRIMARY KEY,
    billing_id VARCHAR(36) NOT NULL REFERENCES billing(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL DEFAULT 'SERVICE' CHECK (item_type IN ('PRODUCT', 'SERVICE', 'OTHER')),
    product_id VARCHAR(36),
    service_id VARCHAR(36),
    description VARCHAR(255) NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1.0000,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    surcharge NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    sort_order INT NOT NULL DEFAULT 0,
    source_type VARCHAR(20),
    source_id VARCHAR(36),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_items_billing_id ON billing_items (billing_id);

-- 3. TABELA DE RECORRÊNCIA DE FATURAMENTO (RecurringBilling)
CREATE TABLE IF NOT EXISTS recurring_billing (
    id VARCHAR(36) PRIMARY KEY,
    instance_id VARCHAR(64) NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_document VARCHAR(32),
    contract_id VARCHAR(36),
    contract_number VARCHAR(32),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CANCELED', 'FINISHED')),
    frequency VARCHAR(20) NOT NULL DEFAULT 'MONTHLY' CHECK (frequency IN ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'YEARLY', 'CUSTOM')),
    custom_interval_months INT,
    start_date DATE NOT NULL,
    end_date DATE,
    next_billing_date DATE NOT NULL,
    day_of_month INT NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
    due_rule VARCHAR(32) NOT NULL DEFAULT 'FIXED_DAY' CHECK (due_rule IN ('FIXED_DAY', 'DAYS_AFTER_ISSUE', 'DAYS_AFTER_COMPETENCE')),
    due_days INT NOT NULL DEFAULT 10,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    description VARCHAR(255) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_generated_competence VARCHAR(16),
    last_generated_at TIMESTAMPTZ,
    last_generated_billing_id VARCHAR(36),
    last_generated_billing_number VARCHAR(32),
    last_error JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_status ON recurring_billing (status);
CREATE INDEX IF NOT EXISTS idx_recurring_next_date ON recurring_billing (next_billing_date);
CREATE INDEX IF NOT EXISTS idx_recurring_customer ON recurring_billing (customer_id);
CREATE INDEX IF NOT EXISTS idx_recurring_contract ON recurring_billing (contract_id);

-- 4. TABELA DE AUDITORIA E LOG DE GERAÇÃO COM TRAVA DE IDEMPOTÊNCIA (Seção 24 e 65)
CREATE TABLE IF NOT EXISTS billing_generation_logs (
    id VARCHAR(36) PRIMARY KEY,
    instance_id VARCHAR(64) NOT NULL,
    recurring_billing_id VARCHAR(36) NOT NULL REFERENCES recurring_billing(id) ON DELETE CASCADE,
    competence_start DATE NOT NULL,
    competence_end DATE NOT NULL,
    competence_label VARCHAR(16) NOT NULL,
    billing_id VARCHAR(36),
    billing_number VARCHAR(32),
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'SKIPPED')),
    attempt_count INT NOT NULL DEFAULT 1,
    error_code VARCHAR(64),
    error_message TEXT,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    worker_id VARCHAR(64),
    -- RESTRIÇÃO LÓGICA CRÍTICA DE IDEMPOTÊNCIA (Seção 24)
    CONSTRAINT uk_recurring_competence_idempotency UNIQUE (instance_id, recurring_billing_id, competence_start, competence_end)
);

CREATE INDEX IF NOT EXISTS idx_gen_logs_recurring ON billing_generation_logs (recurring_billing_id);
CREATE INDEX IF NOT EXISTS idx_gen_logs_competence ON billing_generation_logs (competence_label);
