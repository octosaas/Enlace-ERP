/**
 * Enlace ERP - Drizzle ORM Schemas (Control Plane & Tenant Schemas)
 * PRD 01 - Seção 4 (Control Plane vs Instâncias ERP) & Seção 5 (Isolamento por Schema)
 */

import { pgTable, text, timestamp, boolean, jsonb, uuid } from 'drizzle-orm/pg-core';

// ==========================================
// SCHEMAS DO CONTROL PLANE (Metadados Globais)
// ==========================================

export const cpUsers = pgTable('cp_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  isPlatformAdmin: boolean('is_platform_admin').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cpCompanies = pgTable('cp_companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  cnpj: text('cnpj').notNull().unique(),
  cleanCnpj: text('clean_cnpj').notNull().unique(),
  legalName: text('legal_name').notNull(),
  tradeName: text('trade_name').notNull(),
  segment: text('segment').notNull(),
  schemaNamespace: text('schema_namespace').notNull().unique(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cpMemberships = pgTable('cp_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => cpUsers.id),
  companyId: uuid('company_id').notNull().references(() => cpCompanies.id),
  role: text('role').notNull(),
  permissions: jsonb('permissions').notNull(), // Array de permissões concedidas
  isActive: boolean('is_active').default(true).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const cpCompanyModules = pgTable('cp_company_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => cpCompanies.id),
  moduleCode: text('module_code').notNull(),
  isEnabled: boolean('is_enabled').default(false).notNull(),
  activatedAt: timestamp('activated_at').defaultNow().notNull(),
});

// ==========================================
// ESTRUTURAS OPERACIONAIS DO TENANT (Por CNPJ)
// Replicadas dentro do schema dedicado: tenant_<cleanCnpj>
// ==========================================

export const tenantCompanySettings = pgTable('company_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull(),
  timezone: text('timezone').default('America/Sao_Paulo').notNull(),
  currency: text('currency').default('BRL').notNull(),
  documentRetentionDays: text('document_retention_days').default('1825').notNull(), // 5 anos (LGPD/Fiscal)
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tenantAuditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  userId: text('user_id'),
  userEmail: text('user_email'),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id'),
  status: text('status').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  requestId: text('request_id').notNull(),
  details: jsonb('details'),
});

export const tenantSampleRecords = pgTable('sample_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==========================================
// PRD PARTE 05 - ESTRUTURAS DE FATURAMENTO & RECORRÊNCIA
// ==========================================

export const tenantBilling = pgTable('billing', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceId: text('instance_id').notNull(),
  customerId: text('customer_id').notNull(),
  customerName: text('customer_name').notNull(),
  customerDocument: text('customer_document'),
  number: text('number').notNull(),
  status: text('status').notNull().default('DRAFT'),
  sourceType: text('source_type').notNull().default('MANUAL'),
  sourceId: text('source_id'),
  sourceNumber: text('source_number'),
  recurringBillingId: text('recurring_billing_id'),
  issueDate: text('issue_date').notNull(),
  competenceStart: text('competence_start').notNull(),
  competenceEnd: text('competence_end').notNull(),
  competenceLabel: text('competence_label').notNull(),
  dueDate: text('due_date').notNull(),
  subtotal: text('subtotal').notNull().default('0.00'),
  discount: text('discount').notNull().default('0.00'),
  surcharge: text('surcharge').notNull().default('0.00'),
  total: text('total').notNull().default('0.00'),
  description: text('description'),
  notes: text('notes'),
  internalNotes: text('internal_notes'),
  cancellationReason: text('cancellation_reason'),
  canceledAt: timestamp('canceled_at'),
  canceledBy: text('canceled_by'),
  issuedAt: timestamp('issued_at'),
  issuedBy: text('issued_by'),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  collectionId: text('collection_id'),
  fiscalDocumentId: text('fiscal_document_id'),
});

export const tenantBillingItems = pgTable('billing_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  billingId: uuid('billing_id').notNull().references(() => tenantBilling.id),
  itemType: text('item_type').notNull().default('SERVICE'),
  productId: text('product_id'),
  serviceId: text('service_id'),
  description: text('description').notNull(),
  quantity: text('quantity').notNull().default('1.0000'),
  unitPrice: text('unit_price').notNull().default('0.00'),
  discount: text('discount').notNull().default('0.00'),
  surcharge: text('surcharge').notNull().default('0.00'),
  total: text('total').notNull().default('0.00'),
  sortOrder: text('sort_order').notNull().default('0'),
  sourceType: text('source_type'),
  sourceId: text('source_id'),
});

export const tenantRecurringBilling = pgTable('recurring_billing', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceId: text('instance_id').notNull(),
  customerId: text('customer_id').notNull(),
  customerName: text('customer_name').notNull(),
  customerDocument: text('customer_document'),
  contractId: text('contract_id'),
  contractNumber: text('contract_number'),
  status: text('status').notNull().default('ACTIVE'),
  frequency: text('frequency').notNull().default('MONTHLY'),
  customIntervalMonths: text('custom_interval_months'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  nextBillingDate: text('next_billing_date').notNull(),
  dayOfMonth: text('day_of_month').notNull().default('10'),
  dueRule: text('due_rule').notNull().default('FIXED_DAY'),
  dueDays: text('due_days').notNull().default('10'),
  amount: text('amount').notNull().default('0.00'),
  description: text('description').notNull(),
  items: jsonb('items').notNull(),
  lastGeneratedCompetence: text('last_generated_competence'),
  lastGeneratedAt: timestamp('last_generated_at'),
  lastGeneratedBillingId: text('last_generated_billing_id'),
  lastGeneratedBillingNumber: text('last_generated_billing_number'),
  lastError: jsonb('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tenantBillingGenerationLogs = pgTable('billing_generation_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceId: text('instance_id').notNull(),
  recurringBillingId: text('recurring_billing_id').notNull(),
  competenceStart: text('competence_start').notNull(),
  competenceEnd: text('competence_end').notNull(),
  competenceLabel: text('competence_label').notNull(),
  billingId: text('billing_id'),
  billingNumber: text('billing_number'),
  status: text('status').notNull(),
  attemptCount: text('attempt_count').notNull().default('1'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  executedAt: timestamp('executed_at').defaultNow().notNull(),
  workerId: text('worker_id'),
});
