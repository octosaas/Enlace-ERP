/**
 * Enlace ERP - Tipos e Contratos Compartilhados (Shared Types)
 * PRD 01 - Fundação, Arquitetura e Isolamento por CNPJ
 */

export type SegmentType =
  | 'comercio'
  | 'servicos'
  | 'restaurante'
  | 'construcao'
  | 'manutencao'
  | 'tecnologia'
  | 'telecom'
  | 'profissional_liberal'
  | 'outro';

export type UserRole = 'owner' | 'admin' | 'manager' | 'operator' | 'viewer';

export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DISABLED';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  status: UserStatus;
  isPlatformAdmin?: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  failedLoginAttempts: number;
  lockoutUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  cnpj: string; // Ex: '12.345.678/0001-95'
  cleanCnpj: string; // Ex: '12345678000195'
  legalName: string; // Razão Social
  tradeName: string; // Nome Fantasia
  segment: SegmentType;
  schemaNamespace: string; // Ex: 'tenant_12345678000195'
  status: 'active' | 'suspended' | 'provisioning';
  createdAt: string;
  updatedAt: string;
}

export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface Membership {
  id: string;
  userId: string;
  companyId: string;
  role: UserRole;
  permissions: string[];
  status: MembershipStatus;
  isActive: boolean;
  invitedAt?: string;
  acceptedAt?: string;
  revokedAt?: string;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  activeCompanyId?: string;
  tokenHash: string;
  ipAddress: string;
  userAgent: string;
  deviceLabel: string;
  isCurrent?: boolean;
  isRevoked: boolean;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
}

export interface RefreshToken {
  id: string;
  sessionId: string;
  userId: string;
  tokenHash: string;
  isRevoked: boolean;
  isUsed: boolean;
  replacedByTokenHash?: string;
  createdAt: string;
  expiresAt: string;
}

export interface Invitation {
  id: string;
  companyId: string;
  companyName: string;
  email: string;
  role: UserRole;
  invitedByUserId: string;
  invitedByName: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: string;
  isUsed: boolean;
  createdAt: string;
}

export type SecurityEventSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SecurityEventType =
  | 'SECURITY_LOGIN_FAILURE'
  | 'SECURITY_BRUTE_FORCE'
  | 'SECURITY_INVALID_TOKEN'
  | 'SECURITY_PERMISSION_DENIED'
  | 'SECURITY_SUSPICIOUS_SESSION'
  | 'SECURITY_CROSS_INSTANCE_ATTEMPT'
  | 'SECURITY_MFA_FAILED'
  | 'SECURITY_TOKEN_REUSE_DETECTED'
  | 'SECURITY_ACCOUNT_LOCKED';

export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: string;
  userEmail?: string;
  companyId?: string;
  schemaNamespace?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId: string;
  details: Record<string, unknown>;
  mitigationTaken: string;
}

export interface MFASetupResponse {
  secret: string;
  otpauthUrl: string;
  recoveryCodes: string[];
}

export interface ModuleDefinition {
  id: string;
  name: string;
  code: string;
  description: string;
  isCore: boolean;
  iconName: string;
}

export interface CompanyModuleStatus {
  moduleId: string;
  companyId: string;
  isEnabled: boolean;
  activatedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string | null;
  userEmail: string | null;
  companyId: string | null;
  companyCnpj: string | null;
  schemaNamespace?: string;
  action: string;
  resource: string;
  resourceId?: string;
  status: 'SUCCESS' | 'DENIED' | 'FAILED';
  ipAddress?: string;
  userAgent?: string;
  requestId: string;
  details?: Record<string, unknown>;
}

export interface TenantContext {
  requestId: string;
  correlationId: string;
  user?: User;
  activeCompany?: Company;
  membership?: Membership;
  schemaNamespace?: string;
  sessionId?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    schemaNamespace?: string;
  };
}

export interface SecurityTestResult {
  id: string;
  title: string;
  description: string;
  category: 'ISOLATION' | 'IDOR' | 'RBAC' | 'AUTH' | 'INTEGRITY' | 'BRUTE_FORCE' | 'SESSION';
  passed: boolean;
  statusCode: number;
  expectedStatus: number;
  responseMessage: string;
  testedAt: string;
  details: string;
}

// ==========================================
// PRD 03 - CADASTROS CENTRAIS & ESTRUTURA FINANCEIRA
// ==========================================

export type PersonType = 'PF' | 'PJ' | 'ESTRANGEIRO';
export type BusinessPartnerRole = 'CLIENTE' | 'FORNECEDOR' | 'TRANSPORTADORA' | 'COLABORADOR' | 'PARCEIRO';
export type PartnerStatus = 'ATIVO' | 'INATIVO' | 'BLOQUEADO';

export interface Address {
  zipCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  ibgeCode?: string;
}

