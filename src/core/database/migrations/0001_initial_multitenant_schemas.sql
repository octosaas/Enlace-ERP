-- ============================================================================
-- ENLACE ERP - MIGRATION 0001: CONTROL PLANE & TENANT DDL MULTI-SCHEMA
-- PRD 01 ao PRD 09 & PRD PARTE 05 e 06
-- ============================================================================

-- Habilita extensões necessárias no PostgreSQL
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. CONTROL PLANE (SCHEMA: public)
-- ============================================================================

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
    CONSTRAINT uk_user_company UNIQUE (user_id, company_id)
);

CREATE TABLE IF NOT EXISTS cp_company_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES cp_companies(id),
    module_code TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_company_module UNIQUE (company_id, module_code)
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

CREATE INDEX IF NOT EXISTS idx_cp_users_email ON cp_users(email);
CREATE INDEX IF NOT EXISTS idx_cp_companies_clean_cnpj ON cp_companies(clean_cnpj);
CREATE INDEX IF NOT EXISTS idx_cp_memberships_user ON cp_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_cp_memberships_company ON cp_memberships(company_id);
CREATE INDEX IF NOT EXISTS idx_cp_sessions_token ON cp_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_cp_refresh_tokens_hash ON cp_refresh_tokens(token_hash);
