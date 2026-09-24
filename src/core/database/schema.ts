/**
 * Enlace ERP - Drizzle ORM Schemas (Control Plane & Tenant Schemas)
 * PRD 01 - Seção 4 (Control Plane vs Instâncias ERP) & Seção 5 (Isolamento por Schema)
 * PRD 02 ao PRD 09 e PRD PARTE 05 e 06 (Contratos e Tabelas Operacionais)
 */

import { pgTable, text, timestamp, boolean, jsonb, uuid, numeric, integer } from 'drizzle-orm/pg-core';

// ==========================================
// 1. SCHEMAS DO CONTROL PLANE (Metadados Globais - Schema "public")
// ==========================================

export const cpUsers = pgTable('cp_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  isPlatformAdmin: boolean('is_platform_admin').default(false).notNull(),
  mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
  mfaSecret: text('mfa_secret'),
  status: text('status').default('ACTIVE').notNull(),
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
  lockedUntil: timestamp('locked_until'),
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
  stateRegistration: text('state_registration'),
  municipalRegistration: text('municipal_registration'),
  state: text('state').default('MA'),
  city: text('city').default('São Luís'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cpMemberships = pgTable('cp_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => cpUsers.id),
  companyId: uuid('company_id').notNull().references(() => cpCompanies.id),
  role: text('role').notNull(), // 'owner' | 'admin' | 'manager' | 'operator' | 'viewer'
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

export const cpSessions = pgTable('cp_sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => cpUsers.id),
  tokenHash: text('token_hash').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  activeCompanyId: uuid('active_company_id'),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  revokedReason: text('revoked_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
});

export const cpRefreshTokens = pgTable('cp_refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => cpUsers.id),
  sessionId: text('session_id').notNull(),
  isConsumed: boolean('is_consumed').default(false).notNull(),
  replacedByTokenHash: text('replaced_by_token_hash'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cpSecurityEvents = pgTable('cp_security_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(),
  severity: text('severity').notNull(),
  userId: text('user_id'),
  userEmail: text('user_email'),
  companyId: text('company_id'),
  schemaNamespace: text('schema_namespace'),
  requestId: text('request_id'),
  details: jsonb('details'),
  mitigationTaken: text('mitigation_taken'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cpPasswordResets = pgTable('cp_password_resets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => cpUsers.id),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  isUsed: boolean('is_used').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cpInvitations = pgTable('cp_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => cpCompanies.id),
  companyName: text('company_name').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull(),
  invitedByUserId: text('invited_by_user_id').notNull(),
  invitedByName: text('invited_by_name').notNull(),
  status: text('status').default('PENDING').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==========================================
// 2. ESTRUTURAS OPERACIONAIS DO TENANT (Por CNPJ)
// Replicadas e executadas dentro do schema dedicado: "tenant_<cleanCnpj>"
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

export const tenantPartners = pgTable('partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // 'CUSTOMER' | 'SUPPLIER' | 'CARRIER' | 'BOTH'
  legalName: text('legal_name').notNull(),
  tradeName: text('trade_name'),
  documentType: text('document_type').notNull(), // 'CNPJ' | 'CPF'
  document: text('document').notNull().unique(),
  stateRegistration: text('state_registration'),
  email: text('email'),
  phone: text('phone'),
  address: jsonb('address'),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tenantProducts = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  type: text('type').default('PRODUCT').notNull(), // 'PRODUCT' | 'SERVICE'
  ncm: text('ncm').notNull(),
  cfop: text('cfop').notNull(),
  unit: text('unit').default('UN').notNull(),
  salePrice: numeric('sale_price', { precision: 15, scale: 2 }).notNull().default('0.00'),
  costPrice: numeric('cost_price', { precision: 15, scale: 2 }).notNull().default('0.00'),
  cmp: numeric('cmp', { precision: 15, scale: 4 }).notNull().default('0.0000'), // Custo Médio Ponderado
  stockQuantity: numeric('stock_quantity', { precision: 15, scale: 4 }).notNull().default('0.0000'),
  minStock: numeric('min_stock', { precision: 15, scale: 4 }).default('0.0000'),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tenantQuotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull(),
  partnerId: uuid('partner_id').notNull(),
  status: text('status').default('OPEN').notNull(),
  issueDate: text('issue_date').notNull(),
  expirationDate: text('expiration_date').notNull(),
  subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull().default('0.00'),
  discount: numeric('discount', { precision: 15, scale: 2 }).default('0.00'),
  freight: numeric('freight', { precision: 15, scale: 2 }).default('0.00'),
  total: numeric('total', { precision: 15, scale: 2 }).notNull().default('0.00'),
  items: jsonb('items').notNull(),
  convertedToSaleId: text('converted_to_sale_id'),
  convertedAt: timestamp('converted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tenantSales = pgTable('sales', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull(),
  partnerId: uuid('partner_id').notNull(),
  status: text('status').default('PENDING').notNull(),
  quoteId: text('quote_id'),
  issueDate: text('issue_date').notNull(),
  deliveryDate: text('delivery_date'),
  subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull().default('0.00'),
  discount: numeric('discount', { precision: 15, scale: 2 }).default('0.00'),
  freight: numeric('freight', { precision: 15, scale: 2 }).default('0.00'),
  total: numeric('total', { precision: 15, scale: 2 }).notNull().default('0.00'),
  items: jsonb('items').notNull(),
  paymentTerms: jsonb('payment_terms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tenantServiceOrders = pgTable('service_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull(),
  partnerId: uuid('partner_id').notNull(),
  status: text('status').default('OPEN').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  laborCost: numeric('labor_cost', { precision: 15, scale: 2 }).default('0.00'),
  partsCost: numeric('parts_cost', { precision: 15, scale: 2 }).default('0.00'),
  total: numeric('total', { precision: 15, scale: 2 }).notNull().default('0.00'),
  services: jsonb('services'),
  parts: jsonb('parts'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tenantContracts = pgTable('contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull(),
  partnerId: uuid('partner_id').notNull(),
  status: text('status').default('ACTIVE').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  monthlyAmount: numeric('monthly_amount', { precision: 15, scale: 2 }).notNull(),
  billingDay: integer('billing_day').default(10).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Faturamento e Recorrência (PRD PARTE 05)
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
  subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull().default('0.00'),
  discount: numeric('discount', { precision: 15, scale: 2 }).notNull().default('0.00'),
  surcharge: numeric('surcharge', { precision: 15, scale: 2 }).notNull().default('0.00'),
  total: numeric('total', { precision: 15, scale: 2 }).notNull().default('0.00'),
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
  quantity: numeric('quantity', { precision: 15, scale: 4 }).notNull().default('1.0000'),
  unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).notNull().default('0.00'),
  discount: numeric('discount', { precision: 15, scale: 2 }).notNull().default('0.00'),
  surcharge: numeric('surcharge', { precision: 15, scale: 2 }).notNull().default('0.00'),
  total: numeric('total', { precision: 15, scale: 2 }).notNull().default('0.00'),
  sortOrder: integer('sort_order').notNull().default(0),
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
  dayOfMonth: integer('day_of_month').notNull().default(10),
  dueRule: text('due_rule').notNull().default('FIXED_DAY'),
  dueDays: integer('due_days').notNull().default(10),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull().default('0.00'),
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
  attemptCount: integer('attempt_count').notNull().default(1),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  executedAt: timestamp('executed_at').defaultNow().notNull(),
  workerId: text('worker_id'),
});

// WMS, Depósitos e Kardex (PRD 06)
export const tenantWarehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tenantStockItems = pgTable('stock_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  warehouseId: uuid('warehouse_id').notNull().references(() => tenantWarehouses.id),
  productId: uuid('product_id').notNull().references(() => tenantProducts.id),
  quantity: numeric('quantity', { precision: 15, scale: 4 }).notNull().default('0.0000'),
  cmp: numeric('cmp', { precision: 15, scale: 4 }).notNull().default('0.0000'),
  minQuantity: numeric('min_quantity', { precision: 15, scale: 4 }).default('0.0000'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tenantStockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT'
  warehouseId: uuid('warehouse_id').notNull().references(() => tenantWarehouses.id),
  productId: uuid('product_id').notNull().references(() => tenantProducts.id),
  quantity: numeric('quantity', { precision: 15, scale: 4 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 15, scale: 4 }).notNull(),
  totalCost: numeric('total_cost', { precision: 15, scale: 2 }).notNull(),
  previousBalance: numeric('previous_balance', { precision: 15, scale: 4 }).notNull(),
  newBalance: numeric('new_balance', { precision: 15, scale: 4 }).notNull(),
  previousCmp: numeric('previous_cmp', { precision: 15, scale: 4 }).notNull(),
  newCmp: numeric('new_cmp', { precision: 15, scale: 4 }).notNull(),
  documentType: text('document_type'),
  documentId: text('document_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Fiscal (PRD 07)
export const tenantFiscalDocuments = pgTable('fiscal_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  model: text('model').notNull(), // 'NFE_55' | 'NFCE_65' | 'NFSE'
  series: text('series').notNull(),
  number: text('number').notNull(),
  type: text('type').notNull(), // 'INBOUND' | 'OUTBOUND'
  natureOfOperation: text('nature_of_operation').notNull(),
  status: text('status').default('DRAFT').notNull(),
  accessKey: text('access_key').unique(),
  protocolNumber: text('protocol_number'),
  partnerName: text('partner_name').notNull(),
  partnerCnpjCpf: text('partner_cnpj_cpf').notNull(),
  netTotal: numeric('net_total', { precision: 15, scale: 2 }).notNull().default('0.00'),
  totalICMS: numeric('total_icms', { precision: 15, scale: 2 }).default('0.00'),
  totalPIS: numeric('total_pis', { precision: 15, scale: 2 }).default('0.00'),
  totalCOFINS: numeric('total_cofins', { precision: 15, scale: 2 }).default('0.00'),
  totalIPI: numeric('total_ipi', { precision: 15, scale: 2 }).default('0.00'),
  totalISS: numeric('total_iss', { precision: 15, scale: 2 }).default('0.00'),
  xmlContent: text('xml_content'),
  cancellationReason: text('cancellation_reason'),
  authorizedAt: timestamp('authorized_at'),
  canceledAt: timestamp('canceled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Compras (PRD 08)
export const tenantPurchaseRequisitions = pgTable('purchase_requisitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull(),
  status: text('status').default('PENDING').notNull(),
  requesterId: text('requester_id').notNull(),
  requesterName: text('requester_name').notNull(),
  justification: text('justification').notNull(),
  items: jsonb('items').notNull(),
  estimatedTotal: numeric('estimated_total', { precision: 15, scale: 2 }).default('0.00'),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tenantPurchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull(),
  supplierId: uuid('supplier_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  status: text('status').default('OPEN').notNull(),
  items: jsonb('items').notNull(),
  total: numeric('total', { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Bancário, Pix & CNAB (PRD 09)
export const tenantBankAccounts = pgTable('bank_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  bankCode: text('bank_code').notNull(),
  bankName: text('bank_name').notNull(),
  agency: text('agency').notNull(),
  accountNumber: text('account_number').notNull(),
  accountType: text('account_type').default('CHECKING').notNull(),
  balance: numeric('balance', { precision: 15, scale: 2 }).default('0.00').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tenantBankSlips = pgTable('bank_slips', {
  id: uuid('id').primaryKey().defaultRandom(),
  bankAccountId: uuid('bank_account_id').notNull().references(() => tenantBankAccounts.id),
  ourNumber: text('our_number').notNull(),
  barcode: text('barcode').notNull(),
  digitableLine: text('digitable_line').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').default('REGISTERED').notNull(),
  payerName: text('payer_name').notNull(),
  payerDocument: text('payer_document').notNull(),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tenantPixCharges = pgTable('pix_charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  txid: text('txid').notNull().unique(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  pixCopiaECola: text('pix_copia_e_cola').notNull(),
  qrCodeSvg: text('qr_code_svg'),
  status: text('status').default('ACTIVE').notNull(),
  debtorName: text('debtor_name').notNull(),
  debtorDocument: text('debtor_document').notNull(),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tenantCnabFiles = pgTable('cnab_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // 'REMESSA' | 'RETORNO'
  bankCode: text('bank_code').notNull(),
  fileName: text('file_name').notNull(),
  sequentialNumber: integer('sequential_number').notNull(),
  rawContent: text('raw_content').notNull(),
  processedRecords: integer('processed_records').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Cobrança & Contas a Receber Desacopladas (PRD PARTE 06)
export const tenantReceivablesV2 = pgTable('receivables_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceId: text('instance_id').notNull(),
  code: text('code').notNull(),
  contractId: text('contract_id'),
  billingId: text('billing_id'),
  customerId: text('customer_id').notNull(),
  customerName: text('customer_name').notNull(),
  customerDocument: text('customer_document').notNull(),
  originalAmount: numeric('original_amount', { precision: 15, scale: 2 }).notNull(),
  balanceAmount: numeric('balance_amount', { precision: 15, scale: 2 }).notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('OPEN'),
  interestRateMonthly: numeric('interest_rate_monthly', { precision: 5, scale: 2 }).default('1.00'),
  penaltyRatePercent: numeric('penalty_rate_percent', { precision: 5, scale: 2 }).default('2.00'),
  penaltyFixedAmount: numeric('penalty_fixed_amount', { precision: 15, scale: 2 }).default('0.00'),
  discountDueDate: text('discount_due_date'),
  discountAmount: numeric('discount_amount', { precision: 15, scale: 2 }).default('0.00'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tenantCollectionsV2 = pgTable('collections_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceId: text('instance_id').notNull(),
  receivableId: uuid('receivable_id').notNull().references(() => tenantReceivablesV2.id),
  method: text('method').notNull(), // 'BOLETO' | 'PIX' | 'CREDIT_CARD'
  provider: text('provider').notNull(), // 'ASAAS' | 'C6' | 'CORA' | 'ENLACE_SANDBOX'
  providerTransactionId: text('provider_transaction_id'),
  status: text('status').notNull().default('PENDING'),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  dueDate: text('due_date').notNull(),
  barcode: text('barcode'),
  digitableLine: text('digitable_line'),
  pixCopyPaste: text('pix_copy_paste'),
  qrCodeUrl: text('qr_code_url'),
  paidAt: timestamp('paid_at'),
  canceledAt: timestamp('canceled_at'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tenantPaymentsV2 = pgTable('payments_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceId: text('instance_id').notNull(),
  collectionId: uuid('collection_id').notNull().references(() => tenantCollectionsV2.id),
  receivableId: uuid('receivable_id').notNull().references(() => tenantReceivablesV2.id),
  amountPaid: numeric('amount_paid', { precision: 15, scale: 2 }).notNull(),
  interestPaid: numeric('interest_paid', { precision: 15, scale: 2 }).default('0.00'),
  penaltyPaid: numeric('penalty_paid', { precision: 15, scale: 2 }).default('0.00'),
  discountApplied: numeric('discount_applied', { precision: 15, scale: 2 }).default('0.00'),
  paymentDate: text('payment_date').notNull(),
  channel: text('channel').notNull(),
  treasuryAccountId: text('treasury_account_id'),
  idempotencyHash: text('idempotency_hash').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tenantPaymentProvidersV2 = pgTable('payment_providers_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceId: text('instance_id').notNull(),
  provider: text('provider').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  environment: text('environment').notNull().default('SANDBOX'),
  encryptedCredentials: jsonb('encrypted_credentials').notNull(),
  webhookSecret: text('webhook_secret'),
  supportedMethods: jsonb('supported_methods').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tenantWebhookEventsV2 = pgTable('webhook_events_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceId: text('instance_id').notNull(),
  provider: text('provider').notNull(),
  eventHash: text('event_hash').notNull().unique(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  errorMessage: text('error_message'),
});

// Contas a Pagar (Obrigação Financeira de Compras / 3-Way Matching)
export const tenantAccountsPayable = pgTable('accounts_payable', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  supplierId: text('supplier_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  supplierDocument: text('supplier_document').notNull(),
  sourceType: text('source_type').notNull().default('INBOUND_INVOICE'),
  sourceId: text('source_id'),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  balanceAmount: numeric('balance_amount', { precision: 15, scale: 2 }).notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('OPEN'),
  description: text('description'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Sequenciais Concorrentes Multi-Tenant (PRD 01 & 04)
export const tenantSequentialCounters = pgTable('sequential_counters', {
  counterType: text('counter_type').primaryKey(),
  currentValue: integer('current_value').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