export interface BusinessPartner {
  id: string;
  personType: PersonType;
  document: string; // apenas dígitos (ex: 12345678000195 ou 12345678901)
  formattedDocument: string;
  roles: BusinessPartnerRole[];
  name: string; // Razão Social ou Nome Completo
  tradeName?: string; // Nome Fantasia
  stateRegistration?: string; // Inscrição Estadual
  municipalRegistration?: string; // Inscrição Municipal
  email: string;
  phone: string;
  address: Address;
  creditLimit: number;
  paymentTermsDays: number;
  status: PartnerStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type AccountCategory = 'ATIVO' | 'PASSIVO' | 'PATRIMONIO_LIQUIDO' | 'RECEITA' | 'DESPESA';
export type AccountType = 'SINTETICA' | 'ANALITICA';
export type AccountNature = 'DEVEDORA' | 'CREDORA';

export interface ChartOfAccount {
  id: string;
  code: string; // Ex: '1.1.1.01'
  name: string;
  category: AccountCategory;
  type: AccountType;
  nature: AccountNature;
  level: number;
  parentId?: string;
  status: 'ATIVO' | 'INATIVO';
  createdAt: string;
}

export interface CostCenter {
  id: string;
  code: string; // Ex: '10.01'
  name: string;
  responsible: string;
  status: 'ATIVO' | 'INATIVO';
  createdAt: string;
}

// ============================================================================
// PRD 04 - ORÇAMENTOS, VENDAS, CONTRATOS E ORDENS DE SERVIÇO (COMERCIAL & OPS)
// ============================================================================

export type ProductItemType = 'PRODUCT' | 'SERVICE';

export interface Product {
  id: string;
  code: string; // Ex: 'PRD-001' ou 'SRV-001'
  name: string;
  type: ProductItemType;
  description?: string;
  unit: string; // Ex: 'UN', 'HORA', 'MÊS', 'M2', 'LICENÇA'
  unitPrice: number;
  costPrice?: number;
  status: 'ATIVO' | 'INATIVO';
  createdAt: string;
  updatedAt: string;
}

// --- ORÇAMENTOS (QUOTES) ---
export type QuoteStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELED';

export interface QuoteItem {
  id: string;
  quoteId: string;
  itemType: ProductItemType;
  productId?: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number; // Valor monetário calculado
  discountPercent?: number;
  surcharge: number; // Valor monetário calculado
  surchargePercent?: number;
  total: number;
  sortOrder: number;
}

export interface Quote {
  id: string;
  instanceId?: string;
  customerId: string;
  customerName?: string;
  customerDocument?: string;
  number: string; // Ex: 'ORC-000001'
  status: QuoteStatus;
  issueDate: string;
  validUntil: string;
  description: string;
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  notes?: string;
  internalNotes?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvalMethod?: 'USER' | 'CUSTOMER' | 'SYSTEM';
  convertedSaleId?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
}

// --- VENDAS (SALES) ---
export type SaleStatus = 'DRAFT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
export type SaleSourceType = 'QUOTE' | 'CONTRACT' | 'MANUAL' | 'OS' | 'OTHER';

export interface SaleItem {
  id: string;
  saleId: string;
  itemType: ProductItemType;
  productId?: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  surcharge: number;
  total: number;
  sortOrder: number;
}

export interface Sale {
  id: string;
  customerId: string;
  customerName?: string;
  customerDocument?: string;
  number: string; // Ex: 'VEN-000001'
  status: SaleStatus;
  saleDate: string;
  sourceType: SaleSourceType;
  sourceId?: string; // Ex: sourceQuoteId
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  notes?: string;
  internalNotes?: string;
  confirmedAt?: string;
  completedAt?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  items: SaleItem[];
}

// --- CONTRATOS (CONTRACTS) ---
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELED' | 'FINISHED';
export type ContractRenewalType = 'MANUAL' | 'AUTOMATIC';
export type BillingFrequency = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'AVULSO';

export interface ContractItem {
  id: string;
  contractId: string;
  itemType: ProductItemType;
  productId?: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  frequency: BillingFrequency;
  startDate: string;
  endDate?: string;
  total: number;
}

export interface Contract {
  id: string;
  customerId: string;
  customerName?: string;
  customerDocument?: string;
  number: string; // Ex: 'CTR-000001'
  title: string;
  description: string;
  status: ContractStatus;
  startDate: string;
  endDate?: string;
  renewalType: ContractRenewalType;
  billingFrequency: BillingFrequency;
  value: number; // Valor recorrente ou total contratual
  notes?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  items: ContractItem[];
}

// --- ORDENS DE SERVIÇO (SERVICE ORDERS / OS) ---
export type ServiceOrderStatus = 'OPEN' | 'SCHEDULED' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'CANCELED';
export type ServiceOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ServiceOrderSourceType = 'AVULSA' | 'SALE' | 'CONTRACT' | 'QUOTE';

export interface ServiceOrderItem {
  id: string;
  serviceOrderId: string;
  itemType: ProductItemType;
  productId?: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ServiceOrderAssignment {
  id: string;
  serviceOrderId: string;
  userId: string;
  userName: string;
  role: 'RESPONSAVEL_PRINCIPAL' | 'TECNICO' | 'PARTICIPANTE';
  assignedAt: string;
}

export interface ServiceOrderEvent {
  id: string;
  serviceOrderId: string;
  eventType: string; // Ex: 'OS_CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'SCHEDULED', 'COMMENT_ADDED'
  description: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface ServiceOrderComment {
  id: string;
  serviceOrderId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceOrder {
  id: string;
  customerId: string;
  customerName?: string;
  customerDocument?: string;
  number: string; // Ex: 'OS-000001'
  title: string;
  description: string;
  status: ServiceOrderStatus;
  priority: ServiceOrderPriority;
  scheduledStart?: string;
  scheduledEnd?: string;
  startedAt?: string;
  finishedAt?: string;
  completedAt?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  sourceType: ServiceOrderSourceType;
  sourceId?: string;
  notes?: string;
  internalNotes?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  items: ServiceOrderItem[];
  assignments: ServiceOrderAssignment[];
  events: ServiceOrderEvent[];
  comments: ServiceOrderComment[];
}

export interface CommercialDashboardMetrics {
  openQuotesCount: number;
  openQuotesValue: number;
  approvedQuotesCount: number;
  approvedQuotesValue: number;
  confirmedSalesCount: number;
  confirmedSalesValue: number;
  activeContractsCount: number;
  activeContractsValue: number;
  serviceOrdersByStatus: {
    open: number;
    scheduled: number;
    inProgress: number;
    waiting: number;
    completed: number;
    canceled: number;
  };
}

// ============================================================================
// PRD PARTE 05 — FATURAMENTO, COMPETÊNCIAS E RECORRÊNCIA (BILLING MODULE)
// ============================================================================

export type BillingDocumentStatus = 'DRAFT' | 'PENDING' | 'ISSUED' | 'CANCELED';

export type BillingSourceType = 'SALE' | 'CONTRACT' | 'SERVICE_ORDER' | 'MANUAL';

export type BillingItemType = 'PRODUCT' | 'SERVICE' | 'OTHER';

export type RecurringFrequency =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'YEARLY'
  | 'CUSTOM';

export type RecurringStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELED' | 'FINISHED';

export type DueRule = 'FIXED_DAY' | 'DAYS_AFTER_ISSUE' | 'DAYS_AFTER_COMPETENCE';

export interface BillingItem {
  id: string;
  billingId: string;
  itemType: BillingItemType;
  productId?: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  surcharge: number;
  total: number;
  sortOrder: number;
  sourceType?: BillingSourceType;
  sourceId?: string;
}

export interface BillingDocument {
  id: string;
  instanceId: string; // namespace do schema do tenant
  customerId: string;
  customerName: string;
  customerDocument?: string;
  number: string; // Ex: 'FAT-000001'
  status: BillingDocumentStatus;
  sourceType: BillingSourceType;
  sourceId?: string;
  sourceNumber?: string; // Ex: 'VEN-000001', 'CTR-000001', 'OS-000001'
  recurringBillingId?: string;
  issueDate: string; // YYYY-MM-DD
  competenceStart: string; // YYYY-MM-DD
  competenceEnd: string; // YYYY-MM-DD
  competenceLabel: string; // Ex: '09/2026'
  dueDate: string; // YYYY-MM-DD
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  description?: string;
  notes?: string;
  internalNotes?: string;
  cancellationReason?: string;
  canceledAt?: string;
  canceledBy?: string;
  issuedAt?: string;
  issuedBy?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  items: BillingItem[];
  // Campos para desacoplamento e preparação futura (Seções 43, 44 e 74)
  collectionId?: string;
  fiscalDocumentId?: string;
  isPaidPreview?: boolean;
}

export interface RecurringBillingItem {
  id?: string;
  description: string;
  itemType: BillingItemType;
  productId?: string;
  serviceId?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  surcharge: number;
  total: number;
}

export interface RecurringBilling {
  id: string;
  instanceId: string;
  customerId: string;
  customerName: string;
  customerDocument?: string;
  contractId?: string;
  contractNumber?: string;
  status: RecurringStatus;
  frequency: RecurringFrequency;
  customIntervalMonths?: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  nextBillingDate: string; // YYYY-MM-DD
  dayOfMonth: number; // 1..31
  dueRule: DueRule;
  dueDays: number;
  amount: number;
  description: string;
  items: RecurringBillingItem[];
  lastGeneratedCompetence?: string; // Ex: '09/2026'
  lastGeneratedAt?: string;
  lastGeneratedBillingId?: string;
  lastGeneratedBillingNumber?: string;
  lastError?: {
    code: string;
    message: string;
    attemptCount: number;
    lastAttemptAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BillingGenerationLog {
  id: string;
  instanceId: string;
  recurringBillingId: string;
  competenceStart: string;
  competenceEnd: string;
  competenceLabel: string;
  billingId?: string;
  billingNumber?: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  attemptCount: number;
  errorCode?: string;
  errorMessage?: string;
  executedAt: string;
  workerId?: string;
}

export interface BillingDashboardMetrics {
  totalIssuedValue: number;
  totalIssuedCount: number;
  totalCanceledValue: number;
  totalCanceledCount: number;
  totalPendingValue: number;
  totalPendingCount: number;
  totalDraftCount: number;
  activeRecurringCount: number;
  activeRecurringMonthlyValue: number;
  upcomingDueCount: number;
  upcomingDueValue: number;
  byCompetence: Array<{ competence: string; total: number; count: number }>;
  bySource: Array<{ sourceType: BillingSourceType; total: number; count: number }>;
}

// ============================================================================
// PRD 05 - GESTÃO FINANCEIRA, TESOURARIA, CONTAS A RECEBER E PAGAR & DRE
// ============================================================================

export type PaymentMethod =
  | 'PIX'
  | 'BOLETO'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'OTHER';

export type FinancialTitleStatus =
  | 'OPEN'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'CANCELED';

export interface AccountReceivable {
  id: string;
  number: string; // Ex: 'REC-000001'
  customerId: string;
  customerName: string;
  customerDocument?: string;
  saleId?: string;
  saleNumber?: string;
  contractId?: string;
  contractNumber?: string;
  chartOfAccountId: string;
  chartOfAccountCode: string;
  costCenterId?: string;
  costCenterCode?: string;
  description: string;
  issueDate: string;
  dueDate: string;
  originalValue: number;
  fineRate: number; // % de multa (ex: 2%)
  interestRate: number; // % de juros ao mês (ex: 1%)
  discountValue: number;
  fineValue: number;
  interestValue: number;
  paidValue: number;
  balanceValue: number; // Saldo residual a receber
  status: FinancialTitleStatus;
  paymentMethod?: PaymentMethod;
  bankAccountId?: string;
  paidAt?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountPayable {
  id: string;
  number: string; // Ex: 'PAG-000001'
  supplierId: string;
  supplierName: string;
  supplierDocument?: string;
  chartOfAccountId: string;
  chartOfAccountCode: string;
  costCenterId?: string;
  costCenterCode?: string;
  description: string;
  issueDate: string;
  dueDate: string;
  originalValue: number;
  discountValue: number;
  fineValue: number;
  interestValue: number;
  paidValue: number;
  balanceValue: number; // Saldo residual a pagar
  status: FinancialTitleStatus;
  paymentMethod?: PaymentMethod;
  bankAccountId?: string;
  paidAt?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankAccount {
  id: string;
  name: string; // Ex: 'Itaú Unibanco S.A.'
  bankCode: string; // Ex: '341'
  agency: string;
  accountNumber: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'CASH';
  currentBalance: number;
  initialBalance: number;
  color?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  date: string;
  description: string;
  category: string;
  relatedTitleId?: string;
  relatedTitleType?: 'RECEIVABLE' | 'PAYABLE' | 'TRANSFER';
  reconciled: boolean;
  reconciledAt?: string;
  createdAt: string;
}

export interface CashFlowDay {
  date: string;
  inflowsPredicted: number;
  inflowsRealized: number;
  outflowsPredicted: number;
  outflowsRealized: number;
  netDay: number;
  cumulativeBalance: number;
}

export interface IncomeStatementItem {
  code: string;
  name: string;
  level: number;
  type: 'REVENUE' | 'DEDUCTION' | 'COST' | 'EXPENSE' | 'RESULT';
  value: number;
  percentage: number;
}

export interface FinancialDashboardMetrics {
  totalReceivablesBalance: number;
  overdueReceivablesCount: number;
  overdueReceivablesValue: number;
  receivablesDueTodayCount: number;
  receivablesDueTodayValue: number;
  totalPayablesBalance: number;
  overduePayablesCount: number;
  overduePayablesValue: number;
  payablesDueTodayCount: number;
  payablesDueTodayValue: number;
  treasuryTotalBalance: number;
  cashFlow30DaysNet: number;
  defaultRatePercent: number;
  bankAccountsSummary: Array<{
    id: string;
    name: string;
    balance: number;
    bankCode: string;
    color?: string;
  }>;
}


